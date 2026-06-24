---
name: pipeline-branching
version: 1.0.0
domain: orchestration
description: 'Use when exploring two architecture approaches in parallel, comparing A/B architecture variants before committing to one, or forking the pipeline at the architecture-design stage to evaluate and select the best option. Triggers on: "explore two architecture options", "compare approaches A and B", "fork the pipeline". Do NOT use for default single-path pipeline execution or when only one architecture variant has been defined.'
author: system
---

## Purpose

pipeline-branching allows teams to fork the pipeline at the `architecture-design` stage into two named branches (Branch A and Branch B), run both branches through `feature-planning`, `security-review`, `testing-strategy`, and `clean-code-review` in isolated parallel contexts, and then present a side-by-side comparison scorecard with a system recommendation before a mandatory HITL gate selects the winning branch. The losing branch is archived — never written to disk — and a pre-filled ADR stub documents both variants and the selection rationale. This eliminates arbitrary architecture selection and produces a permanent, objective record of the evaluation.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `operation` | `string` | Yes | `"fork"` \| `"compare"` \| `"select"` \| `"status"` |
| `fork_point_skill` | `string` | No | Skill to fork from. Default and only valid value in v1.0.0: `"architecture-design"` |
| `branch_a` | `object` | No | Branch A spec: `label` (string), `architecture_variant` (object) — required for `fork` |
| `branch_b` | `object` | No | Branch B spec: `label` (string), `architecture_variant` (object) — required for `fork` |
| `evaluation_criteria` | `array[string]` | No | Criteria to score: `["complexity","security","testability","effort","cost"]`. Default: all five |
| `selected_branch` | `string` | No | `"A"` or `"B"` — required for `select` operation; provided at HITL gate |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "operation": {
      "type": "string",
      "enum": ["fork", "compare", "select", "status"]
    },
    "fork_point_skill": {
      "type": "string",
      "default": "architecture-design"
    },
    "branch_a": {
      "type": "object",
      "properties": {
        "label":                { "type": "string" },
        "architecture_variant": { "type": "object" }
      },
      "required": ["label", "architecture_variant"]
    },
    "branch_b": {
      "type": "object",
      "properties": {
        "label":                { "type": "string" },
        "architecture_variant": { "type": "object" }
      },
      "required": ["label", "architecture_variant"]
    },
    "evaluation_criteria": {
      "type": "array",
      "items": {
        "type": "string",
        "enum": ["complexity", "security", "testability", "effort", "cost"]
      },
      "default": ["complexity", "security", "testability", "effort", "cost"]
    },
    "selected_branch": {
      "type": "string",
      "enum": ["A", "B"]
    }
  },
  "required": ["operation"]
}
```

## Required Context

- For `fork`: both `branch_a` and `branch_b` must be provided with `label` and `architecture_variant`.
- `fork_point_skill` must be `"architecture-design"` — no other value is accepted in v1.0.0.
- No existing branch fork may be in progress for the same session when `fork` is invoked.
- For `select`: a prior `fork` must have completed in the current session AND the HITL gate must have been triggered and approved with a `selected_branch` value.
- For `compare` and `status`: a prior `fork` must have started in the current session.
- state-manager must be accessible for isolated branch context reads and writes.
- `feature-planning@^2.0.0`, `security-review@^1.0.0`, `testing-strategy@^1.2.0`, and `clean-code-review` must be registered and reachable in the skill registry.

## Execution Logic

```
Step 1 — Validate inputs  [fork operation]
  Verify branch_a and branch_b both provided with label and architecture_variant.
  Verify fork_point_skill == "architecture-design"; reject other values with UNSUPPORTED_FORK_POINT.
  Check state_manager for existing branch_a_context or branch_b_context keys.
    If found: reject with BRANCH_FORK_ALREADY_IN_PROGRESS.
  Verify selected evaluation_criteria are valid enum values.
  Output: validated_fork_inputs

Step 2 — Create isolated execution contexts  [fork operation]
  Write to state_manager:
    branch_a_context = { branch_id: "A", label: branch_a.label, status: "running",
                          phase_completed: null, artifacts: {} }
    branch_b_context = { branch_id: "B", label: branch_b.label, status: "running",
                          phase_completed: null, artifacts: {} }
  Enforce isolation: any state-manager read from within a branch's skill chain is scoped
    exclusively to that branch's context key. Neither context can read from the other.
  Output: branch_contexts_created

Step 3 — Parallel evaluation — Branch A  [fork operation, runs in parallel with Step 4]
  Within branch_a_context scope:
    3a. Invoke feature-planning with branch_a.architecture_variant as architecture input.
        Write output to branch_a_context.artifacts.feature_plan.
        Update branch_a_context.phase_completed = "feature-planning".
    3b. Invoke security-review with branch_a.architecture_variant.
        Write output to branch_a_context.artifacts.security_findings.
        Update branch_a_context.phase_completed = "security-review".
    3c. Invoke testing-strategy using branch_a feature-planning output.
        Write output to branch_a_context.artifacts.testing_strategy.
        Update branch_a_context.phase_completed = "testing-strategy".
    3d. Invoke clean-code-review using branch_a.architecture_variant (structural analysis).
        Write output to branch_a_context.artifacts.code_review_issues.
        Update branch_a_context.phase_completed = "clean-code-review".
    Update branch_a_context.status = "complete".
  Output: branch_a_evaluation_results

Step 4 — Parallel evaluation — Branch B  [fork operation, runs in parallel with Step 3]
  Within branch_b_context scope:
    Mirror Steps 3a–3d using branch_b.architecture_variant.
    Update branch_b_context.status = "complete".
  Output: branch_b_evaluation_results
  [Wait for both Step 3 and Step 4 to complete before proceeding to Step 5]

Step 5 — Score each evaluation criterion  [fork operation, after both branches complete]
  Retrieve raw values from branch evaluation outputs:
    complexity:    feature_plan.task_count + feature_plan.dependency_edge_count
    security:      security_findings.total_count × average_severity_weight
                   (severity_weight: critical=10, high=5, medium=2, low=1)
    testability:   testing_strategy.coverage_score (0–100, higher is better)
    effort:        feature_plan.total_story_points
    cost:          sum of all skill token_weight values across branch evaluation run
  Normalise each to 0–10 scale:
    For lower-is-better criteria (complexity, security, effort, cost):
      score = 10 × (max_value - branch_value) / (max_value - min_value + 1)
    For higher-is-better criteria (testability):
      score = 10 × branch_value / 100
  Apply only criteria present in evaluation_criteria input.
  Output: raw_scores { criterion: { branch_a: value, branch_b: value } }

Step 6 — Determine per-criterion and overall winner  [fork operation]
  For each scored criterion:
    if branch_a_score > branch_b_score + 0.5: winner = "A"
    if branch_b_score > branch_a_score + 0.5: winner = "B"
    else:                                      winner = "tie"
    Generate rationale: "Branch <W>: <branch_w_raw> vs Branch <L>: <branch_l_raw>"
  Overall winner: count criterion wins per branch across evaluation_criteria.
    If A_wins > B_wins: overall_winner = "A"
    If B_wins > A_wins: overall_winner = "B"
    If equal:           overall_winner = "tie"; emit both_branches_equally_scored feedback
  Output: comparison_scorecard { criteria_scores[], overall_winner }

Step 7 — Generate recommendation string  [fork operation]
  If overall_winner != "tie":
    Find the criterion with the greatest score differential.
    Format: "Recommend Branch <W> (<label>) — <primary differentiator>
             (<branch_a_raw> vs <branch_b_raw>)"
  Else:
    Format: "Branches are equally scored on all evaluated criteria.
             Consider applying additional criteria or consulting domain knowledge before selecting."
  Output: recommendation string

Step 8 — Trigger mandatory HITL gate  [fork operation]
  Emit HITL gate event with:
    payload: { comparison_scorecard, recommendation, branch_a_label, branch_b_label }
    behavior: reject (no auto-continue, no timeout)
    message: "Review the comparison scorecard and select Branch A or B.
              The pipeline cannot continue until a branch is selected."
  Pipeline halts. Orchestrator waits for select operation call.
  Output: hitl_gate_triggered

=== status operation ===
  Read branch_a_context and branch_b_context from state_manager.
  Return branch_status for both branches.
  Output: branch_status { branch_a: { status, phase_completed }, branch_b: { status, phase_completed } }

=== compare operation ===
  Read comparison_scorecard from state_manager (written during fork Step 6).
  Return existing scorecard and recommendation unchanged.
  Output: comparison_scorecard, recommendation (idempotent)

=== select operation ===

Step S1 — Verify HITL gate approval
  Confirm HITL gate from prior fork was triggered.
  Confirm selected_branch is provided ("A" or "B").
  If no prior fork completed in this session: reject with NO_PRIOR_FORK_COMPLETED.
  If HITL gate was not triggered: reject with HITL_GATE_NOT_APPROVED.
  Output: validated_selection

Step S2 — Promote winning branch
  Read all artifacts from branch_<selected>_context.artifacts.
  Write each artifact to main session context (overwriting any placeholder values).
  Update branch_<selected>_context.status = "selected".
  Output: selected_artifacts

Step S3 — Archive losing branch
  Read entire branch_<non-selected>_context.
  Write to state_manager["archived_branches.<branch_id>"] (preserve for ADR documentation).
  Update branch_<non-selected>_context.status = "archived".
  Do NOT delete. Do NOT write any non-selected artifact to main session context or file system.
  Output: archived_summary { branch_id, label, final_scores, key_characteristics }

Step S4 — Generate ADR stub
  Create adr_stub object:
    title:        "Architecture Decision: <branch_a.label> vs <branch_b.label>"
    date:         ISO-8601 timestamp
    status:       "accepted"
    context:      "Two architecture variants were evaluated in parallel pipeline branches.
                   Branch A (<label>): <brief architecture description>.
                   Branch B (<label>): <brief architecture description>.
                   Evaluation criteria: <evaluation_criteria list>."
    decision:     "Selected Branch <X> (<label>). <recommendation string>"
    consequences: "Branch <Y> (<label>) was archived. Key characteristics considered:
                   <top 3 differentiating scores from non-selected branch>."
  Output: adr_stub

Step S5 — Signal pipeline continuation
  Emit branch_selected event to orchestrator with selected_branch and selected_artifacts.
  Orchestrator resumes pipeline from post-architecture-design phase using selected_artifacts.
  Output: pipeline_continuation_signal
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `branch_status` | `object` | Current state of both branches: status, phase_completed |
| `comparison_scorecard` | `object` | Per-criterion scores for each branch: criterion, branch_a_score, branch_b_score, winner, rationale |
| `recommendation` | `string` | System recommendation with primary differentiator cited |
| `selected_artifacts` | `object` | Winning branch's full pipeline outputs (post-select only) |
| `archived_summary` | `object` | Brief summary of non-winning branch (post-select only) |
| `adr_stub` | `object` | Pre-filled ADR documenting the branching decision (post-select only) |
| `metrics` | `object` | **REQUIRED.** Execution metrics |
| `feedback` | `array[object]` | **REQUIRED.** Feedback loop entries |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "branch_status": {
      "type": "object",
      "properties": {
        "branch_a": {
          "type": "object",
          "properties": {
            "branch_id":       { "type": "string" },
            "label":           { "type": "string" },
            "status":          { "type": "string", "enum": ["pending","running","complete","selected","archived"] },
            "phase_completed": { "type": ["string", "null"] }
          },
          "required": ["branch_id", "label", "status"]
        },
        "branch_b": {
          "type": "object",
          "properties": {
            "branch_id":       { "type": "string" },
            "label":           { "type": "string" },
            "status":          { "type": "string", "enum": ["pending","running","complete","selected","archived"] },
            "phase_completed": { "type": ["string", "null"] }
          },
          "required": ["branch_id", "label", "status"]
        }
      },
      "required": ["branch_a", "branch_b"]
    },
    "comparison_scorecard": {
      "type": "object",
      "properties": {
        "criteria_scores": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "criterion":      { "type": "string" },
              "branch_a_score": { "type": "number", "minimum": 0, "maximum": 10 },
              "branch_b_score": { "type": "number", "minimum": 0, "maximum": 10 },
              "winner":         { "type": "string", "enum": ["A", "B", "tie"] },
              "rationale":      { "type": "string" }
            },
            "required": ["criterion", "branch_a_score", "branch_b_score", "winner", "rationale"]
          }
        },
        "overall_winner": { "type": "string", "enum": ["A", "B", "tie"] }
      },
      "required": ["criteria_scores", "overall_winner"]
    },
    "recommendation": { "type": "string" },
    "selected_artifacts": { "type": "object" },
    "archived_summary": {
      "type": "object",
      "properties": {
        "branch_id":            { "type": "string" },
        "label":                { "type": "string" },
        "final_scores":         { "type": "object" },
        "key_characteristics":  { "type": "array", "items": { "type": "string" } }
      }
    },
    "adr_stub": {
      "type": "object",
      "properties": {
        "title":        { "type": "string" },
        "date":         { "type": "string", "format": "date-time" },
        "status":       { "type": "string" },
        "context":      { "type": "string" },
        "decision":     { "type": "string" },
        "consequences": { "type": "string" }
      },
      "required": ["title", "date", "status", "context", "decision", "consequences"]
    },
    "metrics":  { "$ref": "#/$defs/metrics" },
    "feedback": { "type": "array", "items": { "$ref": "#/$defs/feedback_entry" } }
  },
  "required": ["branch_status", "metrics", "feedback"],
  "$defs": {
    "metrics": {
      "type": "object",
      "properties": {
        "tokens_in":      { "type": "integer" },
        "tokens_out":     { "type": "integer" },
        "duration_ms":    { "type": "integer" },
        "items_produced": { "type": "integer" },
        "version":        { "type": "string" }
      },
      "required": ["tokens_in", "tokens_out", "duration_ms", "items_produced", "version"]
    },
    "feedback_entry": {
      "type": "object",
      "properties": {
        "type":         { "type": "string", "enum": ["backpropagate", "info", "warning"] },
        "from_skill":   { "type": "string" },
        "target_skill": { "type": "string" },
        "reason":       { "type": "string" },
        "evidence":     { "type": "object" }
      },
      "required": ["type", "from_skill", "reason"]
    }
  }
}
```

## Rules & Constraints

- Maximum 2 branches per session (A/B only). A third branch invocation is rejected with `MAX_BRANCHES_EXCEEDED`.
- `fork_point_skill` MUST be `"architecture-design"` in v1.0.0. All other values are rejected with `UNSUPPORTED_FORK_POINT`.
- Both branches MUST complete all four evaluation skills before `comparison_scorecard` is produced. Partial completion does not yield a scorecard.
- The HITL gate after scorecard production is mandatory — behavior is `reject` with no timeout and no auto-continue. It CANNOT be bypassed.
- `select` CANNOT be called without a prior completed `fork` in the same session. Calling `select` without a fork returns `NO_PRIOR_FORK_COMPLETED`.
- Non-selected branch artifacts are NEVER written to the main session context or to disk. They are only archived in `archived_branches` within state-manager.
- Branch contexts are isolated — no cross-read between `branch_a_context` and `branch_b_context` during parallel evaluation.
- `adr_stub` MUST be generated on every successful `select` operation — it is not optional.

## Security Considerations

- Branch context isolation is enforced at the state-manager scope level — both branch keys must be distinct and non-overlapping.
- `architecture_variant` objects in branch inputs may contain sensitive design details. These are stored in state-manager under the branch context key — not logged, not written to disk, not included in feedback payloads beyond field name summaries.
- The `archived_summary` written to state-manager on branch archival must NOT include source code, credentials, or environment-specific values from the architecture variant.
- Validate that `selected_branch` at HITL gate is provided by an authenticated human action — not auto-generated by another skill or pipeline step.

## Token Optimization

- Both branch evaluation chains run as a parallel group — total execution time is bounded by the slower branch, not the sum of both.
- Pass only `architecture_variant` (not full pipeline context) to each branch evaluation skill to minimise per-branch context window size.
- `comparison_scorecard` computation is arithmetic — no LLM calls required for Steps 5–6.
- Recommendation string generation (Step 7) uses a template with numeric substitution — single LLM call only when the rationale requires natural language generation for tie-breaking.
- `archived_summary` contains only final scores and top-3 key characteristics — not the full branch artifact set.

## Quality Checklist

- [ ] `fork` rejects when `fork_point_skill != "architecture-design"` in v1.0.0
- [ ] `fork` rejects when an existing fork is in progress for the same session
- [ ] Branch contexts are created with isolated state-manager scope keys
- [ ] Scorecard is only produced after both branches have status `"complete"`
- [ ] HITL gate is triggered with `reject` behavior after scorecard production
- [ ] `select` rejects without prior completed fork and HITL gate approval
- [ ] Non-selected branch artifacts confirmed absent from main session context post-select
- [ ] `adr_stub` generated on every successful select
- [ ] `metrics` and `feedback` fields present in every response

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| `fork_point_skill != "architecture-design"` | `{"error": "UNSUPPORTED_FORK_POINT", "supported": ["architecture-design"]}` |
| Branch fork already in progress | `{"error": "BRANCH_FORK_ALREADY_IN_PROGRESS"}` |
| `branch_a` or `branch_b` missing from fork call | `{"error": "MISSING_BRANCH_SPEC", "missing": "branch_a|branch_b"}` |
| One branch evaluation fails mid-run | Emit `branch_execution_failed` feedback; fallback to single-branch execution with the completing branch; do not produce a scorecard |
| `select` without prior completed fork | `{"error": "NO_PRIOR_FORK_COMPLETED"}` |
| `select` without HITL gate approval | `{"error": "HITL_GATE_NOT_APPROVED"}` |
| Three or more branches requested | `{"error": "MAX_BRANCHES_EXCEEDED", "max": 2}` |
| Both branches equally scored | Emit `both_branches_equally_scored` feedback; recommend additional criteria; do not auto-select |

## 12. Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Behavior |
|------|---------|---------|----------|
| Branch selection required | `comparison_scorecard` produced after both branches complete | None (permanent halt) | `reject` — pipeline cannot continue until a human explicitly selects Branch A or B via the `select` operation. No auto-continue under any circumstance. |

> This is the only gate in the system with no timeout and `reject` behavior. The branch selection decision is permanent and irreversible — the non-selected branch is archived and cannot be reactivated in the same session.

## 13. Skill Composition

```yaml
composes:
  - skill: architecture-design
    version: "^1.3.0"
    input_map:
      architecture: "branch_a.architecture_variant"
    output_map:
      architecture: "branch_a_context.artifacts.architecture"
  - skill: feature-planning
    version: "^2.0.0"
    input_map:
      architecture: "branch_a_context.artifacts.architecture"
    output_map:
      feature_plan: "branch_a_context.artifacts.feature_plan"
  - skill: security-review
    version: "^1.0.0"
    input_map:
      architecture: "branch_a_context.artifacts.architecture"
    output_map:
      security_report: "branch_a_context.artifacts.security_findings"
  - skill: testing-strategy
    version: "^1.2.0"
    input_map:
      feature_plan: "branch_a_context.artifacts.feature_plan"
    output_map:
      testing_strategy: "branch_a_context.artifacts.testing_strategy"
  - skill: state-manager
    version: "^1.1.0"
    input_map:
      operation: "write"
      scope: "session"
      key: "branch_a_context"
    output_map:
      confirmation: "branch_a_write_confirmation"
  - skill: adr-generator
    version: "^1.0.0"
    input_map:
      adr_stub: "adr_stub"
    output_map:
      adr: "generated_adr"
```

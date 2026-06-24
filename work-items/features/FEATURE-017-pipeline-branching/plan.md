# FEATURE-017 — Implementation Plan: Pipeline Branching

## Target Skills / Artifacts

| Skill / Artifact | Action | Notes |
|---|---|---|
| `.opencode/skills/pipeline-branching/SKILL.md` (SKL-077) | Create | New skill — full 13-section spec |
| `skills/registry.json` | Update | Register SKL-077 with `status: draft` |
| `skills/index.yaml` | Update | Add index entry for pipeline-branching |

---

## §1 — Skill: pipeline-branching

**Purpose:** Forks the pipeline at the `architecture-design` stage into two isolated execution branches, runs downstream evaluation skills for both in parallel, produces a side-by-side comparison scorecard with system recommendation, enforces a mandatory HITL gate for branch selection, and promotes the winning branch to the main pipeline context while archiving the other.

### Supported Operations

| Operation | Description |
|---|---|
| `fork` | Initialise branches, run parallel evaluation, produce scorecard, trigger HITL gate |
| `compare` | Re-display existing comparison scorecard (idempotent) |
| `select` | Promote winning branch, archive losing branch, generate ADR stub, continue pipeline |
| `status` | Return current branch execution state for both branches |

### Input Schema

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
      "default": "architecture-design",
      "description": "Only 'architecture-design' is supported in v1.0.0"
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
      "items": { "type": "string", "enum": ["complexity", "security", "testability", "effort", "cost"] },
      "default": ["complexity", "security", "testability", "effort", "cost"]
    },
    "selected_branch": {
      "type": "string",
      "enum": ["A", "B"],
      "description": "Required for select operation; provided by human at HITL gate"
    }
  },
  "required": ["operation"]
}
```

### Output Schema (summary)

```json
{
  "branch_status": {
    "branch_a": "{ branch_id, label, status, phase_completed }",
    "branch_b": "{ branch_id, label, status, phase_completed }"
  },
  "comparison_scorecard": {
    "criteria_scores": "array — criterion, branch_a_score, branch_b_score, winner, rationale",
    "overall_winner":  "A | B | tie"
  },
  "recommendation":     "string — justification citing key differentiators",
  "selected_artifacts": "object — winning branch full pipeline outputs (post-select only)",
  "archived_summary":   "object — non-winning branch brief summary (post-select only)",
  "adr_stub":           "object — pre-filled ADR documenting the branching decision",
  "metrics":  "object",
  "feedback": "array"
}
```

---

## §2 — Execution Steps: fork operation

**Step 1 — Validate inputs**
Verify `branch_a` and `branch_b` are both provided with `label` and `architecture_variant`. Verify `fork_point_skill == "architecture-design"` — reject other values with `UNSUPPORTED_FORK_POINT` error in v1.0.0. Verify no existing branch fork is already in-progress for this session (check state-manager for `branch_a_context`).

**Step 2 — Create isolated execution contexts**
Write `branch_a_context` and `branch_b_context` as separate scope keys in state-manager:
```json
{
  "branch_id": "A",
  "label": "<branch_a.label>",
  "status": "running",
  "phase_completed": null,
  "artifacts": {}
}
```
Neither branch context key may be read by the other branch during parallel evaluation.

**Step 3 — Run parallel evaluation (both branches simultaneously)**
For each branch context (A and B), invoke the following skills sequentially within the branch's isolated context:
1. `feature-planning` — using `branch_x.architecture_variant` as architecture input
2. `security-review` — using `branch_x.architecture_variant` as architecture input
3. `testing-strategy` — using feature-planning output from this branch
4. `clean-code-review` — using architecture variant (structural analysis only)

Both branch evaluation chains run as a parallel group — Branch A and Branch B execute concurrently. Both must complete before Step 4.

**Step 4 — Score each evaluation criterion**
Normalise all raw scores to a 0–10 scale (lower = better for complexity/security/effort/cost; higher = better for testability).

| Criterion | Source | Scoring Rule |
|---|---|---|
| `complexity` | feature-planning task count + dependency edges | Lower count = higher score |
| `security` | security-review total finding count × severity weight | Fewer/lower severity = higher score |
| `testability` | testing-strategy coverage score field | Higher coverage = higher score |
| `effort` | feature-planning total story points | Lower SP = higher score |
| `cost` | sum of skill token_weight across branch evaluation | Lower tokens = higher score |

For each criterion: determine winner (`A`, `B`, or `tie`). Generate rationale string citing key numeric differentiators.

**Step 5 — Determine overall winner**
Apply equal weight to each criterion in `evaluation_criteria`. Count criterion wins per branch. Determine `overall_winner` by majority. If tied: `overall_winner = "tie"`.

**Step 6 — Generate recommendation string**
Format: `"Recommend Branch <X> — <primary differentiator> (<branch_a_value> vs <branch_b_value>)"`. If tied: `"Branches are equally scored. Applying additional criteria recommended before selection."` — emit `both_branches_equally_scored` feedback.

**Step 7 — Trigger mandatory HITL gate**
Emit HITL gate event containing `comparison_scorecard` + `recommendation`. Set gate behavior to `reject` (no auto-continue, no timeout). Pipeline halts. Orchestrator must wait for a `select` operation call with `selected_branch` provided by the human.

---

## §3 — Execution Steps: select operation

**Step 1 — Verify HITL gate approval**
Confirm the HITL gate from the preceding `fork` was triggered and approved. Confirm `selected_branch` value is `"A"` or `"B"`. Reject the `select` call if no prior `fork` was completed in this session.

**Step 2 — Promote winning branch**
Copy all artifacts from `branch_<selected>_context.artifacts` to the main session context. Update `branch_<selected>_context.status = "selected"`.

**Step 3 — Archive losing branch**
Move `branch_<non-selected>_context` to `archived_branches.<branch_id>` in state-manager. Update status to `"archived"`. Do NOT delete — preserved for ADR documentation.

**Step 4 — Generate ADR stub**
Create a pre-filled ADR stub object:
- `title`: `"Architecture Decision: <branch_a.label> vs <branch_b.label>"`
- `date`: ISO-8601 timestamp
- `status`: `"accepted"`
- `context`: summary of both architecture variants and the evaluation criteria used
- `decision`: `"Selected Branch <X> (<label>). <recommendation string>"`
- `consequences`: key characteristics of the archived branch that were considered

**Step 5 — Signal pipeline continuation**
Emit `branch_selected` event to orchestrator with `selected_branch` and `selected_artifacts`. Orchestrator continues pipeline from the post-architecture-design phase using the promoted artifacts.

---

## §4 — Branch Context Key Structure

```json
{
  "branch_a_context": {
    "branch_id": "A",
    "label": "<user label>",
    "status": "pending | running | complete | selected | archived",
    "phase_completed": "<last completed skill name or null>",
    "artifacts": {
      "feature_plan": {},
      "security_findings": [],
      "testing_strategy": {},
      "code_review_issues": []
    }
  },
  "branch_b_context": { "...same shape..." },
  "archived_branches": {
    "A": { "...full context at time of archival..." },
    "B": { "...full context at time of archival..." }
  }
}
```

---

## §5 — Hard Constraints

- Maximum 2 branches per session (A/B only — A/B/C is rejected with `MAX_BRANCHES_EXCEEDED`)
- `fork_point_skill` must be `"architecture-design"` in v1.0.0
- HITL gate after scorecard is mandatory — `reject` behavior, no timeout, cannot be bypassed
- `select` cannot be called without a prior completed `fork` in the same session
- Non-selected branch artifacts are NEVER written to the main file system — only to `archived_branches`

---

## §6 — Registry Entry

```json
{
  "id": "SKL-077",
  "name": "pipeline-branching",
  "version": "1.0.0",
  "domain": "orchestration",
  "status": "draft",
  "phase": 7,
  "req_id": "N21"
}
```

---

## §7 — Validation

`scripts/validate-skills.sh` must pass (exit 0) after SKL-077 is registered.

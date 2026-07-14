---
name: plan-debate
version: 1.0.0
domain: planning
description: 'Use when two AI models must independently generate and cross-validate an implementation plan before code generation begins. Triggers on: "debate the plan", "dual-model plan review", "cross-validate implementation plan", "plan consensus gate", "plan-debate". Do NOT use for architecture debate — use multi-agent-debate for that.'
author: system
---

## Purpose

Receives two independently-generated implementation plans (`plan_a` from the Strategic Planner
persona, `plan_b` from the Pragmatist Planner persona) and runs a symmetric cross-review loop
where each plan evaluates the other against 10 shared planning criteria. When structural
disagreements persist across consecutive rounds (stalemate), invokes `research-artifact` once
per stale criterion (capped at `max_concurrent_research`) for evidence-backed resolution.
Produces a single `consensus_plan` when `consensus_score >= consensus_threshold`. If consensus
is not reached within `max_rounds`, escalates to a HITL gate. Code generation MUST NOT begin
until this skill produces a `consensus_plan` with `termination` in
`["converged", "hitl_override"]`.

**When to invoke:** After `phase-4-planning` and `phase-4-planning-b` complete in parallel.
Enabled via `pipeline_config.debate_plan: true`. Skipped if the flag is absent or `false`.

**Design rationale:** Based on Du et al. (2023) "Improving Factuality and Reasoning through
Multiagent Debate" (arXiv:2305.14325) — parallel initialization maximizes initial divergence
before structured cross-review rounds. The Delphi method literature (Hsu & Sandford, 2007)
supports 3 rounds as the empirical convergence peak before diminishing returns.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `plan_a` | `object` | Yes | Output from `feature-planning` (Strategic Planner instance). Full feature-planning output schema. |
| `plan_b` | `object` | Yes | Output from `feature-planning` (Pragmatist Planner instance). Full feature-planning output schema. |
| `requirements` | `array[object]` | Yes | Requirements from `requirement-analyzer` — used for REQ traceability validation. |
| `max_rounds` | `integer` | No | Max debate rounds. Default: 3. Range: 1–5. |
| `consensus_threshold` | `float` | No | Convergence threshold. Default: 0.80. Range: 0.5–1.0. |
| `research_enabled` | `boolean` | No | When false, skip research on stalemate — disagreements go directly to HITL. Default: true. |
| `max_concurrent_research` | `integer` | No | Max parallel research-artifact calls per stalemate round. Default: 3. Range: 1–10. |
| `research_token_budget_per_criterion` | `integer` | No | Max tokens per research call. Default: 2000. |
| `session_id` | `string` | Yes | UUID v4 of active pipeline session. |

**$pipeline_param resolution:** `max_rounds`, `consensus_threshold`, `research_enabled`,
`max_concurrent_research`, and `research_token_budget_per_criterion` are resolved via the
`$pipeline_param` resolver. The orchestrator validates injected values against `type`, `min`,
and `max` constraints **before** injection. The skill also validates on receipt as a defense-
in-depth measure.

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["plan_a", "plan_b", "requirements", "session_id"],
  "properties": {
    "plan_a":                { "type": "object" },
    "plan_b":                { "type": "object" },
    "requirements":          { "type": "array", "items": { "type": "object" } },
    "max_rounds":            { "type": "integer", "minimum": 1, "maximum": 5, "default": 3 },
    "consensus_threshold":   { "type": "number",  "minimum": 0.5, "maximum": 1.0, "default": 0.80 },
    "research_enabled":      { "type": "boolean", "default": true },
    "max_concurrent_research": { "type": "integer", "minimum": 1, "maximum": 10, "default": 3 },
    "research_token_budget_per_criterion": { "type": "integer", "default": 2000 },
    "session_id":            { "type": "string", "format": "uuid" }
  }
}
```

## Required Context

- `plan_a` must be the output of `feature-planning@^2.2.0` with `instance: "model_a"`.
- `plan_b` must be the output of `feature-planning@^2.2.0` with `instance: "model_b"` and
  `orchestrator_context_isolation.exclude_phases: ["phase-4-planning"]`. Audit log entry
  must exist proving `plan_b` context did not contain `plan_a` output.
- `pipeline_config.debate_plan` must be `true` in session state.

## Execution Logic

```
Step 1 — Validate inputs
  Verify plan_a and plan_b are valid feature-planning outputs.
    Required fields (aligned with skills/schema/feature-planning-output.schema.json):
      tasks[], milestones[], uncertainty_markers[], new_external_dependencies[],
      effort_total_sp, critical_path_task_ids[].
    Note: req_task_map, dependency_map, phases[], and risks[] are NOT required by the schema —
    do not hard-fail on their absence. If present, use them for richer criterion evaluation.
    If absent, evaluate those criteria at reduced confidence and emit info-level note.
  Verify context_isolation audit log entry exists for plan_b.
    If missing: return error CONTEXT_ISOLATION_AUDIT_MISSING.
  Resolve $pipeline_param values. Validate against type/min/max constraints.
  If pre_approved_plan_ref is set AND ci_mode is true:
    Validate ref: sha256(run_id || artifact_content) must match signed hash.
    Check TTL (≤72 hours from signing timestamp).
    Check run_id scope binding matches current run_id.
    If validation fails: return error PRE_APPROVED_REF_INVALID — do NOT bypass.
    If validation passes: load consensus_plan from ref path.
      SET termination = "ci_mode_pre_approved"
      Log gate_decisions[]: { gate: "plan-debate-bypass", bypass_reason: "ci_mode_pre_approved",
        ref_path, run_id, timestamp }
      SKIP to Step 6.
  Output: validated_inputs

Step 2 — Initialize debate state
  SET effective_criteria = PLANNING_CRITERIA (10 items — see below)
  SET total_criteria = 10
  SET required_passing = ceil(total_criteria * consensus_threshold)
  SET round = 1
  SET debate_transcript = []
  SET criteria_verdicts_a_reviews_b = { criterion: "pending" } × 10
  SET criteria_verdicts_b_reviews_a = { criterion: "pending" } × 10
  SET unresolved_disagreements = []
  SET research_invocations = []
  Output: initialized_state

Step 3 — Round loop (repeat until termination condition)

  ── SYMMETRIC CROSS-REVIEW ──────────────────────────────────────────────────
  For each criterion C in PLANNING_CRITERIA:
    Plan A reviews Plan B:
      IF criteria_verdicts_a_reviews_b[C] == "agree": retain (PASS-STICKY — never regress).
      ELSE:
        verdict_a_on_b[C] = "agree" | "concern" | "reject"
        evidence = specific task ID, story-point value, or phase ref from plan_b
        remediation = concrete change (for concern/reject only)

    Plan B reviews Plan A (same pass-sticky rule):
      verdict_b_on_a[C] = "agree" | "concern" | "reject"
      evidence, remediation

  ── PLAN REVISION ────────────────────────────────────────────────────────────
  Each planner revises its OWN plan addressing the other's concerns.
    A planner may rebut a concern by citing requirement evidence instead of revising.
    A rebuttal accepted by the reviewer (updated to "agree") counts as resolved.

  ── DISAGREEMENT DETECTION ───────────────────────────────────────────────────
  For each criterion C:
    STALEMATE on C = (verdict_a_on_b[C] != "agree") AND (verdict_b_on_a[C] != "agree")
      AND remediation_a[C] and remediation_b[C] point in opposite directions
      AND no movement on C since prior round (same verdict + same plan position)

  ── RESEARCH ESCALATION (on stalemate, capped) ───────────────────────────────
  IF research_enabled AND stalemate criteria detected in this round (same as prior round):
    stale_criteria = [C where C was stalemate in prior round AND still stalemate now]
    Invoke research-artifact for each stale C in batches of max_concurrent_research:
      topic:     "<C> — best practices for software implementation planning"
      context:   "Plan A position: <summary>. Plan B position: <summary>."
      questions: ["What is the evidence-backed best practice for <C>?",
                  "Does published methodology favor Plan A or Plan B on this criterion?"]
      token_budget: research_token_budget_per_criterion
      timeout:   per-round wall-clock timeout applies to entire batch.
        If timeout fires before batch drains:
          Mark remaining queued calls as evidence: "unavailable"
          Continue round with available research results.
    For each research result:
      IF evidence_quality in ["strong", "moderate"] AND clearly favors one position:
        Update disadvantaged planner's verdict to "agree" for this C.
        Record: { criterion: C, evidence_quality, resolution: "resolved", winner }
      ELSE:
        Record: { criterion: C, evidence_quality, resolution: "escalated_to_hitl" }
        Keep C in unresolved_disagreements[]

  ── CONSENSUS SCORE ──────────────────────────────────────────────────────────
  passing_count = count(C where verdict_a_on_b[C]=="agree" AND verdict_b_on_a[C]=="agree")
  consensus_score = passing_count / total_criteria

  ── TRANSCRIPT APPEND ────────────────────────────────────────────────────────
  debate_transcript.append({
    round, plan_a_review_of_b, plan_b_review_of_a,
    disagreements, research_triggered, research_resolutions, consensus_score
  })

  ── TERMINATION CHECKS ───────────────────────────────────────────────────────
  EARLY EXIT:  IF consensus_score >= consensus_threshold:
                 SET termination = "converged"
                 BREAK  ← do not wait for max_rounds

  STALEMATE:   IF round >= 2:
                 curr_stale = set of C where stalemate in current round
                 prev_stale = set of C where stalemate in prior round
                 IF curr_stale == prev_stale AND research already invoked for all stale C:
                   SET termination = "stalemate"
                   BREAK

  MAX_ROUNDS:  IF round == effective_max_rounds:
                 SET termination = "max_rounds"
                 BREAK

  INCREMENT round

Step 4 — Synthesize consensus_plan (when termination == "converged")
  For each planning dimension:
    tasks[]:
      Tasks in both plans (semantic match): keep with "merged" provenance.
        Estimate: use Plan A's value if delta ≤ 20%; else take conservative (higher) of two.
      Tasks in plan_a only: include with "plan_a" provenance.
      Tasks in plan_b only, priority "critical" or "high": include with "plan_b" provenance.
      Tasks in plan_b only, priority "medium" or "low": include only if no plan_a equivalent.
    phases[]:   use the phase structure from the plan with the highest consensus_score.
    milestones[]: union of both plans, deduplicated by name.
    risks[]:    union of all risks (all risks are additive — never discard).
    req_task_map: recompute from merged tasks[] — every REQ must have ≥1 task.
    dependency_map: recompute via topological sort; error if cycle detected.
  Tag every task: { ..., provenance: "plan_a" | "plan_b" | "merged" }
  Output: consensus_plan

  MERGE (HITL choice): Human-authored merge with AI-suggested diffs only.
    The MERGE option produces a draft merged plan as a suggestion.
    The human authors the final merge. The merged plan MUST re-enter consensus
    scoring (Step 3, single pass) to confirm it passes criteria before output.

Step 5 — HITL escalation (when termination != "converged")
  IF ci_mode == true AND pre_approved_plan_ref is NOT set:
    Return error: PLAN_DEBATE_CONSENSUS_REQUIRED.
    Pipeline halts. (No silent bypass without a signed ref.)

  Present HITL prompt:
    ╔══════════════════════════════════════════════════════════════════════╗
    ║  PLAN DEBATE — CONSENSUS NOT REACHED                                 ║
    ║  Rounds completed: <N> / <max_rounds>                                ║
    ║  Final consensus score: <X>/10 (<Y>%) — threshold: 80%              ║
    ╠══════════════════════════════════════════════════════════════════════╣
    ║  UNRESOLVED DISAGREEMENTS (<count>):                                 ║
    ║  [DISAGREE-NNN] Criterion: <name>                                   ║
    ║  Plan A: <position>   Plan B: <position>                            ║
    ║  Research: <finding or "not attempted">                              ║
    ╠══════════════════════════════════════════════════════════════════════╣
    ║  AGREED ITEMS: <comma-separated criterion names>                     ║
    ╠══════════════════════════════════════════════════════════════════════╣
    ║  CHOICES: ACCEPT_A | ACCEPT_B | MERGE | RESTART | REJECT            ║
    ╚══════════════════════════════════════════════════════════════════════╝

  Timeout: 3600s. bypass_on_timeout: false.
    ON TIMEOUT: error PLAN_DEBATE_GATE_TIMEOUT. Pipeline halts. Never auto-accept.

  ON ACCEPT_A:  consensus_plan = plan_a (latest revision). termination = "hitl_override".
  ON ACCEPT_B:  consensus_plan = plan_b (latest revision). termination = "hitl_override".
  ON MERGE:     Human authors final merged plan with AI-suggested diffs.
                Merged plan re-enters Step 3 single-pass scoring.
                consensus_plan = merge_result. termination = "hitl_override".
  ON RESTART:   Restart from Step 2 with modified critique_criteria.
                Max 1 restart per invocation.
                If second non-convergence: offer ACCEPT_A / ACCEPT_B / MERGE / REJECT only.
  ON REJECT:    termination = "hitl_reject". Pipeline halts.

Step 6 — Write artifact
  Write artifacts/plan-debate-<ISO8601>.md with:
    data_classification: internal-confidential
    retention_days: 30
    Contents: debate summary, round-by-round consensus scores, disagreements and
    resolutions, research invocations and evidence, final plan summary.
  Return output per output schema.
```

## Planning Criteria (10 items)

```
1.  All architecture modules are traceable to ≥1 task (req_task_map completeness)
2.  Task dependencies form a DAG (no cycles in dependency_map)
3.  Critical-path tasks are identified; longest chain ≤50% of total story points
4.  Effort estimates are present and Fibonacci-bounded (no task with estimate 0; max 21 pts)
5.  Architecture unresolved_concerns[] are addressed by explicit tasks
6.  Each milestone produces a testable artifact
7.  Integration tasks are ordered before dependent implementation tasks
8.  Rollback points are identified for tasks with risk_severity: high | critical
9.  Total estimated duration is within project timeline constraints (if provided)
10. No orphan tasks — every task is reachable from ≥1 milestone
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `consensus_plan` | `object` | Final merged plan. Same schema as `feature-planning` output. Every task has `provenance: "plan_a" | "plan_b" | "merged"`. |
| `debate_transcript` | `array` | Full debate log: `[{round, plan_a_review, plan_b_review, disagreements, research_triggered, research_resolutions, consensus_score}]` |
| `consensus_reached` | `boolean` | `true` if convergence achieved before `max_rounds`. |
| `termination` | `string` | One of: `converged`, `stalemate`, `max_rounds`, `hitl_override`, `hitl_reject`, `ci_mode_pre_approved`. |
| `rounds_taken` | `integer` | Number of complete rounds executed. |
| `final_consensus_score` | `float` | Score at termination (0.0–1.0). |
| `unresolved_disagreements` | `array` | Criteria still unresolved at termination. |
| `research_invocations` | `array` | `[{criterion, evidence_quality, resolution}]` |
| `metrics` | `object` | Execution metrics (tokens_in, tokens_out, duration_ms, items_produced, version) |
| `feedback` | `array` | Feedback entries |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["consensus_plan","debate_transcript","consensus_reached","termination",
               "rounds_taken","final_consensus_score","unresolved_disagreements",
               "research_invocations","metrics","feedback"],
  "properties": {
    "consensus_plan":            { "type": "object" },
    "debate_transcript": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["round","plan_a_review","plan_b_review","consensus_score"],
        "properties": {
          "round":               { "type": "integer" },
          "plan_a_review":       { "type": "array" },
          "plan_b_review":       { "type": "array" },
          "disagreements":       { "type": "array" },
          "research_triggered":  { "type": "boolean" },
          "research_resolutions":{ "type": "array" },
          "consensus_score":     { "type": "number", "minimum": 0, "maximum": 1 }
        }
      }
    },
    "consensus_reached":         { "type": "boolean" },
    "termination": {
      "type": "string",
      "enum": ["converged","stalemate","max_rounds","hitl_override","hitl_reject","ci_mode_pre_approved"]
    },
    "rounds_taken":              { "type": "integer", "minimum": 1 },
    "final_consensus_score":     { "type": "number", "minimum": 0, "maximum": 1 },
    "unresolved_disagreements": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["criterion","plan_a_position","plan_b_position","research_attempted","reason_unresolved"],
        "properties": {
          "criterion":           { "type": "string" },
          "plan_a_position":     { "type": "string" },
          "plan_b_position":     { "type": "string" },
          "research_attempted":  { "type": "boolean" },
          "research_quality":    { "type": "string", "enum": ["strong","moderate","weak","unavailable","not_attempted"] },
          "reason_unresolved":   { "type": "string" }
        }
      }
    },
    "research_invocations": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["criterion","evidence_quality","resolution"],
        "properties": {
          "criterion":       { "type": "string" },
          "evidence_quality":{ "type": "string", "enum": ["strong","moderate","weak","unavailable"] },
          "resolution":      { "type": "string", "enum": ["resolved","escalated_to_hitl","unavailable"] }
        }
      }
    },
    "metrics": {
      "type": "object",
      "required": ["tokens_in","tokens_out","duration_ms","items_produced","version"],
      "properties": {
        "tokens_in":       { "type": "integer" },
        "tokens_out":      { "type": "integer" },
        "duration_ms":     { "type": "integer" },
        "items_produced":  { "type": "integer" },
        "version":         { "type": "string" }
      }
    },
    "feedback": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["type","from_skill","reason"],
        "properties": {
          "type":       { "type": "string", "enum": ["backpropagate","info","warning"] },
          "from_skill": { "type": "string" },
          "reason":     { "type": "string" }
        }
      }
    }
  }
}
```

## Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Behavior |
|------|---------|---------|----------|
| Debate escalation | `termination in ["stalemate", "max_rounds"]` | 3600s | Present transcript, score, disagreements. Choices: ACCEPT_A / ACCEPT_B / MERGE / RESTART / REJECT. No auto-accept on timeout — timeout → pipeline error. |

## Rules & Constraints

- **Pass-sticky:** Once a criterion reaches `"agree"`, it MUST NOT regress. Enforced per-criterion, per-review direction.
- **Early exit:** If `consensus_score >= consensus_threshold` after any round, terminate immediately — do not run remaining rounds.
- **Research cap:** At most `max_concurrent_research` (default 3) simultaneous `research-artifact` calls per stalemate round. Remaining stale criteria queued; queue abandoned and marked "unavailable" if per-round 120s timeout fires.
- **Research trigger:** Fire ONLY when the same criterion is stalemate in two consecutive rounds (no movement). Do NOT trigger on first-occurrence disagreements — they may self-resolve in the next round.
- **Research frequency:** At most one call per unique stale criterion per debate session (not per round).
- **Research evidence types:** `strong` = peer-reviewed paper, official standard, primary source. `moderate` = widely-cited best practice, official framework docs. `weak` = generic guidance, no citation. Only `strong` and `moderate` auto-resolve disagreements.
- **RESTART limit:** Maximum 1 restart per skill invocation. Second request: offer ACCEPT_A / ACCEPT_B / MERGE / REJECT only.
- **MERGE flow:** Human-authored only. AI suggestions are advisory. Merged plan re-enters Step 3 single-pass scoring before final output.
- **CI bypass:** Requires BOTH `ci_mode: true` AND valid `pre_approved_plan_ref` (sha256(run_id ‖ artifact_content), TTL ≤72h, run_id scope bound). Missing ref → PLAN_DEBATE_CONSENSUS_REQUIRED error. Invalid ref → PRE_APPROVED_REF_INVALID error. Both halt the pipeline.
- **Context isolation:** `plan_b` MUST have been generated with `orchestrator_context_isolation.exclude_phases: ["phase-4-planning"]`. Audit log entry is required. Missing audit log → CONTEXT_ISOLATION_AUDIT_MISSING error.

## Security Considerations

- `pre_approved_plan_ref` integrity: `sha256(run_id ‖ artifact_content)`. The `run_id` must be bound into the hash to prevent cross-run replay. Both components are included: `sha256(run_id_bytes || artifact_json_bytes)`.
- `$pipeline_param` resolver validation: orchestrator validates `type`, `min`, `max` before injection. Skill validates on receipt as defense-in-depth. Out-of-range values (e.g., `max_rounds: 99`) are rejected with error INVALID_PARAM_VALUE.
- `context_hash` in the audit entry: `sha256_rfc8785(stripped_context)` where `stripped_context` is the context injected into `plan_b` with all `phase-4-planning` output fields removed. Use RFC 8785 JSON Canonical Form serialization (sorted keys, no extra whitespace) before hashing — do NOT use `JSON.stringify()` without key-sorting as it produces non-deterministic output. Algorithm: SHA-256 over RFC 8785 bytes.
- Debate artifact (`artifacts/plan-debate-<ISO8601>.md`): `data_classification: internal-confidential`, `retention_days: 30`. May contain confidential business logic from requirements.
- Model A and Model B operate on plan metadata only. They MUST NOT have access to credentials, infrastructure secrets, or production data.

## Token Optimization

- Pass-sticky rule reduces per-round token cost: only unresolved criteria are re-evaluated.
- Research calls are token-budgeted per criterion (`research_token_budget_per_criterion: 2000`).
- Debate transcript is compressed after completion (round summaries only: consensus_score, count of concerns).
- `max_concurrent_research` prevents runaway fan-out.

## Quality Checklist

- [ ] `plan_a` and `plan_b` validated against `feature-planning` output schema
- [ ] Context isolation audit log entry verified for `plan_b`
- [ ] `pre_approved_plan_ref` validated (if CI bypass path)
- [ ] `$pipeline_param` values validated against type/min/max constraints
- [ ] Pass-sticky rule enforced (no criterion regresses from "agree")
- [ ] Early-exit fires correctly when consensus_score >= threshold before max_rounds
- [ ] Stalemate detection fires only when same criteria unresolved in consecutive rounds
- [ ] Research triggered at most once per unique stale criterion per session
- [ ] Research queue abandoned at per-round 120s timeout
- [ ] HITL gate fires when termination != "converged" in non-CI mode
- [ ] RESTART limited to 1 per invocation
- [ ] MERGE option: human-authored, re-enters scoring before final output
- [ ] Artifact written with data_classification and retention_days
- [ ] `unresolved_disagreements[]` propagated to `feature-planning` as `architecture_risks[]`
- [ ] `metrics` and `feedback` fields present in output

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| `plan_a` or `plan_b` missing or malformed | Return error `INVALID_PLAN_INPUT`. Do not begin debate. |
| Context isolation audit log missing for `plan_b` | Return error `CONTEXT_ISOLATION_AUDIT_MISSING`. Pipeline halts. |
| `pre_approved_plan_ref` validation fails (bad hash, expired, wrong `run_id`) | Return error `PRE_APPROVED_REF_INVALID`. Do NOT bypass. Pipeline halts. |
| `$pipeline_param` value out of range (e.g., `max_rounds: 99`) | Return error `INVALID_PARAM_VALUE`. Pipeline halts. |
| HITL gate timeout (3600s) | Return error `PLAN_DEBATE_GATE_TIMEOUT`. Pipeline halts. Never auto-accept. |
| `research-artifact` invocation fails or times out | Mark criterion evidence as `"unavailable"`. Continue round. Do not block on research failure. |
| Per-round 120s wall-clock timeout fires while research queue has pending calls | Abandon queued calls, mark as `"unavailable"`. Continue with available results. Count round toward `rounds_taken`. |
| `max_rounds` exceeded before convergence | Emit `warning` feedback. Set `termination = "max_rounds"`. Escalate to HITL gate. |
| RESTART requested a second time | Offer only ACCEPT_A / ACCEPT_B / MERGE / REJECT. No second restart. |

## Skill Composition

```yaml
consumes_from:
  - skill: feature-planning
    version: "^2.2.0"
    role: plan_a (Strategic Planner instance)
  - skill: feature-planning
    version: "^2.2.0"
    role: plan_b (Pragmatist Planner instance)
  - skill: research-artifact
    version: "^1.0.0"
    role: inline sub-skill call on stalemate (not a pipeline phase)

produces_for:
  - skill: task-dag
    version: "^1.0.0"
    passes: consensus_plan (as the authoritative plan input)
  - skill: change-impact-analyzer
    version: "^1.0.0"
    passes: consensus_plan
  - skill: feature-planning (next run)
    passes: unresolved_disagreements[] as plan_risks[] (session state key, not a schema-defined field)

pipeline_entry:
  - pipeline: full-pipeline
    phase: phase-4b-plan-debate (conditional — enabled by debate_plan: true)
```

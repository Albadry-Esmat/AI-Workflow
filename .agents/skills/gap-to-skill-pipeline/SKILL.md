---
name: gap-to-skill-pipeline
version: 1.0.0
domain: meta
description: 'Use when converting a logged capability gap into a registered draft skill via a human-guided reactive pipeline. Triggers on: "gap-to-skill", "create skill from gap", "turn this gap into a skill", "activate gap-to-skill workflow". Requires gap_context to be present in session state. Always requires explicit HITL approval before registration — non-bypassable.'
author: ASE-OS
---

# Gap-to-Skill Pipeline

**Version:** 1.0.0 | **Last updated:** 2026-06-24

Reactive pipeline that converts a logged `capability_gap` (from FEATURE-001) into a registered draft skill, with mandatory HITL approval at every write step. Entry point of the `gap-to-skill` pipeline template. Never creates or registers skills autonomously — all skill creation requires explicit human sign-off.

---

## 1. Skill Header

```yaml
name: gap-to-skill-pipeline
version: 1.0.0
domain: meta
description: >
  Reactive pipeline converting a logged capability gap into a registered draft skill.
  Restores gap_context, pre-populates skill-authoring scaffold (gap_seed mode),
  runs quality scoring, and requires non-bypassable HITL approval before registration.
  Requires gap_context in session state. Never registers skills without human approval.
author: ASE-OS
```

---

## 2. Purpose

`gap-to-skill-pipeline` closes the reactive intelligence loop introduced by Phase 6:

```
capability_gap logged by orchestrator (FEATURE-001)
               │
               ▼
     gap_context in session state
               │
               ▼
  gap-to-skill-pipeline (this skill)   ← entry point
               │
    ┌──────────┼──────────────┐
    ▼          ▼              ▼
context    scaffold       quality
restore    generation     scoring
(Step 1)   skill-authoring (Step 4)
           gap_seed mode
           (Step 3)
               │
               ▼
         ⚠️ HITL Gate (Step 5) — non-bypassable
               │
           APPROVE
               │
               ▼
     registration (Step 6)
               │
               ▼
       retry_context written
     (FEATURE-005 picks up here)
```

This skill coordinates three existing skills (`skill-authoring`, `quality-scoring`) and enforces two recursion guards that prevent infinite gap → skill → gap loops.

---

## 3. Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `session_state` | `object` | Yes | Current session state — must contain `gap_context` |
| `session_id` | `string` | Yes | UUID v4 of the active session |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["session_state", "session_id"],
  "additionalProperties": false,
  "properties": {
    "session_state": {
      "type": "object",
      "description": "Current session state containing gap_context and recursion guard flags."
    },
    "session_id": {
      "type": "string",
      "format": "uuid"
    }
  }
}
```

---

## 4. Required Context

- `session_state.gap_context` must be present, non-null, and not expired (TTL: 3600 s).
- `session_state.gap_to_skill_active` must NOT be `true` — this is the concurrent-execution guard.
- `skill-authoring` (SKL-005) must be available in registry.
- `quality-scoring` (SKL-032) must be available in registry.

---

## 5. Execution Logic

```
─── PRE-CHECKS ───────────────────────────────────────────────────────────────

IF session_state["gap_to_skill_active"] == true:
  → ERROR: "A gap-to-skill pipeline is already active in this session.
            Complete or cancel it first."
  → HALT

IF session_state["gap_context"] is null OR expired:
  → ERROR: "No active capability gap found in session state.
            Make a request the system cannot handle to log one."
  → HALT

SET session_state["gap_to_skill_active"] = true

─── STEP 1 — Restore Context ─────────────────────────────────────────────────

Load from gap_context:  gap_id, raw_prompt, detected_domain, timestamp
Display:
  "Restoring gap context:
   Domain:           <detected_domain>
   Original request: '<raw_prompt>'
   Gap ID:           <gap_id>"

Output: gap_context_restored

─── STEP 2 — Generate Scaffold Seed ──────────────────────────────────────────

Derive scaffold seed from gap_context:
  suggested_name        = slugify(detected_domain) + "-handler"
  suggested_triggers    = top-5 keywords extracted from raw_prompt
  description_template  = "Handles requests in the <detected_domain> domain.
                           Triggered by: <suggested_triggers>"
  source                = "gap-triggered"

Output: scaffold_seed { name, triggers, description, domain, source }

─── STEP 3 — Invoke skill-authoring (gap_seed operation) ─────────────────────

Call skill-authoring with:
  operation  = gap_seed
  intent     = raw_prompt
  domain     = detected_domain
  seed_input = scaffold_seed

skill-authoring runs:
  Step 0: dedup check against pre-populated triggers
  Steps 1–4: seed values pre-filled; user confirms or overrides each field
  Step 9: will construct origin_metadata with source = "gap-triggered",
          approval_tier = "expedited"

Output: draft_skill_md, validation_report, quality_score_raw

─── STEP 4 — Quality Scoring ─────────────────────────────────────────────────

Invoke quality-scoring on the draft SKILL.md output.
  score < 70  → surface feedback; allow up to 2 revision cycles (user edits + re-score)
  score ≥ 70  → proceed to HITL gate

Output: quality_result { score, grade, recommendations }

─── STEP 5 — HITL Approval Gate (NON-BYPASSABLE) ─────────────────────────────

Present:
  "New skill ready for registration:
   Name:           <name>
   Domain:         <detected_domain>
   Triggers:       <triggers>
   Quality Score:  <score>/100
   Approval Tier:  expedited

   [APPROVE]  [REJECT]  [REVISE]"

User MUST choose one explicitly. No default. No timeout auto-approval.

─── STEP 6 — Registration (on APPROVE) ───────────────────────────────────────

skill-authoring Step 9 executes registration with:
  origin_metadata.source              = "gap-triggered"
  origin_metadata.approval_tier       = "expedited"
  origin_metadata.created_by_session  = session_id

Run scripts/validate-skills.sh → must exit 0.
  If non-zero: surface error message, HALT (do not clear gap_to_skill_active until error is resolved)

Clear session_state["gap_context"]
Clear session_state["gap_to_skill_active"]

Write retry_context to session state (TTL: 3600 s) for FEATURE-005:
  { retry_id: <uuid>, gap_id, raw_prompt, registered_skill_id, timestamp }

Output: registered_skill_id, retry_context_written = true

─── STEP 7 — Retry Prompt ────────────────────────────────────────────────────

Display:
  "Skill <registered_skill_id> registered successfully.
   Your original request: '<raw_prompt>'
   FEATURE-005 will prompt you to retry on your next interaction."

─── ON REJECT ────────────────────────────────────────────────────────────────

Clear session_state["gap_to_skill_active"]
Keep session_state["gap_context"] (user may re-attempt the pipeline later)
Display: "Registration cancelled. Gap context preserved for future attempts."

─── ON REVISE ────────────────────────────────────────────────────────────────

Return to Step 3 (skill-authoring) with current draft.
Revision cycles are capped at 3 — after 3 revisions without APPROVE, treat as REJECT.

─── ON ANY ERROR ─────────────────────────────────────────────────────────────

Clear session_state["gap_to_skill_active"]
Log error event to behavioral-telemetry-collector (SKL-047):
  { event_type: "skill.failed", skill_name: "gap-to-skill-pipeline", session_id, outcome: "failure" }
Surface error message to user
```

---

## 6. Outputs

| Field | Type | Description |
|-------|------|-------------|
| `registered_skill_id` | `string\|null` | `SKL-NNN` of the newly registered skill, or null if rejected/cancelled |
| `pipeline_outcome` | `string` | `registered`, `rejected`, `cancelled`, `error` |
| `retry_context_written` | `boolean` | Whether retry_context was written to session state (only true on `registered`) |
| `gap_id` | `string` | The original gap_id from gap_context |
| `metrics` | `object` | Standard execution metrics |
| `feedback` | `array[object]` | Backpropagation entries |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["pipeline_outcome", "gap_id", "metrics", "feedback"],
  "additionalProperties": false,
  "properties": {
    "registered_skill_id": { "type": ["string", "null"] },
    "pipeline_outcome": {
      "type": "string",
      "enum": ["registered", "rejected", "cancelled", "error"]
    },
    "retry_context_written": { "type": "boolean" },
    "gap_id": { "type": "string", "format": "uuid" },
    "metrics": { "$ref": "#/$defs/metrics" },
    "feedback": { "type": "array", "items": { "$ref": "#/$defs/feedback_entry" } }
  },
  "$defs": {
    "metrics": {
      "type": "object",
      "required": ["tokens_in", "tokens_out", "duration_ms", "items_produced", "version"],
      "properties": {
        "tokens_in":      { "type": "integer" },
        "tokens_out":     { "type": "integer" },
        "duration_ms":    { "type": "integer" },
        "items_produced": { "type": "integer" },
        "version":        { "type": "string" }
      }
    },
    "feedback_entry": {
      "type": "object",
      "required": ["type", "from_skill", "reason"],
      "properties": {
        "type":         { "type": "string", "enum": ["backpropagate", "info", "warning"] },
        "from_skill":   { "type": "string" },
        "target_skill": { "type": "string" },
        "reason":       { "type": "string" },
        "evidence":     { "type": "object" }
      }
    }
  }
}
```

---

## 7. Rules & Constraints

- `gap_to_skill_active` guard is the **first and unconditional check** — no gap-to-skill execution begins while another is active.
- **HITL approval gate is non-bypassable.** No skill, pipeline, or configuration flag may override it. `bypassable: false` is hardcoded.
- Revision cycles are **capped at 3** — after 3 revisions without APPROVE, treat as REJECT.
- `scripts/validate-skills.sh` **must exit 0** before `gap_to_skill_active` is cleared — a validation failure leaves the guard up until resolved.
- On any error: `gap_to_skill_active` is always cleared to prevent the session from being permanently locked.
- `gap_context` is preserved on REJECT and REVISE — user may re-invoke the pipeline.
- `gap_context` is cleared on APPROVE only.
- `retry_context` is written on APPROVE only (not on revision cycles).
- This skill does **not** automatically trigger when `gap_context` is present — it must be explicitly invoked by the user or by the orchestrator's user-facing suggestion.

---

## 8. Security Considerations

- `session_state` is read-only except for `gap_to_skill_active`, `gap_context` (clear), and `retry_context` (write).
- All skill registration follows the standard `scripts/validate-skills.sh` gate.
- The HITL gate is non-bypassable — this is a system-level invariant matching the deployment gate rule.
- No autonomous skill creation is possible — this pipeline exists to orchestrate human-guided authoring, not replace it.
- `raw_prompt` in `gap_context` is user content — it is displayed to the user but never stored in telemetry events (only `detected_domain` and `gap_id` are stored in behavioral-telemetry-collector).

---

## 9. Token Optimization

- `gap_context` is compact (5 fields) — loading it costs < 50 tokens.
- scaffold_seed generation uses only `detected_domain` and keyword extraction from `raw_prompt` (no full LLM generation at this step).
- quality-scoring runs on the draft SKILL.md only — not on the full session context.
- `retry_context` is compact (5 fields) — writing it costs < 50 tokens.

---

## 10. Quality Checklist

- [ ] `gap_to_skill_active` checked unconditionally before any execution
- [ ] `gap_context` present and not expired before proceeding
- [ ] skill-authoring invoked with `operation: gap_seed`
- [ ] quality-scoring run before HITL gate
- [ ] HITL gate presented with APPROVE / REJECT / REVISE options — no default
- [ ] `scripts/validate-skills.sh` run after registration — must exit 0
- [ ] `gap_to_skill_active` cleared on all exit paths (approve, reject, cancel, error)
- [ ] `gap_context` cleared only on APPROVE
- [ ] `retry_context` written only on APPROVE
- [ ] Error events logged to behavioral-telemetry-collector on failure
- [ ] Metrics standard fields all present
- [ ] Output is valid JSON matching output schema

---

## 11. Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| `gap_to_skill_active == true` | Return error; HALT — do not overwrite active session |
| `gap_context` absent or expired | Return error with guidance to trigger a new gap |
| DEDUP_HIT in skill-authoring Step 0 | HITL gate for dedup decision before scaffold generation |
| quality_score < 70 after 2 revision cycles | Present to user with final score; allow APPROVE override or REJECT |
| `validate-skills.sh` fails after registration | Surface error; leave `gap_to_skill_active = true`; wait for resolution |
| User chooses REJECT | Clear guard; preserve `gap_context`; surface confirmation message |
| Any unexpected error | Clear `gap_to_skill_active`; log to behavioral-telemetry-collector; surface error |

---

## 12. Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Behavior |
|------|---------|---------|----------|
| Skill registration approval | After quality-scoring (Step 5) | **0 — wait indefinitely** | Non-bypassable; user must choose APPROVE / REJECT / REVISE |
| Dedup override (delegated to skill-authoring Step 0) | DEDUP_HIT detected | 300s | User chooses extend / proceed / cancel |

---

## 13. Skill Composition

`gap-to-skill-pipeline` is the entry skill of the `gap-to-skill` pipeline template. It coordinates:

```yaml
name: gap-to-skill-pipeline
composes:
  - skill: skill-authoring
    version: "^1.1.0"
    input_map:
      operation:  "gap_seed"
      intent:     "gap_context.raw_prompt"
      domain:     "gap_context.detected_domain"
      seed_input: "scaffold_seed"
    output_map:
      draft_skill_md:   "draft_skill_md"
      validation_report: "validation_report"

  - skill: quality-scoring
    version: "^1.0.0"
    input_map:
      skill_md: "draft_skill_md"
    output_map:
      score: "quality_score"
```

### Changelog

| Version | Date | Change |
|---------|------|--------|
| 1.0.0 | 2026-06-24 | Initial version — FEATURE-004: gap context restore, scaffold seed generation, skill-authoring gap_seed invocation, quality scoring, non-bypassable HITL gate, registry registration with origin_metadata, retry_context write |

---
name: work-item-lifecycle-guard
version: 1.0.0
domain: governance
description: 'Use when validating or enforcing work item lifecycle state transitions. Triggers on: "validate work item transition", "work-item-lifecycle-guard", "enforce lifecycle state", "is this transition valid", "work item state change". Runs as a validation_check gate before any work item state write. Initial deployment mode: warning (not block) for the first 2 weeks.'
author: system
---

## Purpose

Enforce the work item lifecycle state machine defined in `docs/work-item-foundation.md §4`. Before any skill writes a state transition to a work item (changing `lifecycle_state` or `status`), the orchestrator invokes this guard to validate that the transition is allowed for the given item type. The guard returns `allow`, `warn`, or `block`. Initial deployment mode is `warning` — invalid transitions emit a warning but do not halt the pipeline. After the 2-week stabilization period, the guard switches to `block` mode.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `item_id` | `string` | Yes | Work item ID (e.g. `BUG-0001`, `TASK-0042`) |
| `item_type` | `string` | Yes | Work item type: `TASK`, `REVIEW`, `TEST`, `VALIDATION`, `DOC`, `BUG`, `FIX`, `INVESTIGATION`, `CLOSURE`, `CR` |
| `from_state` | `string` | Yes | Current `lifecycle_state` of the item |
| `to_state` | `string` | Yes | Proposed new `lifecycle_state` |
| `actor_skill` | `string` | Yes | Name of the skill requesting the transition |
| `guard_mode` | `string` | No | `warning` or `block`. Default: `warning`. Orchestrator may override per deployment config. |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["item_id", "item_type", "from_state", "to_state", "actor_skill"],
  "properties": {
    "item_id":     { "type": "string", "pattern": "^(TASK|REVIEW|TEST|VALIDATION|DOC|BUG|FIX|INVESTIGATION|CLOSURE|CR)-[0-9]{4,}$" },
    "item_type":   { "type": "string", "enum": ["TASK", "REVIEW", "TEST", "VALIDATION", "DOC", "BUG", "FIX", "INVESTIGATION", "CLOSURE", "CR"] },
    "from_state":  { "type": "string" },
    "to_state":    { "type": "string" },
    "actor_skill": { "type": "string" },
    "guard_mode":  { "type": "string", "enum": ["warning", "block"], "default": "warning" }
  }
}
```

## Required Context

- Lifecycle state machine rules from `docs/work-item-foundation.md §4` (embedded below as the transition table).
- No state read required — all validation is rule-based using only the input fields.

## Execution Logic

```
Step 1 — Load transition rules for item_type
  Select the applicable transition table from the embedded rules (Step 2).
  Output: allowed_transitions (set of { from, to } pairs for this type)

Step 2 — Check universal terminal state rules
  Rule T1: If from_state is "closed" or "cancelled" → BLOCK always (terminal states are final).
  Rule T2: If from_state == to_state → WARN (no-op transition; emit info, allow).
  Output: terminal_check_result (block | allow | warn)

Step 3 — Check type-specific transition validity
  Look up (from_state, to_state) pair in the allowed_transitions for item_type.
  If found → ALLOW.
  If not found → apply guard_mode:
    guard_mode=warning → WARN (emit warning, allow transition to proceed)
    guard_mode=block   → BLOCK (halt transition)
  Output: transition_verdict (allow | warn | block), reason

Step 4 — Check actor authorization
  Certain transitions are restricted to specific actor skills:
    BUG: reported → triaged    requires actor_skill = "orchestrator" (HITL gate result)
    BUG: validated → closed    requires actor_skill = "orchestrator" (HITL gate result)
    CR:  impact_analysis → approved requires actor_skill = "orchestrator" (HITL gate result)
    CR:  submitted → rejected  requires actor_skill = "orchestrator" (HITL gate result)
  If actor_skill is incorrect for a restricted transition → WARN (or BLOCK if guard_mode=block).
  Output: actor_check_result

Step 5 — Emit event and assemble output
  If verdict = allow or warn:
    Emit event: work_item.state_changed
      payload: { item_id, item_type, from_state, to_state, actor_skill, verdict }
  If verdict = block:
    Do NOT emit state_changed event (state change did not occur).
    Emit feedback entry:
      type: warning
      from_skill: work-item-lifecycle-guard
      reason: "Invalid transition {from_state} → {to_state} for {item_type} {item_id} by {actor_skill}"
  Return output.
```

### Embedded Transition Tables

**TASK / REVIEW / TEST / VALIDATION / DOC (shared):**

| From | Allowed To |
|------|-----------|
| `draft` | `ready`, `cancelled` |
| `ready` | `in_progress`, `cancelled`, `blocked` |
| `in_progress` | `review`, `blocked`, `cancelled` |
| `blocked` | `in_progress`, `cancelled` |
| `review` | `done`, `in_progress` (revision) |
| `done` | `closed`, `reopened` |
| `reopened` | `in_progress` |
| `closed` | *(terminal — no outgoing transitions)* |
| `cancelled` | *(terminal — no outgoing transitions)* |

**BUG:**

| From | Allowed To |
|------|-----------|
| `reported` | `triaged`, `cancelled` |
| `triaged` | `investigating`, `cancelled` |
| `investigating` | `fixing`, `blocked` |
| `blocked` | `investigating` |
| `fixing` | `testing` |
| `testing` | `reviewing` |
| `reviewing` | `validated`, `fixing` (regression) |
| `validated` | `closed` |
| `closed` | *(terminal)* |
| `cancelled` | *(terminal)* |

**CR:**

| From | Allowed To |
|------|-----------|
| `submitted` | `impact_analysis` |
| `impact_analysis` | `approved`, `rejected` |
| `approved` | `planning` |
| `planning` | `execution` |
| `execution` | `validation`, `blocked` |
| `blocked` | `execution` |
| `validation` | `closed` |
| `rejected` | *(terminal)* |
| `closed` | *(terminal)* |

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `verdict` | `string` | `allow`, `warn`, or `block` |
| `reason` | `string` | Human-readable explanation of the verdict |
| `item_id` | `string` | The work item ID that was evaluated |
| `transition` | `object` | `{ from: from_state, to: to_state }` |
| `metrics` | `object` | Execution metrics |
| `feedback` | `array[object]` | Feedback entries (warnings for invalid transitions, actor violations) |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["verdict", "reason", "item_id", "transition", "metrics", "feedback"],
  "properties": {
    "verdict":    { "type": "string", "enum": ["allow", "warn", "block"] },
    "reason":     { "type": "string" },
    "item_id":    { "type": "string" },
    "transition": {
      "type": "object",
      "properties": {
        "from": { "type": "string" },
        "to":   { "type": "string" }
      },
      "required": ["from", "to"]
    },
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
    "feedback": {
      "type": "array",
      "items": {
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
}
```

## Rules & Constraints

- **Initial deployment mode: `warning`** — invalid transitions emit a warning but are NOT blocked. This allows producers to stabilize without halting the pipeline during the first 2 weeks of use.
- **Block mode:** After stabilization, `guard_mode` should be changed to `block` in the pipeline configuration. This is the long-term target mode.
- Terminal states (`closed`, `cancelled`, `rejected`) are **always blocked** in both modes. No override is permitted.
- The guard evaluates rules **in order**: terminal check (Step 2) → type-specific check (Step 3) → actor check (Step 4). First block verdict wins.
- The guard MUST NOT read or write work item files. It only evaluates rules and returns a verdict.
- The `work_item.state_changed` event is emitted ONLY on `allow` or `warn` verdicts. A `block` verdict means the state change did not occur — no event is emitted.
- The orchestrator is responsible for applying the verdict: on `block`, the orchestrator does not invoke the state write; on `warn` or `allow`, the state write proceeds.
- This guard is invoked **before** every state write to a work item. It is a `validation_check` gate in the orchestrator's pipeline phase definition.

## Security Considerations

- The guard has no external I/O and no state reads — it is a pure rule evaluator. Attack surface is minimal.
- Actor authorization checks (Step 4) prevent non-HITL skills from performing HITL-gated transitions (e.g., a skill cannot close a BUG without a human approval HITL verdict having been recorded by the orchestrator).
- If `actor_skill` is `"unknown"` or missing, treat as unauthorized for all restricted transitions.

## Token Optimization

- No state reads required. All rules are embedded in this skill's execution logic.
- Input and output are both small objects (< 500 bytes typical).
- This guard is designed to be extremely fast (< 100ms) and should never be a pipeline bottleneck.
- Token budget: `quick` tier (8K tokens) is sufficient.

## Quality Checklist

- [ ] All three transition tables present (TASK/BUG/CR)
- [ ] Terminal state check always runs first (Steps 2 before 3)
- [ ] `block` verdict never emits `work_item.state_changed` event
- [ ] `warn` verdict emits `work_item.state_changed` event AND a warning feedback entry
- [ ] `allow` verdict emits `work_item.state_changed` event, no warning
- [ ] Actor authorization checked for HITL-gated transitions
- [ ] Default guard_mode is `warning` (not `block`)

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| Unknown `item_type` | Emit `warn`, return verdict=warn with reason: "Unknown item type — no transition rules available". |
| Unknown `from_state` or `to_state` for a known type | Treat as invalid transition — apply guard_mode. |
| Malformed `item_id` (pattern mismatch) | Return verdict=warn with reason: "item_id does not match TYPE-NNNN pattern". |
| Missing required input fields | Return verdict=block with reason: "Missing required input: {field_name}". |

## 12. Human-in-the-Loop Gates

No HITL gates. work-item-lifecycle-guard is a fully automated rule-evaluation guard. It produces verdicts; humans interact with the outcome through the orchestrator's HITL gates (triage, closure) which are defined in `defect-manager` and `change-request-manager`.

## 13. Skill Composition

```yaml
pipeline_entry:
  - role: validation_check gate
    invoked_by: orchestrator
    before: every work item state write
    all_pipelines: true

event_emissions:
  - event: work_item.state_changed
    on: allow or warn verdict
    payload: { item_id, item_type, from_state, to_state, actor_skill, verdict }

governance_layer: Layer 2 (Guard Skills)
guard_inventory_entry:
  guard: Work Item Lifecycle Guard
  skill: work-item-lifecycle-guard (SKL-058)
  blocks_when: "Invalid lifecycle state transition for any work item type (block mode only)"
  depends_on: docs/work-item-foundation.md (lifecycle state machine)
  initial_mode: warning
```

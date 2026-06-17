---
name: orchestrator
version: 1.0.0
domain: system
description: Use when running the full skill pipeline end-to-end — routing inputs through multiple skills in sequence, validating outputs, managing retries, and enforcing HITL gates. Triggers on: "run the pipeline", "execute the full workflow", "orchestrate", "run all skills", "start the pipeline".
author: system
---

## Purpose

The orchestrator is the execution engine for the Skill System Standard. It receives a pipeline request, resolves the skill dependency graph from the registry, invokes skills in order, validates each output against its schema, propagates feedback loops, and enforces human-in-the-loop gates. It is the only skill that directly calls other skills.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `pipeline_config` | `object` | Yes | Pipeline definition (skills to run, order, gates) |
| `initial_payload` | `object` | Yes | Raw input for the first skill in the pipeline |
| `session_context` | `object` | No | Persisted context from prior orchestration runs |
| `resume_from` | `string` | No | Skill ID to resume from after a HITL gate or failure |

**Pipeline Config Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "skills": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": { "type": "string" },
          "version": { "type": "string" },
          "inputs": { "type": "object" },
          "skip_validation": { "type": "boolean", "default": false },
          "max_retries": { "type": "integer", "minimum": 0, "maximum": 5, "default": 2 }
        },
        "required": ["name"]
      }
    },
    "parallel_groups": {
      "type": "array",
      "items": {
        "type": "array",
        "items": { "type": "string" }
      }
    },
    "gates": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "after_skill": { "type": "string" },
          "type": { "type": "string", "enum": ["human_approval", "validation_check", "condition"] },
          "condition": { "type": "string" },
          "timeout": { "type": "integer", "description": "Seconds to wait for HITL approval" }
        },
        "required": ["after_skill", "type"]
      }
    },
    "mode": { "type": "string", "enum": ["sequential", "parallel", "hybrid"], "default": "sequential" }
  },
  "required": ["skills"]
}
```

## Required Context

- `registry.json` MUST be loaded and resolvable — the orchestrator resolves skill paths from it.
- Valid `session_context` if resuming a prior execution.

## Execution Logic

```
Step 1 — Resolve pipeline from registry
  Look up each skill name in registry.json. Resolve file path, version, input/output schemas.
  Validate that all dependencies (consumes_from) are satisfied.
  Output: resolved skill sequence with dependency graph

Step 2 — Load session context
  If resume_from is provided: load session_context from `.opencode/state/sessions/<session_id>.json`.
  Hydrate state: prior skill outputs, user decisions, gate approvals.
  After hydration, update `last_session.txt` with the current session_id.
  Output: hydrated context

Step 3 — Execute skills (mode-dependent)
  Sequential mode: iterate skills in order, passing output → input.
  Parallel mode: execute independent skill groups concurrently.
  Hybrid mode: execute per parallel_groups definition.
  Per skill:
    a) Compress input (strip non-essential fields per skill's Token Optimization section)
    b) Invoke skill
    c) Validate output against skill's output schema (via schema-validator)
    d) If validation fails AND retries remain → re-invoke with corrected input
    e) If validation fails AND no retries → emit error, pause pipeline
    f) Check HITL gate (if configured for this skill) — pause and wait for approval/rejection
    g) Append output to session_context
  Output: intermediate results per step

Step 4 — Handle feedback loops
  If any skill emits feedback entries with type "backpropagate":
    Identify the target skill from feedback.target_skill
    Re-invoke target skill with updated input
    Re-execute downstream skills that depend on it
    Track iteration count — max 3 feedback loops per pipeline
  Output: updated pipeline state

Step 5 — Check HITL gates
  At each configured gate point:
    Emit approval request: { gate: name, context: summary, artifacts: [...], action_required: "approve"|"reject"|"modify" }
    Wait for response (up to timeout configured in pipeline_config)
    If approved: continue
    If rejected: halt pipeline, return partial results
    If modified: apply modifications, re-validate, continue
  Output: gate decision log

Step 6 — Assemble final result
  Combine all skill outputs, execution log, gate decisions, metrics.
  Persist final session_context to `.opencode/state/sessions/<session_id>.json` with `status: "completed"`.
  Update `.opencode/state/last_session.txt` with the session_id.
  Output: complete pipeline result
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `pipeline_result` | `object` | Final combined output from all skills |
| `execution_log` | `array[object]` | Per-skill execution record (skill, duration, tokens, status, retries) |
| `session_context` | `object` | Serialized context for resumption |
| `metrics` | `object` | Aggregate pipeline metrics |
| `gate_decisions` | `array[object]` | All HITL gate outcomes |

## Human-in-the-Loop Gates

Gates are configured in `pipeline_config.gates`. Each gate defines:

| Field | Type | Description |
|-------|------|-------------|
| `after_skill` | `string` | Pause after this skill completes |
| `type` | `enum` | `human_approval` (manual), `validation_check` (auto), `condition` (auto if condition met) |
| `condition` | `string` | Expression evaluated against output (e.g., `output.risks.length > 0`) |
| `timeout` | `integer` | Max wait seconds for manual gates (default: 3600) |

**Recommended gate points:**
- After `requirement-analyzer` — validate requirements before architecture
- After `architecture-design` — sign off on architecture before planning
- After `feature-planning` — approve roadmap before implementation
- After `security-review` — approve security posture before deployment
- After `deployment-strategy` — final deploy approval

## Token Optimization

- Compress session_context between steps: keep only last 3 skill outputs, discard raw_input after first step.
- Execution log uses abbreviated status codes (`OK`, `VAL_ERR`, `HITL`, `BKP`).
- Gate decision context is summarized to 500 chars max.
- Pipeline result omits intermediate artifacts unless `full_trace: true` is set.

## Quality Checklist

- [ ] All skills in pipeline_config exist in registry
- [ ] Dependency graph is acyclic
- [ ] All required inputs are satisfied before each skill invocation
- [ ] Validation runs after every skill (unless skip_validation=true)
- [ ] HITL gates respect timeout and either pause or auto-continue
- [ ] Feedback loops do not exceed max iteration count
- [ ] Pipeline state is serializable for resumption

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| Skill not found in registry | Return error: `{"error": "UNKNOWN_SKILL", "name": "..."}` |
| Dependency cycle detected | Return error with cycle path, do not execute |
| HITL gate timeout | Auto-continue with `"gate_skipped": true` in gate_decisions |
| Validation failure after max retries | Halt pipeline, return partial results with failed step |
| Feedback loop exceeds max iterations | Force-terminate loop, emit warning, continue with current state |

## 7. Rules & Constraints

- The dependency graph resolved from the registry MUST be acyclic before execution begins.
- All required inputs for each skill MUST be satisfied before that skill is invoked — no partial inputs.
- Validation MUST run after every skill step unless `skip_validation: true` is explicitly set.
- Feedback loops are capped at 3 iterations per pipeline. Exceeding the cap force-terminates the loop.
- Session context retains only the last 3 skill outputs. Older entries compress to ID + status + metrics.
- Max retries per skill: 5. Pipeline halts if a skill fails all retries.
- The orchestrator is the ONLY skill that may directly invoke other skills.
- HITL gate decisions are append-only — they cannot be modified after being recorded.

## 8. Security Considerations

- The orchestrator MUST NOT pass credentials, tokens, or secrets between skills in session context.
- Skill input compression MUST strip PII from raw_input after the first skill step.
- Gate decision logs are audit-critical — they MUST be retained for the session lifetime.
- Subagents receive only the context slice they need — the orchestrator prunes before passing.
- Pipeline configuration (`pipeline_config`) MUST NOT include external URLs or exec commands.

## 13. Skill Composition

The orchestrator is itself a meta-skill that composes all other skills per the pipeline configuration. It cannot be composed into another skill — it is the root of the composition hierarchy.

Pipeline composition is defined dynamically via `pipeline_config.skills` rather than a static `composes` block, enabling runtime flexibility.

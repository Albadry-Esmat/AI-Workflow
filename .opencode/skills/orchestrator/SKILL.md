---
name: orchestrator
version: 1.5.0
domain: system
description: 'Use when running the full skill pipeline end-to-end — routing inputs through multiple skills in sequence, validating outputs, managing retries, and enforcing HITL gates. Triggers on: "run the pipeline", "execute the full workflow", "orchestrate", "run all skills", "start the pipeline".'
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
| `resume_from_phase` | `string` | No | Phase ID to resume from — all prior phases skipped, outputs loaded from checkpoint (TASK-0056) |
| `memoization_enabled` | `boolean` | No | Default `true`. Set `false` to disable invocation cache (TASK-0057) |

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

**Supported Pipeline Templates:**

| Pipeline File | Purpose | Entry Skills |
|---------------|---------|--------------|
| `skills/pipelines/full-pipeline.json` v3.0.0 | Full idea-to-production delivery | requirement-analyzer → … → deployment-strategy |
| `skills/pipelines/requirements-only.json` | Requirements extraction only | requirement-analyzer |
| `skills/pipelines/architecture-only.json` | Architecture design only | requirement-analyzer → architecture-design |
| `skills/pipelines/quick-review.json` | Code/security review | clean-code-review / security-review |
| `skills/pipelines/pre-deploy.json` | Pre-deployment checks | testing-strategy → deployment-strategy |
| `skills/pipelines/defect-lifecycle.json` v1.1.0 | Defect intake → triage → fix → closure | defect-manager |
| `skills/pipelines/change-request.json` v1.1.0 | CR intake → impact → re-plan → delivery | change-request-manager |
| `skills/pipelines/gap-to-skill.json` v1.0.0 | Reactive gap → skill creation → HITL approval → registration | gap-to-skill-pipeline (SKL-065) |

## Execution Logic

```
Step 0 — Normalize prompt via prompt-normalizer (SKL-040)
  Pass initial_payload.raw_input to prompt-normalizer.
  If action = "ask_clarification": emit clarification request and HALT — do not begin pipeline.
  If action = "request_pipeline_selection": present pipeline options to user and HALT.
  If action = "route_immediately": use normalized_prompt and detected pipeline for Step 1.
  Output: normalized_payload, selected_pipeline

Step 0.5 — Retry check (FEATURE-005)
  IF session_state["retry_context"] is present AND not expired:
    Display:
      "A retry is available for your previous request.
       Original request:   '<raw_prompt>'
       Skill registered:   <registered_skill_id>
       Retry now?          [YES]  [NO]  [LATER]"

    ── YES ──────────────────────────────────────────────────────────────────
    SET session_state["retry_in_progress"] = true
    Re-route raw_prompt through Step 1 routing table.
    IF match found (confidence ≥ 0.5):
      Execute matched skill pipeline normally.
      Clear session_state["retry_context"]
      Clear session_state["retry_in_progress"]
    ELSE (no match):
      Display:
        "The new skill (<registered_skill_id>) did not match this request.
         Consider refining its trigger patterns via skill-authoring (refactor mode)."
      DO NOT emit a capability_gap event — retry_in_progress guard blocks gap emission.
      Clear session_state["retry_context"]
      Clear session_state["retry_in_progress"]

    ── NO ───────────────────────────────────────────────────────────────────
    Clear session_state["retry_context"]
    Continue processing current user request normally.

    ── LATER ────────────────────────────────────────────────────────────────
    Do NOT modify retry_context (TTL continues unchanged).
    Continue processing current user request normally.

  Output: retry_handled (bool)

Step 1 — Resolve pipeline from registry
  Look up each skill name in registry.json. Resolve file path, version, input/output schemas.
  Validate that all dependencies (consumes_from) are satisfied.

  ─── ROUTING DEAD-END / GAP DETECTION (FEATURE-001) ────────────────────────
  IF no skill matches above confidence threshold (< 0.5) AND normalized_payload.action != "request_pipeline_selection":

    ── Recursion guards ──────────────────────────────────────────────────────
    IF session_state["gap_to_skill_active"] == true:
      Surface: "Cannot log a gap from within the gap-to-skill pipeline."
      HALT — do not emit gap event.
    IF session_state["retry_in_progress"] == true:
      Surface: "No skill matched the retried request."
      HALT — do not emit gap event (retry guard).

    ── Classify and emit gap ─────────────────────────────────────────────────
    1. Classify failure as `capability_gap` (not generic routing error)
    2. Extract intent domain from raw prompt (one of: testing, security, deployment,
       architecture, data, frontend, mobile, embedded, skill-management, unknown)
    3. Generate gap_id (UUID v4)
    4. Emit `capability_gap` event to behavioral-telemetry-collector (SKL-047):
         { event_type: "capability_gap", session_id, skill_name: "orchestrator",
           detected_domain, gap_id, timestamp: <now> }
    5. Write gap_context to session state (TTL: 3600 s):
         { gap_id, raw_prompt: <original>, detected_domain, timestamp }
    6. Surface to user:
         "No skill is available for this request. The capability gap has been logged
          (domain: `<detected_domain>`). You can create a new skill to handle it using
          the gap-to-skill workflow."
    HALT — do not proceed to pipeline execution.
  ─────────────────────────────────────────────────────────────────────────────

  Output: resolved skill sequence with dependency graph

Step 2 — Load session context
  If resume_from is provided: load session_context from `.opencode/state/sessions/<session_id>.json`.
  Hydrate state: prior skill outputs, user decisions, gate approvals.
  After hydration, update `last_session.txt` with the current session_id.

  [TASK-0056] If resume_from_phase is provided:
    Validate that (session_id, phase_checkpoint_id) match a persisted checkpoint.
    Load session_context from the checkpoint; skip all phases prior to resume_from_phase.
    Prior-phase outputs are pre-populated from checkpoint state — the orchestrator MUST NOT
    re-invoke any skill whose phase_id precedes resume_from_phase.
    Log resume event: { event_type: "pipeline.resumed", from_phase: resume_from_phase, session_id }.
    If checkpoint not found → reject with {"error": "CHECKPOINT_NOT_FOUND"}.

  [TASK-0058] Initialize async_task_registry in session_context if not present:
    session_context.async_task_registry = []
    This registry tracks all async skill invocations dispatched in this session.

  Output: hydrated context

Step 3 — Execute skills (mode-dependent)
  Sequential mode: iterate skills in order, passing output → input.
  Parallel mode: execute independent skill groups concurrently.
  Hybrid mode: execute per parallel_groups definition.
  Per skill:
    a) Compress input (strip non-essential fields per skill's Token Optimization section)
    b) [TASK-0051] Project output of prior skill before passing as input (output-field pruning):
         i)  Load target skill's input schema (required + optional fields only).
         ii) Project prior skill's output to include ONLY fields present in target schema.
         iii) Always include: id fields, status fields, error fields (for error propagation).
         iv) Always exclude from handoff: metrics{}, feedback[] (route to telemetry instead).
         v)  Record projected token_count in session_context event_log for observability.
         Expected reduction: 40–60% per inter-skill handoff vs. full output passthrough.
    b2) [TASK-0055] Lazy SKILL.md section loading:
         Load ONLY mandatory core sections for each skill invocation by default:
           Purpose, Inputs, Input Schema, Required Context, Execution Logic,
           Outputs, Output Schema, Rules & Constraints.
         Conditionally load additional sections:
           Security Considerations → if skill has security_sensitive: true in registry
           Failure Scenarios       → if retry_count > 0 for this invocation
           HITL Gates              → only when evaluating HITL conditions for this skill
           Quality Checklist       → only during post-execution validation pass
           Token Optimization      → only on first invocation of a skill in a session
           Skill Composition       → never loaded at runtime (design-time only)
         On first invocation of any skill in a session: load all sections once (full load)
         to populate session_context.skill_sections_cache. Subsequent invocations use cache.
    c) [TASK-0057] Check invocation memoization cache before invoking:
         Compute input_hash = SHA-256(canonical JSON of projected input payload).
         Look up invocation_cache["{skill_name}:{input_hash}"].
         If CACHE_HIT:
           Return cached output. Increment cache_entry.hit_count. Log CACHE_HIT event.
           Skip steps c1–c4.
         If CACHE_MISS: proceed with invocation.
         Cache invalidation: if any session_context field declared in the skill's
           Required Context section has changed since the cache entry was written,
           invalidate that entry before lookup.
         Cache capacity: 50 entries. LRU eviction on overflow.
    c1) Invoke skill
    c2) Store result in invocation_cache["{skill_name}:{input_hash}"] with invoked_at timestamp.
    d) Validate output against skill's output schema (via schema-validator)
    e) If validation fails AND retries remain → re-invoke with corrected input
    f) If validation fails AND no retries → emit error, pause pipeline
    g) Check HITL gate (if configured for this skill) — pause and wait for approval/rejection
    h) Append output to session_context
    i) [TASK-0053] Compress completed skill state after downstream consumption:
         If skill N output has been consumed by skill N+1 (input mapped, step b complete)
         AND the completed skill count exceeds 3 (i.e., there are more than 3 prior outputs):
           Invoke context-compressor(
             content         = serialized session_context[skill_N].output,
             content_type    = "skill_output",
             max_tokens      = 500,
             compression_goal = "lossless_index",
             cascade_mode    = "single_pass",
             auto_compress   = true
           )
           Replace session_context[skill_N].output with compressed_content.
           Record session_context[skill_N].compressed = true, compression_ratio.
         This enforces the "keep last 3 skill outputs at full size" retention policy
         from context-engineering.md and prevents state bloat in late pipeline phases.
    j) [TASK-0058] If skill has async: true:
         Register in async_task_registry:
           { task_id: UUID, skill: skill_name, started_at: <now>,
             status: "running", result_ref: null, error: null }
         Do NOT wait for completion. Pipeline advances immediately.
  Parallel write-back rule (D3): When parallel_groups run concurrently, session_context
    writes from each group MUST be serialized (one at a time, mutex-locked). Concurrent
    skill execution is allowed; concurrent writes to session_context are not.
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

Step 6 — ADR sync
  After any skill that emits an ADR artifact: write to scope "adr_index" (canonical source).
  Do NOT write to decision_log.adrs — that scope is deprecated.
  Output: updated adr_index

Step 7 — Assemble final result + session summary
  Combine all skill outputs, execution log, gate decisions, metrics.
  Persist final session_context to `.opencode/state/sessions/<session_id>.json` with `status: "completed"`.
  Update `.opencode/state/last_session.txt` with the session_id.
  Generate session summary node for graphify:
    Run: graphify update . (AST-only, no API cost) to keep the knowledge graph current.
    Append session summary entry to `.opencode/state/session_summaries.jsonl`:
      { session_id, pipeline_template, skills_run, outcome, timestamp, key_decisions[] }

  [TASK-0058] Reconcile async_task_registry:
    For each entry in async_task_registry with status="running":
      Attempt to retrieve result from skill invocation handle.
      If completed: update status="completed", result_ref, completed_at.
      If failed:    update status="failed", error. Surface in pipeline_result.failed_async_tasks[].
      If still running: leave status="running"; surface in pipeline_result.pending_async_tasks[].
    All async task outcomes are non-blocking — the pipeline result is returned regardless.

  [TASK-0056] Write phase checkpoints for resume_from_phase:
    After each HITL gate is approved, write a checkpoint to session state:
      { checkpoint_id: UUID, phase_id: <current_phase>, session_id,
        approved_at: <now>, state_keys: [list of populated state keys] }
    Checkpoints enable resume_from_phase in subsequent orchestrator invocations.

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
- After `implementation-completeness-guard` — block advancement if readiness score below threshold
- After `deployment-strategy` — **mandatory non-bypassable release gate** (see Release Gate Policy below)

### Release Gate Policy

The deployment gate is a system-level invariant. It differs from all other gates:

| Property | Standard Gates | Deployment Gate |
|----------|---------------|-----------------|
| `type` | `human_approval` | `human_approval` |
| `timeout` | 3600s (default) | **0 (wait indefinitely)** |
| `bypass_on_timeout` | `true` | **`false` — never bypass** |
| Auto-continue | Allowed | **Prohibited** |
| Skip allowed | Yes (configurable) | **No — hardcoded** |

The orchestrator MUST enforce the following check before executing any deployment action:

```
if pipeline_config.gates does not include a gate with:
    after_skill = "deployment-strategy"
    type = "human_approval"
    bypass_on_timeout = false
→ REJECT pipeline execution with error: {"error": "MISSING_DEPLOYMENT_GATE"}
```

The orchestrator MUST present the `deployment_approval_request` artifact from the deployment-strategy output as the gate approval content.

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
- **The deployment gate MUST NOT be bypassed.** Any pipeline_config without a non-bypassable deployment gate on `deployment-strategy` is rejected before execution starts.
- **Guard skill verdicts with `verdict: "block"` MUST halt the pipeline gate immediately.** The orchestrator MUST NOT advance past a guard that returned `block`.
- **Parallel write-back serialization (D3):** When `mode: "parallel"` or `parallel_groups` are used, concurrent skill execution is permitted, but writes to `session_context` MUST be serialized. Implement a write queue: each group's output is appended to `session_context` only after the previous group's write completes. Race conditions in session_context are a pipeline-integrity error.
- **ADR canonical source:** All ADR writes go to `scope: "adr_index"` via state-manager. Do NOT write to `decision_log.adrs` (deprecated). The `adr_index` scope is the single source of truth for all architecture decisions.
- **Prompt normalization gate:** Step 0 (prompt-normalizer SKL-040) MUST complete before any pipeline resolution begins. A `halt` or `ask_clarification` result from SKL-040 terminates the orchestrator immediately with a clarification request to the user.
- **Gap detection recursion guard (FEATURE-001):** The orchestrator MUST check `session_state["gap_to_skill_active"]` before emitting any `capability_gap` event. If `gap_to_skill_active == true`, gap emission is suppressed and an error is surfaced.
- **Retry recursion guard (FEATURE-005):** The orchestrator MUST check `session_state["retry_in_progress"]` before emitting any `capability_gap` event. If `retry_in_progress == true`, gap emission is suppressed. This breaks the retry → no-match → new-gap → new-retry infinite loop.

## 8. Security Considerations

- The orchestrator MUST NOT pass credentials, tokens, or secrets between skills in session context.
- Skill input compression MUST strip PII from raw_input after the first skill step.
- Gate decision logs are audit-critical — they MUST be retained for the session lifetime.
- Subagents receive only the context slice they need — the orchestrator prunes before passing.
- Pipeline configuration (`pipeline_config`) MUST NOT include external URLs or exec commands.

## 13. Skill Composition

The orchestrator is itself a meta-skill that composes all other skills per the pipeline configuration. It cannot be composed into another skill — it is the root of the composition hierarchy.

Pipeline composition is defined dynamically via `pipeline_config.skills` rather than a static `composes` block, enabling runtime flexibility.

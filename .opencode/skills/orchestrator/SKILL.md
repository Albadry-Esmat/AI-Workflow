---
name: orchestrator
version: 2.5.0
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
| `restore_from_snapshot` | `string` | No | Snapshot ID (e.g. `snap-phase-4-planning-approved`). Restores all state keys and artifacts from that snapshot, then continues from the phase immediately after the snapshot's `phase_id`. Enables cross-session resume without a live session_context (TASK-0062). |
| `warm_start` | `object` | No | Warm-start configuration. Restores a named snapshot and applies the specified intent (TASK-0065). Takes precedence over `restore_from_snapshot` when both are provided. |
| `warm_start.snapshot_id` | `string` | Yes (if warm_start) | Snapshot ID to restore from. |
| `warm_start.intent` | `string` | Yes (if warm_start) | One of: `re_run_from_snapshot`, `modify_and_continue`, `branch`. |
| `warm_start.artifact_diff` | `object` | No | Only for `modify_and_continue` — diff to apply to the snapshot artifact before re-running. |
| `query_async_jobs` | `object` | No | When present, returns current job_registry status instead of running a pipeline (TASK-0064). |
| `query_async_jobs.session_id` | `string` | No | Session to query. Defaults to last active session. |
| `query_async_jobs.status_filter` | `string` | No | One of: `all`, `running`, `completed`, `failed`, `retrying`. Default: `all`. |
| `cache_control_strategy` | `string` | No | `"auto"` \| `"explicit"` \| `"disabled"`. Default `"auto"`. Controls Anthropic prompt-cache breakpoint placement per skill invocation (TASK-0067). |
| `budget_forcing_enabled` | `boolean` | No | Default `true`. When `true`, an explicit output-length instruction is prepended to each skill invocation (TASK-0068). Set `false` to disable. |
| `project_context` | `object` | No | Injected automatically from `CONSTITUTION.md` (FEATURE-006). If provided explicitly, overrides the file-based read. |
| `converge` | `boolean` | No | Default `false`. When `true`, enables Converge Mode (FEATURE-008): the pipeline re-runs up to `converge_config.max_iterations` times until output stability ≥ threshold. |
| `converge_config` | `object` | No | Converge Mode configuration. Default: `{ "max_iterations": 3, "threshold": 0.95 }`. Only used when `converge: true`. |
| `converge_config.max_iterations` | `integer` | No | Maximum re-run iterations before stopping regardless of stability score. Default: `3`. Max: `5`. |
| `converge_config.threshold` | `float` | No | Stability score (0.0–1.0) required to stop iterating. Default: `0.95`. Min: `0.5`. |

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
| `skills/pipelines/full-pipeline.json` v3.4.0 | Full idea-to-production delivery | requirement-analyzer → clarify → … → deployment-strategy |
| `skills/pipelines/requirements-only.json` | Requirements extraction only | requirement-analyzer |
| `skills/pipelines/architecture-only.json` | Architecture design only | requirement-analyzer → architecture-design |
| `skills/pipelines/quick-review.json` | Code/security review | clean-code-review / security-review |
| `skills/pipelines/pre-deploy.json` | Pre-deployment checks | testing-strategy → deployment-strategy |
| `skills/pipelines/defect-lifecycle.json` v1.1.0 | Defect intake → triage → fix → closure | defect-manager |
| `skills/pipelines/change-request.json` v1.1.0 | CR intake → impact → re-plan → delivery | change-request-manager |
| `skills/pipelines/gap-to-skill.json` v1.0.0 | Reactive gap → skill creation → HITL approval → registration | gap-to-skill-pipeline (SKL-065) |

## Execution Logic

```
Step -1 — Load Project Constitution (FEATURE-006)
  If CONSTITUTION.md exists at project root:
    Parse into project_context object (see docs/constitution.md for schema).
    Store project_context in session_context.project_context.
    Emit INFO: constitution_loaded { token_count: <N> }.
  If CONSTITUTION.md absent:
    Set project_context = null.
    Emit WARN: constitution_absent — pipeline continues without persistent context.
  Output: project_context (injected into every downstream skill via Step 3b)

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

  [TASK-0062] If restore_from_snapshot is provided:
    Look up snapshot by snapshot_id in `.opencode/state/sessions/<session_id>.json`
    (the session_id is resolved from `last_session.txt` when not explicitly provided).
    If found: restore all state_keys and artifact payloads from the snapshot into
    session_context. Set resume_from_phase = phase immediately after snapshot.phase_id.
    If not found: reject with {"error": "SNAPSHOT_NOT_FOUND", "snapshot_id": "..."}.
    Takes precedence over resume_from_phase if both are provided.

  [TASK-0065] If warm_start is provided (takes precedence over restore_from_snapshot):
    Resolve snapshot from warm_start.snapshot_id (same lookup as TASK-0062 above).
    If not found: reject with {"error": "SNAPSHOT_NOT_FOUND"}.
    Validate content_hash of snapshot artifacts against current session inputs.
    IF hash mismatch (snapshot from diverged codebase):
      Emit warning: "Snapshot <snapshot_id> content_hash mismatch — codebase may have
      diverged since this snapshot was taken. Use force_warm_start: true to override."
      HALT unless warm_start.force_warm_start === true.

    warm_start.intent = "re_run_from_snapshot":
      Restore snapshot state. Set resume_from_phase to phase after snapshot.phase_id.
      Re-run all phases from that point (no artifact diff applied).

    warm_start.intent = "modify_and_continue":
      Restore snapshot state. Apply warm_start.artifact_diff to the restored snapshot
      artifact (deep merge, diff wins on key conflicts).
      Set resume_from_phase to phase after snapshot.phase_id.
      Re-run all downstream phases with the modified artifact as input.

    warm_start.intent = "branch":
      Restore snapshot state into a NEW session (generate new session_id).
      Do NOT modify the original session.
      Run new pipeline variant from snapshot.phase_id onward in the new session.
      Return: { branched_session_id: <new_session_id>, warm_start_snapshot: snapshot_id }

    Surface available warm-start points at each HITL gate pause:
      "Available warm-start points:"
      For each snapshot in session_context.snapshots[]:
        "  <snapshot_id>  (after: <snapshot.phase_id>)  <← last approved marker if applicable>"

  [TASK-0064] If query_async_jobs is provided:
    Load job_registry from session state for query_async_jobs.session_id (or last session).
    Apply status_filter. Return filtered job list. Do NOT run any pipeline step.
    Return: { job_registry: filtered_jobs[], queried_at: <now>, session_id: resolved_session_id }

  Output: hydrated context

Step 3 — Execute skills (mode-dependent)
  Sequential mode: iterate skills in order, passing output → input.
  Parallel mode: execute independent skill groups concurrently.
  Hybrid mode: execute per parallel_groups definition.
  Per skill:
    a) Compress input (strip non-essential fields per skill's Token Optimization section)
       [FEATURE-006] Inject project_context: if session_context.project_context is not null,
         prepend project_context as a read-only field to the skill input before compression.
         Skills MUST NOT modify project_context — it is injected fresh on every invocation.
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
     b3) [TASK-0060] Wrap pruned output in Artifact envelope before dispatch:
           After output-field pruning (step b), wrap the payload in a typed Artifact envelope:
             {
               "artifact_id":    "art-<sequence>",
               "source_skill":   "<producing_skill_name>",
               "target_skill":   "<consuming_skill_name>",
               "content_type":   "<skill_output_type>",   // e.g. "architecture_output"
               "payload":        { ...pruned_output... },
               "created_at":     "<ISO8601>",
               "token_count":    <measured_token_count>,  // measured, not estimated
               "compressed":     false,
               "schema_version": "1.0.0"
             }
           Measure token_count of the payload immediately before wrapping (actual count).
           Record artifact dispatch in session_context event_log:
             { id: "evt-N", type: "artifact.dispatched", artifact_id, source_skill,
               target_skill, token_count, timestamp }
           The receiving skill's step c1 unpacks the payload from the Artifact envelope
           before invocation — skills operate on the raw payload, not the envelope.
           Expected benefit: exact per-transfer token accounting; enables TASK-0066 observability.
     b4) [TASK-0067] Apply Anthropic prompt-cache breakpoints before each skill invocation:
           IF cache_control_strategy != "disabled":
             Identify the static prefix = all SKILL.md sections loaded in Step b2.
             IF static_prefix token_count >= 1024 (Claude Sonnet minimum cacheable length):
               Mark the end of the static prefix with:
                 cache_control: {type: "ephemeral", ttl: "1h"}
               (1-hour TTL — SKILL.md content is session-stable and cross-session reusable;
                2× write cost but read hits cost 10% of base; break-even at ~2 reads/write)
             If a prior-turn complete assistant message exists in the conversation:
               Mark it with cache_control: {type: "ephemeral"}
               (5-minute TTL — conversation-level reuse within a single session)
             After invocation, record API response cache fields in prompt_cache_log:
               { skill_name, cache_creation_input_tokens, cache_read_input_tokens, input_tokens }
             Emit fire-and-forget api.cache_hit event to behavioral-telemetry-collector
               when cache_read_input_tokens > 0.
           Rules:
             NEVER place cache_control on blocks that change per-invocation:
               current task description, dynamic artifact payloads, user message.
             Static prefix = everything before the dynamic task description block.
             Do NOT cache the artifact payload itself.
           Expected savings: 90% cost reduction on reused SKILL.md prefixes per invocation.
     b5) [TASK-0068] Inject token budget instruction before each skill invocation:
           IF budget_forcing_enabled == true
              AND skill.name NOT IN budget_forcing_exempt_skills:
             Compute budget = skill.max_output_tokens (from index.yaml, default 4000 if absent).
             On retry (retry_count > 0): tighten budget by 20% per retry iteration.
             Prepend BEFORE the dynamic task description (not mixed into it):
               "[TOKEN BUDGET: Keep your entire response under {budget} tokens.
                 Be concise and direct. Omit preamble, repetition, and meta-commentary.]"
             Record budget_instruction_applied: true in execution_log for this invocation.
           budget_forcing_exempt_skills (output length is inherent to the artifact):
             code-generator, design-system-generator, test-generator,
             mutation-test-generator, documentation-generator, adr-generator
     b6) [TASK-0069] Externalize large artifact payloads after Artifact envelope wrapping:
           After Step b3 (Artifact envelope), check artifact.token_count:
           IF artifact.token_count > token_policy.externalize_threshold (default: 8000)
              AND artifact.content_type IN ["code", "documentation", "design_system",
                                            "test_suite", "dependency_graph"]:
             1. Write full payload to `.opencode/state/artifacts/<artifact_id>.json`.
             2. Replace artifact.payload in-context with ExternalizedPayloadStub:
                  {
                    "artifact_ref":     "state/artifacts/<artifact_id>.json",
                    "artifact_id":      "<artifact_id>",
                    "summary":          first_500_chars(serialized_payload),
                    "full_token_count": <original_token_count>,
                    "externalized":     true,
                    "content_type":     "<content_type>"
                  }
             3. Update artifact.token_count to stub token count (~100–150 tokens).
             4. Emit fire-and-forget artifact.externalized telemetry event:
                  { artifact_id, original_tokens, stub_tokens, saving_pct }
             5. Add artifact_id to session_context.externalized_artifacts[].
           Step b7 — Downstream skill fetch:
             IF consuming skill's input schema declares field type "full_artifact"
                AND incoming artifact is externalized:
               Load full payload from artifact_ref before invoking.
               Record fetch_token_cost in execution_log.
           Never externalize (must remain in-context for reasoning quality):
             requirements, architecture_proposal, final_architecture, feature_plan,
             security_findings, completeness_report
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
     c3) [TASK-0066] Emit token consumption telemetry event (fire-and-forget, non-blocking):
          Dispatch to behavioral-telemetry-collector:
            { event_type: "skill.tokens_consumed",
              skill_name:  skill_name,
              session_id:  session_id,
              pipeline_phase: current_phase_id,
              tokens_in:   sum(input_artifact.token_count for all input artifacts),
              tokens_out:  output_artifact.token_count,
              tokens_total: tokens_in + tokens_out,
              model:       resolved_model_for_skill,
              cache_hit:   false,
              artifact_ids: [output_artifact.artifact_id] }
          For CACHE_HIT (step c): emit same event with cache_hit=true, tokens_out=0.
          Overhead < 50ms per event; do NOT block pipeline progression.
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
     j) [TASK-0058 + TASK-0064] If skill has async: true:
          [TASK-0058] Register in async_task_registry:
            { task_id: UUID, skill: skill_name, started_at: <now>,
              status: "running", result_ref: null, error: null }
          [TASK-0064] Additionally write a durable job entry to job_registry:
            {
              job_id:           "job-<skill_name>-<sequence>",
              skill:            skill_name,
              session_id:       session_id,
              dispatched_at:    <now>,
              status:           "pending",
              retry_count:      0,
              max_retries:      3,
              retry_policy:     { backoff: "exponential", initial_delay_ms: 5000 },
              last_error:       null,
              completed_at:     null,
              result_ref:       null,
              completion_event: "<skill_name>.completed"
            }
          Persist job_registry to `.opencode/state/sessions/<session_id>.json`
          (survives session restart — enables durable async execution).
          Update job status: "pending" → "running" after dispatch confirmation.
          Do NOT wait for completion. Pipeline advances immediately.

          On skill completion callback:
            Update job_registry entry: status="completed", result_ref, completed_at.
            Emit completion_event to event_log.
            If a downstream skill was waiting on this job: dispatch it with result_ref payload.
          On skill failure:
            IF retry_count < max_retries:
              Update status="retrying", increment retry_count.
              Schedule retry with exponential backoff (initial_delay_ms * 2^retry_count).
            ELSE (retry_count >= max_retries):
              Update status="failed", last_error.
              Emit failure event to event_log.
     k) [TASK-0070] Route eligible skills through Batch API:
          IF pipeline_config.batch_policy.enabled == true (default: false):
            Before invoking a skill, check if skill.name IN batch_policy.eligible_skills.
            Default eligible set: documentation-generator, doc-maintainer, adr-generator,
              work-item-exporter, behavioral-telemetry-collector.
            IF skill is batch-eligible AND batch_policy.mode == "async":
              Submit invocation to Anthropic Batch API:
                POST /v1/messages/batches with custom_id = "job-<skill_name>-<sequence>"
              Record in batch_registry:
                { batch_id, skill_name, custom_id, submitted_at, status: "in_flight",
                  expected_completion: now + 24h, result_ref: null }
              Add batch_id to session_context.active_batches[].
              Do NOT wait for batch completion — continue pipeline with stub output.
              Emit fire-and-forget batch.submitted event to behavioral-telemetry-collector:
                { skill_name, batch_id, custom_id, estimated_saving_pct: 50 }
            IF skill is batch-eligible AND batch_policy.mode == "sync_override":
              Skip batching — invoke synchronously (used for time-sensitive gate dependencies).
          Cost benefit: 50% cost reduction vs. real-time API per eligible skill invocation.
          Latency tradeoff: up to 24h for batch completion — ONLY use for non-blocking skills
            that do not gate downstream pipeline progression.

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
        [TASK-0062] Take named snapshot immediately after approval:
          Write snapshot to session_context.snapshots[]:
            {
              "snapshot_id":   "snap-<phase_id>-<gate_decision>",
              "session_id":    "<session_id>",
              "phase_id":      "<current_phase>",
              "gate_decision": "approve",
              "taken_at":      "<ISO8601>",
              "state_keys":    [<list of all populated session_context keys at this point>],
              "artifact_ids":  [<artifact_id of every Artifact dispatched up to this gate>]
            }
          Full artifact payloads are stored with the snapshot (not references only).
          Max 10 snapshots per project; LRU eviction on the 11th with a warning emitted.
          This durable snapshot enables restore_from_snapshot across session boundaries
          (TASK-0065 warm-start in Phase 7 builds on this).
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

  [TASK-0064] Reconcile durable job_registry:
    For each job in job_registry with status != "completed":
      Attempt to fetch result from persisted result_ref or callback.
      If completed: update status="completed", completed_at.
      If retrying:  check if retry delay has elapsed; if so, re-dispatch skill.
      If failed:    surface in pipeline_result.failed_jobs[] with job_id, skill, last_error.
    Persist final job_registry state to session file.
    Surface all failed_jobs[] in pipeline result with error details — the pipeline result
    is returned regardless of durable job status.

  [TASK-0056] Write phase checkpoints for resume_from_phase:
    After each HITL gate is approved, write a checkpoint to session state:
      { checkpoint_id: UUID, phase_id: <current_phase>, session_id,
        approved_at: <now>, state_keys: [list of populated state keys] }
    Checkpoints enable resume_from_phase in subsequent orchestrator invocations.

  [TASK-0070] Reconcile batch_registry:
    For each entry in batch_registry with status == "in_flight":
      Query Anthropic Batch API: GET /v1/messages/batches/<batch_id>
      IF processing_status == "ended":
        Retrieve results: GET /v1/messages/batches/<batch_id>/results
        For each result matching custom_id:
          IF result.result.type == "succeeded":
            Update batch_registry entry: status="completed", result_ref, completed_at.
            Move batch_id from active_batches[] to completed_batches[] in session_context.
          IF result.result.type == "errored":
            Update batch_registry entry: status="failed", error.
            Surface in pipeline_result.failed_batches[].
      IF processing_status != "ended":
        Leave status="in_flight", surface in pipeline_result.pending_batches[].
    Surface prompt_cache_stats aggregated from all prompt_cache_log entries:
      { total_cache_hits, total_cache_misses, cache_creation_tokens,
        cache_read_tokens, estimated_savings_pct }
    Surface externalized_artifacts[] from session_context.externalized_artifacts.
    Persist final batch_registry state to session file.
    All batch reconciliation is non-blocking — pipeline result is returned regardless
    of in_flight batch status.

  [FEATURE-007] Write Spec Artifact on Disk:
    Generate ISO timestamp: spec_ts = new Date().toISOString().replace(/[:.]/g, '-')
    Assemble spec artifact from pipeline_result:
      {
        "run_id":        session_id,
        "timestamp":     <ISO8601>,
        "pipeline":      pipeline_config.name,
        "requirements":  phase_outputs["phase-1-requirements"].requirements,
        "architecture":  phase_outputs["phase-2-architecture"],
        "tasks":         phase_outputs["phase-4-planning"].tasks,
        "test_plan":     phase_outputs["phase-7-quality"].test_plan,
        "constitution":  session_context.project_context
      }
    Write to: artifacts/spec-<spec_ts>.md (Markdown-formatted)
    Update symlink: artifacts/spec-latest.md → artifacts/spec-<spec_ts>.md
    If pipeline did not reach phase-1-requirements: write artifacts/spec-<spec_ts>-partial.md instead.
    If artifacts/ directory does not exist: create it silently.
    Emit INFO: spec_artifact_written { path: "artifacts/spec-<spec_ts>.md", size_bytes: <N> }.

  [FEATURE-008] Converge Mode loop:
    IF converge = true:
      converge_config = { max_iterations: 3, threshold: 0.95, ...overrides from input }
      Initialize session_context.converge_state if not present:
        { iteration: 1, history: [], stable: false }
      
      Compute stability_score vs. previous iteration (skip for iteration 1 — no prior):
        req_match    = intersection(current_req_ids, prior_req_ids).length / max(current, prior).length
        module_match = intersection(current_module_names, prior_module_names).length / max(current, prior).length
        task_match   = intersection(current_task_ids, prior_task_ids).length / max(current, prior).length
        stability_score = (req_match × 0.4) + (module_match × 0.4) + (task_match × 0.2)
      
      Record iteration in history:
        { iteration_n, req_count, module_count, task_count, stability_score, timestamp }
      
      IF iteration == 1 OR stability_score < converge_config.threshold:
        IF iteration >= converge_config.max_iterations:
          Set stable = false.
          Emit WARN: converge_max_iterations_reached { iterations: N, final_score: stability_score }.
          Proceed to artifact write.
        ELSE:
          Increment iteration.
          Store current pipeline_result as prior_context.
          Re-run pipeline from Step -1 with:
            initial_payload.converge_prior_context = current pipeline_result summary
          (requirement-analyzer Step 0a injects converge_prior_context as additional analysis context)
          Return — the new iteration replaces the current result.
      ELSE (stability_score >= threshold):
        Set stable = true.
        Emit INFO: converge_stable { score: stability_score, iterations: N }.
      
      Write artifacts/converge-report-<spec_ts>.md:
        # Converge Report — <run_id>
        **Pipeline:** <pipeline_name>
        **Status:** stable | max_iterations_reached
        **Iterations run:** <N> / <max_iterations>
        **Final stability score:** <score> (threshold: <threshold>)

        | Iteration | Req Count | Module Count | Task Count | Stability Score |
        |-----------|-----------|-------------|------------|-----------------|
        | 1         | <N>       | <N>          | <N>        | — (baseline)   |
        | 2         | <N>       | <N>          | <N>        | <score>         |
        …
      
      Emit INFO: converge_report_written { path, iterations, stable }.

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
| `snapshots` | `array[object]` | Named snapshots taken at each approved HITL gate (TASK-0062) |
| `artifact_log` | `array[object]` | Every inter-skill artifact dispatch: `artifact_id`, `source_skill`, `target_skill`, `token_count` (TASK-0060) |
| `job_registry` | `array[object]` | Current durable job entries with status, retry_count, error (TASK-0064). Present in every pipeline result. |
| `warm_start_result` | `object` \| `null` | Populated when `warm_start` input was provided. Contains `intent`, `snapshot_id`, `branched_session_id` (for `branch` intent), `phases_skipped[]` (TASK-0065). |
| `prompt_cache_stats` | `object` | Aggregated prompt-cache metrics across all skill invocations: `total_cache_hits`, `total_cache_misses`, `cache_creation_tokens`, `cache_read_tokens`, `estimated_savings_pct` (TASK-0067). |
| `externalized_artifacts` | `array[string]` | Artifact IDs written to disk at `.opencode/state/artifacts/<id>.json` because their token_count exceeded `externalize_threshold` (TASK-0069). |
| `active_batches` | `array[object]` | Batch API jobs still in_flight at pipeline completion. Each entry: `batch_id`, `skill_name`, `submitted_at`, `expected_completion` (TASK-0070). |
| `pending_batches` | `array[object]` | Alias view of `active_batches` — batch jobs not yet completed. Consumers should poll Step 7 reconciliation on subsequent orchestrator calls (TASK-0070). |

## Human-in-the-Loop Gates

Gates are configured in `pipeline_config.gates`. Each gate defines:

| Field | Type | Description |
|-------|------|-------------|
| `after_skill` | `string` | Pause after this skill completes |
| `type` | `enum` | `human_approval` (manual), `validation_check` (auto), `condition` (auto if condition met) |
| `condition` | `string` | Expression evaluated against output (e.g., `output.risks.length > 0`) |
| `timeout` | `integer` | Max wait seconds for manual gates (default: 3600) |

### Gate Types

| Type | When to Use | Behaviour |
|------|-------------|-----------|
| `human_approval` | Irreversible decisions, architecture sign-offs, deployment go/no-go | Pipeline pauses; waits for `approve`, `reject`, or `modify` response from the primary agent |
| `validation_check` | Automated guard verdicts (`pass`/`block`) | Orchestrator reads `verdict` field from skill output — `block` halts immediately |
| `condition` | Automated branching — advance only when expression is true | Expression is evaluated; pipeline continues if `true`, halts if `false` |

> **Rule:** A gate with `timeout` ≥ 1 AND a blocking consequence MUST use type `human_approval`, not `condition`. Use `condition` only for purely automated checks that require no human decision.

### Condition Expression Language

`condition` expressions are JavaScript-style strings evaluated in a sandboxed context against the pipeline state at the gate point. The context object is:

```javascript
{
  output:           // The most recent skill output (the skill named in after_skill)
  guards:           // Array of all guard verdict objects: [{ skill, verdict, violations }]
  change_impact:    // Output of change-impact-analyzer (if run)
  release_guard:    // Output of implementation-completeness-guard (if run)
  pipeline_config:  // The full pipeline configuration object
  phase_outputs:    // Map of phase_id → skill output for all completed phases
}
```

**Supported operators and patterns:**

| Pattern | Example | Notes |
|---------|---------|-------|
| Property access | `output.risks.length > 0` | Supports nested dot notation |
| Array filter | `output.vulnerabilities.filter(v => v.severity === 'critical').length > 0` | Standard JS Array methods |
| Strict equality | `change_impact.impact_severity !== 'critical'` | Use `===` / `!==` |
| Boolean check | `release_guard.verdict === 'pass'` | String comparison |
| Array every/some | `guards.every(g => g.verdict === 'pass')` | All guards must pass |
| Pipeline config | `pipeline_config.debate_architecture === true` | Read pipeline config flags |

**Not supported:** `eval`, `require`, `import`, `fetch`, async expressions, side effects, or accessing the filesystem.

**Evaluation rules:**
1. Any expression that throws a runtime error (e.g., accessing `.length` on `null`) is treated as `false` — the pipeline halts.
2. Expressions must be synchronous and return a boolean.
3. Short-circuit evaluation is supported (`&&`, `||`).

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
- **Warm-start content hash guard (TASK-0065):** Before restoring a warm-start snapshot, the orchestrator MUST validate the snapshot's artifact content_hash against current session inputs. A mismatch triggers a warning and halts the warm-start unless `force_warm_start: true` is explicitly set.
- **Durable job idempotency (TASK-0064):** Each job entry carries a `job_id` that acts as an idempotency key. Skills that receive a durable job dispatch MUST check for an existing `job_id` before writing — duplicate job_id writes are silently skipped. This prevents duplicate `doc-maintainer` writes on retry.
- **Token events are fire-and-forget (TASK-0066):** `skill.tokens_consumed` events dispatched to `behavioral-telemetry-collector` MUST NOT block pipeline progression. If the telemetry collector is unavailable, the event is silently dropped — it MUST NOT cause pipeline failure.
- **Prompt-cache breakpoints are static-only (TASK-0067):** `cache_control` breakpoints MUST only be placed on the static SKILL.md prefix (loaded in Step b2). They MUST NOT be placed on dynamic blocks: current task description, artifact payloads, or user messages. Violating this rule corrupts cache state and invalidates hits on all subsequent invocations in the session.
- **Budget forcing exemptions are fixed (TASK-0068):** The `budget_forcing_exempt_skills` list (code-generator, design-system-generator, test-generator, mutation-test-generator, documentation-generator, adr-generator) MUST NOT be modified at runtime. These skills produce artifacts whose token length is inherent to their output — truncating them produces broken artifacts.
- **Batch routing is non-blocking and non-gating (TASK-0070):** Skills submitted to the Batch API MUST NOT appear in any `gates` dependency chain. If a pipeline config lists a batch-eligible skill as a gate dependency, the orchestrator MUST override `batch_policy.mode` to `sync_override` for that invocation and emit a warning: `{"warning": "BATCH_GATE_CONFLICT", "skill": "<name>", "overriding_to": "sync"}`.
- **Artifact externalization is disk-backed (TASK-0069):** Externalized artifacts MUST be written atomically to `.opencode/state/artifacts/<artifact_id>.json` before the in-context payload stub is written. If the write fails, the full payload MUST remain in-context (do not stub without a successful write).
- **Converge mode token cost warning (FEATURE-008):** Before starting a converge loop, emit a warning: "Converge mode enabled — this pipeline may run up to <max_iterations> times. Estimated token cost: <N>× single-pass." Do NOT start the loop without surfacing this cost warning to the user. If `skip_cost_check: true` is set, emit the warning but proceed immediately.

## 8. Security Considerations

- The orchestrator MUST NOT pass credentials, tokens, or secrets between skills in session context.
- Skill input compression MUST strip PII from raw_input after the first skill step.
- Gate decision logs are audit-critical — they MUST be retained for the session lifetime.
- Subagents receive only the context slice they need — the orchestrator prunes before passing.
- Pipeline configuration (`pipeline_config`) MUST NOT include external URLs or exec commands.

## 13. Skill Composition

The orchestrator is itself a meta-skill that composes all other skills per the pipeline configuration. It cannot be composed into another skill — it is the root of the composition hierarchy.

Pipeline composition is defined dynamically via `pipeline_config.skills` rather than a static `composes` block, enabling runtime flexibility.

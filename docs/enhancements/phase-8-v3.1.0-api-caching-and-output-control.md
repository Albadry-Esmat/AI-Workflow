# Phase 8 — v3.1.0: API-Level Caching & Output Control

**Version target:** v3.1.0
**Story points:** 34
**Tasks:** TASK-0067 – TASK-0070
**Category:** API-level token economics + output discipline + large-payload handling
**Depends on:** Phase 7 complete (v3.0.0)

---

## Goals

Phase 8 applies four techniques surfaced from the GitHub token-optimization ecosystem that
are **not yet covered** by the 27 existing techniques in the framework:

1. **Anthropic Prompt Caching** — API-level `cache_control` prefix caching; cache reads cost
   only 10% of base input tokens. Fundamentally different from the app-level invocation
   memoization (TASK-0057): that skips the LLM call entirely on a hit, but still spends tokens
   on a miss. Prompt caching reduces per-token cost on every call that reuses a static prefix
   (SKILL.md system prompts, tool definitions), including first calls.

2. **Token Budget Forcing** — Inject an explicit output-length constraint instruction directly
   into each skill invocation before the task description. Production LLM systems consistently
   report 20–40% verbosity reduction with this technique. Orthogonal to `max_tokens` API
   parameter: this is an in-prompt behavioural nudge.

3. **Artifact Externalization** — When an artifact's measured `token_count` exceeds a
   configurable threshold (default 8 000 tokens), store the full payload in a session file and
   replace the in-context payload with a compact `{artifact_ref, summary, full_token_count}`
   stub. Downstream skills fetch the full payload only when they need it. Inspired by the
   headroomlabs-ai/headroom pattern (60–95% reduction on large structured outputs) and
   sheeki03/Few-Word (filesystem offloading).

4. **Batch API Routing** — Async fire-and-forget skills (documentation-generator,
   doc-maintainer, adr-generator, work-item-exporter, behavioral-telemetry-collector) are
   eligible for Anthropic Batch API dispatch when `batch_policy.enabled: true`. Batch API
   delivers a 50% cost reduction in exchange for up to 24 h latency — acceptable for
   non-blocking pipeline tail work.

**Expected aggregate savings:** 70–85% cost reduction on sessions with warm caches and a
mix of large design/code artifacts, relative to the Phase 3 (pre-optimization) baseline.

---

## Tasks

| ID | Title | SP | Status |
|----|-------|----|--------|
| TASK-0067 | API-level prompt caching via `cache_control` breakpoints | 8 | complete |
| TASK-0068 | Token budget forcing — per-skill output-length constraints | 6 | complete |
| TASK-0069 | Artifact externalization — large-payload reference offloading | 11 | complete |
| TASK-0070 | Batch API routing for async skills | 9 | complete |

---

## Task Details

### TASK-0067 — API-level prompt caching (8 SP)

**Problem:** The invocation memoization cache (TASK-0057) skips LLM calls on exact input
matches. But on cache misses — including every first call — the orchestrator re-sends the
full SKILL.md system prompt (typically 2 000–6 000 tokens) on every invocation. This prefix
is **identical across invocations** of the same skill and is therefore a perfect candidate for
Anthropic's prompt caching API, where cache reads cost 10% of base input token price.

**Technique source:** Anthropic Prompt Caching API (`cache_control: {type: "ephemeral"}`),
confirmed effective in production; cache reads = $0.30/MTok vs $3.00/MTok for Claude Sonnet 4.6.

**Minimum cacheable prefix:** 1 024 tokens for Claude Sonnet 4.6 (all SKILL.md system prompts
exceed this threshold).

**Change to `orchestrator` (v2.0.0 → v2.1.0):**

New input: `cache_control_strategy` (`"auto"` | `"explicit"` | `"disabled"`, default `"auto"`).

New **Step 3b4** — Apply prompt cache breakpoints before each skill invocation:
```
[TASK-0067] Step 3b4: Apply cache_control breakpoints
  IF cache_control_strategy != "disabled":
    Identify the static prefix of the skill's system prompt (SKILL.md sections loaded in b2).
    IF static_prefix token_count >= 1024 (Claude Sonnet minimum):
      Mark the last token of the static prefix with cache_control: {type: "ephemeral", ttl: "1h"}
      (1-hour TTL for SKILL.md content — reused across the full session and across sessions)
    Mark the last complete prior-turn assistant message (if any) with
      cache_control: {type: "ephemeral"}  (5-minute TTL — conversation-level reuse)
    Record cache breakpoints in artifact envelope: cache_breakpoints[]
    After invocation, record API response fields in session_context.prompt_cache_log:
      { skill_name, cache_creation_input_tokens, cache_read_input_tokens, input_tokens }
    Emit fire-and-forget api.cache_hit event to behavioral-telemetry-collector when
      cache_read_input_tokens > 0.
  Rules:
    - NEVER place cache_control on blocks that change per-invocation:
        current task description, dynamic artifact payloads, user message, per-call context.
    - Static prefix = everything up to (and including) the last block of loaded SKILL.md sections.
    - Do NOT cache the artifact payload itself — only the instruction prefix.
```

New output field: `prompt_cache_stats` — aggregate `{total_cache_writes, total_cache_reads,
estimated_cost_saving_pct}` for the session.

**Change to `behavioral-telemetry-collector` (v1.2.0 → v1.3.0):**
Add `api.cache_hit` event type to the event schema:
```json
{
  "event_type":               "api.cache_hit",
  "skill":                    "architecture-design",
  "session_id":               "sess-0042",
  "cache_read_input_tokens":  3840,
  "cache_creation_input_tokens": 0,
  "input_tokens":             112,
  "ttl":                      "1h"
}
```
Step 2 updated: 8 → 9 event types.

**Change to `session-insights` (v1.2.0 → v1.3.0):**
Add `prompt_cache_efficiency` sub-block inside `token_efficiency`:
```json
"prompt_cache_efficiency": {
  "total_cache_read_tokens":     18400,
  "total_cache_write_tokens":    4200,
  "cache_hit_sessions":          3,
  "estimated_cost_saving_pct":   82,
  "skills_with_highest_cache_savings": ["architecture-design", "feature-planning"]
}
```

---

### TASK-0068 — Token budget forcing (6 SP)

**Problem:** Skills tend to produce verbose outputs because nothing in the current prompt
instructs them to be concise at the token level. The `max_tokens` API parameter sets a hard
ceiling but does not change model behaviour before that ceiling is reached.

**Technique source:** "Token budget forcing" pattern — widely used in production LLM systems
(multiple GitHub repos confirm 20–40% verbosity reduction). Explicitly instructing the model
to use at most N tokens in its output nudges it toward conciseness before the hard ceiling.

**Change to `orchestrator` (v2.1.0 → v2.2.0):**

New input: `budget_forcing_enabled` (boolean, default `true`).

New **Step 3b5** — Inject output token budget instruction:
```
[TASK-0068] Step 3b5: Inject token budget instruction
  IF budget_forcing_enabled == true AND skill not in budget_forcing_exempt_skills:
    Compute budget = skill.max_output_tokens (from index.yaml field, default 4000 if absent).
    On retry (retry_count > 0): tighten budget by 20% per retry iteration.
    Prepend the following instruction to the skill's task description
    (BEFORE the dynamic task content, NOT mixed with it):
      "[TOKEN BUDGET: Keep your entire response under {budget} tokens.
        Be concise and direct. Omit preamble, repetition, and meta-commentary.]"
  budget_forcing_exempt_skills:
    - code-generator        (output length is inherent to the artifact)
    - design-system-generator
    - test-generator
    - mutation-test-generator
    - documentation-generator
    - adr-generator
  Record budget_instruction_applied: true/false in execution_log per skill invocation.
```

New `max_output_tokens` field added to `skills/index.yaml` for all skills (see below).

---

### TASK-0069 — Artifact externalization (11 SP)

**Problem:** Large structured artifacts (full design systems, generated code files,
dependency graphs with hundreds of nodes) are passed in-context between skills even when the
consuming skill only needs a summary or key fields. This causes unnecessary token bloat in the
inter-skill handoff layer.

**Technique source:**
- headroomlabs-ai/headroom (GitHub, 56k ★): "Compress tool outputs, logs, files, and RAG
  chunks before they reach the LLM. 60–95% fewer tokens, same answers."
- sheeki03/Few-Word (GitHub): "Claude Code plugin that offloads large outputs to filesystem
  and retrieves when required."

**Change to `orchestrator` (v2.2.0 → v2.3.0):**

New `token_policy` field: `externalize_threshold` (integer, default `8000` tokens).

New **Step 3b6** — Externalize oversized artifacts:
```
[TASK-0069] Step 3b6: Externalize large artifact payloads
  After Artifact envelope wrapping (Step 3b3), check artifact.token_count:
  IF artifact.token_count > token_policy.externalize_threshold
     AND artifact.content_type in ["code", "documentation", "design_system",
                                   "test_suite", "dependency_graph"]:
    1. Write full payload to `.opencode/state/artifacts/<artifact_id>.json`.
    2. Replace artifact.payload in-context with an ExternalizedPayloadStub:
         {
           "artifact_ref":     "state/artifacts/<artifact_id>.json",
           "artifact_id":      "<artifact_id>",
           "summary":          first_500_chars(serialized_payload),
           "full_token_count": <original_token_count>,
           "externalized":     true,
           "content_type":     "<content_type>"
         }
    3. Update artifact.token_count to the stub token count (typically 100–150 tokens).
    4. Record artifact.externalized event in telemetry: { artifact_id, original_tokens,
         stub_tokens, saving_pct }.
    5. Add artifact_id to externalized_artifacts[] output list.
  Downstream skill fetch (Step 3b7):
    IF a skill's input schema declares a field with type "full_artifact" AND the incoming
    artifact is externalized:
      Load full payload from artifact_ref before invoking the skill.
      Measure and record fetch_token_cost in execution_log.
  Never externalize these content types (must remain in-context for reasoning quality):
    - requirements, architecture_proposal, final_architecture, feature_plan,
      security_findings, completeness_report
```

New output field: `externalized_artifacts` — array of `{artifact_id, original_tokens, stub_tokens}`.

New `externalize_threshold` in pipeline `token_policy` block.

---

### TASK-0070 — Batch API routing for async skills (9 SP)

**Problem:** Async skills (documentation-generator, doc-maintainer, adr-generator,
work-item-exporter, behavioral-telemetry-collector) are currently dispatched as normal
asynchronous invocations. Anthropic's Batch API delivers the same output at 50% cost in
exchange for up to 24 h processing time — an acceptable trade-off for all five of these
fire-and-forget tail skills.

**Technique source:** Anthropic Batch API (confirmed 50% cost reduction on all models;
latency: up to 24 h). Widely adopted in production agentic pipelines for non-blocking work.

**Change to `orchestrator` (v2.3.0 → v2.4.0):**

New pipeline config block `batch_policy`:
```json
"batch_policy": {
  "enabled":               true,
  "queue_timeout":         "24h",
  "cost_saving_target":    "50%",
  "eligible_skills":       ["documentation-generator", "doc-maintainer",
                            "adr-generator", "work-item-exporter",
                            "behavioral-telemetry-collector"]
}
```

New **Step 3k** — Batch routing check for async skills:
```
[TASK-0070] Step 3k: Route async skills through Batch API when eligible
  IF skill.async == true
     AND batch_policy.enabled == true
     AND skill.name in batch_policy.eligible_skills:
    Instead of immediate async dispatch (Step 3j):
      Create a Batch API request entry:
        { custom_id: "job-<skill_name>-<sequence>", method: "POST",
          url: "/v1/messages", body: <skill invocation payload> }
      Queue entry in session_context.batch_queue[].
      Update durable job_registry entry: mode="batch", status="batch_queued".
      Do NOT dispatch immediately — collect all batch-eligible invocations first.
    At end of Step 3 (after all skills dispatched):
      IF batch_queue is non-empty:
        Submit batch to Anthropic Batch API.
        Record batch_id in session_context.active_batches[].
        Log: { event: "batch.submitted", batch_id, job_count, estimated_completion: "+24h" }
  Non-eligible async skills continue using immediate async dispatch (Step 3j).
```

Updated **Step 7** (batch reconciliation):
```
[TASK-0070] Batch reconciliation in Step 7:
  For each batch_id in session_context.active_batches[]:
    Poll Anthropic Batch API for status.
    IF completed: fetch results, update corresponding job_registry entries to "completed",
      store result_ref, fire completion_event to event_log.
    IF still processing: surface in pipeline_result.pending_batches[] with batch_id,
      estimated_completion.
    IF failed: surface in pipeline_result.failed_batches[], update job status to "failed".
  All batch outcomes are non-blocking — pipeline result is returned regardless of batch status.
```

New output fields: `active_batches` — list of submitted batch IDs; `pending_batches` — batches
still processing at Step 7 reconciliation time.

**Change to `full-pipeline.json` (v3.2.0 → v3.3.0):**

Add `batch_policy` block and `externalize_threshold` to `token_policy`:
```json
"batch_policy": {
  "enabled": true,
  "queue_timeout": "24h",
  "eligible_skills": ["documentation-generator", "doc-maintainer",
                      "adr-generator", "work-item-exporter",
                      "behavioral-telemetry-collector"]
},
"token_policy": {
  ...(existing fields)...,
  "externalize_threshold": 8000
}
```

---

## Expected Impact Summary

| Technique | Token Reduction | Applies To |
|-----------|----------------|------------|
| Prompt caching (TASK-0067) | 90% on cached prefix tokens | All skills with static SKILL.md prefixes ≥ 1 024 tokens |
| Token budget forcing (TASK-0068) | 20–40% on skill outputs | All non-exempt skills (see exempt list) |
| Artifact externalization (TASK-0069) | 60–95% on large payloads | code, design_system, test_suite, dependency_graph artifacts |
| Batch API routing (TASK-0070) | 50% cost reduction (async skills only) | documentation-generator, doc-maintainer, adr-generator, work-item-exporter, behavioral-telemetry-collector |

**Cumulative baseline comparison (from TASK-0066 telemetry):**
Before Phase 4: ~120 000 tokens/full-pipeline run
After Phase 7: ~42 000 tokens/run (65% reduction)
After Phase 8 target: ~18 000–22 000 tokens/run (additional 47–57% reduction)

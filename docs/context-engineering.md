# Context Engineering — Memory & Retrieval

**Version:** 3.0.0 | **Last updated:** 2026-07-02

## Context Model

Context in this system operates at three levels:

```
Level 1: Global Context (system-wide, static)
  → Skill definitions, registry, governance rules
  → Loaded once at session start

Level 2: Pipeline Context (session-scoped, dynamic)
  → Current pipeline config, artifacts in flight
  → Managed by orchestrator

Level 3: Session Context (turn-scoped, persisted)
  → Historical outputs, gate decisions, feedback loops
  → Managed by context memory protocol
```

## Session Context Schema

```json
{
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "pipeline_template": "full-pipeline",
  "created_at": "2026-06-18T09:00:00Z",
  "updated_at": "2026-06-18T10:30:00Z",
  "token_budget": {
    "tier": "full_pipeline",
    "max_tokens": 200000,
    "consumed_tokens": 42000,
    "remaining_tokens": 158000
  },
  "project_spec": {
    "requirements": [ ... ],
    "open_questions": [ ... ],
    "assumptions": [ ... ],
    "risks": [ ... ],
    "domain": "e-commerce"
  },
  "architecture": {
    "modules": [ ... ],
    "data_flow": [ ... ],
    "integration_points": [ ... ],
    "technical_decisions": [ ... ]
  },
  "dependency_graph": {
    "nodes": [ ... ],
    "edges": [ ... ],
    "cycle_report": { "cycles": [], "severity": "none" }
  },
  "task_graph": {
    "tasks": [ ... ],
    "milestones": [ ... ],
    "current_phase": "phase-6-execution"
  },
  "code_map": {
    "src/api/routes.ts": { "module": "api", "content_hash": "abc123", "language": "typescript" }
  },
  "skill_registry": { "version": "2.1.0", "skills": [ ... ] },
  "decision_log": {
    "adrs": [{ "id": "ADR-0001", "title": "Use PostgreSQL", "status": "accepted", "path": "docs/adrs/ADR-0001.md" }]
  },
  "documentation_state": {
    "last_sync": "2026-06-18T09:00:00Z",
    "stale_sections": [],
    "coverage_percent": 92
  },
  "test_state": {
    "coverage_target": 80,
    "current_coverage": 84,
    "last_run": "2026-06-18T10:00:00Z",
    "failing_tests": [],
    "invalidated_tests": []
  },
  "security_state": {
    "last_audit": "2026-06-18T10:00:00Z",
    "open_findings": [],
    "gate_status": "pass"
  },
  "pipeline_state": {
    "current_phase": "phase-6-execution",
    "active_skills": [{ "skill": "code-generator", "status": "running", "started_at": "..." }],
    "completed_phases": ["phase-1-requirements", "phase-2-architecture"],
    "failed_phases": []
  },
  "dispatch_map": {
    "code.generated": [{ "skill": "clean-code-review", "priority": 1, "async": false }]
  },
  "event_log": [
    { "id": "evt-001", "type": "phase.completed", "source_skill": "feature-planning", "timestamp": "..." }
  ],
  "snapshots": [
    { "id": "snap-001", "label": "post-architecture", "timestamp": "...", "status": "stable", "keys_included": ["architecture", "project_spec"] }
  ],
  "rollback_log": [],
  "adr_index": [
    { "id": "ADR-0001", "title": "Use PostgreSQL", "status": "accepted", "path": "docs/adrs/ADR-0001.md" }
  ]
}
```

## Compression Rules

| Artifact Type | Retention Policy |
|--------------|------------------|
| Skill full output | Keep last 3; older compress to ID + status + metrics |
| Raw input | Discard after first skill completes |
| Intermediate artifacts | Discard after downstream consumer completes |
| Feedback entries | Keep all (low volume, critical for traceability) |
| Execution log | Keep last 20 entries; summarize older entries |
| Gate decisions | Keep all (audit trail) |

## Memory Retrieval

The orchestrator retrieves context from session_context by:

1. **Direct field access** — `session_context.skills.<skill_name>.output.<field>`
2. **Artifact index** — `session_context.artifacts.<artifact_name>` for cross-skill data
3. **Execution log** — `session_context.skills.<skill_name>.metrics` for performance data
4. **Gate history** — `session_context.gates_passed` for approval status

## Token Budget Per Session

| Session Type | Max Tokens | Typical Skills | Use Case |
|-------------|------------|----------------|----------|
| Quick | 32K | 1-2 | Single skill invocation (code review only) |
| Standard | 64K | 3-5 | Partial pipeline (architecture + planning) |
| Deep | 128K | 6+ | Full pipeline with feedback loops |

When budget is exhausted:
1. Session is halted with `status: "halted"`.
2. Partial results are returned.
3. Session can resume from the halt point with fresh token allocation.

## Context State Machine

```
[New Session] → Loading global context
       │
       ▼
[Receiving Input] → raw_input stored in session_context
       │
       ▼
[Executing Skill N] → skill output appended to session_context
       │                    │
       │                    ▼ (if feedback triggered)
       │          [Invalidate downstream artifacts]
       │                    │
       ▼                    ▼
[Advancing to N+1] ← [Re-executing from feedback target]
       │
       ▼ (if HITL gate)
[Gate Paused] → session persisted, waiting for approval
       │
       ▼ (if approved)
[Continuing] → session updated with gate decision
       │
       ▼ (if completed)
[Finalizing] → metrics aggregated, session archived
```

## Context Isolation

- Each session has isolated context — no cross-session leakage.
- Subagents receive only the context slice they need (orchestrator prunes before passing).
- Global context (skill definitions) is read-only and shared across sessions.
- Pipeline context is destroyed when the pipeline completes or fails.

## Optimizing Context for AI Agents

| Strategy | How It Works | Impact |
|----------|-------------|--------|
| Prefix compression | Skill instructions loaded once, not repeated per turn | 2x reduction in multi-turn sessions |
| Output pruning | Only pass fields the next skill's input schema requires | 40-60% reduction per handoff |
| Summarization | Execution log entries > 20 are summarized to 1 line each | Keeps log under 2K tokens |
| ID-only references | Replace descriptions with IDs in cross-references | 30% reduction |
| Metrics stripping | Remove metrics from inter-skill handoffs | ~50 tokens per handoff |

## Context Change Rules

- Changing context compression rules requires updating this file AND `skills/memory/context-protocol.md`.
- Adding a new context level requires updating the architecture documentation.
- Token budget changes require updating `skills/memory/context-protocol.md` AND this file.

---

## Artifact Envelope

> Added in v2.3.0 (TASK-0060) — inspired by AgentScope's typed `Msg` schema.

Every inter-skill data transfer is wrapped in a typed `Artifact` envelope. The envelope
provides measurable, prunable, auditable inter-skill data transfer.

### Schema

```json
{
  "artifact_id":    "art-0042",
  "source_skill":   "architecture-design",
  "target_skill":   "feature-planning",
  "content_type":   "architecture_output",
  "payload":        { "...pruned output..." },
  "created_at":     "2026-07-02T10:30:00Z",
  "token_count":    1840,
  "compressed":     false,
  "schema_version": "1.0.0"
}
```

### Field Reference

| Field | Type | Description |
|-------|------|-------------|
| `artifact_id` | `string` | Unique ID for this artifact transfer (`art-<sequence>`) |
| `source_skill` | `string` | Skill that produced the payload |
| `target_skill` | `string` | Skill that will consume the payload |
| `content_type` | `string` | Semantic type of payload (e.g. `architecture_output`, `requirement_set`) |
| `payload` | `object` | The pruned output object (Phase 4 TASK-0051 pruning applied before wrapping) |
| `created_at` | `ISO8601` | Timestamp of envelope creation |
| `token_count` | `integer` | Measured token count of the payload (not estimated) |
| `compressed` | `boolean` | `true` if the payload has been compressed by context-compressor |
| `schema_version` | `string` | Envelope schema version — always `"1.0.0"` for Phase 6 envelopes |

### Lifecycle

```
[Source skill produces output]
        │
        ▼
[Output-field pruning — Step 3b] (TASK-0051)
        │
        ▼
[Wrap in Artifact envelope — Step 3b3] (TASK-0060)
        │  token_count measured here (actual)
        ▼
[Dispatch to target skill] ──► event_log: { type: "artifact.dispatched", artifact_id, token_count }
        │
        ▼
[Target skill unpacks payload from envelope]
        │
        ▼
[If skill output consumed and > 3 prior outputs: compress — Step 3i]
        └──► envelope.compressed = true
```

### Observability

Every artifact dispatch is recorded in `session_context.event_log`:
```json
{ "id": "evt-N", "type": "artifact.dispatched", "artifact_id": "art-0042",
  "source_skill": "architecture-design", "target_skill": "feature-planning",
  "token_count": 1840, "timestamp": "2026-07-02T10:30:00Z" }
```

This record enables exact token-per-transfer accounting — the foundation for Phase 7
TASK-0066 token observability dashboards.

### Artifact IDs in Snapshots

Snapshot objects (see Pipeline Snapshot API below) carry `artifact_ids[]` — the list of
every `artifact_id` dispatched up to the snapshot's gate boundary. This allows full
reconstruction of inter-skill data flow from a restored snapshot.

---

## Pipeline Snapshot API

> Added in v2.3.0 (TASK-0062). Extends TASK-0056 `resume_from_phase` with durable,
> cross-session persistence.

### Problem

Phase 5's `resume_from_phase` resumes from in-memory state. If the session restarts
(new conversation turn, process restart), prior state is lost. Named snapshots persist
state to a durable location keyed by `(session_id, phase_id)` so resume works across
conversation boundaries.

### Snapshot Schema

```json
{
  "snapshot_id":   "snap-phase-4-planning-approved",
  "session_id":    "sess-001",
  "phase_id":      "phase-4-planning",
  "gate_decision": "approve",
  "taken_at":      "2026-07-02T10:30:00Z",
  "state_keys":    ["requirements", "architecture", "dependency_graph", "task_graph"],
  "artifact_ids":  ["art-0001", "art-0002", "art-0003", "art-0004"]
}
```

Snapshots are stored in `session_context.snapshots[]` with full artifact payloads (not
references) and persisted in the session file at
`.opencode/state/sessions/<session_id>.json`.

### When Snapshots Are Taken

The orchestrator automatically takes a snapshot **immediately after each approved HITL
gate**. No manual invocation is required.

| HITL Gate (after skill) | Auto-snapshot ID pattern |
|------------------------|--------------------------|
| `requirement-analyzer` | `snap-phase-1-requirements-approved` |
| `architecture-design` | `snap-phase-2-architecture-approved` |
| `feature-planning` | `snap-phase-3-planning-approved` |
| `security-review` | `snap-phase-4-security-approved` |
| `deployment-strategy` | `snap-phase-5-deploy-approved` |

### Restore Usage

```json
{ "restore_from_snapshot": "snap-phase-2-architecture-approved" }
```

This input to the orchestrator:
1. Loads the named snapshot from the persisted session file
2. Restores all `state_keys` and artifact payloads into `session_context`
3. Sets `resume_from_phase` to the phase immediately after `snapshot.phase_id`
4. Continues pipeline execution from that phase

### Snapshot Limits

- Max **10 snapshots per project**
- LRU eviction when the 11th is created (oldest removed, warning emitted)
- Snapshot files MUST NOT contain credentials, tokens, or PII

### Relationship to TASK-0056

| Feature | TASK-0056 `resume_from_phase` | TASK-0062 `restore_from_snapshot` |
|---------|-------------------------------|-----------------------------------|
| Scope | In-memory, same session | Durable, cross-session |
| Persistence | None (memory only) | `.opencode/state/sessions/*.json` |
| Granularity | Phase boundary | Gate-approved checkpoint |
| Phase 7 | — | Foundation for TASK-0065 warm-start |

---

## Cross-Session Memory (Archival)

> Added in v2.3.0 (TASK-0059). Implemented in `context-memory` v2.0.0, inspired by
> Letta (MemGPT) tiered memory architecture.

### Problem

`context-memory` v1.0.0 is session-scoped only. Starting a new pipeline for the same
project re-runs requirement-analysis, architecture-design, and dependency-graph phases
even when their outputs haven't changed. This is the largest avoidable token cost in
iterative development workflows.

### Three-Tier Memory Model

```
Tier 1: Working Memory      (session-scoped, in-flight)
  ├─ Pipeline artifacts in flight
  ├─ Current HITL gate state
  └─ Active skill invocation context

Tier 2: Session Memory      (session-scoped, persisted until explicit clear)
  ├─ Architecture decisions
  ├─ ADR index
  ├─ Dependency graph (module-level, not code-level)
  └─ req_task_map from last feature-planning run

Tier 3: Archival Memory     (cross-session, project-scoped, persistent)
  ├─ Approved architecture decisions (post "Sign off architecture" gate)
  ├─ Accepted ADRs
  ├─ Module boundaries + responsibility map
  └─ Approved task graph (milestones, phases)
```

### Archival Memory Persistence

Archival memory blocks are stored at:
```
.opencode/state/archival/<project_id>/
  architecture.json     ← approved architecture output + content_hash
  adr_index.json        ← accepted ADRs
  module_map.json       ← module boundaries + responsibility map
  task_graph.json       ← approved task graph (milestones, phases)
```

Each block carries a `content_hash` (SHA-256 of source artifact payload). The orchestrator
invalidates the block if the hash no longer matches the current artifact.

### Orchestrator Integration

| Event | Archival Write |
|-------|----------------|
| Architecture HITL gate approved | Write architecture output → `archival/architecture.json` |
| Feature-planning HITL gate approved | Write task_graph → `archival/task_graph.json` |
| ADR accepted (state-manager ADR write) | Write/merge → `archival/adr_index.json` |

**On pipeline start:** if `archival_memory` exists for `project_id`, the orchestrator
pre-populates session state with Tier 3 blocks and **skips phases whose outputs are already
in archival** (content_hash verified against current artifacts).

### Expected Token Savings

| Run | Phases Skipped via Archival | Token Saving |
|-----|-----------------------------|--------------|
| First run | None (cold start) | 0 |
| Second run (new feature, same architecture) | phases 1–4 | ~40,000 tokens |
| Third+ runs | phases 1–4 (+ more blocks accumulate) | compounding |

### Isolation Guarantee

- Archival memory is **strictly scoped to `project_id`**
- Cross-project reads are rejected — `context-memory` rejects any `inherit_from` that
  resolves to a different `project_id`
- Credentials, tokens, and PII MUST NOT appear in any archival memory block

### Backward Compatibility (v1.0.0 → v2.0.0)

Callers using the v1.0.0 API (`operation=write, tier=working`) continue to work without
modification. The v2.0.0 shim maps v1.0.0 behavior to Tier 1 automatically.

---

## Token Efficiency Events

> Added in v3.0.0 (TASK-0066). Uses Artifact envelope `token_count` from TASK-0060.

### Event Schema

After every skill invocation (including cache hits), the orchestrator emits a
`skill.tokens_consumed` event to `behavioral-telemetry-collector`:

```json
{
  "event_type":   "skill.tokens_consumed",
  "skill_name":   "architecture-design",
  "session_id":   "sess-001",
  "pipeline_phase": "phase-2-architecture",
  "tokens_in":    1240,
  "tokens_out":   3800,
  "tokens_total": 5040,
  "model":        "claude-sonnet-4.6",
  "cache_hit":    false,
  "artifact_ids": ["art-0003"]
}
```

- `tokens_in` = sum of `Artifact.token_count` for all input artifacts passed to the skill.
- `tokens_out` = `Artifact.token_count` of the output artifact produced.
- For cache hits: `tokens_out = 0` (no LLM call made); `cache_hit = true`.
- Events are **fire-and-forget** — they MUST NOT block pipeline execution.

### session_summary.token_efficiency

`session-insights` (SKL-048) aggregates all `skill.tokens_consumed` events into a
`token_efficiency` block appended to the session_summary:

```json
"token_efficiency": {
  "total_tokens_consumed": 42000,
  "by_skill": [
    { "skill": "code-generator",     "tokens": 12000, "pct_of_total": 28.6 },
    { "skill": "architecture-design","tokens":  5040, "pct_of_total": 12.0 }
  ],
  "cache_hit_rate":     0.15,
  "compression_events": 3,
  "outlier_skills":     [{ "skill": "code-generator", "tokens": 12000, "pct_of_total": 28.6 }],
  "vs_baseline":        -0.38
}
```

`vs_baseline` is negative for improvement (–38% = 38% fewer tokens than pre-Phase-4
baseline) and positive for regression. The baseline is stored at
`behavioral_telemetry.baseline_tokens_per_session` in state.

### Observability Pipeline

```
[Orchestrator Step 3c3] ──► behavioral-telemetry-collector (SKL-047)
        (fire-and-forget token event)           │
                                                ▼
                                    session-insights (SKL-048)
                                    adds token_efficiency block
                                                │
                                                ▼
                                    enhancement-dashboard (SKL-049)
                                    renders Token Efficiency tab
                                                │
                                                ▼
                                    adaptive-proposal-generator (SKL-050)
                                    generates model_tier_downgrade /
                                    output_pruning_candidate /
                                    compression_policy_tighten proposals
```

---

## Durable Job Registry

> Added in v3.0.0 (TASK-0064). Extends TASK-0058's `async_task_registry` with persistence
> and retry logic.

### Problem

The four async skills (`documentation-generator`, `doc-maintainer`, `adr-generator`,
`work-item-exporter`) are fire-and-forget. If the session ends before they complete, their
state is silently abandoned with no retry or failure reporting.

### Job Entry Schema

```json
{
  "job_id":           "job-doc-001",
  "skill":            "documentation-generator",
  "session_id":       "sess-001",
  "dispatched_at":    "2026-07-02T10:30:00Z",
  "status":           "pending",
  "retry_count":      0,
  "max_retries":      3,
  "retry_policy":     { "backoff": "exponential", "initial_delay_ms": 5000 },
  "last_error":       null,
  "completed_at":     null,
  "result_ref":       null,
  "completion_event": "documentation.completed"
}
```

### Status Lifecycle

```
[pending] ──► [running] ──► [completed]
                  │
                  └──► [retrying] ──► [running] (after backoff)
                  │
                  └──► [failed]    (max_retries exhausted)
```

### Storage

Durable jobs are persisted to `.opencode/state/sessions/<session_id>.json` under
`job_registry[]`. This allows jobs to survive session restarts — the orchestrator checks
for in-progress jobs on session resume and re-dispatches them if needed.

### Idempotency

Each job carries a `job_id` (idempotency key). Skills receiving a durable job dispatch
MUST check for an existing `job_id` before writing output. Duplicate `job_id` writes are
silently skipped, preventing double-write on retry.

### Base Mode vs. Advanced Mode

| Mode | Job Storage | Use Case |
|------|------------|----------|
| Base (default) | Session state file | Self-contained; no external infrastructure |
| Advanced (future) | External queue adapter (Trigger.dev, SQS) | High-throughput; multi-worker |

Phase 7 ships base mode only. Advanced mode is a future extension with a defined adapter
contract (dispatch/callback interface).

### Query API

```json
{ "query_async_jobs": { "session_id": "sess-001", "status_filter": "all" } }
```

Returns the current `job_registry` filtered by session and status. Does NOT run any
pipeline step — it is a pure read operation.

---

## Warm-Start

> Added in v3.0.0 (TASK-0065). Unifies TASK-0056 `resume_from_phase` and TASK-0062
> snapshot persistence into a single user-facing capability.

### Problem

Prior capabilities:
- TASK-0056: `resume_from_phase` — in-memory resume; lost on session restart
- TASK-0062: `restore_from_snapshot` — durable restore; requires manual snapshot_id

Warm-start unifies both into one input with three intents covering all use cases.

### `warm_start` Input

```json
{
  "warm_start": {
    "snapshot_id":     "snap-phase-2-architecture-approved",
    "intent":          "re_run_from_snapshot",
    "artifact_diff":   null,
    "force_warm_start": false
  }
}
```

### Intents

| Intent | Behavior | Use Case |
|--------|----------|----------|
| `re_run_from_snapshot` | Restore state; re-run all phases from snapshot's `phase_id` onward | Re-run with same inputs after a code fix |
| `modify_and_continue` | Restore state; apply `artifact_diff`; re-run from that phase | Tweak architecture decision, re-run planning onward |
| `branch` | Restore into a NEW session; run variant without affecting original | A/B comparison of two architecture approaches |

### Snapshot Menu (at HITL Gates)

After every HITL gate pause, the orchestrator surfaces available warm-start points:

```
Available warm-start points:
  snap-phase-1-requirements   (after: requirement-analyzer)
  snap-phase-2-architecture   (after: architecture-design)   ← last approved
  snap-phase-3-planning       (pending approval)
```

### Content Hash Guard

Before restoring, the orchestrator validates the snapshot's `artifact_ids` content
hashes against current session inputs. A mismatch emits a warning:

> "Snapshot content_hash mismatch — codebase may have diverged. Use
> `force_warm_start: true` to override."

Set `force_warm_start: true` only when you intentionally want to warm-start from a
snapshot that was taken on a different version of the codebase.

# Context Engineering — Memory & Retrieval

**Version:** 2.2.0 | **Last updated:** 2026-06-18

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

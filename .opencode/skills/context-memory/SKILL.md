---
name: context-memory
description: Use when managing session state, persisting context between turns, or preventing state bleed across executions in multi-turn skill orchestration. Triggers on: "remember this", "persist context", "restore session", "state management", "multi-turn".
---

# Context Memory Protocol

> Session persistence and state management for multi-turn skill orchestration.

## Purpose

The Context Memory Protocol defines how state is serialized, preserved, and restored across skill invocations. This enables multi-turn orchestration, resumable pipelines, and cross-skill context sharing without coupling.

## Session Context Schema

Every pipeline execution produces a `session_context` object that can be persisted and reused:

```json
{
  "session_id": "uuid",
  "pipeline": "full | requirements-only | architecture-only",
  "created_at": "ISO8601",
  "updated_at": "ISO8601",
  "status": "in_progress | completed | halted | failed",
  "gates_passed": ["gate-1", "gate-2"],
  "feedback_loops": 0,
  "max_feedback_loops": 3,
  "skills": {
    "requirement-analyzer": {
      "status": "completed",
      "version": "1.1.0",
      "output": { ... },
      "metrics": { ... },
      "timestamp": "ISO8601"
    }
  },
  "current_step": "architecture-design",
  "artifacts": {
    "requirements": { ... },
    "architecture": null,
    "tasks": null,
    "test_plan": null
  },
  "metadata": {
    "total_tokens_in": 15000,
    "total_tokens_out": 42000,
    "total_duration_ms": 123400,
    "orchestrator_version": "1.0.0"
  }
}
```

## Compression Rules

To minimize token consumption across turns:

| Artifact Type | Retention Policy |
|--------------|------------------|
| Skill full output | Keep last 3 skills only; older entries compress to ID + status + metrics |
| Raw input | Discard after first skill completes |
| Intermediate artifacts | Discard after downstream skill that consumes them completes |
| Feedback entries | Keep all (low volume, critical for traceability) |
| Execution log | Keep last 20 entries; summarize older entries |
| Gate decisions | Keep all (audit trail) |

## Resumption Protocol

When resuming a pipeline:

1. Load `session_context` from `.opencode/state/sessions/<session_id>.json`.
2. Orchestrator reads `current_step` and `status`.
3. If `status === "in_progress"`, resume from `current_step`.
4. If `status === "halted"`, check which gate caused the halt and re-present the gate decision.
5. If `status === "completed"`, return cached result (idempotent).
6. If `status === "failed"`, offer retry with `max_retries - 1`.

## State Persistence Storage Convention

Session context is persisted to and loaded from the following locations:

```
.opencode/state/
  sessions/
    <session_id>.json     ← Serialized session_context per pipeline run
  last_session.txt        ← Single line: most recent session_id for quick resume
```

**Rules:**
- The orchestrator MUST write `session_context` to `.opencode/state/sessions/<session_id>.json` after every skill step completes.
- On pipeline start, if `resume_from` is provided, load from `.opencode/state/sessions/<session_id>.json`.
- `last_session.txt` MUST be updated on every new pipeline start and on every pipeline completion.
- Session files older than 30 days SHOULD be archived or deleted.
- Session files MUST NOT contain credentials, tokens, or PII.
- If the state directory does not exist, create `.opencode/state/sessions/` before the first write.

## Cross-Skill Context Passing

Skills receive context through two channels:

1. **Explicit inputs** (declared in the skill's input schema) — primary channel.
2. **Session context** (available via `session_context.artifacts`) — read-only reference.

Skills MUST NOT write directly to `session_context`. Only the orchestrator mutates it.

## Feedback Loop Integration

When a skill emits a `feedback` entry with `type: "backpropagate"`:

```json
{
  "type": "backpropagate",
  "from_skill": "clean-code-review",
  "target_skill": "architecture-design",
  "reason": "Code review reveals module boundary violation in User module",
  "evidence": { "issue_id": "ISS-003", "affected_module": "user" }
}
```

The orchestrator:
1. Increments `session_context.feedback_loops`.
2. If `feedback_loops > max_feedback_loops`, logs warning and continues.
3. Otherwise, re-invokes `target_skill` with augmented input.
4. Invalidates all downstream skill artifacts in `session_context.artifacts`.
5. Resets `current_step` to the feedback target's position.

## Token Budget Per Session

| Session Type | Max Total Tokens (in + out) |
|-------------|---------------------------|
| Quick (1-2 skills) | 32K |
| Standard (3-5 skills) | 64K |
| Deep (6+ skills, multiple feedback loops) | 128K |

When budget is exhausted mid-pipeline, the orchestrator:
1. Saves the `session_context` with `status: "halted"`.
2. Returns partial results.
3. Can resume from the halt point with a new token allocation.

---
name: observability
description: Use when adding metrics collection, monitoring, or observability to skills or the orchestrator pipeline. Triggers on: "add metrics", "monitor skills", "observability", "track execution", "how do I measure", "pipeline metrics", "execution monitoring".
---

# Observability & Metrics

> Standardized metrics collection and monitoring across all skills and the orchestrator.

## Per-Skill Metrics

Every skill output MUST include a `metrics` object with these base fields:

| Field | Type | Description |
|-------|------|-------------|
| `tokens_in` | `integer` | Input token count |
| `tokens_out` | `integer` | Output token count |
| `duration_ms` | `integer` | Execution time in milliseconds |
| `items_produced` | `integer` | Count of primary output items |
| `version` | `string` | Skill version that produced the output |

Domain-specific metrics are ADDITIONAL to the base fields (e.g., `critical`, `high`, `medium`, `low` counts in security-review).

## Orchestrator Metrics

The orchestrator aggregates per-skill metrics into a pipeline-level report:

```json
{
  "total_tokens_in": 45000,
  "total_tokens_out": 89000,
  "total_duration_ms": 345000,
  "skills_executed": 5,
  "skills_failed": 0,
  "validation_errors": 2,
  "feedback_loops": 1,
  "gates_passed": 3,
  "gates_halted": 0,
  "retries": 1,
  "compression_savings_tokens": 28000,
  "per_skill": [
    {
      "name": "requirement-analyzer",
      "status": "ok",
      "tokens_in": 5000,
      "tokens_out": 12000,
      "duration_ms": 45000,
      "retries": 0,
      "validation_passed": true
    }
  ]
}
```

## Health Metrics

For production monitoring of the skill system itself:

| Metric | Source | Alert Threshold |
|--------|--------|-----------------|
| Pipeline success rate | Orchestrator | < 95% over 100 runs |
| Avg execution time per skill | Per-skill metrics | > 2x baseline |
| Validation failure rate | Schema validator | > 5% |
| Feedback loop frequency | Orchestrator | > 2 per pipeline |
| Token budget utilization | Session context | > 80% of budget |
| HITL gate timeout rate | Orchestrator | > 10% |

## Metrics Collection Points

```
[Skill Start] → record: timestamp, tokens_in
    ↓
[Skill Execution]
    ↓
[Skill Complete] → record: timestamp, tokens_out, duration_ms, items_produced
    ↓
[Validation]     → record: validation_passed, issues_found
    ↓
[Gate Check]     → record: gate_type, outcome, duration_s
    ↓
[Pipeline End]   → aggregate all, compute summary
```

## Logging Conventions

All execution events use a structured log format:

```json
{
  "timestamp": "2026-06-16T10:30:00Z",
  "session_id": "uuid",
  "event": "skill.completed | skill.failed | gate.awaiting | gate.passed | feedback.triggered",
  "skill": "architecture-design",
  "duration_ms": 45000,
  "tokens_delta": 7000,
  "status": "ok | error | halted",
  "details": {}
}
```

Log levels: `DEBUG` (per-step trace), `INFO` (skill start/complete, gate decisions), `WARN` (retries, validation warnings, high token usage), `ERROR` (skill failures, validation errors, pipeline halts).

## Token Optimization for Metrics

- Metrics are always compressed (minified JSON, no whitespace).
- Per-skill metrics are pruned from `session_context` after pipeline completion (keep only aggregate).
- Logs older than 7 days are archived.
- `details` field in logs is omitted for `INFO` events (present only for `WARN` and `ERROR`).

# Monitoring — Observability & Metrics

**Version:** 1.0.0 | **Last updated:** 2026-06-16

## Observability Model

Every component emits structured metrics. Metrics are collected at three levels:

```
Skill Level: tokens_in, tokens_out, duration_ms, items_produced, version
Pipeline Level: aggregated per-skill metrics, total duration, validation results, gate outcomes
System Level: success rate, error rate, token usage trends, cost tracking
```

## Per-Skill Metrics

Every skill output includes a `metrics` object:

| Field | Type | Description |
|-------|------|-------------|
| `tokens_in` | integer | Input token count |
| `tokens_out` | integer | Output token count |
| `duration_ms` | integer | Execution time |
| `items_produced` | integer | Primary output items count |
| `version` | string | Skill version |

Domain-specific metrics are additional (e.g., `critical`, `high`, `medium`, `low` counts in security-review).

## Pipeline-Level Metrics

The orchestrator aggregates into:

| Metric | Source | Description |
|--------|--------|-------------|
| `total_tokens_in` | Sum of all skill inputs | Total tokens consumed |
| `total_tokens_out` | Sum of all skill outputs | Total tokens produced |
| `total_duration_ms` | Wall clock time | Full pipeline duration |
| `skills_executed` | Count | Number of skills run |
| `skills_failed` | Count | Failed executions |
| `validation_errors` | Count | Schema validation failures |
| `feedback_loops` | Count | Feedback iterations triggered |
| `gates_passed/halted` | Count | HITL gate outcomes |
| `retries` | Count | Total retries across all skills |
| `compression_savings_tokens` | Estimate | Tokens saved by compression |

## Health Metrics

| Metric | Source | Alert Threshold | Action |
|--------|--------|----------------|--------|
| Pipeline success rate | Orchestrator | < 95% over 100 runs | Investigate failures |
| Avg skill duration | Per-skill metrics | > 2x baseline | Profile skill |
| Validation failure rate | Schema validator | > 5% | Review schema changes |
| Feedback loop frequency | Orchestrator | > 2 per pipeline | Review skill boundaries |
| Token budget utilization | Session context | > 80% | Optimize compression |
| HITL gate timeout rate | Orchestrator | > 10% | Review gate configuration |

## Logging

All execution events use structured JSON logging:

```json
{
  "timestamp": "2026-06-16T10:30:00Z",
  "session_id": "uuid",
  "event": "skill.completed",
  "skill": "architecture-design",
  "duration_ms": 45000,
  "tokens_delta": 7000,
  "status": "ok",
  "details": {}
}
```

| Log Level | Use Case |
|-----------|----------|
| `DEBUG` | Per-step execution trace |
| `INFO` | Skill start/complete, gate decisions |
| `WARN` | Retries, validation warnings, high token usage |
| `ERROR` | Skill failures, validation errors, pipeline halts |

## Cost Tracking

| Metric | Calculation | Tracking |
|--------|-------------|----------|
| Token cost (input) | `tokens_in × cost_per_token` | Per session |
| Token cost (output) | `tokens_out × cost_per_token` | Per session |
| Total cost per pipeline | Sum of all skill costs | Per pipeline |
| Cost trend | Moving average over 7 days | Dashboard |

## Metrics Storage

- Session metrics: stored in `session_context.metadata` during active session.
- Pipeline metrics: appended to execution log after completion.
- Historical metrics: aggregated daily, retained for 90 days.
- Cost metrics: logged per session, aggregated monthly for billing.

## Monitoring Change Rules

- Adding a new metric requires updating this file AND `skills/governance/observability.md`.
- Changing alert thresholds requires updating this file.
- New health metrics require updating the alerting system configuration.

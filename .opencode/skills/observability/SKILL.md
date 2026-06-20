---
name: observability
version: 1.1.0
domain: system
description: 'Use when adding metrics collection, monitoring, or observability to skills or the orchestrator pipeline. Triggers on: "add metrics", "monitor skills", "observability", "track execution", "how do I measure", "pipeline metrics", "execution monitoring". Do NOT use for application-level monitoring of deployed software — this skill monitors the skill pipeline itself.'
author: ASE-OS
---

# Observability

**Version:** 1.1.0 | **Last updated:** 2026-06-18

Standardized metrics collection, aggregation, threshold alerting, and health status reporting for the skill execution pipeline. Every skill emits a `metrics` object; this skill consumes those events, maintains a running pipeline aggregate, checks alert thresholds, and surfaces health alerts to the orchestrator.

---

## 1. Skill Header

```yaml
name: observability
version: 1.1.0
domain: system
description: >
  Use when adding metrics collection, monitoring, or observability to skills or
  the orchestrator pipeline. Triggers on: "add metrics", "monitor skills",
  "observability", "track execution", "how do I measure", "pipeline metrics",
  "execution monitoring".
  Do NOT use for application-level monitoring of deployed software.
author: ASE-OS
```

---

## 2. Purpose

`observability` acts as the metrics sink and aggregator for the skill pipeline. It is invoked by the **orchestrator** at four defined collection points during every pipeline run:

1. **Skill start** — records timestamp and input token count
2. **Skill complete** — records duration, output tokens, items produced
3. **Gate event** — records gate type, verdict, and wait duration
4. **Pipeline end** — aggregates all per-skill metrics into a pipeline summary with health assessment

The skill also defines the **canonical metrics schema** that every other skill MUST implement in its `metrics` output field. Compliance with this schema is enforced by `schema-validator` (SKL-009).

---

## 3. Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `skill_name` | `string` | Yes | Name of the skill reporting metrics |
| `execution_event` | `string` | Yes | Event type: `skill.started`, `skill.completed`, `skill.failed`, `gate.passed`, `gate.blocked`, `feedback.triggered`, `pipeline.ended` |
| `metrics_data` | `object` | Yes | The metrics payload for this event (schema depends on `execution_event`) |
| `session_id` | `string` | Yes | Session UUID for correlation across events |
| `pipeline_phase` | `string` | No | Current pipeline phase (e.g., `phase-2-architecture`, `phase-7b-guards`) |
| `aggregate_so_far` | `object` | No | Running aggregate from prior collection points (state-manager snapshot) |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["skill_name", "execution_event", "metrics_data", "session_id"],
  "properties": {
    "skill_name": { "type": "string", "minLength": 1 },
    "execution_event": {
      "type": "string",
      "enum": ["skill.started","skill.completed","skill.failed",
               "gate.passed","gate.blocked","feedback.triggered","pipeline.ended"]
    },
    "metrics_data": {
      "type": "object",
      "description": "Event-specific payload — see Metrics Data Schemas below"
    },
    "session_id": { "type": "string", "format": "uuid" },
    "pipeline_phase": { "type": "string" },
    "aggregate_so_far": { "type": "object" }
  }
}
```

### Metrics Data Schemas (per event type)

```json
{
  "skill.started": {
    "required": ["timestamp", "tokens_in"],
    "properties": {
      "timestamp": { "type": "string", "format": "date-time" },
      "tokens_in":  { "type": "integer", "minimum": 0 }
    }
  },
  "skill.completed": {
    "required": ["timestamp", "tokens_in", "tokens_out", "duration_ms", "items_produced", "version"],
    "properties": {
      "timestamp":      { "type": "string", "format": "date-time" },
      "tokens_in":      { "type": "integer", "minimum": 0 },
      "tokens_out":     { "type": "integer", "minimum": 0 },
      "duration_ms":    { "type": "integer", "minimum": 0 },
      "items_produced": { "type": "integer", "minimum": 0 },
      "version":        { "type": "string" },
      "retries":        { "type": "integer", "default": 0 },
      "validation_passed": { "type": "boolean" }
    }
  },
  "skill.failed": {
    "required": ["timestamp", "error_type", "retry_count"],
    "properties": {
      "timestamp":   { "type": "string", "format": "date-time" },
      "error_type":  { "type": "string" },
      "retry_count": { "type": "integer", "minimum": 0 },
      "tokens_in":   { "type": "integer" }
    }
  },
  "gate.passed": {
    "required": ["gate_type", "wait_duration_s"],
    "properties": {
      "gate_type":        { "type": "string" },
      "wait_duration_s":  { "type": "integer" },
      "auto_continued":   { "type": "boolean" }
    }
  },
  "gate.blocked": {
    "required": ["gate_type", "block_reason"],
    "properties": {
      "gate_type":    { "type": "string" },
      "block_reason": { "type": "string" },
      "duration_s":   { "type": "integer" }
    }
  },
  "feedback.triggered": {
    "required": ["from_skill", "target_skill", "reason"],
    "properties": {
      "from_skill":   { "type": "string" },
      "target_skill": { "type": "string" },
      "reason":       { "type": "string" },
      "loop_number":  { "type": "integer" }
    }
  },
  "pipeline.ended": {
    "required": ["final_status"],
    "properties": {
      "final_status": { "type": "string", "enum": ["success","partial","failed","halted"] },
      "total_skills":  { "type": "integer" }
    }
  }
}
```

---

## 4. Required Context

- `aggregate_so_far` from `state-manager` (read operation on key `pipeline_metrics`) must be loaded before each call. If absent, initialize a fresh aggregate.
- `session_id` must match the active session in `state-manager.session_context.session_id`.
- `execution_event` must be one of the 7 defined event types — unknown events are rejected.

---

## 5. Execution Logic

```
Step 1 — Validate event and metrics_data
  Verify execution_event is one of 7 known event types.
  Validate metrics_data against the event-specific schema.
  If validation fails: emit warning feedback, return partial metrics_report.
  Output: validated_event, validated_metrics_data

Step 2 — Emit structured log entry
  Construct log entry:
    { timestamp, session_id, event: execution_event, skill: skill_name,
      pipeline_phase, duration_ms (if present), tokens_delta, status, details }
  Log levels:
    skill.started     → INFO
    skill.completed   → INFO  (WARN if duration_ms > 2× baseline or retries > 0)
    skill.failed      → ERROR
    gate.passed       → INFO  (WARN if wait_duration_s > 1800)
    gate.blocked      → WARN
    feedback.triggered → WARN (ERROR if loop_number > 2)
    pipeline.ended    → INFO  (ERROR if final_status == "failed")
  Output: log_entry

Step 3 — Update running aggregate
  Load aggregate_so_far or initialize:
    {
      total_tokens_in: 0, total_tokens_out: 0, total_duration_ms: 0,
      skills_executed: 0, skills_failed: 0, validation_errors: 0,
      feedback_loops: 0, gates_passed: 0, gates_blocked: 0, retries: 0,
      compression_savings_tokens: 0, per_skill: []
    }
  Apply this event's data to the aggregate:
    skill.completed   → increment skills_executed, tokens, duration; add per_skill entry
    skill.failed      → increment skills_failed, retries
    gate.passed       → increment gates_passed
    gate.blocked      → increment gates_blocked
    feedback.triggered → increment feedback_loops
    pipeline.ended    → set final_status, compute summary ratios
  Write updated aggregate to state-manager (key: pipeline_metrics).
  Output: updated_aggregate

Step 4 — Check alert thresholds
  Evaluate each metric against the alert threshold table:
    Pipeline success rate:     < 95% over session → alert_level = "warning"
    Single skill duration:     > 120,000ms (2 min) → alert_level = "warning"
    Validation failure rate:   > 5% of skill runs → alert_level = "warning"
    Feedback loop frequency:   > 2 loops in session → alert_level = "critical"
    Token budget utilization:  > 80% of session budget → alert_level = "warning"
    HITL gate block rate:      > 2 blocks in session → alert_level = "warning"
    Skill retry count:         > 3 retries for one skill → alert_level = "critical"
    Total session duration:    > 1,800,000ms (30 min) → alert_level = "warning"
  Output: alerts (array of { metric, current_value, threshold, alert_level, message })

Step 5 — Compute health_status
  IF any alert has alert_level == "critical":  health_status = "critical"
  ELSE IF any alert has alert_level == "warning": health_status = "degraded"
  ELSE: health_status = "healthy"
  Output: health_status

Step 6 — Assemble and return metrics_report
  Compile:
    aggregate metrics (Step 3 output)
    health_status (Step 5)
    alerts (Step 4)
    log_entry (Step 2)
  Output: complete metrics_report
```

---

## 6. Outputs

| Field | Type | Description |
|-------|------|-------------|
| `metrics_report` | `object` | Aggregated pipeline metrics (tokens, durations, success rates, per-skill breakdown) |
| `health_status` | `string` | `"healthy"` \| `"degraded"` \| `"critical"` |
| `alerts` | `array[object]` | Threshold breach alerts with severity and remediation hint |
| `log_entry` | `object` | Structured log entry for this specific event |
| `metrics` | `object` | This skill's own execution metrics (REQUIRED standard field) |
| `feedback` | `array[object]` | Feedback to orchestrator when critical health status or alerts detected |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["metrics_report", "health_status", "alerts", "log_entry", "metrics", "feedback"],
  "properties": {
    "metrics_report": {
      "type": "object",
      "required": ["total_tokens_in","total_tokens_out","total_duration_ms","skills_executed",
                   "skills_failed","validation_errors","feedback_loops","gates_passed",
                   "gates_blocked","retries","per_skill"],
      "properties": {
        "total_tokens_in":            { "type": "integer" },
        "total_tokens_out":           { "type": "integer" },
        "total_duration_ms":          { "type": "integer" },
        "skills_executed":            { "type": "integer" },
        "skills_failed":              { "type": "integer" },
        "validation_errors":          { "type": "integer" },
        "feedback_loops":             { "type": "integer" },
        "gates_passed":               { "type": "integer" },
        "gates_blocked":              { "type": "integer" },
        "retries":                    { "type": "integer" },
        "compression_savings_tokens": { "type": "integer" },
        "final_status": {
          "type": ["string","null"],
          "enum": ["success","partial","failed","halted",null]
        },
        "per_skill": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["name","status","tokens_in","tokens_out","duration_ms","retries","validation_passed"],
            "properties": {
              "name":               { "type": "string" },
              "status":             { "type": "string", "enum": ["ok","failed","skipped"] },
              "tokens_in":          { "type": "integer" },
              "tokens_out":         { "type": "integer" },
              "duration_ms":        { "type": "integer" },
              "retries":            { "type": "integer" },
              "validation_passed":  { "type": "boolean" },
              "pipeline_phase":     { "type": ["string","null"] }
            }
          }
        }
      }
    },
    "health_status": { "type": "string", "enum": ["healthy","degraded","critical"] },
    "alerts": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["metric","current_value","threshold","alert_level","message"],
        "properties": {
          "metric":         { "type": "string" },
          "current_value":  { "type": ["number","string"] },
          "threshold":      { "type": ["number","string"] },
          "alert_level":    { "type": "string", "enum": ["warning","critical"] },
          "message":        { "type": "string" }
        }
      }
    },
    "log_entry": {
      "type": "object",
      "required": ["timestamp","session_id","event","skill","status"],
      "properties": {
        "timestamp":      { "type": "string", "format": "date-time" },
        "session_id":     { "type": "string" },
        "event":          { "type": "string" },
        "skill":          { "type": "string" },
        "pipeline_phase": { "type": ["string","null"] },
        "duration_ms":    { "type": ["integer","null"] },
        "tokens_delta":   { "type": ["integer","null"] },
        "status":         { "type": "string", "enum": ["ok","error","halted","warning"] },
        "details":        { "type": "object" }
      }
    },
    "metrics":  { "$ref": "#/$defs/metrics" },
    "feedback": { "type": "array", "items": { "$ref": "#/$defs/feedback_entry" } }
  },
  "$defs": {
    "metrics": {
      "type": "object",
      "required": ["tokens_in","tokens_out","duration_ms","items_produced","version"],
      "properties": {
        "tokens_in":      { "type": "integer" },
        "tokens_out":     { "type": "integer" },
        "duration_ms":    { "type": "integer" },
        "items_produced": { "type": "integer" },
        "version":        { "type": "string" }
      }
    },
    "feedback_entry": {
      "type": "object",
      "required": ["type","from_skill","reason"],
      "properties": {
        "type":         { "type": "string", "enum": ["backpropagate","info","warning"] },
        "from_skill":   { "type": "string" },
        "target_skill": { "type": "string" },
        "reason":       { "type": "string" },
        "evidence":     { "type": "object" }
      }
    }
  }
}
```

### Canonical Per-Skill Metrics Schema

Every skill's `metrics` output field MUST conform to this minimum schema:

```json
{
  "tokens_in":      "<integer> — input token count for this invocation",
  "tokens_out":     "<integer> — output token count for this invocation",
  "duration_ms":    "<integer> — wall-clock execution time in milliseconds",
  "items_produced": "<integer> — count of primary output items (requirements, tasks, files, etc.)",
  "version":        "<string>  — semver of the skill that produced this output"
}
```

Domain-specific metrics are **additional** fields beyond these five. Example extensions:

| Skill | Extension Fields |
|-------|-----------------|
| `security-review` | `critical_count`, `high_count`, `medium_count`, `low_count` |
| `clean-code-review` | `issue_count`, `complexity_score` |
| `test-generator` | `tests_generated`, `coverage_estimate_pct` |
| `implementation-completeness-auditor` | `readiness_score`, `gap_count` |

---

## 7. Rules & Constraints

- Every skill in the system MUST include a `metrics` object conforming to the canonical schema in its output.
- This skill is **stateful** within a session — it maintains a running aggregate via `state-manager`.
- `execution_event` must be one of 7 defined types. Unknown events are rejected with a warning.
- `health_status = "critical"` triggers an info feedback entry to the orchestrator.
- Metrics data is **never compressed** — full fidelity is required for threshold checking.
- Aggregate is written to `state-manager` after every event — not batched.
- Log entries older than the active session are not loaded. Historical analysis is out of scope.
- `details` field in log entries is omitted for `INFO` level events (present only for `WARN` and `ERROR`).

---

## 8. Security Considerations

- Metrics payloads MUST NOT contain user data, credentials, or code content — only numeric and string metadata.
- `session_id` must be a UUID — reject any session_id that contains path traversal patterns (`../`, `/etc/`, etc.).
- Log entries are stored in-session only — they are NOT persisted to disk or external systems by this skill.
- `details` field in WARN/ERROR logs must not reproduce full skill output — only error types and field names.

---

## 9. Token Optimization

- Metrics data is always compact JSON (no whitespace, no verbose field names).
- Per-skill entries in `per_skill` are capped at 50 entries. Older entries are rolled up into `{ rolled_up_count: N, total_tokens: X }`.
- `aggregate_so_far` loaded from state-manager is the running state — not recomputed from scratch each call.
- Log entries omit `details` for INFO events — saving ~20–50 tokens per entry.
- `metrics_report.per_skill` returns full detail only for the current event's skill; other skills are summarized.

---

## 10. Quality Checklist

- [ ] `execution_event` is one of the 7 defined event types
- [ ] `metrics_data` validated against event-specific schema
- [ ] Running aggregate correctly updated in state-manager after every event
- [ ] Alert thresholds checked against all 8 defined metrics
- [ ] `health_status` correctly derived from alert severity
- [ ] `log_entry.status` is `"ok"`, `"error"`, `"halted"`, or `"warning"` — no other values
- [ ] `details` field present in log_entry ONLY for WARN/ERROR level
- [ ] `feedback` contains info entry when `health_status == "critical"`
- [ ] Canonical per-skill metrics schema documented and enforced by schema-validator
- [ ] Output is valid JSON matching output schema

---

## 11. Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| `metrics_data` fails event-specific schema validation | Return partial `metrics_report` with warning in `alerts`; do not halt pipeline |
| `state-manager` unavailable for aggregate read/write | Initialize fresh aggregate for this invocation; emit warning feedback to orchestrator |
| `session_id` does not match active session | Reject event; return `health_status: "degraded"` and error feedback |
| Unknown `execution_event` type | Reject with warning; return current aggregate unchanged |
| `per_skill` array would exceed 50 entries | Roll up oldest 10 entries; emit info about rollup in feedback |
| `health_status` = "critical" and orchestrator does not respond to feedback | Log at ERROR level; pipeline continues (observability never halts pipeline) |

---

## 12. Human-in-the-Loop Gates

This skill does **not** trigger HITL gates directly. It is a passive metrics sink.

| Gate | Trigger | Behavior |
|------|---------|----------|
| None (direct) | N/A | Observability never pauses the pipeline |
| Indirect: critical health | `health_status: "critical"` | Emits feedback entry type `"warning"` to orchestrator; orchestrator decides whether to surface to user |

The orchestrator MAY present `metrics_report` to the user at the HITL gates (architecture approval, completeness sign-off) as context, but this is orchestrator behavior — not a gate defined by this skill.

---

## 13. Skill Composition

`observability` is invoked by the **orchestrator** at 4 defined collection points. It is not composed by individual skills — individual skills only need to produce a compliant `metrics` object in their output.

```yaml
# Orchestrator collection point invocations (conceptual)
name: orchestrator-observability-hooks
collection_points:
  - event: skill.started
    trigger: before every skill invocation
    input_map:
      skill_name:      "<active_skill_name>"
      execution_event: "skill.started"
      metrics_data:    { timestamp: "<now>", tokens_in: "<estimated_tokens_in>" }
      session_id:      "session_context.session_id"
      pipeline_phase:  "current_phase"

  - event: skill.completed
    trigger: after every successful skill invocation
    input_map:
      skill_name:      "<active_skill_name>"
      execution_event: "skill.completed"
      metrics_data:    "<skill_output.metrics>"
      session_id:      "session_context.session_id"
      pipeline_phase:  "current_phase"
      aggregate_so_far: "state_manager.read(pipeline_metrics)"

  - event: gate.passed / gate.blocked
    trigger: after every HITL gate decision
    input_map:
      skill_name:      "<gate_owning_skill>"
      execution_event: "gate.passed OR gate.blocked"
      metrics_data:    { gate_type: "<gate_name>", wait_duration_s: "<elapsed>" }
      session_id:      "session_context.session_id"

  - event: pipeline.ended
    trigger: on pipeline completion (success, failure, or halt)
    input_map:
      skill_name:      "orchestrator"
      execution_event: "pipeline.ended"
      metrics_data:    { final_status: "<status>", total_skills: "<count>" }
      session_id:      "session_context.session_id"
      aggregate_so_far: "state_manager.read(pipeline_metrics)"
```

### Alert Threshold Reference

| Metric | Warning Threshold | Critical Threshold |
|--------|-------------------|-------------------|
| Single skill duration | > 120,000ms | > 240,000ms |
| Session token budget utilization | > 80% | > 95% |
| Validation failure rate | > 5% of runs | > 20% of runs |
| Feedback loop count | > 2 loops | > 3 loops |
| HITL gate block count | > 2 blocks | > 4 blocks |
| Skill retry count (single skill) | > 2 retries | > 3 retries |
| Total session duration | > 30 min | > 60 min |
| Skills failed / skills executed | > 10% | > 25% |

### Changelog

| Version | Date | Change |
|---------|------|--------|
| 1.1.0 | 2026-06-18 | Full 13-section rebuild from 108-line stub. Added input/output schemas, 7-event execution logic, 8-metric alert threshold table, health_status computation, state-manager integration, and orchestrator composition spec |
| 1.0.0 | 2026-06-16 | Initial reference document (108 lines, pre-standardization) |

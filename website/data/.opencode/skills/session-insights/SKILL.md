---
name: session-insights
version: 1.1.0
domain: system
description: 'Use when generating per-skill performance insights from collected behavioral telemetry. Triggers on: "session insights", "skill performance report", "analyze telemetry", "pipeline performance", "HITL rejection ratio", "latency p95". Requires behavioral-telemetry-collector (SKL-047) to have run first. Read-only — does not modify behavioral_telemetry.events.'
author: ASE-OS
---

# Session Insights

**Version:** 1.1.0 | **Last updated:** 2026-06-24

Analyzes the anonymized behavioral telemetry events collected by `behavioral-telemetry-collector` (SKL-047) and produces a structured performance report: per-skill invocation counts, success/failure rates, HITL approval/rejection ratios, and latency p95. Writes the aggregated `session_summary` back to system state for consumption by `enhancement-dashboard` (SKL-049).

---

## 1. Skill Header

```yaml
name: session-insights
version: 1.1.0
domain: system
description: >
  Aggregates behavioral telemetry events into per-skill performance metrics.
  Requires SKL-047 telemetry data. Read-only on events — writes only to
  behavioral_telemetry.session_summary.
author: ASE-OS
```

---

## 2. Purpose

`session-insights` is the analysis layer of the lightweight observability pipeline:

```
behavioral-telemetry-collector (SKL-047)
              │ writes events
              ▼
  behavioral_telemetry.events  (state-manager)
              │ reads events
              ▼
    session-insights (SKL-048)   ← this skill
              │ writes session_summary
              ▼
  behavioral_telemetry.session_summary (state-manager)
              │ reads summary
              ▼
  enhancement-dashboard (SKL-049)
```

It is invoked once per pipeline session — typically at `pipeline.ended` — and produces:

- **Per-skill performance table** — invocation count, success rate, failure rate, p95 latency, HITL rejection ratio per skill
- **Session-level aggregates** — total skills invoked, total HITL gates, overall approval rate, pipeline success flag
- **Anomaly flags** — skills with unusually high failure rates or HITL rejection ratios

This skill is **read-only on the events array**. It only writes to `behavioral_telemetry.session_summary`.

---

## 3. Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `telemetry_events` | `array` | Yes | The full `behavioral_telemetry.events` array from state-manager |
| `session_id` | `string` | Yes | UUID v4 — used to verify all events belong to this session |
| `pipeline_final_status` | `string` | No | Final pipeline outcome: `success`, `partial`, `failed`, `halted` |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["telemetry_events", "session_id"],
  "additionalProperties": false,
  "properties": {
    "telemetry_events": {
      "type": "array",
      "description": "Full behavioral_telemetry.events from state-manager.",
      "items": { "type": "object" }
    },
    "session_id": { "type": "string", "format": "uuid" },
    "pipeline_final_status": {
      "type": "string",
      "enum": ["success", "partial", "failed", "halted"]
    }
  }
}
```

---

## 4. Required Context

- `telemetry_events` must be loaded via `state-manager.read(scope: "behavioral_telemetry")` before invocation. If `behavioral_telemetry` is absent or `opt_out: true`, return empty summary with `skipped: true`.
- All events must have `session_id` matching the active session — mismatched events are filtered out before analysis (not an error).
- If `telemetry_events` is empty, return a summary with all zero counts. Do not halt.

---

## 5. Execution Logic

```
Step 1 — Validate and filter inputs
  Verify session_id is a valid UUID v4.
  Filter telemetry_events: keep only events where event.session_id === session_id.
  IF filtered_events is empty:
    Return: { skipped: false, session_summary: <zero-count summary> }
  Output: filtered_events (N events)

Step 2 — Separate events by type
  Partition filtered_events into:
    skill_events:  event_type in [skill.started, skill.completed, skill.failed]
    gate_events:   event_type in [gate.passed, gate.blocked]
    feedback_events: event_type == feedback.triggered
  Output: partitioned_events

Step 3 — Compute per-skill metrics
  For each unique skill_name in skill_events:
    invocation_count   = count(skill_completed events for this skill)
                         + count(skill_failed events for this skill)
    success_count      = count(outcome == "success" for this skill)
    failure_count      = count(outcome == "failure" OR event_type == skill.failed)
    success_rate       = success_count / invocation_count (0 if invocation_count == 0)
    failure_rate       = failure_count / invocation_count (0 if invocation_count == 0)

    duration_samples   = [event.duration_ms for events where duration_ms present]
    p95_duration_ms    = percentile(duration_samples, 0.95) if len >= 5, else median if len >= 2, else single value or null

    gate_events_for_skill = gate_events where skill_name matches
    hitl_gate_count    = count(gate_events_for_skill)
    hitl_rejection_count = count(hitl_verdict == "rejected" in gate_events_for_skill)
    hitl_rejection_ratio = hitl_rejection_count / hitl_gate_count (null if hitl_gate_count == 0)

    anomaly_flags:
      high_failure_rate    = failure_rate > 0.3
      high_rejection_ratio = hitl_rejection_ratio > 0.3 (when not null)

  Output: per_skill_metrics[] (one entry per unique skill)

Step 4 — Compute session-level aggregates
  total_skills_invoked  = count of unique skill names with invocation_count > 0
  total_hitl_gates      = count(gate_events)
  total_hitl_approvals  = count(hitl_verdict == "approved" in gate_events)
  total_hitl_rejections = count(hitl_verdict == "rejected" in gate_events)
  hitl_approval_rate    = total_hitl_approvals /
                          (total_hitl_approvals + total_hitl_rejections)
                          (null if total_hitl_gates == 0)
  pipeline_success      = (pipeline_final_status == "success") if provided, else null
  feedback_loop_count   = count(feedback_events)

  Gap metrics (from capability_gap events):
  capability_gap_events = filtered_events where event_type == "capability_gap"
  total_capability_gaps = count(capability_gap_events)
  top_gap_domains       = top 3 gap_domain values by count ([] if none)
  gap_ids               = [event.gap_id for event in capability_gap_events where gap_id present]

  Output: session_aggregates

Step 5 — Build session_summary object
  session_summary = {
    generated_at:          <now>,
    total_skills_invoked:  session_aggregates.total_skills_invoked,
    total_hitl_gates:      session_aggregates.total_hitl_gates,
    hitl_approval_rate:    session_aggregates.hitl_approval_rate,
    pipeline_success:      session_aggregates.pipeline_success,
    feedback_loop_count:   session_aggregates.feedback_loop_count,
    total_capability_gaps: session_aggregates.total_capability_gaps,
    top_gap_domains:       session_aggregates.top_gap_domains,
    gap_ids:               session_aggregates.gap_ids,
    skill_performance:     per_skill_metrics[],
    anomalies: [
      { skill_name, flag, value }
      for each skill with high_failure_rate or high_rejection_ratio
    ]
  }
  Output: session_summary

Step 6 — Write session_summary to state-manager
  Read current behavioral_telemetry state.
  Set behavioral_telemetry.session_summary = session_summary.
  Write updated state (scope: "behavioral_telemetry").
  Output: write_confirmed = true

Step 7 — Return result
  Return: { skipped: false, session_summary, skills_analyzed: N, anomaly_count: M }
```

---

## 6. Outputs

| Field | Type | Description |
|-------|------|-------------|
| `skipped` | `boolean` | `true` if opt-out was set or no telemetry events exist |
| `session_summary` | `object` | The full aggregated performance summary (also written to state) |
| `skills_analyzed` | `integer` | Number of unique skills included in the analysis |
| `anomaly_count` | `integer` | Number of anomaly flags raised (high failure / rejection rate) |
| `metrics` | `object` | This skill's own execution metrics (REQUIRED standard field) |
| `feedback` | `array[object]` | Feedback to orchestrator when anomalies detected |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["skipped", "session_summary", "skills_analyzed", "anomaly_count", "metrics", "feedback"],
  "properties": {
    "skipped":         { "type": "boolean" },
    "skills_analyzed": { "type": "integer", "minimum": 0 },
    "anomaly_count":   { "type": "integer", "minimum": 0 },
    "session_summary": {
      "type": "object",
      "required": ["generated_at", "total_skills_invoked", "total_hitl_gates", "skill_performance"],
      "properties": {
        "generated_at":         { "type": "string", "format": "date-time" },
        "total_skills_invoked": { "type": "integer" },
        "total_hitl_gates":     { "type": "integer" },
        "hitl_approval_rate":   { "type": ["number", "null"], "minimum": 0, "maximum": 1 },
        "pipeline_success":     { "type": ["boolean", "null"] },
        "feedback_loop_count":  { "type": "integer" },
        "total_capability_gaps": { "type": "integer", "minimum": 0, "description": "Count of capability_gap events in this session (FEATURE-001)." },
        "top_gap_domains":      { "type": "array", "items": { "type": "string" }, "maxItems": 3, "description": "Top 3 detected_domain values by frequency (FEATURE-001)." },
        "gap_ids":              { "type": "array", "items": { "type": "string" }, "description": "UUID list of all gap_id values from capability_gap events (FEATURE-001)." },
        "skill_performance": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["skill_name", "invocation_count", "success_rate"],
            "properties": {
              "skill_name":             { "type": "string" },
              "invocation_count":       { "type": "integer" },
              "success_rate":           { "type": "number", "minimum": 0, "maximum": 1 },
              "failure_rate":           { "type": "number", "minimum": 0, "maximum": 1 },
              "p95_duration_ms":        { "type": ["integer", "null"] },
              "hitl_rejection_ratio":   { "type": ["number", "null"] },
              "anomaly_flags": {
                "type": "object",
                "properties": {
                  "high_failure_rate":    { "type": "boolean" },
                  "high_rejection_ratio": { "type": "boolean" }
                }
              }
            }
          }
        },
        "anomalies": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "skill_name": { "type": "string" },
              "flag":       { "type": "string" },
              "value":      { "type": "number" }
            }
          }
        }
      }
    },
    "metrics":  { "$ref": "#/$defs/metrics" },
    "feedback": { "type": "array", "items": { "$ref": "#/$defs/feedback_entry" } }
  },
  "$defs": {
    "metrics": {
      "type": "object",
      "required": ["tokens_in", "tokens_out", "duration_ms", "items_produced", "version"],
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
      "required": ["type", "from_skill", "reason"],
      "properties": {
        "type":         { "type": "string", "enum": ["backpropagate", "info", "warning"] },
        "from_skill":   { "type": "string" },
        "target_skill": { "type": "string" },
        "reason":       { "type": "string" },
        "evidence":     { "type": "object" }
      }
    }
  }
}
```

---

## 7. Rules & Constraints

- **Opt-out check propagated**: if `behavioral_telemetry.opt_out === true` in state, return `{ skipped: true }` immediately.
- **Read-only on events array** — this skill NEVER modifies `behavioral_telemetry.events`.
- **Writes only to `session_summary`** within the `behavioral_telemetry` scope.
- Events with mismatched `session_id` are silently filtered out — not an error.
- p95 latency requires a minimum of 5 samples; fewer samples degrade gracefully (median → single value → null).
- Anomaly flags (`high_failure_rate`, `high_rejection_ratio`) use a threshold of 0.30 (30%).
- Anomaly flags generate a `warning` feedback entry to the orchestrator (not a pipeline halt).
- Empty `telemetry_events` returns a zero-count summary — not an error.
- This skill does NOT modify registry, routing table, or any governance configuration.

---

## 8. Security Considerations

- Reads only from `behavioral_telemetry` scope — cannot access any other state key.
- Events were PII-scrubbed by SKL-047 before storage — this skill trusts that scrubbing occurred (`pii_scrubbed: true` flag).
- Aggregation output contains only numeric/enum values — no raw event field values.
- `session_id` is validated as UUID v4 before use.
- The `session_summary` written to state contains only aggregated statistics — no individual event data is reproduced.

---

## 9. Token Optimization

- Telemetry events are compact (7 fields max each) — reading 500 events costs ~3–4K tokens.
- Per-skill aggregation is computed in a single pass — no repeated state reads.
- `session_summary` output is compact: ~20–50 tokens per skill entry.
- Anomaly detection is a simple threshold check — no expensive computation.

---

## 10. Quality Checklist

- [ ] Opt-out check applied before any computation
- [ ] Only events with matching session_id used in analysis
- [ ] `behavioral_telemetry.events` not modified (read-only)
- [ ] p95 degrades gracefully below 5-sample minimum
- [ ] Anomaly threshold: failure_rate > 0.30, rejection_ratio > 0.30
- [ ] Anomaly feedback entries emitted for each flagged skill
- [ ] session_summary written to `behavioral_telemetry.session_summary` only
- [ ] `skills_analyzed` matches count of unique skills in skill_performance
- [ ] Metrics standard fields all present
- [ ] Output is valid JSON matching output schema

---

## 11. Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| `opt_out: true` | Return `{ skipped: true }` immediately |
| `telemetry_events` is empty | Return zero-count summary, `skills_analyzed: 0`, `anomaly_count: 0` |
| All events have mismatched session_id | Return zero-count summary with info feedback |
| state-manager write fails for session_summary | Return result with `session_summary` in output only; emit warning feedback |
| p95 insufficient samples (< 5) | Degrade: median if ≥2, single value if 1, null if 0 |
| Anomaly detected | Emit `warning` feedback to orchestrator; do NOT halt pipeline |

---

## 12. Human-in-the-Loop Gates

This skill does **not** trigger HITL gates. It is an async analysis skill.

| Gate | Trigger | Behavior |
|------|---------|----------|
| None (direct) | N/A | Never pauses the pipeline |
| Indirect: anomaly warning | Anomaly flag raised | Emits `warning` feedback; orchestrator decides whether to surface to user |

---

## 13. Skill Composition

`session-insights` is invoked by the orchestrator at `pipeline.ended`. It runs asynchronously after the pipeline completes — it does not block any pipeline gate.

```yaml
# Orchestrator invocation at pipeline end (conceptual)
name: insights-pipeline-hook
trigger: pipeline.ended
async: true
input_map:
  telemetry_events:      "state_manager.read(behavioral_telemetry).events"
  session_id:            "session_context.session_id"
  pipeline_final_status: "pipeline_state.final_status"

produces_for:
  - enhancement-dashboard (SKL-049)  # reads from behavioral_telemetry.session_summary
```

### Changelog

| Version | Date | Change |
|---------|------|--------|
| 1.1.0 | 2026-06-24 | FEATURE-001: Added gap metrics — `total_capability_gaps`, `top_gap_domains`, `gap_ids` — to session_summary output |
| 1.0.0 | 2026-06-20 | Initial version — per-skill invocation/success/failure/p95/HITL metrics, session aggregates, anomaly flags, state-manager integration |

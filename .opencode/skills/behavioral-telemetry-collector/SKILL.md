---
name: behavioral-telemetry-collector
version: 1.1.0
domain: system
description: 'Use when collecting anonymized behavioral telemetry from pipeline sessions for later insight generation. Triggers on: "collect telemetry", "record session events", "behavioral telemetry", "pipeline behavior tracking". Always checks opt-out flag first — if set, exits immediately without collecting any data. Never collects PII, user inputs, code content, or credentials.'
author: ASE-OS
---

# Behavioral Telemetry Collector

**Version:** 1.1.0 | **Last updated:** 2026-06-24

Collects anonymized, PII-scrubbed behavioral events from the skill pipeline to enable post-session insight generation. This skill is the entry point of the observability data pipeline: `Orchestrator → BehavioralTelemetryCollector → TelemetryEventQueue → SessionInsights → EnhancementDashboard`.

---

## 1. Skill Header

```yaml
name: behavioral-telemetry-collector
version: 1.1.0
domain: system
description: >
  Anonymized behavioral telemetry sink for the skill pipeline. Checks opt-out
  first — exits immediately if opted out. Runs PII scrubber on all event fields
  before writing to state. Never stores user text, code content, requirements,
  or credentials.
author: ASE-OS
```

---

## 2. Purpose

`behavioral-telemetry-collector` acts as the anonymized data intake for the lightweight observability pipeline. It is invoked by the **orchestrator** at the same 4 collection points as `observability`, but with a narrower, privacy-first scope:

1. **Opt-out gate (Step 1)** — checks `behavioral_telemetry.opt_out` in system state; exits immediately with no data written if `true`.
2. **PII scrub (Step 2)** — strips any string fields that could contain user content before storage.
3. **Event write (Step 3)** — appends the sanitized event record to `behavioral_telemetry.events` in state-manager.

This skill does **not** produce alerts, health status, or aggregations — that is the responsibility of `session-insights` (SKL-048). It is a passive collector only.

**What it collects (enum-bound, numeric, or date-time fields only):**
- `event_type` — one of 7 defined enum values
- `skill_name` — registered skill identifier (string, no user content)
- `timestamp` — ISO 8601 date-time
- `session_id` — UUID
- `duration_ms` — integer
- `outcome` — one of 4 defined enum values
- `hitl_verdict` — one of 4 defined enum values or null
- `pipeline_phase` — phase identifier string

**What it never collects:**
- Requirement text, architecture prose, or feature plan content
- Code snippets, file paths, or content hashes
- User input payloads or session prompts
- Error messages or stack traces
- Credentials, tokens, or API keys

---

## 3. Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `event_type` | `string` | Yes | One of: `skill.started`, `skill.completed`, `skill.failed`, `gate.passed`, `gate.blocked`, `feedback.triggered`, `capability_gap` |
| `skill_name` | `string` | Yes | Registered skill identifier (e.g. `architecture-design`). Use `"orchestrator"` for `capability_gap` events. |
| `session_id` | `string` | Yes | UUID v4 session identifier |
| `pipeline_phase` | `string` | No | Current pipeline phase ID |
| `duration_ms` | `integer` | No | Wall-clock execution time in milliseconds (for `skill.completed` and `skill.failed`) |
| `outcome` | `string` | No | One of: `success`, `failure`, `skipped`, `blocked` |
| `hitl_verdict` | `string\|null` | No | One of: `approved`, `rejected`, `modified`, `timeout`, `null` (for gate events only) |
| `detected_domain` | `string` | No | For `capability_gap` events only — the classified intent domain (enum-bound). One of: `testing`, `security`, `deployment`, `architecture`, `data`, `frontend`, `mobile`, `embedded`, `skill-management`, `unknown` |
| `gap_id` | `string` | No | For `capability_gap` events only — UUID v4 of the logged gap (from `gap_context.gap_id`) |
| `current_state` | `object` | Yes | Scoped read of `behavioral_telemetry` from state-manager (to check opt_out flag) |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["event_type", "skill_name", "session_id", "current_state"],
  "additionalProperties": false,
  "properties": {
    "event_type": {
      "type": "string",
      "enum": ["skill.started", "skill.completed", "skill.failed",
               "gate.passed", "gate.blocked", "feedback.triggered", "capability_gap"]
    },
    "skill_name":      { "type": "string", "minLength": 1 },
    "session_id":      { "type": "string", "format": "uuid" },
    "pipeline_phase":  { "type": "string" },
    "duration_ms":     { "type": "integer", "minimum": 0 },
    "outcome": {
      "type": "string",
      "enum": ["success", "failure", "skipped", "blocked"]
    },
    "hitl_verdict": {
      "type": ["string", "null"],
      "enum": ["approved", "rejected", "modified", "timeout", null]
    },
    "detected_domain": {
      "type": "string",
      "enum": ["testing", "security", "deployment", "architecture", "data", "frontend", "mobile", "embedded", "skill-management", "unknown"],
      "description": "For capability_gap events only."
    },
    "gap_id": {
      "type": "string",
      "format": "uuid",
      "description": "For capability_gap events only."
    },
    "current_state": {
      "type": "object",
      "description": "Scoped behavioral_telemetry slice from state-manager. May be null for first event in session."
    }
  }
}
```

---

## 4. Required Context

- `current_state` is a scoped read from state-manager (`scope: "behavioral_telemetry"`). If absent (first event in session), initialize a fresh `behavioral_telemetry` object with `enabled: true`, `opt_out: false`, `pii_scrubbed: false`, `events: []`.
- `session_id` must match the active session — reject any mismatched session_id.
- Opt-out check (Step 1) is the **first and unconditional** step. If `current_state.opt_out === true`, halt immediately without writing any data.

---

## 5. Execution Logic

```
Step 1 — Opt-out gate (UNCONDITIONAL FIRST CHECK)
  Read current_state.opt_out.
  IF opt_out === true:
    Return immediately. Output: { collected: false, reason: "opt_out", events_written: 0 }
    DO NOT proceed to any further step.
  Output: opt_out_cleared = true

Step 2 — Validate event inputs
  Verify event_type is one of 7 known event types.
  Verify session_id is a valid UUID v4.
  Reject path traversal patterns in session_id (../  /etc/  etc.).
  For capability_gap events: verify detected_domain is in the allowed enum; verify gap_id is a valid UUID v4.
  IF validation fails: return { collected: false, reason: "invalid_input", events_written: 0 }
  Output: validated_event

Step 3 — PII scrub
  Apply scrubber to ALL string fields before constructing the event record:
    skill_name: allow (registered identifiers only — no user content)
    pipeline_phase: allow (phase IDs only — no user content)
    event_type: allow (enum)
    session_id: allow (UUID)
    outcome: allow (enum)
    hitl_verdict: allow (enum / null)
    duration_ms: allow (integer)
    timestamp: generated internally — never from input
  Scrubber rules (applied in order):
    1. Replace any value matching credential patterns (Bearer .*, key=.*, password=.*) → "[REDACTED]"
    2. Replace any value matching email patterns → "[REDACTED_EMAIL]"
    3. Replace any value matching path traversal patterns (../, /etc/, /home/) → "[REDACTED_PATH]"
    4. Truncate any string exceeding 128 characters → first 128 chars + "[TRUNCATED]"
  Output: scrubbed_event_fields

Step 4 — Construct anonymized event record
  Build event record:
    {
      event_type:     <validated>,
      skill_name:     <scrubbed>,
      timestamp:      <now — generated internally>,
      session_id:     <validated UUID>,
      duration_ms:    <integer or omitted>,
      outcome:        <enum or omitted>,
      hitl_verdict:   <enum/null or omitted>,
      pipeline_phase: <scrubbed or omitted>
    }
  For capability_gap events, also include (never omit if present):
    {
      gap_domain:     <detected_domain enum value — not user text>,
      gap_id:         <validated UUID>
    }
  Deduplication: capability_gap events with identical (session_id, gap_id) are silently dropped.
  Output: anonymized_event

Step 5 — Initialize or load current behavioral_telemetry state
  IF current_state is null or missing:
    Initialize: {
      enabled: true,
      opt_out: false,
      pii_scrubbed: true,
      events: [],
      last_collection_at: <now>
    }
  ELSE:
    Load current events array (may be empty).
  Output: telemetry_state

Step 6 — Append event and write to state-manager
  Append anonymized_event to telemetry_state.events.
  Update telemetry_state.last_collection_at = <now>.
  Set telemetry_state.pii_scrubbed = true.
  Cap events array at 500 entries (drop oldest if exceeded — ring buffer behavior).
  Write updated telemetry_state to state-manager (scope: "behavioral_telemetry").
  Output: events_written = 1

Step 7 — Return result
  Return:
    { collected: true, events_written: 1, total_events: len(telemetry_state.events) }
```

---

## 6. Outputs

| Field | Type | Description |
|-------|------|-------------|
| `collected` | `boolean` | Whether an event was successfully collected (`false` if opted out or validation failed) |
| `events_written` | `integer` | Number of events written (0 or 1) |
| `total_events` | `integer` | Total events in the current session's telemetry buffer |
| `reason` | `string` | Present only when `collected: false` — reason for non-collection (`opt_out`, `invalid_input`, `state_error`) |
| `metrics` | `object` | This skill's own execution metrics (REQUIRED standard field) |
| `feedback` | `array[object]` | Feedback to orchestrator (empty unless error) |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["collected", "events_written", "metrics", "feedback"],
  "properties": {
    "collected":     { "type": "boolean" },
    "events_written": { "type": "integer", "minimum": 0 },
    "total_events":  { "type": "integer", "minimum": 0 },
    "reason": {
      "type": "string",
      "enum": ["opt_out", "invalid_input", "state_error"]
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

- **Opt-out is the first and unconditional check.** No data is collected, no state is written, and no event is logged if `opt_out === true`.
- **PII scrubber runs on every event.** No bypass is allowed — `pii_scrubbed` is always `true` in written state.
- **Events array is capped at 500 entries** (ring buffer — oldest dropped when cap is reached).
- **This skill never reads user input payloads.** Input fields are limited to the schema above.
- **session_id must be a valid UUID v4.** Path traversal patterns are rejected.
- **This skill does not produce alerts or health status.** It is a passive collector only.
- **This skill does not modify any other state-manager key.** Scope: `behavioral_telemetry` only.
- **Timestamps are generated internally** — not taken from caller input to prevent timestamp injection.

---

## 8. Security Considerations

- Opt-out flag is checked unconditionally first — no data is ever written for opted-out projects.
- All string fields pass through the PII scrubber before storage.
- `session_id` is validated as UUID v4 and checked for path traversal patterns before use.
- The events array stores only enum-bound and numeric fields — no free-text user content.
- Credential patterns (`Bearer`, `key=`, `password=`, `token=`) are redacted even in allowed fields.
- State write is scoped to `behavioral_telemetry` only — cannot overwrite any other system state key.
- Events older than the active session are not accessible to this skill.

---

## 9. Token Optimization

- This skill produces minimal output — only 3 scalar fields plus standard `metrics` and `feedback`.
- The event record written to state is compact JSON (7 fields maximum).
- State read (`current_state`) is scoped to `behavioral_telemetry` only — not a full state load.
- PII scrubber operates on a fixed small field set — no full-text parsing.
- Ring buffer cap (500 events) prevents unbounded state growth.

---

## 10. Quality Checklist

- [ ] Opt-out flag checked unconditionally before any data collection
- [ ] PII scrubber applied to all string fields before event construction
- [ ] session_id validated as UUID v4 with path traversal check
- [ ] Event `timestamp` generated internally (not from input)
- [ ] Events array capped at 500 entries (ring buffer)
- [ ] State write scoped to `behavioral_telemetry` key only
- [ ] `collected: false` returned immediately on opt-out — no partial writes
- [ ] Metrics fields `tokens_in`, `tokens_out`, `duration_ms`, `items_produced`, `version` all present
- [ ] `feedback` array present (may be empty)
- [ ] Output is valid JSON matching output schema

---

## 11. Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| `opt_out === true` | Return `{ collected: false, reason: "opt_out" }` immediately |
| `event_type` not in enum | Return `{ collected: false, reason: "invalid_input" }` |
| `session_id` invalid or contains path traversal | Return `{ collected: false, reason: "invalid_input" }` |
| state-manager write fails | Return `{ collected: false, reason: "state_error" }`; emit warning feedback to orchestrator |
| Events array at 500 cap | Drop oldest event, append new event; emit info feedback |
| PII scrubber detects credential pattern | Redact field, continue; log redaction count in metrics |

---

## 12. Human-in-the-Loop Gates

This skill does **not** trigger HITL gates. It is a passive event sink.

| Gate | Trigger | Behavior |
|------|---------|----------|
| None | N/A | No user interaction required |

The `opt_out` flag serves as the project-level consent gate — it is set once in project configuration, not per-invocation.

---

## 13. Skill Composition

`behavioral-telemetry-collector` is invoked by the **orchestrator** at the same 4 collection points as `observability`. It runs as a **fire-and-forget** async skill — it does not block pipeline progression.

```yaml
# Orchestrator behavioral telemetry hook invocations (conceptual)
name: orchestrator-behavioral-telemetry-hooks
collection_points:
  - event: skill.completed
    trigger: after every successful skill invocation
    async: true  # non-blocking
    input_map:
      event_type:     "skill.completed"
      skill_name:     "<active_skill_name>"
      session_id:     "session_context.session_id"
      pipeline_phase: "current_phase"
      duration_ms:    "<skill_output.metrics.duration_ms>"
      outcome:        "success"
      current_state:  "state_manager.read(behavioral_telemetry)"

  - event: skill.failed
    trigger: after every failed skill invocation
    async: true
    input_map:
      event_type: "skill.failed"
      skill_name: "<active_skill_name>"
      outcome:    "failure"
      duration_ms: "<elapsed_ms>"
      session_id: "session_context.session_id"
      current_state: "state_manager.read(behavioral_telemetry)"

  - event: gate.passed / gate.blocked
    trigger: after every HITL gate decision
    async: true
    input_map:
      event_type:   "gate.passed OR gate.blocked"
      skill_name:   "<gate_owning_skill>"
      hitl_verdict: "<verdict>"
      session_id:   "session_context.session_id"
      current_state: "state_manager.read(behavioral_telemetry)"
```

### Changelog

| Version | Date | Change |
|---------|------|--------|
| 1.1.0 | 2026-06-24 | FEATURE-001: Added `capability_gap` event type; added `detected_domain` + `gap_id` input fields; dedup rule for (session_id, gap_id) pairs |
| 1.0.0 | 2026-06-20 | Initial version — opt-out gate, PII scrubber, ring-buffer event collection, state-manager integration |

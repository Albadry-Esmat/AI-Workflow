---
name: event-router
version: 1.0.0
domain: orchestration
description: 'Use when routing system events to their downstream skill handlers, building event-to-skill dispatch maps, or preventing duplicate event processing. Triggers on: "route this event", "event dispatch", "what skill handles this event", "event-driven execution", "trigger skill from event".'
author: system
---

## Purpose

Maintain the canonical event-to-skill dispatch map and route every system event to the correct downstream skill(s). The event-router sits between the orchestrator's event bus and the skill executor — it prevents raw events from bypassing the pipeline, deduplicates concurrent identical events, enforces the system's event schema, and ensures every event is processed by exactly the skills that need it, no more and no less.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `operation` | `string` | Yes | `route`, `register`, `query`, or `replay` |
| `event` | `object` | No | The event payload to route. Required for `route`. |
| `handler_spec` | `object` | No | Skill handler spec to register. Required for `register`. |
| `event_type` | `string` | No | Event type to query handlers for. Required for `query`. |
| `event_id` | `string` | No | ID of a past event to replay. Required for `replay`. |
| `dispatch_map` | `object` | No | Current dispatch map from system state. Loaded automatically if absent. |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "operation": { "type": "string", "enum": ["route", "register", "query", "replay"] },
    "event": {
      "type": "object",
      "properties": {
        "id": { "type": "string" },
        "type": { "type": "string" },
        "payload": { "type": "object" },
        "source_skill": { "type": "string" },
        "timestamp": { "type": "string", "format": "date-time" },
        "session_id": { "type": "string" }
      },
      "required": ["id", "type", "payload", "source_skill", "timestamp"]
    },
    "handler_spec": {
      "type": "object",
      "properties": {
        "event_type": { "type": "string" },
        "skill": { "type": "string" },
        "priority": { "type": "integer" },
        "filter": { "type": "object" }
      },
      "required": ["event_type", "skill", "priority"]
    },
    "event_type": { "type": "string" },
    "event_id": { "type": "string" },
    "dispatch_map": { "type": "object" }
  },
  "required": ["operation"]
}
```

## Required Context

- Dispatch map from system state (`state-manager` read of `dispatch_map` scope).
- Event log from system state (`state-manager` read of `event_log` scope) for deduplication.

## Execution Logic

```
Step 1 — Validate operation inputs
  route:    Require event with id, type, payload, source_skill, timestamp.
  register: Require handler_spec with event_type, skill, priority.
  query:    Require event_type.
  replay:   Require event_id and event_log in state.
  Output: validated inputs

Step 2 — Load or initialize dispatch map
  Load dispatch_map from system state.
  If absent: initialize with built-in defaults (see § Built-in Dispatch Map).
  Output: dispatch_map

Step 3 — Execute operation

  [route]
    Check event_log for event.id: if already processed, return deduplication response.
    Look up event.type in dispatch_map. If no handler: emit "unhandled_event" warning.
    Apply filters on each handler (payload field matches).
    Sort matched handlers by priority (ascending = highest priority first).
    Build dispatch_list: ordered array of { skill, event_slice, async }.
    Write event.id + timestamp to event_log via state-manager.
    Output: dispatch_list

  [register]
    Validate no duplicate (event_type + skill) exists in dispatch_map.
    Append handler_spec to dispatch_map[event_type].
    Write updated dispatch_map to system state via state-manager.
    Output: updated_dispatch_map

  [query]
    Return all handlers registered for event_type.
    Output: handler_list

  [replay]
    Load event from event_log by event_id.
    Re-execute route operation with that event.
    Output: dispatch_list (same as route)

Step 4 — Assemble output
  Return operation-specific result + metrics + feedback.
```

## Built-in Dispatch Map

The following event-to-skill bindings are registered at initialization:

| Event Type | Skills (in priority order) |
|------------|---------------------------|
| `requirement.created` | requirement-analyzer |
| `requirement.changed` | requirement-analyzer, change-impact-analyzer |
| `architecture.changed` | architecture-design, dependency-analyzer, change-impact-analyzer |
| `code.changed` | clean-code-review, dependency-analyzer, change-impact-analyzer |
| `test.failed` | code-repair |
| `security.finding` | security-review |
| `deployment.requested` | deployment-strategy |
| `skill.registered` | validation-rules, skill-lifecycle |
| `file.written` | doc-maintainer |
| `state.snapshot_requested` | state-manager |
| `context.pressure_high` | context-compressor |
| `defect.created` | orchestrator |
| `defect.resolved` | doc-maintainer |
| `change_request.created` | change-impact-analyzer |
| `change_request.approved` | feature-planning |
| `work_item.state_changed` | doc-maintainer, behavioral-telemetry-collector |

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `dispatch_list` | `array[object]` | Ordered handlers: `{ skill, event_slice, async, priority }` |
| `unhandled` | `boolean` | True if no handler registered for this event type |
| `deduplicated` | `boolean` | True if this event_id was already processed |
| `updated_dispatch_map` | `object` | Updated map (register operation only) |
| `handler_list` | `array[object]` | Handler list for query operation |
| `metrics` | `object` | Execution metrics |
| `feedback` | `array[object]` | Feedback entries |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "dispatch_list": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "skill": { "type": "string" },
          "event_slice": { "type": "object" },
          "async": { "type": "boolean" },
          "priority": { "type": "integer" }
        },
        "required": ["skill", "event_slice", "async", "priority"]
      }
    },
    "unhandled": { "type": "boolean" },
    "deduplicated": { "type": "boolean" },
    "updated_dispatch_map": { "type": "object" },
    "handler_list": { "type": "array" },
    "metrics": { "$ref": "#/$defs/metrics" },
    "feedback": { "type": "array", "items": { "$ref": "#/$defs/feedback_entry" } }
  },
  "required": ["metrics", "feedback"],
  "$defs": {
    "metrics": {
      "type": "object",
      "properties": {
        "tokens_in": { "type": "integer" },
        "tokens_out": { "type": "integer" },
        "duration_ms": { "type": "integer" },
        "items_produced": { "type": "integer" },
        "version": { "type": "string" }
      },
      "required": ["tokens_in", "tokens_out", "duration_ms", "items_produced", "version"]
    },
    "feedback_entry": {
      "type": "object",
      "properties": {
        "type": { "type": "string", "enum": ["backpropagate", "info", "warning"] },
        "from_skill": { "type": "string" },
        "target_skill": { "type": "string" },
        "reason": { "type": "string" },
        "evidence": { "type": "object" }
      },
      "required": ["type", "from_skill", "reason"]
    }
  }
}
```

## Rules & Constraints

- Every event MUST have a unique `id` — route is rejected without it.
- An event type with no registered handler emits a warning but does NOT block execution.
- Deduplication window: 60 seconds. Identical event_id within the window is silently dropped.
- `register` is restricted to orchestrator and skill-authoring — other skills cannot self-register handlers.
- `event_slice` passed to each skill contains only the payload fields that handler declared in its filter.

## Security Considerations

- Event payloads are scrubbed before routing: remove any field matching credential patterns (`password`, `token`, `secret`, `key`, `api_key`).
- `source_skill` must match a registered skill name — unknown sources are rejected.
- The event log is append-only: no skill can delete or modify past events.

## Token Optimization

- For `route` operations, pass only the `event_slice` (filtered payload) to each skill — not the full event.
- For `query` operations, return handler names only — not full dispatch_map.
- Event log entries stored in state contain only `{ id, type, source_skill, timestamp }` — not the full payload.

## Quality Checklist

- [ ] All built-in event types are mapped in dispatch_map at initialization
- [ ] Deduplication check runs before any dispatch
- [ ] Credential scrubbing runs before any routing
- [ ] dispatch_list is ordered by priority (ascending)
- [ ] Unknown source_skill is rejected

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| event.id missing | Reject: `{"error": "MISSING_EVENT_ID"}` |
| event.type has no handler | Emit warning, set `unhandled: true`, continue |
| state-manager unavailable | Route using in-memory dispatch_map (no deduplication), emit warning |
| dispatch_map corrupt | Re-initialize from defaults, emit warning, continue |

## 12. Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Behavior |
|------|---------|---------|----------|
| Unknown event type flood | >10 unhandled events in one session | 600s | Pause, alert orchestrator to review dispatch_map |

## 13. Skill Composition

`event-router` is invoked by `orchestrator` for every event on the bus:

```yaml
composes:
  - skill: event-router
    version: "^1.0.0"
    input_map: { "operation": "route", "event": "bus.current_event" }
    output_map: { "dispatch_list": "execution_plan.next_skills" }
```

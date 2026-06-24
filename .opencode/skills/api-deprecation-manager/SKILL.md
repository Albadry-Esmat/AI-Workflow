---
name: api-deprecation-manager
version: 1.0.0
domain: architecture
description: 'Use when managing API version lifecycle — tracking deprecations, generating migration guides from breaking changes, enforcing sunset timelines, or creating consumer migration work items. Triggers on: "deprecate this API", "API migration guide", "API sunset", "manage API versions", "track API deprecations", "breaking change migration", "API lifecycle". Do NOT use when designing a versioning strategy from scratch — use architecture-design for that.'
author: system
---

## Purpose

Manage the full API version lifecycle within the ASE-OS pipeline. The skill maintains a persistent API registry via `state-manager`, generates step-by-step migration guides when `change-impact-analyzer` detects breaking changes, creates consumer migration work items with sunset-driven priority, detects sunset violations (APIs past their sunset date still active), and provides a deprecation timeline view. It closes the loop between breaking change detection and consumer communication — ensuring API deprecations are never silent.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `operation` | `string` | Yes | Lifecycle operation: `"register"` \| `"deprecate"` \| `"sunset"` \| `"query"` \| `"migration-guide"` |
| `api_spec` | `object` | No | OpenAPI/GraphQL schema or endpoint list — required for `register` and `deprecate` |
| `breaking_changes` | `array[object]` | No | Breaking changes from `change-impact-analyzer` — required for `migration-guide` |
| `api_id` | `string` | No | API identifier to act on — required for `deprecate`, `sunset`, `migration-guide` |
| `sunset_date` | `string` | No | ISO-8601 date (`YYYY-MM-DD`) for planned sunset — required for `deprecate` |
| `consumer_list` | `array[string]` | No | Known consumer service names for this API — used to create migration work items |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "operation": {
      "type": "string",
      "enum": ["register", "deprecate", "sunset", "query", "migration-guide"]
    },
    "api_spec": {
      "type": "object",
      "properties": {
        "api_id":         { "type": "string" },
        "version":        { "type": "string" },
        "endpoints":      { "type": "array" },
        "schema":         { "type": "object" }
      }
    },
    "breaking_changes": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "change_id":    { "type": "string" },
          "type":         { "type": "string" },
          "description":  { "type": "string" },
          "affected_endpoint": { "type": "string" },
          "before":       { "type": "object" },
          "after":        { "type": "object" }
        },
        "required": ["change_id", "type", "description"]
      }
    },
    "api_id":       { "type": "string" },
    "sunset_date":  { "type": "string", "format": "date" },
    "consumer_list": { "type": "array", "items": { "type": "string" } }
  },
  "required": ["operation"]
}
```

## Required Context

- `state-manager@^1.1.0` must be accessible to read/write the `api_deprecation_registry` state key.
- For `migration-guide` operation: `breaking_changes` from `change-impact-analyzer@^1.1.0` is required.
- For `deprecate` and `sunset` operations: `api_id` must exist in the registry (populated by a prior `register` call).
- For `register` operation: `api_spec` must include at minimum `api_id` and `version`.

## Execution Logic

```
Step 1 — Read API registry from state-manager
  Read key: api_deprecation_registry from state-manager
  If key does not exist: initialise as empty array []
  Output: current_registry

Step 2 — Validate operation preconditions
  register:       require api_spec.api_id, api_spec.version
  deprecate:      require api_id, sunset_date; verify api_id in registry with status=current
  sunset:         require api_id; verify api_id in registry with status=deprecated
  query:          no additional requirements
  migration-guide: require api_id, breaking_changes (non-empty)
  If preconditions fail: return error with missing fields list
  Output: validated_operation

Step 3a — Operation: register
  Check for duplicate: api_id + version combination
  If duplicate → return error: DUPLICATE_REGISTRATION
  Create new registry entry:
    api_id:         api_spec.api_id
    version:        api_spec.version
    status:         "current"
    endpoint_count: count(api_spec.endpoints) or 0
    registered_at:  now() ISO-8601
    consumers:      consumer_list or []
    breaking_change_ids: []
  Append to registry
  Write updated registry to state-manager
  Output: created registry entry

Step 3b — Operation: deprecate
  Locate entry by api_id (must have status=current)
  Update:
    status:         "deprecated"
    deprecated_at:  now() ISO-8601
    sunset_date:    input.sunset_date
    consumers:      merge(existing_consumers, consumer_list)
  Create work item stubs for each consumer:
    days_until_sunset = (sunset_date - today).days
    priority = "high" if days_until_sunset < 30 else "medium" if < 90 else "low"
    work_item = {
      type: "TASK",
      title: "Migrate {consumer} from {api_id} before {sunset_date}",
      priority: priority,
      linked_api: api_id,
      deadline: sunset_date
    }
  Write updated registry to state-manager
  Output: updated entry + work_items_created

Step 3c — Operation: sunset
  Locate entry by api_id (must have status=deprecated)
  Check each consumer in registry.consumers for migration completion
  Unmigrated consumers (no completed migration work item) → add to sunset_violations
  Update:
    status: "sunset"
  Write updated registry to state-manager
  If sunset_violations non-empty: emit warning feedback
  Output: sunset entry + sunset_violations list

Step 3d — Operation: query
  Read full registry from state-manager
  Detect sunset violations: entries where sunset_date < today AND status != "sunset"
  Build deprecation_timeline:
    this_month:   entries with sunset_date within 30 days
    next_quarter: entries with sunset_date within 31–90 days
    future:       entries with sunset_date beyond 90 days
  Output: filtered registry + deprecation_timeline + sunset_violations

Step 3e — Operation: migration-guide
  Locate api_id in registry
  For each breaking_change in breaking_changes:
    Classify change type:
      removed_endpoint:        endpoint present in before, absent in after
      changed_parameter:       parameter type or name changed
      changed_response_schema: response field type or name changed
      auth_change:             auth mechanism changed
      removed_field:           field present in before schema, absent in after
    Generate before_after_example:
      before: code snippet demonstrating old API usage (language-neutral pseudocode)
      after:  code snippet demonstrating new API usage
    Generate migration_step:
      action: imperative instruction for consumer developer
      effort: "minutes" (doc-only) | "hours" (code change) | "days" (schema migration)
  Sort migration_steps: auth_changes first, then removed_endpoints, then field changes
  Compute estimated_effort_hours = sum(step effort converted to hours: minutes→0.25, hours→2, days→8)
  Build breaking_changes_summary: group by type with counts
  Output: migration_guide object

Step 4 — Check for breaking change without deprecation (all operations)
  If breaking_changes provided AND api_id NOT in registry with status=deprecated or sunset:
    Emit feedback: breaking_change_without_deprecation to change-impact-analyzer
  Output: feedback entries

Step 5 — Assemble final output
  Combine operation result, work_items_created, sunset_violations, deprecation_timeline, migration_guide
  Compute metrics
  Return complete output
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `api_registry` | `array[object]` | All tracked APIs: `api_id`, `version`, `status`, `registered_at`, `deprecated_at`, `sunset_date`, `consumers`, `successor_api_id` |
| `migration_guide` | `object` | Generated for `operation=migration-guide`: `breaking_changes_summary`, `before_after_examples`, `migration_steps`, `estimated_effort` |
| `work_items_created` | `array[object]` | Work item stubs created for consumer migrations |
| `sunset_violations` | `array[object]` | APIs past their sunset date still active |
| `deprecation_timeline` | `object` | Timeline view grouped by `this_month`, `next_quarter`, `future` |
| `metrics` | `object` | **REQUIRED.** Execution metrics |
| `feedback` | `array[object]` | **REQUIRED.** Feedback loop entries |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "api_registry": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "api_id":             { "type": "string" },
          "version":            { "type": "string" },
          "status":             { "type": "string", "enum": ["current", "deprecated", "sunset"] },
          "endpoint_count":     { "type": "integer" },
          "registered_at":      { "type": "string", "format": "date-time" },
          "deprecated_at":      { "type": "string", "format": "date-time" },
          "sunset_date":        { "type": "string", "format": "date" },
          "successor_api_id":   { "type": "string" },
          "consumers":          { "type": "array", "items": { "type": "string" } },
          "breaking_change_ids":{ "type": "array", "items": { "type": "string" } }
        },
        "required": ["api_id", "version", "status", "registered_at"]
      }
    },
    "migration_guide": {
      "type": "object",
      "properties": {
        "breaking_changes_summary": { "type": "object" },
        "before_after_examples": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "change_id":   { "type": "string" },
              "change_type": { "type": "string" },
              "before":      { "type": "string" },
              "after":       { "type": "string" }
            },
            "required": ["change_id", "before", "after"]
          }
        },
        "migration_steps": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "step":   { "type": "integer" },
              "action": { "type": "string" },
              "effort": { "type": "string", "enum": ["minutes", "hours", "days"] }
            },
            "required": ["step", "action", "effort"]
          }
        },
        "estimated_effort": { "type": "number", "description": "Total estimated hours" }
      }
    },
    "work_items_created": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "title":      { "type": "string" },
          "consumer":   { "type": "string" },
          "priority":   { "type": "string", "enum": ["high", "medium", "low"] },
          "deadline":   { "type": "string", "format": "date" },
          "linked_api": { "type": "string" }
        },
        "required": ["title", "priority", "linked_api"]
      }
    },
    "sunset_violations": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "api_id":      { "type": "string" },
          "sunset_date": { "type": "string" },
          "days_overdue":{ "type": "integer" },
          "consumers":   { "type": "array", "items": { "type": "string" } }
        },
        "required": ["api_id", "sunset_date"]
      }
    },
    "deprecation_timeline": {
      "type": "object",
      "properties": {
        "this_month":   { "type": "array" },
        "next_quarter": { "type": "array" },
        "future":       { "type": "array" }
      }
    },
    "metrics": {
      "type": "object",
      "properties": {
        "tokens_in":          { "type": "integer" },
        "tokens_out":         { "type": "integer" },
        "duration_ms":        { "type": "integer" },
        "items_produced":     { "type": "integer" },
        "version":            { "type": "string" },
        "operation":          { "type": "string" },
        "registry_size":      { "type": "integer" },
        "work_items_created": { "type": "integer" },
        "sunset_violations":  { "type": "integer" }
      },
      "required": ["tokens_in", "tokens_out", "duration_ms", "items_produced", "version"]
    },
    "feedback": {
      "type": "array",
      "items": { "$ref": "#/$defs/feedback_entry" }
    }
  },
  "required": ["api_registry", "work_items_created", "sunset_violations", "metrics", "feedback"],
  "$defs": {
    "feedback_entry": {
      "type": "object",
      "properties": {
        "type":         { "type": "string", "enum": ["backpropagate", "info", "warning"] },
        "from_skill":   { "type": "string" },
        "target_skill": { "type": "string" },
        "reason":       { "type": "string" },
        "evidence":     { "type": "object" }
      },
      "required": ["type", "from_skill", "reason"]
    }
  }
}
```

## Rules & Constraints

- `operation` is required and must be one of the 5 defined values — reject with `INVALID_OPERATION` otherwise.
- `deprecate` requires `api_id` to exist in the registry with `status=current` — reject with `INVALID_STATE_TRANSITION` if already deprecated.
- `sunset` requires `api_id` to exist in the registry with `status=deprecated` — reject with `INVALID_STATE_TRANSITION` if not deprecated.
- The skill MUST NOT delete registry entries — only status transitions are permitted (current → deprecated → sunset).
- Work item stubs are specifications only — the skill does not write to the work-item filesystem; it returns `work_items_created` for the orchestrator to materialise.
- Sunset violations are warnings, not errors — the skill does not block pipeline on sunset violations.
- `migration_guide.migration_steps` must be ordered: authentication changes first, then endpoint removals, then field/schema changes.
- Maximum `breaking_changes` per `migration-guide` operation: 30. Larger sets must be batched.

## Security Considerations

- The API registry stored in state-manager may contain sensitive endpoint information — read/write operations must use only authorised state-manager channels.
- `migration_guide.before_after_examples` must not include actual authentication credentials or API keys in code snippets — use placeholder constants (`YOUR_API_KEY`, `BEARER_TOKEN`).
- `consumer_list` entries are service names only — do not store or log consumer authentication details.
- The skill must not make external HTTP calls to validate API endpoints.

## Token Optimization

- For `query` operation: return `api_registry` summary (api_id, version, status, sunset_date) only — omit consumers and breaking_change_ids unless explicitly requested.
- For `migration-guide`: limit `before_after_examples` to first 10 breaking changes if input exceeds 10.
- Compress `api_spec` to `api_id`, `version`, `endpoint_count` for register operations — strip full schema definitions.
- `deprecation_timeline` returns API IDs and sunset dates only — not full registry entries.

## Quality Checklist

- [ ] `operation` validated against allowed enum before execution
- [ ] Per-operation preconditions verified (api_id exists, status valid for transition)
- [ ] Registry read before write to avoid blind overwrites
- [ ] Work item priorities computed from days-until-sunset formula
- [ ] Migration steps ordered correctly (auth first)
- [ ] `breaking_change_without_deprecation` feedback emitted when applicable
- [ ] No credentials or real API keys in migration guide examples
- [ ] State-manager write confirmed before returning success

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| `operation` missing or invalid | Return error: `{"error": "INVALID_OPERATION", "valid_operations": [...]}` |
| `api_id` not found in registry for deprecate/sunset | Return error: `{"error": "API_NOT_FOUND", "api_id": "..."}` |
| Invalid state transition (e.g., deprecate already deprecated) | Return error: `{"error": "INVALID_STATE_TRANSITION", "current_status": "deprecated"}` |
| `state-manager` unavailable | Return error: `{"error": "STATE_UNAVAILABLE"}`, do NOT write partial state |
| `breaking_changes` empty for migration-guide | Return error: `{"error": "EMPTY_BREAKING_CHANGES"}` |
| `breaking_changes` exceeds 30 items | Process first 30, set `metrics.truncated: true` |

## 12. Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Behavior |
|------|---------|---------|----------|
| Sunset violation detected | `sunset_violations.length > 0` on any query or sunset operation | 3600s | Alert orchestrator; present unmigrated consumer list; require human confirmation before marking API as sunset |
| Breaking change without deprecation | `breaking_change_without_deprecation` feedback emitted | 1800s | Prompt human to initiate deprecation workflow for the API |

## 13. Skill Composition

`api-deprecation-manager` integrates into the breaking change response pipeline:

```yaml
composes:
  - skill: api-deprecation-manager
    version: "^1.0.0"
    input_map:
      operation:        "event.operation"
      api_id:           "change_impact_analyzer.affected_api_id"
      breaking_changes: "change_impact_analyzer.breaking_changes"
      consumer_list:    "state.api_deprecation_registry[api_id].consumers"
    output_map:
      migration_guide:   "state.migration_guides[api_id]"
      work_items_created: "orchestrator.pending_work_items"
```

Consumes from: `change-impact-analyzer@^1.1.0`, `state-manager@^1.1.0`
Produces for: `documentation-generator@^1.0.0`, `deployment-strategy@^1.1.0`

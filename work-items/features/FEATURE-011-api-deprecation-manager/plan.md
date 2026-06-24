# FEATURE-011 — Implementation Plan: API Deprecation Manager

## Target Skills / Artifacts

| Skill / Artifact | Action | Notes |
|---|---|---|
| `.opencode/skills/api-deprecation-manager/SKILL.md` (SKL-071) | Create | New skill — full 13-section spec |
| `skills/registry.json` | Update | Register SKL-071 with domain: architecture, phase: 7 |
| `skills/index.yaml` | Update | Add index entry for api-deprecation-manager |

---

## §1 — Skill Overview

`api-deprecation-manager` manages the full API version lifecycle within the ASE-OS pipeline. It integrates with `state-manager` to maintain a persistent API registry, with `change-impact-analyzer` to receive breaking change signals, and with the work-item system to create consumer migration tracking tasks.

The skill is event-driven: it activates automatically when `change-impact-analyzer` emits a `breaking_change` event for an API, and on-demand for lifecycle management operations.

---

## §2 — API Registry State Schema

The API registry is stored in system state under key `api_deprecation_registry`. Schema:

```json
{
  "api_deprecation_registry": {
    "type": "array",
    "items": {
      "type": "object",
      "properties": {
        "api_id":         { "type": "string", "description": "Unique identifier, e.g. user-service-v2" },
        "version":        { "type": "string", "description": "SemVer string" },
        "status":         { "type": "string", "enum": ["current", "deprecated", "sunset"] },
        "endpoint_count": { "type": "integer" },
        "registered_at":  { "type": "string", "format": "date-time" },
        "deprecated_at":  { "type": "string", "format": "date-time" },
        "sunset_date":    { "type": "string", "format": "date" },
        "successor_api_id": { "type": "string" },
        "consumers":      { "type": "array", "items": { "type": "string" } },
        "breaking_change_ids": { "type": "array", "items": { "type": "string" } }
      },
      "required": ["api_id", "version", "status", "registered_at"]
    }
  }
}
```

---

## §3 — Operation: register

```
Input: api_spec (OpenAPI or endpoint list), optional consumer_list
Steps:
  1. Parse api_spec to extract api_id, version, endpoint_count
  2. Check registry: if api_id+version already exists → return error DUPLICATE_REGISTRATION
  3. Create registry entry with status=current, registered_at=now()
  4. Write updated registry to state-manager
Output: registry entry created
```

---

## §4 — Operation: deprecate

```
Input: api_id, sunset_date, consumer_list (optional)
Steps:
  1. Locate api_id in registry; verify status=current (error if already deprecated/sunset)
  2. Set status=deprecated, deprecated_at=now(), sunset_date=input.sunset_date
  3. Set successor_api_id if provided in api_spec
  4. For each consumer in consumer_list (or registry.consumers):
     Create work item stub:
     {
       "type": "TASK",
       "title": "Migrate <consumer> from <api_id> before <sunset_date>",
       "priority": computed from days_until_sunset (< 30d = high, 30-90d = medium, > 90d = low),
       "linked_feature": api_id
     }
  5. Write updated registry to state-manager
Output: updated registry entry + work_items_created list
```

---

## §5 — Operation: sunset

```
Input: api_id
Steps:
  1. Locate api_id in registry; verify status=deprecated
  2. Check registry.consumers: for each consumer, check if a corresponding migration work item exists with status=completed
  3. If unmigrated consumers remain:
     Emit sunset_violation with consumer list (warning — does not block)
  4. Set status=sunset
  5. Write updated registry to state-manager
Output: sunset registry entry + sunset_violations list
```

---

## §6 — Operation: migration-guide

```
Input: api_id, breaking_changes (from change-impact-analyzer)
Steps:
  1. Locate api_id in registry
  2. For each breaking_change:
     a. Classify change type (removed_endpoint, changed_parameter, changed_response_schema, auth_change, etc.)
     b. Generate before_after example:
        before: code snippet using old API contract
        after: code snippet using new API contract
     c. Generate migration_step: imperative instruction for the consumer developer
     d. Estimate effort: minutes (doc-only), hours (code change), days (schema migration)
  3. Aggregate breaking_changes_summary: total count by type
  4. Order migration_steps by dependency (auth changes first, schema changes last)
  5. Compute total estimated_effort_hours = sum of step efforts
Output: migration_guide object
```

---

## §7 — Operation: query

```
Input: optional filters (status, framework, after_date)
Steps:
  1. Read full registry from state-manager
  2. Apply filters
  3. Compute deprecation_timeline: group by sunset_date bucket (this_month, next_quarter, future)
  4. Identify sunset_violations: entries where sunset_date < today AND status != "sunset"
Output: filtered registry view + deprecation_timeline + sunset_violations
```

---

## §8 — Feedback Routes

| Event | Target Skill | Action |
|---|---|---|
| `breaking_change_without_deprecation` | `change-impact-analyzer` | backpropagate: breaking change detected for API with no deprecation record — deprecation required |
| `sunset_violation_detected` | orchestrator | HITL alert: API past sunset date still active; consumer list attached |

---

## §9 — Orchestration Position

```
change-impact-analyzer detects breaking change
  → emits event: breaking_api_change
  → api-deprecation-manager (operation=migration-guide OR operation=deprecate)
  → documentation-generator (receives migration_guide for publishing)
  → deployment-strategy (receives deprecation_timeline for rollout planning)
```

On-demand invocation path: user triggers lifecycle operation directly via orchestrator routing.

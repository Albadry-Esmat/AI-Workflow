---
name: state-manager
version: 1.1.0
domain: system
description: 'Use when reading, writing, diffing, or restoring the ASE-OS system state. Triggers on: "read system state", "update state", "write state diff", "restore state", "system state snapshot", "state consistency".'
author: system
---

## Purpose

The state-manager is the sole interface to the ASE-OS system state. It provides controlled read, write, diff, and restore operations over the structured project state that governs all agents and skills. No agent or skill may modify system state directly — all mutations flow through this skill, producing auditable diff entries. It enforces consistency, isolation, and recoverability across the entire engineering operating system.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `operation` | `string` | Yes | `read`, `write`, `diff`, `snapshot`, or `restore` |
| `scope` | `string` | Yes | State section to operate on: `project_spec`, `architecture`, `dependency_graph`, `task_graph`, `code_map`, `skill_registry`, `decision_log`, `documentation_state`, `test_state`, `security_state`, `pipeline_state`, `dispatch_map`, `event_log`, `snapshots`, `rollback_log`, `adr_index`, or `all` |
| `payload` | `object` | No | Data to write (required for `write` operation) |
| `diff_entry` | `object` | No | Metadata for write audit: `{ skill_id, reason, timestamp }` |
| `snapshot_id` | `string` | No | Snapshot ID to restore from (required for `restore` operation) |
| `fields` | `array[string]` | No | Specific fields to read within the scope (omit for full scope) |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "operation": { "type": "string", "enum": ["read", "write", "diff", "snapshot", "restore"] },
    "scope": { "type": "string", "enum": ["project_spec", "architecture", "dependency_graph", "task_graph", "code_map", "skill_registry", "decision_log", "documentation_state", "test_state", "security_state", "pipeline_state", "dispatch_map", "event_log", "snapshots", "rollback_log", "adr_index", "all"] },
    "payload": { "type": "object" },
    "diff_entry": {
      "type": "object",
      "properties": {
        "skill_id": { "type": "string" },
        "reason": { "type": "string" },
        "timestamp": { "type": "string", "format": "date-time" }
      },
      "required": ["skill_id", "reason"]
    },
    "snapshot_id": { "type": "string" },
    "fields": { "type": "array", "items": { "type": "string" } }
  },
  "required": ["operation", "scope"]
}
```

## Required Context

- Active system state at `.opencode/state/system_state.json` or an initialized state structure.
- For `restore`: a valid snapshot at `.opencode/state/snapshots/<snapshot_id>.json`.

## Execution Logic

```
Step 1 — Validate operation and scope
  Reject invalid operation/scope combinations.
  For write: require diff_entry with skill_id and reason.
  For restore: require snapshot_id and verify snapshot exists.
  Output: validated_request

Step 2 — Load current state
  Read `.opencode/state/system_state.json`.
  If file absent and operation is read/diff/restore: return error STATE_NOT_FOUND.
  If file absent and operation is write: initialize empty state structure.
  Output: current_state

Step 3 — Execute operation
  read:     Extract requested scope/fields. Return as state_slice.
  write:    Merge payload into scope. Append diff_entry to state.diff_log.
            Validate merged state is structurally consistent.
  diff:     Compute field-level diff between current state and payload.
            Return added, modified, removed field lists.
  snapshot: Serialize current state to `.opencode/state/snapshots/<uuid>.json`.
            Record snapshot_id and timestamp in state.snapshots index.
  restore:  Load snapshot file. Replace current state with snapshot content.
            Append restore entry to state.diff_log.
  Output: operation_result

Step 4 — Persist state (write, restore operations only)
  Write updated state to `.opencode/state/system_state.json` atomically.
  Update state.updated_at timestamp.
  Output: persisted_state

Step 5 — Assemble output
  Return state_slice or diff_result or snapshot_id or restore_confirmation.
  Include metrics.
  Output: final result
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `state_slice` | `object` | Requested scope data (read operations) |
| `diff_result` | `object` | Added, modified, removed fields (diff operation) |
| `snapshot_id` | `string` | UUID of created snapshot (snapshot operation) |
| `restore_confirmation` | `object` | Restored snapshot ID and timestamp (restore operation) |
| `metrics` | `object` | Execution metrics |
| `feedback` | `array[object]` | Feedback entries |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "state_slice": { "type": "object" },
    "diff_result": {
      "type": "object",
      "properties": {
        "added": { "type": "array", "items": { "type": "string" } },
        "modified": { "type": "array", "items": { "type": "string" } },
        "removed": { "type": "array", "items": { "type": "string" } }
      }
    },
    "snapshot_id": { "type": "string" },
    "restore_confirmation": {
      "type": "object",
      "properties": {
        "snapshot_id": { "type": "string" },
        "restored_at": { "type": "string" }
      }
    },
    "metrics": { "$ref": "#/$defs/metrics" },
    "feedback": { "type": "array", "items": { "$ref": "#/$defs/feedback_entry" } }
  },
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

- Only the orchestrator may invoke `write` or `restore` operations. All other skills use `read` only.
- Every `write` MUST include a `diff_entry` with a non-empty `skill_id` and `reason`. Writes without provenance are rejected.
- State writes are atomic — if persistence fails, the in-memory state is not updated.
- `restore` invalidates all downstream state snapshots taken after the restored point.
- Maximum state size: 512KB. If exceeded, compress via `context-compressor` before writing.
- The `diff_log` is append-only — entries cannot be deleted or modified.
- `snapshot` operations do not modify state — they only serialize it.
- **ADR canonical source:** `scope: "adr_index"` is the single source of truth for Architecture Decision Records. `decision_log.adrs` is deprecated — do not write new ADRs there. Migrate existing reads to `scope: "adr_index"`.

## Security Considerations

- State MUST NOT contain credentials, tokens, API keys, or secrets in any field.
- Diff log is audit-critical — retain for the full project lifetime.
- `restore` operations require the invoking skill to log a `reason` — silent restores are rejected.
- State files are stored only within `.opencode/state/` — no external write paths permitted.

## Token Optimization

- `read` with `fields` filter returns only requested fields — never the full state.
- For `scope: all`, compress output by omitting null or empty array fields.
- `diff` operations return field paths only (not values) unless `include_values: true` is set.
- Snapshot files use minified JSON (no whitespace).

## Quality Checklist

- [ ] Operation and scope are valid
- [ ] `write` includes diff_entry with skill_id and reason
- [ ] `restore` snapshot_id resolves to an existing file
- [ ] State write is atomic
- [ ] diff_log is append-only
- [ ] Output includes metrics

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| State file not found on read | Return `{"error": "STATE_NOT_FOUND", "scope": "..."}` |
| Write without diff_entry | Reject: `{"error": "MISSING_PROVENANCE"}` |
| Snapshot not found on restore | Reject: `{"error": "SNAPSHOT_NOT_FOUND", "snapshot_id": "..."}` |
| State size exceeds 512KB | Return error with size, recommend context-compressor first |
| Atomic write failure | Revert in-memory change, return `{"error": "WRITE_FAILED"}` |
| Invalid scope value | Reject: `{"error": "INVALID_SCOPE", "valid_scopes": [...]}` |

## 12. Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Behavior |
|------|---------|---------|----------|
| Restore confirmation | `restore` operation always | 300s | Pause and present snapshot diff before restoring — state restore is irreversible |

## 13. Skill Composition

`state-manager` is a utility primitive composed into all stateful skills:

```yaml
composes:
  - skill: state-manager
    version: "^1.0.0"
    input_map: { "operation": "read", "scope": "architecture" }
    output_map: { "state_slice": "current_architecture" }
```

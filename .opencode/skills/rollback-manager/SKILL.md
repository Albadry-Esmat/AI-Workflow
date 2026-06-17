---
name: rollback-manager
version: 1.0.0
domain: orchestration
description: Use when reverting a failed deployment, undoing a broken code change, restoring prior system state, or recovering from a critical pipeline failure. Triggers on: "roll back this change", "undo the deployment", "restore prior state", "revert to snapshot", "pipeline recovery", "rollback".
author: system
---

## Purpose

Safely revert the system to a known-good state when a deployment fails, a code change produces unrecoverable errors, or a pipeline stage produces a critical failure that cannot be auto-repaired. The rollback-manager is the last line of defense in the ASE-OS pipeline — it coordinates with `state-manager` to restore prior snapshots, emits rollback events that cancel in-progress skill executions, and produces a rollback report that feeds the post-mortem analysis. It never deletes snapshots — rollback is always reversible.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `rollback_scope` | `string` | Yes | What to roll back: `deployment`, `code_change`, `pipeline_stage`, or `full_session` |
| `trigger_reason` | `string` | Yes | Human-readable reason for the rollback |
| `target_snapshot_id` | `string` | No | ID of the snapshot to restore. If absent, restores the most recent pre-failure snapshot. |
| `affected_modules` | `array[string]` | No | Module names to scope the rollback (partial rollback). If absent, full scope is assumed. |
| `cancel_in_progress` | `boolean` | No | Whether to cancel any currently executing skills before rollback (default: true) |
| `dry_run` | `boolean` | No | If true, compute rollback plan without executing it (default: false) |
| `state_manager_context` | `object` | No | Current state-manager context (loaded automatically if absent) |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "rollback_scope": { "type": "string", "enum": ["deployment", "code_change", "pipeline_stage", "full_session"] },
    "trigger_reason": { "type": "string", "minLength": 5 },
    "target_snapshot_id": { "type": "string" },
    "affected_modules": { "type": "array", "items": { "type": "string" } },
    "cancel_in_progress": { "type": "boolean" },
    "dry_run": { "type": "boolean" },
    "state_manager_context": { "type": "object" }
  },
  "required": ["rollback_scope", "trigger_reason"]
}
```

## Required Context

- Snapshot list from `state-manager` (`state-manager` read of `snapshots` scope) — to identify valid restore targets.
- Current pipeline execution state (`state-manager` read of `pipeline_state` scope) — to identify in-progress skills.
- Deployment log from system state `deployment_log` scope (for `deployment` scope rollbacks).

## Execution Logic

```
Step 1 — Validate rollback feasibility
  Load snapshot list from state-manager.
  If target_snapshot_id provided: verify it exists and is valid.
  If absent: find the most recent snapshot with status=pre_change or status=pre_deploy.
  If no valid snapshot found: reject with INSUFFICIENT_SNAPSHOT_HISTORY.
  Output: target_snapshot { id, timestamp, scope, modules_included }

Step 2 — Compute rollback plan
  Compare current state with target_snapshot.
  Identify state keys that differ: { key, current_value_hash, snapshot_value_hash }.
  If affected_modules provided: filter to only keys belonging to those modules.
  Classify each change:
    - code_change: files in code_map that differ
    - config_change: configuration entries that differ
    - state_change: pipeline state entries that differ
    - deployment_change: deployment records that differ
  Compute blast radius: how many modules will be affected by the rollback.
  Output: rollback_plan { changes_to_revert: [], estimated_impact: string, reversible: true }

Step 3 — Cancel in-progress skills (if cancel_in_progress=true)
  Load pipeline_state. Find all skills with status=running or status=pending.
  Emit "pipeline.cancel" event for each in-progress skill execution.
  Wait for cancellation acknowledgements (timeout: 30s per skill, max 120s total).
  Output: cancellation_result { cancelled: [], timed_out: [] }

Step 4 — Execute rollback (skip if dry_run=true)
  For each change in rollback_plan.changes_to_revert:
    - Call state-manager with operation=restore, key=change.key, snapshot_id=target_snapshot_id.
  Verify each restore succeeded.
  Record rollback execution in rollback_log: { timestamp, snapshot_id, keys_restored, executor: "rollback-manager" }.
  Output: rollback_result { success: boolean, keys_restored: [], keys_failed: [] }

Step 5 — Post-rollback validation
  Verify critical state keys match target_snapshot values.
  Check that no in-progress skills are still running.
  If deployment rollback: verify deployment_log shows rollback recorded.
  Output: validation_result { valid: boolean, mismatches: [] }

Step 6 — Assemble rollback report
  Build rollback_report:
    - trigger_reason, rollback_scope
    - target_snapshot: { id, timestamp }
    - changes_reverted count
    - modules_affected list
    - cancellation_result
    - rollback_result
    - validation_result
    - recovery_time_ms
  Write rollback_report to state via state-manager.
  Emit event: "rollback.completed" with { scope, snapshot_id, success }.
  Output: rollback_report
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `rollback_plan` | `object` | Computed plan: `{ changes_to_revert, estimated_impact, reversible }` |
| `rollback_result` | `object` | Execution result: `{ success, keys_restored, keys_failed }` |
| `rollback_report` | `object` | Full structured report for post-mortem |
| `target_snapshot` | `object` | The snapshot restored to: `{ id, timestamp, scope }` |
| `dry_run_only` | `boolean` | True if dry_run was set — no state changes were made |
| `metrics` | `object` | Execution metrics |
| `feedback` | `array[object]` | Feedback entries |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "rollback_plan": {
      "type": "object",
      "properties": {
        "changes_to_revert": { "type": "array" },
        "estimated_impact": { "type": "string" },
        "reversible": { "type": "boolean" }
      },
      "required": ["changes_to_revert", "estimated_impact", "reversible"]
    },
    "rollback_result": {
      "type": "object",
      "properties": {
        "success": { "type": "boolean" },
        "keys_restored": { "type": "array", "items": { "type": "string" } },
        "keys_failed": { "type": "array", "items": { "type": "string" } }
      },
      "required": ["success", "keys_restored", "keys_failed"]
    },
    "rollback_report": { "type": "object" },
    "target_snapshot": {
      "type": "object",
      "properties": {
        "id": { "type": "string" },
        "timestamp": { "type": "string" },
        "scope": { "type": "string" }
      },
      "required": ["id", "timestamp", "scope"]
    },
    "dry_run_only": { "type": "boolean" },
    "metrics": { "$ref": "#/$defs/metrics" },
    "feedback": { "type": "array", "items": { "$ref": "#/$defs/feedback_entry" } }
  },
  "required": ["rollback_plan", "rollback_result", "rollback_report", "target_snapshot", "dry_run_only", "metrics", "feedback"],
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

- Rollback is ALWAYS reversible — no snapshot is deleted as part of a rollback.
- A rollback always creates a new "pre_rollback" snapshot of the current state BEFORE reverting, so the failed state can be re-examined.
- `full_session` scope rollback requires human approval (HITL gate) — it cannot be auto-triggered.
- `cancel_in_progress` defaults to true — in-progress skills are cancelled before state is restored to prevent state corruption.
- Rollback of a deployment scope must coordinate with `deployment-strategy` to issue environment-level revert commands.
- `dry_run` mode computes rollback_plan and rollback_report but makes zero state changes.

## Security Considerations

- Rollback operations are logged with executor identity — anonymous rollbacks are rejected.
- Snapshots containing credential-like values are scrubbed before the rollback report is written.
- `deployment` scope rollback requires the deployment secret keys to be re-injected by the environment — rollback-manager never stores or passes deployment credentials.

## Token Optimization

- Rollback plan compares state using content hashes — not full values. Full values are only loaded for the restore operation itself.
- Rollback report stores only changed key names and hashes — not full state values.
- For partial rollbacks (`affected_modules` set), load only those modules' state slices.

## Quality Checklist

- [ ] Target snapshot validated before any state changes
- [ ] Pre-rollback snapshot created before reverting
- [ ] In-progress skills cancelled before state restore
- [ ] Post-rollback validation confirms state matches snapshot
- [ ] Rollback report written to state and event emitted

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| No valid snapshot found | Reject: `{"error": "INSUFFICIENT_SNAPSHOT_HISTORY"}` |
| State restore partially fails | Revert successful keys, log failed keys, emit warning, require human intervention |
| Skill cancellation times out | Proceed with rollback anyway after 120s, log timed_out skills |
| Post-rollback validation fails | Emit critical alert, do NOT emit rollback.completed, escalate to human |

## 12. Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Behavior |
|------|---------|---------|----------|
| Full session rollback | `rollback_scope === "full_session"` | 3600s | Always requires explicit human confirmation — never auto-executed |
| Deployment rollback | `rollback_scope === "deployment"` | 1800s | Pause, present rollback plan for human approval before executing |
| Post-rollback validation fails | `validation_result.valid === false` | 3600s | Escalate: present mismatch details, require human to assess state integrity |

## 13. Skill Composition

`rollback-manager` is invoked by `orchestrator` on critical failure events:

```yaml
composes:
  - skill: rollback-manager
    version: "^1.0.0"
    input_map:
      rollback_scope: "event.payload.scope"
      trigger_reason: "event.payload.reason"
      affected_modules: "change_impact.module_impact[*].module"
    output_map:
      rollback_report: "state.rollback_log[-1]"
      target_snapshot: "state.current_snapshot"
```

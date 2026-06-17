# Rollback Manager — Knowledge Reference

## Principles

- **Rollback is always reversible**: Rolling back does not delete the failed state — it takes a pre-rollback snapshot first so the failed state can be re-examined. A rollback must never be a one-way door.
- **Snapshot before restore**: Before any state restoration, create a snapshot of the current (failed) state. This preserves the forensic evidence needed for post-mortem analysis.
- **Cancel before restore**: In-progress skills must be cancelled before state is restored. Restoring state while skills are still writing to it produces corrupt state.
- **Partial rollback over full rollback**: When only a subset of modules are affected, roll back only those modules' state. Full-session rollbacks are reserved for catastrophic failures and always require human approval.
- **Rollback is not the fix**: A rollback restores stability — it does not fix the underlying issue. Every rollback must be followed by a post-mortem that identifies and resolves the root cause.

## Rollback Scopes

| Scope | Coverage | HITL Required |
|-------|---------|--------------|
| `pipeline_stage` | State from the last pipeline phase | No (auto) |
| `code_change` | Code map and test state for affected modules | No (auto) |
| `deployment` | Deployment records and environment state | Yes |
| `full_session` | All state in the current session | Yes (always) |

## Snapshot Lifecycle

```
1. Pre-change snapshot    → label: "pre_<operation>", status: stable
2. Execute operation
3. If success:            → label: "post_<operation>", status: stable
   If failure:            → label: "failed_<operation>", status: failed
4. On rollback:           → create "pre_rollback" snapshot of current (failed) state
5. Restore target snapshot
6. Post-rollback validate → verify state matches target snapshot
7. Retain snapshots for session duration (never delete during active session)
```

## Post-Mortem Requirements

Every executed rollback (non-dry-run) must produce a post-mortem entry in the `rollback_log`:

| Field | Content |
|-------|---------|
| `timestamp` | When rollback was executed |
| `trigger_reason` | Why the rollback was initiated |
| `failed_snapshot_id` | The snapshot representing the failed state |
| `restored_snapshot_id` | The snapshot that was restored |
| `modules_affected` | Which modules were rolled back |
| `recovery_time_ms` | Time from failure detection to successful restore |
| `root_cause` | (Filled in by human post-mortem) |

## Anti-patterns

- **Rollback as first response**: Triggering rollback before code-repair has been attempted. Rollback should follow repair exhaustion, not precede it.
- **Rollback without snapshot**: Restoring state without first snapshotting the failed state. This destroys the forensic evidence.
- **Silent rollback**: Rolling back without emitting a `rollback.completed` event or writing to the rollback_log. All rollbacks must be observable.
- **Rollback of wrong scope**: Rolling back the full session when only one module failed. Excessive rollback scope discards valid work.

## Source References

- Database transaction rollback semantics (ACID properties)
- Blue/green deployment rollback patterns
- Chaos engineering principles (Principles of Chaos Engineering, Netflix)

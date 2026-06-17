# State Manager — Knowledge Reference

## Principles

- **Single writer rule**: Only `state-manager` writes to system state. No skill, agent, or pipeline step writes state directly. This is the hardest constraint in the system — it ensures all state mutations are logged, versioned, and reversible.
- **Snapshots before mutations**: Every write operation that mutates existing state must be preceded by a snapshot of the affected keys. There is no mutation without a restore point.
- **Scoped access**: Skills receive only the state slice they declared in `Required Context`. Full system state is never passed to a skill. Scoped access enforces the principle of least privilege.
- **Diffs, not replacements**: State updates are expressed as diffs (key + new value) — not full-object replacements. This minimizes token cost and maintains a complete audit trail.
- **State is the source of truth**: If the system state and the actual file system diverge, the system state is authoritative. Skills that write files must write to state first and let state-manager propagate to disk.

## State Scopes

| Scope | Owner Skills | Access |
|-------|-------------|--------|
| `project_spec` | requirement-analyzer | read: all; write: requirement-analyzer via state-manager |
| `architecture` | architecture-design | read: all; write: architecture-design via state-manager |
| `dependency_graph` | dependency-analyzer | read: all; write: dependency-analyzer via state-manager |
| `task_graph` | feature-planning | read: all; write: feature-planning via state-manager |
| `code_map` | code-generator, code-repair | read: all; write: builder skills via state-manager |
| `test_state` | test-generator, testing-strategy | read: all; write: test skills via state-manager |
| `security_state` | security-review | read: security-review only; write: security-review via state-manager |
| `decision_log` | adr-generator | read: all; write: adr-generator via state-manager |
| `dispatch_map` | event-router | read: event-router; write: event-router via state-manager |
| `snapshots` | rollback-manager | read: rollback-manager; write: all via snapshot operation |

## Snapshot Protocol

1. Before any write: `state-manager.snapshot(keys=[affected_keys], label="pre_<operation>")`
2. Execute write
3. If write fails: `state-manager.restore(snapshot_id=latest)`
4. After successful write: retain snapshot for `retention_window` (default: 10 snapshots per scope)

## Anti-patterns

- **Direct state mutation**: A skill modifying state by passing updated objects directly to the orchestrator instead of using state-manager operations.
- **Unbounded snapshot retention**: Keeping every snapshot forever. Snapshot storage grows unbounded. Retention policy must be enforced.
- **Global state reads**: A skill requesting the full `system_state` object. All reads must specify a scope key.
- **Unlogged writes**: Any state write that does not produce a diff entry with skill_id and timestamp. All mutations must be auditable.

## Source References

- Event sourcing pattern (Martin Fowler, "Patterns of Enterprise Application Architecture")
- CQRS (Command Query Responsibility Segregation) — state separation model
- Operational transformation and conflict-free replicated data types (CRDTs) — for multi-agent state consistency

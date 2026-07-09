# ADR-0001 — Work Item Lifecycle Persistence Model

**Status:** Accepted  
**Date:** 2026-06-22  
**Deciders:** ASE-OS pipeline (Phase 1 Work Lifecycle Management Layer)  
**Skills involved:** `work-item-lifecycle-guard` (SKL-058), `defect-manager` (SKL-055), `feature-planning` (SKL-003)  
**Related docs:** `docs/work-item-foundation.md`, `docs/skills-registry.md §SKL-058`

---

## Context

The AI Workflow system tracks work items (tasks, reviews, bugs, change requests, etc.) generated during pipeline execution. A persistence model and lifecycle governance approach were needed before the work lifecycle management layer could be implemented.

### Forces at play

1. **Agent environment constraints** — pipeline agents run in transient sessions with no persistent database connections. Spinning up a database (PostgreSQL, SQLite) for work item storage would require managed infrastructure and external credentials, adding operational complexity to a system designed to run locally or in CI.

2. **Git-native traceability** — work items represent decisions made during pipeline execution. Storing them as Markdown files with YAML front matter makes every state change a diff-visible git commit, providing an immutable audit trail with zero additional tooling.

3. **Jira export requirement** — work items must be exportable to Jira Bulk Import JSON (see ADR-0002). A flat-file schema that mirrors the Jira issue model is easier to transform than a normalized relational schema.

4. **Guard skill design** — the lifecycle guard (`work-item-lifecycle-guard`) needed to be a pure rule evaluator with no external I/O, to keep its attack surface minimal and its execution time under 100ms. A database-backed guard would require read access to current item state, coupling the guard to the persistence layer.

5. **Multi-agent write safety** — multiple pipeline skills can produce work items concurrently. File-per-item isolation (one `.md` file per work item ID) means concurrent writes target different files, avoiding write contention without transactions.

---

## Decision

**Work items are persisted as flat Markdown files with YAML front matter in the `work-items/` directory, one file per item, following the schema defined in `docs/work-item-foundation.md §2`.**

Specifically:
- Each work item is a file at `work-items/{TYPE}-{NNNN}-{slug}.md`
- FEATURE items use a folder structure at `work-items/features/FEATURE-NNN-{slug}/`
- The lifecycle state machine is embedded in the `work-item-lifecycle-guard` skill as pure logic — it reads no files; it evaluates only the `(item_type, from_state, to_state)` tuple against a static rule table
- ID sequences are tracked in the pipeline session's in-state `work_items.sequences.{TYPE}` counter
- Terminal states (`closed`, `cancelled`, `rejected`) are enforced as permanent: no transition out of a terminal state is ever allowed, even in warning mode

### Initial deployment mode: `warning`

The lifecycle guard deploys in `warning` mode, not `block` mode. Invalid transitions emit a warning feedback entry and are logged, but the pipeline is not halted. This 2-week stabilization window allows upstream skills to emit correct state transitions before the guard begins enforcing them as hard blocks.

The guard switches to `block` mode by changing `guard_mode` from `warning` to `block` in the pipeline configuration. Terminal state blocks apply in all modes.

---

## Consequences

### Positive

- **Zero infrastructure dependencies** — no database to provision, migrate, or back up. Works in any environment where the filesystem is writable.
- **Git-native audit log** — every state change is a committed file diff. History is self-documenting.
- **Independent file writes** — concurrent skill writes target different files (e.g., `BUG-0001` and `TASK-0042`), eliminating write contention without requiring transactions or locks.
- **Guard decoupling** — the lifecycle guard has no dependency on the persistence layer. It can be tested with pure unit inputs and no filesystem access.
- **Jira schema alignment** — the flat YAML schema maps directly to Jira issue fields, minimising transformation logic in `work-item-exporter`.

### Negative / Trade-offs

- **No cross-item queries** — querying "all open bugs blocking more than 3 tasks" requires reading and parsing multiple files. A relational database would handle this trivially.
- **ID sequence non-atomic** — the in-state `work_items.sequences` counter is not atomic across concurrent sessions. In high-concurrency environments (parallel pipeline runs), ID collisions are theoretically possible. Mitigation: pipeline runs are sequential per project; within a single pipeline run, ID assignment is serial.
- **Schema migration complexity** — changing the YAML front matter schema requires updating all existing files. There is no migration runner; changes must be applied via a script or the `doc-maintainer` skill.
- **No referential integrity** — `linked_items` references are not validated at write time. A dangling `parent_id` or `target_id` will not raise an error.

### Risks accepted

- The 2-week `warning` deployment window means some invalid state transitions may enter the file store before `block` mode is activated. These must be manually reviewed or cleaned up before enabling `block` mode.

---

## Alternatives considered

| Alternative | Why rejected |
|-------------|-------------|
| SQLite database file in repo | Requires binary blob in git; merge conflicts are opaque; no diff-visible audit trail |
| PostgreSQL / external DB | Requires external infrastructure; not suitable for local-first or CI-only runs |
| In-memory session state only | No persistence across sessions; work items would be lost on pipeline restart |
| JSON files instead of Markdown+YAML | Less human-readable; loses the ability to embed rich Markdown bodies for descriptions and acceptance criteria |

---

## Review trigger

This ADR should be revisited if:
- The system needs cross-item query capabilities (consider adding a read-only SQLite index built from the flat files)
- Concurrent pipeline runs become common (consider a file-based lock or atomic rename strategy for ID assignment)
- Work item counts exceed 9,999 per type in a single project (5-digit IDs are supported; update the `id` pattern regex in the guard accordingly)

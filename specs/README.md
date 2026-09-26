# specs/ — Authoritative execution / specification history

> Proposal status: template + README only. Nothing reads `specs/` yet. No writer wired.
> Frozen window unchanged. `G0: OPEN`, `P2+: BLOCKED`.

## Responsibility separation (validated against existing architecture)

| Root | Role | Git | Writer (target) |
|---|---|---|---|
| `work-items/` | Intake / backlog / work queue (requests in, triage, sequencing). | Ignored content (framework skeleton tracked). | Human + `feature-planning` intake (existing). |
| `specs/` | Authoritative specification + execution history per feature. The 8-file set is the record another agent reconstructs from. | **Tracked** (this dir is not gitignored). | `feature-planning` Step 7c (future dual-write → cutover, BLOCKED now). |
| `artifacts/` | Generated immutable / runtime evidence (snapshots, RTMs, reports, telemetry). Derived, never hand-edited. | Ignored by default (`git add -f` opt-in). | Orchestrator + skills (existing). |
| `exports/` | Derived external projections (Jira/GitHub payloads). | Ignored. | `work-item-exporter` (existing). |

Fits because: `feature-planning` already creates per-feature folders; `case-store` already writes immutable chains; `work-item-exporter` already treats `exports/` as derived. No component assumes `work-items/` is the authoritative history — it is the queue.

## Layout

```
specs/
  README.md            # this file
  TEMPLATE/            # copy for each FEATURE-NNN-slug
    spec.md            # authoritative requirements + acceptance (REQ IDs)
    plan.md            # technical implementation plan
    tasks.md           # executable tasks with req_ids
    decisions.md       # decisions + assumptions
    progress.md        # append-only execution history
    verification.md    # tests + evidence
    review.md          # reviewer / gate results
    completion.md      # final state + references
```

## Traceability

`REQ → TASK → IMPLEMENTATION → TEST → REVIEW → COMPLETION` via stable IDs
(`REQ-XXX-NNN`, `TASK-NNNN`, merge SHA, gate `decision_id`). `tasks.md` carries the
`req_ids` column (dropped in legacy `work-items` copies — must not drop here).
Unverifiable backfill fields are marked `unknown`, never invented.

## Reconstructability contract

Another agent opening `specs/FEATURE-NNN-slug/` must answer without session state:
requested what/why, planned what, what changed, who/which agent did it, tests run,
failures, reviews, why complete. If it cannot, the spec set is incomplete.

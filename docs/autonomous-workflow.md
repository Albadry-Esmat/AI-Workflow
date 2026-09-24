# Autonomous Workflow (P2) — executable state machine + audit

States: `READY → ANALYZING → PLANNING → PLAN_VALIDATION → PLANNED → IMPLEMENTING →
SELF_REVIEW → VALIDATING → VERIFIED → PR_CREATED → REVIEW → GATED → MERGING →
POST_MERGE_VERIFY → DONE`, with `FIXING` (≤3 cycles), `INVESTIGATING` (1 round),
`ESCALATED`, `CANCELLED` branches. Engine: `scripts/workflow-state.js` (forbidden
transitions throw; cycle exhaustion throws).

- Cases live in `artifacts/cases/<id>/` (`case.json`, immutable `events.jsonl`,
  artifacts, `final-report.md` via `scripts/case-report.js`).
- Audit chain `thread → PR → reviews → merge` reconstructed by `case-store.js:auditChain`.
- Locks (`scripts/work-locks.js`): scoped, heartbeat, expiring; conflicts wait, merge plans, or escalate.
- PR routing (`scripts/pr-router.js`): opened→review, synchronize→re-review (SHA moved),
  checks_completed→gate, drafts observe-only.
- Investigation agent: read-only, one round, then RESOLVED→REVIEW or UNRESOLVED→ESCALATED.
- HEAD-SHA binding: approvals/reviews recorded per SHA; any push re-runs REVIEW.

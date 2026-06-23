# Phase 1 — v4.1.0: Skill Consistency Pass

**Target Version:** v4.1.0 | **Estimated Duration:** 2–3 weeks | **Story Points:** 20
**Status:** 🔵 Ready to Start | **Created:** 2026-06-23

---

## Objective

Eliminate all structural inconsistencies across the existing 58-skill ecosystem without adding new skills. Every change in this phase is a targeted fix that improves spec-compliance, token efficiency, and dependency traceability. All Phase 2 work depends on this phase being complete.

---

## Task Checklist

| Task | Title | Points | Priority | Status | Blocked By |
|------|-------|--------|----------|--------|------------|
| [TASK-0001](../../work-items/TASK-0001-dry-run-adr-generator.md) | `dry_run` flag — adr-generator | 2 | HIGH | ⬜ pending | — |
| [TASK-0002](../../work-items/TASK-0002-dry-run-database-architect.md) | `dry_run` flag — database-architect | 2 | HIGH | ⬜ pending | — |
| [TASK-0003](../../work-items/TASK-0003-dry-run-frontend-ux-architect.md) | `dry_run` flag — frontend-ux-architect | 2 | HIGH | ⬜ pending | — |
| [TASK-0004](../../work-items/TASK-0004-dry-run-design-system-generator.md) | `dry_run` flag — design-system-generator | 2 | HIGH | ⬜ pending | — |
| [TASK-0005](../../work-items/TASK-0005-consumes-from-version-pinning.md) | `consumes_from` version pinning — 15 skills | 3 | HIGH | ⬜ pending | — |
| [TASK-0006](../../work-items/TASK-0006-context-ttl-session-skills.md) | `context_ttl` — 8 session-scoped skills | 3 | HIGH | ⬜ pending | — |
| [TASK-0007](../../work-items/TASK-0007-hitl-timeout-model-docs.md) | HITL timeout model documentation | 1 | HIGH | ⬜ pending | — |
| [TASK-0008](../../work-items/TASK-0008-missing-events-event-router.md) | Missing events in event-router dispatch map | 3 | HIGH | ⬜ pending | — |
| [TASK-0009](../../work-items/TASK-0009-version-bumps-consistency.md) | Version bumps — all modified skills | 2 | HIGH | ⬜ pending | TASK-0001–0008 |

**Total: 20 story points**

---

## Recommended Execution Order

```
Week 1: TASK-0001, TASK-0002, TASK-0003, TASK-0004 (all independent, run in parallel)
         TASK-0005 (registry-level, independent)
Week 2: TASK-0006, TASK-0007, TASK-0008 (all independent, run in parallel)
Week 3: TASK-0009 (depends on all above — consistency bump pass)
```

---

## Acceptance Gate

Before marking Phase 1 complete and starting Phase 2:
- [ ] `validate-skills.sh` passes (95/95 or higher)
- [ ] All 9 tasks have `lifecycle_state: closed`
- [ ] `registry.json` bumped to v4.1.0
- [ ] `docs/changelog.md` entry added for v4.1.0
- [ ] `graphify update .` run successfully

---

## Context: Why This Pass Matters

These 9 tasks resolve long-standing inconsistencies flagged in the Skill Ecosystem Audit (E01, E09, E10, E12, E14, E24):

- **`dry_run` gap** — 4 state-writing skills have no preview mode, creating a governance inconsistency vs. code-generator, test-generator, and rollback-manager which all support it
- **`consumes_from` pinning** — 15 skills describe upstream dependencies only in prose; without machine-parseable semver ranges, the orchestrator cannot enforce dependency compatibility at pipeline-start
- **`context_ttl` gap** — 8 session-scoped skills lack TTL fields, creating potential context accumulation that exceeds token budget tiers
- **HITL timeout doc gap** — Governance.md doesn't explain the `bypass_on_timeout: true/false` decision rule, causing confusion for skill authors
- **Missing events** — `skill.failed`, `gate.blocked`, `session.expired` are fired by orchestrator but not routed — silent event loss that prevents correct recovery

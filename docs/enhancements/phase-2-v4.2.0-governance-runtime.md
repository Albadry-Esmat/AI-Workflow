# Phase 2 — v4.2.0: Governance Completion + Runtime Wiring

**Target Version:** v4.2.0 | **Estimated Duration:** 3–4 weeks | **Story Points:** 47
**Status:** ⏳ Blocked — requires Phase 1 complete | **Created:** 2026-06-23

---

## Objective

Close the final governance guard gaps (2 new guards, 1 guard enhancement) and begin wiring the spec-level pipeline to actual runtime execution (GitHub CI, session persistence, live event dispatch). This is the highest-impact phase for system reliability.

---

## Task Checklist

| Task | Title | Points | Priority | Status | Blocked By |
|------|-------|--------|----------|--------|------------|
| [TASK-0010](../../work-items/TASK-0010-api-contract-guard.md) | `api-contract-guard` skill — NEW (SKL-059) | 8 | HIGH | ⬜ pending | TASK-0009 |
| [TASK-0011](../../work-items/TASK-0011-bundle-size-guard.md) | `bundle-size-guard` skill — NEW (SKL-060) | 5 | HIGH | ⬜ pending | TASK-0009 |
| [TASK-0012](../../work-items/TASK-0012-dark-mode-compliance.md) | Dark mode compliance — ui-ux-compliance-guard | 5 | HIGH | ⬜ pending | — |
| [TASK-0013](../../work-items/TASK-0013-circuit-breaker-orchestrator.md) | Circuit-breaker — orchestrator | 5 | HIGH | ⬜ pending | — |
| [TASK-0014](../../work-items/TASK-0014-github-actions-ci.md) | GitHub Actions CI workflows | 3 | HIGH | ⬜ pending | — |
| [TASK-0015](../../work-items/TASK-0015-session-state-persistence.md) | Session state persistence | 8 | HIGH | ⬜ pending | — |
| [TASK-0016](../../work-items/TASK-0016-event-bus-wiring.md) | Event bus wiring — live triggers | 8 | HIGH | ⬜ pending | TASK-0015 |
| [TASK-0017](../../work-items/TASK-0017-dependency-vulnerability-scan.md) | Dependency vulnerability scan — security-review | 5 | HIGH | ⬜ pending | — |

**Total: 47 story points**

---

## Recommended Execution Order

```
Week 1: TASK-0012, TASK-0013, TASK-0014 (independent — can all run in parallel)
         TASK-0015 (foundational — start early)
Week 2: TASK-0010, TASK-0011 (depend on TASK-0009 from Phase 1)
         TASK-0017 (independent)
Week 3: TASK-0016 (depends on TASK-0015)
Week 4: Integration + acceptance gate
```

---

## Acceptance Gate

Before marking Phase 2 complete and starting Phase 3:
- [ ] `validate-skills.sh` passes (96+ skills — TASK-0010 adds SKL-059, TASK-0011 adds SKL-060)
- [ ] `.github/workflows/validate-skills.yml` passing in CI (TASK-0014)
- [ ] Session file created at ``.opencode/state/sessions/<id>.json` after pipeline run (TASK-0015)
- [ ] `full-pipeline.json` updated with api-contract-guard in phase-7b-guards
- [ ] `consumer-website.json` updated with bundle-size-guard in phase-7b-guards
- [ ] All 8 tasks have `lifecycle_state: closed`
- [ ] `registry.json` bumped to v4.2.0
- [ ] `docs/changelog.md` entry added for v4.2.0

---

## New Skills Added in This Phase

| SKL ID | Skill Name | Domain | Phase Position |
|--------|-----------|--------|----------------|
| SKL-059 | api-contract-guard | governance | phase-7b-guards (all pipelines) |
| SKL-060 | bundle-size-guard | governance | phase-7b-guards (consumer-website, developer-portal, serverless-edge) |

---

## Context: Why This Phase Is Critical

**Governance gap** — Without api-contract-guard, a completed implementation can diverge from the architecture contracts with no automated detection. Without bundle-size-guard, frontend performance regressions are invisible until production.

**Runtime gap** — The system is currently spec-only. Session state does not persist between runs (`work-items/` has only `.gitkeep`). Without TASK-0015, no session resumption, no cross-session telemetry, and no audit trail. This is the single highest-value unimplemented item from Goal File §3.4.

**Reliability gap** — Without the circuit-breaker (TASK-0013), a single misconfigured skill can exhaust the entire token budget in retry loops.

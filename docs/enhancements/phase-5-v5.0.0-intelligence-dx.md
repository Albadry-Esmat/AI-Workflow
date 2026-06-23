# Phase 5 — v5.0.0: Intelligence + Observability + Developer Experience

**Target Version:** v5.0.0 | **Estimated Duration:** 4–6 weeks | **Story Points:** 47
**Status:** ⏳ Planned | **Created:** 2026-06-23

---

## Objective

Elevate the system from a specification engine to a self-improving, observable platform. Add cross-session analytics, context-aware smart routing, complete the website skills page, generate monitoring configs, enable bidirectional Jira sync, and add performance regression baseline tracking. This phase completes the Goal File vision.

---

## Task Checklist

| Task | Title | Points | Priority | Status | Blocked By |
|------|-------|--------|----------|--------|------------|
| [TASK-0032](../../work-items/TASK-0032-cross-session-analytics.md) | Cross-session analytics — session-insights | 8 | LOW | ⬜ pending | TASK-0015 |
| [TASK-0033](../../work-items/TASK-0033-smart-routing-context-aware.md) | Smart routing — context-aware pipeline detection | 8 | LOW | ⬜ pending | — |
| [TASK-0034](../../work-items/TASK-0034-website-skills-page-complete.md) | Website — complete Skills page (58 skills) | 5 | LOW | ⬜ pending | — |
| [TASK-0035](../../work-items/TASK-0035-prometheus-otel-spec.md) | Prometheus/OpenTelemetry spec — observability | 8 | LOW | ⬜ pending | — |
| [TASK-0036](../../work-items/TASK-0036-work-item-bidirectional-sync.md) | Work item bidirectional Jira sync | 13 | LOW | ⬜ pending | TASK-0015 |
| [TASK-0037](../../work-items/TASK-0037-performance-regression-baseline.md) | Performance regression baseline — performance-guard | 5 | LOW | ⬜ pending | TASK-0015 |

**Total: 47 story points**

---

## Recommended Execution Order

```
Week 1-2: TASK-0033, TASK-0034, TASK-0035 (independent, parallel)
           TASK-0032 (depends on TASK-0015 from Phase 2 — start if TASK-0015 complete)
Week 3:   TASK-0036 (depends on TASK-0015 — largest task)
           TASK-0037 (depends on TASK-0015)
Week 4-6: Integration, QA, v5.0.0 milestone release
```

---

## Acceptance Gate (v5.0.0 Release Gate — HITL Required)

This is the system's MAJOR version milestone. All items below must pass before v5.0.0 is tagged:

- [ ] `validate-skills.sh` passes (all skills)
- [ ] Website build (`npm run build`) passes with 58 skills displayed
- [ ] `session_summaries.jsonl` accumulating correctly after multi-session run
- [ ] `observability` produces valid Prometheus rules YAML and OTel spec JSON
- [ ] `performance-guard` regression report shows correct delta after baseline change
- [ ] Bidirectional sync imports 5+ Jira issues correctly into `work-items/`
- [ ] Smart routing correctly identifies mobile-app.json for a React Native project
- [ ] All 6 tasks have `lifecycle_state: closed`
- [ ] `registry.json` bumped to v5.0.0 (MAJOR)
- [ ] `docs/changelog.md` v5.0.0 entry complete
- [ ] ADR written for v5.0.0 release decisions
- [ ] **Deploy approval HITL gate — non-bypassable** ⚠️

---

## Context: The v5.0.0 Vision

v5.0.0 completes the Goal File §7 vision:

> *"ASE-OS is a self-maintaining AI software engineering operating system where software is generated, validated, tested, and documented automatically... The measure of success is not how much the AI can do — it is how little drift, inconsistency, and manual intervention the system requires over the full lifecycle of a software product."*

By v5.0.0:
- **Session persistence** (TASK-0015) means the system remembers every run
- **Cross-session analytics** (TASK-0032) means the system learns from history
- **Smart routing** (TASK-0033) means the system understands your project context automatically
- **OTel spec** (TASK-0035) means the pipeline is observable in production monitoring tools
- **Bidirectional Jira sync** (TASK-0036) means the system integrates with team issue trackers
- **Performance regression baseline** (TASK-0037) means the system catches regressions before they ship

Together, these close the gap between the spec-level pipeline and a truly self-maintaining engineering OS.

---

## Post-v5.0.0 Backlog (Future Consideration)

The following items were identified but deferred beyond v5.0.0:

| Item | Reason for Deferral |
|------|---------------------|
| Runtime executor (live code execution) | Requires sandboxed execution environment — out of scope for spec-level system |
| `ml-specialist` domain skill | Deferred pending data-ml-pipeline template validation (TASK-0024) |
| `api-contract-guard` for GraphQL | TASK-0010 covers REST only; GraphQL variant is a separate effort |
| Multi-agent concurrent execution tests | Requires integration test harness not yet in place |
| `release-notes-generator` Slack/email delivery | Infrastructure dependency — purely additive after TASK-0019 |

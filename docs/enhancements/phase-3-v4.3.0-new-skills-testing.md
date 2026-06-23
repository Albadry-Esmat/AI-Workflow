# Phase 3 — v4.3.0: New Skills + Testing Depth

**Target Version:** v4.3.0 | **Estimated Duration:** 3–4 weeks | **Story Points:** 48
**Status:** ⏳ Planned | **Created:** 2026-06-23

---

## Objective

Add 4 new skills that close documented capability gaps (environment config, release notes, localization, i18n enforcement) and significantly expand the testing toolkit with snapshot and property-based testing modes. Completes the multi-locale coverage chain.

---

## Task Checklist

| Task | Title | Points | Priority | Status | Blocked By |
|------|-------|--------|----------|--------|------------|
| [TASK-0018](../../work-items/TASK-0018-environment-config-manager.md) | `environment-config-manager` skill — NEW (SKL-061) | 8 | MEDIUM | ⬜ pending | — |
| [TASK-0019](../../work-items/TASK-0019-release-notes-generator.md) | `release-notes-generator` skill — NEW (SKL-062) | 8 | MEDIUM | ⬜ pending | — |
| [TASK-0020](../../work-items/TASK-0020-localization-architect.md) | `localization-architect` skill — NEW (SKL-063) | 13 | MEDIUM | ⬜ pending | — |
| [TASK-0021](../../work-items/TASK-0021-i18n-compliance-guard.md) | `i18n-compliance-guard` skill — NEW (SKL-064) | 8 | MEDIUM | ⬜ pending | TASK-0020 |
| [TASK-0022](../../work-items/TASK-0022-snapshot-property-testing.md) | Snapshot + property-based testing | 8 | MEDIUM | ⬜ pending | — |
| [TASK-0023](../../work-items/TASK-0023-hreflang-seo-optimizer.md) | `hreflang` support — seo-optimizer | 3 | MEDIUM | ⬜ pending | — |

**Total: 48 story points**

---

## Recommended Execution Order

```
Week 1: TASK-0018, TASK-0019, TASK-0022, TASK-0023 (all independent, run in parallel)
Week 2: TASK-0020 (largest task — 13pts, start as soon as team capacity allows)
Week 3: TASK-0021 (depends on TASK-0020)
Week 4: Integration + acceptance gate
```

---

## Acceptance Gate

Before marking Phase 3 complete and starting Phase 4:
- [ ] `validate-skills.sh` passes (100 skills — 4 new: SKL-061–064)
- [ ] `environment-config-manager` integrated into `pre-deploy.json` pipeline
- [ ] `release-notes-generator` integrated into `full-pipeline.json` phase-10 async block
- [ ] `localization-architect` integrated into `consumer-website.json` and `saas-platform.json`
- [ ] `i18n-compliance-guard` integrated into `consumer-website.json` phase-7b-guards
- [ ] All 6 tasks have `lifecycle_state: closed`
- [ ] `registry.json` bumped to v4.3.0
- [ ] `docs/changelog.md` entry added for v4.3.0

---

## New Skills Added in This Phase

| SKL ID | Skill Name | Domain | Pipelines |
|--------|-----------|--------|-----------|
| SKL-061 | environment-config-manager | system | pre-deploy.json, full-pipeline.json |
| SKL-062 | release-notes-generator | documentation | full-pipeline.json (phase-10 async) |
| SKL-063 | localization-architect | design | consumer-website.json, saas-platform.json, developer-portal.json |
| SKL-064 | i18n-compliance-guard | governance | consumer-website.json, saas-platform.json (phase-7b-guards) |

---

## Context: Why These Skills Matter

**Environment config gap** — Multiple skills mention "no secrets in task descriptions" and "no credentials in pipeline" but no skill produces the `.env.example` template or validates that all referenced environment variables are declared. This gap causes silent deployment failures when a new env var is added in code but not documented.

**Release notes gap** — Every release requires manually writing release notes. The system already has all the data (ADR index, requirements, resolved defects) but no skill synthesizes them into a structured release_notes.md. TASK-0019 closes this entirely.

**Localization gap** — Consumer websites and SaaS platforms routinely require multi-locale support. Currently zero coverage exists — no namespace strategy, no RTL spec, no locale fallback chain. TASK-0020 adds the full localization architecture layer; TASK-0021 adds the enforcement guard.

**Testing depth** — Snapshot testing and property-based testing are standard patterns for frontend components and pure functions respectively, but test-generator currently only generates unit and integration tests. TASK-0022 closes both gaps in a single task.

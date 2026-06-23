# Phase 4 — v4.4.0: Pipeline Expansion + Meta-Skill Governance

**Target Version:** v4.4.0 | **Estimated Duration:** 3–4 weeks | **Story Points:** 49
**Status:** ⏳ Planned | **Created:** 2026-06-23

---

## Objective

Cover the three major missing pipeline domains (data/ML, microservices, serverless/edge) and harden meta-skill governance: automated quality-scoring on registration, skill-lifecycle stage enforcement, and deeper architecture + requirements outputs (API versioning, effort estimation, stakeholder conflict detection).

---

## Task Checklist

| Task | Title | Points | Priority | Status | Blocked By |
|------|-------|--------|----------|--------|------------|
| [TASK-0024](../../work-items/TASK-0024-data-ml-pipeline.md) | Data/ML pipeline template | 13 | MEDIUM | ⬜ pending | — |
| [TASK-0025](../../work-items/TASK-0025-microservices-pipeline.md) | Microservices pipeline template | 8 | MEDIUM | ⬜ pending | TASK-0010 |
| [TASK-0026](../../work-items/TASK-0026-serverless-edge-pipeline.md) | Serverless/edge pipeline template | 5 | MEDIUM | ⬜ pending | TASK-0011, TASK-0018 |
| [TASK-0027](../../work-items/TASK-0027-automated-quality-scoring.md) | Automated quality-scoring on registration | 5 | MEDIUM | ⬜ pending | — |
| [TASK-0028](../../work-items/TASK-0028-skill-lifecycle-guard.md) | skill-lifecycle stage enforcement | 5 | MEDIUM | ⬜ pending | — |
| [TASK-0029](../../work-items/TASK-0029-api-versioning-architecture.md) | API versioning strategy — architecture-design | 3 | MEDIUM | ⬜ pending | — |
| [TASK-0030](../../work-items/TASK-0030-effort-estimation-impact-analyzer.md) | Effort estimation — change-impact-analyzer | 5 | MEDIUM | ⬜ pending | — |
| [TASK-0031](../../work-items/TASK-0031-stakeholder-conflict-detection.md) | Stakeholder conflict detection — requirement-analyzer | 5 | MEDIUM | ⬜ pending | — |

**Total: 49 story points**

---

## Recommended Execution Order

```
Week 1: TASK-0027, TASK-0028, TASK-0029, TASK-0030, TASK-0031 (all independent, parallelizable)
         TASK-0024 (largest — start early, team lead)
Week 2: TASK-0025 (depends on TASK-0010 from Phase 2)
         Continue TASK-0024
Week 3: TASK-0026 (depends on TASK-0011, TASK-0018)
Week 4: Integration + acceptance gate
```

---

## Acceptance Gate

Before marking Phase 4 complete and starting Phase 5:
- [ ] `validate-skills.sh` passes (100+ skills, 3 new pipeline templates valid)
- [ ] `data-ml-pipeline.json` validates against `pipeline-schema.json`
- [ ] `microservices.json` validates against `pipeline-schema.json`
- [ ] `serverless-edge.json` validates against `pipeline-schema.json`
- [ ] Routing table in `.opencode/agent/primary.md` updated with new pipeline triggers
- [ ] `architecture-design` output schema includes `api_versioning_strategy`
- [ ] `change-impact-analyzer` output schema includes `effort_estimate`
- [ ] `requirement-analyzer` output schema includes `conflicts[]`
- [ ] All 8 tasks have `lifecycle_state: closed`
- [ ] `registry.json` bumped to v4.4.0
- [ ] `docs/changelog.md` entry added for v4.4.0

---

## New Pipeline Templates in This Phase

| Template | Domain | Key Additions vs. full-pipeline.json |
|----------|--------|--------------------------------------|
| `data-ml-pipeline.json` | data / ML | ML domain specialist, data schema phase, model eval framework, fairness gate |
| `microservices.json` | backend | Service mesh phase, per-service api-contract-guard, distributed tracing spec |
| `serverless-edge.json` | cloud | Cold-start guard, env-config-manager phase, edge bundle-size limits |

---

## Context: Why This Phase Matters

**Pipeline coverage** — The system covers web (consumer, developer portal, admin), SaaS, mobile, embedded/IoT, AI agents, and full-stack. Data/ML systems, microservices architectures, and serverless/edge functions are the three most common remaining modern application patterns — currently unroutable.

**Meta-skill governance** — quality-scoring currently requires manual invocation. Any new skill can be registered with a score of 0. TASK-0027 makes quality-scoring a mandatory gate in skill-authoring, ensuring every new skill meets the baseline. TASK-0028 prevents `draft`-stage skills from being invoked in production pipelines.

**Architecture depth** — API versioning strategy is a critical architectural decision (URL path vs. header vs. query param, deprecation policy) that architecture-design currently omits. Effort estimation in change-impact-analyzer closes the gap between knowing *what* will break and knowing *how long* it will take to fix.

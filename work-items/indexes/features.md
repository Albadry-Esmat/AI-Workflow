# Feature Index

**Last updated:** 2026-06-23 | **Total work items:** 42 (37 legacy tasks + 5 new features)

Central catalog of all feature work items. Features created before v4.4.0 use the legacy `TASK-NNNN-*.md` flat file format. Features created at v4.4.0+ use the `features/FEATURE-NNN-name/` folder structure.

---

## Active Roadmap — v4.1.0 to v5.0.0 (Legacy Format)

These 37 items were created during enhancement roadmap planning. Files live at `work-items/TASK-NNNN-*.md`.

### Phase 1 — v4.1.0: Consistency Pass (20 pts)

| ID | Title | Points | Status | Module |
|----|-------|--------|--------|--------|
| [TASK-0001](../TASK-0001-dry-run-adr-generator.md) | `dry_run` flag — adr-generator (SKL-025) | 2 | Planned | skills |
| [TASK-0002](../TASK-0002-dry-run-database-architect.md) | `dry_run` flag — database-architect (SKL-032) | 2 | Planned | skills |
| [TASK-0003](../TASK-0003-dry-run-frontend-ux-architect.md) | `dry_run` flag — frontend-ux-architect (SKL-031) | 2 | Planned | skills |
| [TASK-0004](../TASK-0004-dry-run-design-system-generator.md) | `dry_run` flag — design-system-generator (SKL-038) | 2 | Planned | skills |
| [TASK-0005](../TASK-0005-consumes-from-version-pinning.md) | `consumes_from` version pinning (15 skills) | 3 | Planned | registry |
| [TASK-0006](../TASK-0006-context-ttl-session-skills.md) | `context_ttl` propagation (8 skills) | 3 | Planned | skills |
| [TASK-0007](../TASK-0007-hitl-timeout-model-docs.md) | HITL timeout model — governance.md | 1 | Planned | docs |
| [TASK-0008](../TASK-0008-missing-events-event-router.md) | Missing events — event-router (SKL-024) | 3 | Planned | orchestration |
| [TASK-0009](../TASK-0009-version-bumps-consistency.md) | Version bumps + registry v4.1.0 | 2 | Planned | registry |

### Phase 2 — v4.2.0: Governance + Runtime (47 pts)

| ID | Title | Points | Status | Module |
|----|-------|--------|--------|--------|
| [TASK-0010](../TASK-0010-api-contract-guard.md) | `api-contract-guard` skill (SKL-059) | 8 | Planned | governance |
| [TASK-0011](../TASK-0011-bundle-size-guard.md) | `bundle-size-guard` skill (SKL-060) | 5 | Planned | governance |
| [TASK-0012](../TASK-0012-dark-mode-compliance.md) | Dark mode check — ui-ux-compliance-guard | 5 | Planned | governance |
| [TASK-0013](../TASK-0013-circuit-breaker-orchestrator.md) | Circuit-breaker — orchestrator | 5 | Planned | system |
| [TASK-0014](../TASK-0014-github-actions-ci.md) | GitHub Actions CI workflows | 3 | Planned | ci |
| [TASK-0015](../TASK-0015-session-state-persistence.md) | Session state persistence | 8 | Planned | system |
| [TASK-0016](../TASK-0016-event-bus-wiring.md) | Event bus wiring — event-router → pipeline | 8 | Planned | orchestration |
| [TASK-0017](../TASK-0017-dependency-vulnerability-scan.md) | Dependency vulnerability scan — security-review | 5 | Planned | security |

### Phase 3 — v4.3.0: New Skills + Testing Depth (48 pts)

| ID | Title | Points | Status | Module |
|----|-------|--------|--------|--------|
| [TASK-0018](../TASK-0018-environment-config-manager.md) | `environment-config-manager` skill (SKL-061) | 8 | Planned | system |
| [TASK-0019](../TASK-0019-release-notes-generator.md) | `release-notes-generator` skill (SKL-062) | 8 | Planned | documentation |
| [TASK-0020](../TASK-0020-localization-architect.md) | `localization-architect` skill (SKL-063) | 13 | Planned | design |
| [TASK-0021](../TASK-0021-i18n-compliance-guard.md) | `i18n-compliance-guard` skill (SKL-064) | 8 | Planned | governance |
| [TASK-0022](../TASK-0022-snapshot-property-testing.md) | Snapshot + property-based testing — test-generator | 8 | Planned | testing |
| [TASK-0023](../TASK-0023-hreflang-seo-optimizer.md) | `hreflang` support — seo-optimizer | 3 | Planned | quality |

### Phase 4 — v4.4.0: Pipeline Expansion + Meta-Skill Governance (49 pts)

| ID | Title | Points | Status | Module |
|----|-------|--------|--------|--------|
| [TASK-0024](../TASK-0024-data-ml-pipeline.md) | Data/ML pipeline template | 13 | Planned | orchestration |
| [TASK-0025](../TASK-0025-microservices-pipeline.md) | Microservices pipeline template | 8 | Planned | orchestration |
| [TASK-0026](../TASK-0026-serverless-edge-pipeline.md) | Serverless/edge pipeline template | 5 | Planned | orchestration |
| [TASK-0027](../TASK-0027-automated-quality-scoring.md) | Automated quality-scoring on registration | 5 | Planned | meta |
| [TASK-0028](../TASK-0028-skill-lifecycle-guard.md) | `skill-lifecycle` stage enforcement | 5 | Planned | meta |
| [TASK-0029](../TASK-0029-api-versioning-architecture.md) | API versioning strategy — architecture-design | 3 | Planned | skills |
| [TASK-0030](../TASK-0030-effort-estimation-impact-analyzer.md) | Effort estimation — change-impact-analyzer | 5 | Planned | skills |
| [TASK-0031](../TASK-0031-stakeholder-conflict-detection.md) | Stakeholder conflict detection — requirement-analyzer | 5 | Planned | skills |

### Phase 5 — v5.0.0: Intelligence + Observability + DX (47 pts)

| ID | Title | Points | Status | Module |
|----|-------|--------|--------|--------|
| [TASK-0032](../TASK-0032-cross-session-analytics.md) | Cross-session analytics — session-insights | 8 | Planned | system |
| [TASK-0033](../TASK-0033-smart-routing-context-aware.md) | Smart routing — context-aware pipeline detection | 8 | Planned | orchestration |
| [TASK-0034](../TASK-0034-website-skills-page-complete.md) | Website — complete Skills page (58 skills) | 5 | Planned | website |
| [TASK-0035](../TASK-0035-prometheus-otel-spec.md) | Prometheus/OpenTelemetry spec — observability | 8 | Planned | system |
| [TASK-0036](../TASK-0036-work-item-bidirectional-sync.md) | Work item bidirectional Jira sync | 13 | Planned | integration |
| [TASK-0037](../TASK-0037-performance-regression-baseline.md) | Performance regression baseline — performance-guard | 5 | Planned | quality |

---

## New Format Features (v4.4.0+)

Features created at v4.4.0+ use the `features/FEATURE-NNN-name/` folder structure with 4 files each: `request.md`, `plan.md`, `tasks.md`, `status.md`.

### Phase 6 — v5.1.0: Reactive Intelligence (24 pts)

| ID | Title | Points | Priority | Status | req_id | Module |
|----|-------|--------|----------|--------|--------|--------|
| [FEATURE-001](../features/FEATURE-001-capability-gap-detection/) | Capability Gap Detection + Telemetry | 5 | High | Planned | [N16] | orchestrator / telemetry |
| [FEATURE-002](../features/FEATURE-002-skill-deduplication-check/) | Skill Deduplication Check in skill-authoring | 5 | High | Planned | [N17] | skill-authoring |
| [FEATURE-003](../features/FEATURE-003-skill-origin-trace-metadata/) | Skill Origin Trace + Approval Tier Metadata | 3 | Medium | Planned | [N18] | registry / governance |
| [FEATURE-004](../features/FEATURE-004-gap-to-skill-pipeline/) | Gap-to-Skill Reactive Pipeline | 8 | High | Planned | [N19] | gap-to-skill / orchestrator |
| [FEATURE-005](../features/FEATURE-005-gap-retry-execution/) | Gap Retry Execution | 3 | Medium | Planned | [N20] | orchestrator |

---

## Summary

| Phase | Items | Points | Status |
|-------|-------|--------|--------|
| Phase 1 (v4.1.0) | 9 | 20 | ⬜ Planned |
| Phase 2 (v4.2.0) | 8 | 47 | ⬜ Planned |
| Phase 3 (v4.3.0) | 6 | 48 | ⬜ Planned |
| Phase 4 (v4.4.0) | 8 | 49 | ⬜ Planned |
| Phase 5 (v5.0.0) | 6 | 47 | ⬜ Planned |
| Phase 6 (v5.1.0) | 5 | 24 | ⬜ Planned |
| **Total** | **42** | **235** | — |

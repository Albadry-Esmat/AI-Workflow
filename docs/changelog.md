# Changelog — System Update History

**Version:** 4.3.0 | **Last updated:** 2026-06-24

All notable changes to this project are documented here.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) — `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`.

---

## [Unreleased] — Enhancement Roadmap v5.3.0 (Phase 8)

### Planned — Phase 8: Data, API, Cloud & SRE Expansion (30 Skills, 180 Story Points)

Phase 8 expands ASE-OS from 71 to 101 skills across 10 new capability domains: data engineering, ML platforms, API contract design, microservices & DDD, distributed resilience, cloud-native architecture, security depth, SRE & reliability, frontend depth, and product analytics. Six new specialist agents and five new pipeline templates are introduced.

**New agents (6):** `data-engineer`, `api-designer`, `distributed-systems`, `cloud-platform`, `security-specialist`, `sre`

**New pipeline templates (5):** `data-engineering.json`, `ml-platform.json`, `api-first.json`, `microservices-platform.json`, `cloud-migration.json`

**Skill files created (2026-06-24):**

*Data Domain (SKL-078–082):*
- `.opencode/skills/data-pipeline-architect/SKILL.md` (SKL-078, v1.0.0, draft, req_id: N33)
- `.opencode/skills/data-quality-validator/SKILL.md` (SKL-079, v1.0.0, draft, req_id: N34)
- `.opencode/skills/ml-pipeline-architect/SKILL.md` (SKL-080, v1.0.0, draft, req_id: N35)
- `.opencode/skills/analytics-schema-designer/SKILL.md` (SKL-081, v1.0.0, draft, req_id: N36)
- `.opencode/skills/data-contract-enforcer/SKILL.md` (SKL-082, v1.0.0, draft, req_id: N37)

*API Domain (SKL-083–085):*
- `.opencode/skills/api-design-architect/SKILL.md` (SKL-083, v1.0.0, draft, req_id: N38)
- `.opencode/skills/graphql-architect/SKILL.md` (SKL-084, v1.0.0, draft, req_id: N39)
- `.opencode/skills/event-schema-designer/SKILL.md` (SKL-085, v1.0.0, draft, req_id: N40)

*Architecture Domain (SKL-086–088, SKL-103, SKL-104, SKL-107):*
- `.opencode/skills/microservices-architect/SKILL.md` (SKL-086, v1.0.0, draft, req_id: N41)
- `.opencode/skills/event-sourcing-designer/SKILL.md` (SKL-087, v1.0.0, draft, req_id: N42)
- `.opencode/skills/distributed-resilience-architect/SKILL.md` (SKL-088, v1.0.0, draft, req_id: N43)
- `.opencode/skills/ddd-architect/SKILL.md` (SKL-103, v1.0.0, draft, req_id: N58)
- `.opencode/skills/caching-strategy-designer/SKILL.md` (SKL-104, v1.0.0, draft, req_id: N59)
- `.opencode/skills/realtime-system-architect/SKILL.md` (SKL-107, v1.0.0, draft, req_id: N62)

*Cloud Domain (SKL-089–091):*
- `.opencode/skills/cloud-architecture-reviewer/SKILL.md` (SKL-089, v1.0.0, draft, req_id: N44)
- `.opencode/skills/serverless-architect/SKILL.md` (SKL-090, v1.0.0, draft, req_id: N45)
- `.opencode/skills/container-orchestration-architect/SKILL.md` (SKL-091, v1.0.0, draft, req_id: N46)

*Security Domain (SKL-092–094):*
- `.opencode/skills/threat-model-designer/SKILL.md` (SKL-092, v1.0.0, draft, req_id: N47)
- `.opencode/skills/secrets-management-architect/SKILL.md` (SKL-093, v1.0.0, draft, req_id: N48)
- `.opencode/skills/devsecops-pipeline-designer/SKILL.md` (SKL-094, v1.0.0, draft, req_id: N49)

*Testing/SRE Domain (SKL-095–099):*
- `.opencode/skills/load-test-designer/SKILL.md` (SKL-095, v1.0.0, draft, req_id: N50)
- `.opencode/skills/profiling-advisor/SKILL.md` (SKL-096, v1.0.0, draft, req_id: N51)
- `.opencode/skills/slo-sla-designer/SKILL.md` (SKL-097, v1.0.0, draft, req_id: N52)
- `.opencode/skills/runbook-generator/SKILL.md` (SKL-098, v1.0.0, draft, req_id: N53)
- `.opencode/skills/chaos-engineering-designer/SKILL.md` (SKL-099, v1.0.0, draft, req_id: N54)

*Design Domain (SKL-100–102, SKL-105):*
- `.opencode/skills/state-management-architect/SKILL.md` (SKL-100, v1.0.0, draft, req_id: N55)
- `.opencode/skills/micro-frontend-architect/SKILL.md` (SKL-101, v1.0.0, draft, req_id: N56)
- `.opencode/skills/web-performance-optimizer/SKILL.md` (SKL-102, v1.0.0, draft, req_id: N57)
- `.opencode/skills/localization-architect/SKILL.md` (SKL-105, v1.0.0, draft, req_id: N60)

*Planning Domain (SKL-106):*
- `.opencode/skills/product-analytics-designer/SKILL.md` (SKL-106, v1.0.0, draft, req_id: N61)

**Registry and index updates (2026-06-24):**
- `skills/registry.json`: v5.1.0 → v5.2.0 (71 → 101 skills)
- `skills/index.yaml`: v3.3.0 → v4.0.0 (71 → 101 entries)
- `skills/graph/skill-graph.yaml`: v2.9.0 → v3.0.0 (71 → 101 nodes, 198 → 328 edges)
- `opencode.json`: 13 → 19 agents (+6 specialist agents)
- `skills/pipelines/`: 16 → 21 templates (+5 Phase 8 pipelines)
- `website/src/lib/colors.ts`: added `data`, `api`, `cloud`, `sre` domain colors
- `website/src/components/home/FeaturesSection.tsx`: added 6 Phase 8 capability cards
- `docs/enhancements/README.md`: v1.2.0 → v1.3.0 (54 → 84 items, 348 → 528 pts, 7 → 8 phases)

---

## [Unreleased] — Enhancement Roadmap v5.2.0 (Phase 7)

### Planned — Phase 7: Intelligence Expansion (12 Features, 108 Story Points)

Phase 7 adds 12 new skills across six capability dimensions: behavioral intelligence, quality depth, governance expansion, infrastructure intelligence, architectural power, and operational safety. See `docs/enhancements/phase-7-v5.2.0-intelligence-expansion.md` for the full feature list, dependency graph, and delivery roadmap.

**Phase 7 feature files — v5.2.0 Intelligence Expansion:**

- FEATURE-006: `semantic-diff-analyzer` (SKL-066) — behavioral change detection beyond line-level diffs
- FEATURE-007: `acceptance-criteria-generator` (SKL-067) — BDD Given/When/Then from structured requirements
- FEATURE-008: `technical-debt-tracker` (SKL-068) — cross-session debt register with score, trend, and cost projection
- FEATURE-009: `architecture-evolution-planner` (SKL-069) — phased migration plans with strangler-fig/expand-contract patterns
- FEATURE-010: `compliance-mapper` (SKL-070) — GDPR/HIPAA/PCI-DSS/SOC2/ISO27001 traceability matrix + audit checklist
- FEATURE-011: `api-deprecation-manager` (SKL-071) — full API version lifecycle with auto-generated migration guides
- FEATURE-012: `infrastructure-cost-estimator` (SKL-072) — monthly cloud cost projections (AWS/GCP/Azure) from deployment strategy
- FEATURE-013: `mutation-test-generator` (SKL-073) — static mutation analysis with mutation score and assertion gap reports
- FEATURE-014: `skill-simulator` (SKL-074) — full pipeline dry-run with file preview, HITL gate prediction, and go/no-go summary
- FEATURE-015: `multi-repo-coordinator` (SKL-075) — cross-repo dependency registry and synchronized impact analysis for polyrepo systems
- FEATURE-016: `domain-knowledge-extractor` (SKL-076) — cross-project domain pattern learning and context injection
- FEATURE-017: `pipeline-branching` (SKL-077) — A/B architecture exploration with comparison scorecard and mandatory HITL selection

**Work item files created (2026-06-24):**
- `work-items/features/FEATURE-006-semantic-diff-analyzer/` — request.md, plan.md, tasks.md, status.md
- `work-items/features/FEATURE-007-acceptance-criteria-generator/` — request.md, plan.md, tasks.md, status.md
- `work-items/features/FEATURE-008-technical-debt-tracker/` — request.md, plan.md, tasks.md, status.md
- `work-items/features/FEATURE-009-architecture-evolution-planner/` — request.md, plan.md, tasks.md, status.md
- `work-items/features/FEATURE-010-compliance-mapper/` — request.md, plan.md, tasks.md, status.md
- `work-items/features/FEATURE-011-api-deprecation-manager/` — request.md, plan.md, tasks.md, status.md
- `work-items/features/FEATURE-012-infrastructure-cost-estimator/` — request.md, plan.md, tasks.md, status.md
- `work-items/features/FEATURE-013-mutation-test-generator/` — request.md, plan.md, tasks.md, status.md
- `work-items/features/FEATURE-014-skill-simulator/` — request.md, plan.md, tasks.md, status.md
- `work-items/features/FEATURE-015-multi-repo-coordinator/` — request.md, plan.md, tasks.md, status.md
- `work-items/features/FEATURE-016-domain-knowledge-extractor/` — request.md, plan.md, tasks.md, status.md
- `work-items/features/FEATURE-017-pipeline-branching/` — request.md, plan.md, tasks.md, status.md

**Skill files created (2026-06-24):**
- `.opencode/skills/semantic-diff-analyzer/SKILL.md` (SKL-066, v1.0.0, draft)
- `.opencode/skills/acceptance-criteria-generator/SKILL.md` (SKL-067, v1.0.0, draft)
- `.opencode/skills/technical-debt-tracker/SKILL.md` (SKL-068, v1.0.0, draft)
- `.opencode/skills/architecture-evolution-planner/SKILL.md` (SKL-069, v1.0.0, draft)
- `.opencode/skills/compliance-mapper/SKILL.md` (SKL-070, v1.0.0, draft)
- `.opencode/skills/api-deprecation-manager/SKILL.md` (SKL-071, v1.0.0, draft)
- `.opencode/skills/infrastructure-cost-estimator/SKILL.md` (SKL-072, v1.0.0, draft)
- `.opencode/skills/mutation-test-generator/SKILL.md` (SKL-073, v1.0.0, draft)
- `.opencode/skills/skill-simulator/SKILL.md` (SKL-074, v1.0.0, draft)
- `.opencode/skills/multi-repo-coordinator/SKILL.md` (SKL-075, v1.0.0, draft)
- `.opencode/skills/domain-knowledge-extractor/SKILL.md` (SKL-076, v1.0.0, draft)
- `.opencode/skills/pipeline-branching/SKILL.md` (SKL-077, v1.0.0, draft)

**Registry and index updates (2026-06-24):**
- `skills/registry.json`: 12 new entries added (SKL-066–077); total skills: 71
- `skills/index.yaml`: 12 new entries added; version bumped to 3.3.0

---

## [Unreleased] — Enhancement Roadmap v4.1.0 → v5.1.0

### Implemented — Phase 6: Reactive Intelligence (5 Features, 24 Story Points)

Phase 6 adds a reactive intelligence layer: capability gap detection, skill deduplication, skill origin trace metadata, and a gap-to-skill guided pipeline with HITL approval and automatic retry. See `docs/enhancements/phase-6-v5.1.0-reactive-intelligence.md` for the full feature list and dependency graph.

**Phase 6 feature files — v5.1.0 Reactive Intelligence (5 features, 24 SP):**
- FEATURE-001: Capability gap detection + telemetry — structured gap events, `gap_context` session state, SKL-047 extension, SKL-048 gap metrics
- FEATURE-002: Skill deduplication check — Step 0 guard in `skill-authoring` (create/gap_seed modes), HITL options A/B/C
- FEATURE-003: Skill origin trace + approval tier metadata — `origin_metadata` in registry, `docs/governance.md` §5.1
- FEATURE-004: Gap-to-skill reactive pipeline — SKL-065 new skill, `gap_seed` mode in skill-authoring, non-bypassable HITL gate
- FEATURE-005: Gap retry execution — orchestrator retry block, `retry_context` session state, recursion guard

**Implementation summary (2026-06-24):**

_FEATURE-001 — Capability Gap Detection + Telemetry:_
- `behavioral-telemetry-collector` (SKL-047) bumped to v1.1.0: added `capability_gap` event type with `detected_domain` and `gap_id` fields
- `session-insights` (SKL-048) bumped to v1.1.0: added gap metrics (`total_capability_gaps`, `top_gap_domains`, `gap_ids`) to output
- `orchestrator` bumped to v1.3.0: Step 1 gap detection block (emit `capability_gap` event on no-match) + Step 0.5 retry check block + recursion guards
- `skills/schema/system-state-schema.json`: added `gap_context`, `gap_to_skill_active`, `retry_context`, `retry_in_progress` properties; `"gap-to-skill"` appended to `pipeline_template` enum

_FEATURE-002 — Skill Deduplication Check:_
- `skill-authoring` (SKL-012) bumped to v1.1.0: Step 0 dedup guard added (DEDUP_CLEAR/DEDUP_HIT paths, Jaccard similarity, HITL options A/B/C)
- `skills/schema/dedup-check-result.schema.json` created

_FEATURE-003 — Skill Origin Trace + Approval Tier Metadata:_
- `skills/schema/registry-entry.schema.json` created with `origin_metadata` object (triggered_by, gap_id, dedup_override, created_by, approved_by, approval_tier)
- `skill-authoring` Step 9 now populates `origin_metadata` at registration time
- `docs/governance.md` §5.1 Approval Tiers added (standard / expedited / legacy)

_FEATURE-004 — Gap-to-Skill Reactive Pipeline:_
- `.opencode/skills/gap-to-skill-pipeline/SKILL.md` created (SKL-065, v1.0.0, 13 sections, status: draft)
- `skills/pipelines/gap-to-skill.json` created and schema-validated against `pipeline-schema.json`
- `skill-authoring` operation enum extended with `gap_seed`
- `skills/registry.json`: SKL-065 registered (draft); 59 total skills
- `skills/index.yaml`: SKL-065 entry added (v3.2.0); 59 total entries
- `skills/graph/skill-graph.yaml`: SKL-065 node added; 4 new edges (SKL-047→SKL-065, SKL-048→SKL-065, SKL-065→SKL-012, SKL-065→SKL-015); total_nodes 59, total_edges 162

_FEATURE-005 — Gap Retry Execution:_
- `orchestrator` Step 0.5 retry check block: YES/NO/LATER paths, `retry_in_progress` guard, no-match path suppresses duplicate gap emission
- `skills/schema/system-state-schema.json`: `retry_context` + `retry_in_progress` properties added

**Bugs closed as part of Phase 6:**
- BUG-009: FEATURE-001/plan.md — "Create" corrected to "Extend" for SKL-047/SKL-048; §5 text corrected
- BUG-010: FEATURE-004/plan.md + request.md — stale SKL-049 references corrected to SKL-065 throughout
- BUG-011: FEATURE-004/plan.md — `mode = gap_seed` corrected to `operation = gap_seed`; table column renamed
- BUG-012: `system-state-schema.json` — `"gap-to-skill"` appended to `pipeline_template` enum

**Validation gate (2026-06-24):**
- `validate-skills.sh` — 97 passed, 0 failed ✅

**New work item format established (FEATURE-NNN folders):**
- `work-items/features/FEATURE-001-capability-gap-detection/` — request.md, plan.md, tasks.md, status.md
- `work-items/features/FEATURE-002-skill-deduplication-check/` — request.md, plan.md, tasks.md, status.md
- `work-items/features/FEATURE-003-skill-origin-trace-metadata/` — request.md, plan.md, tasks.md, status.md
- `work-items/features/FEATURE-004-gap-to-skill-pipeline/` — request.md, plan.md, tasks.md, status.md
- `work-items/features/FEATURE-005-gap-retry-execution/` — request.md, plan.md, tasks.md, status.md

---

### Planned — Enhancement Roadmap (37 Tasks, 5 Phases, 211 Story Points)

Full enhancement roadmap created and all 37 task files authored. Roadmap covers v4.1.0 through v5.0.0 across 5 delivery phases. See `docs/enhancements/README.md` for the master index, dependency graph, risk register, and milestone table.

**Work Item Management System established:**
- New directory structure under `work-items/`: `features/`, `bugs/`, `backlog/`, `indexes/`
- `work-items/README.md` — documents both legacy `TASK-NNNN` flat format and new WIM folder format
- `work-items/indexes/features.md` — central catalog of all 37 planned features
- `work-items/indexes/bugs.md` — central bug catalog (8 historical bugs from v4.0.1 documented)
- `work-items/backlog/backlog.md` — deferred post-v5.0.0 items + infrastructure backlog

**Phase documentation (5 files):**
- `docs/enhancements/README.md` — master roadmap with dependency graph, risk register, milestone table
- `docs/enhancements/phase-1-v4.1.0-consistency-pass.md` — 9 tasks, 20 pts
- `docs/enhancements/phase-2-v4.2.0-governance-runtime.md` — 8 tasks, 47 pts
- `docs/enhancements/phase-3-v4.3.0-new-skills-testing.md` — 6 tasks, 48 pts
- `docs/enhancements/phase-4-v4.4.0-pipeline-expansion.md` — 8 tasks, 49 pts
- `docs/enhancements/phase-5-v5.0.0-intelligence-dx.md` — 6 tasks, 47 pts

**Phase 1 task files — v4.1.0 Consistency Pass (9 tasks, 20 pts):**
- TASK-0001: `dry_run` flag — adr-generator (SKL-025)
- TASK-0002: `dry_run` flag — database-architect (SKL-032)
- TASK-0003: `dry_run` flag — frontend-ux-architect (SKL-031)
- TASK-0004: `dry_run` flag — design-system-generator (SKL-038)
- TASK-0005: `consumes_from` version pinning across 15 skills
- TASK-0006: `context_ttl` propagation across 8 skills
- TASK-0007: HITL timeout model documentation — governance.md v2.4.0→v2.5.0
- TASK-0008: Missing events — event-router (SKL-024) v1.0.0→v1.1.0
- TASK-0009: Version bumps + registry v4.1.0 release

**Phase 2 task files — v4.2.0 Governance + Runtime (8 tasks, 42 pts):**
- TASK-0010: `api-contract-guard` new skill (SKL-059, 8 pts) — blocks TASK-0025
- TASK-0011: `bundle-size-guard` new skill (SKL-060, 5 pts) — blocks TASK-0026
- TASK-0012: Dark mode compliance — ui-ux-compliance-guard v2.0.0→v2.1.0
- TASK-0013: Circuit-breaker pattern — orchestrator v1.2.0→v1.3.0
- TASK-0014: GitHub Actions CI workflows (validate-skills + build-check)
- TASK-0015: Session state persistence — `.opencode/state/sessions/` (foundational for Phase 5)
- TASK-0016: Event bus wiring — event-router → live pipeline triggers
- TASK-0017: Dependency vulnerability scan spec — security-review v1.0.0→v1.1.0

**Phase 3 task files — v4.3.0 New Skills + Testing Depth (6 tasks, 48 pts):**
- TASK-0018: `environment-config-manager` new skill (SKL-061, 8 pts) — blocks TASK-0026
- TASK-0019: `release-notes-generator` new skill (SKL-062, 8 pts)
- TASK-0020: `localization-architect` new skill (SKL-063, 13 pts) — blocks TASK-0021
- TASK-0021: `i18n-compliance-guard` new skill (SKL-064, 8 pts)
- TASK-0022: Snapshot + property-based testing — test-generator v1.0.0→v1.1.0
- TASK-0023: `hreflang` support — seo-optimizer v1.0.0→v1.1.0

**Phase 4 task files — v4.4.0 Pipeline Expansion + Meta-Skill Governance (8 tasks, 49 pts):**
- TASK-0024: `data-ml-pipeline.json` template (13 pts)
- TASK-0025: `microservices.json` pipeline template (8 pts, blocked by TASK-0010)
- TASK-0026: `serverless-edge.json` pipeline template (5 pts, blocked by TASK-0011 + TASK-0018)
- TASK-0027: Automated quality-scoring gate on skill registration
- TASK-0028: `skill-lifecycle` stage enforcement — orchestrator v1.3.0→v1.4.0
- TASK-0029: API versioning strategy — architecture-design v1.3.0→v1.4.0
- TASK-0030: Effort estimation — change-impact-analyzer v1.1.0→v1.2.0
- TASK-0031: Stakeholder conflict detection — requirement-analyzer v1.2.0→v1.3.0

**Phase 5 task files — v5.0.0 Intelligence + Observability + DX (6 tasks, 47 pts):**
- TASK-0032: Cross-session analytics — session-insights v1.0.0→v1.1.0 (blocked by TASK-0015)
- TASK-0033: Smart routing — context-aware pipeline detection (prompt-normalizer v1.0.0→v1.1.0)
- TASK-0034: Website Skills page complete — all 59 skills displayed
- TASK-0035: Prometheus/OpenTelemetry spec — observability full rebuild v0.0.1→v2.0.0
- TASK-0036: Work item bidirectional Jira sync — work-item-exporter v1.0.0→v2.0.0 (blocked by TASK-0015)
- TASK-0037: Performance regression baseline — performance-guard v1.0.0→v1.1.0 (blocked by TASK-0015)

**Ecosystem health targets:**
- Current baseline: v5.1.0, 59 active skills, 16 pipeline templates, ecosystem health 8.2/10
- After Phase 1 (v4.1.0): consistency stabilized, all 5 state-writing skills have `dry_run`
- After Phase 2 (v4.2.0): 60 skills (+SKL-059/060), 2 new guards in phase-7b, session state live
- After Phase 3 (v4.3.0): 64 skills (+SKL-061–064), multi-locale pipeline chain complete
- After Phase 4 (v4.4.0): 64 skills, 18 pipeline templates (+3 new domains), meta-governance hardened
- After Phase 5 (v5.0.0): self-improving, observable platform. Ecosystem health target: **9.5/10**

**Critical path:** TASK-0001 → TASK-0009 → TASK-0010 → TASK-0025 → TASK-0026

---

## [5.3.0] — 2026-06-24

### Added — MCP Integration (8 Servers)

8 Model Context Protocol (MCP) servers added to `opencode.json` under the `mcp` key, giving all agents access to live GitHub, web search, persistent memory, URL fetching, library documentation, and browser automation.

**MCP servers added:**

| Server | Package | Enabled | Purpose |
|--------|---------|---------|---------|
| `github` | `@modelcontextprotocol/server-github` | ✅ | GitHub API — issues, PRs, commits, file read/write via `GITHUB_TOKEN` |
| `brave-search` | `@modelcontextprotocol/server-brave-search` | ✅ | Real-time web search via Brave Search API (`BRAVE_API_KEY`) |
| `memory` | `@modelcontextprotocol/server-memory` | ✅ | Persistent KV store for cross-turn context without session state writes |
| `fetch` | `@modelcontextprotocol/server-fetch` | ✅ | Arbitrary URL fetch and HTML→Markdown conversion |
| `context7` | `@upstash/context7-mcp@latest` | ✅ | Up-to-date library documentation and code examples (`CONTEXT7_API_KEY`) |
| `playwright` | `@playwright/mcp@latest` | ✅ | Headless Chromium browser automation (isolated, `--headless`, `--browser chromium`) |
| `slack` | `@modelcontextprotocol/server-slack` | ❌ (pre-configured) | Slack messaging — activate with `SLACK_BOT_TOKEN` + `SLACK_TEAM_ID` |
| `vercel` | `vercel-mcp` | ❌ (pre-configured) | Vercel deployment actions — activate with `VERCEL_TOKEN` |

**Environment variables added to `.env`:**
- `CONTEXT7_API_KEY` — required for context7 MCP
- `BRAVE_API_KEY` — required for brave-search MCP
- `GITHUB_TOKEN`, `VERCEL_TOKEN`, `SLACK_BOT_TOKEN`, `SLACK_TEAM_ID` — pre-existing slots confirmed

**New documentation:**
- `docs/mcp.md` — full MCP server reference: purpose, credentials, use cases, configuration notes

### Changed

- `opencode.json`: added top-level `mcp` key with 8 server definitions (6 enabled, 2 disabled)
- `opencode.json`: `playwright` command now includes `-y` flag for non-interactive npx execution
- `docs/governance.md`: §6 MCP Governance section added (tool access rules, credential policy, bypass behavior)

### Validation

- `validate-skills.sh` — 0 failures ✅
- `website` build — 117/117 pages ✅

---

## [5.2.0] — 2026-06-24

### Changed — Testing Enhancement Phase (test-generator v2.0.0, testing-strategy v2.0.0)

Major revision of the core testing pipeline — `test-generator` and `testing-strategy` both bumped to v2.0.0 with backward-incompatible output schema expansions. The `tester` agent now owns three skills.

**`test-generator` v1.x → v2.0.0 (SKL-028, MAJOR):**
- New `from_mutation_gaps` mode: reads `mutation-test-generator` assertion gaps as generation input
- BDD naming enforcement: `describe / it('should <behavior>')` structure in all output test files
- Property-based testing (PBT): generates `fast-check` (JS/TS), `hypothesis` (Python), `gopter` (Go), `proptest` (Rust), `jqwik` (Java) test cases from input constraint schemas
- Pact contract test generation: consumer-driven contract tests from API design artifacts
- Parameterized test generation: `jest.each`, `vitest.each`, `pytest.mark.parametrize`, table-driven Go, JUnit 5 `@ParameterizedTest`
- Test data factory generation: builder-pattern factories with `faker` / `factory_boy` / `go-faker` variants
- AAA structure enforcement: all generated tests include explicit Arrange / Act / Assert comment blocks
- Vitest support: added alongside Jest as a first-class JS/TS test runner target
- 8 flakiness rules: no random seeds without fixture, no `Date.now()` in assertions, no arbitrary `sleep()`, deterministic ordering, isolated state per test, no global mutation, bounded async timeouts, no network without mock
- New output fields: `property_tests`, `contract_tests`, `parameterized_suites`, `factory_files`, `bdd_naming_report`, `flakiness_violations`

**`testing-strategy` v1.x → v2.0.0 (SKL-005, MAJOR):**
- New output fields: `property_tests`, `contract_tests`, `parameterized_tests`, `test_data_strategy`, `test_double_map`, `naming_convention`, `flakiness_rules`
- Mutation score gate: domain logic ≥ 85%, infrastructure ≥ 70%, presentation ≥ 60%
- Test data strategy section: distinguishes factories, fixtures, builders, and seeded randomization
- Test double map: explicit spy/stub/mock/fake/dummy classification per dependency type

**`tester` agent expanded (opencode.json):**
- `skill` (single) → `skills` (array of 3): `testing-strategy`, `test-generator`, `mutation-test-generator`
- Agent description updated to reflect mutation scoring and CI enforcement responsibilities

**Registry and index updates:**
- `skills/registry.json`: v5.2.0 → v5.3.0; SKL-005 and SKL-028 updated to v2.0.0; all `testing-strategy@^1.x` and `test-generator@^1.0.0` references updated to `@^2.0.0`
- `skills/index.yaml`: v3.3.0 → v3.4.0; SKL-005 and SKL-028 entries updated with new tags and descriptions

### Validation

- `validate-skills.sh` — 0 failures ✅
- `website` build — 117/117 pages ✅

---

## [5.1.0] — 2026-06-24

### Added — Phase 6: Reactive Intelligence (5 FEATUREs, 24 SP)

- `gap-to-skill-pipeline` (SKL-065 v1.0.0, draft) — new reactive pipeline entry skill: restores gap context, pre-populates skill-authoring scaffold in gap_seed mode, runs quality scoring, enforces non-bypassable HITL approval before registration
- `skills/pipelines/gap-to-skill.json` — new pipeline template wiring gap-to-skill-pipeline → skill-authoring → quality-scoring with a human_approval gate
- `skills/schema/dedup-check-result.schema.json` — new schema for structured deduplication check results (DEDUP_CLEAR / DEDUP_HIT)
- `skills/schema/registry-entry.schema.json` — updated with `origin_metadata` object (source, approval_tier, dedup_override, created_by_session, created_at)
- `docs/governance.md` §5.1 — Skill Approval Tiers table (standard / expedited / legacy)

### Changed

- `behavioral-telemetry-collector` (SKL-047) v1.0.0 → v1.1.0: added `capability_gap` event type with `detected_domain` and `gap_id` fields
- `session-insights` (SKL-048) v1.0.0 → v1.1.0: added gap metrics output (total_capability_gaps, top_gap_domains, gap_ids)
- `orchestrator` v1.2.0 → v1.3.0: Step 1 gap detection block (emit capability_gap on routing no-match) + Step 0.5 retry check block (YES/NO/LATER, retry_in_progress guard) + two recursion guards
- `skill-authoring` (SKL-012) v1.0.0 → v1.1.0: Step 0 dedup guard (Jaccard similarity, HITL options A/B/C) + gap_seed operation enum + origin_metadata population at registration
- `skills/schema/system-state-schema.json`: added gap_context, gap_to_skill_active, retry_context, retry_in_progress properties; "gap-to-skill" appended to pipeline_template enum
- `skills/registry.json`: v4.0.0 → v5.1.0 (Phase 6 Reactive Intelligence layer)
- `skills/index.yaml`: v3.1.0 → v3.2.0 (SKL-065 entry added; 58 → 59 total skills)
- `skills/graph/skill-graph.yaml`: v2.7.1 → v2.8.0 (SKL-065 node + 4 edges; total_nodes 58 → 59, total_edges 158 → 162; SKL-012/047/048 versions bumped)

### Fixed

- BUG-009: FEATURE-001/plan.md — "Create" corrected to "Extend" for SKL-047/SKL-048
- BUG-010: FEATURE-004/plan.md + request.md — stale SKL-049 references corrected to SKL-065
- BUG-011: FEATURE-004/plan.md — `mode = gap_seed` corrected to `operation = gap_seed`
- BUG-012: `system-state-schema.json` — `"gap-to-skill"` appended to pipeline_template enum

### Validation

- `validate-skills.sh` — 97 passed, 0 failed ✅
- `website` test suite — 39 passed, 0 failed ✅

---

## [4.0.1] — 2026-06-23

### Fixed — Post-Implementation Review (8 bugs, 7 gaps resolved)

**CRITICAL / HIGH bugs (blocked release):**
- **BUG-1** — `skills/graph/skill-graph.yaml`: 6 wrong node IDs in edges for SKL-055/056 corrected: `SKL-020→SKL-021` (×2), `SKL-030→SKL-029` (×2), `SKL-017→SKL-028`, `SKL-023→SKL-024`. Dependency graph was structurally incorrect.
- **BUG-2** — `skills/index.yaml`: Wrong `depends_on` IDs for all 4 new skills corrected (same root cause as BUG-1). SKL-058 `depends_on` cleared to `[]` (guard skills have no skill dependencies per Layer 2 rules).
- **BUG-3** — `defect-manager/SKILL.md §13`: Stale `(SKL-030)` reference corrected to `(SKL-029)` for code-repair.
- **BUG-5** — `skills/pipelines/defect-lifecycle.json`: Closure HITL gate was incorrectly positioned `after_phase: phase-6-review` (before validation ran). Moved to `after_phase: phase-7b-completeness-guard` so the gate confirms a completed, validated fix.
- **BUG-6** — `skills/pipelines/change-request.json`: Removed redundant `phase-2-impact` (change-impact-analyzer was being invoked twice — once internally by change-request-manager, once as a pipeline phase). Impact approval gate moved to fire after `phase-1-intake`.

**MEDIUM bugs:**
- **BUG-4** — `orchestrator/SKILL.md`: Pipeline template table versions corrected from v1.0.0 to v1.1.0 for both `defect-lifecycle.json` and `change-request.json`.
- **BUG-7** — `skills/graph/skill-graph.yaml`: Indentation inconsistency fixed — new edges for SKL-054–058 used 4-space list indent instead of the file-standard 3-space. Normalised.
- **BUG-8** — `skills/registry.json`: Added missing `metrics` and `feedback` fields to `outputs` for all 4 new skills (SKL-055–058). `work-item-lifecycle-guard` also missing `item_id` output — added.

**Gaps resolved:**
- **GAP-1** — `skills/pipelines/change-request.json`: Added conditional scope-confirmation HITL gate (fires when `cr.new_requirements.length > 0`, timeout 3600s) after `phase-1-intake`.
- **GAP-2** — Both pipelines: Added `implementation-completeness-guard` phase immediately after `implementation-completeness-auditor` in both `defect-lifecycle.json` (`phase-7b-completeness-guard`) and `change-request.json` (`phase-6b-completeness-guard`).
- **GAP-4** — `defect-manager/SKILL.md` + `change-request-manager/SKILL.md`: Fixed `$ref` paths from non-existent `../../schema/system-state-schema.json` to correct `../../../skills/schema/system-state-schema.json`.
- **GAP-5** — `docs/work-item-foundation.md §4.3`: Added `blocked` state to BUG lifecycle state machine (diagram + transition table). Transitions `investigating → blocked` and `blocked → investigating` added. Aligns with `work-item-lifecycle-guard` implementation.
- **GAP-6** — `skills/pipelines/defect-lifecycle.json`: Added `phase-7c-closure-write` (state-manager) after the closure HITL gate to persist the `CLOSURE → closed` state transition in the audit trail.
- **GAP-7** — `skills/index.yaml`: Pre-existing version inconsistency for SKL-003 (feature-planning) corrected from `v1.2.0` to `v2.0.0`, aligning with registry.json and skill-graph.yaml.
- **GAP-8** — `skills/graph/skill-graph.yaml`: Added missing `SKL-021 → SKL-057` dependency edge (work-item-exporter reads from state-manager).

### Changed
- `skills/pipelines/defect-lifecycle.json`: v1.0.0 → v1.1.0 (added `phase-7b-completeness-guard`, `phase-7c-closure-write`; closure gate repositioned)
- `skills/pipelines/change-request.json`: v1.0.1 → v1.1.0 (removed `phase-2-impact`; added `phase-6b-completeness-guard`; gates updated; scope-confirmation gate added)

### Validation
- `validate-skills.sh`: **95/95 passed, 0 failed** ✅
- `graphify update .`: Graph rebuilt after all fixes ✅

---



### Added — Work Lifecycle Management Layer (Phases 5–6 Integration & Release)

**Phase 5 completes integration wiring, governance compliance, and token/state validation. Phase 6 completes documentation, version bumps, and release.**

**Routing (Phase 5.1):**
- **`.opencode/agent/primary.md`**: 3 new routing table entries added:
  - `"report a bug"`, `"defect found"`, `"this is broken"`, `"bug report"`, `"create defect"`, `"log a defect"` → `skills/pipelines/defect-lifecycle.json` / `analyzer`
  - `"change request"`, `"modify this requirement"`, `"scope change"`, `"CR"`, `"change the spec"`, `"update the requirements"` → `skills/pipelines/change-request.json` / `planner`
  - `"export tasks"`, `"export work items"`, `"sync to Jira"`, `"export to GitHub Issues"`, `"export work items to Jira"` → Direct skill invocation (`work-item-exporter`) / `builder`
  - Fallback message updated to include: defect tracking, change requests, work item export
- **`orchestrator/SKILL.md` v1.1.0 → v1.2.0**: Added "Supported Pipeline Templates" table with all 7 pipeline templates documented; `skills/registry.json` and `skills/graph/skill-graph.yaml` updated to match.

**Integration contract verification (Phase 5.2):**
- All 5 contracts verified: `feature-planning → defect-manager` (companion tasks via work_items scope), `defect-manager → code-repair` (FIX-NNNN task routing via orchestrator), `change-request-manager → change-impact-analyzer` (Step 3 direct invocation with input_map), `change-request-manager → feature-planning` (backpropagate feedback with task_delta), `all → work-item-exporter` (reads work_items scope + .md files).

**Governance compliance (Phase 5.3):**
- All new HITL gates verified: `type: human_approval`, no auto-continue, timeouts set (3600s or 7200s for CR impact gate).
- `work-item-lifecycle-guard` condition gates: `type: condition`, evaluates `lifecycle_guard.verdict !== 'block'` — correct behavior confirmed.

**Version bumps (Phase 6):**
- **`skills/registry.json`**: v3.0.0 → v4.0.0 (MAJOR: Work Lifecycle Management Layer fully wired)
- **`skills/graph/skill-graph.yaml`**: v2.7.0 → v2.7.1 (orchestrator node version update)
- **`docs/governance.md`**: v2.3.0 → v2.4.0 (Guard Inventory + HITL gate table)
- **`docs/workflows.md`**: v2.2.0 → v2.3.0 (defect lifecycle flow, CR flow, Phase 7b guard list, partial pipeline table)
- **`docs/architecture.md`**: v2.1.0 → v2.2.0 (Work Lifecycle Management Layer section)
- **`docs/system-overview.md`**: v3.0.0 → v4.0.0 (4 new capabilities: defect mgmt, CR mgmt, work item export, lifecycle enforcement)
- **`docs/agents.md`**: v1.1.0 → v1.2.0 (skill assignments for SKL-055–058)
- **`docs/skills-registry.md`**: v2.8.0 → v3.0.0 (4 new skill catalog entries, index count 51→58)

**Release ADR:**
- **`docs/adr/ADR-0003-work-lifecycle-layer-release.md`**: Records release scope, architectural decisions, integration contracts, bugs fixed, and validation gate status.

### Fixed

- **`skills/pipelines/change-request.json`** v1.0.0 → v1.0.1: `feature-planning` version constraint corrected from `"^1.2.0"` to `"^2.0.0"` — semver `^1.2.0` would not resolve to v2.0.0 (major version boundary). Now correctly targets the companion-generation-enabled v2.0.0.
- **`defect-manager/SKILL.md` §12**: Closure gate timeout corrected from 7200s to 3600s to match `defect-lifecycle.json` pipeline definition.
- **`change-request-manager/SKILL.md` §12**: Impact approval gate timeout corrected from 3600s to 7200s to match `change-request.json` pipeline definition (CR impact review justifies a longer window).

### Phase 5 Gate Checklist

| Check | Status |
|---|---|
| All end-to-end integration contracts verified | ✅ PASS |
| Governance compliance: all HITL gates conform to governance.md | ✅ PASS |
| State size validated (104KB < 512KB budget) | ✅ PASS |
| Token budgets within tier limits (write agent: 100K) | ✅ PASS |
| `validate-skills.sh` 95/95 | ✅ PASS |

### Phase 6 Gate Checklist

| Check | Status |
|---|---|
| All documentation updated per governance.md sync rules | ✅ PASS |
| `validate-skills.sh` passes | ✅ PASS (95/95) |
| Changelog entry complete and accurate | ✅ This entry |
| ADR for the release written and in adr_index | ✅ ADR-0003 |
| Registry version bumped (3.0.0 → 4.0.0) | ✅ PASS |
| Stakeholder sign-off: Work Lifecycle capability | ⏳ Pending human review |

---

## [3.1.0] — 2026-06-23

### Added — Work Lifecycle Management Layer (Phase 3 Infrastructure)

**Phase 3 completes the infrastructure and registry wiring for the 4 Work Lifecycle skills authored in Phase 2.**

**State infrastructure:**
- **`state-manager/SKILL.md` v1.1.0 → v1.2.0**: Added `"work_items"` to `scope` enum (both Inputs table description and JSON Schema). Enables all 4 new lifecycle skills to read/write the `work_items` state scope via the standard state-manager interface.

**Event routing:**
- **`event-router/SKILL.md` v1.0.0 — Built-in Dispatch Map extended**: 5 new event type registrations:
  - `defect.created` → `orchestrator` (triggers defect chain orchestration)
  - `defect.resolved` → `doc-maintainer` (auto-syncs documentation on defect closure)
  - `change_request.created` → `change-impact-analyzer` (auto-triggers impact analysis)
  - `change_request.approved` → `feature-planning` (re-invokes planning with approved task delta)
  - `work_item.state_changed` → `doc-maintainer`, `behavioral-telemetry-collector` (tracks lifecycle transitions in telemetry)

**Skill registry:**
- **`skills/index.yaml` → v3.1.0**: 4 new entries added (SKL-055, SKL-056, SKL-057, SKL-058); section header `# ── WORK LIFECYCLE MANAGEMENT LAYER (SKL-055 to SKL-058)` added; 58 total skills.

**Pipeline templates (2 new):**
- **`skills/pipelines/defect-lifecycle.json` v1.0.0**: 9-phase pipeline for the full defect lifecycle: defect intake → triage HITL → root cause investigation → fix implementation → lifecycle guard validation → regression test generation → fix review → completeness validation → async export + doc sync. Two HITL gates: triage confirmation (priority + severity), fix approval before closure.
- **`skills/pipelines/change-request.json` v1.0.0**: 8-phase pipeline for change requests: CR intake → impact analysis → HITL approval → re-planning → lifecycle guard → code generation (conditional) → completeness audit → async export + doc + ADR sync. Two HITL gates: impact approval (modules/tasks/effort delta), scope delivery confirmation.

**Skill graph:**
- **`skills/graph/skill-graph.yaml` → v2.7.0**: 4 new nodes (SKL-055–058); 16 new edges covering defect-manager's code-repair/test-generator/clean-code-review/exporter/guard composition links, change-request-manager's change-impact-analyzer dependency and feature-planning backpropagation, state-manager dependencies for both lifecycle skills, and lifecycle guard co-occurrence edges; `total_nodes: 58`, `total_edges: 158`.

### Changed — Existing Infrastructure

- **`skills/pipelines/full-pipeline.json` → v3.0.0**:
  - Added `work-item-lifecycle-guard` (SKL-058) to `phase-7b-guards` parallel guard group. Guard runs alongside database-guard, performance-guard, ui-ux-compliance-guard, and security-guard.
  - Added `phase-8d-defect-management` (conditional on `defects_detected === true OR missings_count > 0`): invokes `defect-manager` when completeness audit or code-repair surfaces defects/missings.
  - Added `phase-10b-export` (async): invokes `work-item-exporter` at pipeline completion alongside documentation phases.
  - Updated `parallel_groups` to include `work-item-lifecycle-guard` in the guard parallel group.
  - Updated `async_skills` to include `work-item-exporter`.

- **`skills/graph/skill-graph.yaml`**: `feature-planning` node version corrected from `1.2.0` to `2.0.0` to match `skills/registry.json` (graph was stale from Phase 2 bump).

### Validation

- `validate-skills.sh`: **95/95 passed, 0 failed** — all 15 pipeline JSON schemas valid, all 58 SKILL.md section checks passed (8 skipped as meta-format), all skill IDs unique, skill counts match (58 index ↔ 58 on disk ↔ 58 graph nodes), all opencode.json paths exist, all registry↔graph versions consistent.

### Phase 3 Gate Checklist (from implementation-plan-work-lifecycle.md)

| Gate Check | Status |
|---|---|
| `system-state-schema.json` extended with `work_items` scope | ✅ Done (Phase 2 — pre-existing) |
| All 15 existing pipelines validate against `pipeline-schema.json` | ✅ PASS |
| `state-manager` accepts the new `work_items` scope | ✅ Done — added to scope enum |
| Event-router dispatch map includes 5 new event types | ✅ Done |
| `skills/registry.json` includes all new skill entries (SKL-055–058) | ✅ Done (Phase 2 — pre-existing) |
| `validate-skills.sh` passes (58 skills) | ✅ 95/95 PASS |
| No existing skill or agent configuration broken | ✅ Confirmed |

**Phase 3 complete. Next: Phase 4 — Skill Implementation (feature-planning v2.0.0 companion generation, defect-manager, change-request-manager, work-item-exporter, work-item-lifecycle-guard full execution logic).**

---

## [3.0.0] — 2026-06-21

### Added — Frontend UI/UX Enhancement (Phase 1)

**`motion-design-architect` v1.0.0 (SKL-052):**
- New skill: designs the complete motion system for a product. 10-step execution: motion philosophy derivation (functional/expressive/immersive/cinematic), motion token set (duration/easing/spring/stagger tiers), micro-interaction specs (GPU-safe transform+opacity only), page transition designs (fade/slide/shared-element/morph), scroll experience specs (reveal/parallax/progress-linked), advanced choreography and physics throws, 3D integration specs (Spline/R3F/CSS perspective), accessibility motion ruleset (100% prefers-reduced-motion coverage required), quality preview scoring. Enforces: GPU-composited properties only, stagger ≤ 12 items, choreography ≤ 2000ms, 3D GPU budget declaration mandatory.

**`ux-research-synthesizer` v1.0.0 (SKL-053):**
- New skill: evaluates any UX design against evidence-based usability principles. 7-step execution: user journey reconstruction with cognitive load and emotional state, full 15-heuristic evaluation (Nielsen's 10 + 5 modern digital extensions), 15 friction pattern detection (F1–F15 library), information architecture scoring (5 dimensions), accessibility experience audit (screen reader / keyboard / cognitive / situational), prioritized recommendations, and UX health score (0–100). ux_health_score ≤ 60 triggers automatic backpropagation to frontend-ux-architect.

**`creative-experience-architect` v1.0.0 (SKL-054):**
- New skill: architects world-class, emotionally resonant interfaces beyond standard enterprise patterns. 7-step execution: product identity analysis → creative archetype derivation (6 archetypes), innovative layout pattern exploration (bento grid / editorial / command palette / spatial canvas / layered depth / immersive full-screen), story-driven flow design (Act 1 hook → Act 2 educate → Act 3 convert), immersive background specs (5 techniques), premium component enhancement specs (button/card/nav/input/modal/table with micro-delight patterns), expressive typography system spec, ranked creative brief with scoring formula. References: Linear, Raycast, Arc Browser, Stripe, Apple, Figma, Airbnb, Vercel, Notion, Awwwards.

### Changed — Evolved UI/UX Skills (MAJOR version bumps)

**`frontend-ux-architect` v1.1.0 → v2.0.0 (SKL-031):**
- MAJOR: new input `creativity_level` (`standard` | `premium` | `world-class`) activates premium design reference patterns and expanded visual excellence evaluation.
- MAJOR: new input `motion_requirements` (array of motion categories) triggers full motion spec generation (Step 10).
- New Step 9: visual excellence standards — typography spec, color system, depth system (glassmorphism/elevation), spatial harmony.
- New Step 10: motion specification brief (consumed by SKL-052) — micro-interactions, page transitions, scroll experiences, advanced motion, 3D elements, reduced-motion fallbacks.
- New layout_type values: `bento`, `editorial`, `immersive` (in addition to existing types).
- New output fields: `visual_excellence_targets`, `motion_spec`, `creative_recommendations`.
- Updated `token_requirements.category` enum: adds `blur`, `elevation`, `glass`, `variable-font`.
- Updated accessibility_report: adds `motion_safe` and `high_contrast_ready` boolean fields.
- Rule: `motion_safe: true` now required — every animation must have prefers-reduced-motion fallback.
- Rule: `visual_excellence_targets` mandatory when `creativity_level` ≠ `standard`.

**`design-system-generator` v1.0.0 → v2.0.0 (SKL-038):**
- MAJOR: new input `visual_excellence_targets` from frontend-ux-architect v2.0.0.
- MAJOR: new input `motion_spec` — enables motion token generation from spring parameters.
- MAJOR: new input `theme_modes` array — generates light, dark, high-contrast, and accessibility themes.
- Step 1: implicit motion tokens always generated (duration, easing, spring, stagger presets).
- Step 1: implicit elevation tokens always generated (5 elevation levels).
- Step 1: implicit blur tokens always generated (4 blur levels).
- Step 3: semantic tokens now cover motion, elevation, and glass namespaces.
- Step 5: multi-theme config — `data-theme` attribute overrides + `@media (prefers-reduced-motion)` block always emitted.
- Step 6: variable font configuration from typography_spec (new).
- Step 8: Storybook preview.ts now includes theme toggle toolbar and a11y addon.
- New output field: `motion_tokens` summary.
- Rule: `@media (prefers-reduced-motion)` block always emitted — mandatory.
- Rule: glass tokens auto-removed from accessibility theme.

**`ui-ux-compliance-guard` v1.0.0 → v2.0.0 (SKL-036):**
- MAJOR: three new quality score dimensions added to output.
- New Step 6: `visual_quality_score` (4 dimensions × 25 = 100): consistency, modernity, brand_alignment, professional_appearance.
- New Step 7: `ux_quality_score` (4 dimensions × 25 = 100): discoverability, learnability, efficiency, accessibility.
- New Step 8: `motion_quality_score` (4 dimensions × 25 = 100): smoothness, purpose, performance, user_impact (null when no motion_spec).
- New block condition: `prefers-reduced-motion` guard missing on any animation.
- New block threshold: `visual_quality_score.total` must meet minimum per `creativity_level` (standard: 40, premium: 70, world-class: 85).
- New output field: `improvement_recommendations` — generated for all dimensions scoring < 80.

### Changed — Registry, Graph & Indices

- **`skills/registry.json` → v3.0.0**: 3 new entries (SKL-052, SKL-053, SKL-054); version bumps for SKL-031, SKL-036, SKL-038.
- **`skills/index.yaml` → v3.0.0**: 3 new entries; tags expanded for SKL-031/036/038; 54 total skills.
- **`skills/graph/skill-graph.yaml` → v2.5.0**: 3 new nodes; 8 new edges; `total_nodes: 54`, `total_edges: 142`.
- **`skills/knowledge/frontend-ux-architect.md` → v2.0.0**: expanded with advanced layout patterns, motion principles, visual excellence standards, creative reference library, and full anti-pattern list.
- **`skills/knowledge/motion-design-architect.md` → v1.0.0**: new — motion token architecture, micro-interaction patterns, library selection guide, scroll patterns, 3D decision matrix, performance budgets, accessibility motion standards.
- **`skills/knowledge/ux-research-synthesizer.md` → v1.0.0**: new — Nielsen's 15 heuristics, friction pattern library, IA quality dimensions, severity classification, UX health formula.
- **`skills/knowledge/creative-experience-architect.md` → v1.0.0**: new — creative archetype library, layout pattern reference, premium component patterns, typographic excellence guide, background system techniques, story-driven interface structure.

---

## [2.8.0] — 2026-06-20

### Added — Assisted Adaptation Pipeline (Phase 3)

**`adaptive-proposal-generator` v1.0.0 (SKL-050):**
- Full 13-section SKILL.md. Reads `behavioral_telemetry.session_summary` from session-insights (SKL-048) and up to 10 historical summaries for trend analysis. Five detection algorithms: failure pattern analysis (failure_rate > 30%), HITL rejection analysis (rejection_ratio ≥ 30%), feedback loop gap detection (recurring unhandled transitions), pipeline routing analysis (3+ skills always together → propose new template), inactivity detection (zero invocations over ≥ 5 sessions → propose retire). Generates ranked `AdaptationProposal[]` with confidence scores, effort estimates, and evidence. All proposals have `hitl_status: "pending"` — enforced by output schema `enum: ["pending"]`. Suggestion-only — never writes to any file.

**`adaptation-applicator` v1.0.0 (SKL-051):**
- Full 13-section SKILL.md. HITL approval check is first and unconditional — any proposal with `hitl_status != "approved"` halts immediately with `HITL_APPROVAL_REQUIRED`. Creates rollback checkpoint (registry + index + graph + opencode.json) before any write. Five change handlers: `new_skill` (delegates to skill-authoring SKL-012), `modify_skill` (updates SKILL.md + bumps version), `retire_skill` (marks deprecated + adds deprecation notice), `new_pipeline` (generates pipeline JSON + validates against pipeline schema), `new_agent` (creates agent instruction file + updates opencode.json). Runs `validate-skills.sh` and `npm run build` after every change. Auto-rollback on validation or build failure. Triggers doc-maintainer (SKL-011) on success. `dry_run: true` supported — always safe.

### Changed — Registry & Governance

- **`skills/registry.json` → v2.8.0**: 2 new entries (SKL-050, SKL-051).
- **`skills/index.yaml` → v2.8.0**: 2 new entries; section `# ── ASSISTED ADAPTATION SKILLS (SKL-050 to SKL-051)` added; 51 total skills.
- **`skills/graph/skill-graph.yaml` → v2.4.0**: 2 new nodes (SKL-050, SKL-051); 8 new edges; `total_nodes: 51`, `total_edges: 134`.
- **`docs/governance.md` → v2.2.0**: Layer 5 Adaptive Governance updated for Phase 3 — core principle changed from "Suggestion-Based, Not Autonomous" to "Assisted Adaptation — Human in the Loop at Every Step"; adaptation execution rules table added; SKL-050/051 coverage added to allowlist; 7 Layer 5 invariants (was 5).
- **`docs/skills-registry.md` → v2.8.0**: SKL-050 and SKL-051 entries added.
- **`skills/schema/system-state-schema.json`**: Added `"insights-adaptation-pipeline"` to `pipeline_template` enum. Enables sessions driven by the full observability+adaptation pipeline to have a valid state schema.
- **`skills/pipelines/insights-adaptation-pipeline.json` v1.0.0**: Named pipeline template for the full SKL-047→SKL-051 chain. Phases: telemetry collection → insights + dashboard (parallel) → adaptive proposals → HITL-gated adaptation application → async doc sync. Three gates: condition gate (skip if no actionable patterns), non-bypassable human-approval gate after proposals, condition gate confirming successful application. Recovery via `rollback-manager`.

---

## [2.7.0] — 2026-06-20

### Added — Lightweight Observability Pipeline (Phase 1–2)

**`behavioral-telemetry-collector` v1.0.0 (SKL-047):**
- Full 13-section SKILL.md. Opt-out gate is first and unconditional — no data collected if `behavioral_telemetry.opt_out === true`. PII scrubber applied to all string fields before any state write. Collects only enum-bound and numeric fields: `event_type`, `skill_name`, `timestamp`, `session_id`, `duration_ms`, `outcome`, `hitl_verdict`, `pipeline_phase`. Ring-buffer storage: 500-event cap per session (oldest dropped). Timestamps generated internally — never from caller input. Async fire-and-forget — never blocks pipeline.
- Writes to `state-manager` scope `behavioral_telemetry.events` only.

**`session-insights` v1.0.0 (SKL-048):**
- Full 13-section SKILL.md. Reads `behavioral_telemetry.events`; computes per-skill metrics: invocation count, success rate, failure rate, p95 latency (5-sample minimum; degrades gracefully), HITL rejection ratio. Session aggregates: total skills invoked, total gates, approval rate, feedback loop count. Anomaly detection: flags skills with failure_rate > 30% or HITL rejection_ratio > 30% (warning feedback — no pipeline halt). Read-only on events array.
- Writes only to `behavioral_telemetry.session_summary`.

**`enhancement-dashboard` v1.0.0 (SKL-049):**
- Full 13-section SKILL.md. Read-only renderer — never writes to system state. Converts `session_summary` to structured Markdown + JSON report with 5 sections: header, session overview table, per-skill performance table (sorted by invocation count DESC), anomalies section, and session health verdict (Healthy / Degraded / Failed). Supports `render_format: markdown` (default) or `json_only`. Returns minimal "no telemetry" report if summary absent.

### Added — Pipeline Template

**`insights-pipeline` (enum value added to `system-state-schema.json`):**
- Added `"insights-pipeline"` to `pipeline_template` enum in `system-state-schema.json`. Enables sessions driven by the observability pipeline to have a valid state schema.

### Changed — Registry & Schema

- **`skills/registry.json` → v2.7.0**: 3 new entries (SKL-047, SKL-048, SKL-049); new `insights-pipeline` parallel group added (`behavioral-telemetry-collector` + `session-insights`).
- **`skills/schema/system-state-schema.json`**: Added optional `behavioral_telemetry` object field (NOT in `required[]` — backward-compatible for all 46 existing skill consumers). Field includes: `enabled`, `opt_out`, `pii_scrubbed`, `events[]`, `session_summary`, `last_collection_at`. Added `"insights-pipeline"` to `pipeline_template` enum.
- **`docs/skills-registry.md`** → v2.7.0: entries for SKL-047–049 added.
- **`docs/architecture.md`** → v2.1.0: new Lightweight Observability Pipeline section with unidirectional module topology diagram and event flow diagram.
- **`docs/governance.md`** → v2.1.0: governance model updated from 4 layers to 5 layers; Layer 5 Adaptive Governance section added with opt-out rules, PII protection rules, telemetry retention policy, adaptation scope allowlist, and 5 Layer 5 invariants.

### Security

- **`skills/schema/pipeline-schema.json`** (pre-existing vulnerability fixed):
  - Added `if/then` constraint to gate schema: when `timeout: 0`, `bypass_on_timeout` is enforced as `const: false` at schema validation time. Previously, a crafted pipeline could set `bypass_on_timeout: true` on a zero-timeout gate (including the deployment gate) while passing schema validation silently.
  - Added `minItems: 1` to top-level `gates` array: an empty `gates: []` declaration is now a schema validation error. Previously, an empty array was schema-valid and would silently omit all configured gate checks.

---

## [2.6.0] — 2026-06-18

### Added — New Domain Specialist Layer (Phase 2c)

**`ai-agent-specialist` v1.0.0 (SKL-043):**
- Full 13-section SKILL.md. 8-step execution: agent type inference (single_agent/multi_agent/rag_pipeline/tool_use/fine_tuned), architecture pattern selection (ReAct/Supervisor-Worker/RAG/tool-use), prompt engineering standards (injection pattern library), memory architecture (in-context/external/episodic/procedural), token budget and cost model, evaluation framework (functional/safety/performance/regression evals), AI safety controls, and `domain_constraints` assembly.
- Non-bypassable security-guard rule: `prompt_injection_open` — pipeline cannot advance without code remediation.
- `safety_level: "high"` activates secondary safety model, mandatory disclaimers, and zero-hallucination policy for medical/legal/financial/child-facing AI.

**`mobile-platform-specialist` v1.0.0 (SKL-044):**
- Full 13-section SKILL.md. 8-step execution: technology stack inference (native iOS/Android/RN/Flutter/MAUI), architecture pattern selection per stack, offline-first strategy (simple caching/optimistic UI/full CRDT), push notification architecture (APNs/FCM/rich push), mobile security controls (certificate pinning, Keychain/Keystore, server-side IAP validation, jailbreak detection), App Store/Play Store compliance requirements, device matrix (minimum OS versions, screen sizes, performance budgets), and `domain_constraints` assembly.
- Implementation checklist of 18 items emitted to builder agent.
- Pipeline: `skills/pipelines/mobile-app.json`.

**`saas-enterprise-architect` v1.0.0 (SKL-045):**
- Full 13-section SKILL.md. 8-step execution: tenancy model selection (shared_db/schema_per_tenant/db_per_tenant/hybrid with trade-off table), RBAC architecture (platform roles + per-tenant customizable roles), subscription billing (Stripe/Stripe+Lago/Chargebee, dunning schedule, webhook idempotency), enterprise SSO (SAML 2.0 + OIDC + SCIM, JIT provisioning, domain verification), compliance framework controls (SOC 2 TSC, ISO 27001 Annex A, HIPAA technical safeguards, GDPR Articles 17/20/25/30/33, PCI DSS tokenization, FedRAMP FIPS 140-2), white-labeling (custom domains, SSL automation, runtime theme injection), audit logging (append-only, hash-chained, 1-year retention), and `domain_constraints` assembly.
- Tenant isolation failure flagged as non-bypassable block in security-guard.
- Implementation checklist of 20 items emitted to builder agent.
- Pipeline: `skills/pipelines/saas-platform.json`.

**`systems-specialist` v1.0.0 (SKL-046):**
- Full 13-section SKILL.md. 8-step execution covering both embedded/IoT and game development: system type inference (bare-metal/RTOS/IoT edge/IoT cloud/game_2d/3d/multiplayer), architecture pattern selection (superloop/RTOS task model/ECS/server-authoritative netcode), memory budget (static allocation, per-task stack sizing, VRAM/RAM/audio game budgets), IoT communication protocols (MQTT QoS, CoAP, LoRaWAN payload limits, BLE GATT, CAN bus arbitration), OTA firmware update (dual-bank flash, CRC verify, rollback, signed firmware, staged rollout), safety standard controls (IEC 62443 zones/conduits, ISO 26262 ASIL decomposition, IEC 61508 SIL levels), and `domain_constraints` assembly.
- Hardcoded credential detection is NON-BYPASSABLE for embedded_iot domain (security-guard).
- Game development: ECS SoA memory layout, draw call budget enforcement, server-authoritative multiplayer, anti-cheat requirements.
- Implementation checklist of 17 items (IoT section) + 12 items (game section) emitted to builder agent.
- Pipeline: `skills/pipelines/iot-embedded.json`.

### Added — New Pipeline Templates

**`skills/pipelines/ai-agent-system.json` v1.0.0:**
- 17 phases. Domain: `ai_agent`. Adds `phase-2c-domain` (ai-agent-specialist) and `phase-2d-architecture-refine` (architecture-design second pass with domain_constraints). security-guard configured with `domain: "ai_agent"` — prompt injection non-bypassable gate. testing-strategy configured with LLM eval hints (hallucination detection, prompt regression, tool call mocking). 10 HITL gates including dedicated gate for AI domain constraint approval (critical for regulated AI).

**`skills/pipelines/mobile-app.json` v1.0.0:**
- 17 phases. Domain: `mobile`. Adds `phase-2c-domain` (mobile-platform-specialist) and `phase-2d-architecture-refine`. frontend-ux-architect configured with `platform_hint: "mobile"`. performance-guard configured with mobile budgets (cold start < 2s, 60fps, < 150MB RAM). 11 HITL gates including App Store submission readiness gate.

**`skills/pipelines/saas-platform.json` v1.0.0:**
- 18 phases. Domain: `saas`. Adds `phase-2c-domain` (saas-enterprise-architect) and `phase-2d-architecture-refine`. database-architect configured with `mode: "multi_tenant"`. security-guard checks tenant scope enforcement and compliance controls. deployment-strategy configured with `blue_green` + tenant staged rollout hints. 12 HITL gates including compliance framework declaration gate.

**`skills/pipelines/iot-embedded.json` v1.0.0:**
- 17 phases. Domain: `embedded_iot`. Adds `phase-2c-domain` (systems-specialist) and `phase-2d-architecture-refine`. code-generator configured with MISRA-C 2012 coding standard. security-guard configured with `domain: "embedded_iot"` — hardcoded credentials and unsigned OTA are non-bypassable blocks. testing-strategy configured with HIL testing, WCET analysis, MISRA static analysis hints. ci-pipeline-generator configured with embedded build system hints (CMake, PlatformIO, Zephyr West, ESP-IDF).

### Changed — Existing Skill Enhancements

**`architecture-design` → v1.3.0:**
- Added `domain_constraints` input field (object from any phase-2c domain specialist).
- Added integration patterns reference table in Step 4: 11 patterns (REST, gRPC, GraphQL, Event/MQ, Shared DB, WebSocket, Webhook, SSE, File/S3, MQTT, CAN Bus) with when-to-use / avoid-when guidance.
- `domain_constraints.integration_patterns_required` overrides generic pattern defaults.

**`database-architect` → v1.1.0:**
- Added `domain_constraints` input field (object from `saas-enterprise-architect`).
- Added Step 0: multi-tenant schema strategy — four paths: shared_db (PostgreSQL RLS policy template), schema_per_tenant (migration orchestration, search_path), db_per_tenant (provisioning automation, connection registry), hybrid (promotion path shared→dedicated).

**`frontend-ux-architect` → v1.1.0:**
- Added `domain_constraints` input field (object from `mobile-platform-specialist`).
- Added Step 9 (mobile/PWA): mobile-first layout constraints (iOS/Android platform navigation patterns, 44pt/48dp touch targets, safe area insets, haptic feedback patterns, list virtualization), PWA capability checklist (Service Worker caching strategy, Web App Manifest, install affordance, offline fallback page, app shell architecture), browser compatibility matrix (Baseline 2023+, Safari-specific flags).
- Old Step 9 (assemble) renumbered to Step 10.

### Changed — Registry & Index

- `skills/registry.json` → v2.6.0: 6 skill entries updated (architecture-design v1.3.0, database-architect v1.1.0, frontend-ux-architect v1.1.0); 4 new entries added (ai-agent-specialist SKL-043, mobile-platform-specialist SKL-044, saas-enterprise-architect SKL-045, systems-specialist SKL-046).
- `skills/index.yaml` → v2.6.0: same updates; comment header `# ── PHASE 2 DOMAIN SPECIALISTS (SKL-043+)` section extended with SKL-044/045/046 entries.
- `docs/skills-registry.md` → v2.6.0: entries for SKL-041–046 added; enhanced skills table for v2.6.0 changes.

---

## [2.5.0] — 2026-06-18

### Changed (EETF Selective Adoption — 6 skills updated)

**`feature-planning` → v1.2.0** (G1 + G2 + G4 + C3 + E04):
- `tasks[]` schema: added `req_ids: string[]` (required, replaces deprecated `requirements` alias), `definition_of_done: string[]` (required, min 1 item), `acceptance_criteria: string[]` (required, min 1 item), `status: enum[pending|in_progress|in_review|complete|blocked]`.
- New output field `req_task_map: { [REQ-ID]: TASK-ID[] }` — authoritative forward-link from requirements to tasks; consumed by implementation-completeness-auditor as Tier 1 mapping source.
- Step 0 added: graphify retrieval-first (`graphify query "task decomposition and module patterns"`).
- Step 2 expanded: now derives `definition_of_done`, `acceptance_criteria`, and `req_ids` per task.
- Step 7 expanded: assembles `req_task_map` before generating roadmap; flags requirements with no tasks as CRITICAL UNPLANNED risk.
- Rules updated: every task must have `req_ids`, `definition_of_done`, and `acceptance_criteria`; every requirement must appear in `req_task_map`.
- Composition version updated to `^1.2.0`.

**`code-generator` → v1.1.0** (E03):
- Step 4 expanded: now emits `@req TASK-XXXX REQ-NNN` annotations in doc stubs for every public function/class mapped to a feature-plan task (TypeScript: JSDoc `@req`; Python/Go/Rust: `# // @req` comment). Multiple `@req` lines for tasks covering multiple requirements.
- Rule added: every public artifact mapped to a feature-plan task MUST carry at least one `@req` annotation; omission logged as feedback warning.
- Quality Checklist: added `@req` annotation coverage check.

**`implementation-completeness-auditor` → v1.1.0** (G4 + G1):
- Step 2 rewritten with three-tier mapping priority: (1) `feature_plan.req_task_map` — authoritative, (2) `@req` annotations — explicit, (3) naming conventions — fallback only. Each traceability matrix entry now carries a `source` field (`task_map` | `annotation` | `naming` | `unmapped`).
- Step 7.5 added: Definition of Done verification — for each task with `definition_of_done[]`, checks each DoD item against code_map, test_state, and db_entities; produces `dod_summary[]` per task.
- `dod_summary` added to output schema and `required` array: `{ task_id, satisfied_count, total_count, violations[] }`.
- `traceability_matrix` items extended with `source` field.
- Quality Checklist: added DoD verification check and source field check.

**`testing-strategy` → v1.2.0** (G2):
- Input schema `tasks[]` item extended: added optional `req_ids` and `acceptance_criteria` fields.
- Step 4 rewritten: primary edge case source is now `tasks[].acceptance_criteria` (each AC entry produces ≥1 happy-path TC + ≥1 edge case EC, tagged `ac_derived: true`); secondary source is requirement boundary analysis.
- Rule added: if `tasks[].acceptance_criteria` provided, every AC entry must produce at least one TC and EC.

**`requirement-analyzer` → v1.2.0** (E04):
- Required Context: graphify retrieval-first note added.
- Step 0 added: `graphify query "domain entities and existing requirements"` — aligns vocabulary, avoids REQ ID collisions, seeds domain_hints.
- Composition version updated to `^1.2.0`.

**`architecture-design` → v1.2.0** (E04):
- Required Context: graphify retrieval-first note added.
- Step 0 added: `graphify query "existing modules, boundaries, and architectural patterns"` — avoids recreating already-defined module boundaries, surfaces proven pattern choices.
- Composition version updated to `^1.2.0`.

### Changed (Registry & Graph)

- `skills/index.yaml` → v2.5.0: version bumps for SKL-001, SKL-002, SKL-003, SKL-005 (→1.2.0), SKL-026, SKL-033 (→1.1.0).
- `skills/registry.json` → v2.5.0: same 6 version bumps; `produces_for` references aligned.
- `skills/graph/skill-graph.yaml` → v2.2.0: same 6 node version bumps.

### Context (EETF Adoption Decision)

Implements 5 of 6 recommended EETF adoptions (G1–G4, E03, E04, C3). Skipped: G3 (Evidence of Completion — bookkeeping overhead), G5 (Completion Report — deferred to v2.6.0 alongside `documentation-generator` extension), G6 (Dashboard — deferred post-v3.0). Rejected EETF proposals: Phase 3 subfolder migration (high cost, zero value), sequential waterfall execution (conflicts with event-driven architecture).

---

## [2.4.2] — 2026-06-18

### Added

- **`docs/eetf-validation-report.md`** — Full validation report for the Engineering Execution & Traceability Framework (EETF) against ASE-OS v2.4.1. Covers: phase-by-phase coverage analysis (13 components scored), genuine gap analysis (6 gaps identified), conflict analysis (3 conflicts, 2 rejected, 1 partial adopt), selective adoption plan (G1–G5 + C3), implementation cost estimate (~11.5 hours), and final adoption verdict.

### Key Findings (EETF Validation)

- **~82% of EETF** is already covered by existing ASE-OS skills.
- **4 genuine additions** recommended for adoption (G1–G4): Definition of Done, Acceptance Criteria, Evidence of Completion, REQ→TASK forward link — all target `feature-planning` + `implementation-completeness-auditor`.
- **1 new artifact** recommended (G5): Completion Report document via `documentation-generator`.
- **2 EETF conflicts rejected**: `/docs/` subfolder hierarchy (breaks 20 files + doc-maintainer); sequential waterfall execution model (conflicts with event-driven parallel architecture).
- **Implementation scope**: ~11.5 hours, fits within planned v2.5.0 milestone alongside E01–E06.
- **Status**: Awaiting user approval before any implementation begins.

---

## [2.4.1] — 2026-06-18

### Added

- **`docs/skill-ecosystem-audit.md`** — Comprehensive audit of all 40 SKILL.md files. Covers: complete skill inventory table (domain, version, lines, format, mastery), per-skill assessments grouped by domain, cross-skill architecture review (overlaps, inconsistencies, missing capabilities), prioritized enhancement list (E01–E24, 3 priority tiers), 7 new skill recommendations (ci-pipeline-generator, security-guard, api-contract-guard, environment-config-manager, bundle-size-guard, release-notes-generator, localization-architect), and a 4-milestone roadmap to v3.0.

### Key Findings (Audit)

- **observability** (SKL-013) is rebuild-required — 108 lines with no input schema, execution logic, or HITL gates.
- **5 state-writing skills** lack `dry_run` flag: adr-generator, database-architect, frontend-ux-architect, design-system-generator, and seo-optimizer.
- **`@req` annotation gap** — implementation-completeness-auditor relies on `@req REQ-001` code annotations but code-generator never emits them.
- **3 skills** lack graphify retrieval-first integration: requirement-analyzer, architecture-design, feature-planning.
- **Deployment–artifact gap** — deployment-strategy produces strategy docs but no CI/CD YAML (GitHub Actions, GitLab CI) is generated.
- **4 governance guards** are missing: security-guard, api-contract-guard, bundle-size-guard, accessibility-guard.
- **Overall ecosystem health: 7.8/10** — Full pipeline wired, all tests pass; enhancement priorities in audit would raise to 9+/10.

---

## [2.4.0] — 2026-06-18

### Added

- **Graphify knowledge graph** — `graphify update .` run against full codebase; 2,234 nodes, 2,314 edges, 191 communities generated in `graphify-out/`. OpenCode plugin wired via `.opencode/plugins/graphify.js` and `.opencode/opencode.json`. `AGENTS.md` updated with graphify usage rules.
- **`scripts/cleanup-sessions.sh`** — Prune `.opencode/state/sessions/` files older than 30 days. Supports `--delete` (default dry-run) and `--days N`. Respects `last_session.txt` — clears pointer if referenced session is deleted.
- **`context_ttl` field** — Added `context_ttl: { expires_at, policy, auto_archive }` to the `session_context` schema in `context-memory/SKILL.md`.
- **`full_pipeline` tier** — Added fourth token budget tier (256K max) to `context-memory/SKILL.md` to match `system-state-schema.json` enum.

### Changed

- **`orchestrator/SKILL.md` → v1.1.0** — Step 0 (SKL-040 prompt-normalizer pre-routing gate) added; all prior steps renumbered 1–7. Step 3 now includes parallel write-back serialization rule (D3). Step 6 added for ADR sync (`adr_index` canonical write). Step 7 now generates session summary node and runs `graphify update .` after pipeline completion. Rules & Constraints updated with 3 new rules: parallel write serialization, ADR canonical source, prompt normalization gate.
- **`state-manager/SKILL.md` → v1.1.0** — Scope enum extended from 11 to 17 values: added `pipeline_state`, `dispatch_map`, `event_log`, `snapshots`, `rollback_log`, `adr_index`. Added ADR canonical-source rule to Rules & Constraints.
- **`dependency-analyzer/SKILL.md` → v1.1.0** — Retrieval-first approach via `graphify query` added to Required Context and Step 2 execution logic. Full state load now a fallback only.
- **`change-impact-analyzer/SKILL.md` → v1.1.0** — Retrieval-first approach via `graphify query` and `graphify path` added to Required Context and Steps 1–2. Full state loads now fallbacks only.
- **`context-memory/SKILL.md`** — D1 fix: renamed `Standard (3-5 skills)` tier to `Partial Pipeline` (mapped to `partial_pipeline` enum value). Added migration note: sessions using deprecated `standard` tier must be updated.
- **`opencode.json`** — Model tiering applied: `test-generator` and `doc-maintainer` agents switched from `claude-sonnet-4.6` to `gpt-4o-mini` (lighter/cheaper for utility-class tasks).
- **`skills/index.yaml` → v2.3.0** — Version bumps: SKL-010 → 1.1.0, SKL-021 → 1.1.0, SKL-023 → 1.1.0, SKL-024 → 1.1.0.
- **`skills/registry.json` → v2.3.0** — Same 4 version bumps.
- **`skills/graph/skill-graph.yaml` → v2.1.0** — Same 4 version bumps.
- **`docs/skills-registry.md`** — Orchestrator entry updated to v1.1.0.

### Fixed

- **D1** (`context-memory/SKILL.md`) — `Standard` tier was not a valid `token_budget.tier` enum value per `system-state-schema.json`. Renamed to `partial_pipeline`. Added `full_pipeline` tier (was missing entirely). Prevents silent budget overallocation.
- **D2** (`state-manager/SKILL.md`) — Scope enum was missing 6 of 20 system-state fields (`pipeline_state`, `dispatch_map`, `event_log`, `snapshots`, `rollback_log`, `adr_index`). All 6 added; no field now requires `scope: "all"` workaround.
- **D3** (`orchestrator/SKILL.md`) — Parallel write-back to `session_context` was undocumented and race-condition prone. Serialization rule now explicit in both execution logic and Rules & Constraints.
- **ADR dedup** — `decision_log.adrs` was a duplicate of `adr_index`. Both `state-manager` and `orchestrator` now designate `adr_index` as the single canonical ADR source. `decision_log.adrs` deprecated.

---

## [2.2.0] — 2026-06-18

### Added

**2 new skills (SKL-038–SKL-039):**

- `design-system-generator` (SKL-038) — Generate design token files (CSS custom properties, Tailwind config, JSON token bundle), typed component stubs, and Storybook configuration from `token_requirements` and `component_contracts` produced by `frontend-ux-architect`. Bridges the gap between a UX architecture specification and actual files on disk. Domain: `design`. Assigned to: `builder` agent.
- `seo-optimizer` (SKL-039) — Generate sitemap XML, robots.txt, JSON-LD structured data schemas, Open Graph + Twitter Card meta tag specifications, and Core Web Vitals performance budget for any public-facing website. Zero SEO coverage existed previously. Domain: `quality`. Assigned to: `builder` agent.

**3 pipeline templates:**

- `skills/pipelines/consumer-website.json` — Full idea-to-production pipeline for public-facing consumer websites. Extends `full-pipeline.json` with `phase-2c-design-system` (design-system-generator) and `phase-8b-seo` (seo-optimizer). Includes SEO compliance gate (blocks if coverage < 100%) and design system approval gate.
- `skills/pipelines/developer-portal.json` — Pipeline for developer-facing portals (API docs, SDK explorer, guides). Same as consumer-website with synchronous documentation phase (not async — docs are the primary deliverable), elevated security gate label, and documentation sign-off gate before deployment.
- `skills/pipelines/admin-panel.json` — Pipeline for internal admin and control panel interfaces. No SEO phase (all admin routes are noindex by default). No design-system-generator phase (uses existing system). Extended security review timeout (7200s). Elevated security gate label reflecting RBAC and privileged data access risk.

### Changed

- `skills/index.yaml` — Bumped to v2.2.0. Added SKL-038 and SKL-039 entries.
- `skills/registry.json` — Added SKL-038 (`design-system-generator`) and SKL-039 (`seo-optimizer`) entries with full I/O, orchestration notes, and feedback routes.
- `skills/graph/skill-graph.yaml` — Updated `total_nodes: 39`, `total_edges: 97`. Added 2 new nodes (SKL-038, SKL-039) and 7 new edges: SKL-031→SKL-038, SKL-001→SKL-039, SKL-031→SKL-039, SKL-038→SKL-026, SKL-039→SKL-007, SKL-010→SKL-038, SKL-010→SKL-039.
- `opencode.json` — `builder` agent expanded from 2 skills to 4: added `design-system-generator` and `seo-optimizer`.
- `docs/agents.md` — Updated `builder` row to reflect 4 assigned skills.

---

## [2.3.0] — 2026-06-18

### Added

- **`prompt-normalizer` (SKL-040)** — Pre-routing intent extraction skill. Normalizes vague or ambiguous user prompts into structured, routing-ready intent objects before the orchestrator resolves a pipeline. Three possible actions: `route_immediately` (confident intent), `ask_clarification` (single targeted question), `request_pipeline_selection` (present explicit pipeline options). Domain: `meta`. Step 0 in every orchestrator execution.
  - `.opencode/skills/prompt-normalizer/SKILL.md` — 13-section executable spec; 10-step execution logic; Grice/Anthropic/Pearl principles.
  - `skills/knowledge/prompt-normalizer.md` — 8-section knowledge reference; 4 anti-patterns; 4 worked examples.

### Changed

- `skills/index.yaml` — Bumped to v2.3.0. Added SKL-040 entry.
- `skills/registry.json` — Bumped to v2.3.0. Added `prompt-normalizer` entry.
- `skills/graph/skill-graph.yaml` — Bumped to v2.1.0. Updated `total_nodes: 40`, `total_edges: 100`. Added SKL-040 node and 3 edges.
- `docs/skills-registry.md` — Added SKL-040 entry.

---

## [2.1.1] — 2026-06-18

### Fixed

- `skills/graph/skill-graph.yaml` — header comment updated from `v1.4.0` to `v2.0.0` (BUG #2)
- `skills/graph/skill-graph.yaml` — `total_edges` corrected from `82` to `90`; added missing `SKL-002 → SKL-033` dependency edge (BUG #3, BUG #4)
- `docs/agents.md` — `architect` row updated to show all 3 assigned skills; `reviewer` row updated to show all 7 assigned skills (BUG #5)
- `skills/pipelines/full-pipeline.json` — gate `type: "auto"` changed to `type: "condition"` on all 3 auto gates (BUG #6)
- `skills/pipelines/pre-deploy.json` — gate `type: "auto"` changed to `type: "condition"` on both auto gates (BUG #6)
- `skills/schema/pipeline-schema.json` — fully rewritten to v2.0.0; now supports both flat (`skills[]`) and phased (`phases[]`) pipeline formats via `oneOf`; added all missing top-level properties, gate properties, and skill step properties (BUG #1)
- `skills/registry.json` — bumped to v2.0.0; added 7 missing entries for SKL-031–037 (`frontend-ux-architect`, `database-architect`, `implementation-completeness-auditor`, `database-guard`, `performance-guard`, `ui-ux-compliance-guard`, `implementation-completeness-guard`)
- `website/src/lib/colors.ts` — added 4 missing domain color entries: `design`, `database`, `quality`, `governance`
- `website/src/lib/data.ts` — `PipelineGate.type` union updated to include `"condition"` (was `"human_approval" | "auto"`, now includes `"condition"`)

---

## [2.1.0] — 2026-06-17

### Added

**Runtime infrastructure (4 items):**

- `.opencode/agent/builder.md` — Instruction file for the `builder` subagent (code-generator + code-repair skills). Was present in `opencode.json` but missing its instruction file.
- `.opencode/agent/impact-analyzer.md` — Instruction file for the `impact-analyzer` subagent (dependency-analyzer + change-impact-analyzer skills).
- `.opencode/agent/test-generator.md` — Instruction file for the `test-generator` subagent (test-generator skill).
- `.opencode/agent/recovery.md` — Instruction file for the `recovery` subagent (rollback-manager skill).
- `.opencode/state/sessions/session-template.json` — JSON template for pipeline session state files. The orchestrator writes a copy to `sessions/<session_id>.json` at pipeline start and updates it after each skill step.
- `.github/workflows/validate-skills.yml` — CI/CD GitHub Actions workflow. Runs on every push or PR touching `skills/**`, `.opencode/skills/**`, or `opencode.json`. Checks: pipeline JSON schema validation, SKILL.md section completeness, unique skill IDs, skill count consistency, opencode.json path existence, and graph node count.
- `scripts/validate-skills.sh` — Equivalent local validation script (same 6 checks). Run with `bash scripts/validate-skills.sh` from the project root. Requires `node`; pipeline JSON check additionally requires `ajv-cli`.

**Pipeline updates:**

- `skills/pipelines/full-pipeline.json` — Bumped to v2.1.0. Added `phase-2b-design` (parallel frontend-ux-architect + database-architect), `phase-7b-guards` (parallel database-guard + performance-guard + ui-ux-compliance-guard), `phase-8b-audit` (implementation-completeness-auditor), `phase-8c-release-guard` (implementation-completeness-guard). Updated deployment gate to `bypass_on_timeout: false`, `timeout: 0`. Added HITL gates after design layer and guard layer.
- `skills/pipelines/pre-deploy.json` — Bumped to v2.1.0. Converted from flat `skills` array to `phases` structure. Added phases for guard layer, completeness audit, release gate. Updated deployment gate to `bypass_on_timeout: false`, `timeout: 0`.

### Changed

- `.opencode/agent/architect.md` — Expanded from single-skill to three-skill agent: `architecture-design`, `frontend-ux-architect`, `database-architect`. Updated description, execution order, and rules.
- `.opencode/agent/reviewer.md` — Expanded from two-skill to seven-skill agent: added `implementation-completeness-auditor`, `database-guard`, `performance-guard`, `ui-ux-compliance-guard`, `implementation-completeness-guard`. Updated execution order and guard halt rules.
- `.opencode/skills/database-guard/SKILL.md` — Added 4 missing sections: Security Considerations, Quality Checklist, Failure Scenarios, Human-in-the-Loop Gates.
- `.opencode/skills/performance-guard/SKILL.md` — Added 4 missing sections: Security Considerations, Quality Checklist, Failure Scenarios, Human-in-the-Loop Gates.
- `.opencode/skills/ui-ux-compliance-guard/SKILL.md` — Added 4 missing sections: Security Considerations, Quality Checklist, Failure Scenarios, Human-in-the-Loop Gates.
- `.opencode/skills/implementation-completeness-guard/SKILL.md` — Added 4 missing sections: Security Considerations, Quality Checklist, Failure Scenarios, Human-in-the-Loop Gates.

### Fixed

- `scripts/validate-skills.sh` — Section check now uses named section keywords (Purpose, Inputs, etc.) matching the actual SKILL.md format instead of numbered headings. Meta-format skills (context-memory, observability, quality-scoring, skill-lifecycle, trigger-engineering, validation-rules, versioning) are excluded from the template check. `opencode.json` key corrected from `agents` (plural) to `agent` (singular).
- `.github/workflows/validate-skills.yml` — Same `agent` key fix applied.

---

## [2.0.0] — 2026-06-17

### Added

**7 new skills (SKL-031–SKL-037):**

- `frontend-ux-architect` (SKL-031) — Design screen inventory, navigation architecture, component contracts, interaction patterns, accessibility compliance, and design token requirements from validated requirements and architecture modules. Domain: `design`.
- `database-architect` (SKL-032) — Design normalized database schemas, ERDs, indexing strategies, audit logging, soft-delete patterns, PII annotations, and migration plans. Domain: `database`.
- `implementation-completeness-auditor` (SKL-033) — Cross-check all requirements against delivered code, tests, UI screens, DB entities, and documentation. Produces a readiness score (0–100) and full traceability matrix. Domain: `quality`.
- `database-guard` (SKL-034) — Guard skill: blocks destructive migrations without approval, missing FK indexes, unannotated PII columns, and missing cascade rules. Domain: `governance`.
- `performance-guard` (SKL-035) — Guard skill: blocks N+1 query patterns, missing query-critical indexes, bulk operation anti-patterns, and synchronous blocking calls. Domain: `governance`.
- `ui-ux-compliance-guard` (SKL-036) — Guard skill: blocks hardcoded design values, missing required component states, prop contract violations, and unresolved accessibility violations. Domain: `governance`.
- `implementation-completeness-guard` (SKL-037) — Guard skill: enforces release readiness threshold (default: 85). Blocks release if score < threshold or any critical requirement is missing. Domain: `governance`.

**New schema file:**

- `skills/schema/pipeline-schema.json` — JSON Schema (draft-07) for pipeline configuration objects passed to the orchestrator. Previously referenced by all 5 pipeline configs but missing on disk.

**Knowledge documents:**

- `skills/knowledge/frontend-ux-architect.md`
- `skills/knowledge/database-architect.md`
- `skills/knowledge/implementation-completeness-auditor.md`

### Changed

- `skills/schema/skill-schema.yaml` — Fixed `executable_skill` path pattern from `^skills/.+\.md$` to `^(\.opencode/|skills/).+\.md$`. The old pattern incorrectly rejected all 30 existing entries which use `.opencode/skills/...` paths.
- `skills/index.yaml` — Bumped `meta.version` to `2.0.0`. Added SKL-031–037 entries.
- `skills/graph/skill-graph.yaml` — Bumped `meta.version` to `2.0.0`. Updated `total_nodes: 37`, `total_edges: 82`. Added 7 new nodes and 15 new edges.
- `opencode.json` — Expanded `architect` agent to include `frontend-ux-architect` and `database-architect` skills. Expanded `reviewer` agent to include `implementation-completeness-auditor`, `database-guard`, `performance-guard`, `ui-ux-compliance-guard`, and `implementation-completeness-guard` skills.
- `deployment-strategy/SKILL.md` — Bumped to v1.1.0. Added `deployment_approval_request` as a mandatory output field. Added Step 8 to execution logic (Generate Deployment Approval Request). Updated HITL gate to non-bypassable with `timeout: 0`.
- `orchestrator/SKILL.md` — Added Release Gate Policy section. Added rule: deployment gate with `bypass_on_timeout: false` is a required invariant; any pipeline configuration missing it is rejected. Added rule: guard skill `block` verdicts halt pipeline unconditionally.
- `docs/agents.md` — Bumped to v1.1.0. Added 4 previously undocumented agents: `builder`, `impact-analyzer`, `test-generator`, `recovery`.
- `docs/governance.md` — Bumped to v2.0.0. Added Layer 2 (Guard Skills) to the governance model. Documented full guard inventory, verdict contract, and deployment gate special rules.
- `docs/skills-registry.md` — Bumped to v2.0.0. Added sections for SKL-031–037. Updated deployment-strategy entry with `deployment_approval_request` output.
- `docs/architecture.md` — Bumped to v2.0.0. Added UI/UX and Database Architecture Layers section. Updated HITL Gates list (8 gates). Added Guard Layer section.
- `Goal File.md` — Bumped to v2.0.0. Updated status to "37 skills". Updated "new skills required" table to reflect that SKL-021–030 are complete and the next phase is the runtime implementation.

### Fixed

- `skills/schema/skill-schema.yaml` — Corrected `executable_skill` path regex that incorrectly rejected all registered executable skills.
- `docs/agents.md` — Added 4 agents (`builder`, `impact-analyzer`, `test-generator`, `recovery`) that were present in `opencode.json` but absent from the documentation table and capability mapping.

---

## [1.4.0] — 2026-06-16

### Added

**Skill Authoring meta-skill (SKL-012) — full system:**

- `skills/meta/skill-authoring.md` — 13-section AI-executable spec: 10-step generation pipeline covering analysis, boundary definition, graph cycle detection, SKILL.md generation, knowledge file generation, multi-layer validation, registration, and activation test generation
- `skills/knowledge/skill-authoring.md` — 5 principles (P1: Single Responsibility, P2: Progressive Disclosure, P3: Activation Accuracy First, P4: Graph-First Design, P5: Anti-Pattern Detection) + 5 anti-patterns + 4 correct/incorrect examples

**Skill graph system:**

- `skills/graph/skill-graph.yaml` — Full DAG: 12 nodes, 31 edges across 4 types (dependency, composition, extension, co_occurrence). Complete dependency map for all skills including the new SKL-012.
- `skills/graph/graph-schema.yaml` — Node and edge schema with 6 graph invariants (no_cycles, direction_follows_layer, composition_meta_only, co_occurrence_symmetric, no_self_loops, no_duplicate_edges)

**Lifecycle governance:**

- `skills/lifecycle/lifecycle.md` — 12-stage skill lifecycle (intent → decompose → extract → design → schema → SKILL.md → reference → validate → register → deploy → monitor → iterate) with stage gates, deprecation path, and version bump rules

**Quality system:**

- `skills/quality/quality-scoring.md` — 7-dimension scoring rubric (clarity 20pts, completeness 20pts, reusability 15pts, dependency quality 15pts, maintainability 15pts, failure rate 10pts, graph health 5pts = 100pts total). Grade table: excellent/good/acceptable/poor/failing. Automatic penalties for anti-patterns.

**Trigger engineering:**

- `skills/triggers/trigger-template.md` — Trigger definition template with positive triggers, negative triggers (with correct_skill references), contextual triggers, and conflict resolution. Completed example for SKL-004.

### Changed

- `skills/index.yaml` — added SKL-012 (Skill Authoring) entry with `related_skills` field
- `skills/registry.json` — added `skill-authoring` entry (v1.0.0, domain: meta)
- `docs/skills-registry.md` — version bumped to 1.3.0, two-layer architecture reference added

---

## [1.3.0] — 2026-06-16

### Added

**Modular, documentation-driven skills template system:**

- `skills/index.yaml` — central lightweight index with all 11 skill entries; each entry includes: `id` (SKL-NNN), `name`, `short_description`, `reference_path`, `executable_skill`, `tags`, `version`, `depends_on`, `mastery_level`, `use_when`, `do_not_use_when`
- `skills/schema/skill-schema.yaml` — YAML schema definition for all index entry fields with types, patterns, and rules
- `skills/schema/validation-rules.md` — 16 human-readable validation rules (R1–R16) covering required fields, reference integrity, content quality, dependency ordering, and versioning
- `skills/template/skill-entry.yaml` — template for authoring new index entries
- `skills/template/skill-knowledge.md` — template for authoring knowledge files (8 required sections)
- `skills/knowledge/requirement-analysis.md` (SKL-001) — INVEST criteria, normalization form, ambiguity anti-patterns; sources: Patton, Evans, Cockburn
- `skills/knowledge/architecture-design.md` (SKL-002) — Dependency Rule, Bounded Contexts, Component Cohesion; sources: Martin, Evans, Newman
- `skills/knowledge/feature-planning.md` (SKL-003) — Story points, Definition of Ready, Phase model; sources: Cohn, Patton, Schwaber
- `skills/knowledge/clean-code.md` (SKL-004) — P1–P6 mapped to specific Clean Code chapters; 6 anti-patterns; 4 correct/incorrect example pairs; sources: Martin, Fowler, Hunt & Thomas
- `skills/knowledge/testing-strategy.md` (SKL-005) — Test Pyramid, TDD Red-Green-Refactor, Test Doubles; sources: Beck, Freeman & Pryce, Myers
- `skills/knowledge/security-review.md` (SKL-006) — Defense in Depth, STRIDE per module, OWASP Top 10 2021; sources: OWASP, Microsoft, Stuttard & Pinto
- `skills/knowledge/deployment-strategy.md` (SKL-007) — Deployment Pipeline, Deploy vs Release, Automatic Rollback; sources: Humble & Farley, Google SRE, Kim et al.
- `skills/knowledge/documentation-generation.md` (SKL-008) — Docs Like Code, ADR format, API completeness; sources: Gentle, Nygard, OpenAPI
- `skills/knowledge/schema-validation.md` (SKL-009) — Fail Fast, JSON Schema keywords, Strict vs Permissive; sources: Wright et al. draft-07
- `skills/knowledge/orchestration.md` (SKL-010) — Orchestration vs Choreography, Idempotent Steps, Circuit Breaker; sources: Burns, Hohpe & Woolf, Nygard
- `skills/knowledge/doc-maintenance.md` (SKL-011) — Single Source of Truth, Documentation as Commit, Incremental Updates; sources: Gentle

### Changed

- `skills/README.md` — rewritten to describe the two-layer architecture (knowledge + execution)
- `docs/skills-registry.md` — updated header to reference `skills/index.yaml` and the two-layer model

---

## [1.2.0] — 2026-06-16

### Fixed (Critical)

- Version mismatch: bumped 5 core skill frontmatter from `1.0.0` → `1.1.0` to match registry
- Broken `$ref`: fixed `#/definitions/feedback_entry` → `#/$defs/feedback_entry` in `security-review`, `deployment-strategy`, `doc-generator`; added missing `$defs` blocks to all three
- Dead code: removed unreferenced `$defs.metrics` block from `doc-maintainer` output schema
- `feedback` field missing from `required[]`: added to all 11 skill output schemas
- `risks` field missing from `required[]`: added to `feature-planning` and `testing-strategy`
- Standard metrics base fields (`tokens_in`, `tokens_out`, `duration_ms`, `items_produced`, `version`) were absent from `security-review` and `deployment-strategy` — now present
- Wrong `$schema` in registry (`opencode.ai/config.json`) removed — registry is not an opencode config file

### Added

- `detection_mode` input to `doc-maintainer` (`event_driven`, `git_diff`, `full_scan`)
- `dry_run` input to `doc-maintainer` — preview changes without writing files
- `git_diff_raw` and `staleness_threshold_days` inputs to `doc-maintainer`
- Steps 0, 0.5, 6.5, 7.5 to `doc-maintainer` execution logic (snapshot, parse, staleness, dry-run guard)
- `dry_run_report`, `staleness_issues`, `rollback_info` outputs to `doc-maintainer`
- Section 12 (HITL Gates) to all 11 skills
- Section 13 (Skill Composition) to all 11 skills
- Sections 7 (Rules), 8 (Security), 13 (Composition) added to `orchestrator`
- Sections 8 (Security), 9 (Token Optimization) added to `schema-validator`
- Section 9 (Token Optimization) added to `security-review` and `deployment-strategy`
- Section 8 (Security) added to `doc-generator`
- `status: "active"` field to all 11 registry entries
- `@version` semver constraints to all `consumes_from` / `produces_for` registry entries
- Full 9-agent configuration in `opencode.json` (was empty — only had `$schema`)
- `.opencode/agent/` directory with instruction files for all 9 agents
- `docs/glossary.md` — 30+ domain term definitions (HITL, STRIDE, OWASP, ADR, semver, etc.)

### Changed

- `docs/agents.md`: completed config example from 2 agents → all 9 agents; added reference to `.opencode/agent/`
- `docs/prompt-engineering.md`: updated skill structure diagram from 11 → 13 sections
- `docs/changelog.md` line 15: corrected "11-section template" → "13-section template"

---

## [1.1.0] — 2026-06-16

### Added

- **Documentation Maintainer skill** (`skills/documentation/doc-maintainer.md`) — autonomous engine that detects system changes, creates/updates `/docs` files, and enforces cross-file consistency
  - Detects change type and scope (isolated vs system-wide)
  - Decides action: CREATE, UPDATE, or MULTI_UPDATE
  - Executes targeted edits preserving unchanged sections
  - Runs consistency checks — resolves duplicates, fixes stale references
  - Outputs structured maintenance report with metrics
- `doc-maintainer` entry in `skills/registry.json` (system maintenance skill, not pipeline)

### Changed

- `docs/skills-registry.md` — added section 11 (Documentation Maintainer), updated orchestration notes
- `docs/changelog.md` — this entry

---

## [1.0.0] — 2026-06-16

### Added

- **Skill System Standard** — production-grade skill specification framework with 13-section template
- **5 core skills:**
  - `requirement-analyzer` — requirement extraction, normalization, ambiguity detection
  - `architecture-design` — module boundaries, data flow, integration contracts, tech decisions
  - `feature-planning` — task decomposition, dependency graph, milestones, roadmap
  - `clean-code-review` — SOLID validation, complexity analysis, anti-pattern detection
  - `testing-strategy` — test plans, edge cases, coverage targets, quality gates
- **Enhancements (v1.1.0 of skill system):**
  - `orchestrator` — meta-skill for pipeline execution, routing, HITL gates
  - `schema-validator` — runtime JSON Schema validation utility
  - `security-review` — STRIDE threat modeling, OWASP mapping, remediation
  - `deployment-strategy` — environment topology, promotion rules, rollback criteria
  - `documentation-generator` — auto-generated API docs, ADRs, READMEs
  - `registry.json` — central skill discovery catalog
  - `versioning.md` — semver governance, compatibility matrix, deprecation policy
  - `context-protocol.md` — session persistence, compression, resume protocol
  - `observability.md` — standardized metrics, health alerts, logging conventions
  - Skill composition (template section 13)
  - HITL gates (5 checkpoints with configurable timeout)
  - Feedback loop protocol (backpropagation with max 3 iterations)
  - Shared `$defs` for `metrics` and `feedback_entry` across all skills
- **Modular documentation system** — 18 markdown files in `docs/`
  - Entry point, system overview, architecture, skills registry, agents, workflows
  - Development standards, security, testing, UI/UX, localization
  - Prompt engineering, context engineering, deployment, monitoring
  - Governance, versioning, changelog, how-to-use

### Changed

- All 5 original skills: added `metrics` + `feedback` to output schemas with `$ref` to shared `$defs`
- Skill template: added `$defs` sections, Section 12 (HITL Gates), Section 13 (Skill Composition)
- Registry: renamed to `skills/registry.json` with full dependency metadata

### Fixed

- (No fixes in initial release)

---

## Template for Future Entries

```markdown
## [X.Y.Z] — YYYY-MM-DD

### Added
- New features

### Changed
- Modifications to existing features

### Deprecated
- Features to be removed in future versions

### Removed
- Features removed in this version

### Fixed
- Bug fixes

### Security
- Security improvements
```

# Changelog — System Update History

**Version:** 1.0.0 | **Last updated:** 2026-06-16

All notable changes to this project are documented here.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) — `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`.

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

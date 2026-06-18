# Skills Registry — All Skills Catalog

**Version:** 2.3.0 | **Last updated:** 2026-06-18

The system uses a two-layer skill architecture. For the full lightweight index, see `skills/index.yaml`. For rich knowledge documentation per skill, see `skills/knowledge/`. This file is the human-readable catalog layer.

## Two-Layer Architecture

| Layer | File(s) | Purpose |
|-------|---------|---------|
| Index | `skills/index.yaml` | Lightweight entries for all 40 skills — IDs, tags, dependencies, mastery levels |
| Knowledge | `skills/knowledge/<skill>.md` | Rich reference: principles, practices, anti-patterns, examples, source citations |
| Execution | `skills/<domain>/<skill>.md` | 13-section AI-executable specifications |

## Core Pipeline Skills

### 1. Requirement Analyzer

| Property | Value |
|----------|-------|
| Domain | `requirements` |
| File | `skills/requirements/requirement-analyzer.md` |
| Version | 1.1.0 |
| Purpose | Extract, normalize, and validate requirements from raw input |
| Consumes from | None (entry point) |
| Produces for | `architecture-design` |

**Key outputs:** `requirements`, `open_questions`, `assumptions`, `risks`

### 2. Architecture Design

| Property | Value |
|----------|-------|
| Domain | `architecture` |
| File | `skills/architecture/architecture-design.md` |
| Version | 1.1.0 |
| Purpose | Define modules, data flow, integration points, tech decisions |
| Consumes from | `requirement-analyzer` |
| Produces for | `feature-planning`, `security-review`, `documentation-generator` |

**Key outputs:** `modules`, `data_flow`, `integration_points`, `technical_decisions`

### 3. Feature Planning

| Property | Value |
|----------|-------|
| Domain | `planning` |
| File | `skills/planning/feature-planning.md` |
| Version | 1.1.0 |
| Purpose | Break requirements into tasks, dependencies, roadmap |
| Consumes from | `architecture-design` |
| Produces for | `clean-code-review`, `testing-strategy` |

**Key outputs:** `tasks`, `dependency_map`, `phases`, `milestones`

### 4. Clean Code Review

| Property | Value |
|----------|-------|
| Domain | `review` |
| File | `skills/review/clean-code-review.md` |
| Version | 1.1.0 |
| Purpose | Validate code against SOLID and clean architecture |
| Consumes from | `feature-planning` |
| Produces for | `security-review`, `documentation-generator` |

**Key outputs:** `issues`, `complexity_report`, `improvements`, `summary`

### 5. Testing Strategy

| Property | Value |
|----------|-------|
| Domain | `testing` |
| File | `skills/testing/testing-strategy.md` |
| Version | 1.1.0 |
| Purpose | Define test plan, edge cases, coverage, quality gates |
| Consumes from | `feature-planning` |
| Produces for | `deployment-strategy` |

**Key outputs:** `test_plan`, `test_cases`, `edge_cases`, `coverage_checklist`

## Domain Skills

### 6. Security Review

| Property | Value |
|----------|-------|
| Domain | `security` |
| File | `skills/security/security-review.md` |
| Version | 1.0.0 |
| Purpose | Threat modeling, vulnerability detection, remediation |
| Consumes from | `architecture-design`, `clean-code-review` |
| Produces for | None |

**Key outputs:** `vulnerabilities`, `threat_model`, `remediation`, `risks`

### 7. Deployment Strategy

| Property | Value |
|----------|-------|
| Domain | `deployment` |
| File | `skills/deployment/deployment-strategy.md` |
| Version | 1.1.0 |
| Purpose | Environment model, promotion, rollback, IaC scaffold, deployment approval request |
| Consumes from | `architecture-design`, `testing-strategy` |
| Produces for | None |

**Key outputs:** `environments`, `promotion_rules`, `rollback_criteria`, `feature_flags`, `deployment_approval_request`

> `deployment_approval_request` is a mandatory output. The pipeline halts after this skill and awaits explicit user approval before any deployment action occurs.

### 8. Documentation Generator

| Property | Value |
|----------|-------|
| Domain | `documentation` |
| File | `skills/documentation/doc-generator.md` |
| Version | 1.0.0 |
| Purpose | Auto-generate API docs, ADRs, READMEs |
| Consumes from | `requirement-analyzer`, `architecture-design`, `clean-code-review` |
| Produces for | None |

**Key outputs:** `documents` (array of name, format, content)

## Meta Skills

### 9. Orchestrator

| Property | Value |
|----------|-------|
| Domain | `system` |
| File | `skills/orchestrator/orchestrator.md` |
| Version | 1.1.0 |
| Purpose | Execute pipeline, route artifacts, validate, manage HITL |
| Consumes from | Registry |
| Produces for | Pipeline result |

**Key outputs:** `pipeline_result`, `execution_log`, `session_context`, `gate_decisions`

### 10. Schema Validator

| Property | Value |
|----------|-------|
| Domain | `validation` |
| File | `skills/validation/schema-validator.md` |
| Version | 1.0.0 |
| Purpose | Validate JSON data against JSON Schema |
| Consumes from | None (utility) |
| Produces for | None (utility) |

**Key outputs:** `valid`, `issues`, `metrics`

### 11. Documentation Maintainer

| Property | Value |
|----------|-------|
| Domain | `documentation` |
| File | `skills/documentation/doc-maintainer.md` |
| Version | 1.0.0 |
| Purpose | Autonomous engine that detects system changes and keeps `/docs` in sync |
| Consumes from | Change events (any domain) |
| Produces for | `/docs` files |

**Key outputs:** `decision_summary`, `action_type`, `files_affected`, `consistency_report`

### Orchestration Note

`doc-maintainer` is a **system maintenance skill** — it does not execute in the pipeline. It runs on change detection triggers. When any skill, agent, workflow, or configuration changes, the doc-maintainer inspects the impact and creates/updates the relevant `/docs` files.

## Skill Dependencies Graph

```
requirement-analyzer
        │
        ▼
architecture-design ◄──────────────┐
        │                          │ (feedback)
        ▼                          │
feature-planning                   │
        │                          │
        ├──────► clean-code-review ─┘
        │              │
        │              ├──► security-review
        │              └──► documentation-generator
        │
        └──────► testing-strategy ──► deployment-strategy
```

## Skill Interaction Rules

- Skills emit `feedback` entries to signal issues to upstream skills (see [Architecture](architecture.md#feedback-loops)).
- All skill versions follow semver. See [Versioning](versioning.md).
- Adding/changing a skill requires updating this file AND `changelog.md`.

## New Domain Skills (v2.0.0)

### 31. Frontend UI/UX Architect

| Property | Value |
|----------|-------|
| ID | SKL-031 |
| Domain | `design` |
| File | `.opencode/skills/frontend-ux-architect/SKILL.md` |
| Version | 1.0.0 |
| Purpose | Design screen structure, navigation, component contracts, accessibility, and token rules |
| Consumes from | `requirement-analyzer`, `architecture-design` |
| Produces for | `ui-ux-compliance-guard`, `implementation-completeness-auditor` |

**Key outputs:** `screens`, `navigation_map`, `component_contracts`, `accessibility_report`, `token_requirements`

### 32. Database Architect

| Property | Value |
|----------|-------|
| ID | SKL-032 |
| Domain | `database` |
| File | `.opencode/skills/database-architect/SKILL.md` |
| Version | 1.0.0 |
| Purpose | Design normalized schemas, ERDs, indexing strategies, audit logging, and migration plans |
| Consumes from | `requirement-analyzer`, `architecture-design` |
| Produces for | `database-guard`, `implementation-completeness-auditor` |

**Key outputs:** `entities`, `relationships`, `erd`, `indexes`, `migration_plan`, `security_annotations`, `violations`

### 33. Implementation Completeness Auditor

| Property | Value |
|----------|-------|
| ID | SKL-033 |
| Domain | `quality` |
| File | `.opencode/skills/implementation-completeness-auditor/SKILL.md` |
| Version | 1.0.0 |
| Purpose | Cross-check all requirements against code, tests, UI, DB, and docs; produce readiness score |
| Consumes from | `requirement-analyzer`, `feature-planning`, `code-generator`, `state-manager` |
| Produces for | `implementation-completeness-guard` |

**Key outputs:** `readiness_score` (0–100), `readiness_level`, `gap_summary`, `gaps`, `traceability_matrix`

## Guard Skills (v2.0.0)

Guard skills run as `validation_check` gates. A `block` verdict halts the pipeline immediately. See [Governance](governance.md#guard-skills-layer-2) for full details.

### 34. Database Guard

| Property | Value |
|----------|-------|
| ID | SKL-034 |
| Domain | `governance` |
| File | `.opencode/skills/database-guard/SKILL.md` |
| Version | 1.0.0 |
| Purpose | Block destructive migrations, missing FK indexes, unannotated PII, missing cascade rules |
| Consumes from | `database-architect` |
| Verdict | `pass` / `block` |

### 35. Performance Guard

| Property | Value |
|----------|-------|
| ID | SKL-035 |
| Domain | `governance` |
| File | `.opencode/skills/performance-guard/SKILL.md` |
| Version | 1.0.0 |
| Purpose | Block N+1 query patterns, missing query indexes, bulk operation anti-patterns |
| Consumes from | `architecture-design`, `clean-code-review` (code_map) |
| Verdict | `pass` / `block` |

### 36. UI/UX Compliance Guard

| Property | Value |
|----------|-------|
| ID | SKL-036 |
| Domain | `governance` |
| File | `.opencode/skills/ui-ux-compliance-guard/SKILL.md` |
| Version | 1.0.0 |
| Purpose | Block hardcoded colors, missing component states, prop violations, accessibility issues |
| Consumes from | `frontend-ux-architect` |
| Verdict | `pass` / `block` |

### 37. Implementation Completeness Guard

| Property | Value |
|----------|-------|
| ID | SKL-037 |
| Domain | `governance` |
| File | `.opencode/skills/implementation-completeness-guard/SKILL.md` |
| Version | 1.0.0 |
| Purpose | Block release when readiness score < threshold (default: 85) or critical requirements missing |
| Consumes from | `implementation-completeness-auditor` |
| Verdict | `pass` / `block` |

### 38. Design System Generator

| Property | Value |
|----------|-------|
| ID | SKL-038 |
| Domain | `design` |
| File | `.opencode/skills/design-system-generator/SKILL.md` |
| Version | 1.0.0 |
| Purpose | Generate design token files, component stubs, and Storybook configuration from UX architecture output |
| Consumes from | `frontend-ux-architect` |
| Produces for | `code-generator` |

**Key outputs:** design token files (`tokens.json`, `tailwind.config.js`), component stub files, Storybook config, component usage guide

### 39. SEO Optimizer

| Property | Value |
|----------|-------|
| ID | SKL-039 |
| Domain | `quality` |
| File | `.opencode/skills/seo-optimizer/SKILL.md` |
| Version | 1.0.0 |
| Purpose | Generate sitemap, robots.txt, JSON-LD structured data, Open Graph tags, and Core Web Vitals budget for public-facing web products |
| Consumes from | `architecture-design`, `code-generator` |
| Produces for | `deployment-strategy` |

**Key outputs:** `sitemap.xml`, `robots.txt`, JSON-LD markup, OG/Twitter meta tags, CWV budget spec, SEO compliance report

### 40. Prompt Normalizer

| Property | Value |
|----------|-------|
| ID | SKL-040 |
| Domain | `meta` |
| File | `.opencode/skills/prompt-normalizer/SKILL.md` |
| Version | 1.0.0 |
| Purpose | Extract structured intent from a raw user prompt before pipeline routing; produce a normalized routing-ready prompt or a single targeted clarification question |
| Consumes from | — (step 0, no upstream skill) |
| Produces for | `orchestrator` |

**Key outputs:** `intent_object`, `normalized_prompt`, `routing_decision` (confidence + suggested_pipeline), `clarification_request`, `action` (route_immediately / ask_clarification / request_pipeline_selection)

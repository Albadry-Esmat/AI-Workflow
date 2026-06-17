# Skills Registry — All Skills Catalog

**Version:** 1.3.0 | **Last updated:** 2026-06-16

The system uses a two-layer skill architecture. For the full lightweight index, see `skills/index.yaml`. For rich knowledge documentation per skill, see `skills/knowledge/`. This file is the human-readable catalog layer.

## Two-Layer Architecture

| Layer | File(s) | Purpose |
|-------|---------|---------|
| Index | `skills/index.yaml` | Lightweight entries for all 11 skills — IDs, tags, dependencies, mastery levels |
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
| Version | 1.0.0 |
| Purpose | Environment model, promotion, rollback, IaC scaffold |
| Consumes from | `architecture-design`, `testing-strategy` |
| Produces for | None |

**Key outputs:** `environments`, `promotion_rules`, `rollback_criteria`, `feature_flags`

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
| Version | 1.0.0 |
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

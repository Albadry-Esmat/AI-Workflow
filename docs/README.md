# AI Workflow — Documentation System

**Version:** 1.0.0 | **Last updated:** 2026-06-16

The single source of truth for the AI Agent ecosystem. This documentation is modular, version-controlled, and optimized for both human developers and AI agents.

## System Overview

This project is a production-grade AI agent ecosystem built on the Skill System Standard. It provides a pipeline of specialized skills — requirement analysis, architecture design, feature planning, code review, security analysis, testing, deployment, and documentation generation — orchestrated by a meta-skill that manages routing, validation, and human-in-the-loop gates.

## Folder Structure

```
docs/
├── README.md                  ← Entry point (this file)
├── system-overview.md         ← Goals, scope, high-level description
├── architecture.md            ← System architecture, agents, skills, memory
├── skills-registry.md         ← All skills catalog
├── agents.md                  ← Agent definitions, responsibilities
├── workflows.md               ← End-to-end lifecycle flows
├── development-standards.md   ← Coding standards, architecture rules
├── security.md                ← Security policies, OWASP, permissions
├── testing.md                 ← Test strategy, types, coverage
├── ui-ux.md                   ← Design system, RTL/LTR, animations
├── localization.md            ← Arabic + English i18n strategy
├── prompt-engineering.md      ← Prompt structure, token optimization
├── context-engineering.md     ← Context management, memory, retrieval
├── deployment.md              ← CI/CD, environments, rollback
├── monitoring.md              ← Observability, metrics, cost tracking
├── governance.md              ← Approval gates, quality enforcement
├── versioning.md              ← Version strategy, changelog rules
├── changelog.md               ← Full update history
└── how-to-use.md              ← Step-by-step usage guides
```

## Navigation Guide

| If you want to... | Start here |
|-------------------|------------|
| Understand what the system does | `system-overview.md` |
| See how skills fit together | `workflows.md` → `skills-registry.md` |
| Add a new skill | `how-to-use.md` → `skills-registry.md` |
| Add a new agent | `how-to-use.md` → `agents.md` |
| Understand security rules | `security.md` |
| Deploy the system | `deployment.md` |
| Write or optimize prompts | `prompt-engineering.md` |
| Track what changed | `changelog.md` |

## How AI Agents Should Read This Documentation

1. Start with `system-overview.md` to understand scope.
2. Read `architecture.md` to understand the component model.
3. Read `workflows.md` to understand pipeline execution.
4. Reference `skills-registry.md` and `agents.md` for specific implementation details.
5. Consult `governance.md` for rules and constraints before making changes.
6. After any change, update the relevant doc(s) and `changelog.md`.

## Documentation Governance

| Change | Must Update |
|--------|-------------|
| Skill added/modified | `skills-registry.md`, `changelog.md` |
| Agent added/modified | `agents.md`, `changelog.md` |
| Workflow changed | `workflows.md`, `changelog.md` |
| Architecture changed | `architecture.md`, `changelog.md` |
| Prompt system changed | `prompt-engineering.md`, `changelog.md` |
| Deployment changed | `deployment.md`, `changelog.md` |
| Security changed | `security.md`, `changelog.md` |
| Version bumped | `versioning.md`, `changelog.md` |

## File Format Convention

All files follow this structure:

```markdown
# Title — Subtitle

**Version:** x.y.z | **Last updated:** YYYY-MM-DD

## Section

Content with cross-references to other files: [link](file.md#section).

- Bullet lists for enumerations
- `code` for filenames, schemas, IDs

## Rules

- Mandatory rules enforced by the system
```

## Contributing

1. Branch from `main`.
2. Make changes to documentation AND code if applicable.
3. Update `changelog.md` with a summary.
4. Submit for review against `governance.md` rules.
5. Merge only after approval gates pass.

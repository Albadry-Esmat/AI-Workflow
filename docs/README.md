# AI Workflow — Documentation System

**Version:** 1.0.0 | **Last updated:** 2026-08-24

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
├── operations/operator-quickstart.md ← Shortest safe operator path
├── operations/troubleshooting.md ← Failure diagnosis and recovery guidance
├── operations/production-runbook.md ← Production operations and recovery
├── operations/release-checklist.md ← Release-candidate sign-off checklist
├── operations/multi-runtime-compatibility.md ← Runtime adapter tiers and certification
├── development-runtime-adapter-guide.md ← Adapter implementation and certification contract
├── operations/github-repository-settings.md ← Branch protection and CI policy
├── production-readiness/release-governance-record.md ← Ownership, freeze, and change-control record
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
| Deploy the system | `deployment.md` → `operations/production-runbook.md` |
| Get started as an operator | `operations/operator-quickstart.md` |
| Diagnose a failed or blocked run | `operations/troubleshooting.md` |
| Prepare a release candidate | `operations/production-runbook.md` and `operations/release-checklist.md` |
| Check compatibility | Root `compatibility.json` and `operations/multi-runtime-compatibility.md` |
| Add or review a runtime adapter | `development-runtime-adapter-guide.md` |
| Configure GitHub release controls | `operations/github-repository-settings.md` |
| Review MCP permissions | Root `mcp-permission-policy.json` and `npm run validate:mcp` |
| Review multi-runtime support tiers | `operations/multi-runtime-compatibility.md` and `.ai-workflow/runtime-capability-matrix.json` |
| Record release ownership and exceptions | `production-readiness/release-governance-record.md` |
| Write or optimize prompts | `prompt-engineering.md` |
| Track what changed | `changelog.md` |

## How AI Agents Should Read This Documentation

1. Start with `system-overview.md` to understand scope.
2. Read `architecture.md` to understand the component model.
3. Read `workflows.md` to understand pipeline execution.
4. Reference `skills-registry.md` and `agents.md` for specific implementation details.
5. Consult `governance.md` for rules and constraints before making changes.
6. Read [`documentation-policy.md`](documentation-policy.md) before editing the repository.
7. After any change, update all affected docs and `changelog.md`, run `node scripts/verify-documentation-policy.js`, synchronize `website/data/`, and run `aiw website-check`.

## Documentation Governance

The complete machine-checkable rule is defined in [`documentation-policy.md`](documentation-policy.md) and [`scripts/documentation-policy.json`](../scripts/documentation-policy.json). Every implementation or configuration change requires `docs/changelog.md` plus the affected domain guides. Generated website data must be synchronized and committed with its authoritative source.

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
| Production hardening or release controls changed | `security.md`, `operations/production-runbook.md`, `changelog.md` |
| Runtime compatibility or adapter changed | `operations/multi-runtime-compatibility.md`, `development-runtime-adapter-guide.md`, `compatibility.json`, adapter registry, capability matrix, `changelog.md` |
| Operational procedure or recovery control changed | `operations/operator-quickstart.md`, `operations/troubleshooting.md`, `operations/production-runbook.md`, `changelog.md` |

## File Format Convention

All files follow this structure:

```markdown
# Title — Subtitle

**Version:** x.y.z | **Last updated:** YYYY-MM-DD

## Section

Content with cross-references to other files (use standard Markdown link syntax; replace `path/to/file.md` with the real relative path).

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

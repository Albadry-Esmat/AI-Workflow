# System Overview — AI Workflow

**Version:** 1.0.0 | **Last updated:** 2026-06-16

## What This System Is

A production-grade AI agent ecosystem that transforms raw ideas into deployed software through a pipeline of specialized, reusable skills. Each skill performs a single domain task — requirements analysis, architecture design, code review, security analysis, etc. — and passes structured output to the next skill in the pipeline.

## Core Principles

| Principle | Description |
|-----------|-------------|
| Modularity | Every capability is a self-contained skill. Skills are independent, testable, and reusable. |
| Structured Data | All inter-skill communication uses typed JSON schemas. No free-form prose in handoffs. |
| Orchestration | A meta-skill (orchestrator) drives the pipeline with validation, retries, and HITL gates. |
| Observability | Every skill emits standardized metrics for monitoring and optimization. |
| Governance | Change is controlled via approval gates, versioning rules, and documentation sync requirements. |

## High-Level Architecture

```
[Raw Input]
     │
     ▼
┌────────────────────────────────────────────────────────────┐
│                    ORCHESTRATOR                             │
│  (registry resolution, schema validation, routing, HITL)   │
└────┬────┬────┬────┬────┬────┬────┬────┬────┬────┬────┬────┘
     │    │    │    │    │    │    │    │    │    │    │    │
     ▼    ▼    ▼    ▼    ▼    ▼    ▼    ▼    ▼    ▼    ▼    ▼
  Req   Arch Plan Code  Sec  Test Dep  Doc  Val  Mem  Obs  Gov
  Ana   Des  ning Rev   Rev      loy  Gen  ida      erv  ern
```

## Key Capabilities

- **Requirement Analysis** — Extract, normalize, and validate requirements from raw input
- **Architecture Design** — Define modules, data flow, integration points, tech decisions
- **Feature Planning** — Break down architecture into tasks, dependencies, and roadmap
- **Code Review** — Validate code against SOLID, clean architecture, detect anti-patterns
- **Security Review** — Threat modeling, OWASP mapping, vulnerability remediation
- **Testing Strategy** — Test plans, coverage targets, quality gates
- **Deployment Strategy** — Environments, promotion rules, rollback, feature flags
- **Documentation Generation** — Auto-generate API docs, ADRs, READMEs from pipeline data
- **Schema Validation** — Runtime JSON Schema validation between pipeline steps
- **Context Memory** — Session persistence, compression, multi-turn state management

## Scope

| In Scope | Out of Scope |
|----------|--------------|
| AI-assisted development pipeline | Production hosting of applications |
| Code quality and security analysis | Runtime application monitoring |
| Documentation generation | User-facing product features |
| Deployment strategy definition | Actual deployment execution |
| Testing strategy | Test execution/runners |

## Relationship to Skills

The system's exact capabilities are defined in the [Skill Registry](skills-registry.md). Each skill is a markdown specification conforming to the [Skill Template](../skills/template/skill-template.md).

## Relationship to Agents

Agents are the executors that invoke skills. See [Agents](agents.md) for the mapping of agents to skills and their responsibilities.

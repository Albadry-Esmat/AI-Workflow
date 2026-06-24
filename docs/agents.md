# Agents — Agent Definitions

**Version:** 1.4.0 | **Last updated:** 2026-06-25

## What Is an Agent

An agent is an AI entity that executes one or more skills. Agents are defined in the system configuration and mapped to specific skills via the orchestrator.

## Agent Model

```
[User Request]
      │
      ▼
┌──────────┐
│  Primary │  ← The main agent the user interacts with
│  Agent   │
└────┬─────┘
     │ delegates to
     ▼
┌──────────┐     ┌──────────┐
│Subagent 1│     │Subagent 2│  ← Specialized agents for specific skills
└────┬─────┘     └────┬─────┘
     │ invokes        │ invokes
     ▼                ▼
   Skill A          Skill B
```

## Agent Definitions

### Primary Agent

| Property | Value |
|----------|-------|
| Name | `primary` |
| Mode | `primary` |
| Scope | Full pipeline orchestration |
| Skills delegated | All (via orchestrator) |
| HITL responsibility | Gate approvals |

The primary agent receives user requests, delegates skill execution to subagents, reviews results at HITL gates, and assembles the final response.

### Subagents

| Agent | Assigned Skills | Mode | Permission |
|-------|---------------|------|------------|
| `analyzer` | `requirement-analyzer` | `subagent` | read-only |
| `architect` | `architecture-design`, `frontend-ux-architect`, `database-architect` | `subagent` | read-only |
| `planner` | `feature-planning` | `subagent` | read-only |
| `reviewer` | `clean-code-review`, `security-review`, `implementation-completeness-auditor`, `database-guard`, `performance-guard`, `ui-ux-compliance-guard`, `security-guard`, `implementation-completeness-guard` | `subagent` | edit: ask |
| `tester` | `testing-strategy`, `test-generator`, `mutation-test-generator` | `subagent` | read-only |
| `builder` | `code-generator`, `code-repair`, `design-system-generator`, `seo-optimizer` | `subagent` | edit: ask |
| `impact-analyzer` | `dependency-analyzer`, `change-impact-analyzer` | `subagent` | read-only |
| `test-generator` | `test-generator` | `subagent` | edit: ask |
| `recovery` | `rollback-manager` | `subagent` | edit: ask |
| `deployer` | `deployment-strategy` | `subagent` | read-only |
| `documenter` | `documentation-generator` | `subagent` | edit: ask |
| `doc-maintainer` | `doc-maintainer` | `subagent` | edit: ask |
| `data-engineer` | `data-pipeline-architect`, `data-quality-validator`, `ml-pipeline-architect`, `analytics-schema-designer`, `data-contract-enforcer` | `subagent` | read-only |
| `api-designer` | `api-design-architect`, `graphql-architect`, `event-schema-designer` | `subagent` | read-only |
| `distributed-systems` | `ddd-architect`, `microservices-architect`, `event-sourcing-designer`, `distributed-resilience-architect`, `caching-strategy-designer`, `realtime-system-architect` | `subagent` | read-only |
| `cloud-platform` | `cloud-architecture-reviewer`, `serverless-architect`, `container-orchestration-architect` | `subagent` | read-only |
| `security-specialist` | `threat-model-designer`, `secrets-management-architect`, `devsecops-pipeline-designer` | `subagent` | read-only |
| `sre` | `slo-sla-designer`, `load-test-designer`, `profiling-advisor`, `runbook-generator`, `chaos-engineering-designer` | `subagent` | read-only |

### Subagent Capability Mapping

| Agent | Input Access | Output Produces | Dependencies |
|-------|-------------|-----------------|--------------|
| `analyzer` | raw input, context | requirements, open_questions, assumptions | None |
| `architect` | requirements, constraints | modules, data_flow, integration_points | analyzer |
| `planner` | requirements, modules | tasks, dependency_map, phases | architect |
| `reviewer` | code, architecture context | issues, vulnerabilities, remediation | architect |
| `tester` | requirements, modules, tasks | test_plan, test_cases, mutation_score, assertion_gaps | planner |
| `builder` | architecture, feature plan | generated code files, repair diffs | planner, impact-analyzer |
| `impact-analyzer` | architecture, proposed change | dependency_graph, impact_surface, required_skills | architect |
| `test-generator` | code artifacts, testing strategy | test suite files, coverage report | builder, tester |
| `recovery` | system state snapshots, failure event | rollback plan, restored state diff | None |
| `deployer` | architecture, test_plan | environments, promotion_rules | architect, tester |
| `documenter` | requirements, architecture, review | documents | analyzer, architect, reviewer |
| `doc-maintainer` | system change events, current /docs | updated doc files, drift report | documenter |
| `data-engineer` | requirements, architecture | ETL designs, data quality rules, ML pipeline specs, analytics schemas, data contracts | architect |
| `api-designer` | architecture, module interfaces | OpenAPI specs, GraphQL schemas, AsyncAPI event catalogs | architect |
| `distributed-systems` | architecture, requirements | bounded context maps, service decomposition, CQRS designs, resilience patterns, caching topologies | architect |
| `cloud-platform` | architecture, deployment strategy | WAF reviews, serverless topologies, Kubernetes cluster designs | deployer, architect |
| `security-specialist` | architecture, security review | STRIDE threat models, secrets management architecture, DevSecOps pipeline designs | reviewer |
| `sre` | architecture, deployment strategy | SLO/SLA designs, load test scenarios, runbooks, chaos experiments | deployer, tester |

## Agent Configuration

All agents are configured in `opencode.json` and have corresponding instruction files under `.opencode/agent/<name>.md`.

```json
{
  "agent": {
    "primary": {
      "mode": "primary",
      "model": "github-copilot/claude-sonnet-4.6",
      "permission": { "edit": "ask", "bash": "ask" },
      "description": "Main orchestrator — drives the full AI pipeline, approves HITL gates, and coordinates all subagents"
    },
    "analyzer": {
      "mode": "subagent",
      "model": "github-copilot/claude-sonnet-4.6",
      "permission": { "edit": "deny", "bash": "deny" },
      "description": "Specialist in requirement extraction, normalization, and ambiguity detection. Invoked at the start of every feature pipeline.",
      "skill": ".opencode/skills/requirement-analyzer/SKILL.md"
    },
    "architect": {
      "mode": "subagent",
      "model": "github-copilot/claude-sonnet-4.6",
      "permission": { "edit": "deny", "bash": "deny" },
      "description": "System architecture design — modules, data flow, integration points, tech decisions, UI/UX architecture, and database schema design. Invoked after requirements are validated.",
      "skills": [
        ".opencode/skills/architecture-design/SKILL.md",
        ".opencode/skills/frontend-ux-architect/SKILL.md",
        ".opencode/skills/database-architect/SKILL.md"
      ]
    },
    "planner": {
      "mode": "subagent",
      "model": "github-copilot/claude-sonnet-4.6",
      "permission": { "edit": "deny", "bash": "deny" },
      "description": "Task decomposition, dependency mapping, complexity estimation, roadmap generation. Invoked after architecture is approved.",
      "skill": ".opencode/skills/feature-planning/SKILL.md"
    },
    "reviewer": {
      "mode": "subagent",
      "model": "github-copilot/claude-sonnet-4.6",
      "permission": { "edit": "ask", "bash": "deny" },
      "description": "Code quality analysis (SOLID, clean architecture, complexity, anti-patterns) and security review. Also runs all governance guards: database, performance, UI/UX compliance, security, and implementation completeness. Invoked during the implementation phase.",
      "skills": [
        ".opencode/skills/clean-code-review/SKILL.md",
        ".opencode/skills/security-review/SKILL.md",
        ".opencode/skills/implementation-completeness-auditor/SKILL.md",
        ".opencode/skills/database-guard/SKILL.md",
        ".opencode/skills/performance-guard/SKILL.md",
        ".opencode/skills/ui-ux-compliance-guard/SKILL.md",
        ".opencode/skills/security-guard/SKILL.md",
        ".opencode/skills/implementation-completeness-guard/SKILL.md"
      ]
    },
    "tester": {
      "mode": "subagent",
      "model": "github-copilot/claude-sonnet-4.6",
      "permission": { "edit": "deny", "bash": "deny" },
      "description": "Test strategy, test code generation, mutation scoring, coverage targets, edge cases, quality gates, and CI enforcement. Invoked after feature planning is approved.",
      "skills": [
        ".opencode/skills/testing-strategy/SKILL.md",
        ".opencode/skills/test-generator/SKILL.md",
        ".opencode/skills/mutation-test-generator/SKILL.md"
      ]
    },
    "builder": {
      "mode": "subagent",
      "model": "github-copilot/claude-sonnet-4.6",
      "permission": { "edit": "ask", "bash": "deny" },
      "description": "Incremental code generation, targeted code repair, design system file generation, and SEO artifact generation. Invoked after feature planning and impact analysis are complete.",
      "skills": [
        ".opencode/skills/code-generator/SKILL.md",
        ".opencode/skills/code-repair/SKILL.md",
        ".opencode/skills/design-system-generator/SKILL.md",
        ".opencode/skills/seo-optimizer/SKILL.md"
      ]
    },
    "impact-analyzer": {
      "mode": "subagent",
      "model": "github-copilot/claude-sonnet-4.6",
      "permission": { "edit": "deny", "bash": "deny" },
      "description": "Dependency graph maintenance and change impact analysis. Runs before every code modification to compute blast radius and required downstream skills.",
      "skills": [
        ".opencode/skills/dependency-analyzer/SKILL.md",
        ".opencode/skills/change-impact-analyzer/SKILL.md"
      ]
    },
    "test-generator": {
      "mode": "subagent",
      "model": "github-copilot/gpt-4o-mini",
      "permission": { "edit": "ask", "bash": "deny" },
      "description": "Generates unit, integration, and edge-case test suites from code artifacts and testing strategies. Invoked after code-generator output is validated.",
      "skill": ".opencode/skills/test-generator/SKILL.md"
    },
    "recovery": {
      "mode": "subagent",
      "model": "github-copilot/claude-sonnet-4.6",
      "permission": { "edit": "ask", "bash": "deny" },
      "description": "Last-resort recovery agent — reverts system state to a prior snapshot on critical pipeline failure or unrecoverable build error.",
      "skill": ".opencode/skills/rollback-manager/SKILL.md"
    },
    "deployer": {
      "mode": "subagent",
      "model": "github-copilot/claude-sonnet-4.6",
      "permission": { "edit": "deny", "bash": "deny" },
      "description": "Deployment strategy — environment model, promotion rules, rollback criteria, feature flags. Invoked after testing strategy is defined.",
      "skill": ".opencode/skills/deployment-strategy/SKILL.md"
    },
    "documenter": {
      "mode": "subagent",
      "model": "github-copilot/claude-sonnet-4.6",
      "permission": { "edit": "ask", "bash": "deny" },
      "description": "Auto-generates API docs, ADRs, READMEs, and onboarding guides from pipeline artifacts. Runs asynchronously, non-blocking.",
      "skill": ".opencode/skills/documentation-generator/SKILL.md"
    },
    "doc-maintainer": {
      "mode": "subagent",
      "model": "github-copilot/gpt-4o-mini",
      "permission": { "edit": "ask", "bash": "deny" },
      "description": "Autonomous documentation maintenance engine — detects system changes and keeps /docs in sync. Triggered after every system change.",
      "skill": ".opencode/skills/doc-maintainer/SKILL.md"
    },
    "data-engineer": {
      "mode": "subagent",
      "model": "github-copilot/claude-sonnet-4.6",
      "permission": { "edit": "deny", "bash": "deny" },
      "description": "Data platform specialist — designs batch ETL pipelines, streaming architectures, ML pipelines, analytics schemas, and data contracts. Invoked when requirements include data engineering, ML, or analytics workloads.",
      "skills": [
        ".opencode/skills/data-pipeline-architect/SKILL.md",
        ".opencode/skills/data-quality-validator/SKILL.md",
        ".opencode/skills/ml-pipeline-architect/SKILL.md",
        ".opencode/skills/analytics-schema-designer/SKILL.md",
        ".opencode/skills/data-contract-enforcer/SKILL.md"
      ]
    },
    "api-designer": {
      "mode": "subagent",
      "model": "github-copilot/claude-sonnet-4.6",
      "permission": { "edit": "deny", "bash": "deny" },
      "description": "API contract specialist — produces OpenAPI 3.1 REST specs, GraphQL schemas with federation, and AsyncAPI event catalogs. Invoked after architecture-design when modules expose public interfaces.",
      "skills": [
        ".opencode/skills/api-design-architect/SKILL.md",
        ".opencode/skills/graphql-architect/SKILL.md",
        ".opencode/skills/event-schema-designer/SKILL.md"
      ]
    },
    "distributed-systems": {
      "mode": "subagent",
      "model": "github-copilot/claude-sonnet-4.6",
      "permission": { "edit": "deny", "bash": "deny" },
      "description": "Distributed systems architect — microservice decomposition with DDD, event sourcing/CQRS, resilience patterns, caching topologies, and real-time system design. Invoked for complex multi-service architectures.",
      "skills": [
        ".opencode/skills/ddd-architect/SKILL.md",
        ".opencode/skills/microservices-architect/SKILL.md",
        ".opencode/skills/event-sourcing-designer/SKILL.md",
        ".opencode/skills/distributed-resilience-architect/SKILL.md",
        ".opencode/skills/caching-strategy-designer/SKILL.md",
        ".opencode/skills/realtime-system-architect/SKILL.md"
      ]
    },
    "cloud-platform": {
      "mode": "subagent",
      "model": "github-copilot/claude-sonnet-4.6",
      "permission": { "edit": "deny", "bash": "deny" },
      "description": "Cloud infrastructure specialist — Well-Architected reviews (AWS/GCP/Azure), serverless function topologies, and Kubernetes/Helm/GitOps cluster designs. Invoked for cloud-hosted system design.",
      "skills": [
        ".opencode/skills/cloud-architecture-reviewer/SKILL.md",
        ".opencode/skills/serverless-architect/SKILL.md",
        ".opencode/skills/container-orchestration-architect/SKILL.md"
      ]
    },
    "security-specialist": {
      "mode": "subagent",
      "model": "github-copilot/claude-sonnet-4.6",
      "permission": { "edit": "deny", "bash": "deny" },
      "description": "Security depth specialist — STRIDE threat modeling, secrets management architecture, and DevSecOps pipeline design with SAST/DAST/SCA/SBOM. Invoked before and during security review for high-risk systems.",
      "skills": [
        ".opencode/skills/threat-model-designer/SKILL.md",
        ".opencode/skills/secrets-management-architect/SKILL.md",
        ".opencode/skills/devsecops-pipeline-designer/SKILL.md"
      ]
    },
    "sre": {
      "mode": "subagent",
      "model": "github-copilot/claude-sonnet-4.6",
      "permission": { "edit": "deny", "bash": "deny" },
      "description": "Site Reliability Engineering specialist — SLO/SLA design, load test scenarios, profiling analysis, runbook generation, and chaos engineering experiments. Invoked during pre-deploy and reliability review phases.",
      "skills": [
        ".opencode/skills/slo-sla-designer/SKILL.md",
        ".opencode/skills/load-test-designer/SKILL.md",
        ".opencode/skills/profiling-advisor/SKILL.md",
        ".opencode/skills/runbook-generator/SKILL.md",
        ".opencode/skills/chaos-engineering-designer/SKILL.md"
      ]
    }
  }
}
```

Agent instruction files live at `.opencode/agent/<name>.md`. These define the agent's behavior rules and execution constraints beyond the JSON config.

## Model Configuration

Every agent has its own `"model"` field in `opencode.json`. Changing the model for any agent is a **single-line edit** — no restart required.

```json
"architect": {
  "model": "github-copilot/claude-opus-4-5",   ← change this one line
  ...
}
```

The top-level `"model"` key is the global fallback for any agent that doesn't specify its own.

**Full reference** → [`docs/models.md`](models.md) — lists all available model IDs, current assignments, cost-optimisation tips, and governance rules for safety-critical agents.

## Agent Rules

1. Subagents MUST NOT modify system state outside their assigned skill's output.
2. Subagents have read-only access unless explicitly granted `edit: ask`.
3. The primary agent is the only agent that can approve HITL gates.
4. All inter-agent communication passes through the orchestrator — agents do not call each other directly.
5. Agent changes require updating this file AND `changelog.md`.

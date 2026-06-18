# Agents — Agent Definitions

**Version:** 1.1.0 | **Last updated:** 2026-06-17

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
| `reviewer` | `clean-code-review`, `security-review`, `implementation-completeness-auditor`, `database-guard`, `performance-guard`, `ui-ux-compliance-guard`, `implementation-completeness-guard` | `subagent` | edit: ask |
| `tester` | `testing-strategy` | `subagent` | read-only |
| `builder` | `code-generator`, `code-repair`, `design-system-generator`, `seo-optimizer` | `subagent` | edit: ask |
| `impact-analyzer` | `dependency-analyzer`, `change-impact-analyzer` | `subagent` | read-only |
| `test-generator` | `test-generator` | `subagent` | edit: ask |
| `recovery` | `rollback-manager` | `subagent` | edit: ask |
| `deployer` | `deployment-strategy` | `subagent` | read-only |
| `documenter` | `documentation-generator` | `subagent` | edit: ask |
| `doc-maintainer` | `doc-maintainer` | `subagent` | edit: ask |

### Subagent Capability Mapping

| Agent | Input Access | Output Produces | Dependencies |
|-------|-------------|-----------------|--------------|
| `analyzer` | raw input, context | requirements, open_questions, assumptions | None |
| `architect` | requirements, constraints | modules, data_flow, integration_points | analyzer |
| `planner` | requirements, modules | tasks, dependency_map, phases | architect |
| `reviewer` | code, architecture context | issues, vulnerabilities, remediation | architect |
| `tester` | requirements, modules, tasks | test_plan, test_cases, edge_cases | planner |
| `builder` | architecture, feature plan | generated code files, repair diffs | planner, impact-analyzer |
| `impact-analyzer` | architecture, proposed change | dependency_graph, impact_surface, required_skills | architect |
| `test-generator` | code artifacts, testing strategy | test suite files, coverage report | builder, tester |
| `recovery` | system state snapshots, failure event | rollback plan, restored state diff | None |
| `deployer` | architecture, test_plan | environments, promotion_rules | architect, tester |
| `documenter` | requirements, architecture, review | documents | analyzer, architect, reviewer |
| `doc-maintainer` | system change events, current /docs | updated doc files, drift report | documenter |

## Agent Configuration

All agents are configured in `opencode.json` and have corresponding instruction files under `.opencode/agent/<name>.md`.

```json
{
  "agent": {
    "primary": {
      "mode": "primary",
      "model": "github-copilot/claude-sonnet-4.6",
      "permission": { "edit": "ask", "bash": "ask" },
      "description": "Main orchestrator — drives the full pipeline and approves HITL gates"
    },
    "analyzer": {
      "mode": "subagent",
      "model": "github-copilot/claude-sonnet-4.6",
      "permission": { "edit": "deny", "bash": "deny" },
      "description": "Specialist in requirement extraction, normalization, and ambiguity detection"
    },
    "architect": {
      "mode": "subagent",
      "model": "github-copilot/claude-sonnet-4.6",
      "permission": { "edit": "deny", "bash": "deny" },
      "description": "System architecture design — modules, data flow, integration points"
    },
    "planner": {
      "mode": "subagent",
      "model": "github-copilot/claude-sonnet-4.6",
      "permission": { "edit": "deny", "bash": "deny" },
      "description": "Task decomposition, dependency mapping, complexity estimation, roadmap"
    },
    "reviewer": {
      "mode": "subagent",
      "model": "github-copilot/claude-sonnet-4.6",
      "permission": { "edit": "ask", "bash": "deny" },
      "description": "Code quality (SOLID, clean arch) and security review (STRIDE, OWASP)"
    },
    "tester": {
      "mode": "subagent",
      "model": "github-copilot/claude-sonnet-4.6",
      "permission": { "edit": "deny", "bash": "deny" },
      "description": "Test strategy, coverage targets, edge cases, quality gates"
    },
    "deployer": {
      "mode": "subagent",
      "model": "github-copilot/claude-sonnet-4.6",
      "permission": { "edit": "deny", "bash": "deny" },
      "description": "Deployment strategy — environments, promotion, rollback, feature flags"
    },
    "documenter": {
      "mode": "subagent",
      "model": "github-copilot/claude-sonnet-4.6",
      "permission": { "edit": "ask", "bash": "deny" },
      "description": "Auto-generates API docs, ADRs, READMEs from pipeline artifacts"
    },
    "doc-maintainer": {
      "mode": "subagent",
      "model": "github-copilot/gpt-4o-mini",
      "permission": { "edit": "ask", "bash": "deny" },
      "description": "Autonomous documentation engine — keeps /docs in sync after every change"
    },
    "builder": {
      "mode": "subagent",
      "model": "github-copilot/claude-sonnet-4.6",
      "permission": { "edit": "ask", "bash": "deny" },
      "description": "Incremental code generation and targeted code repair"
    },
    "impact-analyzer": {
      "mode": "subagent",
      "model": "github-copilot/claude-sonnet-4.6",
      "permission": { "edit": "deny", "bash": "deny" },
      "description": "Dependency graph maintenance and change impact analysis — runs before every code modification"
    },
    "test-generator": {
      "mode": "subagent",
      "model": "github-copilot/gpt-4o-mini",
      "permission": { "edit": "ask", "bash": "deny" },
      "description": "Generates unit, integration, and edge-case test suites from code artifacts"
    },
    "recovery": {
      "mode": "subagent",
      "model": "github-copilot/claude-sonnet-4.6",
      "permission": { "edit": "ask", "bash": "deny" },
      "description": "Last-resort recovery — reverts system state to a prior snapshot on critical failure"
    }
  }
}
```

Agent instruction files live at `.opencode/agent/<name>.md`. These define the agent's behavior rules and execution constraints beyond the JSON config.

## Agent Rules

1. Subagents MUST NOT modify system state outside their assigned skill's output.
2. Subagents have read-only access unless explicitly granted `edit: ask`.
3. The primary agent is the only agent that can approve HITL gates.
4. All inter-agent communication passes through the orchestrator — agents do not call each other directly.
5. Agent changes require updating this file AND `changelog.md`.

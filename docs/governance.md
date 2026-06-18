# Governance — Approval Gates & Quality Enforcement

**Version:** 2.0.0 | **Last updated:** 2026-06-17

## Governance Model

The system uses a four-layer governance model:

```
Layer 1: Automated Governance (enforced by orchestrator & validator)
  → Schema validation, token budgets, retry limits, dependency checks

Layer 2: Guard Skills (enforced by orchestrator as validation_check gates)
  → Database safety, performance, UI/UX compliance, implementation completeness

Layer 3: HITL Gates (enforced by orchestrator, decided by humans)
  → Architecture approval, security posture, completeness sign-off, deployment go/no-go

Layer 4: Documentation Governance (enforced by process)
  → Doc sync rules, changelog updates, versioning
```

## Automated Governance Rules

### Schema Validation (Layer 1)

| Rule | Enforcement | Consequence |
|------|-------------|-------------|
| Every output must match its schema | schema-validator after each skill | Retry up to 5x, then halt |
| Required fields must be present | Schema `required` array | Validation error |
| Field types must match | Schema `type` constraints | Validation error |
| Unknown properties (strict mode) | Schema `additionalProperties: false` | Validation warning/error |

### Pipeline Integrity (Layer 1)

| Rule | Enforcement | Consequence |
|------|-------------|-------------|
| Dependency graph must be acyclic | Orchestrator at pipeline start | Pipeline rejected |
| All registry references must resolve | Orchestrator at start | Skill not found error |
| Max retries per skill | Orchestrator configuration | Pipeline halted after 5 retries |
| Max feedback loops | Session context tracking | Force-terminated after 3 loops |
| Token budget limits | Session context tracking | Session halted, partial results |
| Missing deployment gate | Orchestrator validation | Pipeline rejected with `MISSING_DEPLOYMENT_GATE` |

### Agent Permissions (Layer 1)

| Rule | Enforcement | Consequence |
|------|-------------|-------------|
| Subagents cannot modify files | Permission config | Action denied |
| Subagents cannot execute arbitrary bash | Permission config | Action denied |
| Primary agent must approve HITL gates | Orchestrator gate logic | Pipeline paused |

## Guard Skills (Layer 2)

Guard skills are enforcement agents that run as `validation_check` gates. A `block` verdict from any guard **halts the pipeline immediately** — the orchestrator cannot advance past a guard that returned `block`.

### Guard Inventory

| Guard | Skill | Blocks When | Depends On |
|-------|-------|-------------|-----------|
| Database Guard | `database-guard` (SKL-034) | Destructive migration without approval, missing FK index, unannotated PII, missing cascade rule | database-architect (SKL-032) |
| Performance Guard | `performance-guard` (SKL-035) | N+1 query patterns, missing indexes on query-critical columns | architecture-design (SKL-002), clean-code-review (SKL-004) |
| UI/UX Compliance Guard | `ui-ux-compliance-guard` (SKL-036) | Hardcoded colors, missing required component states, accessibility violations, prop contract violations | frontend-ux-architect (SKL-031) |
| Implementation Completeness Guard | `implementation-completeness-guard` (SKL-037) | Readiness score < threshold (default: 85), critical requirements marked missing | implementation-completeness-auditor (SKL-033) |

**Previously existing guards (covered by existing skills):**

| Guard Function | Skill | Layer |
|----------------|-------|-------|
| Architecture boundary enforcement | `change-impact-analyzer` (SKL-024) | Layer 1 |
| Security enforcement | `security-review` (SKL-006) | Layer 3 |
| Documentation enforcement | `doc-maintainer` (SKL-011) | Layer 4 |
| Dependency cycle detection | `dependency-analyzer` (SKL-023) | Layer 1 |
| Code quality enforcement | `clean-code-review` (SKL-004) | Layer 3 |
| Test coverage enforcement | `testing-strategy` (SKL-005) + `test-generator` (SKL-028) | Layer 3 |
| DevOps enforcement | `deployment-strategy` (SKL-007) | Layer 3 |

### Guard Verdict Contract

All guard skills produce a standardized verdict object:

```json
{
  "verdict": "pass" | "block",
  "violations": [
    {
      "rule": "rule_name",
      "severity": "critical" | "major" | "minor",
      "remediation": "..."
    }
  ]
}
```

The orchestrator reads `verdict` after each guard gate:
- `pass` → pipeline continues
- `block` → pipeline halts, gate decision logged, human review required before continuation

## HITL Gate Rules (Layer 3)

| Gate | After Skill | Required For | Timeout | Auto-Continue? |
|------|-------------|--------------|---------|----------------|
| Validate scope | `requirement-analyzer` | Pipeline continuation | 3600s | No |
| Sign off architecture | `architecture-design` | Feature planning | 3600s | No |
| UX architecture approval | `frontend-ux-architect` | UI implementation | 3600s | No |
| Database schema approval | `database-architect` | DB implementation | 3600s | No |
| Approve roadmap | `feature-planning` | Implementation | 3600s | No |
| Approve security | `security-review` | Deployment | 3600s | No |
| Completeness sign-off | `implementation-completeness-auditor` | Release pipeline | 3600s | No |
| **Deploy approval** | **`deployment-strategy`** | **Production release** | **∞ (no timeout)** | **Never — hardcoded** |

### Deployment Gate (Special Rule)

The deployment gate is a system-level invariant:

- `bypass_on_timeout: false` — no timeout overrides allowed
- The `deployment_approval_request` artifact from `deployment-strategy` is presented verbatim to the user
- The pipeline produces a `release_ready` state and stops
- No deployment action occurs until an explicit `approve` response is received
- Any pipeline configuration missing this gate is **rejected before execution** with error `MISSING_DEPLOYMENT_GATE`

### Gate Response Actions

| Response | Orchestrator Action |
|----------|---------------------|
| `approve` | Continue pipeline, log decision |
| `reject` | Halt pipeline, return partial results |
| `modify` | Apply modifications to current artifact, re-validate, continue |
| `timeout` | Log `gate_skipped`, auto-continue (standard gates only — NOT deployment gate) |

## Documentation Governance (Layer 4)

### Sync Rules

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
| Guard skill added/modified | `governance.md`, `skills-registry.md`, `changelog.md` |

### Change Approval Process

```
1. Identify change type (feat, fix, docs, refactor, etc.)
2. Determine which docs need updating (see sync rules)
3. Make code change + doc change in same branch
4. Run quality checks (lint, test, validate)
5. Submit PR with doc changes included
6. Review: verify docs match code changes
7. Merge → changelog updated → docs synced
```

## Quality Enforcement

### Pre-Merge Checklist

- [ ] All tests pass
- [ ] Lint passes
- [ ] No schema validation errors
- [ ] All affected docs updated
- [ ] Changelog entry added
- [ ] Version bumped if applicable
- [ ] Registry updated if skill changed
- [ ] All guard verdicts are `pass` (or block resolved with human approval)

### Pre-Deploy Checklist

- [ ] All pre-merge checks passed
- [ ] Integration tests pass
- [ ] Security scan clean
- [ ] Coverage targets met
- [ ] All HITL gates approved
- [ ] Rollback plan documented
- [ ] Feature flags configured
- [ ] `implementation-completeness-guard` verdict: `pass`
- [ ] `deployment_approval_request` reviewed and explicitly approved by user

## Governance Change Rules

- Adding a governance rule requires updating this file AND `changelog.md`.
- HITL gate changes require updating the orchestrator AND this file.
- Permission changes require updating agent configuration AND this file.
- Adding a guard skill requires updating the Guard Inventory table AND `skills-registry.md`.

## Agent Resource Limits

This section defines the intended token budgets and timeout constraints that the orchestrator must enforce per agent invocation. These are governance policies — not JSON config values. The orchestrator is responsible for tracking and enforcing them.

### Token Budgets Per Agent Tier

| Agent Tier | Examples | Max Tokens Per Invocation |
|------------|----------|--------------------------|
| Read agents (no file writes) | `analyzer`, `architect`, `planner`, `tester`, `impact-analyzer`, `deployer` | 50,000 |
| Write agents (`edit: ask`) | `builder`, `reviewer`, `test-generator`, `documenter`, `doc-maintainer`, `recovery` | 100,000 |
| Primary orchestrator | `primary` | 200,000 |

### Timeout Policy

| Scope | Limit | Behaviour on Breach |
|-------|-------|---------------------|
| All agents | 300 seconds soft timeout per invocation | Orchestrator logs `invocation.timeout`, marks skill `failed`, triggers retry or halt |

### Enforcement Rules

1. The orchestrator MUST track `consumed_tokens` per invocation and halt the agent if the tier limit is reached.
2. On a soft timeout breach (300 s), the orchestrator logs the event in `event_log` and applies the standard retry/halt policy (max 5 retries for regular skills, 1 retry for guards).
3. Agents that exceed their token budget receive a `token_budget_exceeded` error; partial output is discarded and the skill is retried with a pruned input context.
4. The primary orchestrator's 200,000-token budget is tracked across all sub-invocations it initiates within a single pipeline turn.
5. Budget limits apply per invocation, not per session — session-level tracking is handled separately via `token_budget` in the system state schema.

### Change Policy

Any modification to these limits requires updating this file AND `changelog.md`. Raising a limit above the values defined here requires explicit HITL approval before the change takes effect.

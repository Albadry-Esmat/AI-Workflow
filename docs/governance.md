# Governance — Approval Gates & Quality Enforcement

**Version:** 1.0.0 | **Last updated:** 2026-06-16

## Governance Model

The system uses a layered governance model:

```
Layer 1: Automated Governance (enforced by orchestrator & validator)
  → Schema validation, token budgets, retry limits, dependency checks

Layer 2: HITL Gates (enforced by orchestrator, decided by humans)
  → Architecture approval, security posture, deployment go/no-go

Layer 3: Documentation Governance (enforced by process)
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

### Agent Permissions (Layer 1)

| Rule | Enforcement | Consequence |
|------|-------------|-------------|
| Subagents cannot modify files | Permission config | Action denied |
| Subagents cannot execute arbitrary bash | Permission config | Action denied |
| Primary agent must approve HITL gates | Orchestrator gate logic | Pipeline paused |

## HITL Gate Rules (Layer 2)

| Gate | After Skill | Required For | Timeout | Auto-Continue? |
|------|-------------|--------------|---------|----------------|
| Validate scope | `requirement-analyzer` | Pipeline continuation | 3600s | No |
| Sign off architecture | `architecture-design` | Feature planning | 3600s | No |
| Approve roadmap | `feature-planning` | Implementation | 3600s | No |
| Approve security | `security-review` | Deployment | 3600s | No |
| Deploy approval | `deployment-strategy` | Production release | 3600s | No |

### Gate Response Actions

| Response | Orchestrator Action |
|----------|---------------------|
| `approve` | Continue pipeline, log decision |
| `reject` | Halt pipeline, return partial results |
| `modify` | Apply modifications to current artifact, re-validate, continue |
| `timeout` | Log `gate_skipped`, auto-continue (if configured) |

## Documentation Governance (Layer 3)

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

### Pre-Deploy Checklist

- [ ] All pre-merge checks passed
- [ ] Integration tests pass
- [ ] Security scan clean
- [ ] Coverage targets met
- [ ] HITL gates approved
- [ ] Rollback plan documented
- [ ] Feature flags configured

## Governance Change Rules

- Adding a governance rule requires updating this file AND `changelog.md`.
- HITL gate changes require updating the orchestrator AND this file.
- Permission changes require updating agent configuration AND this file.

# Deployment — CI/CD & Release Process

**Version:** 1.0.0 | **Last updated:** 2026-06-16

## Environment Model

| Environment | Purpose | Promotion Type | Data |
|-------------|---------|----------------|------|
| `dev` | Active development | Automatic | Synthetic |
| `staging` | Integration testing | Manual gate | Anonymized |
| `pre-prod` | Final validation | Manual gate + security check | Anonymized |
| `production` | Live system | Manual gate + full approval | Real (masked PII) |

## Promotion Flow

```
dev ──(auto: tests pass)──► staging ──(manual gate)──► pre-prod ──(manual+security)──► production
```

### Promotion Rules

| From | To | Gates | Auto? |
|------|----|-------|-------|
| `dev` | `staging` | Unit tests pass, lint passes, coverage ≥ threshold | Yes |
| `staging` | `pre-prod` | Integration tests pass, no critical bugs, HITL approval | No |
| `pre-prod` | `production` | E2E tests pass, security scan clean, manual approval, rollback plan | No |

## Deployment Patterns

| Module Criticality | Pattern | Rationale |
|-------------------|---------|-----------|
| Low (docs, tests) | Rolling | Fast, minimal overhead |
| Medium (planning, analysis) | Blue-green | Zero-downtime, easy rollback |
| High (security, deployment) | Canary | Gradual rollout, traffic monitoring |

### Pattern Definitions

- **Rolling**: Update instances gradually. No full rollback — revert per instance.
- **Blue-green**: Two identical environments. Switch traffic on success. Instant rollback via DNS flip.
- **Canary**: Route small % of traffic to new version. Monitor errors. Gradual increase.

## Rollback Strategy

| Trigger | Metric | Threshold | Procedure |
|---------|--------|-----------|-----------|
| Error rate spike | 5xx rate | > 1% increase | Auto rollback within 60s |
| Latency increase | p99 latency | > 500ms increase | Auto rollback within 120s |
| Health check failure | /health | 3 consecutive failures | Auto rollback immediately |
| Security alert | Critical vulnerability | Any | Manual rollback within 30m |
| Manual intervention | Human decision | N/A | Flag toggle or full revert |

## Feature Flag Governance

| Property | Standard |
|----------|----------|
| Naming pattern | `flag.<domain>.<feature_name>` (e.g., `flag.review.strict_mode`) |
| Lifecycle | `create → activate(staging) → activate(production) → deactivate → retire` |
| Types | `release` (toggle features), `ops` (operational control), `permission` (access control), `experiment` (A/B testing) |
| Ownership | Skill domain owner |
| Retention | Deactivated flags must be retired within 2 releases |

## CI/CD Pipeline

```
[Commit] → Lint → Unit Tests → Build → Schema Validation → [Artifact]
                                                                    │
                                                                    ▼
                                                              [Dev Deploy]
                                                                    │
                                                         (auto if tests pass)
                                                                    ▼
                                                              [Staging Deploy]
                                                                    │
                                                         (manual gate)
                                                                    ▼
                                                              [Pre-prod Deploy]
                                                                    │
                                                         (manual + security)
                                                                    ▼
                                                              [Production Deploy]
```

## Deployment Skill

The `deployment-strategy` skill (`skills/deployment/deployment-strategy.md`) generates the deployment plan automatically from architecture and test plan. It outputs promotion rules, rollback criteria, feature flag definitions, and environment topology.

## Deployment Change Rules

- Adding an environment requires updating this file AND `changelog.md`.
- Changing deployment patterns requires updating the deployment skill.
- Rollback criteria changes require updating this file AND the deployment skill.

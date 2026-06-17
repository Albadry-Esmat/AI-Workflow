# Deployment Strategy — Knowledge Reference

**Skill ID:** SKL-007
**Version:** 1.0.0 | **Last updated:** 2026-06-16
**Mastery Level:** intermediate
**Executable Skill:** [deployment-strategy](../deployment/deployment-strategy.md)
**Primary Source:** *Continuous Delivery* — Humble & Farley (2010); *Site Reliability Engineering* — Google (2016)

---

## Overview

A deployment strategy defines how software moves from development to production safely, reliably, and reversibly. The goal is to make releases routine — so boring that they require no heroics. This means automating promotion gates, defining rollback triggers, and removing fear from the release process through incremental exposure and observable behavior.

---

## Purpose

Apply this skill to:

- Define the environment topology and promotion gates between environments
- Select appropriate deployment patterns based on risk and criticality
- Define rollback criteria that trigger automatically or with minimal manual intervention
- Establish feature flag governance that separates deployment from release

---

## Principles

### P1 — Deployment Pipeline *(Continuous Delivery, Humble & Farley — Ch 5)*

Every change must pass through a repeatable, automated sequence of validation stages before reaching production.

**Stage model:**
1. Commit stage — unit tests, lint, build, schema validation (minutes)
2. Acceptance stage — integration and E2E tests (< 1 hour)
3. Performance stage — load and stress tests (on demand)
4. Production — manual gate + automated promotion

**Rules:**
- The pipeline is the only path to production — no "hotfixes" bypassing stages
- Every stage must be able to run independently and produce a pass/fail result
- Failed stages must halt promotion automatically — no manual override without audit trail

### P2 — Deployment Is Not Release *(Feature Flags, Martin Fowler)*

Deploying code and releasing a feature are separate events. Code is deployed continuously; features are released selectively via feature flags.

**Flag types:**
| Type | Purpose | Example |
|------|---------|---------|
| Release toggle | Enable feature for % of users | New checkout flow for 5% of users |
| Ops toggle | Operational kill switch | Disable search under DB load |
| Permission toggle | Role-based access | Show admin UI only to admins |
| Experiment toggle | A/B testing | Test two button copy variants |

**Rule:** Every flag has an owner, a retirement date, and a documented lifecycle.

### P3 — Rollback Must Be Automatic for Production *(SRE, Google — Ch 12)*

Manual rollback under incident pressure leads to mistakes. Define the exact metrics and thresholds that trigger an automatic rollback before deployment begins.

**Rollback triggers:**
- Error rate: 5xx rate > 1% increase from baseline over 5 minutes
- Latency: p99 latency > 500ms over baseline over 5 minutes
- Health check: 3 consecutive `/health` failures

**Rule:** If the rollback procedure cannot be executed in < 5 minutes, it is not a rollback procedure — it is a recovery procedure.

---

## Practices

| Practice | Description |
|----------|-------------|
| Blue-green deployment | Two identical environments; instant traffic switch on success; immediate rollback via DNS |
| Canary deployment | Route 1–5% of traffic to new version; monitor for errors before full promotion |
| Rolling deployment | Replace instances one at a time; lower overhead; per-instance rollback only |
| Environment parity | Dev, staging, and production must be structurally identical — no "it works on my machine" |
| Immutable artifacts | Deploy a versioned, signed artifact — never modify running code in place |

---

## Anti-patterns

### AP1 — Snowflake Servers

**What:** Production servers configured manually over time, with unique configurations that cannot be reproduced.
**Why harmful:** No two environments are the same; debugging fails; servers cannot be replaced.
**How to fix:** Infrastructure as Code. All server state is version-controlled and reproducible.

### AP2 — The Friday Deploy

**What:** Releasing changes late on Friday before a weekend with no on-call team.
**Why harmful:** Problems surface after business hours with minimal response capacity.
**How to fix:** Define a release calendar. Automated systems deploy continuously during working hours.

### AP3 — Long-Lived Feature Flags

**What:** Feature flags that remain active for months or years, accumulating conditional logic throughout the codebase.
**Why harmful:** Combinatorial complexity; impossible to test all flag states; technical debt.
**How to fix:** Feature flags have a retirement SLA. After full rollout, delete the flag and the conditional.

### AP4 — Deploy Without Rollback Plan

**What:** Deploying to production without pre-defined rollback criteria or a tested rollback procedure.
**Why harmful:** Under incident pressure, improvised rollback leads to data loss or extended outages.
**How to fix:** Define rollback criteria and test the rollback procedure in staging before every production release.

---

## Examples

### ✅ Correct — Automatic Rollback Trigger

```yaml
rollback_criteria:
  - metric: error_rate_5xx
    threshold: "+1% from baseline"
    window: "5 minutes"
    procedure: auto_rollback
  - metric: p99_latency_ms
    threshold: "+500ms from baseline"
    window: "5 minutes"
    procedure: auto_rollback
```

### ❌ Incorrect — Manual Rollback Only

```yaml
rollback_criteria:
  - condition: "on-call engineer decides it is bad"
    procedure: manual  # requires human judgment under pressure — too slow
```

---

### ✅ Correct — Feature Flag with Lifecycle

```yaml
flag:
  name: flag.checkout.new_payment_flow
  type: release
  owner: payments-team
  created: 2026-06-01
  retire_by: 2026-08-01  # explicit retirement date
  lifecycle: [dev, staging, production-5%, production-100%, retired]
```

### ❌ Incorrect — Permanent Flag

```python
if FEATURE_FLAGS.get("new_payment_flow", False):
    # code from 2023 that nobody dares to delete
```

---

## Related Skills

| Skill | ID | Relationship |
|-------|----|-------------|
| Architecture Design | SKL-002 | Architecture determines deployment topology and isolation requirements |
| Testing Strategy | SKL-005 | Quality gates in deployment come from SKL-005 test plan |
| Security Review | SKL-006 | Production credentials, secrets, and access control are deployment concerns |

---

## Source References

| Source | Chapter / Section | Linked Content |
|--------|------------------|----------------|
| *Continuous Delivery* — Humble & Farley | Ch 1: The Problem of Delivering Software | Overview |
| *Continuous Delivery* — Humble & Farley | Ch 5: Anatomy of the Deployment Pipeline | P1 |
| *Continuous Delivery* — Humble & Farley | Ch 10: Deploying and Releasing Applications | P2, Practices |
| *Site Reliability Engineering* — Google | Ch 8: Release Engineering | P1 |
| *Site Reliability Engineering* — Google | Ch 12: Effective Troubleshooting | P3 |
| *The DevOps Handbook* — Kim et al. | Part II: Where to Start | AP1, AP2 |
| Feature Toggles — Martin Fowler (martinfowler.com) | Full article | P2, AP3 |

---
name: maintainability-reviewer
version: 1.0.0
domain: planning
description: >
  Use when reviewing an implementation plan draft for test coverage strategy, documentation gaps,
  operational runbook coverage, and long-term maintainability risks as part of the
  specialized_review pipeline mode. Triggers on: "maintainability review", "test coverage check",
  "review documentation plan", "rollback strategy review". Do NOT use outside of pipeline_mode
  specialized_review.
author: system
---

# Maintainability Reviewer

**Reviewer Code:** MAINT  
**Finding ID prefix:** `RVW-MAINT-NNNN`  
**Parallel-safe:** true  
**GUARDRAIL:** MUST NOT generate a plan. Forbidden fields stripped by orchestrator.

---

## Purpose

Review the plan draft for test coverage strategy, rollback procedures, documentation gaps,
and operational maintainability. Produce `ReviewFinding[]` conforming to `review-finding.schema.json`.
Emit `test_strategy_coverage_pct` — consumed by TASK-0073 hard check HC-005.

---

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `plan_draft` | object | Yes | Current plan draft |
| `requirements` | array | Yes | Validated requirements |
| `session_id` | string | Yes | UUID v4 |

---

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `findings` | `ReviewFinding[]` | Maintainability findings. `reviewer_type: "maintainability"`. |
| `section_confidences` | object | `{ section_id: float }` |
| `test_strategy_coverage_pct` | float | `(sections_with_test_strategy / total_sections) * 100`. Used by HC-005. |
| `rollback_coverage_pct` | float | `(sections_with_rollback / high_risk_sections) * 100`. Used by HC-006. |
| `reviewer_meta` | object | Standard meta + `{ test_strategy_coverage_pct, rollback_coverage_pct }` |

---

## Review Checklist

### Hard Checks

| Check ID | Name | Pass Condition |
|----------|------|----------------|
| HC-MAINT-01 | Test strategy per component | Every plan component (module/service) has at least one associated test task (unit, integration, or E2E). `test_strategy_coverage_pct === 100`. |
| HC-MAINT-02 | Rollback strategy | Every deployment unit with `risk_level: high` or `risk_level: critical` has an explicit documented rollback procedure. |
| HC-MAINT-03 | Observability coverage | Every component has metrics, logging, and tracing strategy defined. |

### Soft Checks

| Check ID | Name | Pass Condition |
|----------|------|----------------|
| SC-MAINT-01 | Documentation completeness | All public-facing APIs have a documentation task in the plan. |
| SC-MAINT-02 | API versioning strategy | Any breaking API change has a migration strategy stated. |
| SC-MAINT-03 | On-call runbook coverage | Critical operational failure scenarios have runbook tasks identified. |

---

## Confidence Computation

Same formula. `issue_fingerprint` = `sha256(title + section_id + "maintainability")[:16]`.

---

## Category Taxonomy

| Category | Description |
|----------|-------------|
| `missing_test` | Component has no test strategy |
| `missing_rollback` | High-risk component has no rollback procedure |
| `missing_observability` | No metrics/logs/traces strategy |
| `missing_docs` | Public API has no documentation task |
| `solid_violation` | SOLID principle structurally violated in plan |
| `tech_debt` | TBD/assumption introduces deferred debt |
| `missing_runbook` | Critical failure scenario has no runbook |
| `api_versioning_gap` | Breaking change with no migration strategy |

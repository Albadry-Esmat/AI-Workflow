---
name: validation-checklist-engine
version: 1.0.0
domain: planning
description: >
  Use when deterministically validating a revised implementation plan against hard and soft
  quality checks before contract freeze. Triggers on: "validate plan", "run validation
  checklist", "plan quality gate", "check plan completeness". Invoked exclusively by
  phase-4h-validation after phase-4g-change-requests completes. Pure logic — no LLM call.
author: system
---

# Validation Checklist Engine

**Type:** Deterministic validation skill (no LLM call)  
**Phase:** `phase-4h-validation`  
**Result states:** `APPROVED` | `CONDITIONALLY_APPROVED` | `REJECTED`

---

## Purpose

Run a deterministic checklist of 7 hard checks and 6 soft checks against the revised plan,
review report, and confidence report. Produces a `validation_result` artifact that determines
whether the pipeline proceeds to contract freeze or returns to the planner for revision.

---

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `revised_plan` | object | Yes | Output from phase-4g-change-requests (or feature-planning revision) |
| `review_report` | object | Yes | Output from phase-4f-finding-aggregation |
| `confidence_report` | object | Yes | Output from phase-4d-confidence-scoring |
| `requirements` | array | Yes | Original requirements from phase-1-requirements |
| `revision_count` | integer | No | Number of times the plan has been revised in this pipeline run. Default: 0. |
| `max_revisions` | integer | No | Max revisions before HITL escalation. Default: 3. |
| `session_id` | string | Yes | UUID v4 |

---

## Hard Checks (REJECTED on any failure)

| ID | Name | Pass Condition |
|----|------|----------------|
| HC-01 | Requirement coverage 100% | Every REQ-* ID in `requirements` maps to ≥1 task in `revised_plan.tasks`. No orphaned requirements. |
| HC-02 | Interface definitions complete | All cross-module interfaces in `revised_plan` are explicitly defined. Zero instances of literal text "TBD" or "UNVERIFIED" in interface descriptions. |
| HC-03 | Dependency resolution | All declared module dependencies in `revised_plan.dependency_map` are resolvable — no reference to undefined modules. Dependency graph is a DAG (no cycles). |
| HC-04 | No open critical/high security findings | `review_report.open_critical_count === 0` AND `review_report.findings.filter(f => f.severity === "high" && f.reviewer_type === "security").length === 0`. |
| HC-05 | Test strategy per component | Every plan component has ≥1 associated test task. Sourced from `maintainability_reviewer.test_strategy_coverage_pct === 100` OR by counting test tasks per component. |
| HC-06 | Rollback strategy present | Every task with `risk_level: "high"` or `risk_level: "critical"` in `revised_plan.tasks` has an explicit `rollback_notes` field (non-empty string). |
| HC-07 | No validation-blocking sections | `confidence_report.validation_block_sections.length === 0` (no sections with confidence < 0.3). |

---

## Soft Checks (CONDITIONALLY_APPROVED on failure — logged as tech debt)

### Input Quality Checks (SC-IQ)
| ID | Name | Pass Condition |
|----|------|----------------|
| SC-IQ-01 | Decision log completeness | For every technology, architecture, data_store, protocol, security, or deployment choice in the plan, a corresponding `DecisionEntry` exists in session state `decision_log`. |
| SC-IQ-02 | Research appendix coverage | All entries in `feature_plan.uncertainty_markers` are resolved in `research_appendix.uncertainty_resolutions` with `resolution_status != "unresolvable"`. |
| SC-IQ-03 | Plan confidence threshold | `confidence_report.plan_confidence >= 0.7`. |

### Output Quality Checks (SC-OQ)
| ID | Name | Pass Condition |
|----|------|----------------|
| SC-OQ-01 | Performance budget defined | Every user-facing component in the plan has at least one of: latency target, throughput target, or availability SLO stated. |
| SC-OQ-02 | Documentation coverage ≥ 80% | At least 80% of public-facing APIs in the plan have an associated documentation task. |
| SC-OQ-03 | No stale medium findings | No medium-severity finding in `review_report.findings` has been present across ≥ 2 consecutive revision cycles (tracked via `revision_count` and finding `created_at`). |

---

## Result Logic

```
hard_failures = [HC-01..HC-07 checks that failed]
soft_failures = [SC-IQ-01..SC-OQ-03 checks that failed]

IF hard_failures.length > 0:
  verdict = "REJECTED"
ELIF soft_failures.length > 0:
  verdict = "CONDITIONALLY_APPROVED"
ELSE:
  verdict = "APPROVED"
```

---

## Revision Loop

```
IF verdict == "REJECTED":
  revision_count += 1
  IF revision_count > max_revisions:
    Emit HITL escalation (GATE-ESC-001):
      Present: revised_plan, review_report, confidence_report,
               hard_failures[], revision_history[]
      Choices:
        FORCE_PROCEED (requires ≥50 char written justification) → verdict = "CONDITIONALLY_APPROVED"
        ABORT → pipeline halts with reason "max_revisions_exceeded"
        EXTEND_REVISIONS (grants +2 more revision cycles) → revision_count -= 2, return to planner
    Gate timeout: 3600s. bypass_on_timeout: false. Timeout = pipeline error.
  ELSE:
    Return revised_plan to planner (feature-planning, mode: "checklist_revision")
    Input: revised_plan + hard_failures[] + soft_failures[]
```

---

## Outputs

Produces `validation_result` conforming to `skills/schema/validation-result.schema.json`.

| Field | Description |
|-------|-------------|
| `verdict` | `APPROVED` \| `CONDITIONALLY_APPROVED` \| `REJECTED` |
| `hard_checks` | Array of `{check_id, name, passed, evidence, failure_message?}` — exactly 7 items |
| `soft_checks` | Array of `{check_id, name, passed, subgroup, evidence, failure_message?}` — exactly 6 items |
| `hard_check_failures` | Array of failed HC check IDs. Empty when verdict is APPROVED or CONDITIONALLY_APPROVED. |
| `soft_check_failures` | Array of failed SC check IDs. |
| `revision_count` | Current revision count |
| `revision_history` | Array of `{revision_number, verdict, hard_failures, soft_failures, timestamp}` |
| `validated_at` | ISO 8601 timestamp |

---

## Rules

- **No LLM call.** All checks are deterministic boolean evaluations over structured data.
- **All 13 checks always run.** Even after the first hard failure — complete report produced.
- **Revision history is append-only.** Each run appends a new entry.
- **HITL escalation is non-bypassable.** `bypass_on_timeout: false` — timeout = pipeline error, never auto-accept.

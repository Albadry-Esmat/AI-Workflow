---
name: architecture-reviewer
version: 1.0.0
domain: planning
description: >
  Use when reviewing an implementation plan draft for architectural soundness as part of the
  specialized_review pipeline mode. Triggers on: "architecture review", "review plan architecture",
  "check module boundaries", "validate dependency graph". Do NOT use outside of pipeline_mode
  specialized_review — this skill is dispatched exclusively by the orchestrator in
  phase-4c-reviewer-dispatch.
author: system
---

# Architecture Reviewer

**Reviewer Code:** ARCH  
**Finding ID prefix:** `RVW-ARCH-NNNN`  
**Parallel-safe:** true  
**GUARDRAIL:** This skill MUST NOT generate, propose, or output an implementation plan. Any field
named `proposed_plan`, `plan_revision`, `revised_tasks`, or `new_phases` is forbidden. The
orchestrator strips forbidden fields and emits a `guardrail_violation` event.

---

## Purpose

Review the planner-generated plan draft for architectural soundness. Produce `ReviewFinding[]`
objects conforming to `skills/schema/review-finding.schema.json`. Every finding MUST have at
least one typed evidence item. Recommendations describe **what** should change — never **how**
in the form of a plan.

---

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `plan_draft` | object | Yes | Current plan draft output from `feature-planning` |
| `requirements` | array | Yes | Validated requirements from `requirement-analyzer` |
| `architecture_output` | object | Yes | Output from `architecture-design` phase |
| `research_appendix` | object | No | Research artifact from `phase-4b-research` (TASK-0075) |
| `decision_log` | array | No | Active `DecisionEntry[]` for this pipeline run |
| `session_id` | string | Yes | UUID v4 of the active pipeline session |

---

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `findings` | `ReviewFinding[]` | All findings. Validated against `review-finding.schema.json`. |
| `section_confidences` | object | `{ section_id: confidence_float }` map. Input to TASK-0079. |
| `reviewer_meta` | object | `{ reviewer: "architecture", duration_ms, finding_count, sections_reviewed[] }` |

---

## Review Checklist

Execute ALL checks in order. Emit a `ReviewFinding` for each failure.

### Hard Checks (emit severity ≥ `"high"` on failure)

| Check ID | Name | Pass Condition |
|----------|------|----------------|
| HC-ARCH-01 | Module boundary integrity | Every module in `architecture_output.modules[]` maps to ≥1 plan section. No plan sections reference undefined modules. |
| HC-ARCH-02 | Interface completeness | All cross-module interfaces explicitly typed in plan. Zero instances of `"TBD"` or `"unverified"` in interface descriptions. |
| HC-ARCH-03 | Dependency acyclicity | The declared `dependency_map` in `plan_draft` forms a DAG. Detected cycles produce a `critical` finding per cycle. |
| HC-ARCH-04 | External dependency risk | All third-party dependencies declared in `plan_draft.new_external_dependencies[]` have a stated fallback, alternative, or risk-acceptance note. |
| HC-ARCH-05 | Scalability documented | Any component with stated scale targets has an explicit horizontal or vertical scaling strategy. |

### Soft Checks (emit severity `"medium"` or `"low"`)

| Check ID | Name | Pass Condition |
|----------|------|----------------|
| SC-ARCH-01 | Layering discipline | No plan task description implies business logic executing directly in infrastructure layer (e.g., database trigger doing authorization). |
| SC-ARCH-02 | Single responsibility | No single plan section covers more than 3 independent module responsibilities. |
| SC-ARCH-03 | Abstraction completeness | No hardcoded constants, URLs, or credentials in plan descriptions. |

---

## Confidence Computation

For each `section_id` in `plan_draft.sections[]`:
```
confidence = max(0.0, 1.0 - sum(penalty for each finding targeting this section))
penalties: { critical: 0.30, high: 0.15, medium: 0.05, low: 0.02, info: 0.00 }
```

---

## Guardrail Enforcement

Before emitting output:
1. Validate each finding against `skills/schema/review-finding.schema.json`.
2. Scan output for fields: `proposed_plan`, `plan_revision`, `revised_tasks`, `new_phases`.
3. If found: strip field, log `{ event: "guardrail_violation", skill: "architecture-reviewer", field: "<name>", session_id }`.
4. Set `finding_id` format: `RVW-ARCH-{NNNN}` where NNNN is zero-padded sequence starting at 0001.
5. Set `issue_fingerprint` = first 16 hex chars of `sha256(title + section_id + "architecture")`.

---

## Category Taxonomy

| Category | Description |
|----------|-------------|
| `interface_gap` | Missing or incomplete interface definition |
| `dependency_violation` | Circular dependency or unresolvable dependency |
| `coupling` | High coupling between modules |
| `scalability` | Design will not meet scale targets |
| `resilience` | Missing fault-tolerance or recovery mechanism |
| `req_coverage` | Plan section not traceable to any requirement |
| `pattern_violation` | Architecture pattern misapplied |
| `rollback_gap` | No rollback strategy for high-risk module |

---

## Failure Scenarios

| Condition | Behavior |
|-----------|----------|
| `plan_draft` missing required fields | Emit single `critical` finding: "Plan draft is malformed — missing required fields." Do not run checks. |
| `architecture_output` absent | Emit single `high` finding: "Architecture output not available — architecture checks skipped." Run checks that do not require architecture cross-reference. |
| Finding validation fails schema check | Emit meta-finding: `{ severity: "critical", category: "other", title: "Reviewer output invalid", description: "Finding {id} failed schema validation: {error}" }` |

---

## Skill Composition

```yaml
consumes_from:
  - skill: feature-planning
    role: plan_draft
  - skill: architecture-design
    role: architecture_output
  - skill: research-artifact
    role: research_appendix (optional)

produces_for:
  - orchestrator phase: phase-4f-finding-aggregation
    passes: findings[], section_confidences
```

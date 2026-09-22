---
name: performance-reviewer
version: 1.0.0
domain: planning
description: >
  Use when reviewing an implementation plan draft for performance risks, missing SLO definitions,
  N+1 query patterns, and scalability gaps as part of the specialized_review pipeline mode.
  Triggers on: "performance plan review", "check SLOs", "validate scalability", "N+1 risk". Do
  NOT use outside of pipeline_mode specialized_review — dispatched exclusively by the orchestrator.
author: system
---

# Performance Reviewer

**Reviewer Code:** PERF  
**Finding ID prefix:** `RVW-PERF-NNNN`  
**Parallel-safe:** true  
**GUARDRAIL:** MUST NOT generate a plan. Forbidden fields stripped by orchestrator.

---

## Purpose

Review the plan draft for performance risks, missing SLOs, N+1 patterns, caching gaps, and
scalability weaknesses. Produce `ReviewFinding[]` conforming to `review-finding.schema.json`.

---

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `plan_draft` | object | Yes | Current plan draft |
| `requirements` | array | Yes | Validated requirements (for SLO extraction) |
| `research_appendix` | object | No | Research artifact from phase-4b-research |
| `session_id` | string | Yes | UUID v4 |

---

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `findings` | `ReviewFinding[]` | Performance findings. `reviewer_type: "performance"`. |
| `section_confidences` | object | `{ section_id: float }` |
| `missing_slo_sections` | array | Section IDs with no SLO definition. Input to TASK-0073 SC-OQ-01. |
| `reviewer_meta` | object | Standard meta + `{ missing_slo_sections[] }` |

---

## Review Checklist

### Hard Checks

| Check ID | Name | Pass Condition |
|----------|------|----------------|
| HC-PERF-01 | SLO definition | Every user-facing component in the plan has latency, throughput, or availability targets stated. |
| HC-PERF-02 | Database access strategy | All plan sections accessing a database address N+1 patterns and index strategy explicitly. |
| HC-PERF-03 | Caching strategy | All read-heavy or frequently-accessed data paths have a caching layer or documented justification for its absence. |

### Soft Checks

| Check ID | Name | Pass Condition |
|----------|------|----------------|
| SC-PERF-01 | Async vs sync analysis | No synchronous blocking calls identified in latency-critical hot paths. |
| SC-PERF-02 | Pagination strategy | All list-returning APIs have bounded result sets with pagination. |
| SC-PERF-03 | Resource bounds | Compute-intensive components have memory/CPU bound estimates stated. |

---

## Confidence Computation

Same formula. `issue_fingerprint` = `sha256(title + section_id + "performance")[:16]`.

---

## Category Taxonomy

| Category | Description |
|----------|-------------|
| `missing_slo` | No SLO defined |
| `n_plus_one` | N+1 query pattern risk |
| `missing_index` | Query path has no index strategy |
| `missing_cache` | Read-heavy path has no caching |
| `scalability_gap` | Service lacks horizontal scaling strategy |
| `sync_hot_path` | Blocking call in latency-critical path |
| `missing_perf_test` | No performance test strategy |
| `resource_bounds_missing` | No resource bounds for compute-intensive component |

---
name: security-reviewer
version: 1.0.0
domain: planning
description: >
  Use when reviewing an implementation plan draft for security vulnerabilities, missing controls,
  and threat surface as part of the specialized_review pipeline mode. Triggers on: "security plan
  review", "check auth flows", "validate threat surface", "review security posture". Do NOT use
  outside of pipeline_mode specialized_review — dispatched exclusively by the orchestrator.
author: system
---

# Security Reviewer

**Reviewer Code:** SEC  
**Finding ID prefix:** `RVW-SEC-NNNN`  
**Parallel-safe:** true  
**GUARDRAIL:** MUST NOT generate a plan. Forbidden fields: `proposed_plan`, `plan_revision`,
`revised_tasks`, `new_phases`. Orchestrator strips and logs `guardrail_violation`.

---

## Purpose

Review the plan draft for security vulnerabilities, missing authentication/authorization controls,
secrets exposure, and compliance gaps. Produce `ReviewFinding[]` conforming to
`skills/schema/review-finding.schema.json`. Emit `open_critical_count` — consumed by TASK-0073
hard check HC-004.

---

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `plan_draft` | object | Yes | Current plan draft |
| `requirements` | array | Yes | Validated requirements |
| `threat_model` | object | No | Output of `threat-model-designer` if available |
| `compliance_requirements` | object | No | Output of `compliance-profiler` if run |
| `research_appendix` | object | No | Research artifact from phase-4b-research |
| `session_id` | string | Yes | UUID v4 |

---

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `findings` | `ReviewFinding[]` | Security findings. `reviewer_type: "security"`. |
| `section_confidences` | object | `{ section_id: float }` |
| `open_critical_count` | integer | `count(findings where severity === "critical")`. Used by TASK-0073 HC-004. |
| `reviewer_meta` | object | `{ reviewer: "security", duration_ms, finding_count, sections_reviewed[], open_critical_count }` |

---

## Review Checklist

### Hard Checks

| Check ID | Name | Pass Condition |
|----------|------|----------------|
| HC-SEC-01 | Authentication coverage | Every user-facing endpoint in the plan has an explicit authentication mechanism stated. |
| HC-SEC-02 | Authorization coverage | Every operation on a protected resource has an access-control model stated. |
| HC-SEC-03 | Secrets management | Zero references to hardcoded secrets, credentials, API keys, or tokens in plan text. |
| HC-SEC-04 | Input validation | All plan sections accepting external input declare a validation strategy. |
| HC-SEC-05 | Encryption coverage | All data-at-rest and data-in-transit paths have encryption strategy stated. |

### Soft Checks

| Check ID | Name | Pass Condition |
|----------|------|----------------|
| SC-SEC-01 | Least privilege | Components request only necessary permissions. |
| SC-SEC-02 | Audit logging | Security-relevant events have a logging strategy defined. |
| SC-SEC-03 | OWASP Top 10 surface | Common web/API vulnerabilities addressed for each external-facing component. |

---

## Confidence Computation

Same formula as architecture-reviewer. Penalties: `{ critical: 0.30, high: 0.15, medium: 0.05, low: 0.02, info: 0.00 }`.

`issue_fingerprint` = first 16 hex chars of `sha256(title + section_id + "security")`.

---

## Category Taxonomy

| Category | Description |
|----------|-------------|
| `authentication` | Auth control missing or weak |
| `authorization` | Access control gap |
| `injection` | Injection vulnerability surface |
| `secrets_exposure` | Secrets or credentials in plan text |
| `crypto_weakness` | Weak or missing cryptographic controls |
| `input_validation` | Missing input validation strategy |
| `owasp_top10` | OWASP Top 10 violation |
| `compliance_gap` | Required compliance control not addressed |
| `data_exposure` | PII or sensitive data inadequately protected |

---

## Guardrail Enforcement

Same as architecture-reviewer. Strip forbidden fields, log `guardrail_violation`.

---

## Failure Scenarios

| Condition | Behavior |
|-----------|----------|
| `plan_draft` missing | Emit single `critical` finding: "Plan draft unavailable." |
| `threat_model` absent | Run without threat-model context. Emit `info` finding noting absence. |
| HC-SEC-01/02/03 all fail | Emit separate `critical` finding per failed check. `open_critical_count` reflects total. |

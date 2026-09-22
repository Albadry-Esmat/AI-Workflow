---
name: change-request-handler
version: 1.0.0
domain: planning
description: >
  Use when managing the lifecycle of a ChangeRequest against a frozen ImplementationContract.
  Triggers on: "submit change request", "amend the contract", "plan deviation detected",
  "CR workflow", "implementation contract change". Pauses only affected streams, dispatches
  targeted reviewers, coordinates planner amendment, and issues a new contract version.
  Do NOT use when the contract does not exist or has not been frozen.
author: system
---

# Change Request Handler

**Skill ID:** SKL-CR-HANDLER  
**Version:** 1.0.0  
**Parallel-safe:** false (serialized per contract)  
**Max CRs per contract:** 3 — the 4th CR is rejected with `CR_LIMIT_EXCEEDED`

---

## Purpose

Manage the full lifecycle of a `ChangeRequest` against an active `ImplementationContract`.
Validates the CR, pauses only the affected implementation streams, dispatches only the relevant
subset of the 4 specialized reviewers, coordinates planner amendment of the affected sections,
and issues a new contract version (version N+1). Unaffected sections continue uninterrupted.

---

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `change_request` | ChangeRequest | Yes | Must conform to `skills/schema/change-request.schema.json` |
| `active_contract` | ImplementationContract | Yes | The frozen contract being amended |
| `current_plan` | object | Yes | The current plan artifact associated with the contract |
| `session_id` | string | Yes | UUID v4 |

---

## Precondition Checks (fail-fast — reject CR immediately if any fail)

1. `change_request.contract_id === active_contract.contract_id` — target identity match
2. `active_contract.status === "active"` — contract must be live (not expired, superseded, or revoked)
3. `active_contract.change_requests.length < 3 (schema field: change_requests, max 3)` — max 3 CRs enforced at schema level AND here
4. All `affected_sections[]` keys exist in `active_contract.sections[]`
5. CR is not a duplicate: `sha256(affected_sections.sort().join("||") + reason)` not in existing CR hashes
6. `active_contract.expiry > now` — contract must not be expired

**On any precondition failure:** Set `cr.status = "rejected"`, populate `resolution.resolution_notes`, return `{ outcome: "rejected", reason: "<code>" }`. Do NOT proceed.

---

## Execution Logic

```
Step 1 — Validate CR against change-request.schema.json
  Hard fail on schema violation — return INVALID_CR_SCHEMA.

Step 2 — Run precondition checks (above)
  Hard fail on any violation.

Step 3 — Auto-assign reviewers based on affected section content tags
  Section content tag → reviewer assignment mapping:
    interface|module|dependency|data_flow|architecture → architecture-reviewer
    auth|secret|encryption|pii|compliance|permission  → security-reviewer
    slo|cache|query|latency|throughput|performance     → performance-reviewer
    test|deploy|rollback|doc|monitoring|runbook        → maintainability-reviewer
    (unrecognized or multiple)                         → all four reviewers

Step 4 — Set cr.status = "under_review"
  Emit: { event: "cr_status_changed", cr_id, status: "under_review", timestamp }

Step 5 — Pause affected streams
  Emit pause_stream event for each task in cr.impact_assessment.streams_paused[].
  Log: { event: "streams_paused", cr_id, stream_ids: [...], timestamp }

Step 6 — Targeted reviewer dispatch (parallel)
  Dispatch ONLY the reviewers from Step 3.
  Each reviewer receives:
    - plan_draft: only the sections in affected_sections[] (not full plan)
    - requirements: full requirements
    - context: { cr_id, reason, evidence }
  Collect ReviewFinding[] from each reviewer.

Step 7 — Aggregate and deduplicate findings
  Same deduplication logic as phase-4f:
    dedup_key = sha256(finding.title + '|' + finding.section_id + '|' + finding.reviewer_type)[:16]
    Keep highest severity on duplicate.
  Sort by severity DESC.

Step 8 — Planner amendment
  Dispatch feature-planning with mode: "section_amend"
  Input: current_plan + affected_sections[] + aggregated findings + cr.proposed_change
  Planner revises ONLY affected_sections.
  Planner records a new DecisionEntry for the change (decision_type: "architecture" or relevant).

Step 9 — Re-run validation checklist (TASK-0073) for amended sections only
  Run all 7 hard checks scoped to amended sections.
  Run all 6 soft checks scoped to amended sections.

Step 10a — Validation passes (APPROVED or CONDITIONALLY_APPROVED):
  Set cr.status = "approved"
  Compute new contract:
    - new_contract_id = uuid_v4()
    - version = active_contract.version + 1
    - supersedes_contract_id = active_contract.contract_id
    - plan_hash = sha256_rfc8785(full amended plan)
    - For each amended section: recompute content_hash, set amended_at, amended_by_cr
    - approved_at = now, expiry = now + 72h
    - Append cr (status: "approved", resolution.new_contract_version set) to change_requests[]
    - Store new contract at artifacts/contracts/contract-{new_contract_id}.json
    - Set active_contract.status = "superseded"
  Emit: { event: "contract_updated", old_contract_id, new_contract_id, version, cr_id }
  Resume paused streams with new contract_id reference.

Step 10b — Validation fails (REJECTED):
  Set cr.status = "rejected"
  Resume streams with original contract (unchanged).
  If this was the 3rd CR attempt AND it failed → HITL escalation.
  Emit: { event: "cr_rejected", cr_id, failing_checks: [...] }
```

---

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `updated_cr` | ChangeRequest | Final-state CR with resolved status |
| `new_contract` | ImplementationContract | New version if approved; null if rejected |
| `amendment_summary` | string | Human-readable summary of what changed |
| `streams_resumed` | array | Task IDs of resumed streams |
| `new_findings_count` | integer | Number of new findings from targeted review |

---

## Error Codes

| Code | Meaning |
|------|---------|
| `CR_LIMIT_EXCEEDED` | Contract already has 3 CRs (maxItems: 3 enforced at schema level) |
| `CONTRACT_EXPIRED` | Contract past its 72h expiry |
| `CONTRACT_NOT_FOUND` | No frozen contract for given contract_id |
| `CONTRACT_NOT_ACTIVE` | Contract status is not "active" |
| `INVALID_CR_SCHEMA` | CR fails schema validation |
| `INVALID_SECTION_REF` | affected_sections[] contains section_id not in contract |
| `DUPLICATE_CR` | CR is a duplicate of an existing applied CR |

---

## Guardrail

The change-request-handler MUST NOT auto-approve a CR without running the validation checklist.
No CR can advance to `approved` status without passing all 7 hard checks on the amended sections.

---

## Failure Scenarios

| Condition | Behavior |
|-----------|----------|
| Reviewer dispatch fails for one reviewer | Continue with available reviewers. Log warning. Do not block CR. |
| Planner amendment returns empty sections | Reject CR with `AMENDMENT_EMPTY`. |
| Validation checklist times out | Reject CR. Resume streams with original contract. Log timeout event. |
| All 3 CRs on a contract have been rejected | Emit `HITL_ESCALATION_REQUIRED`. Gate fires — human must resolve. |

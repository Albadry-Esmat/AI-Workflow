---
name: contract-freezer
version: 1.0.0
domain: planning
description: >
  Use when freezing an approved implementation plan into an immutable ImplementationContract
  after validation passes. Triggers on: "freeze contract", "generate implementation contract",
  "contract freeze", "lock the plan". Invoked exclusively by phase-4i-contract-freeze after
  phase-4h-validation returns APPROVED or CONDITIONALLY_APPROVED and GATE-003 human approval
  is granted. Pure computation — no LLM call.
author: system
---

# Contract Freezer

**Type:** Deterministic contract generation skill (no LLM call)  
**Phase:** `phase-4i-contract-freeze`  
**Prerequisite:** `validation_result.verdict IN ["APPROVED", "CONDITIONALLY_APPROVED"]` AND GATE-003 human approval granted

---

## Purpose

Generate an `ImplementationContract` from the validated plan. Compute all content hashes using
RFC 8785 canonical form, set a 72-hour expiry, populate implementation rules from open findings
and security constraints, and store the contract as an immutable artifact.

---

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `revised_plan` | object | Yes | Validated plan from phase-4h-validation |
| `validation_result` | object | Yes | Output from validation-checklist-engine |
| `review_report` | object | Yes | Output from finding-aggregator |
| `confidence_report` | object | Yes | Output from confidence-scorer |
| `decision_log` | array | No | Active DecisionEntry[] for this run |
| `session_id` | string | Yes | UUID v4 |
| `hitl_approver_id` | string | Yes | Human reviewer identifier from GATE-003 approval |

---

## Algorithm

```
Step 1 — Validate precondition
  ASSERT validation_result.verdict IN ["APPROVED", "CONDITIONALLY_APPROVED"]
  ASSERT hitl_approver_id is non-empty (GATE-003 was approved by a human)
  IF precondition fails: return error CONTRACT_FREEZE_PRECONDITION_FAILED

Step 2 — Generate contract_id
  contract_id = uuid_v4()

Step 3 — Compute plan_hash
  plan_hash = sha256_rfc8785(revised_plan)
  (serialize revised_plan using RFC 8785 JSON Canonical Form → UTF-8 → SHA-256 → hex)

Step 4 — Compute per-section content hashes
  FOR EACH section IN revised_plan.sections:
    section.content_hash = sha256_rfc8785(section)

Step 5 — Compute content_hash (module + interface contracts)
  content_hash = sha256_rfc8785({ module_contracts: [...], interface_contracts: [...] })

Step 6 — Build sections array
  FOR EACH section IN revised_plan.sections:
    section_confidence = confidence_report.sections[section.section_id].confidence
    section_status =
      IF section_confidence >= 0.7: "approved"
      ELIF section_confidence >= 0.5: "conditionally_approved"
      ELSE: "needs_attention"
    open_findings = review_report.findings
      .filter(f => f.section_id == section.section_id && f.severity IN ["critical","high"])
      .map(f => f.finding_id)
    sections.append({
      section_id, section_title, content_hash, confidence: section_confidence,
      status: section_status, open_findings, locked_at: now,
      amended_at: null, amended_by_cr: null
    })

Step 7 — Generate implementation_rules
  rules = []
  rule_counter = 1
  FOR EACH finding IN review_report.findings WHERE severity IN ["critical", "high"]:
    rules.append({
      rule_id: format("RULE-%03d", rule_counter++),
      rule_text: "MUST address: " + finding.recommendation,
      source: finding.finding_id,
      enforcement: IF finding.severity == "critical": "hard_block" ELSE: "warn"
    })
  FOR EACH decision IN decision_log WHERE decision_type IN ["security","architecture"]:
    IF decision implies a mandatory constraint:
      rules.append({
        rule_id: format("RULE-%03d", rule_counter++),
        rule_text: "Decision " + decision.id + ": " + decision.rationale,
        source: decision.id,
        enforcement: "warn"
      })

Step 8 — Assemble contract
  contract = {
    contract_id, version: 1, supersedes_contract_id: null,
    status: "active",
    schema_version: "1.2.0",
    plan_hash, content_hash,
    sections,
    approved_at: now,
    expiry: now + 72h,
    locked_at: now,
    locked_by_phase: "phase-4i-contract-freeze",
    plan_snapshot: revised_plan,
    module_contracts: revised_plan.module_contracts ?? [],
    interface_contracts: revised_plan.interface_contracts ?? [],
    implementation_rules: rules,
    change_requests: [],
    decision_log_refs: decision_log.map(d => d.id) ?? [],
    mutation_audit: [{
      timestamp: now,
      trigger: "initial_freeze",
      old_plan_hash: null,
      new_plan_hash: plan_hash,
      old_content_hash: null,
      new_content_hash: content_hash
    }]
  }

Step 9 — Validate contract
  Validate contract against skills/schema/implementation-contract.schema.json
  IF validation fails: return error CONTRACT_SCHEMA_INVALID + validation errors

Step 10 — Store immutable artifact
  path = "artifacts/contracts/contract-" + contract_id + ".json"
  Write contract to path (append-only, never overwrite)
  Emit: { event: "contract_frozen", contract_id, session_id, timestamp }

Step 11 — Return output
  Return: { contract_id, contract, storage_path: path }
```

---

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `contract_id` | string | UUID v4 of the frozen contract |
| `contract` | ImplementationContract | Full contract object |
| `storage_path` | string | Path where contract was stored |

---

## Rules

- **No LLM call.** Pure deterministic computation and file write.
- **RFC 8785 hashing mandatory.** Any implementation using `JSON.stringify()` without key-sorting violates this rule and produces non-reproducible hashes.
- **`approved_at` is set by this skill** — never by caller input. This ensures the timestamp is authoritative.
- **Immutability enforced** — storage path is write-once. Amendments create new contract versions via change-request-handler.
- **GATE-003 approval required** — `hitl_approver_id` must be non-empty. No contract can be frozen without a named human approver.

---

## Error Codes

| Code | Meaning |
|------|---------|
| `CONTRACT_FREEZE_PRECONDITION_FAILED` | Validation verdict is REJECTED or HITL approval absent |
| `CONTRACT_SCHEMA_INVALID` | Generated contract fails schema validation |
| `CONTRACT_STORAGE_FAILED` | File write to artifacts/contracts/ failed |

# FEATURE-010 — Implementation Plan: Compliance Mapper

## Target Skills / Artifacts

| Skill / Artifact | Action | Notes |
|---|---|---|
| `.opencode/skills/compliance-mapper/SKILL.md` (SKL-070) | Create | New skill — full 13-section spec |
| `skills/registry.json` | Update | Register SKL-070 with domain: governance, phase: 7 |
| `skills/index.yaml` | Update | Add index entry for compliance-mapper |

---

## §1 — Skill Overview

`compliance-mapper` is a governance-domain skill that bridges the output of `requirement-analyzer` and `architecture-design` with a built-in regulatory clause database. It produces a structured traceability matrix that maps system requirements to specific regulatory clauses across GDPR, HIPAA, PCI-DSS, SOC 2 Type II, and ISO 27001.

The skill runs in phase-7c-compliance after `security-review` has completed and before the final deployment HITL gate. It is non-blocking unless critical compliance gaps are found.

---

## §2 — Built-in Clause Database Schema

The skill carries an internal reference database of regulatory clauses. Each clause record:

```json
{
  "framework": "GDPR",
  "clause_id": "GDPR-Art-25",
  "clause_description": "Data Protection by Design and by Default",
  "keywords": ["privacy by design", "data minimisation", "default protection", "pseudonymisation"],
  "data_types_triggered": ["PII"],
  "severity_if_missing": "blocking",
  "evidence_artifacts": ["DPIA", "data_flow_diagram", "privacy_notice"]
}
```

Frameworks and representative clause sets:
- **GDPR**: Articles 5, 6, 7, 9, 12–22, 25, 28, 30, 32, 33, 35, 44–49 (26 key articles)
- **HIPAA**: Administrative Safeguards (§164.308), Physical Safeguards (§164.310), Technical Safeguards (§164.312), Breach Notification (§164.400) (18 safeguard sections)
- **PCI-DSS**: Requirements 1–12 (12 requirements, 78 sub-requirements condensed to 30 key controls)
- **SOC 2**: Trust Service Criteria — Security (CC series), Availability (A series), Confidentiality (C series), Processing Integrity (PI series), Privacy (P series) (33 criteria)
- **ISO 27001**: Annex A controls A.5–A.18 (93 controls, grouped into 14 domains)

---

## §3 — Data Flow Classification

Before mapping, the skill classifies architecture data flows against the `data_classification` map:

```
For each data_flow in architecture.data_flows:
  Identify data types (PII, PHI, PCI, financial, health, biometric, etc.)
  Map to sensitivity tiers using data_classification input (or infer from field names/descriptions)
  Flag modules that store, process, or transmit sensitive data
Output: classified_data_flows (module → data_types_handled)
```

This classification drives which clauses are applicable. A system with no PII has no GDPR Article 6 obligation; a system processing payment cards has all 12 PCI-DSS requirements applicable.

---

## §4 — Traceability Matrix Construction

For each `framework` in `frameworks` input:

```
For each clause in framework.clauses:
  1. Match requirements to clause:
     - Keyword match: requirement text vs. clause.keywords
     - Data type match: requirement handles data_type in clause.data_types_triggered
     - Domain match: requirement domain (auth, storage, audit, etc.) vs. clause domain
  2. Match implementing features:
     - Architecture modules that handle the matched requirements
  3. Check existing_controls:
     - Mark clause as satisfied if existing_controls contains a matching control ID
  4. Determine status:
     - satisfied: ≥1 requirement mapped AND ≥1 feature implements it
     - partial: requirement mapped but no implementing feature (or vice versa)
     - gap: zero requirements mapped AND not in existing_controls
  5. Generate evidence_notes: list of artifacts that would satisfy an auditor for this clause
```

Output per clause row:
```json
{
  "clause_id": "GDPR-Art-32",
  "framework": "GDPR",
  "clause_description": "Security of processing",
  "mapped_requirements": ["REQ-SEC-001", "REQ-SEC-003"],
  "implementing_features": ["encryption-module", "auth-service"],
  "status": "satisfied",
  "evidence_notes": "Requires: encryption policy doc, key management runbook, penetration test report"
}
```

---

## §5 — Gap Analysis and New Obligations Detection

**Gap analysis:**
```
gaps = clauses where status == "gap"
For each gap:
  severity = clause.severity_if_missing (blocking | major | minor)
  recommended_action = prescriptive remediation (add requirement + implementing feature)
```

Blocking gaps halt the pipeline and require HITL.

**New obligations detection:**
```
For each module in architecture that handles PII/PHI/PCI data:
  Check if a requirement exists that explicitly covers the regulatory control for that data type
  If no requirement covers it → new_obligation detected
  Emit feedback: backpropagate to requirement-analyzer to add the missing requirement
```

---

## §6 — Compliance Scoring

Per framework:
```
total_clauses   = count of applicable clauses (after data_type filtering)
satisfied       = count where status == "satisfied"
partial         = count where status == "partial"
gaps            = count where status == "gap"
score_pct       = round((satisfied + 0.5 * partial) / total_clauses * 100, 1)
```

---

## §7 — Evidence Checklist Generation

For each framework, produce an ordered checklist of audit artifacts. Each item:
```json
{
  "framework": "SOC2",
  "clause_id": "CC6.1",
  "artifact_type": "policy",
  "artifact_name": "Access Control Policy",
  "status": "required",
  "notes": "Must include role definitions, least-privilege rationale, and review cadence"
}
```

---

## §8 — Feedback Routes

| Event | Target Skill | Action |
|---|---|---|
| `critical_compliance_gap_detected` | `requirement-analyzer` | backpropagate: add missing requirement for the gap clause |
| `new_regulatory_obligation_detected` | orchestrator | HITL alert: feature introduces untracked regulatory obligation |

---

## §9 — Orchestration Position

```
Phase 7 pipeline:
  ...
  [security-review] → [compliance-mapper] → [HITL gate if blocking_gaps > 0] → [documentation-generator]
                                         ↓
                               [security-guard receives compliance_score]
```

`compliance-mapper` is skipped if `frameworks` is empty or no compliance-sensitive data types are detected in the architecture. It runs automatically when `compliance_frameworks` are declared in requirements metadata.

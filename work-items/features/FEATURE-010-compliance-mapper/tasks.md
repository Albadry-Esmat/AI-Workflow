# FEATURE-010 — Tasks & Acceptance Criteria

## Acceptance Criteria

### AC-1: Traceability Matrix Produced
- Given valid `requirements`, `architecture`, and at least one `framework` in input
- When `compliance-mapper` executes
- Then a `traceability_matrix` is returned with one row per applicable regulatory clause
- And each row contains: `clause_id`, `framework`, `clause_description`, `mapped_requirements`, `implementing_features`, `status` (satisfied / partial / gap), `evidence_notes`

### AC-2: Gap Detection
- Given a system architecture that does not implement controls for one or more regulatory clauses
- When `compliance-mapper` executes
- Then `gaps` contains all clauses with `status == "gap"`
- And each gap entry includes `severity` (blocking / major / minor) and `recommended_action`
- And if any gap has `severity == "blocking"`, the skill emits `critical_compliance_gap_detected` feedback

### AC-3: New Obligation Detection
- Given a feature in the architecture that stores or processes PII, PHI, or PCI data
- And no corresponding requirement explicitly covers the regulatory control for that data type
- When `compliance-mapper` executes
- Then `new_obligations` contains an entry for that feature
- And feedback type `new_regulatory_obligation_detected` is emitted to the orchestrator for HITL

### AC-4: Compliance Score Per Framework
- Given a multi-framework run (e.g., `frameworks: ["GDPR", "HIPAA"]`)
- When `compliance-mapper` executes
- Then `compliance_score` contains one entry per framework
- And each entry includes `total_clauses`, `satisfied`, `partial`, `gaps`, and `score_pct`
- And `score_pct` is computed as `round((satisfied + 0.5 * partial) / total_clauses * 100, 1)`

### AC-5: Evidence Checklist Generated
- Given a completed traceability analysis
- When `compliance-mapper` executes
- Then `evidence_checklist` contains at least one item per framework
- And each item includes `artifact_type`, `artifact_name`, `clause_id`, and `status`

### AC-6: Existing Controls Respected
- Given `existing_controls` contains a list of already-implemented control IDs
- When `compliance-mapper` executes
- Then clauses satisfied by `existing_controls` are marked `status: satisfied`
- And they do NOT appear in `gaps`

---

## Definition of Done (DoD)

- [ ] `compliance-mapper/SKILL.md` (SKL-070) created with full 13-section spec
- [ ] Skill header `description` field follows exact auto-trigger format
- [ ] All 6 acceptance criteria above verified against SKILL.md spec
- [ ] Input schema validated: `requirements`, `architecture`, `frameworks` all required; `data_classification` and `existing_controls` optional
- [ ] Output schema validated: all 6 output fields present (`traceability_matrix`, `gaps`, `new_obligations`, `compliance_score`, `evidence_checklist`, `metrics`, `feedback`)
- [ ] Feedback routes documented: `critical_compliance_gap_detected` → `requirement-analyzer`, `new_regulatory_obligation_detected` → orchestrator HITL
- [ ] HITL gate defined: blocking gaps pause pipeline and require human sign-off
- [ ] Skill registered in `skills/registry.json` with `status: draft`, `domain: governance`, `phase: 7`
- [ ] Index entry added to `skills/index.yaml`
- [ ] `scripts/validate-skills.sh` exits 0

---

## Sub-Tasks

| ID | Description | Skill / File | Est. SP |
|---|---|---|---|
| F010-T1 | Author `compliance-mapper/SKILL.md` — sections 1–6 (header, purpose, inputs, context, execution, outputs) | new skill | 2.0 |
| F010-T2 | Author `compliance-mapper/SKILL.md` — sections 7–13 (rules, security, tokens, quality, failures, HITL, composition) | new skill | 1.5 |
| F010-T3 | Define built-in clause database schema and representative clause sets for all 5 frameworks | new skill | 2.0 |
| F010-T4 | Register SKL-070 in `skills/registry.json` and `skills/index.yaml` | registry | 0.5 |
| F010-T5 | Run `validate-skills.sh` and verify exit 0 | CI | 0.5 |
| F010-T6 | Integration test: compliance-mapper output → security-guard compliance_score input | testing | 1.5 |
| **Total** | | | **8 SP** |

# FEATURE-017 — Tasks & Acceptance Criteria

## Acceptance Criteria

### AC-1: Branch Isolation Enforced
- Given a fork operation with branch_a and branch_b architecture variants running in parallel
- When branch_a's feature-planning writes artifacts to branch_a_context
- Then those artifacts are not accessible in branch_b_context during branch_b's evaluation
- And state-manager read operations within branch_b's skill chain are scoped exclusively to `branch_b_context`

### AC-2: Both Branches Complete Before Scorecard Is Produced
- Given a fork operation where branch_a's security-review completes in 2 seconds and branch_b's completes in 5 seconds
- When both branches finish all four evaluation skills (feature-planning, security-review, testing-strategy, clean-code-review)
- Then `comparison_scorecard` is only produced after both branch chains have fully completed
- And `comparison_scorecard.criteria_scores` contains one entry for each of the 5 criteria

### AC-3: Scorecard Correctly Determines Per-Criterion Winner
- Given branch_a with 2 security findings (1 medium, 1 low) and branch_b with 7 security findings (3 high, 4 medium)
- When the security criterion is scored
- Then `comparison_scorecard.criteria_scores` contains a security entry where `winner: "A"`
- And `rationale` cites: `"Branch A: 2 findings (severity weight 2) vs Branch B: 7 findings (severity weight 19)"`

### AC-4: Mandatory HITL Gate Cannot Be Bypassed
- Given a completed comparison_scorecard with an overall_winner of "A"
- When the fork operation finishes
- Then the pipeline halts at the HITL gate with `reject` behavior and no timeout
- And calling `select` without a prior HITL gate approval event returns `{"error": "HITL_GATE_NOT_APPROVED"}`

### AC-5: Branch Promotion and Archival After Select
- Given a select operation with `selected_branch: "B"` following a HITL gate approval
- When select executes
- Then all artifacts from `branch_b_context` are promoted to the main session context
- And `branch_a_context` is moved to `archived_branches.A` in state-manager (not deleted)
- And no branch_a artifacts are present in the main session context or written to the file system

### AC-6: ADR Stub Contains Both Variants
- Given a completed select operation with `selected_branch: "A"` after evaluating "Microservices" (A) vs "Monolith" (B)
- When the ADR stub is generated
- Then `adr_stub.title` contains both variant labels
- And `adr_stub.context` describes both architecture variants
- And `adr_stub.decision` references "Branch A" with the recommendation string
- And `adr_stub.consequences` summarises what Branch B offered that was not selected

---

## Definition of Done (DoD)

- [ ] `.opencode/skills/pipeline-branching/SKILL.md` (SKL-077) created — all 13 sections complete
- [ ] `skills/registry.json` updated — SKL-077 registered with `status: draft`
- [ ] `skills/index.yaml` updated — index entry for pipeline-branching added
- [ ] Isolated branch contexts enforced via distinct state-manager scope keys
- [ ] HITL gate after scorecard is mandatory — `reject` behavior, no timeout, no auto-continue
- [ ] Non-selected branch artifacts never written to main file system
- [ ] ADR stub generated on every successful select operation
- [ ] A/B/C (3-branch) fork rejected with `MAX_BRANCHES_EXCEEDED` error
- [ ] All 6 acceptance criteria above verified
- [ ] `scripts/validate-skills.sh` exits 0
- [ ] `status.md` `Status` set to `implemented` upon completion

---

## Sub-Tasks

| ID | Description | Skill / File | Est. SP |
|---|---|---|---|
| F017-T1 | Author `pipeline-branching/SKILL.md` — all 13 sections | new skill | 3.0 |
| F017-T2 | Implement fork operation — branch context isolation + input validation | skill | 1.5 |
| F017-T3 | Implement parallel evaluation orchestration (feature-planning, security-review, testing-strategy, clean-code-review per branch) | skill | 2.5 |
| F017-T4 | Implement comparison scorecard — per-criterion scoring, normalisation, winner determination | skill | 2.0 |
| F017-T5 | Implement recommendation generator — weighted vote + justification string | skill | 1.0 |
| F017-T6 | Implement select operation — branch promotion, archival, ADR stub generation | skill | 2.0 |
| F017-T7 | Register SKL-077 in `skills/registry.json` and `skills/index.yaml` | registry | 0.5 |
| F017-T8 | Run `validate-skills.sh` and resolve any issues | CI | 0.5 |
| **Total** | | | **13 SP** |

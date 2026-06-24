# FEATURE-008 — Tasks & Acceptance Criteria

## Acceptance Criteria

### AC-1: Debt Items Recorded and Deduplicated
- Given `operation: "record"` with a valid `code_review_output` from `clean-code-review`
- When `technical-debt-tracker` runs
- Then all new issues from `code_review_output` are added to `debt_register`
- And duplicate items (same `module` + `issue_type` + `location`) increment `session_count` rather than creating new entries

### AC-2: Debt Score Calculated Correctly
- Given an active `debt_register` with items of varying severity
- When `operation: "report"` runs
- Then `debt_score` is a number between 0 and 100
- And the score is derived from `sum(severity_weight × session_count)` normalized to the 0–100 scale using weights: critical=10, major=5, minor=1

### AC-3: Debt Trend Determined from Session History
- Given at least 3 prior session debt scores stored in state for the same `project_id`
- When the skill computes `debt_trend`
- Then `debt_trend` is one of `"improving"` | `"stable"` | `"degrading"`
- And `"improving"` is assigned only when the current score is lower than all three prior scores

### AC-4: Maintenance Cost Projection Produced
- Given a non-empty `debt_register` with `estimated_fix_hours` values
- When `operation: "report"` runs
- Then `maintenance_cost_projection` contains `fix_now_hours`, `deferred_30_days_hours`, and `deferred_90_days_hours`
- And deferred values apply the 15% per month compound interest model (`current_hours × 1.15^months`)

### AC-5: Remediation Backlog Ranked by ROI
- Given a non-empty `debt_register`
- When `operation: "report"` runs
- Then `remediation_backlog` contains up to 10 items ranked by `estimated_fix_hours / (severity_weight × session_count)` ascending (quick wins first)

### AC-6: Critical Debt Backpropagates to Clean-Code-Review
- Given a `debt_score` exceeding 80 after a `record` operation
- When the skill finalizes its output
- Then a `backpropagate` feedback entry targeting `clean-code-review` is emitted with reason `debt_score_critical`

### AC-7: Resolved Items Cleared on Resolve Operation
- Given `operation: "resolve"` with a valid `resolve_ids` array
- When the skill runs
- Then all matching `debt_id` values in `debt_register` have `status` set to `"resolved"`
- And resolved items are excluded from `debt_score` and `remediation_backlog` calculations

---

## Definition of Done (DoD)

- [ ] `technical-debt-tracker/SKILL.md` (SKL-068) created following 13-section template exactly
- [ ] All 8 execution steps defined with clear intermediate artifact outputs
- [ ] All four operations defined: `record`, `query`, `report`, `resolve`
- [ ] Deduplication logic defined: match on `module` + `issue_type` + `location`
- [ ] Debt score formula documented with severity weights and normalization
- [ ] Compound interest projection formula documented (15% per month)
- [ ] ROI ranking formula documented for remediation backlog
- [ ] Feedback backpropagation to `clean-code-review` when `debt_score > 80`
- [ ] Alert to orchestrator when `debt_trend: "degrading"`
- [ ] `state-manager` read/write operations defined for debt register persistence
- [ ] `skills/registry.json` updated with SKL-068 (`status: draft`)
- [ ] All 7 acceptance criteria above verified
- [ ] `docs/changelog.md` Phase 7 block updated
- [ ] `status.md` lifecycle_state set to `completed`

---

## Sub-Tasks

| ID | Description | Skill / File | Est. SP |
|---|---|---|---|
| F008-T1 | Create `technical-debt-tracker/SKILL.md` (SKL-068) — full 13-section spec | new skill | 3.0 |
| F008-T2 | Define all four operation modes: record, query, report, resolve | new skill | 1.0 |
| F008-T3 | Define deduplication and session_count increment logic | new skill | 0.5 |
| F008-T4 | Define debt score formula (severity weights, normalization to 0–100) | new skill | 0.5 |
| F008-T5 | Define debt trend detection from prior 3 session scores | new skill | 0.5 |
| F008-T6 | Define maintenance cost projection (15% monthly interest model) | new skill | 0.5 |
| F008-T7 | Define ROI-ranked remediation backlog and feedback routing | new skill | 0.5 |
| F008-T8 | Register SKL-068 in `skills/registry.json` with `status: draft` | registry | 0.5 |
| F008-T9 | Run `validate-skills.sh` and verify exit 0 | CI | 0.5 |
| **Total** | | | **8 SP** |

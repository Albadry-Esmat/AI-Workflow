# FEATURE-007 — Tasks & Acceptance Criteria

## Acceptance Criteria

### AC-1: BDD Acceptance Criteria Generated from Requirements
- Given a structured `requirements` array where each item has `id`, `description`, `type`, and `priority`
- When `acceptance-criteria-generator` runs with `format: "gherkin"`
- Then each requirement produces at least one entry in `acceptance_criteria`
- And each entry contains non-empty `ac_id`, `requirement_id`, `given`, `when`, and `then` fields

### AC-2: Unique AC IDs Assigned in Correct Format
- Given a requirements array with N requirements
- When the skill completes
- Then each generated AC entry has a unique `ac_id` matching the pattern `AC-NNN`
- And `requirement_id` in each entry exactly matches the originating requirement's `id`

### AC-3: Negative Scenarios Included by Default
- Given `include_negative_scenarios: true` (the default)
- When the skill processes each requirement
- Then each `acceptance_criteria` entry includes a non-empty `negative_scenarios` array
- And the array covers at least one of: invalid inputs, boundary conditions, or unauthorized access

### AC-4: Untestable Requirements Flagged with Feedback
- Given a requirement whose description contains ambiguous outcome language (e.g., "the system should be fast", "the UI should be intuitive")
- When the skill processes that requirement
- Then the requirement is added to `untestable_requirements` with a non-empty `reason` string
- And a `backpropagate` feedback entry targeting `requirement-analyzer` is emitted with reason `untestable_requirement_detected`

### AC-5: Coverage Map and Summary Statistics Produced
- Given any valid requirements input that completes without full rejection
- When the skill finishes
- Then `coverage_map` maps each `requirement_id` to its list of generated `ac_id` values
- And `summary.coverage_percentage` equals `((total_requirements - untestable_count) / total_requirements) × 100`

### AC-6: Testability Rating Applied to Every AC Entry
- Given `testability_check: true` (the default)
- When the skill processes each requirement
- Then every entry in `acceptance_criteria` has a `testability_rating` of `"high"`, `"medium"`, or `"low"`
- And requirements rated `"low"` are cross-referenced in `untestable_requirements`

---

## Definition of Done (DoD)

- [ ] `acceptance-criteria-generator/SKILL.md` (SKL-067) created following 13-section template exactly
- [ ] All 7 execution steps defined with clear intermediate artifact outputs
- [ ] Input schema validates `requirements` array with required sub-fields (`id`, `description`, `type`, `priority`)
- [ ] AC ID uniqueness guaranteed within a single invocation (sequential counter, zero-padded)
- [ ] Negative scenario generation covers invalid input, boundary conditions, and auth scenarios
- [ ] Testability rating algorithm defined with explicit `high` / `medium` / `low` criteria
- [ ] Feedback backpropagation to `requirement-analyzer` when untestable requirements detected
- [ ] Feedback backpropagation to `requirement-analyzer` when `untestable_count / total > 0.25`
- [ ] `skills/registry.json` updated with SKL-067 (`status: draft`)
- [ ] All 6 acceptance criteria above verified
- [ ] `docs/changelog.md` Phase 7 block updated
- [ ] `status.md` lifecycle_state set to `completed`

---

## Sub-Tasks

| ID | Description | Skill / File | Est. SP |
|---|---|---|---|
| F007-T1 | Create `acceptance-criteria-generator/SKILL.md` (SKL-067) — full 13-section spec | new skill | 2.0 |
| F007-T2 | Define actor/action/outcome extraction step from requirement descriptions | new skill | 0.5 |
| F007-T3 | Define Given/When/Then construction logic for primary (happy path) scenario | new skill | 0.5 |
| F007-T4 | Define negative scenario generation rules (invalid input, boundary, auth) | new skill | 0.5 |
| F007-T5 | Define testability rating algorithm and untestable detection with feedback routing | new skill | 0.5 |
| F007-T6 | Register SKL-067 in `skills/registry.json` with `status: draft` | registry | 0.5 |
| F007-T7 | Run `validate-skills.sh` and verify exit 0 | CI | 0.5 |
| **Total** | | | **5 SP** |

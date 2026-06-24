# FEATURE-013 — Tasks & Acceptance Criteria

## Acceptance Criteria

### AC-1: Mutations Generated Per Operator
- Given `source_code` for a module and `mutation_operators` list
- When `mutation-test-generator` executes
- Then `mutations` contains at least one mutation per applicable operator found in the source
- And each mutation includes: `mutation_id`, `operator`, `location` (function + line estimate), `original_code_fragment`, `mutated_code_fragment`
- And total mutations is capped at `max_mutations` (default: 50)

### AC-2: Kill Status Classified by Static Analysis
- Given `source_code` and `existing_tests`
- When `mutation-test-generator` executes
- Then each mutation in `mutations` has `kill_status` set to `killed`, `survived`, or `unknown`
- And killed mutations include `killing_test` (the test function name containing the decisive assertion)
- And `detection_difficulty` is assigned (`easy` / `medium` / `hard`) for each mutation

### AC-3: Mutation Score Calculated
- Given mutations have been classified
- When `mutation-test-generator` executes
- Then `mutation_score` is a number between 0 and 100
- And `mutation_score = round(killed_count / total_non_unknown_count * 100, 1)`
- And `coverage_vs_mutation_gap` is a human-readable string quantifying the gap

### AC-4: Assertion Gaps Generated for Surviving Mutations
- Given one or more mutations have `kill_status: survived`
- When `mutation-test-generator` executes
- Then `assertion_gaps` contains one entry per surviving mutation (up to 20)
- And each entry includes `gap_id`, `function`, `assertion_description`, and `example_assertion_code` in the correct language

### AC-5: Backpropagation on Low Mutation Score
- Given `mutation_score < 60`
- When `mutation-test-generator` executes
- Then feedback contains a `backpropagate` entry targeting `test-generator`
- And the feedback includes `assertion_gaps` as evidence
- And `surviving_mutations` contains only the top 20 by impact potential

### AC-6: Critical Functions Prioritised
- Given `critical_functions` contains one or more function names
- When `mutation-test-generator` executes
- Then mutations for those functions appear first in the `mutations` array
- And if `max_mutations` is reached before all functions are covered, critical functions take slots ahead of non-critical

---

## Definition of Done (DoD)

- [ ] `mutation-test-generator/SKILL.md` (SKL-073) created with full 13-section spec
- [ ] Skill header `description` field follows exact auto-trigger format
- [ ] All 7 mutation operators documented in execution logic with transformation examples
- [ ] All 6 acceptance criteria above verified against SKILL.md spec
- [ ] Input schema validated: `source_code`, `existing_tests`, `language` required; all others optional with correct defaults
- [ ] Output schema validated: all output fields present (`mutations`, `mutation_score`, `surviving_mutations`, `assertion_gaps`, `coverage_vs_mutation_gap`, `metrics`, `feedback`)
- [ ] Static-analysis-only constraint explicitly documented in SKILL.md (no code execution)
- [ ] Feedback routes documented: `mutation_score_below_threshold` → `test-generator`, `critical_function_survival_rate_high` → `clean-code-review`
- [ ] Skill registered in `skills/registry.json` with `status: draft`, `domain: testing`, `phase: 7`
- [ ] Index entry added to `skills/index.yaml`
- [ ] `scripts/validate-skills.sh` exits 0

---

## Sub-Tasks

| ID | Description | Skill / File | Est. SP |
|---|---|---|---|
| F013-T1 | Author `mutation-test-generator/SKILL.md` — sections 1–6 (header, purpose, inputs, context, execution, outputs) | new skill | 2.0 |
| F013-T2 | Author `mutation-test-generator/SKILL.md` — sections 7–13 (rules, security, tokens, quality, failures, HITL, composition) | new skill | 1.5 |
| F013-T3 | Define all 7 mutation operators with language-agnostic transformation specs and kill-detection patterns | new skill | 2.0 |
| F013-T4 | Register SKL-073 in `skills/registry.json` and `skills/index.yaml` | registry | 0.5 |
| F013-T5 | Run `validate-skills.sh` and verify exit 0 | CI | 0.5 |
| F013-T6 | Integration test: test-generator output → mutation-test-generator → backpropagate assertion_gaps → test-generator | testing | 1.5 |
| **Total** | | | **8 SP** |

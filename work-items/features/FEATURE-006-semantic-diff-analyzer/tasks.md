# FEATURE-006 — Tasks & Acceptance Criteria

## Acceptance Criteria

### AC-1: Semantic Change Detection
- Given `before_code` and `after_code` for a function whose conditional logic changed
- When `semantic-diff-analyzer` runs with `analysis_depth: "standard"`
- Then `semantic_changes` contains at least one entry with `change_type: "logic_change"`
- And each entry includes non-empty `severity`, `description`, and `location` fields

### AC-2: Security Signal Emission
- Given a code change that removes or weakens an authentication check
- When the skill processes the diff
- Then `security_signals` contains at least one entry with `change: "removed"` or `change: "weakened"`
- And a `backpropagate` feedback entry with `target_skill: "security-review"` is emitted

### AC-3: Contract Diff Produced
- Given a function where the parameter list or return type changed between versions
- When the skill runs at `analysis_depth: "standard"` or `"deep"`
- Then `contract_diff` reflects before/after for at least: `parameters`, `return_type`, and `thrown_exceptions`

### AC-4: Test Invalidation Reasons Populated
- Given a function whose return value semantics changed between versions
- When the skill processes the diff
- Then `test_invalidation_reasons` is non-empty with at least one human-readable reason string
- And a `backpropagate` feedback entry with `target_skill: "test-generator"` is emitted

### AC-5: Human-Readable Summary Always Present
- Given any valid pair of `before_code` and `after_code`
- When execution completes without error
- Then `summary` is a non-empty string of 2–3 sentences describing the behavioral impact

### AC-6: Quick Mode Bypasses Deep Analysis
- Given `analysis_depth: "quick"`
- When the skill runs
- Then Steps 3, 5, and 6 (control flow, contract diff, test invalidation) are skipped
- And `semantic_changes` still contains a structural-level change list from Steps 1 and 2
- And `contract_diff` and `test_invalidation_reasons` are returned as empty object / empty array

---

## Definition of Done (DoD)

- [ ] `semantic-diff-analyzer/SKILL.md` (SKL-066) created following 13-section template exactly
- [ ] All 7 execution steps defined with clear intermediate artifact outputs
- [ ] Input schema validates `before_code`, `after_code`, `language` as required; `analysis_depth` defaults to `"standard"`
- [ ] `security_signals` populated for all four pattern types: auth, null guard, data access, crypto
- [ ] `test_invalidation_reasons` populated when behavioral contracts change
- [ ] Feedback backpropagation to `security-review` emitted when `security_signals` has removed/weakened entries
- [ ] Feedback backpropagation to `test-generator` emitted when `contract_diff` shows type changes
- [ ] HITL gate defined for critical security signals and breaking contract changes
- [ ] `skills/registry.json` updated with SKL-066 (`status: draft`)
- [ ] All 6 acceptance criteria above verified
- [ ] `docs/changelog.md` Phase 7 block updated
- [ ] `status.md` lifecycle_state set to `completed`

---

## Sub-Tasks

| ID | Description | Skill / File | Est. SP |
|---|---|---|---|
| F006-T1 | Create `semantic-diff-analyzer/SKILL.md` (SKL-066) — full 13-section spec | new skill | 3.0 |
| F006-T2 | Define language-aware syntax parsing step for TypeScript, Python, Java, Go | new skill | 1.0 |
| F006-T3 | Define security pattern detection rules (auth checks, null guards, DB queries, crypto) | new skill | 1.5 |
| F006-T4 | Define contract diff extraction (parameters, return types, thrown exceptions, preconditions) | new skill | 1.0 |
| F006-T5 | Define test invalidation reason inference logic and feedback routing | new skill | 0.5 |
| F006-T6 | Register SKL-066 in `skills/registry.json` with `status: draft` | registry | 0.5 |
| F006-T7 | Run `validate-skills.sh` and verify exit 0 | CI | 0.5 |
| **Total** | | | **8 SP** |

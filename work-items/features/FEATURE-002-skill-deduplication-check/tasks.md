# FEATURE-002 — Tasks & Acceptance Criteria

## Acceptance Criteria

### AC-1: Dedup Runs on create/gap_seed Only
- Given `skill-authoring` invoked in `create` or `gap_seed` mode
- When author provides triggers and description
- Then Step 0 (dedup guard) executes before any scaffold is generated

### AC-2: Clear Path — No Duplicate
- Given proposed triggers yield similarity < 0.75 with all existing skills
- When Step 0 runs
- Then `DEDUP_CLEAR` is returned and the workflow proceeds to Step 1 without interruption

### AC-3: Hit Path — Duplicate Found
- Given proposed triggers yield similarity ≥ 0.75 with at least one existing skill
- When Step 0 runs
- Then workflow halts and presents the top 3 matches with skill IDs and similarity scores
- And user sees options A, B, C with no default and no auto-selection

### AC-4: Option A — Redirect to Refactor
- Given user selects Option A
- When the HITL gate is answered
- Then `skill-authoring` workflow is cancelled and user is directed to `refactor` mode targeting the suggested skill ID

### AC-5: Option B — Override Recorded
- Given user selects Option B (proceed despite duplicate)
- When scaffold is generated and skill is eventually registered
- Then `origin_metadata.dedup_override = true` and `origin_metadata.dedup_override_reason` is non-null in the registry entry

### AC-6: Refactor/Split/Validate Modes Unaffected
- Given `skill-authoring` invoked in `refactor`, `split`, or `validate` mode
- When the workflow runs
- Then Step 0 is NOT executed (dedup guard is skipped entirely)

### AC-7: Schema File Valid
- Given `skills/schema/dedup-check-result.schema.json` is created
- When the file is validated against JSON Schema draft-07
- Then it passes without errors

---

## Definition of Done (DoD)

- [ ] `skill-authoring/SKILL.md` updated — Step 0 dedup guard inserted for `create` and `gap_seed` modes
- [ ] `skills/schema/dedup-check-result.schema.json` created and valid
- [ ] All 7 acceptance criteria above verified
- [ ] `scripts/validate-skills.sh` exits 0
- [ ] `status.md` `lifecycle_state` set to `completed`

---

## Sub-Tasks

| ID | Description | Skill / File | Est. SP |
|---|---|---|---|
| F002-T1 | Update `skill-authoring/SKILL.md` — Step 0 dedup guard + HITL gate | skill-authoring | 2.5 |
| F002-T2 | Create `skills/schema/dedup-check-result.schema.json` | schema | 1.0 |
| F002-T3 | Run `validate-skills.sh` and fix any issues | CI | 0.5 |
| F002-T4 | HITL gate integration test (simulate DEDUP_HIT — all three option paths) | testing | 1.0 |
| **Total** | | | **5 SP** |

# FEATURE-003 — Tasks & Acceptance Criteria

## Acceptance Criteria

### AC-1: Schema Updated
- Given `skills/schema/registry-entry.schema.json` is updated
- When a new skill is registered after v5.1.0
- Then the registry entry validates successfully only if `origin_metadata` is present and well-formed

### AC-2: Backward Compatibility
- Given a pre-v5.1.0 skill record lacking `origin_metadata`
- When `validate-skills.sh` runs
- Then it exits 0 and emits a WARNING (not an error) for the missing field

### AC-3: skill-authoring Populates All Fields
- Given `skill-authoring` completes Step 5 (registration) in `create` or `gap_seed` mode
- When the skill is written to `registry.json`
- Then `origin_metadata.source`, `approval_tier`, `created_at`, and `created_by_session` are all populated with correct values

### AC-4: gap-triggered Source Set Correctly
- Given `gap_context` is present in session state when `skill-authoring` runs
- When the skill is registered
- Then `origin_metadata.source = "gap-triggered"` and `approval_tier = "expedited"`

### AC-5: Dedup Override Recorded
- Given FEATURE-002 returned `DEDUP_HIT` and user chose Option B
- When the skill is registered
- Then `origin_metadata.dedup_override = true` and `dedup_override_reason` is a non-null non-empty string

### AC-6: Governance §5.1 Present
- Given `docs/governance.md` is updated
- When §5.1 is read
- Then the three approval tier definitions (`standard`, `expedited`, `legacy`) are present with their review requirements
- And the statement "HITL sign-off is mandatory … cannot be bypassed" is present

---

## Definition of Done (DoD)

- [ ] `skills/schema/registry-entry.schema.json` updated with `origin_metadata` object (§1 of plan.md)
- [ ] `skill-authoring/SKILL.md` Step 5 updated to populate `origin_metadata` (§2 of plan.md)
- [ ] `docs/governance.md` §5.1 added with approval tier definitions (§3 of plan.md)
- [ ] `scripts/validate-skills.sh` updated: warning (not error) for missing `origin_metadata` on pre-v5.1.0 skills
- [ ] `scripts/validate-skills.sh` exits 0
- [ ] All 6 acceptance criteria above verified
- [ ] `status.md` `lifecycle_state` set to `completed`

---

## Sub-Tasks

| ID | Description | Skill / File | Est. SP |
|---|---|---|---|
| F003-T1 | Update `skills/schema/registry-entry.schema.json` — `origin_metadata` object | schema | 1.0 |
| F003-T2 | Update `skill-authoring/SKILL.md` — populate `origin_metadata` at Step 5 | skill-authoring | 1.0 |
| F003-T3 | Update `docs/governance.md` — §5.1 approval tiers | governance | 0.5 |
| F003-T4 | Update `scripts/validate-skills.sh` — warning for missing `origin_metadata` | CI | 0.5 |
| **Total** | | | **3 SP** |

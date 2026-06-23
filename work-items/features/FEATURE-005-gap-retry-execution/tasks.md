# FEATURE-005 — Tasks & Acceptance Criteria

## Acceptance Criteria

### AC-1: Retry Prompt Shown
- Given `retry_context` is present and not expired in session state
- When the next user interaction is processed
- Then the orchestrator displays the retry prompt with `raw_prompt`, `registered_skill_id`, and YES/NO/LATER options

### AC-2: YES — Successful Retry
- Given user selects YES and the re-routed `raw_prompt` matches a skill (confidence ≥ 0.5)
- When the retry executes
- Then the skill pipeline runs normally
- And `retry_context` is cleared from session state
- And `retry_in_progress` is cleared from session state

### AC-3: YES — Retry Mismatch (no gap emitted)
- Given user selects YES but the re-routed `raw_prompt` matches no skill (confidence < 0.5)
- When the retry executes
- Then NO `capability_gap` event is emitted (recursion guard: `retry_in_progress == true`)
- And user sees: "The new skill (<registered_skill_id>) did not match. Consider refining its trigger patterns."
- And `retry_context` is cleared from session state

### AC-4: NO — Context Cleared
- Given user selects NO
- When the retry prompt is answered
- Then `retry_context` is cleared from session state
- And the current session request continues normally

### AC-5: LATER — Context Preserved
- Given user selects LATER
- When the retry prompt is answered
- Then `retry_context` is NOT modified (TTL continues from original write time)
- And the current user request is processed normally

### AC-6: retry_context Schema Valid
- Given `skills/schema/system-state-schema.json` is updated with `retry_context`
- When the schema is validated
- Then the `retry_context` object definition passes JSON Schema draft-07 validation

---

## Definition of Done (DoD)

- [ ] **Prerequisite**: FEATURE-001 and FEATURE-004 complete (`retry_context` written by gap-to-skill pipeline)
- [ ] `orchestrator/SKILL.md` updated with retry execution block (§1 of plan.md)
- [ ] `skills/schema/system-state-schema.json` updated with `retry_context` object (§2 of plan.md)
- [ ] Recursion guard: `retry_in_progress` flag suppresses gap emission during retry
- [ ] All 6 acceptance criteria above verified
- [ ] `scripts/validate-skills.sh` exits 0
- [ ] `status.md` `lifecycle_state` set to `completed`

---

## Sub-Tasks

| ID | Description | Skill / File | Est. SP |
|---|---|---|---|
| F005-T1 | Update `orchestrator/SKILL.md` — retry execution block + `retry_in_progress` recursion guard | orchestrator | 1.5 |
| F005-T2 | Update `skills/schema/system-state-schema.json` — `retry_context` object | schema | 0.5 |
| F005-T3 | Integration test — full end-to-end loop (F001 → F004 → F005): success path + mismatch path | testing | 1.0 |
| **Total** | | | **3 SP** |

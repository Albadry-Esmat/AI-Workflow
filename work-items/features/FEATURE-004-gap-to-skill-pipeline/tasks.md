# FEATURE-004 — Tasks & Acceptance Criteria

## Acceptance Criteria

### AC-1: Recursion Guard Blocks Second Instance
- Given `gap_to_skill_active = true` in session state
- When the gap-to-skill pipeline is invoked again
- Then it immediately halts with: "A gap-to-skill pipeline is already active in this session. Complete or cancel it first."

### AC-2: Missing Gap Context Rejected
- Given `gap_context` is null or expired in session state
- When the gap-to-skill pipeline is invoked
- Then it halts with: "No active capability gap found in session state."

### AC-3: Context Restored and Displayed
- Given a valid `gap_context` in session state (gap_id, raw_prompt, detected_domain)
- When the pipeline starts
- Then all three values are displayed to the user in the restore message

### AC-4: Scaffold Seed Pre-Populated
- Given `detected_domain = "testing"` and `raw_prompt = "write integration tests for my REST API"`
- When Step 2 generates the seed
- Then `suggested_name`, `suggested_triggers`, and `description_template` are all derived from the gap context — none are blank

### AC-5: HITL Gate Is Non-Bypassable
- Given quality score ≥ 70 and all steps complete
- When Step 5 HITL gate is reached
- Then registration cannot proceed without an explicit APPROVE — no auto-approval, no timeout, no pipeline config flag can bypass it

### AC-6: Successful Registration Path
- Given user selects APPROVE at the HITL gate
- When registration runs
- Then the skill appears in `registry.json` with `status: draft`, `origin_metadata.source: "gap-triggered"`, `origin_metadata.approval_tier: "expedited"`
- And `validate-skills.sh` exits 0
- And `gap_context` is cleared from session state
- And `retry_context` is written to session state with the registered skill ID

### AC-7: Rejection Preserves Gap Context
- Given user selects REJECT
- When the pipeline ends
- Then `gap_context` remains in session state (not cleared)
- And `gap_to_skill_active` is cleared

### AC-8: gap_seed Mode Works in skill-authoring
- Given `skill-authoring` is invoked with `mode: gap_seed` and a valid seed input
- When the workflow runs
- Then pre-filled values are shown to the user for explicit confirmation or override before scaffold generation proceeds

---

## Definition of Done (DoD)

- [ ] **Prerequisite**: FEATURE-001, FEATURE-002, FEATURE-003 all complete
- [ ] `skill-authoring/SKILL.md` updated — `gap_seed` invocation mode added (F004-T1)
- [ ] `skills/gap-to-skill-pipeline/SKILL.md` (SKL-049) created (F004-T2)
- [ ] `skills/pipelines/gap-to-skill.json` created (F004-T3)
- [ ] `skills/registry.json` updated — SKL-049 registered with `status: draft` (F004-T4)
- [ ] Recursion guard implemented (`gap_to_skill_active` session state key) (F004-T5)
- [ ] `scripts/validate-skills.sh` exits 0 (F004-T6)
- [ ] All 8 acceptance criteria above verified (F004-T7)
- [ ] `status.md` `lifecycle_state` set to `completed`

---

## Sub-Tasks

| ID | Description | Skill / File | Est. SP |
|---|---|---|---|
| F004-T1 | Update `skill-authoring/SKILL.md` — add `gap_seed` invocation mode | skill-authoring | 2.0 |
| F004-T2 | Create `skills/gap-to-skill-pipeline/SKILL.md` (SKL-049) | new skill | 2.0 |
| F004-T3 | Create `skills/pipelines/gap-to-skill.json` | pipeline template | 1.0 |
| F004-T4 | Update `skills/registry.json` — register SKL-049 | registry | 0.5 |
| F004-T5 | Implement recursion guard (`gap_to_skill_active` flag logic) | orchestrator/pipeline | 1.0 |
| F004-T6 | Run `validate-skills.sh` and fix any issues | CI | 0.5 |
| F004-T7 | Integration tests: APPROVE path + REJECT path + recursion guard | testing | 1.0 |
| **Total** | | | **8 SP** |

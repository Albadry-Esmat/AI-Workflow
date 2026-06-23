# FEATURE-001 — Tasks & Acceptance Criteria

## Acceptance Criteria

### AC-1: Gap Detection Trigger
- Given a user prompt that matches no skill trigger with confidence ≥ 0.5
- When the orchestrator processes the request
- Then the failure is classified as `capability_gap` (not the generic "Which stage of the pipeline do you need?" fallback)
- And the user receives the structured gap message with domain label

### AC-2: Telemetry Event Emitted
- Given a `capability_gap` classification
- When the gap event is emitted
- Then a valid event is appended to `telemetry/events.jsonl`
- And the event contains: `event_type`, `timestamp`, `session_id`, `raw_prompt` (≤ 200 chars), `detected_domain`, `confidence_score`

### AC-3: Session State Written
- Given a gap event is emitted
- When state is written
- Then `gap_context` is present in session state with a valid UUID `gap_id`, original prompt, domain, and timestamp
- And the TTL is set to 3600 seconds

### AC-4: Session Summary Includes Gap Metrics
- Given one or more `capability_gap` events in the session
- When session-insights (SKL-048) produces the session summary
- Then the summary includes: total gap count, top 3 domains, and list of `gap_id` values

### AC-5: Recursion Guard Active
- Given the orchestrator is executing within a `gap-to-skill` pipeline instance (`gap_to_skill_active = true`)
- When another unroutable request is encountered
- Then NO new `capability_gap` event is emitted
- And the orchestrator surfaces: "Cannot log a gap from within the gap-to-skill pipeline"

### AC-6: Validate-Skills Passes
- Given SKL-047 and SKL-048 are registered in `skills/registry.json`
- When `scripts/validate-skills.sh` is run
- Then it exits with code 0

---

## Definition of Done (DoD)

- [ ] `orchestrator/SKILL.md` updated with gap detection block (§1 of plan.md)
- [ ] `skills/schema/system-state-schema.json` updated with `gap_context` object (§2 of plan.md)
- [ ] `behavioral-telemetry-collector/SKILL.md` (SKL-047) created (§3 of plan.md)
- [ ] `session-insights/SKILL.md` (SKL-048) created (§4 of plan.md)
- [ ] SKL-047 and SKL-048 added to `skills/registry.json` with `status: draft`
- [ ] `scripts/validate-skills.sh` exits 0
- [ ] All 6 acceptance criteria above verified
- [ ] `docs/changelog.md` Phase 6 block updated
- [ ] `status.md` `lifecycle_state` set to `completed`

---

## Sub-Tasks

| ID | Description | Skill / File | Est. SP |
|---|---|---|---|
| F001-T1 | Update `orchestrator/SKILL.md` — gap detection block + recursion guard | orchestrator | 1.0 |
| F001-T2 | Update `skills/schema/system-state-schema.json` — `gap_context` object | schema | 0.5 |
| F001-T3 | Create `behavioral-telemetry-collector/SKILL.md` (SKL-047) | new skill | 1.5 |
| F001-T4 | Create `session-insights/SKILL.md` (SKL-048) | new skill | 1.0 |
| F001-T5 | Update `skills/registry.json` — register SKL-047, SKL-048 | registry | 0.5 |
| F001-T6 | Run `validate-skills.sh` and fix any issues | CI | 0.5 |
| **Total** | | | **5 SP** |

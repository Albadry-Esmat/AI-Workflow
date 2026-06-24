# FEATURE-011 — Tasks & Acceptance Criteria

## Acceptance Criteria

### AC-1: API Registry Maintained via state-manager
- Given operation `register` is called with a valid `api_spec`
- When `api-deprecation-manager` executes
- Then a new entry is written to `api_deprecation_registry` in state-manager
- And the entry has `status: current`, `registered_at: <ISO-8601>`, and correct `api_id` and `version`
- And a duplicate registration (same `api_id` + `version`) returns error `DUPLICATE_REGISTRATION`

### AC-2: Deprecation Creates Consumer Work Items
- Given operation `deprecate` is called with a valid `api_id`, `sunset_date`, and `consumer_list`
- When `api-deprecation-manager` executes
- Then the registry entry status changes to `deprecated` and `deprecated_at` is set
- And one work item stub is created per consumer in `consumer_list`
- And work item priority is `high` if sunset < 30 days, `medium` if < 90 days, `low` otherwise

### AC-3: Migration Guide Generated from Breaking Changes
- Given operation `migration-guide` is called with a valid `api_id` and `breaking_changes` array from `change-impact-analyzer`
- When `api-deprecation-manager` executes
- Then `migration_guide` is returned containing `breaking_changes_summary`, `before_after_examples` (one per breaking change), `migration_steps` (ordered), and `estimated_effort` (hours)

### AC-4: Sunset Violations Detected
- Given operation `query` is executed
- And one or more registry entries have `sunset_date < today` AND `status != "sunset"`
- When `api-deprecation-manager` executes
- Then `sunset_violations` contains those entries
- And feedback type `sunset_violation_detected` is emitted to the orchestrator

### AC-5: Breaking Change Without Deprecation Flagged
- Given a breaking change is detected for an `api_id` that has no `deprecated` or `sunset` record in the registry
- When `api-deprecation-manager` processes the event
- Then feedback type `breaking_change_without_deprecation` is emitted to `change-impact-analyzer`
- And the orchestrator is notified to initiate a deprecation operation

### AC-6: Deprecation Timeline View Produced
- Given the registry contains multiple deprecated APIs with different sunset dates
- When operation `query` is executed
- Then `deprecation_timeline` groups entries into buckets: `this_month`, `next_quarter`, `future`
- And the output is ordered by sunset_date ascending within each bucket

---

## Definition of Done (DoD)

- [ ] `api-deprecation-manager/SKILL.md` (SKL-071) created with full 13-section spec
- [ ] Skill header `description` field follows exact auto-trigger format
- [ ] All 5 operations documented in execution logic: `register`, `deprecate`, `sunset`, `query`, `migration-guide`
- [ ] All 6 acceptance criteria above verified against SKILL.md spec
- [ ] Input schema validated: `operation` required; `api_spec`, `breaking_changes`, `api_id`, `sunset_date`, `consumer_list` correctly marked optional with per-operation requirements
- [ ] Output schema validated: all output fields present
- [ ] State-manager integration documented: read and write patterns for `api_deprecation_registry`
- [ ] Feedback routes documented: `breaking_change_without_deprecation` → `change-impact-analyzer`, `sunset_violation_detected` → orchestrator
- [ ] Skill registered in `skills/registry.json` with `status: draft`, `domain: architecture`, `phase: 7`
- [ ] Index entry added to `skills/index.yaml`
- [ ] `scripts/validate-skills.sh` exits 0

---

## Sub-Tasks

| ID | Description | Skill / File | Est. SP |
|---|---|---|---|
| F011-T1 | Author `api-deprecation-manager/SKILL.md` — sections 1–6 (header, purpose, inputs, context, execution, outputs) | new skill | 2.0 |
| F011-T2 | Author `api-deprecation-manager/SKILL.md` — sections 7–13 (rules, security, tokens, quality, failures, HITL, composition) | new skill | 1.5 |
| F011-T3 | Define API registry state schema and all 5 operation execution paths | new skill | 2.0 |
| F011-T4 | Register SKL-071 in `skills/registry.json` and `skills/index.yaml` | registry | 0.5 |
| F011-T5 | Run `validate-skills.sh` and verify exit 0 | CI | 0.5 |
| F011-T6 | Integration test: change-impact-analyzer breaking change → api-deprecation-manager migration-guide → documentation-generator | testing | 1.5 |
| **Total** | | | **8 SP** |

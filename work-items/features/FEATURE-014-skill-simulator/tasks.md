# FEATURE-014 — Tasks & Acceptance Criteria

## Acceptance Criteria

### AC-1: Pipeline Graph Construction
- Given a valid `pipeline_config` path pointing to a JSON file with 6 skill references
- When skill-simulator is invoked
- Then it builds a correctly ordered execution graph resolving all 6 skill references from the registry
- And any unknown skill name in the config causes rejection with `{"error": "UNKNOWN_SKILL", "name": "..."}`

### AC-2: Simulation Produces No File Writes
- Given `simulation_depth == "full"` and a pipeline that would normally create 5 files
- When the simulation completes
- Then zero files are written to disk
- And `simulation_report.files_preview.would_create` lists all 5 file paths

### AC-3: Guard Verdict Prediction
- Given a pipeline config containing security-guard and an `initial_payload` with a plaintext credential field
- When the simulation evaluates the guard step
- Then `simulation_report.block_risks` contains an entry for security-guard with `severity: "critical"`
- And `go_no_go_summary` begins with `"1 block risk(s) detected"`

### AC-4: HITL Gate Prediction
- Given a pipeline with two HITL gates defined in `pipeline_config.gates`
- When `simulation_depth == "full"` and the simulation runs
- Then `simulation_report.hitl_gates_predicted` contains exactly 2 entries
- And each entry includes `gate_id`, `skill_before`, `trigger_condition`, and a `likelihood` value

### AC-5: Token and Duration Estimate
- Given a pipeline config with 4 skills each having `token_weight` values of 2000, 3000, 1500, 2500 in the registry
- When the simulation completes
- Then `simulation_report.estimated_token_usage` equals 9000
- And `simulation_report.estimated_duration_minutes` is a positive number

### AC-6: Outline Depth Is Schema-Only (No LLM)
- Given `simulation_depth == "outline"`
- When the simulation runs against a 10-skill pipeline
- Then `skill_outputs_preview` contains field name lists only — no placeholder values or LLM-generated content
- And the skill does not invoke any LLM call during outline mode

---

## Definition of Done (DoD)

- [ ] `.opencode/skills/skill-simulator/SKILL.md` (SKL-074) created — all 13 sections complete
- [ ] `skills/registry.json` updated — SKL-074 registered with `status: draft`
- [ ] `skills/index.yaml` updated — index entry for skill-simulator added
- [ ] Zero file writes occur during simulation execution (verified)
- [ ] Cycle detection halts simulation and returns `CYCLE_DETECTED` error with cycle path
- [ ] All 6 acceptance criteria above verified
- [ ] `scripts/validate-skills.sh` exits 0
- [ ] `status.md` `Status` set to `implemented` upon completion

---

## Sub-Tasks

| ID | Description | Skill / File | Est. SP |
|---|---|---|---|
| F014-T1 | Author `skill-simulator/SKILL.md` — all 13 sections | new skill | 3.0 |
| F014-T2 | Implement execution graph builder (topological sort + cycle detection) | skill-simulator | 1.5 |
| F014-T3 | Implement per-skill schema-preview generator (outline + preview + full modes) | skill-simulator | 1.5 |
| F014-T4 | Implement guard verdict predictor + HITL gate predictor | skill-simulator | 1.0 |
| F014-T5 | Register SKL-074 in `skills/registry.json` and `skills/index.yaml` | registry | 0.5 |
| F014-T6 | Run `validate-skills.sh` and resolve any issues | CI | 0.5 |
| **Total** | | | **8 SP** |

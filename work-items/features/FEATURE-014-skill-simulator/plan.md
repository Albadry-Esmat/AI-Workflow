# FEATURE-014 — Implementation Plan: Skill Simulator

## Target Skills / Artifacts

| Skill / Artifact | Action | Notes |
|---|---|---|
| `.opencode/skills/skill-simulator/SKILL.md` (SKL-074) | Create | New skill — full 13-section spec |
| `skills/registry.json` | Update | Register SKL-074 with `status: draft` |
| `skills/index.yaml` | Update | Add index entry for skill-simulator |

---

## §1 — Skill: skill-simulator

**Purpose:** Runs a complete pipeline in simulation mode — every skill executes its schema-preview logic, all outputs are generated in-memory, and no disk writes occur. Produces a unified preview report for human review before the real run is committed.

### Input Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "pipeline_config": {
      "type": "string",
      "description": "Path to pipeline JSON file to simulate"
    },
    "initial_payload": {
      "type": "object",
      "description": "Initial payload identical to what would be passed in a real run"
    },
    "simulation_depth": {
      "type": "string",
      "enum": ["outline", "preview", "full"],
      "default": "full",
      "description": "outline=skill sequence only; preview=full outputs no writes; full=full outputs + gate decisions"
    },
    "highlight_risks": {
      "type": "boolean",
      "default": true,
      "description": "Flag skills likely to trigger HITL gates or block verdicts"
    },
    "session_context": {
      "type": "object",
      "description": "Existing session state to simulate against"
    }
  },
  "required": ["pipeline_config", "initial_payload"]
}
```

### Output Schema (summary)

```json
{
  "simulation_report": {
    "pipeline_steps":             "array — ordered skills with parallel_group and preview_status",
    "files_preview":              "{ would_create[], would_modify[], would_delete[] }",
    "hitl_gates_predicted":       "array — gate_id, skill_before, trigger_condition, likelihood",
    "block_risks":                "array — skill_name, reason, indicator, severity",
    "estimated_token_usage":      "integer",
    "estimated_duration_minutes": "number"
  },
  "skill_outputs_preview": "array — per-skill field list + placeholder values",
  "go_no_go_summary":      "string — advisory recommendation",
  "metrics":               "object",
  "feedback":              "array"
}
```

### Execution Steps

**Step 1 — Load and validate pipeline config**
Parse `pipeline_config` file from disk (read-only). Resolve all skill name references against the skill registry. Reject any skill name that has no registry entry with a clear `UNKNOWN_SKILL` error.

**Step 2 — Build execution graph**
Topological sort skill dependencies based on input_map/output_map declarations in the pipeline config. Identify parallel execution groups. Run cycle detection via DFS — if a cycle is found, halt and return a `CYCLE_DETECTED` error with the cycle path.

**Step 3 — Simulate each skill in order**
- For `simulation_depth == "outline"`: record skill name, predicted input field names, predicted output field names only. No LLM calls. Must complete in < 500ms total.
- For `simulation_depth == "preview"` or `"full"`: instantiate each skill's output schema with typed placeholder values (string → `""`, number → `0`, array → `[]`, object → `{}`). Annotate fields with descriptions from the skill's SKILL.md output table.

**Step 4 — Propagate preview outputs**
Feed each skill's preview output as the next skill's preview input. Flag any required input field that would be absent based on the producing skill's output schema. Collect propagation warnings.

**Step 5 — Predict guard verdicts** (`highlight_risks == true` only)
For each guard skill (security-guard, database-guard, performance-guard, implementation-completeness-guard): scan `initial_payload` and propagated preview inputs for known block-pattern indicators. Add a `block_risks` entry with reason and indicator evidence for each match found.

**Step 6 — Predict HITL gates** (`simulation_depth == "full"` only)
For each gate in `pipeline_config.gates`: evaluate the trigger condition against propagated preview inputs. Classify trigger likelihood as `"likely"`, `"possible"`, or `"unlikely"`. Record gate_id, skill_before, trigger_condition, and predicted_reason.

**Step 7 — Aggregate file previews**
Collect all file-write declarations from each skill's dry_run output schema across the execution graph. Classify each path as `would_create`, `would_modify`, or `would_delete`.

**Step 8 — Estimate token usage**
For each skill: retrieve `token_weight` from registry (default 1000 if absent). For parallel groups: use the maximum weight of the group (parallel skills share the ceiling). Sum all weights for `estimated_token_usage`. Divide by `TOKEN_THROUGHPUT_CONSTANT` (50,000 tokens/min) for `estimated_duration_minutes`.

**Step 9 — Produce go/no-go summary**
- `block_risks > 0` → `"X block risk(s) detected. Y HITL gate(s) predicted. Recommend: review first."`
- `block_risks == 0, hitl_gates > 0` → `"No block risks. Y HITL gate(s) predicted. Recommend: proceed with gates in mind."`
- Both 0 → `"No risks detected. No HITL gates predicted. Recommend: proceed."`

---

## §2 — Feedback Routes

| Route | Type | Target |
|---|---|---|
| `simulation_reveals_high_risk_pipeline` | `backpropagate` | `orchestrator` |

Emitted when `block_risks.length > 0` — signals orchestrator to surface the simulation report to HITL before authorising the real execution.

---

## §3 — Guard Predictor Patterns

| Guard Skill | Block Indicator |
|---|---|
| `security-guard` | Plaintext credentials, SQL without parameterisation |
| `database-guard` | DROP TABLE, column type change without migration guard, missing reversibility |
| `performance-guard` | N+1 query patterns, missing index declarations on FK columns |
| `implementation-completeness-guard` | Coverage score field absent or below threshold |

---

## §4 — Registry Entry

```json
{
  "id": "SKL-074",
  "name": "skill-simulator",
  "version": "1.0.0",
  "domain": "system",
  "status": "draft",
  "phase": 7,
  "req_id": "N18"
}
```

---

## §5 — Validation

`scripts/validate-skills.sh` must pass (exit 0) after SKL-074 is registered.

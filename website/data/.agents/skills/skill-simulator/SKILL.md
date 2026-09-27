---
name: skill-simulator
version: 1.0.0
domain: system
description: 'Use when previewing the full pipeline before committing any file writes, running dry-run simulations of pipeline configurations, or estimating token usage and HITL gate predictions before execution. Triggers on: "simulate the pipeline", "preview what would happen", "dry run the pipeline". Do NOT use when the pipeline is already executing or when a real run has been explicitly requested.'
author: system
---

## Purpose

skill-simulator runs a complete pipeline in simulation mode — every skill executes its schema-preview logic, all outputs are generated in-memory, and no disk writes occur. It produces a unified preview report showing what files would be created, modified, or deleted; which HITL gates would be triggered; which guard skills are likely to produce block verdicts; and an estimated token cost and duration. Teams invoke it before a first real run to validate a pipeline configuration, confirm HITL gate placement, and understand the risk profile before committing any system changes.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `pipeline_config` | `string` | Yes | Path to pipeline JSON file to simulate |
| `initial_payload` | `object` | Yes | The same initial payload that would be passed to a real run |
| `simulation_depth` | `string` | No | `"outline"` (skill sequence only) \| `"preview"` (full outputs, no writes) \| `"full"` (full outputs + gate decisions). Default: `"full"` |
| `highlight_risks` | `boolean` | No | Flag skills likely to trigger HITL gates or produce block verdicts. Default: `true` |
| `session_context` | `object` | No | Existing session state to simulate against |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "pipeline_config": {
      "type": "string",
      "description": "Workspace-relative or absolute path to the pipeline JSON configuration file"
    },
    "initial_payload": {
      "type": "object",
      "description": "The initial payload identical to what would be passed in a real pipeline run"
    },
    "simulation_depth": {
      "type": "string",
      "enum": ["outline", "preview", "full"],
      "default": "full"
    },
    "highlight_risks": {
      "type": "boolean",
      "default": true
    },
    "session_context": {
      "type": "object"
    }
  },
  "required": ["pipeline_config", "initial_payload"]
}
```

## Required Context

- Pipeline configuration file must exist at the specified path and be valid JSON conforming to the orchestrator pipeline config schema.
- Skill registry must be accessible via state-manager (`registry` scope) — all skill names referenced in the config must resolve to registered entries.
- No real pipeline run may be in progress for the same session when simulation is invoked.
- `session_context` must be provided if the simulated pipeline depends on pre-existing session state fields.

## Execution Logic

```
Step 1 — Load and validate pipeline config
  Read pipeline_config from disk (read-only access only).
  Parse as JSON; validate against orchestrator pipeline_config schema.
  Resolve each skill name in config.skills[] against the skill registry.
  If any skill name has no registry entry: reject with UNKNOWN_SKILL error.
  Output: resolved_skill_graph { skills[], parallel_groups[], gates[] }

Step 2 — Build execution graph
  Topological sort of skill dependencies using declared input_map/output_map fields.
  Identify parallel execution groups from config.parallel_groups[].
  Run DFS cycle detection on the resulting dependency graph.
  If cycle detected: halt simulation; return CYCLE_DETECTED error with cycle path array.
  Output: ordered_execution_plan { steps[{ skill_name, parallel_group, inputs_from[] }] }

Step 3 — Simulate each skill in topological order
  For simulation_depth == "outline":
    For each skill: record skill_name, list input field names, list output field names.
    Source field names from each skill's SKILL.md Input/Output tables.
    No LLM calls. No schema expansion. Target < 500ms total runtime.
    Output: skill_previews[{ skill_name, input_fields[], output_fields[] }]
  For simulation_depth == "preview" or "full":
    For each skill: instantiate output schema with typed placeholder values:
      string → "", number → 0, boolean → false, array → [], object → {}
    Annotate each field with its description string from the skill's SKILL.md output table.
    Output: skill_previews[{ skill_name, preview_inputs{}, preview_outputs{} }]

Step 4 — Propagate preview outputs
  For each skill in order: map its preview_outputs to the next skill's expected preview_inputs.
  For each required input field in the consuming skill: check whether the producing skill's
    output schema includes a field that satisfies it.
  Record any required field that would be absent as a propagation_warning.
  Output: propagation_warnings[{ consuming_skill, missing_field, producing_skill }]

Step 5 — Predict guard verdicts  [runs only when highlight_risks == true]
  For each guard skill in the execution plan (security-guard, database-guard,
    performance-guard, implementation-completeness-guard):
    Scan initial_payload and all propagated preview_inputs for block-pattern indicators:
      security-guard:                  plaintext credential fields, unparameterised SQL strings
      database-guard:                  DROP TABLE tokens, column type changes, missing reversibility flag
      performance-guard:               N+1 query patterns, FK columns without declared index
      implementation-completeness-guard: coverage_score field absent or value below threshold
    For each matched indicator: append entry to block_risks with skill_name, reason, indicator, severity.
  Output: block_risks[{ skill_name, reason, indicator, severity }]

Step 6 — Predict HITL gates  [runs only when simulation_depth == "full"]
  For each gate defined in resolved_skill_graph.gates[]:
    Evaluate the gate's trigger_condition expression against propagated preview_inputs.
    Classify likelihood:
      "likely"   — trigger condition field is present and non-empty in preview
      "possible" — trigger condition field is present but value is placeholder
      "unlikely" — trigger condition field is absent from preview inputs
    Record gate_id, skill_before, trigger_condition, likelihood, predicted_reason.
  Output: hitl_gates_predicted[{ gate_id, skill_before, trigger_condition, likelihood, predicted_reason }]

Step 7 — Aggregate file previews
  Collect all file path declarations from each skill's dry_run output schema fields
    (fields named: path, file_path, output_path, artifact_path).
  For each path: classify as would_create (not in session_context), would_modify (exists in
    session_context), or would_delete (flagged with delete=true in producing skill schema).
  Output: files_preview { would_create[], would_modify[], would_delete[] }

Step 8 — Estimate token usage
  For each skill in ordered_execution_plan: retrieve token_weight from registry entry.
    Default to 1000 if token_weight is absent from the registry entry.
  For parallel groups: use max(token_weight) across the group (parallel skills share ceiling).
  estimated_token_usage = sum of all resolved weights across the plan.
  TOKEN_THROUGHPUT_CONSTANT = 50000 (tokens per minute).
  estimated_duration_minutes = estimated_token_usage / TOKEN_THROUGHPUT_CONSTANT.
  Output: token_estimate { estimated_token_usage, estimated_duration_minutes }

Step 9 — Produce go/no-go summary
  b = block_risks.length
  g = hitl_gates_predicted.length
  if b > 0:
    go_no_go_summary = "{b} block risk(s) detected. {g} HITL gate(s) predicted. Recommend: review first."
  else if g > 0:
    go_no_go_summary = "No block risks. {g} HITL gate(s) predicted. Recommend: proceed with gates in mind."
  else:
    go_no_go_summary = "No risks detected. No HITL gates predicted. Recommend: proceed."
  Output: go_no_go_summary string

Step 10 — Assemble and return output
  Combine all step outputs into the final simulation_report object.
  Emit simulation_reveals_high_risk_pipeline feedback if block_risks.length > 0.
  Return simulation_report, skill_outputs_preview, go_no_go_summary, metrics, feedback.
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `simulation_report` | `object` | Top-level preview: pipeline_steps, files_preview, hitl_gates_predicted, block_risks, estimated_token_usage, estimated_duration_minutes |
| `skill_outputs_preview` | `array[object]` | Per-skill preview: skill_name, output field list, placeholder values (capped at 5 fields per skill) |
| `go_no_go_summary` | `string` | Advisory recommendation string citing risk and gate counts |
| `metrics` | `object` | **REQUIRED.** Execution metrics |
| `feedback` | `array[object]` | **REQUIRED.** Feedback loop entries |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "simulation_report": {
      "type": "object",
      "properties": {
        "pipeline_steps": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "skill_name":     { "type": "string" },
              "parallel_group": { "type": "integer" },
              "inputs_from":    { "type": "array", "items": { "type": "string" } },
              "preview_status": { "type": "string", "enum": ["simulated", "outline-only", "skipped"] }
            },
            "required": ["skill_name", "preview_status"]
          }
        },
        "files_preview": {
          "type": "object",
          "properties": {
            "would_create": { "type": "array", "items": { "type": "string" } },
            "would_modify": { "type": "array", "items": { "type": "string" } },
            "would_delete": { "type": "array", "items": { "type": "string" } }
          },
          "required": ["would_create", "would_modify", "would_delete"]
        },
        "hitl_gates_predicted": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "gate_id":           { "type": "string" },
              "skill_before":      { "type": "string" },
              "trigger_condition": { "type": "string" },
              "likelihood":        { "type": "string", "enum": ["likely", "possible", "unlikely"] },
              "predicted_reason":  { "type": "string" }
            },
            "required": ["gate_id", "likelihood"]
          }
        },
        "block_risks": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "skill_name": { "type": "string" },
              "reason":     { "type": "string" },
              "indicator":  { "type": "string" },
              "severity":   { "type": "string", "enum": ["low", "medium", "high", "critical"] }
            },
            "required": ["skill_name", "reason", "severity"]
          }
        },
        "estimated_token_usage":      { "type": "integer", "minimum": 0 },
        "estimated_duration_minutes": { "type": "number", "minimum": 0 }
      },
      "required": ["pipeline_steps", "files_preview", "hitl_gates_predicted", "block_risks", "estimated_token_usage", "estimated_duration_minutes"]
    },
    "skill_outputs_preview": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "skill_name":     { "type": "string" },
          "output_fields":  { "type": "array", "items": { "type": "string" } },
          "preview_values": { "type": "object" }
        },
        "required": ["skill_name", "output_fields"]
      }
    },
    "go_no_go_summary": { "type": "string" },
    "metrics":  { "$ref": "#/$defs/metrics" },
    "feedback": { "type": "array", "items": { "$ref": "#/$defs/feedback_entry" } }
  },
  "required": ["simulation_report", "skill_outputs_preview", "go_no_go_summary", "metrics", "feedback"],
  "$defs": {
    "metrics": {
      "type": "object",
      "properties": {
        "tokens_in":      { "type": "integer" },
        "tokens_out":     { "type": "integer" },
        "duration_ms":    { "type": "integer" },
        "items_produced": { "type": "integer" },
        "version":        { "type": "string" }
      },
      "required": ["tokens_in", "tokens_out", "duration_ms", "items_produced", "version"]
    },
    "feedback_entry": {
      "type": "object",
      "properties": {
        "type":         { "type": "string", "enum": ["backpropagate", "info", "warning"] },
        "from_skill":   { "type": "string" },
        "target_skill": { "type": "string" },
        "reason":       { "type": "string" },
        "evidence":     { "type": "object" }
      },
      "required": ["type", "from_skill", "reason"]
    }
  }
}
```

## Rules & Constraints

- Simulation MUST NOT write any file to disk. State-manager write operations are forbidden during Steps 1–9; read operations for registry lookups and session_context loading are permitted.
- `dry_run` is implicitly `true` for every composed skill call made during simulation — the simulator must never pass `dry_run: false` to any invoked skill.
- `simulation_depth == "outline"` MUST NOT make any LLM calls — it is a pure schema introspection operation and must complete in < 500ms.
- Cycle detection failure halts the simulation immediately. Partial results up to the detected cycle are returned alongside the `CYCLE_DETECTED` error in `feedback`.
- `estimated_token_usage` MUST be a positive integer. If any skill has no `token_weight` in the registry, the default value of 1000 is applied.
- Maximum pipeline size: 30 skills per simulation run. Larger pipelines must be simulated as named sub-graph segments.
- The simulator MUST NOT emit `code.changed`, `pipeline.started`, or `pipeline.ended` system events during simulation.
- `skill_outputs_preview` items are capped at 5 fields per skill. Remaining fields are summarised as `"...N more fields"`.

## Security Considerations

- `pipeline_config` path must be validated against a workspace root allowlist — reject paths containing `..` or paths outside the workspace directory (prevent directory traversal).
- `initial_payload` may contain sensitive field names. Field names are logged; field values must NOT be logged, persisted, or included in `skill_outputs_preview` placeholder values.
- The skill must not invoke any external network endpoints, external tools, or shell commands during simulation.
- Guard verdict prediction is pattern-based only — no security scanning tools are executed during simulation.
- If `initial_payload` contains fields matching credential patterns (password, secret, token, api_key, private_key), strip values before any logging and emit a `warning` feedback entry.

## Token Optimization

- `simulation_depth == "outline"`: zero LLM calls; return field names from SKILL.md tables only. All 30 skills processable in a single pass.
- `simulation_depth == "preview"`: one lightweight schema-expansion pass per skill using the output schema JSON directly — no full LLM generation round-trips.
- `simulation_depth == "full"`: full gate/risk analysis but strip all `content` fields from preview values. Return field names + type annotations only (no generated text content).
- Propagate only field name lists (not values) between skills to keep context window stable across the execution plan.
- Cap `skill_outputs_preview` at 5 fields per skill in the response body; write the full preview to state-manager under `simulation_cache` key for retrieval if needed.

## Quality Checklist

- [ ] Input validated against schema before simulation starts
- [ ] All skill references resolved against registry before graph build
- [ ] Cycle detection runs before Step 3 (no simulation with undetected cycles)
- [ ] No file writes occur during simulation
- [ ] `go_no_go_summary` is present and non-empty in every response
- [ ] `estimated_token_usage` is a positive integer in every response
- [ ] `simulation_depth == "outline"` makes zero LLM calls
- [ ] `metrics` and `feedback` fields present in every response

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| `pipeline_config` file not found | `{"error": "PIPELINE_CONFIG_NOT_FOUND", "path": "<value>"}` |
| Invalid pipeline config JSON | `{"error": "INVALID_PIPELINE_CONFIG", "parse_error": "<detail>"}` |
| Unknown skill name in config | `{"error": "UNKNOWN_SKILL", "name": "<value>"}` — halt before graph build |
| Cycle detected in execution graph | Halt; return partial graph + `{"error": "CYCLE_DETECTED", "path": [...]}` |
| Pipeline > 30 skills | `{"error": "PIPELINE_TOO_LARGE", "max": 30, "actual": N}` |
| Registry unavailable | `{"error": "REGISTRY_UNAVAILABLE"}` — recommend state-manager health check |
| Simulation depth unknown value | `{"error": "INVALID_SIMULATION_DEPTH", "allowed": ["outline","preview","full"]}` |

## 12. Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Behavior |
|------|---------|---------|----------|
| High-risk simulation advisory | `block_risks.length > 0 AND highlight_risks == true` | None | Surface `simulation_report` to user; user decides whether to proceed with real run — advisory only, pipeline is not halted by the simulator itself |

> The simulator is advisory — it does not halt the pipeline on its own findings. The HITL interaction is with the simulation output report. If `simulation_reveals_high_risk_pipeline` feedback is received by the orchestrator, the orchestrator is responsible for presenting the report and awaiting human confirmation before executing the real run.

## 13. Skill Composition

```yaml
composes:
  - skill: state-manager
    version: "^1.1.0"
    input_map:
      operation: "read"
      scope: "registry"
    output_map:
      value: "resolved_skill_registry"
  - skill: orchestrator
    version: "^1.3.0"
    input_map:
      pipeline_config: "pipeline_config"
      initial_payload: "initial_payload"
      dry_run: "true"
    output_map:
      execution_plan: "simulation_report.pipeline_steps"
```

---
name: implementation-completeness-auditor
version: 1.1.0
domain: quality
description: 'Use when auditing whether all requirements have been fully implemented. Triggers on: "check implementation completeness", "are all requirements done", "release readiness check", "gap analysis", "traceability matrix", "what''s missing", "readiness score".'
author: system
---

## Purpose

Cross-check the delivered implementation against every validated requirement and produce a release readiness score (0–100). The skill generates a traceability matrix linking each requirement to its code artifacts, test cases, UI screens, database entities, and documentation coverage. It detects missing, stub, partial, untested, and undocumented requirements and classifies each gap by severity. The numeric readiness score is consumed by the implementation-completeness-guard (SKL-037) to enforce release gates.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `requirements` | `array[object]` | Yes | All validated requirements (id, type, statement, priority) |
| `code_map` | `object` | Yes | System state code map (from state-manager SKL-021) |
| `test_state` | `object` | Yes | Current test state (from state-manager SKL-021) |
| `feature_plan` | `object` | No | Feature plan from feature-planning (SKL-003) for task-to-req mapping |
| `screen_inventory` | `array[object]` | No | Screen inventory from frontend-ux-architect (SKL-031) |
| `db_entities` | `array[object]` | No | Entity list from database-architect (SKL-032) |
| `release_threshold` | `integer` | No | Minimum readiness score required for release gate (default: 85) |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["requirements", "code_map", "test_state"],
  "properties": {
    "requirements": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": ["id", "type", "statement"],
        "properties": {
          "id":        { "type": "string" },
          "type":      { "type": "string", "enum": ["F", "NF", "C"] },
          "statement": { "type": "string" },
          "priority":  { "type": "string", "enum": ["critical", "high", "medium", "low"], "default": "medium" }
        }
      }
    },
    "code_map":        { "type": "object" },
    "test_state":      { "type": "object" },
    "feature_plan":    { "type": "object" },
    "screen_inventory":{ "type": "array" },
    "db_entities":     { "type": "array" },
    "release_threshold": { "type": "integer", "minimum": 0, "maximum": 100, "default": 85 }
  }
}
```

## Required Context

- Validated requirements from `requirement-analyzer` (SKL-001).
- Current `code_map` from system state (SKL-021).
- Current `test_state` from system state (SKL-021).
- Optionally: `feature_plan` (SKL-003), `screen_inventory` (SKL-031), `db_entities` (SKL-032).

## Execution Logic

```
Step 1 — Build requirement index
  Index all requirements by ID. Classify each as: functional, non-functional, constraint.
  Mark UI-bearing requirements (those referencing screens, forms, views).
  Mark data-bearing requirements (those referencing persistence, queries, reports).
  Output: classified requirement index

Step 2 — Map code artifacts to requirements
  Use a three-tier priority mapping strategy:
  TIER 1 (authoritative): feature_plan.req_task_map — if feature_plan is provided and contains req_task_map,
    use it as the primary REQ→TASK→code_artifact chain. For each req_id in req_task_map, find the
    code artifacts in code_map that correspond to the mapped task IDs (by module + task ID naming).
    Record source: "task_map" for all matches found via this tier.
  TIER 2 (annotation-based): scan code_map for @req annotations (format: @req TASK-XXXX REQ-NNN).
    Add any req_id→artifact mapping not already captured by Tier 1.
    Record source: "annotation" for all matches found via this tier.
  TIER 3 (heuristic, fallback only): naming conventions — file/function name proximity to requirement keywords.
    Only applies to requirements still unmatched after Tiers 1 and 2.
    Record source: "naming" for all matches found via this tier.
  For requirements still unmatched after all three tiers: classify as `missing` or `unmapped`.
  Output: requirement → code artifact mapping (with source field: "task_map" | "annotation" | "naming" | "unmapped")

Step 3 — Map test cases to requirements
  Scan test_state for test files and test case descriptions.
  Match test cases to requirements via naming, tags, or describe-block text.
  Classify coverage: covered, partial, or untested.
  Detect disabled tests (it.skip, xit, xtest) — count as untested.
  Output: requirement → test case mapping

Step 4 — Map UI screens to requirements (if screen_inventory provided)
  For each UI-bearing requirement, check if a corresponding screen/component exists in screen_inventory.
  Detect placeholder components via stub detection patterns.
  Output: requirement → screen mapping

Step 5 — Map DB entities to requirements (if db_entities provided)
  For each data-bearing requirement, check if a corresponding entity/migration exists.
  Output: requirement → entity mapping

Step 6 — Detect implementation stubs
  Scan code artifacts mapped in Step 2.
  Apply stub detection patterns: TODO/FIXME comments, NotImplementedError, empty function bodies,
  hardcoded mock returns, HTTP 501 responses.
  Reclassify matched requirements from `mapped` to `stub`.
  Output: stub detection report

Step 7 — Classify gaps per requirement
  For each requirement, determine gap classification:
    missing → no code artifact, test, UI, or DB entry found
    stub    → code artifact exists but contains stub patterns
    partial → code artifact exists but not all acceptance criteria are covered
    untested → code artifact exists but no test case maps to this requirement
    undocumented → all other dimensions covered but no doc reference found
  Output: gap classification per requirement

Step 7.5 — Verify Definition of Done (if feature_plan provided with definition_of_done)
  For each task in feature_plan that has definition_of_done[]:
    Evaluate each DoD item against available evidence in code_map, test_state, and db_entities:
      "Code implemented" → check code_map for non-stub artifacts in task's module
      "Unit tests written and passing" → check test_state for tests covering this task's module
      "Code reviewed" → treat as satisfied if audit metadata contains review timestamp
      "Docs updated" → check code_map for doc references to this task's req_ids
      "Schema migrated" → check db_entities for entities related to task's module
    For any item that cannot be verified: mark as violated.
    Record: { task_id, dod_item, satisfied: bool, evidence_hint }
  Aggregate into dod_summary per task: satisfied_count / total_count.
  Tasks with any violated DoD item contribute a `partial` gap classification for their requirements.
  Output: dod_summary array

Step 8 — Calculate readiness score
  Base score: 100
  Apply penalty per gap classification per dimension (see knowledge doc weights).
  Score = max(0, 100 - sum(penalties))
  Determine readiness level: release_ready / conditional / not_ready / blocked.
  Output: readiness score + level

Step 9 — Build traceability matrix
  Assemble the full matrix: req_id → {code_artifacts, test_cases, ui_screens, db_entities,
  doc_references, gaps, coverage_score}.
  Output: complete traceability matrix

Step 10 — Assemble audit report
  Combine readiness score, gap list, traceability matrix, and recommendations.
  Output: complete implementation completeness report
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `readiness_score` | `integer` | Numeric score 0–100 |
| `readiness_level` | `string` | release_ready / conditional / not_ready / blocked |
| `release_threshold` | `integer` | Threshold used for this audit run |
| `gap_summary` | `object` | Count of gaps by classification (missing, stub, partial, untested, undocumented) |
| `gaps` | `array[object]` | All gaps with req_id, classification, dimension, and remediation hint |
| `dod_summary` | `array[object]` | Per-task DoD verification: `{ task_id, satisfied_count, total_count, violations[] }` |
| `traceability_matrix` | `array[object]` | Full requirement → artifact mapping (with source field) |
| `stub_report` | `array[object]` | Files/functions flagged as stubs with line references |
| `metadata` | `object` | Version, requirement count, coverage rate, audit timestamp |
| `metrics` | `object` | tokens_in, tokens_out, duration_ms, items_produced, version |
| `feedback` | `array[object]` | Backpropagate entries for upstream skills |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["readiness_score", "readiness_level", "gap_summary", "gaps", "dod_summary", "traceability_matrix", "metadata", "metrics", "feedback"],
  "properties": {
    "readiness_score":    { "type": "integer", "minimum": 0, "maximum": 100 },
    "readiness_level":    { "type": "string", "enum": ["release_ready", "conditional", "not_ready", "blocked"] },
    "release_threshold":  { "type": "integer" },
    "gap_summary": {
      "type": "object",
      "properties": {
        "missing":       { "type": "integer" },
        "stub":          { "type": "integer" },
        "partial":       { "type": "integer" },
        "untested":      { "type": "integer" },
        "undocumented":  { "type": "integer" },
        "total":         { "type": "integer" }
      }
    },
    "gaps": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["req_id", "classification", "dimension", "remediation"],
        "properties": {
          "req_id":         { "type": "string" },
          "classification": { "type": "string", "enum": ["missing", "stub", "partial", "untested", "undocumented"] },
          "dimension":      { "type": "string", "enum": ["code", "test", "ui", "database", "documentation"] },
          "remediation":    { "type": "string" }
        }
      }
    },
    "traceability_matrix": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["req_id", "statement", "coverage_score"],
        "properties": {
          "req_id":           { "type": "string" },
          "statement":        { "type": "string" },
          "source":           { "type": "string", "enum": ["task_map", "annotation", "naming", "unmapped"] },
          "code_artifacts":   { "type": "array", "items": { "type": "string" } },
          "test_cases":       { "type": "array", "items": { "type": "string" } },
          "ui_screens":       { "type": "array", "items": { "type": "string" } },
          "db_entities":      { "type": "array", "items": { "type": "string" } },
          "doc_references":   { "type": "array", "items": { "type": "string" } },
          "gaps":             { "type": "array", "items": { "type": "string" } },
          "coverage_score":   { "type": "integer", "minimum": 0, "maximum": 100 }
        }
      }
    },
    "dod_summary": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["task_id", "satisfied_count", "total_count", "violations"],
        "properties": {
          "task_id":         { "type": "string" },
          "satisfied_count": { "type": "integer" },
          "total_count":     { "type": "integer" },
          "violations":      { "type": "array", "items": { "type": "string" } }
        }
      }
    },
    "metadata": {
      "type": "object",
      "properties": {
        "version":            { "type": "string" },
        "requirement_count":  { "type": "integer" },
        "coverage_rate":      { "type": "number" },
        "audit_timestamp":    { "type": "string", "format": "date-time" }
      }
    },
    "metrics":  { "$ref": "#/$defs/metrics" },
    "feedback": { "type": "array", "items": { "$ref": "#/$defs/feedback_entry" } }
  },
  "$defs": {
    "metrics": {
      "type": "object",
      "required": ["tokens_in", "tokens_out", "duration_ms", "items_produced", "version"],
      "properties": {
        "tokens_in": { "type": "integer" }, "tokens_out": { "type": "integer" },
        "duration_ms": { "type": "integer" }, "items_produced": { "type": "integer" },
        "version": { "type": "string" }
      }
    },
    "feedback_entry": {
      "type": "object",
      "required": ["type", "from_skill", "reason"],
      "properties": {
        "type":         { "type": "string", "enum": ["backpropagate", "info", "warning"] },
        "from_skill":   { "type": "string" },
        "target_skill": { "type": "string" },
        "reason":       { "type": "string" },
        "evidence":     { "type": "object" }
      }
    }
  }
}
```

## Rules & Constraints

- Every functional requirement (`type: "F"`) MUST appear in the traceability matrix.
- `readiness_level: "blocked"` MUST halt pipeline advancement — no exceptions.
- `readiness_level: "not_ready"` MUST trigger a backpropagate feedback entry to `code-generator` or `builder` with the gap list.
- Stub detection runs on ALL code artifacts in code_map — not just those mapped to requirements.
- The `release_threshold` value is passed to `implementation-completeness-guard` in the feedback output.

## Security Considerations

- The auditor reads code_map but does not modify any files.
- Gap reports must not include source code snippets in the output — reference file paths and line numbers only.

## Token Optimization

- Traceability matrix entries are summarized to ID + score + gap count when > 50 requirements.
- Stub report truncates to the 20 most severe stubs when > 50 detected.
- Code_map is scanned at file/function level — full file content is not loaded into context.

## Quality Checklist

- [ ] All functional requirements appear in the traceability matrix
- [ ] Traceability matrix includes `source` field for every entry (task_map / annotation / naming / unmapped)
- [ ] Readiness score matches the sum of penalties applied
- [ ] All stubs are classified — not counted as implemented
- [ ] Gap summary totals match the gaps array length
- [ ] dod_summary contains an entry for every task that has definition_of_done in feature_plan
- [ ] Feedback entry exists if readiness_level is not_ready or blocked

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| code_map is empty | Return error: `{"error": "NO_CODE_MAP", "hint": "Run code-generator before auditing"}` |
| No requirements provided | Return error: `{"error": "NO_REQUIREMENTS"}` |
| test_state missing coverage data | Classify all requirements as `untested`, proceed with partial audit |
| readiness_level: blocked | Halt pipeline, return full gap list with remediation hints |

## Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Behavior |
|------|---------|---------|----------|
| Completeness review | Always in release pipeline | 3600s | Present readiness score, gap summary, and traceability matrix for sign-off |

## Skill Composition

```yaml
composes:
  - skill: implementation-completeness-auditor
    version: "^1.0.0"
    input_map:
      requirements:    "validated_requirements"
      code_map:        "system_state.code_map"
      test_state:      "system_state.test_state"
      screen_inventory: "ux_screen_inventory"
      db_entities:     "db_entity_list"
    output_map:
      readiness_score: "release_readiness_score"
      gaps:            "implementation_gaps"
      traceability_matrix: "req_traceability_matrix"
```

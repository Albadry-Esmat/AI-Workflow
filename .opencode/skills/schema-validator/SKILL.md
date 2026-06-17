---
name: schema-validator
version: 1.0.0
domain: validation
description: Use when validating a JSON object or payload against a JSON Schema. Triggers on: "validate this JSON", "check the schema", "does this match the schema", "schema validation", "validate payload", "JSON schema check".
author: system
---

## Purpose

Ensure every skill output conforms to its declared schema before it is passed downstream. This is a utility skill invoked by the orchestrator after every skill execution. It prevents schema drift, missing fields, and type mismatches from propagating through the pipeline.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `data` | `object` | Yes | The JSON data to validate |
| `schema` | `object` | Yes | JSON Schema (draft-07) to validate against |
| `strictness` | `string` | No | `"strict"`, `"permissive"` — strict rejects unknown fields (default: `"permissive"`) |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "data": { "type": "object", "description": "Data to validate" },
    "schema": { "type": "object", "description": "JSON Schema definition" },
    "strictness": { "type": "string", "enum": ["strict", "permissive"], "default": "permissive" }
  },
  "required": ["data", "schema"]
}
```

## Required Context

- Target skill's output schema (resolved from registry by the orchestrator).

## Execution Logic

```
Step 1 — Parse schema
  Validate that schema is a valid JSON Schema (draft-07).
  Extract: required fields, property types, enum values, pattern constraints, min/max.
  Output: parsed schema constraints

Step 2 — Validate data structure
  Check: data is an object, all required properties present, no unknown properties (if strict),
  property types match schema, arrays contain correct item types.
  Output: structural validation issues

Step 3 — Validate constraints
  Check: string patterns, enum values, min/max lengths, min/max values, min/max items, uniqueItems.
  Output: constraint validation issues

Step 4 — Validate data integrity (if applicable)
  Check: no null where non-null expected, no empty strings where minLength > 0, no negative numbers where minimum >= 0.
  Output: integrity issues

Step 5 — Compile results
  Aggregate all issues. If zero issues, data is valid.
  Output: validation result
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `valid` | `boolean` | Whether the data passed all validation |
| `issues` | `array[object]` | Validation issues (path, expected, actual, severity) |
| `metrics` | `object` | Validation metrics (fields_checked, issues_found, duration) |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "valid": { "type": "boolean" },
    "issues": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "path": { "type": "string", "description": "JSON path to the field (e.g., requirements.0.id)" },
          "expected": { "type": "string" },
          "actual": { "type": "string" },
          "severity": { "type": "string", "enum": ["error", "warning"] }
        },
        "required": ["path", "expected", "actual", "severity"]
      }
    },
    "metrics": {
      "type": "object",
      "properties": {
        "fields_checked": { "type": "integer" },
        "issues_found": { "type": "integer" },
        "errors": { "type": "integer" },
        "warnings": { "type": "integer" }
      },
      "required": ["fields_checked", "issues_found"]
    },
    "feedback": {
      "type": "array",
      "items": { "$ref": "#/$defs/feedback_entry" }
    }
  },
  "required": ["valid", "issues", "metrics", "feedback"],
  "$defs": {
    "feedback_entry": {
      "type": "object",
      "properties": {
        "type": { "type": "string", "enum": ["backpropagate", "info", "warning"] },
        "from_skill": { "type": "string" },
        "target_skill": { "type": "string" },
        "reason": { "type": "string" },
        "evidence": { "type": "object" }
      },
      "required": ["type", "from_skill", "reason"]
    }
  }
}
```

## Rules & Constraints

- `valid` MUST be `false` if any `error` severity issue exists.
- Warnings do not invalidate the data but MUST be reported.
- Unknown properties are ONLY rejected in `strict` mode. In `permissive` mode they are silently ignored.

## Quality Checklist

- [ ] Schema itself is valid JSON Schema
- [ ] All `required` fields in schema are checked
- [ ] Type checking is strict (number vs integer, string vs enum)
- [ ] `issues` paths use dot-notation for nested fields

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| Schema is invalid JSON Schema | Return error: `{"error": "INVALID_SCHEMA"}` |
| Data is not parseable JSON | Return error: `{"error": "UNPARSEABLE_DATA"}` |
| Data is extremely large (>10K fields) | Sample check first 1000 fields, flag `"sampled": true` |

## 8. Security Considerations

- Do NOT log or expose the `data` payload outside the validation result — it may contain sensitive content.
- Schemas submitted as input are treated as trusted — do NOT execute any `$schema` URL references.
- The skill MUST NOT attempt to fetch remote `$ref` URIs. Only resolve local `$defs` and `definitions`.

## 9. Token Optimization

- For large schemas, compress to `required` array and `properties` keys only before validation — omit descriptions and examples.
- Report only the first 20 issues if validation produces more — flag `"truncated": true` in metrics.
- Omit the `feedback` array from output if empty (schema-validator rarely triggers backpropagation).

## 12. Human-in-the-Loop Gates

`schema-validator` is a utility skill invoked by the orchestrator. It does not define HITL gates — gate decisions based on validation results are the orchestrator's responsibility.

## 13. Skill Composition

`schema-validator` is composed by `doc-maintainer` to verify new documentation file structure before writing. It may also be invoked standalone as a utility:

```yaml
# Inline use in any meta-skill
composes:
  - skill: schema-validator
    version: "^1.0.0"
    input_map: { "data": "skill_output", "schema": "expected_schema" }
    output_map: { "valid": "is_valid", "issues": "validation_issues" }
```

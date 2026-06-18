---
name: performance-guard
version: 1.0.0
domain: governance
description: 'Use when validating implementation for performance regressions before release. Triggers on: "performance check", "performance guard", "detect N+1 queries", "missing indexes check", "response time regression", "is this performant".'
author: system
---

## Purpose

Detect performance anti-patterns and regressions in the implementation before they reach production. The guard inspects code artifacts and database schema for N+1 query patterns, missing indexes on query-critical columns, unoptimized bulk operations, and synchronous blocking calls. It emits a `pass` or `block` verdict consumed by the orchestrator as a `validation_check` gate.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `code_map` | `object` | Yes | System state code map (from state-manager SKL-021) |
| `db_indexes` | `array[object]` | No | Index definitions from database-architect (SKL-032) |
| `architecture` | `object` | No | Module definitions from architecture-design (SKL-002) |
| `performance_targets` | `object` | No | Non-functional requirements specifying response time thresholds |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["code_map"],
  "properties": {
    "code_map":            { "type": "object" },
    "db_indexes":          { "type": "array" },
    "architecture":        { "type": "object" },
    "performance_targets": { "type": "object" }
  }
}
```

## Required Context

- `code_map` from system state (SKL-021).
- Optionally `db_indexes` from `database-architect` (SKL-032).

## Execution Logic

```
Step 1 — Detect N+1 query patterns
  Scan code_map for ORM or query patterns inside loops.
  Flag: queries inside for/forEach/map/while without batch or eager-load.
  Output: N+1 pattern list with file:line references

Step 2 — Check missing indexes for query patterns
  Scan code_map for WHERE, ORDER BY, JOIN conditions.
  Cross-reference against db_indexes.
  Flag: WHERE/ORDER BY on columns with no corresponding index.
  Output: missing index recommendations

Step 3 — Detect unoptimized bulk operations
  Scan for: N individual INSERT/UPDATE inside loops instead of batch syntax.
  Flag: single-row operations in loops over collections > 10 items.
  Output: bulk operation anti-pattern list

Step 4 — Detect synchronous blocking in async contexts
  Scan for: sync file I/O, sync HTTP calls, CPU-intensive operations on the event loop thread.
  Flag: blocking operations without offloading.
  Output: blocking operation list

Step 5 — Check pagination implementation
  Scan for: OFFSET-based pagination on large datasets.
  Flag: OFFSET on tables expected to exceed 100K rows without keyset pagination alternative.
  Output: pagination anti-pattern list

Step 6 — Assemble verdict
  Block conditions: N+1 patterns, missing indexes on query-critical columns.
  Warning conditions: bulk operations, pagination anti-patterns.
  Output: guard verdict with violation list
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `verdict` | `string` | `pass` or `block` |
| `violations` | `array[object]` | Block-level violations (rule, file, line, severity, remediation) |
| `warnings` | `array[object]` | Warning-level issues |
| `metrics` | `object` | tokens_in, tokens_out, duration_ms, items_produced, version |
| `feedback` | `array[object]` | Backpropagate to code-generator or database-architect |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["verdict", "violations", "metrics", "feedback"],
  "properties": {
    "verdict": { "type": "string", "enum": ["pass", "block"] },
    "violations": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["rule", "severity", "remediation"],
        "properties": {
          "rule":        { "type": "string" },
          "file":        { "type": "string" },
          "line":        { "type": "integer" },
          "severity":    { "type": "string", "enum": ["critical", "major", "minor"] },
          "remediation": { "type": "string" }
        }
      }
    },
    "warnings":  { "type": "array" },
    "metrics":   { "$ref": "#/$defs/metrics" },
    "feedback":  { "type": "array", "items": { "$ref": "#/$defs/feedback_entry" } }
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

## Block Conditions (verdict = "block")

| Condition | Rule |
|-----------|------|
| N+1 query pattern inside loop | `n_plus_one_query` |
| Missing index on WHERE/ORDER BY column | `missing_query_index` |

## Rules & Constraints

- Read-only — never modifies code or schema files.
- A `block` verdict halts the pipeline gate.
- File path and line number references are required for all violations.

## Security Considerations

- Read-only — never modifies code or schema files.
- Do not emit raw code snippets in violation output — emit file path, line number, and pattern name only.

## Token Optimization

- Scan code_map at function/method level — do not load full file contents.
- Violations capped at 15 entries; further violations summarized as count + pattern name.

## Quality Checklist

- [ ] N+1 query patterns checked inside all loop constructs
- [ ] Missing indexes verified against query patterns in the code map
- [ ] Bulk operation anti-patterns detected (for-each insert, redundant eager loads)
- [ ] Synchronous blocking calls flagged in async contexts
- [ ] Verdict is exactly `"pass"` or `"block"` — no other values
- [ ] File path + line number provided for every violation

## Failure Scenarios

| Scenario | Action |
|----------|--------|
| `code_map` is missing or empty | Emit `verdict: "block"`, `reason: "empty_code_map"` |
| `db_indexes` list unavailable | Emit `verdict: "pass"` with warning: index check skipped |
| Pattern scan error on a file | Skip that file, log as warning — do not halt entire scan |

## Human-in-the-Loop Gates

- Performance-guard `block` verdicts require code fix before re-running — there is no human-approval bypass for performance violations.
- Warnings may be acknowledged by a human reviewer before advancing; this does not affect the verdict.

## Skill Composition

```yaml
composes:
  - skill: performance-guard
    version: "^1.0.0"
    input_map:
      code_map:   "system_state.code_map"
      db_indexes: "db_index_list"
    output_map:
      verdict:    "performance_guard_verdict"
      violations: "performance_violations"
```

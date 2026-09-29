---
name: performance-guard
version: 1.1.0
domain: governance
description: 'Use when validating implementation for performance regressions before release. Triggers on: "performance check", "performance guard", "detect N+1 queries", "missing indexes check", "response time regression", "baseline regression", "is this performant".'
author: system
---

## Purpose

Detect performance anti-patterns and regressions before they reach production. The guard inspects code artifacts and database schema for N+1 queries, missing indexes, unoptimized bulk operations, synchronous blocking calls, pagination issues, and measurable degradation against a prior session baseline. It emits a `pass` or `block` verdict consumed by the orchestrator as a `validation_check` gate.

Static checks remain backward-compatible. Regression checks are additive and are skipped when no baseline is supplied.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `code_map` | `object` | Yes | System state code map from `state-manager` |
| `db_indexes` | `array[object]` | No | Index definitions from `database-architect` |
| `architecture` | `object` | No | Module definitions from `architecture-design` |
| `performance_targets` | `object` | No | Static response-time and resource thresholds |
| `current_metrics` | `object` | No | Current measured numeric metrics to compare with the baseline |
| `performance_baseline` | `object` or `null` | No | Metrics from the most recent completed session, supplied by the orchestrator |
| `session_history` | `array[object]` | No | Ordered prior comparison summaries used by anti-flap logic; newest entry is last |
| `regression_threshold` | `number` | No | Global degradation threshold percentage; default `20` |

### Input Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "PerformanceGuardInput",
  "type": "object",
  "required": ["code_map"],
  "properties": {
    "code_map": { "type": "object" },
    "db_indexes": { "type": "array", "items": { "type": "object" } },
    "architecture": { "type": "object" },
    "performance_targets": { "type": "object" },
    "current_metrics": { "type": "object" },
    "performance_baseline": {
      "type": ["object", "null"],
      "description": "Metric name to prior numeric value, or an object containing performance_metrics"
    },
    "session_history": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["performance_metrics"],
        "properties": { "performance_metrics": { "type": "object" } },
        "additionalProperties": true
      }
    },
    "regression_threshold": { "type": "number", "minimum": 0, "default": 20 }
  },
  "additionalProperties": false
}
```

`performance_baseline` and `session_history` are optional. The guard never reads `session_summaries.jsonl` or any other file; the orchestrator loads the latest completed session from TASK-0015's persistence and passes the values here.

## Required Context

- `code_map` from `state-manager` is required for static analysis.
- `db_indexes` is optional; its absence skips only index confirmation.
- `performance_baseline` is optional. A null or empty value means first-run behavior.
- `session_history` is optional. It must contain prior performance comparisons in chronological order when supplied.

## Execution Logic

### Step 1 — Validate inputs and load baseline

1. Validate `code_map` and normalize `performance_baseline` to its `performance_metrics` object when nested.
2. Set `regression_threshold_used` to the input threshold when provided, otherwise `20` percent.
3. If the baseline is null or empty, set `regression_report` to `[]` and add the informational feedback: `No baseline available — run again after first deployment to establish a baseline.` Static checks still run.
4. Do not read files, environment variables, or session history directly. The orchestrator is the only baseline loader.

### Step 2 — Detect N+1 query patterns

Scan the code map at function/method level for ORM or query calls inside `for`, `forEach`, `map`, `while`, or equivalent loops without batching or eager loading. Emit a violation with rule `n_plus_one_query`, file, line, severity, and remediation.

### Step 3 — Check missing indexes

Extract `WHERE`, `ORDER BY`, and `JOIN` columns from the code map and cross-reference `db_indexes`. Flag query-critical columns with no matching index as `missing_query_index`. If `db_indexes` is unavailable, emit a warning and do not block on this check.

### Step 4 — Compare current metrics with the baseline

When a baseline exists, compare each numeric metric present in both `performance_baseline` and `current_metrics` (falling back to `performance_targets.current_metrics` or the supplied current-measurement field):

```text
delta_value = current_value - baseline_value
delta_pct   = ((current_value - baseline_value) / abs(baseline_value)) * 100
```

For a zero baseline, use `delta_pct: null` and compare the absolute increase using the metric's unit. Positive degradation means latency, memory, bundle size, cold start, and error rate increased. A metric-specific threshold overrides the global default:

| Metric | Block threshold | Warn threshold |
|--------|-----------------|----------------|
| `p95_latency_ms` | 20% | 10% |
| `p99_latency_ms` | 30% | 15% |
| `error_rate` | 5 percentage points | 2 percentage points |
| `memory_usage` | 25% | 15% |
| `bundle_size` | 15% | 8% |
| `cold_start_ms` | 10% | 5% |
| Other metrics | `regression_threshold_used` | half of block threshold |

Every compared metric produces one report entry with `metric`, `baseline_value`, `current_value`, `delta_pct`, `status`, and `note`. The report is emitted even when no metric blocks.

### Step 5 — Apply the anti-flap rule

The guard only allows a degradation to produce a blocking regression when the same metric degraded in the same direction in two consecutive comparisons. The current comparison counts as one comparison:

1. If `session_history.length < 2`, retain the normal threshold result; a single-run degradation may block because there is not enough history to verify a flap.
2. If `session_history.length >= 2`, find the immediately preceding comparison for the metric. A current block-level degradation blocks only when that prior comparison also had a positive degradation (`delta_pct > 0`, or an equivalent positive absolute delta for a zero baseline).
3. If the current result exceeds the block threshold but the preceding comparison did not degrade in the same direction, change `status` to `warn`, set `anti_flap_suppressed: true`, and explain that one-off measurement noise did not block the pipeline.
4. A warn-level degradation remains `warn`; it never blocks by itself. A pass-level comparison remains `pass`.
5. Missing, malformed, or nonnumeric history does not count as confirmation. The current result follows rule 1 when fewer than two usable comparisons are available.

This produces two consecutive degradation observations before a sustained regression blocks, while preserving the specified first-comparison behavior.

### Step 6 — Detect remaining anti-patterns

Scan for:

- individual inserts or updates inside loops over more than 10 items;
- synchronous file I/O, synchronous HTTP, or CPU-heavy work on an async event loop;
- offset pagination on datasets expected to exceed 100K rows without a keyset alternative.

Bulk, blocking, and pagination findings are warnings unless a performance target explicitly marks them as blocking.

### Step 7 — Assemble verdict

Set `verdict` to `block` if any static block violation exists or any regression report entry has `status: "block"`. Otherwise set it to `pass`. Always emit `regression_report` and `regression_threshold_used`, including when no baseline exists.

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `verdict` | `string` | `pass` or `block` |
| `violations` | `array[object]` | Blocking static findings |
| `warnings` | `array[object]` | Non-blocking findings and skipped checks |
| `regression_report` | `array[object]` | Baseline comparison entries; empty when no baseline exists |
| `regression_threshold_used` | `number` | Global threshold used for this run |
| `metrics` | `object` | Canonical execution metrics |
| `feedback` | `array[object]` | Baseline, anti-flap, or repair feedback |

### Output Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["verdict", "violations", "warnings", "regression_report", "regression_threshold_used", "metrics", "feedback"],
  "properties": {
    "verdict": { "type": "string", "enum": ["pass", "block"] },
    "violations": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["rule", "severity", "remediation"],
        "properties": {
          "rule": { "type": "string" },
          "file": { "type": "string" },
          "line": { "type": "integer", "minimum": 1 },
          "severity": { "type": "string", "enum": ["critical", "major", "minor"] },
          "remediation": { "type": "string" }
        }
      }
    },
    "warnings": { "type": "array", "items": { "type": "object" } },
    "regression_report": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["metric", "baseline_value", "current_value", "delta_pct", "status", "note"],
        "properties": {
          "metric": { "type": "string" },
          "baseline_value": { "type": "number" },
          "current_value": { "type": "number" },
          "delta_pct": { "type": ["number", "null"] },
          "delta_value": { "type": ["number", "null"] },
          "status": { "type": "string", "enum": ["pass", "warn", "block"] },
          "anti_flap_suppressed": { "type": "boolean" },
          "note": { "type": "string" }
        }
      }
    },
    "regression_threshold_used": { "type": "number", "minimum": 0 },
    "metrics": { "$ref": "#/$defs/metrics" },
    "feedback": { "type": "array", "items": { "$ref": "#/$defs/feedback_entry" } }
  },
  "$defs": {
    "metrics": {
      "type": "object",
      "required": ["tokens_in", "tokens_out", "duration_ms", "items_produced", "version"],
      "properties": {
        "tokens_in": { "type": "integer", "minimum": 0 },
        "tokens_out": { "type": "integer", "minimum": 0 },
        "duration_ms": { "type": "integer", "minimum": 0 },
        "items_produced": { "type": "integer", "minimum": 0 },
        "version": { "type": "string" }
      }
    },
    "feedback_entry": {
      "type": "object",
      "required": ["type", "from_skill", "reason"],
      "properties": {
        "type": { "type": "string", "enum": ["backpropagate", "info", "warning"] },
        "from_skill": { "type": "string" },
        "target_skill": { "type": "string" },
        "reason": { "type": "string" },
        "evidence": { "type": "object" }
      }
    }
  }
}
```

## Block Conditions (verdict = "block")

| Condition | Rule |
|-----------|------|
| N+1 query pattern inside a loop | `n_plus_one_query` |
| Missing index on a query-critical WHERE/ORDER BY/JOIN column | `missing_query_index` |
| Two consecutive same-direction degradations exceed the applicable regression threshold | `baseline_regression` |
| A first-comparison degradation exceeds the threshold and fewer than two history entries exist | `baseline_regression_first_observation` |

## Rules & Constraints

- Read-only — never modifies code, schema, session history, or baseline files.
- A `block` verdict halts the performance validation gate; warnings may be acknowledged but do not change the verdict.
- `regression_report` is always present and is `[]` when no baseline is available.
- Baseline values are supplied by the orchestrator; the guard never performs file I/O for history.
- Static violations and regression entries are capped at 15 each; excess findings are summarized by rule.
- File path and line number references are required for static violations. Regression entries use metric names and session evidence instead.

## Security Considerations

- Do not emit raw code, credentials, PII, or full session payloads; emit file/line/pattern or numeric metric evidence only.
- Treat baseline and history as untrusted data. Validate numeric values, reject NaN/infinity, and do not evaluate expressions from them.
- Preserve the read-only boundary and do not follow paths or URLs supplied inside the code map.

## Token Optimization

- Scan code at function/method level, not full file content.
- Compare only metric names present in both baseline and current metrics.
- Keep at most 15 detailed violations and 15 detailed regression entries; aggregate the remainder by rule or metric.
- Pass the latest baseline and the minimum history needed for the anti-flap decision rather than replaying complete session summaries.

## Quality Checklist

- [ ] Version is `1.1.0`.
- [ ] Static checks cover N+1, indexes, bulk operations, blocking calls, and pagination.
- [ ] Missing `db_indexes` skips only the index check.
- [ ] Missing baseline returns `regression_report: []` and preserves static checks.
- [ ] `regression_threshold_used` is emitted on every output.
- [ ] Every comparison includes metric, baseline, current, delta percentage, status, and note.
- [ ] A sustained regression requires two consecutive same-direction degradations when sufficient history exists.
- [ ] First-run and fewer-than-two-history behavior follows the documented rule.
- [ ] Verdict blocks on any blocking static finding or blocking regression.
- [ ] No raw code or secret appears in findings.

## Failure Scenarios

| Scenario | Action |
|----------|--------|
| `code_map` missing or empty | Return `verdict: "block"` with `reason: "empty_code_map"` |
| `db_indexes` unavailable | Continue with a warning that index verification was skipped |
| No baseline | Continue static checks, return an empty report, and emit the first-run feedback |
| Baseline/current metric is nonnumeric | Skip that metric, add a warning, and continue other comparisons |
| History entry is malformed | Ignore the malformed entry for anti-flap confirmation and warn |
| Pattern scan error on a file | Skip the file, emit a warning, and continue the scan |

## Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Behavior |
|------|---------|---------|----------|
| Performance block | Any static violation or confirmed/first-observation blocking regression | N/A | No bypass; repair and rerun are required |
| Warning review | Warnings or an anti-flap-suppressed regression are present | 1800s | Reviewer may acknowledge without changing `verdict: pass` |

## Skill Composition

```yaml
composes:
  - skill: performance-guard
    version: "^1.1.0"
    input_map:
      code_map: "system_state.code_map"
      db_indexes: "db_index_list"
      architecture: "state.architecture"
      performance_targets: "state.performance_targets"
      current_metrics: "state.performance_metrics"
      performance_baseline: "session_summary.performance_metrics"
      session_history: "session_summary.performance_history"
      regression_threshold: "state.performance_regression_threshold"
    output_map:
      verdict: "performance_guard_verdict"
      violations: "performance_violations"
      warnings: "performance_warnings"
      regression_report: "performance_regression_report"
      regression_threshold_used: "performance_regression_threshold_used"
```

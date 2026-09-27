---
name: data-quality-validator
version: 1.0.0
domain: data
description: >
  Use when defining, enforcing, or auditing data quality rules across pipelines, schemas, or datasets.
  Triggers on: "data quality rules", "dbt tests", "Great Expectations suite", "freshness SLA",
  "schema drift detection", "data quality scorecard". Do NOT use for database schema design or
  pipeline topology — use data-pipeline-architect and database-architect for those concerns.
author: system
---

## Purpose

Define and operationalize data quality rules across every layer of a data pipeline. The skill translates
a schema definition and optional data profile into a complete quality enforcement suite: structured rule
expressions mapped to quality dimensions, dbt YAML test definitions, Great Expectations expectation suites,
freshness monitors for SLA enforcement, and alerting rules for anomaly detection. Outputs are ready to be
embedded directly into dbt projects or Great Expectations checkpoints without modification.

This skill is positioned after `data-pipeline-architect` in the pipeline and produces artifacts consumed by
`deployment-strategy` for automated quality gate integration in CI/CD. It enforces six quality dimensions
(completeness, accuracy, timeliness, uniqueness, validity, consistency) and generates a scorecard that
gives data platform teams a single-number health indicator per dataset per run cycle.

The skill treats schema drift as a first-class event: any field addition, removal, type change, or
constraint relaxation detected between schema versions is classified by breaking severity and surfaced
in `feedback` for routing to `data-contract-enforcer`. This makes `data-quality-validator` the real-time
sentinel that keeps data contracts honest at runtime.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `schema` | `object` | Yes | JSON Schema or dbt `schema.yml` object describing the target dataset |
| `data_profile` | `object` | No | Statistical profile: `{ field, min, max, null_rate, distinct_count, distribution }` per column |
| `quality_dimensions` | `array[string]` | No | Subset to enforce: `completeness` \| `accuracy` \| `timeliness` \| `uniqueness` \| `validity` \| `consistency` — default: all six |
| `sla_thresholds` | `object` | No | Per-dimension pass thresholds: `{ completeness: 0.99, uniqueness: 1.0, freshness_max_age_sec: 3600 }` |
| `context` | `object` | No | Prior outputs from data-pipeline-architect, database-architect, or data-contract-enforcer |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["schema"],
  "properties": {
    "schema": {
      "type": "object",
      "description": "JSON Schema or dbt schema.yml object for the target dataset",
      "required": ["title"],
      "properties": {
        "title":      { "type": "string" },
        "properties": { "type": "object" },
        "required":   { "type": "array", "items": { "type": "string" } }
      }
    },
    "data_profile": {
      "type": "object",
      "additionalProperties": {
        "type": "object",
        "properties": {
          "null_rate":      { "type": "number", "minimum": 0, "maximum": 1 },
          "distinct_count": { "type": "integer" },
          "min":            {},
          "max":            {},
          "distribution":   { "type": "string", "enum": ["uniform", "normal", "skewed", "categorical", "unknown"] }
        }
      }
    },
    "quality_dimensions": {
      "type": "array",
      "items": {
        "type": "string",
        "enum": ["completeness", "accuracy", "timeliness", "uniqueness", "validity", "consistency"]
      }
    },
    "sla_thresholds": {
      "type": "object",
      "properties": {
        "completeness":          { "type": "number", "minimum": 0, "maximum": 1 },
        "uniqueness":            { "type": "number", "minimum": 0, "maximum": 1 },
        "validity":              { "type": "number", "minimum": 0, "maximum": 1 },
        "freshness_max_age_sec": { "type": "integer", "minimum": 0 }
      }
    },
    "context": { "type": "object" }
  }
}
```

## Required Context

- Schema definition from `database-architect` or `data-pipeline-architect` — minimum: field names and types.
- Optionally: `data_profile` from a profiling run (e.g., dbt-expectations, Great Expectations profiler).
- Optionally: `sla_thresholds` from SLA specification in `data-pipeline-architect.sla_estimates`.
- Optionally: prior `contract_definition` from `data-contract-enforcer` for cross-team threshold alignment.

## Execution Logic

```
Step 1 — Profile input schema
  Parse schema.properties to extract: field names, declared types, nullability, constraints.
  If data_profile provided: merge statistical metrics (null_rate, distinct_count, min, max) per field.
  Identify primary key candidates (low null_rate + high distinct_count).
  Identify critical fields (those in schema.required or referenced in sla_thresholds).
  Output: enriched_field_catalog { field, type, nullable, is_critical, null_rate, distinct_count }

Step 2 — Map quality dimensions to fields
  For each quality_dimension requested, map applicable fields:
    completeness:  all required fields + fields with null_rate > 0
    accuracy:      numeric fields (range checks), categorical fields (allowed value lists)
    timeliness:    timestamp/date fields tagged as partition or load columns
    uniqueness:    PK candidates, fields with distinct_count ≈ row_count
    validity:      regex-constrained fields, enum fields, FK reference fields
    consistency:   fields that should be consistent across a join key (cross-table)
  Output: dimension_field_map { dimension → [field, rule_type, threshold] }

Step 3 — Generate rule expressions
  For each (field, dimension) pair: generate a named rule expression.
    completeness:  null_rate(field) <= (1 - threshold)
    uniqueness:    duplicate_count(field) == 0
    validity:      field REGEXP pattern | field IN (enum_values) | field BETWEEN min AND max
    timeliness:    MAX(load_timestamp) >= NOW() - INTERVAL freshness_max_age_sec SECONDS
    accuracy:      field BETWEEN profile.min * 0.8 AND profile.max * 1.2  (bounds drift check)
    consistency:   COUNT(DISTINCT field) per join_key == 1
  Assign severity: critical (is_critical field fails) | major | minor.
  Output: quality_rules array { rule_id, dimension, field, expression, severity, threshold }

Step 4 — Produce dbt test definitions
  For each quality_rule: emit equivalent dbt test YAML.
    uniqueness    → dbt built-in: `unique` test
    completeness  → dbt built-in: `not_null` test
    validity/enum → dbt built-in: `accepted_values` test
    range/regex   → dbt-expectations: `expect_column_values_to_be_between` / `expect_column_values_to_match_regex`
    timeliness    → dbt-expectations: `expect_column_max_to_be_between` with date_part
  Group by model name (schema.title).
  Output: dbt_tests array of YAML test definition objects

Step 5 — Produce Great Expectations suite
  Map each quality_rule to a GE expectation:
    not_null         → expect_column_values_to_not_be_null
    unique           → expect_column_values_to_be_unique
    accepted_values  → expect_column_values_to_be_in_set
    range            → expect_column_values_to_be_between
    regex            → expect_column_values_to_match_regex
    freshness        → expect_table_row_count_to_be_between (proxy for freshness via row delta)
  Bundle into a named ExpectationSuite with meta.dataset_name = schema.title.
  Output: great_expectations_suite { expectation_suite_name, expectations[], meta }

Step 6 — Define freshness monitors
  For each timeliness field: create a freshness monitor spec.
    monitor_id, table, timestamp_column, max_age_sec, alert_channel, severity
  If no timeliness fields found: emit info feedback warning that freshness monitoring is unconfigured.
  Output: freshness_monitors array

Step 7 — Build alerting rules
  For each critical quality_rule: generate an alert rule:
    alert_id, rule_id, condition (rule fails), severity, channel (pagerduty|slack|email), cooldown_sec
  For schema drift (field removal or type change between schema versions if context.prior_schema provided):
    Classify: BREAKING (removal, type narrowing) vs. COMPATIBLE (addition, constraint relaxation).
    Emit alert_rule with severity: critical for BREAKING changes.
    Emit feedback of type: "backpropagate" to data-contract-enforcer for all BREAKING drift.
  Output: alert_rules array, schema_drift_report

Step 8 — Compute quality scorecard
  For each quality_dimension: score = (rules_passing / total_rules) * 100.
  Composite score = weighted average (completeness 30%, uniqueness 25%, validity 20%,
                    timeliness 15%, accuracy 5%, consistency 5%).
  Flag overall status: PASS (score >= sla_thresholds or 95%), WARN (>= 85%), FAIL (< 85%).
  Output: quality_scorecard { dataset, composite_score, dimension_scores, status, evaluated_at }
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `quality_rules` | `array[object]` | Rules: `{ rule_id, dimension, field, expression, severity, threshold }` |
| `dbt_tests` | `array[object]` | dbt YAML test definitions grouped by model |
| `great_expectations_suite` | `object` | Full GE ExpectationSuite object ready for checkpoint |
| `freshness_monitors` | `array[object]` | Freshness monitor specs: `{ monitor_id, table, timestamp_column, max_age_sec, alert_channel }` |
| `quality_scorecard` | `object` | `{ dataset, composite_score, dimension_scores, status, evaluated_at }` |
| `alert_rules` | `array[object]` | Alert definitions: `{ alert_id, rule_id, condition, severity, channel, cooldown_sec }` |
| `metrics` | `object` | Execution metrics: tokens_in, tokens_out, duration_ms, items_produced, version |
| `feedback` | `array[object]` | Backpropagate entries — always routes BREAKING schema drift to data-contract-enforcer |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["quality_rules", "dbt_tests", "great_expectations_suite",
               "freshness_monitors", "quality_scorecard", "alert_rules", "metrics", "feedback"],
  "properties": {
    "quality_rules": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["rule_id", "dimension", "field", "expression", "severity"],
        "properties": {
          "rule_id":    { "type": "string" },
          "dimension":  { "type": "string", "enum": ["completeness","accuracy","timeliness","uniqueness","validity","consistency"] },
          "field":      { "type": "string" },
          "expression": { "type": "string" },
          "severity":   { "type": "string", "enum": ["critical", "major", "minor"] },
          "threshold":  { "type": "number" }
        }
      }
    },
    "dbt_tests": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["model", "tests"],
        "properties": {
          "model": { "type": "string" },
          "tests": { "type": "array" }
        }
      }
    },
    "great_expectations_suite": {
      "type": "object",
      "required": ["expectation_suite_name", "expectations"],
      "properties": {
        "expectation_suite_name": { "type": "string" },
        "expectations":           { "type": "array" },
        "meta":                   { "type": "object" }
      }
    },
    "freshness_monitors": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["monitor_id", "table", "timestamp_column", "max_age_sec"],
        "properties": {
          "monitor_id":       { "type": "string" },
          "table":            { "type": "string" },
          "timestamp_column": { "type": "string" },
          "max_age_sec":      { "type": "integer" },
          "alert_channel":    { "type": "string" },
          "severity":         { "type": "string" }
        }
      }
    },
    "quality_scorecard": {
      "type": "object",
      "required": ["dataset", "composite_score", "status"],
      "properties": {
        "dataset":          { "type": "string" },
        "composite_score":  { "type": "number", "minimum": 0, "maximum": 100 },
        "dimension_scores": { "type": "object" },
        "status":           { "type": "string", "enum": ["PASS", "WARN", "FAIL"] },
        "evaluated_at":     { "type": "string", "format": "date-time" }
      }
    },
    "alert_rules": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["alert_id", "rule_id", "severity", "channel"],
        "properties": {
          "alert_id":     { "type": "string" },
          "rule_id":      { "type": "string" },
          "condition":    { "type": "string" },
          "severity":     { "type": "string", "enum": ["critical", "major", "minor"] },
          "channel":      { "type": "string", "enum": ["pagerduty", "slack", "email", "webhook"] },
          "cooldown_sec": { "type": "integer" }
        }
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
        "tokens_in":      { "type": "integer" },
        "tokens_out":     { "type": "integer" },
        "duration_ms":    { "type": "integer" },
        "items_produced": { "type": "integer" },
        "version":        { "type": "string" }
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

- Every `required` field in the input schema MUST produce at least one `completeness` quality rule.
- Rules with `severity: critical` that fail MUST set `quality_scorecard.status = "FAIL"` regardless of composite score.
- The Great Expectations suite name MUST equal `schema.title + "_quality_suite"` for consistent CI integration.
- `dbt_tests` MUST use only built-in dbt tests or `dbt-expectations` package — no custom macros.
- Every freshness monitor MUST have an `alert_channel` — monitors without alerting are rejected.
- BREAKING schema drift events MUST emit `feedback` of `type: "backpropagate"` targeting `data-contract-enforcer`.
- `quality_scorecard.composite_score` uses the fixed weighting scheme defined in Step 8 — custom weights are not supported in v1.0.0.

## Security Considerations

- PII fields flagged in the input schema MUST have their `data_profile` statistics suppressed in output — no min/max values for PII columns in the scorecard.
- Alert channels MUST reference configuration keys (e.g., `SLACK_WEBHOOK_URL`) — never literal webhook URLs.
- `great_expectations_suite` MUST NOT embed connection strings or credentials in meta fields.

## Token Optimization

- When `data_profile` has > 50 fields, compress to name + null_rate + is_critical only before passing to Steps 3-5.
- For large schemas (> 30 fields), generate dbt_tests grouped by model and write bulk to state; return only a summary count.
- Omit `accuracy` dimension rules when no `data_profile` is provided — cannot generate bounds without statistics.

## Quality Checklist

- [ ] Every required schema field has a completeness rule
- [ ] At least one uniqueness rule exists if a PK candidate is identified
- [ ] Great Expectations suite name matches schema.title convention
- [ ] All critical rules have corresponding alert_rules entries
- [ ] Freshness monitors cover all timestamp/date partition columns
- [ ] PII field statistics are suppressed in scorecard output
- [ ] BREAKING schema drift triggers backpropagate feedback to data-contract-enforcer
- [ ] Composite score computed with correct fixed weighting

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| Schema has no properties | Return error: `{"error": "EMPTY_SCHEMA", "hint": "Provide a schema with at least one field"}` |
| No timestamp columns found | Emit `freshness_monitors: []` and warning feedback; timeliness dimension skipped |
| null_rate on critical field > 5% | Trigger HITL gate; block scorecard finalization pending human review |
| Schema drift detected (BREAKING) | Emit critical alert_rule, backpropagate to data-contract-enforcer, set scorecard status WARN |
| quality_dimensions requested but schema has no applicable fields | Skip dimension silently, emit info feedback listing skipped dimensions |

## 12. Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Behavior |
|------|---------|---------|----------|
| Critical field null rate | `data_profile` shows null_rate > 0.05 on any `is_critical` field | 3600s | Pause after Step 1; present field name, null_rate, and upstream pipeline stage for data owner review before rule generation proceeds |
| Major schema drift | BREAKING schema drift detected between current schema and `context.prior_schema` across a major version boundary | 7200s | Pause after Step 7; present diff of BREAKING changes and affected consumer list for architect sign-off before alert rules fire |

## 13. Skill Composition

```yaml
composes:
  - skill: data-quality-validator
    version: "^1.0.0"
    triggered_by: data-pipeline-architect
    input_map:
      schema:             "pipeline_architecture.stages[-1].output_schema"
      data_profile:       "state.latest_data_profile"
      quality_dimensions: "session.quality_dimensions"
      sla_thresholds:     "pipeline_architecture.sla_estimates"
    output_map:
      quality_rules:              "state.quality_rules"
      dbt_tests:                  "state.dbt_test_suite"
      great_expectations_suite:   "state.ge_suite"
      quality_scorecard:          "state.quality_scorecard"
    feeds_into:
      - deployment-strategy
      - data-contract-enforcer
```

---
name: analytics-schema-designer
version: 1.0.0
domain: data
description: >
  Use when designing OLAP-optimized analytical schemas including star schema, snowflake, one-big-table,
  or data vault patterns for business intelligence and reporting workloads. Triggers on: "analytics schema",
  "star schema design", "data warehouse model", "dbt model definitions", "BI semantic layer",
  "dimensional modeling". Do NOT use for transactional OLTP schema design — use database-architect for
  operational schemas, or data-pipeline-architect for pipeline topology.
author: system
---

## Purpose

Design OLAP-optimized analytical schemas that directly answer defined business questions with minimal
query complexity. The skill supports five schema patterns — star schema (classic Kimball), snowflake
schema (normalized dimensions), one-big-table (OBT, denormalized wide table), data vault 2.0 (hub/link/satellite
for auditability), and wide-table (columnar analytics optimized) — and selects the best fit based on
query complexity, update frequency, and BI tool constraints.

Outputs include complete fact and dimension table specifications, dbt model YAML definitions (ready for
direct inclusion in a dbt project), slowly-changing dimension (SCD) type strategies per dimension,
pre-aggregation recommendations for materialized views or BI-layer aggregations, semantic layer hints
compatible with Looker LookML, Tableau calculated fields, Metabase, Power BI DAX, and Apache Superset,
and a suite of representative query patterns that demonstrate schema correctness against business questions.

This skill is positioned after `data-pipeline-architect` (which provides the Gold-layer data products)
and before `data-quality-validator` (which enforces freshness and completeness SLAs on the resulting
models). Its output feeds directly into `database-architect` for physical DDL generation and into
`deployment-strategy` for dbt project pipeline configuration.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `business_questions` | `array[string]` | Yes | List of analytical questions the schema must answer (e.g., "What is MRR by customer segment per month?") |
| `source_entities` | `array[object]` | Yes | Source entity specs: `{ name, grain, attributes[], relationships[] }` |
| `schema_pattern` | `string` | No | `star` \| `snowflake` \| `obt` \| `data_vault` \| `wide_table` — default: `star` |
| `bi_tool` | `string` | No | `looker` \| `tableau` \| `metabase` \| `powerbi` \| `superset` \| `none` |
| `query_performance_priority` | `string` | No | `latency` (minimize query time) \| `throughput` (optimize for many concurrent users) — default: `latency` |
| `context` | `object` | No | Prior outputs from data-pipeline-architect, database-architect, or requirement-analyzer |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["business_questions", "source_entities"],
  "properties": {
    "business_questions": {
      "type": "array",
      "minItems": 1,
      "items": { "type": "string", "minLength": 10 }
    },
    "source_entities": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": ["name", "grain"],
        "properties": {
          "name":          { "type": "string" },
          "grain":         { "type": "string", "description": "The lowest level of detail in this entity" },
          "attributes":    { "type": "array", "items": { "type": "string" } },
          "relationships": {
            "type": "array",
            "items": {
              "type": "object",
              "required": ["to", "type"],
              "properties": {
                "to":   { "type": "string" },
                "type": { "type": "string", "enum": ["one_to_one", "one_to_many", "many_to_many"] }
              }
            }
          },
          "update_frequency": { "type": "string", "enum": ["immutable", "daily", "hourly", "realtime"] }
        }
      }
    },
    "schema_pattern": {
      "type": "string",
      "enum": ["star", "snowflake", "obt", "data_vault", "wide_table"],
      "default": "star"
    },
    "bi_tool": {
      "type": "string",
      "enum": ["looker", "tableau", "metabase", "powerbi", "superset", "none"]
    },
    "query_performance_priority": {
      "type": "string",
      "enum": ["latency", "throughput"],
      "default": "latency"
    },
    "context": { "type": "object" }
  }
}
```

## Required Context

- `business_questions` are the primary driver — schema correctness is validated against them at Step 9.
- `source_entities` with grain definitions — required to identify fact vs. dimension tables.
- Optionally: Gold-layer data products from `data-pipeline-architect` for naming alignment.
- Optionally: `bi_tool` to generate BI-compatible semantic layer hints.
- Optionally: existing dbt project context from `context` to avoid model naming conflicts.

## Execution Logic

```
Step 1 — Analyze business questions
  Parse each question to extract: dimensions (by what?), measures (how many/much?),
    filters (constrained to what?), and time grain (at what frequency?).
  Identify the finest time grain required across all questions.
  Flag any question that cannot be answered from source_entities as a gap.
  Output: question_analysis { question, dimensions[], measures[], filters[], time_grain, answerable }

Step 2 — Identify grain and primary dimensions
  Determine the central fact grain: the most granular event or transaction in source_entities.
  Identify dimensional attributes: anything used as a filter, grouping, or label in Step 1.
  Identify measures: any quantitative attribute used in aggregation.
  Output: grain_declaration, dimension_candidates[], measure_candidates[]

Step 3 — Choose schema pattern
  If schema_pattern provided: use as-is.
  If not provided: select based on heuristics:
    dimension_count <= 5 AND measures > 20:             obt (simple denormalized)
    dimension_count 5-15, stable dimensions:            star (Kimball classic)
    dimension_count > 15 OR shared sub-dimensions:      snowflake (normalized dims)
    auditability/regulatory required:                   data_vault
    columnar engine (BigQuery/Redshift/Snowflake), high concurrency: wide_table
  Document pattern selection rationale.
  Output: selected_pattern, pattern_rationale

Step 4 — Design fact tables
  For each central fact grain: create fact table spec.
    Columns: surrogate PK, foreign keys to all dimension tables, measure columns, date key, load_ts.
    Measures: SUM-able only (no pre-aggregated ratios); ratios computed in semantic layer.
    Partitioning: by date_key (daily) for tables > 1TB; by date_key + dimension FK for star schemas.
    Grain declaration comment: -- GRAIN: one row per {grain_declaration}
  For data_vault: create satellite tables (descriptive attributes) and link tables (relationships).
  Output: fact_tables[] { name, grain, columns, foreign_keys, measures, partitioning }

Step 5 — Design dimension tables
  For each dimension_candidate: create dimension table spec.
    star/snowflake: dim_{entity_name} with surrogate key, natural key, attributes, SCD columns.
    obt: embed all dimensions inline in the wide table (no separate dim tables).
    data_vault: hub_{entity} (business key only), satellite_{entity} (attributes + load_ts, end_ts).
  Assign SCD type per dimension (Step 6 output feeds back here).
  Apply conformed dimension rule: dimensions shared across multiple fact tables use a single definition.
  Output: dimension_tables[] { name, surrogate_key, natural_key, attributes, scd_type }

Step 6 — Define SCD strategies
  For each dimension: classify update behavior:
    immutable attributes:             SCD Type 0 (no change tracking)
    current value only (overwrite):   SCD Type 1
    full history required:            SCD Type 2 (effective_from, effective_to, is_current)
    both current + previous needed:   SCD Type 3 (current_col + previous_col)
    full snapshot per period:         SCD Type 4 (mini-dimension or snapshot table)
  Default: SCD Type 2 for any entity with update_frequency != "immutable".
  Output: scd_strategies[] { dimension, scd_type, change_columns, history_columns }

Step 7 — Add pre-aggregation recommendations
  For each business question with time_grain = daily/weekly/monthly AND measure count > 3:
    Recommend a pre-aggregated summary table or materialized view.
    Specify: refresh_schedule, grain, measures, BI tool materialization strategy.
  For star schema: recommend date spine model (dbt date_spine macro).
  For throughput priority: recommend columnar clustering keys and sort keys.
  Output: pre_aggregation_recommendations[] { name, type, grain, measures, refresh_schedule, rationale }

Step 8 — Generate dbt model definitions
  For each fact and dimension table: emit a dbt model YAML entry:
    model name, description, columns (name, description, tests: [unique, not_null, accepted_values]).
    Add dbt tags: ["marts", schema_pattern, entity_name].
    Add meta: { owner, grain, scd_type } for dimension models.
  For pre-aggregation recommendations: emit dbt materialized model configs.
  Group by schema layer: staging (source alignment), intermediate (joins), marts (final dim/fact).
  Output: dbt_models[] { name, layer, config, columns, tests, meta }

Step 9 — BI compatibility review
  For each bi_tool, validate schema compatibility:
    looker:    Verify all dimension foreign keys are joinable in LookML explore; emit LookML hints.
    tableau:   Flag any OBT table > 500 columns (Tableau limit); recommend view-based splitting.
    metabase:  Verify metric columns are numeric; flag ARRAY/JSON columns as unsupported.
    powerbi:   Emit DAX measure stubs for each measure column; flag many-to-many relationships.
    superset:  Verify timestamp column presence per fact table; emit Superset dataset YAML hints.
  Validate all business questions from Step 1 are answerable by the schema.
  Flag any unanswerable question as a gap with remediation suggestion.
  Output: bi_semantic_layer_hints { tool, hints[], incompatibilities[] }, query_patterns[]
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `schema_design` | `object` | Complete schema: `{ pattern, fact_tables, dimension_tables, relationships }` |
| `dbt_models` | `array[object]` | dbt YAML model definitions grouped by layer (staging, intermediate, marts) |
| `scd_strategies` | `array[object]` | SCD type assignments per dimension: `{ dimension, scd_type, change_columns }` |
| `pre_aggregation_recommendations` | `array[object]` | Summary tables/materialized views: `{ name, type, grain, measures, refresh_schedule }` |
| `bi_semantic_layer_hints` | `object` | Tool-specific hints and incompatibilities per BI tool |
| `query_patterns` | `array[object]` | Representative SQL patterns demonstrating schema answers each business question |
| `metrics` | `object` | Execution metrics: tokens_in, tokens_out, duration_ms, items_produced, version |
| `feedback` | `array[object]` | Backpropagate entries; routes unanswerable questions to requirement-analyzer |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["schema_design", "dbt_models", "scd_strategies",
               "pre_aggregation_recommendations", "bi_semantic_layer_hints",
               "query_patterns", "metrics", "feedback"],
  "properties": {
    "schema_design": {
      "type": "object",
      "required": ["pattern", "fact_tables", "dimension_tables"],
      "properties": {
        "pattern":         { "type": "string", "enum": ["star", "snowflake", "obt", "data_vault", "wide_table"] },
        "fact_tables":     { "type": "array", "items": { "type": "object", "required": ["name", "grain", "columns"] } },
        "dimension_tables":{ "type": "array", "items": { "type": "object", "required": ["name", "surrogate_key"] } },
        "relationships":   { "type": "array" }
      }
    },
    "dbt_models": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["name", "layer", "config", "columns"],
        "properties": {
          "name":    { "type": "string" },
          "layer":   { "type": "string", "enum": ["staging", "intermediate", "marts"] },
          "config":  { "type": "object" },
          "columns": { "type": "array" },
          "tests":   { "type": "array" },
          "meta":    { "type": "object" }
        }
      }
    },
    "scd_strategies": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["dimension", "scd_type"],
        "properties": {
          "dimension":      { "type": "string" },
          "scd_type":       { "type": "integer", "enum": [0, 1, 2, 3, 4] },
          "change_columns": { "type": "array", "items": { "type": "string" } },
          "history_columns":{ "type": "array", "items": { "type": "string" } }
        }
      }
    },
    "pre_aggregation_recommendations": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["name", "type", "grain", "measures"],
        "properties": {
          "name":             { "type": "string" },
          "type":             { "type": "string", "enum": ["materialized_view", "summary_table", "cube"] },
          "grain":            { "type": "string" },
          "measures":         { "type": "array", "items": { "type": "string" } },
          "refresh_schedule": { "type": "string" },
          "rationale":        { "type": "string" }
        }
      }
    },
    "bi_semantic_layer_hints": {
      "type": "object",
      "properties": {
        "tool":              { "type": "string" },
        "hints":             { "type": "array" },
        "incompatibilities": { "type": "array" }
      }
    },
    "query_patterns": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["business_question", "sql"],
        "properties": {
          "business_question": { "type": "string" },
          "sql":               { "type": "string" },
          "expected_grain":    { "type": "string" }
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

- Every business question MUST map to at least one query_pattern in the output; unanswerable questions are flagged and backpropagated to `requirement-analyzer`.
- Fact table measures MUST be additive or semi-additive only — non-additive ratios (e.g., margin %) are prohibited in fact tables and MUST be deferred to the semantic layer.
- Conformed dimensions shared across multiple fact tables MUST have a single canonical definition in `dimension_tables`.
- `data_vault` pattern requires hub + satellite for every entity — no direct attribute storage on hub tables.
- SCD Type 2 dimensions MUST include `effective_from`, `effective_to`, and `is_current` columns.
- When schema has > 50 dimension tables, data vault pattern MUST be recommended — trigger HITL gate.
- dbt model names MUST follow `{layer}_{entity_name}` convention (e.g., `mart_orders_fact`, `dim_customer`).

## Security Considerations

- PII dimension attributes MUST be flagged in dbt model column definitions with `meta: { pii: true }`.
- bi_semantic_layer_hints MUST NOT contain database connection strings or credentials.
- Query patterns MUST use parameterized placeholders for filter values — no hardcoded IDs or dates.

## Token Optimization

- Compress `source_entities.attributes` to a count summary when passing to Steps 4-5 for large entities (> 50 attributes).
- Emit `query_patterns` as structural patterns (dimension + measure references) rather than fully expanded SQL when schema has > 30 tables.
- For `data_vault` pattern: emit hub/satellite skeleton only in initial output; full satellite specs written to state.

## Quality Checklist

- [ ] Every business question has a corresponding query_pattern entry
- [ ] All fact table measures are additive or semi-additive
- [ ] Conformed dimensions have single canonical definitions
- [ ] SCD Type 2 dimensions include effective_from, effective_to, is_current
- [ ] dbt model names follow layer_entity_name convention
- [ ] PII attributes flagged in dbt column metadata
- [ ] Pre-aggregation recommendations provided for high-measure-count queries
- [ ] BI tool incompatibilities documented if bi_tool is specified

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| No business questions provided | Return error: `{"error": "MISSING_BUSINESS_QUESTIONS", "min": 1}` |
| Business question unanswerable from source_entities | Emit gap in feedback with backpropagate to requirement-analyzer |
| > 50 dimension tables in star schema | Trigger HITL gate; recommend data_vault, block schema_design until reviewed |
| Non-additive measure detected in fact table | Move measure to pre_aggregation_recommendations as computed metric, emit warning |
| bi_tool specified but schema incompatible | Document incompatibilities in bi_semantic_layer_hints, emit warning feedback |

## 12. Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Behavior |
|------|---------|---------|----------|
| Data vault recommendation | `schema_design.dimension_tables.length > 50` — data vault pattern strongly recommended | 3600s | Pause after Step 3; present dimension count, pattern comparison table (star vs. data vault), and migration complexity estimate for architect sign-off before fact/dimension design proceeds |
| Schema sign-off | Always — analytical schema defines the semantic contract for all BI consumers | 3600s | Present fact table count, dimension table count, SCD strategy summary, and unanswerable questions for data owner approval |

## 13. Skill Composition

```yaml
composes:
  - skill: analytics-schema-designer
    version: "^1.0.0"
    triggered_by: data-pipeline-architect
    input_map:
      business_questions:        "requirements.analytical_questions"
      source_entities:           "pipeline_architecture.stages[zone=gold]"
      schema_pattern:            "session.analytics_pattern"
      bi_tool:                   "session.bi_tool"
      query_performance_priority: "session.query_priority"
    output_map:
      schema_design:  "state.analytics_schema"
      dbt_models:     "state.dbt_model_definitions"
      scd_strategies: "state.scd_strategies"
    feeds_into:
      - database-architect
      - deployment-strategy
      - data-quality-validator
```

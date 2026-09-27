---
name: data-pipeline-architect
version: 1.0.0
domain: data
description: >
  Use when designing production-grade data pipeline architectures for batch ETL, streaming, or lakehouse patterns.
  Triggers on: "design a data pipeline", "ETL architecture", "streaming pipeline design", "data lakehouse",
  "Kafka pipeline", "Airflow DAG design", "data mesh topology". Do NOT use for single-table queries, simple
  CRUD APIs, or schema-only changes — use database-architect for pure schema work instead.
author: system
---

## Purpose

Design and document production-grade data pipeline architectures that span the full ingestion-to-consumption
lifecycle. The skill selects the correct processing paradigm (batch, streaming, or hybrid), recommends
battle-tested technology stacks (dbt, Spark, Airflow for batch; Kafka, Flink, Kinesis for streaming; Delta Lake,
Apache Iceberg, Apache Hudi for lakehouse), and produces a complete topology specification including stage
definitions, data quality checkpoints, SLA estimates, and infrastructure requirements.

This skill occupies the data architecture layer between high-level `architecture-design` and downstream execution
skills (`deployment-strategy`, `database-architect`). It enforces separation of raw, curated, and serving zones,
documents data mesh ownership boundaries where applicable, and provides Mermaid data-flow diagrams that serve as
the authoritative reference for implementation teams.

Every pipeline design produced by this skill MUST include explicit capacity estimates and SLA commitments so that
`infrastructure-cost-estimator` and `deployment-strategy` can derive accurate resource plans without requiring
re-analysis of the source requirements.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `requirements` | `object` | Yes | Validated requirements from requirement-analyzer (id, type, statement) |
| `data_sources` | `array[object]` | Yes | Source systems — each entry: `{ name, type, volume_gb_day, latency_sla_sec, format }` |
| `processing_model` | `string` | No | `batch` \| `streaming` \| `hybrid` — default: `batch` |
| `target_platform` | `string` | No | `aws` \| `gcp` \| `azure` \| `on-prem` — influences technology selection |
| `context` | `object` | No | Prior skill outputs (architecture, domain constraints, existing pipeline specs) |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["requirements", "data_sources"],
  "properties": {
    "requirements": {
      "type": "object",
      "required": ["items"],
      "properties": {
        "items": {
          "type": "array",
          "minItems": 1,
          "items": {
            "type": "object",
            "required": ["id", "type", "statement"],
            "properties": {
              "id":        { "type": "string" },
              "type":      { "type": "string", "enum": ["F", "NF", "C"] },
              "statement": { "type": "string" }
            }
          }
        }
      }
    },
    "data_sources": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": ["name", "type", "volume_gb_day"],
        "properties": {
          "name":             { "type": "string" },
          "type":             { "type": "string", "enum": ["rdbms", "api", "event_stream", "file", "saas", "iot"] },
          "volume_gb_day":    { "type": "number", "minimum": 0 },
          "latency_sla_sec":  { "type": "number", "minimum": 0 },
          "format":           { "type": "string", "enum": ["csv", "json", "avro", "parquet", "orc", "protobuf", "cdc"] }
        }
      }
    },
    "processing_model": {
      "type": "string",
      "enum": ["batch", "streaming", "hybrid"],
      "default": "batch"
    },
    "target_platform": {
      "type": "string",
      "enum": ["aws", "gcp", "azure", "on-prem"]
    },
    "context": { "type": "object" }
  }
}
```

## Required Context

- Validated requirements from `requirement-analyzer` (SKL-001) — required to map data needs to pipeline stages.
- Architecture module list from `architecture-design` (SKL-002) — for cross-system data flow alignment.
- Optionally: existing pipeline inventory from `context` to avoid topology duplication.
- Optionally: cloud platform constraints from `saas-enterprise-architect` or deployment constraints.

## Execution Logic

```
Step 1 — Parse requirements and identify data needs
  Filter requirements to those implying persistent data movement, transformation, or aggregation.
  Classify each as: ingestion, transformation, aggregation, serving, or orchestration concern.
  Output: data_requirements_map { requirement_id, pipeline_concern, priority }

Step 2 — Classify processing model
  If processing_model provided: use as-is.
  If not provided: infer from data_sources.latency_sla_sec:
    All sources latency_sla_sec >= 300     → batch
    Any source latency_sla_sec < 60        → streaming
    Mixed latency profiles                 → hybrid
  Validate: streaming model requires at least one event_stream or CDC source.
  Output: resolved_processing_model, classification_rationale

Step 3 — Select technology stack
  Apply target_platform to constrain technology options:
    aws:     Kinesis/MSK (streaming), Glue/EMR (batch), S3/Delta Lake (lake), MWAA (orchestration)
    gcp:     Pub/Sub/Dataflow (streaming), BigQuery/Dataproc (batch), GCS/Iceberg (lake), Cloud Composer
    azure:   Event Hubs/Stream Analytics (streaming), Synapse/HDInsight (batch), ADLS/Delta (lake), ADF
    on-prem: Kafka/Flink (streaming), Spark/Hive (batch), MinIO/Iceberg (lake), Airflow
  For batch: evaluate dbt (SQL-first transform) vs. Spark (complex/large-scale).
  For streaming: evaluate Kafka Streams (simple) vs. Flink (complex stateful) vs. Kinesis Data Analytics.
  Output: technology_stack { ingestion, processing, storage, orchestration, serving }

Step 4 — Design pipeline topology
  Define stages: Raw → Bronze (ingestion) → Silver (cleansed) → Gold (aggregated/serving).
  For each stage: define inputs, transformations applied, output schema, SLA, owner.
  For data mesh: assign domain ownership to each data product at the Gold layer.
  Map sources to ingestion connectors (Debezium for CDC, Airbyte for SaaS, custom for API).
  Output: pipeline_stages array, data_product_boundaries

Step 5 — Define data quality checkpoints
  Place quality gates at Bronze→Silver and Silver→Gold transitions.
  For each checkpoint: define schema validation, null checks, deduplication, referential integrity.
  Reference data-quality-validator (SKL-079) for full rule generation — emit feedback to invoke it.
  Output: quality_checkpoint_specs array

Step 6 — Estimate capacity and SLA
  For each stage: compute throughput (GB/day × source count), partition count, parallelism factor.
  Estimate end-to-end latency for nominal and peak loads.
  For streaming: compute consumer lag tolerance and backpressure thresholds.
  Output: sla_estimates { nominal_latency_sec, peak_latency_sec, throughput_gb_day, partition_count }

Step 7 — Generate Mermaid data-flow diagram
  Produce a flowchart LR diagram with nodes for: sources, ingestion, Bronze, Silver, Gold, consumers.
  Annotate edges with protocol and approximate volume.
  Output: data_flow_diagram (Mermaid flowchart string)

Step 8 — Assemble pipeline architecture document
  Combine all outputs into structured pipeline_architecture object.
  Emit feedback to deployment-strategy and database-architect for downstream consumption.
  Output: complete pipeline architecture artifact
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `pipeline_architecture` | `object` | Full topology: stages, components, ownership, SLA per stage |
| `technology_recommendations` | `array[object]` | Stack choices: `{ layer, tool, rationale, alternatives }` |
| `data_flow_diagram` | `string` | Mermaid `flowchart LR` diagram of end-to-end pipeline |
| `sla_estimates` | `object` | `{ nominal_latency_sec, peak_latency_sec, throughput_gb_day, partition_count }` |
| `infrastructure_requirements` | `object` | Compute, storage, network requirements per layer |
| `metrics` | `object` | Execution metrics: tokens_in, tokens_out, duration_ms, items_produced, version |
| `feedback` | `array[object]` | Backpropagate entries; always emits pointer to data-quality-validator |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["pipeline_architecture", "technology_recommendations", "data_flow_diagram",
               "sla_estimates", "infrastructure_requirements", "metrics", "feedback"],
  "properties": {
    "pipeline_architecture": {
      "type": "object",
      "required": ["processing_model", "stages"],
      "properties": {
        "processing_model": { "type": "string", "enum": ["batch", "streaming", "hybrid"] },
        "stages": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["name", "zone", "inputs", "outputs", "owner", "sla_sec"],
            "properties": {
              "name":        { "type": "string" },
              "zone":        { "type": "string", "enum": ["raw", "bronze", "silver", "gold"] },
              "inputs":      { "type": "array", "items": { "type": "string" } },
              "outputs":     { "type": "array", "items": { "type": "string" } },
              "transforms":  { "type": "array", "items": { "type": "string" } },
              "owner":       { "type": "string" },
              "sla_sec":     { "type": "number" }
            }
          }
        },
        "data_products": { "type": "array", "items": { "type": "object" } }
      }
    },
    "technology_recommendations": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["layer", "tool", "rationale"],
        "properties": {
          "layer":        { "type": "string" },
          "tool":         { "type": "string" },
          "rationale":    { "type": "string" },
          "alternatives": { "type": "array", "items": { "type": "string" } }
        }
      }
    },
    "data_flow_diagram": { "type": "string" },
    "sla_estimates": {
      "type": "object",
      "required": ["nominal_latency_sec", "peak_latency_sec", "throughput_gb_day"],
      "properties": {
        "nominal_latency_sec": { "type": "number" },
        "peak_latency_sec":    { "type": "number" },
        "throughput_gb_day":   { "type": "number" },
        "partition_count":     { "type": "integer" }
      }
    },
    "infrastructure_requirements": {
      "type": "object",
      "properties": {
        "compute_vcpu":    { "type": "integer" },
        "memory_gb":       { "type": "integer" },
        "storage_tb":      { "type": "number" },
        "network_gbps":    { "type": "number" }
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

- Every pipeline stage MUST reference at least one source system from `data_sources`.
- `processing_model == "streaming"` requires at least one source with `type: event_stream` or `format: cdc`.
- Technology recommendations MUST include at least one alternative per layer.
- `data_flow_diagram` MUST be valid Mermaid `flowchart LR` syntax — no PlantUML or ASCII art.
- SLA estimates MUST distinguish nominal (p50) from peak (p99) — single value is rejected.
- Data quality checkpoints are MANDATORY at every zone transition (bronze→silver, silver→gold).
- Infrastructure requirements MUST be expressed as minimum viable capacity, not maximum theoretical.
- Emit a `feedback` entry of `type: "info"` referencing `data-quality-validator` for every pipeline produced.

## Security Considerations

- Source system credentials MUST NOT appear in any output field — reference environment variable names only.
- Data containing PII MUST be flagged at the Bronze ingestion stage with an annotation; masking strategy required at Silver.
- Network paths between pipeline stages MUST specify encryption-in-transit (TLS 1.2+) in `infrastructure_requirements`.
- Access control: each pipeline stage owner must be a named team or service account — never a personal identity.

## Token Optimization

- Compress `data_sources` to name + type + volume only when passing to downstream steps.
- For large topologies (> 10 stages), emit `pipeline_architecture.stages` as a summary list and write full detail to state via state-manager.
- Mermaid diagram MUST be <= 2000 characters; truncate to source→bronze→gold skeleton if needed and emit a warning.
- Omit `alternatives` arrays in `technology_recommendations` when `target_platform` uniquely constrains the stack.

## Quality Checklist

- [ ] All data_sources referenced in at least one pipeline stage
- [ ] processing_model is consistent with source latency profiles
- [ ] Every stage has explicit owner, inputs, outputs, and SLA
- [ ] Technology recommendations include rationale and at least one alternative per layer
- [ ] Quality checkpoints defined at all zone transitions
- [ ] Mermaid diagram renders without syntax errors
- [ ] SLA estimates include both nominal and peak values
- [ ] No credentials or connection strings in any output field

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| No data_sources provided | Return error: `{"error": "MISSING_DATA_SOURCES"}` |
| Streaming model but no event_stream/CDC sources | Downgrade to hybrid, emit warning, request source clarification |
| SLA requirement < 1 second with batch model | Flag conflict, recommend streaming redesign, block pipeline output |
| Mermaid diagram exceeds 2000 chars | Emit skeleton diagram (sources → zones → consumers only), log full diagram to state |
| target_platform not recognized | Default to cloud-agnostic open-source stack, emit info feedback |

## 12. Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Behavior |
|------|---------|---------|----------|
| High-throughput streaming review | `processing_model == "streaming"` AND `sla_estimates.throughput_gb_day` implies > 1M events/sec | 7200s | Pause after Step 6; present throughput estimate, partition count, and infrastructure cost to architect for sign-off before diagram generation |
| Architecture sign-off | Always — pipeline topology affects all downstream implementation and cost | 3600s | Present stage count, technology stack, SLA table, and infrastructure requirements for human approval |

## 13. Skill Composition

```yaml
composes:
  - skill: data-pipeline-architect
    version: "^1.0.0"
    triggered_by: architecture-design
    input_map:
      requirements:      "validated_requirements"
      data_sources:      "architecture.data_sources"
      processing_model:  "session.processing_model"
      target_platform:   "session.cloud_platform"
    output_map:
      pipeline_architecture:       "state.pipeline_architecture"
      technology_recommendations:  "state.pipeline_tech_stack"
      data_flow_diagram:           "state.pipeline_diagram"
    feeds_into:
      - deployment-strategy
      - database-architect
      - data-quality-validator
```

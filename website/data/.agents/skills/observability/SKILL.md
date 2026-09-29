---
name: observability
version: 2.0.0
domain: system
description: 'Use when designing pipeline and application observability, generating Prometheus rules, OpenTelemetry configuration, Grafana dashboards, or preserving internal pipeline metrics. Triggers on: "add metrics", "monitor skills", "observability", "Prometheus", "OpenTelemetry", "Grafana", "track execution", "pipeline metrics", "execution monitoring".'
author: ASE-OS
lifecycle_state: active
---

# Observability

**Version:** 2.0.0 | **Last updated:** 2026-09-29

`observability` has two compatible responsibilities:

1. It generates production observability artifacts from architecture and integration contracts: Prometheus alerting rules, an OpenTelemetry collector/SDK configuration, Grafana dashboard JSON, and a canonical metric catalog.
2. It remains the stateful metrics sink for the skill pipeline. Existing orchestrator event collection, `pipeline_metrics` aggregation, health alerts, and canonical per-skill metrics are preserved below as **internal pipeline-metrics mode**.

---

## 1. Skill Header

```yaml
name: observability
version: 2.0.0
description: >
  Generate stack-aware observability artifacts and aggregate the existing
  skill-pipeline metrics stream. No credentials or application payloads are
  collected.
author: ASE-OS
lifecycle_state: active
```

---

## 2. Purpose

The skill turns architecture integration points into portable, reviewable observability specifications. It does not provision infrastructure, contact a telemetry backend, or emit secrets. Generated artifacts are deterministic for the same normalized input and use labels and datasource references rather than environment-specific values.

The internal pipeline-metrics behavior is intentionally retained. The orchestrator may continue to call this skill at `skill.started`, `skill.completed`, `skill.failed`, gate, feedback, and pipeline-end collection points. In that mode, the skill reads and writes the `pipeline_metrics` aggregate through `state-manager`; it does not require application architecture data.

---

## 3. Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `architecture` | `object` | Generation mode | Architecture output containing `modules[]` and optional `integration_points[]` |
| `integration_points` | `array[object]` | Generation mode | API, queue, database, cache, or external-service contracts |
| `tech_stack` | `object` | Generation mode | Runtime/framework/language and telemetry transport preferences |
| `slo_targets` | `object` | No | Availability, error-rate, p95, and p99 targets; defaults are applied when omitted |
| `mode` | `string` | No | `artifact_generation` (default) or `internal_pipeline_metrics` |
| `dry_run` | `boolean` | No | When true, return all previews without writing state or files; default `false` |
| `skill_name` | `string` | Pipeline mode | Existing internal metrics event producer |
| `execution_event` | `string` | Pipeline mode | One of the seven existing pipeline events |
| `metrics_data` | `object` | Pipeline mode | Event-specific metrics payload |
| `session_id` | `string` | Pipeline mode | Active session UUID used for correlation |
| `pipeline_phase` | `string` | No | Current pipeline phase |
| `aggregate_so_far` | `object` | No | Previous `pipeline_metrics` state-manager snapshot |

### Input Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "ObservabilityInput",
  "type": "object",
  "properties": {
    "architecture": {
      "type": "object",
      "properties": {
        "modules": { "type": "array", "items": { "type": "object" } },
        "integration_points": { "type": "array", "items": { "type": "object" } }
      },
      "additionalProperties": true
    },
    "integration_points": { "type": "array", "items": { "$ref": "#/$defs/integration_point" } },
    "tech_stack": {
      "type": "object",
      "properties": {
        "language": { "type": "string" },
        "framework": { "type": "string" },
        "runtime": { "type": "string" },
        "otel_transport": { "type": "string", "enum": ["otlp_grpc", "otlp_http"] }
      },
      "additionalProperties": true
    },
    "slo_targets": {
      "type": "object",
      "properties": {
        "availability": { "type": "number", "exclusiveMinimum": 0, "maximum": 1, "default": 0.999 },
        "error_rate_threshold": { "type": "number", "minimum": 0, "maximum": 1, "default": 0.01 },
        "p95_latency_ms": { "type": "number", "exclusiveMinimum": 0, "default": 500 },
        "p99_latency_ms": { "type": "number", "exclusiveMinimum": 0, "default": 1000 }
      },
      "additionalProperties": false
    },
    "dry_run": { "type": "boolean", "default": false },
    "mode": { "type": "string", "enum": ["artifact_generation", "internal_pipeline_metrics"], "default": "artifact_generation" },
    "skill_name": { "type": "string", "minLength": 1 },
    "execution_event": {
      "type": "string",
      "enum": ["skill.started", "skill.completed", "skill.failed", "gate.passed", "gate.blocked", "feedback.triggered", "pipeline.ended"]
    },
    "metrics_data": { "type": "object" },
    "session_id": { "type": "string", "format": "uuid" },
    "pipeline_phase": { "type": "string" },
    "aggregate_so_far": { "type": "object" }
  },
  "oneOf": [
    { "required": ["architecture", "integration_points", "tech_stack"] },
    { "required": ["skill_name", "execution_event", "metrics_data", "session_id"] }
  ],
  "$defs": {
    "integration_point": {
      "type": "object",
      "required": ["type"],
      "properties": {
        "id": { "type": "string" },
        "name": { "type": "string" },
        "type": { "type": "string", "enum": ["rest_api", "grpc", "graphql", "message_queue", "database", "cache", "external_service"] },
        "module": { "type": "string" },
        "protocol": { "type": "string" },
        "service": { "type": "string" },
        "operations": { "type": "array", "items": { "type": "string" } }
      },
      "additionalProperties": true
    }
  }
}
```

Defaults for `slo_targets` are availability `0.999`, error rate `0.01`, p95 `500ms`, and p99 `1000ms`. A pipeline-mode invocation is valid through the second `oneOf` branch and remains backward-compatible with the pre-2.0 event contract.

### Internal Event Payload Schemas

When `execution_event` is supplied, validate `metrics_data` against the matching schema before updating `pipeline_metrics`:

```json
{
  "skill.started": {
    "type": "object",
    "required": ["timestamp", "tokens_in"],
    "properties": {
      "timestamp": { "type": "string", "format": "date-time" },
      "tokens_in": { "type": "integer", "minimum": 0 }
    },
    "additionalProperties": true
  },
  "skill.completed": {
    "type": "object",
    "required": ["timestamp", "tokens_in", "tokens_out", "duration_ms", "items_produced", "version"],
    "properties": {
      "timestamp": { "type": "string", "format": "date-time" },
      "tokens_in": { "type": "integer", "minimum": 0 },
      "tokens_out": { "type": "integer", "minimum": 0 },
      "duration_ms": { "type": "integer", "minimum": 0 },
      "items_produced": { "type": "integer", "minimum": 0 },
      "version": { "type": "string" },
      "retries": { "type": "integer", "minimum": 0, "default": 0 },
      "validation_passed": { "type": "boolean" }
    },
    "additionalProperties": true
  },
  "skill.failed": {
    "type": "object",
    "required": ["timestamp", "error_type", "retry_count"],
    "properties": {
      "timestamp": { "type": "string", "format": "date-time" },
      "error_type": { "type": "string" },
      "retry_count": { "type": "integer", "minimum": 0 },
      "tokens_in": { "type": "integer", "minimum": 0 }
    },
    "additionalProperties": true
  },
  "gate.passed": {
    "type": "object",
    "required": ["gate_type", "wait_duration_s"],
    "properties": {
      "gate_type": { "type": "string" },
      "wait_duration_s": { "type": "integer", "minimum": 0 },
      "auto_continued": { "type": "boolean" }
    },
    "additionalProperties": true
  },
  "gate.blocked": {
    "type": "object",
    "required": ["gate_type", "block_reason"],
    "properties": {
      "gate_type": { "type": "string" },
      "block_reason": { "type": "string" },
      "duration_s": { "type": "integer", "minimum": 0 }
    },
    "additionalProperties": true
  },
  "feedback.triggered": {
    "type": "object",
    "required": ["from_skill", "target_skill", "reason"],
    "properties": {
      "from_skill": { "type": "string" },
      "target_skill": { "type": "string" },
      "reason": { "type": "string" },
      "loop_number": { "type": "integer", "minimum": 0 }
    },
    "additionalProperties": true
  },
  "pipeline.ended": {
    "type": "object",
    "required": ["final_status"],
    "properties": {
      "final_status": { "type": "string", "enum": ["success", "partial", "failed", "halted"] },
      "total_skills": { "type": "integer", "minimum": 0 }
    },
    "additionalProperties": true
  }
}
```

---

## 4. Required Context

Generation mode requires:

- `architecture.modules[]` and/or `architecture.integration_points[]` from `architecture-design`.
- Explicit `integration_points[]` from the architecture or API/event/database contracts. Explicit input wins when both sources are present.
- `tech_stack` with at least a language or framework. Unknown stacks use the portable OTLP baseline and emit a warning.
- Optional SLO targets from the requirements or SLO/SLA design stage.

Internal pipeline-metrics mode requires:

- The active `session_context.session_id` from `state-manager`.
- `aggregate_so_far` loaded from `state-manager` key `pipeline_metrics` before each event.
- A valid existing event payload. The skill never reads session files or telemetry backends directly.

---

## 5. Execution Logic

### Step 1 — Select mode and validate input

1. If `execution_event` is present, select internal pipeline-metrics mode; otherwise select artifact-generation mode.
2. Validate the selected branch against the input schema and event-specific schema.
3. Normalize SLO defaults, stack aliases, surface IDs, and labels. Reject credentials, URLs containing credentials, code bodies, and path traversal in session identifiers.

### Step 2 — Extract observable surfaces

Read `integration_points[]` and the architecture's integration points. Deduplicate by explicit `id`, then by `(module, type, name)`. For each supported type emit:

| Surface type | Standard signals |
|--------------|------------------|
| `rest_api`, `grpc`, `graphql`, `external_service` | request rate, error rate, latency histogram, availability |
| `message_queue` | publish rate, consume rate, consumer lag, delivery failures |
| `database` | query rate, query errors, query latency, connection-pool saturation |
| `cache` | operation rate, errors, latency, hit ratio |

Each surface has `{id, name, type, module, protocol, operations, labels}`. Unsupported or incomplete points are retained with `status: "unclassified"` and a warning; they are not silently dropped.

### Step 3 — Generate metric definitions

Generate one definition per signal, using stable names and a bounded label set. API metrics use `http_requests_total`, `http_request_duration_seconds`, `http_request_errors_total`, and `service_up`; queue, database, and cache names use the corresponding signal table above. Every definition contains:

```json
{
  "name": "http_request_duration_seconds",
  "type": "histogram",
  "unit": "seconds",
  "surface_id": "orders-api",
  "labels": ["service", "environment", "route", "method", "status_code"],
  "description": "Request duration for the observable surface"
}
```

Reject duplicate metric names with incompatible types. Keep label values low-cardinality; route templates, not raw URLs, are required.

### Step 4 — Generate Prometheus alerting rules YAML

Produce `prometheus_rules_yaml` as valid YAML with a stable `groups` root. Generate at least one alert for every API-like integration point (`rest_api`, `grpc`, `graphql`, and `external_service`), plus SLO alerts for error rate, p95 latency, and availability. Thresholds are derived from `slo_targets`; alert names are sanitized stable identifiers, never user input as executable YAML.

The generated rules use the canonical labels `service` and `environment`, document the metric assumptions in annotations, and do not embed secrets or environment-specific hostnames.

### Step 5 — Generate OpenTelemetry configuration

Produce `otel_config` as a JSON object with `receivers`, `processors`, `exporters`, and `service.pipelines` for traces, metrics, and logs. Use OTLP with an endpoint placeholder such as `${OTEL_EXPORTER_OTLP_ENDPOINT}`; never replace it with a credential or hardcoded deployment URL. Add a `sdk_setup` object selected from:

| Stack | SDK setup |
|-------|-----------|
| Node.js | `@opentelemetry/sdk-node` with OTLP exporter |
| Python | `opentelemetry-sdk` with OTLP exporter |
| Go | `go.opentelemetry.io/otel` with OTLP gRPC exporter |
| Java | `opentelemetry-java` with auto-instrumentation agent |

Unknown stacks receive the language-neutral collector configuration and an `info` feedback entry requesting a stack-specific review.

### Step 6 — Generate Grafana dashboard JSON

Produce valid `grafana_dashboard_json` with datasource `prometheus`, variables `$service` and `$environment`, and four panels in a 2×2 grid: `error_rate`, `p95_latency`, `request_rate`, and `availability`. Queries are annotated placeholders using the canonical metric names; the generator must not invent a user's label schema. Panel descriptions state which labels or recording rules must be adapted.

### Step 7 — Preserve internal pipeline-metrics behavior

For pipeline mode, execute the existing event flow without generating application artifacts:

1. Validate `metrics_data` against the event schema below.
2. Emit a structured `log_entry` with timestamp, session, event, skill, phase, status, and safe metadata.
3. Load or initialize the aggregate and update `pipeline_metrics` after every event.
4. Recompute alerts and `health_status` (`healthy`, `degraded`, or `critical`).
5. Emit feedback for critical health or unavailable state-manager, but never halt the pipeline solely because observability is unavailable.
6. Return `prometheus_rules_yaml: null`, `otel_config: null`, and
   `grafana_dashboard_json: null` in this mode; the preserved
   `metrics_report`, `health_status`, and `alerts` fields remain populated.

The seven preserved event payloads are:

```json
{
  "skill.started": { "required": ["timestamp", "tokens_in"] },
  "skill.completed": { "required": ["timestamp", "tokens_in", "tokens_out", "duration_ms", "items_produced", "version"] },
  "skill.failed": { "required": ["timestamp", "error_type", "retry_count"] },
  "gate.passed": { "required": ["gate_type", "wait_duration_s"] },
  "gate.blocked": { "required": ["gate_type", "block_reason"] },
  "feedback.triggered": { "required": ["from_skill", "target_skill", "reason"] },
  "pipeline.ended": { "required": ["final_status"] }
}
```

The aggregate retains `total_tokens_in`, `total_tokens_out`, `total_duration_ms`, `skills_executed`, `skills_failed`, `validation_errors`, `feedback_loops`, `gates_passed`, `gates_blocked`, `retries`, `compression_savings_tokens`, `final_status`, and `per_skill[]`. Existing thresholds remain: success rate below 95%, a skill over 120,000ms, validation failures over 5%, more than two feedback loops, token utilization over 80%, more than two blocked gates, more than three retries for one skill, or session duration over 1,800,000ms produce alerts.

### Step 8 — Validate, persist, and assemble

Validate YAML syntax conceptually, JSON shape, required panels, API alert coverage, metric uniqueness, and output schema. In artifact mode, write generated artifacts and aggregate state only when `dry_run` is false. In pipeline mode, `dry_run` suppresses the state-manager write but still returns the projected aggregate. Return previews in both modes.

---

## 6. Outputs

| Field | Type | Description |
|-------|------|-------------|
| `prometheus_rules_yaml` | `string` | Valid Prometheus rule YAML; one or more alerts per API integration point |
| `otel_config` | `object` | JSON-serializable collector and SDK setup |
| `grafana_dashboard_json` | `object` | JSON-serializable dashboard with four required SLI panels |
| `observable_surfaces` | `array[object]` | Normalized surfaces discovered from architecture and integration points |
| `metrics` | `object` | Metric catalog plus the canonical per-skill execution metrics fields |
| `metrics_report` | `object` | Preserved pipeline aggregate in internal pipeline-metrics mode |
| `health_status` | `string` | Pipeline mode status: `healthy`, `degraded`, or `critical` |
| `alerts` | `array[object]` | Pipeline threshold alerts or generation warnings |
| `feedback` | `array[object]` | `backpropagate`, `info`, or `warning` entries |

### Output Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "ObservabilityOutput",
  "type": "object",
  "required": ["observable_surfaces", "metrics", "feedback"],
  "properties": {
    "prometheus_rules_yaml": { "type": ["string", "null"] },
    "otel_config": {
      "type": ["object", "null"],
      "required": ["receivers", "processors", "exporters", "service", "sdk_setup"],
      "properties": {
        "receivers": { "type": "object" },
        "processors": { "type": "object" },
        "exporters": { "type": "object" },
        "service": { "type": "object" },
        "sdk_setup": { "type": "object" }
      }
    },
    "grafana_dashboard_json": {
      "type": ["object", "null"],
      "required": ["title", "schemaVersion", "templating", "panels"],
      "properties": {
        "title": { "type": "string" },
        "schemaVersion": { "type": "integer" },
        "templating": { "type": "object" },
        "panels": {
          "type": "array",
          "minItems": 4,
          "items": { "type": "object" }
        }
      }
    },
    "observable_surfaces": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "name", "type", "status"],
        "properties": {
          "id": { "type": "string" },
          "name": { "type": "string" },
          "type": { "type": "string" },
          "module": { "type": "string" },
          "protocol": { "type": "string" },
          "status": { "type": "string", "enum": ["classified", "unclassified"] },
          "labels": { "type": "array", "items": { "type": "string" } }
        }
      }
    },
    "metrics": {
      "type": "object",
      "required": ["definitions", "tokens_in", "tokens_out", "duration_ms", "items_produced", "version"],
      "properties": {
        "definitions": { "type": "array", "items": { "type": "object" } },
        "tokens_in": { "type": "integer", "minimum": 0 },
        "tokens_out": { "type": "integer", "minimum": 0 },
        "duration_ms": { "type": "integer", "minimum": 0 },
        "items_produced": { "type": "integer", "minimum": 0 },
        "version": { "type": "string" }
      }
    },
    "metrics_report": { "type": ["object", "null"] },
    "health_status": { "type": ["string", "null"], "enum": ["healthy", "degraded", "critical", null] },
    "alerts": { "type": "array", "items": { "type": "object" } },
    "feedback": {
      "type": "array",
      "items": {
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
}
```

`dry_run: true` returns the complete output, including all artifact previews, but performs no state-manager write and emits an `info` feedback entry identifying the preview.

---

## 7. Rules & Constraints

- Every API-like integration point must have at least one Prometheus alert.
- The dashboard must contain `error_rate`, `p95_latency`, `request_rate`, and `availability` panels.
- Metric names and labels are stable, bounded, and free of request-specific identifiers.
- `metrics` always includes the canonical `tokens_in`, `tokens_out`, `duration_ms`, `items_produced`, and `version` fields, even when its `definitions` list is empty in pipeline mode.
- Pipeline-mode aggregates are updated after every event, not batched. The `per_skill` detail is capped at 50 entries; older entries are rolled up.
- Unknown events are rejected without mutating the aggregate. A generation warning never prevents a valid partial catalog from being returned.
- Observability is read-only with respect to application code and infrastructure. It only writes its declared generated artifacts and the `pipeline_metrics` state key.

---

## 8. Security Considerations

- Never collect or emit credentials, tokens, user payloads, source code, PII, or raw URLs.
- Use `${OTEL_EXPORTER_OTLP_ENDPOINT}` and similar environment references instead of hardcoded endpoints or secrets.
- Reject session IDs containing `/`, `\\`, `..`, or other path traversal patterns.
- Use route templates and bounded labels; never use user IDs, query strings, or unbounded exception text as metric labels.
- Sanitize alert names and YAML strings before rendering. Do not evaluate templates as code.
- Structured log details include field names and error types only, never full skill output.

---

## 9. Token Optimization

- Pass module and integration signatures, not full source files or payloads.
- Deduplicate surfaces and metric definitions before rendering artifacts.
- Keep Prometheus annotations and dashboard descriptions concise while preserving metric assumptions.
- Keep pipeline `aggregate_so_far` as the source of truth instead of recomputing historical events.
- Return full artifact content for dry runs; in persisted runs large dashboard content may be stored by reference while the schema and summary remain in the result.

---

## 10. Quality Checklist

- [ ] Frontmatter and output version are `2.0.0`.
- [ ] Input schema accepts architecture, integration points, tech stack, SLO targets, and dry-run mode.
- [ ] All supported surface types are classified or explicitly reported as unclassified.
- [ ] Metric definitions are unique and use bounded labels.
- [ ] Every API integration point has at least one alert.
- [ ] Prometheus output has a `groups` root and is valid YAML.
- [ ] OTel output contains traces, metrics, and logs pipelines with stack-aware SDK setup.
- [ ] Grafana output is valid JSON with four required panels and two variables.
- [ ] Internal seven-event pipeline metrics behavior and `pipeline_metrics` aggregate are preserved.
- [ ] Dry runs produce previews without writes.
- [ ] `metrics` conforms to the canonical per-skill metrics shape.
- [ ] Feedback entries use the standard feedback schema.

---

## 11. Failure Scenarios

| Condition | Fallback behavior |
|-----------|-------------------|
| Architecture or integration points missing in generation mode | Return a schema error and `backpropagate` feedback to `architecture-design`; do not write artifacts |
| Unsupported integration type | Return the surface as `unclassified`, skip type-specific rules, and emit a warning |
| Unknown tech stack | Use portable OTLP configuration and emit an informational stack-review feedback |
| Invalid SLO target | Reject the invalid field, use the documented default only when the field is absent, and emit a warning |
| Duplicate metric name with incompatible type | Return `validation_result` failure and do not persist artifacts |
| State-manager unavailable in pipeline mode | Use a fresh in-memory aggregate, return `degraded`, and emit warning feedback; never halt the pipeline |
| Invalid session or event payload | Reject the event and leave the existing aggregate unchanged |
| Dashboard or YAML validation failure | Return errors and previews only; do not persist invalid artifacts |

---

## 12. Human-in-the-Loop Gates

This skill has no mandatory pause in internal pipeline-metrics mode. Artifact generation may surface review feedback but does not approve deployment or provision telemetry.

| Gate | Trigger | Behavior |
|------|---------|----------|
| Stack review | Unknown or mixed runtime/framework | Emit `info` feedback; human may select a stack-specific SDK setup |
| High-cardinality review | Proposed labels contain unbounded values | Emit `warning` feedback and require correction before production adoption |
| Artifact validation | Invalid YAML/JSON or missing API alert | Block artifact persistence; the caller must repair the input |
| Critical pipeline health | Existing aggregate has a critical alert | Emit warning feedback to the orchestrator; the orchestrator decides whether to show it at its normal HITL gate |

---

## 13. Skill Composition

Artifact-generation invocation:

```yaml
composes:
  - skill: observability
    version: "^2.0.0"
    input_map:
      architecture: "state.architecture"
      integration_points: "state.architecture.integration_points"
      tech_stack: "session.tech_stack"
      slo_targets: "state.slo_targets"
      dry_run: "request.dry_run"
    output_map:
      prometheus_rules_yaml: "state.prometheus_rules_yaml"
      otel_config: "state.otel_config"
      grafana_dashboard_json: "state.grafana_dashboard_json"
      observable_surfaces: "state.observable_surfaces"
      metrics: "state.observability_metrics"
      feedback: "state.feedback"
```

Existing orchestrator collection points remain supported:

```yaml
pipeline_metrics_hooks:
  aggregate_key: pipeline_metrics
  events:
    - skill.started
    - skill.completed
    - skill.failed
    - gate.passed
    - gate.blocked
    - feedback.triggered
    - pipeline.ended
  input_map:
    skill_name: "active_skill.name"
    execution_event: "event.name"
    metrics_data: "event.payload"
    session_id: "session_context.session_id"
    pipeline_phase: "current_phase"
    aggregate_so_far: "state_manager.read(pipeline_metrics)"
  output_map:
    metrics_report: "state.pipeline_metrics"
    health_status: "state.pipeline_health"
    alerts: "state.pipeline_alerts"
    feedback: "state.feedback"
```

The pipeline hook is passive and never replaces the orchestrator's gate decisions. `schema-validator` validates both branches; `state-manager` owns the aggregate; `orchestrator` owns invocation timing and any deployment decision.

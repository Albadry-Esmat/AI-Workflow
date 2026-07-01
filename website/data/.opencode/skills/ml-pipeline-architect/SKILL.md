---
name: ml-pipeline-architect
version: 1.0.0
domain: data
description: >
  Use when designing end-to-end MLOps pipelines covering feature engineering, training infrastructure,
  model registry, serving, and drift detection for production ML systems. Triggers on: "MLOps pipeline",
  "feature store design", "model serving architecture", "ML drift detection", "training infrastructure".
  Do NOT use for exploratory data analysis, Jupyter notebook workflows, or data pipelines that do not
  involve trained models — use data-pipeline-architect for pure data movement instead.
author: system
---

## Purpose

Design complete, production-grade MLOps pipelines that take a machine learning problem specification
from raw feature sources to a monitored, continuously-retrained model in production. The skill covers
every phase of the ML lifecycle: feature engineering and feature store design (Feast, Tecton, Hopsworks),
training infrastructure (distributed training with Horovod/DeepSpeed, hyperparameter tuning with Optuna/Ray
Tune, experiment tracking with MLflow/W&B), model registry (versioning, lineage, approval gates), inference
serving (real-time with Triton/TorchServe/vLLM, batch with Spark ML), and production monitoring (statistical
drift detection, retraining triggers, A/B model routing).

This skill enforces the principle that ML systems are software systems: every component it designs includes
CI/CD integration points, reproducibility requirements (pinned seeds, environment locks, data versioning),
and explicit SLOs. The output feeds directly into `deployment-strategy` for infrastructure provisioning
and into `observability` for metrics instrumentation.

The skill is deeply specialized for production ML concerns and deliberately avoids general data engineering
decisions — those belong to `data-pipeline-architect`. Its boundary starts at the feature store ingestion
interface and ends at the model serving layer's external contract.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `ml_problem` | `object` | Yes | Problem spec: `{ type, target_metric, latency_requirement_ms, training_data_size_gb }` |
| `feature_sources` | `array[object]` | Yes | Feature data sources: `{ name, type, update_frequency, entity_key }` |
| `model_complexity` | `string` | No | `simple` \| `moderate` \| `complex` — influences training infra sizing |
| `serving_requirements` | `object` | No | `{ qps, latency_p99_ms, availability_slo, deployment_target }` |
| `context` | `object` | No | Prior outputs from data-pipeline-architect, architecture-design, or requirement-analyzer |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["ml_problem", "feature_sources"],
  "properties": {
    "ml_problem": {
      "type": "object",
      "required": ["type", "target_metric"],
      "properties": {
        "type": {
          "type": "string",
          "enum": ["classification", "regression", "ranking", "generation", "clustering", "anomaly_detection"]
        },
        "target_metric":             { "type": "string" },
        "latency_requirement_ms":    { "type": "number", "minimum": 0 },
        "training_data_size_gb":     { "type": "number", "minimum": 0 },
        "retraining_frequency":      { "type": "string", "enum": ["hourly", "daily", "weekly", "on_drift", "on_demand"] },
        "interpretability_required": { "type": "boolean" }
      }
    },
    "feature_sources": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": ["name", "type", "entity_key"],
        "properties": {
          "name":             { "type": "string" },
          "type":             { "type": "string", "enum": ["batch", "streaming", "request_time"] },
          "update_frequency": { "type": "string" },
          "entity_key":       { "type": "string" },
          "feature_count":    { "type": "integer" }
        }
      }
    },
    "model_complexity": {
      "type": "string",
      "enum": ["simple", "moderate", "complex"],
      "default": "moderate"
    },
    "serving_requirements": {
      "type": "object",
      "properties": {
        "qps":                { "type": "integer", "minimum": 1 },
        "latency_p99_ms":     { "type": "number", "minimum": 0 },
        "availability_slo":   { "type": "number", "minimum": 0.9, "maximum": 1.0 },
        "deployment_target":  { "type": "string", "enum": ["kubernetes", "lambda", "sagemaker", "vertex_ai", "azure_ml", "bare_metal"] }
      }
    },
    "context": { "type": "object" }
  }
}
```

## Required Context

- `ml_problem.type` and `target_metric` are mandatory — design cannot proceed without them.
- `feature_sources` with entity keys — required to design feature store join semantics.
- Optionally: `architecture.modules` from `architecture-design` for system integration alignment.
- Optionally: `data_pipeline_architecture` from `data-pipeline-architect` for upstream feature feed details.
- Optionally: serving infrastructure constraints from `deployment-strategy` context.

## Execution Logic

```
Step 1 — Analyze ML problem type
  Classify problem into MLOps complexity tier:
    simple:   tabular data, < 10M rows, sklearn/XGBoost, no GPU required
    moderate: tabular/NLP/CV, 10M-1B rows, LightGBM/PyTorch, GPU optional
    complex:  LLM/multimodal, > 1B rows or > 1B params, distributed GPU mandatory
  Override tier with model_complexity input if provided.
  Determine retraining strategy: scheduled (batch) vs. triggered (drift-based) vs. continuous.
  Output: problem_classification { tier, framework_class, gpu_required, distributed_required }

Step 2 — Design feature engineering layer
  For each feature_source: classify as batch, streaming, or on-demand (request-time).
  Select feature store:
    batch-only sources:     Feast offline store (Parquet/BigQuery/Redshift)
    streaming sources:      Feast online store (Redis/Cassandra) + offline sink
    high-throughput online: Tecton or Hopsworks with precomputed embeddings
    simple/moderate tier:   in-pipeline feature computation acceptable (no dedicated store)
  Define feature groups: entity, feature_name, dtype, transformation, TTL.
  Define point-in-time correct join strategy to prevent training-serving skew.
  Output: feature_store_schema { feature_groups, entity_keys, join_strategy, store_type }

Step 3 — Select training infrastructure
  Map tier to training stack:
    simple:   single-node CPU (sklearn pipeline, pandas), no distributed framework
    moderate: single-GPU or 2-4 GPU node (PyTorch/TF, DDP), spot instance eligible
    complex:  multi-node GPU cluster (Horovod/DeepSpeed/FSDP), 8-512 GPUs, checkpointing required
  Select HPO framework: Optuna (small), Ray Tune (distributed), Vertex AI HPT (GCP-managed).
  Select experiment tracker: MLflow (self-hosted), W&B (SaaS), Neptune (SaaS).
  Define training pipeline stages: data loading → feature join → train/val split → training loop
    → evaluation → metric logging → model artifact export.
  Output: training_config { framework, distributed_strategy, hpo_tool, experiment_tracker,
                            compute_spec, checkpoint_strategy }

Step 4 — Define experiment tracking and reproducibility
  Require: fixed random seeds, pinned dependency lockfile (pip/conda), data version hash.
  Define experiment metadata schema: run_id, dataset_version, hyperparams, metrics, artifact_uri.
  Define promotion criteria: model promotes to registry when target_metric improves by >= 1%
    on held-out evaluation set AND shadow-mode latency SLO passes.
  Output: experiment_tracking_config { tracker, metadata_schema, promotion_criteria }

Step 5 — Design model registry
  Registry entries: model_name, version (semver), stage (staging/production/archived),
    artifact_uri, feature_store_version, dataset_version, training_run_id, approval_status.
  Define lineage: training_data → feature_version → training_run → model_version → deployment.
  Define approval gate: staging → production requires human sign-off (or automated gate if
    canary error rate < 0.1% for 30 min).
  Output: model_registry_config { registry_type, version_schema, lineage_graph, promotion_policy }

Step 6 — Architect serving layer
  Select serving framework based on ml_problem.type and serving_requirements.latency_p99_ms:
    latency_p99_ms < 10ms:     MUST flag for HITL gate — requires expert review
    10ms - 50ms, real-time:    Triton Inference Server (ONNX/TensorRT optimization required)
    50ms - 200ms, real-time:   TorchServe or FastAPI + model binary
    > 200ms or async:          Batch scoring via Spark ML or Ray Batch
    generation models:         vLLM (text), Diffusers API (image)
  Define autoscaling policy: HPA on request queue depth (streaming) or RPS (HTTP).
  Define canary deployment: route 5% traffic to new model version, monitor for 30 min.
  Output: serving_architecture { framework, optimization, deployment_pattern, autoscaling, canary_config }

Step 7 — Define monitoring and drift detection
  Statistical drift detectors (apply based on ml_problem.type):
    input drift:   PSI (Population Stability Index) for categorical, KS-test for continuous
    concept drift: monitor target metric degradation on labeled production sample
    output drift:  distribution shift on prediction scores (Jensen-Shannon divergence)
  Define retraining triggers:
    PSI > 0.25 on any top-10 feature → trigger retraining
    Target metric degrades > 5% vs. champion baseline → trigger retraining
    Scheduled: every N days per ml_problem.retraining_frequency
  Define monitoring cadence: hourly stats aggregation, daily drift report, weekly model health review.
  Output: monitoring_config { drift_detectors, retraining_triggers, monitoring_schedule, alert_rules }

Step 8 — Produce infrastructure cost estimate
  Estimate: training compute (GPU-hours × hourly_rate), feature store storage (GB × rate),
    serving compute (pod_count × CPU/GPU spec × hourly_rate × utilization), monitoring overhead.
  Provide breakdown by phase: training, serving, monitoring, storage.
  Output: estimated_infra_cost { training_usd_per_run, serving_usd_per_month,
                                  monitoring_usd_per_month, storage_usd_per_month, total_usd_per_month }
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `pipeline_design` | `object` | Full pipeline phases, components, and tool selections per phase |
| `feature_store_schema` | `object` | Feature groups, entity keys, join strategy, store type |
| `training_config` | `object` | Framework, distributed strategy, HPO tool, compute spec, checkpoint strategy |
| `serving_architecture` | `object` | Serving framework, optimization, deployment pattern, autoscaling, canary config |
| `monitoring_config` | `object` | Drift detectors, retraining triggers, monitoring schedule, alert rules |
| `estimated_infra_cost` | `object` | Cost breakdown by phase in USD |
| `metrics` | `object` | Execution metrics: tokens_in, tokens_out, duration_ms, items_produced, version |
| `feedback` | `array[object]` | Backpropagate entries; routes serving constraints to deployment-strategy |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["pipeline_design", "feature_store_schema", "training_config",
               "serving_architecture", "monitoring_config", "estimated_infra_cost", "metrics", "feedback"],
  "properties": {
    "pipeline_design": {
      "type": "object",
      "required": ["tier", "phases"],
      "properties": {
        "tier":   { "type": "string", "enum": ["simple", "moderate", "complex"] },
        "phases": { "type": "array", "items": { "type": "object", "required": ["name", "tools", "inputs", "outputs"] } }
      }
    },
    "feature_store_schema": {
      "type": "object",
      "required": ["feature_groups", "entity_keys", "join_strategy"],
      "properties": {
        "feature_groups": { "type": "array" },
        "entity_keys":    { "type": "array", "items": { "type": "string" } },
        "join_strategy":  { "type": "string", "enum": ["point_in_time", "latest", "as_of"] },
        "store_type":     { "type": "string" }
      }
    },
    "training_config": {
      "type": "object",
      "required": ["framework", "experiment_tracker", "compute_spec"],
      "properties": {
        "framework":             { "type": "string" },
        "distributed_strategy":  { "type": "string" },
        "hpo_tool":              { "type": "string" },
        "experiment_tracker":    { "type": "string" },
        "compute_spec":          { "type": "object" },
        "checkpoint_strategy":   { "type": "string" }
      }
    },
    "serving_architecture": {
      "type": "object",
      "required": ["framework", "deployment_pattern"],
      "properties": {
        "framework":          { "type": "string" },
        "optimization":       { "type": "string" },
        "deployment_pattern": { "type": "string", "enum": ["real_time", "batch", "async", "streaming"] },
        "autoscaling":        { "type": "object" },
        "canary_config":      { "type": "object" }
      }
    },
    "monitoring_config": {
      "type": "object",
      "required": ["drift_detectors", "retraining_triggers"],
      "properties": {
        "drift_detectors":     { "type": "array" },
        "retraining_triggers": { "type": "array" },
        "monitoring_schedule": { "type": "string" },
        "alert_rules":         { "type": "array" }
      }
    },
    "estimated_infra_cost": {
      "type": "object",
      "required": ["total_usd_per_month"],
      "properties": {
        "training_usd_per_run":      { "type": "number" },
        "serving_usd_per_month":     { "type": "number" },
        "monitoring_usd_per_month":  { "type": "number" },
        "storage_usd_per_month":     { "type": "number" },
        "total_usd_per_month":       { "type": "number" }
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

- Every feature_source MUST be assigned to a feature group in the feature_store_schema.
- Point-in-time correct join strategy is MANDATORY for training datasets — `join_strategy: "latest"` is only permitted for real-time request-time features.
- `serving_requirements.latency_p99_ms < 10` triggers a mandatory HITL gate — no serving architecture is emitted until human approval.
- Models with > 100M parameters MUST use a distributed training strategy — single-node spec is rejected.
- `monitoring_config.retraining_triggers` MUST include at least one drift-based trigger and one scheduled trigger.
- Cost estimates MUST include all four phases (training, serving, monitoring, storage) — partial estimates are rejected.
- Canary deployment config is MANDATORY for all production serving architectures.

## Security Considerations

- Model artifacts MUST be stored in a versioned, access-controlled registry — no plaintext file shares.
- Feature store access MUST require service account authentication; personal credentials are not permitted.
- Training data MUST reference a data version hash — raw mutable paths are flagged as a reproducibility violation.
- Serving endpoints MUST require authentication (API key, mTLS, or IAM) — unauthenticated model endpoints are a critical security violation.

## Token Optimization

- Compress `feature_sources` to name + type + entity_key when passing to Steps 3-6 (drop update_frequency and feature_count).
- For `complex` tier pipelines, emit `training_config.compute_spec` as a named profile reference (e.g., `"8x A100 node"`) rather than full spec object.
- Cost estimates are expressed as ranges (min-max) for uncertain variables rather than point estimates to avoid re-invocation.

## Quality Checklist

- [ ] All feature_sources assigned to feature groups with entity keys
- [ ] Point-in-time join strategy enforced for training features
- [ ] Training tier correctly mapped to framework and compute spec
- [ ] Serving framework selected with latency justification
- [ ] Canary deployment configured for all production serving architectures
- [ ] At least two retraining triggers defined (drift + scheduled)
- [ ] Cost estimate covers all four phases
- [ ] Models > 100M params use distributed training strategy

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| `ml_problem.type` not provided | Return error: `{"error": "MISSING_ML_PROBLEM_TYPE"}` |
| No feature_sources provided | Return error: `{"error": "MISSING_FEATURE_SOURCES", "min": 1}` |
| Serving latency < 10ms | Trigger HITL gate; emit partial serving_architecture with `status: "PENDING_REVIEW"` |
| Model > 100M params with simple tier | Upgrade tier to complex, emit warning, flag for HITL review |
| training_data_size_gb > 10000 with single-node config | Override to distributed strategy, emit info feedback |

## 12. Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Behavior |
|------|---------|---------|----------|
| Ultra-low latency serving | `serving_requirements.latency_p99_ms < 10` | 7200s | Pause after Step 6; present serving framework options, optimization path (TensorRT/quantization), and estimated achievable latency for expert architect review before serving_architecture is finalized |
| Large model training | `model_complexity == "complex"` AND inferred parameter count > 100M | 7200s | Pause after Step 3; present distributed training config, GPU cluster spec, and estimated cost per training run for budget owner approval |

## 13. Skill Composition

```yaml
composes:
  - skill: ml-pipeline-architect
    version: "^1.0.0"
    triggered_by: architecture-design
    input_map:
      ml_problem:           "requirements.ml_constraints"
      feature_sources:      "data_pipeline_architecture.stages[zone=gold]"
      model_complexity:     "session.model_complexity"
      serving_requirements: "architecture.non_functional_requirements"
    output_map:
      pipeline_design:      "state.ml_pipeline_design"
      feature_store_schema: "state.feature_store_schema"
      serving_architecture: "state.ml_serving_architecture"
      monitoring_config:    "state.ml_monitoring_config"
    feeds_into:
      - deployment-strategy
      - observability
      - data-quality-validator
```

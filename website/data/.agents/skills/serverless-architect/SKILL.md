---
name: serverless-architect
version: 1.0.0
domain: cloud
description: >
  Use when designing serverless or FaaS-based architectures, optimizing cold start performance, modelling event-driven topologies, or selecting function orchestration strategies. Triggers on: "serverless design", "Lambda architecture", "FaaS", "cold start optimization", "event-driven functions", "Step Functions design". Do NOT use for container-based or VM-based architectures — use container-orchestration-architect for those.
author: system
---

## Purpose

Design complete serverless and Function-as-a-Service (FaaS) architectures across all major providers: AWS Lambda (with API Gateway, EventBridge, SQS/SNS, DynamoDB Streams, S3 Events, Kinesis), Google Cloud Functions (with Cloud Endpoints, Pub/Sub, Firestore Triggers, Cloud Scheduler), Azure Functions (with API Management, Event Grid, Service Bus, Cosmos DB Triggers, Timer triggers), and Cloudflare Workers (with KV Store, Durable Objects, R2, Queue Consumers). The skill produces function decomposition plans that avoid the nanoservice anti-pattern (functions too granular to justify their operational overhead) while maintaining clear domain boundaries aligned with DDD bounded contexts.

Cold start mitigation is a primary concern. The skill recommends provisioned concurrency strategies (AWS Lambda Provisioned Concurrency, Google Cloud Functions min instances, Azure Functions Premium plan always-ready instances), bundle optimization techniques (tree-shaking with esbuild/Webpack, dependency externalization, module lazy loading, layer-based shared dependency management), and warm-up pattern implementations (EventBridge scheduled pings, Azure Timer triggers, scheduled Cloud Scheduler jobs) with cost vs latency tradeoff analysis. Runtime selection guidance covers Node.js 20.x (fastest Lambda cold start), Python 3.12, Go 1.21 (compiled, near-zero cold start), Java 21 with GraalVM native image (eliminates JVM startup), and .NET 8 isolated process mode.

The skill designs event topology including: API Gateway REST vs HTTP vs WebSocket API selection, EventBridge event bus routing rules and archive/replay, SQS standard vs FIFO queue selection with dead-letter queue configuration, SNS topic fan-out patterns with filter policies, DynamoDB Streams event sourcing, and S3 event notification routing. For stateful workflows, it evaluates AWS Step Functions (Standard vs Express Workflows), Azure Durable Functions (orchestrator/activity/entity patterns), Google Cloud Workflows, and Temporal.io self-hosted. Cost modelling compares invocation-based pricing against always-on alternatives at multiple traffic percentiles.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `use_cases` | `array` | Yes | Function descriptions: what each function does, its trigger, and expected invocation rate |
| `platform` | `string` | Yes | Target serverless platform: `aws`, `gcp`, `azure`, or `cloudflare` |
| `language_runtime` | `string` | No | Preferred language: `nodejs`, `python`, `go`, `java`, `dotnet`. Defaults to `nodejs` |
| `concurrency_requirements` | `object` | No | Traffic profile: `peak_rps`, `burst_duration_s`, `baseline_rps` |
| `state_requirements` | `string` | No | State model: `stateless`, `external_store`, or `workflow`. Defaults to `stateless` |
| `context` | `object` | No | Additional context: existing infrastructure, budget constraints, compliance needs |

**Input Schema:**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "use_cases": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "properties": {
          "name":                { "type": "string" },
          "description":         { "type": "string" },
          "trigger_type":        { "type": "string", "enum": ["http","queue","event","schedule","stream","storage","topic"] },
          "expected_rps":        { "type": "number" },
          "max_execution_ms":    { "type": "integer" },
          "idempotent":          { "type": "boolean" }
        },
        "required": ["name", "description", "trigger_type"]
      }
    },
    "platform": { "type": "string", "enum": ["aws","gcp","azure","cloudflare"] },
    "language_runtime": { "type": "string", "enum": ["nodejs","python","go","java","dotnet"] },
    "concurrency_requirements": {
      "type": "object",
      "properties": {
        "peak_rps":         { "type": "number" },
        "burst_duration_s": { "type": "integer" },
        "baseline_rps":     { "type": "number" }
      }
    },
    "state_requirements": { "type": "string", "enum": ["stateless","external_store","workflow"] },
    "context": { "type": "object" }
  },
  "required": ["use_cases", "platform"]
}
```

## Required Context

- Use case descriptions with trigger types and expected traffic volumes (mandatory)
- Language/runtime preference for cold start and bundle optimization recommendations
- Concurrency requirements for provisioned concurrency sizing and reserved concurrency limits
- Existing infrastructure context (VPC configuration, shared layers, IAM patterns) if extending an existing system
- Budget constraints for cost modelling (invocation-based vs provisioned concurrency cost crossover analysis)

## Execution Logic

```
Step 1 — Validate and cluster use cases
  Validate that each use_case has a name, description, and trigger_type.
  Cluster use cases by domain affinity (DDD bounded contexts).
  Detect nanoservice anti-patterns: functions with < 10ms avg execution and no I/O
  that could be inlined as library calls instead of separate deployments.
  Flag: functions with > 15 minute max execution (exceeds Lambda/Functions limits).
  Output: validated_use_cases[], anti_pattern_warnings[]

Step 2 — Design function decomposition
  For each validated use case, define:
    function_name (kebab-case, domain-prefixed: orders-create, payments-process),
    trigger configuration (HTTP method+path, queue ARN, event pattern, schedule expression),
    handler pattern (single-purpose handler vs composite handler with routing),
    memory_mb (128-10240 MB for Lambda; align to performance/cost optimum),
    timeout_s (conservative max: p99_expected + 20% buffer, hard limit check),
    concurrency_limit (reserved or unreserved; set to prevent noisy-neighbor issues),
    ephemeral_storage_mb (for /tmp usage: Lambda 512-10240 MB).
  Apply anti-pattern guard: no function should own > 3 unrelated concerns.
  Output: function_designs[]

Step 3 — Design cold start mitigation strategy
  Analyze cold start risk per function: runtime × package_size × initialization_cost.
  Cold start risk tiers:
    HIGH: Java (JVM), .NET Framework, Python with heavy imports (boto3, pandas).
    MEDIUM: Python slim, Node.js with moderate dependencies, .NET isolated process.
    LOW: Go (compiled binary), Node.js minimal, Rust (via custom runtime).
  For HIGH-risk functions serving synchronous HTTP traffic:
    Recommend: provisioned_concurrency = ceil(baseline_rps × avg_execution_ms / 1000) + buffer.
    Cost check: provisioned_concurrency cost vs estimated cold start SLA breach cost.
  Bundle optimization: esbuild bundling (--bundle --minify --external:aws-sdk),
    Lambda Layers for shared dependencies (max 5 layers, 250 MB unzipped limit),
    tree-shaking import analysis.
  Warm-up patterns: EventBridge scheduled rule every 5 min for critical functions,
    keep-warm Lambda extension, Azure Durable Functions entity-based warm-up.
  Output: cold_start_strategy { per_function[], bundle_recommendations[], warm_up_configs[] }

Step 4 — Design event topology
  For HTTP-triggered functions:
    AWS: API Gateway HTTP API (REST API only if authorizers, usage plans, or caching needed).
    GCP: Cloud Endpoints (OpenAPI) or Firebase Hosting rewrites.
    Azure: API Management (APIM) for enterprise; Azure Functions HTTP trigger directly for internal.
    Cloudflare: Workers Routes with URL pattern matching.
  For async event-driven functions:
    SQS → Lambda: batch_size (1-10000), visibility_timeout (> 6× max_function_duration),
                   DLQ after max_receive_count, FIFO for ordering guarantees.
    SNS → SQS → Lambda (fan-out): filter policies to reduce invocations.
    EventBridge: event bus routing rules, event archive (30-day default), replay capability.
    Kinesis: shard count, batch_size (1-10000), starting_position (TRIM_HORIZON vs LATEST),
             bisect_on_function_error, destination on failure.
    DynamoDB Streams: NEW_AND_OLD_IMAGES, filter patterns to reduce invocations.
  Output: event_topology { triggers[], fans[], filters[], dlq_configs[] }

Step 5 — Design state management
  If state_requirements == stateless: verify no function persists state in /tmp across invocations.
  If state_requirements == external_store:
    Recommend: DynamoDB (single-table design for Lambda), Redis (ElastiCache Serverless),
               Firestore (GCP), Cosmos DB Serverless (Azure), Cloudflare KV or Durable Objects.
    Design: connection pooling strategy (RDS Proxy for relational, connection reuse pattern).
  If state_requirements == workflow:
    AWS: Step Functions Standard (up to 1 year, audit trail) vs Express (high-throughput, 5 min max).
    Azure: Durable Functions with orchestrator + activity function + entity function patterns.
    GCP: Cloud Workflows (YAML/JSON syntax, HTTP steps) or Pub/Sub choreography.
    Cloudflare: Durable Objects with alarm API for workflow state.
    Generate workflow definition skeleton for the primary use case workflow.
  Output: state_management_design { store_type, connection_strategy, workflow_definition? }

Step 6 — Model costs
  For each function, calculate:
    monthly_invocations = expected_rps × 2,592,000 (30 days in seconds).
    gb_seconds = (memory_mb / 1024) × avg_execution_s × monthly_invocations.
    request_cost = monthly_invocations × provider_request_price_per_million.
    compute_cost = gb_seconds × provider_gb_second_price.
    provisioned_concurrency_cost (if recommended) = provisioned_units × hrs_per_month × price_per_gb_hour.
  Sum across all functions for p50 and p95 traffic scenarios.
  Compare against equivalent always-on container cost (ECS Fargate/Cloud Run/ACA) at same traffic.
  Output: cost_estimate { monthly_at_p50, monthly_at_p95, provisioned_concurrency_overhead_pct, breakeven_rps }

Step 7 — Design observability configuration
  Structured logging: JSON logs with correlation_id, function_name, version, cold_start: bool.
  Metrics: custom CloudWatch/Cloud Monitoring/Application Insights metrics for business KPIs.
  Distributed tracing: AWS X-Ray (active tracing enabled), GCP Cloud Trace, Azure Application Insights.
  Alerting: error rate > 1%, p99 duration > 80% of timeout, throttles > 0, DLQ depth > 0.
  Dashboard: Lambda Insights (enhanced monitoring), GCP Cloud Monitoring dashboard, Azure Monitor workbook.
  Output: observability_config { logging_schema, custom_metrics[], alerts[], tracing_config }

Step 8 — Generate IaC scaffold
  Generate Terraform or SAM/CloudFormation/Bicep skeleton based on platform:
    AWS: SAM template.yaml with Globals, Function resources, EventBridge rules, SQS queues.
    GCP: Terraform google_cloudfunctions2_function resources with triggers.
    Azure: Bicep modules for functionApp, hostingPlan (Flex Consumption), storageAccount.
    Cloudflare: wrangler.toml with routes, durable_objects, kv_namespaces bindings.
  Include: IAM roles (least-privilege), environment variable references (no hardcoded values),
           dead-letter queue configurations, log group retention (90 days default).
  Output: iac_scaffold (string — compact skeleton, < 200 lines)
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `function_designs` | `array` | Per-function specs: name, trigger, memory_mb, timeout_s, handler_pattern, concurrency_limit |
| `cold_start_strategy` | `object` | Cold start risk tiers, provisioned concurrency sizing, bundle optimization steps |
| `event_topology` | `object` | Trigger configs, fan-out patterns, filter policies, DLQ configurations |
| `state_management_design` | `object` | Store selection, connection strategy, workflow definition skeleton |
| `cost_estimate` | `object` | Monthly cost at p50/p95 load, provisioned overhead, breakeven analysis |
| `observability_config` | `object` | Logging schema, custom metrics, alerting rules, tracing setup |
| `iac_scaffold` | `string` | Terraform/SAM/Bicep/wrangler.toml skeleton |
| `metrics` | `object` | Execution metrics: tokens_in, tokens_out, duration_ms, items_produced, version |
| `feedback` | `array` | Backpropagation and informational feedback entries |

**Output Schema:**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "function_designs": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name":              { "type": "string" },
          "trigger_type":      { "type": "string" },
          "trigger_config":    { "type": "object" },
          "memory_mb":         { "type": "integer", "minimum": 128, "maximum": 10240 },
          "timeout_s":         { "type": "integer", "minimum": 1, "maximum": 900 },
          "handler_pattern":   { "type": "string" },
          "concurrency_limit": { "type": "integer" },
          "cold_start_risk":   { "type": "string", "enum": ["low","medium","high"] }
        },
        "required": ["name","trigger_type","memory_mb","timeout_s"]
      }
    },
    "cold_start_strategy": {
      "type": "object",
      "properties": {
        "per_function":          { "type": "array" },
        "bundle_recommendations":{ "type": "array" },
        "warm_up_configs":       { "type": "array" }
      },
      "required": ["per_function"]
    },
    "event_topology": {
      "type": "object",
      "properties": {
        "triggers": { "type": "array" },
        "fans":     { "type": "array" },
        "filters":  { "type": "array" },
        "dlq_configs":{ "type": "array" }
      },
      "required": ["triggers"]
    },
    "state_management_design": {
      "type": "object",
      "properties": {
        "store_type":           { "type": "string" },
        "connection_strategy":  { "type": "string" },
        "workflow_definition":  { "type": "string" }
      },
      "required": ["store_type"]
    },
    "cost_estimate": {
      "type": "object",
      "properties": {
        "monthly_at_p50_usd":               { "type": "number" },
        "monthly_at_p95_usd":               { "type": "number" },
        "provisioned_concurrency_overhead_pct":{ "type": "number" },
        "breakeven_rps":                    { "type": "number" }
      },
      "required": ["monthly_at_p50_usd","monthly_at_p95_usd"]
    },
    "observability_config": {
      "type": "object",
      "properties": {
        "logging_schema":  { "type": "object" },
        "custom_metrics":  { "type": "array" },
        "alerts":          { "type": "array" },
        "tracing_config":  { "type": "object" }
      },
      "required": ["logging_schema","alerts"]
    },
    "iac_scaffold": { "type": "string" },
    "metrics": {
      "type": "object",
      "properties": {
        "tokens_in":      { "type": "integer" },
        "tokens_out":     { "type": "integer" },
        "duration_ms":    { "type": "integer" },
        "items_produced": { "type": "integer" },
        "version":        { "type": "string" }
      },
      "required": ["tokens_in","tokens_out","duration_ms","items_produced","version"]
    },
    "feedback": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "type":        { "type": "string", "enum": ["backpropagate","info","warning"] },
          "from_skill":  { "type": "string" },
          "target_skill":{ "type": "string" },
          "reason":      { "type": "string" },
          "evidence":    { "type": "object" }
        },
        "required": ["type", "from_skill", "reason"]
      }
    }
  },
  "required": ["function_designs","cold_start_strategy","event_topology","state_management_design","cost_estimate","observability_config","iac_scaffold","metrics","feedback"]
}
```

## Rules & Constraints

- Function `timeout_s` MUST NOT exceed platform maximum: 900s (AWS Lambda), 3600s (Azure Functions Premium), 540s (GCP Cloud Functions 2nd gen), 30s (Cloudflare Workers).
- Nanoservice anti-patterns (functions with trivial execution, no I/O, < 10ms avg) MUST be flagged with a recommendation to inline or consolidate.
- IaC scaffold MUST NOT contain hardcoded credentials, access keys, or environment-specific values; use `${env:VAR_NAME}` or SSM Parameter Store references.
- SQS visibility timeout MUST be configured to at least 6× the function's `timeout_s` to prevent message duplication under worst-case execution.
- Provisioned concurrency sizing MUST include a cost comparison against on-demand invocation cost; recommend provisioned only if it is cost-justified.
- Step Functions Standard Workflow MUST be used for workflows requiring audit trails, human approval steps, or execution history > 5 minutes; Express Workflows for high-throughput short-duration flows only.
- Cost estimates MUST be clearly labelled as estimates with confidence levels; do not present as exact billing projections.

## Security Considerations

- Lambda execution roles MUST follow least-privilege: no `*` resources on `Action` policies, no `iam:PassRole` without resource constraints.
- Environment variables MUST NOT contain secrets in plaintext; reference AWS SSM Parameter Store SecureString, GCP Secret Manager, Azure Key Vault references, or Cloudflare Secrets.
- Function URLs and HTTP triggers MUST have authentication configured (IAM auth, Lambda authorizer, Cognito) unless explicitly public — unauthenticated public endpoints require a warning in feedback.
- VPC-connected functions accessing private resources must use VPC endpoints (PrivateLink) to avoid NAT gateway egress costs and public internet exposure.
- Dead-letter queues containing failed event payloads may contain PII; DLQ access MUST be restricted to the owning service IAM role only.

## Token Optimization

- Compress `use_cases` to name+trigger_type+expected_rps only for function decomposition step; expand description only when detecting anti-patterns.
- Return `iac_scaffold` as a compact skeleton (< 200 lines); omit comments and documentation blocks — these are added by `documentation-generator`.
- Cost estimate: return only p50 and p95 scenarios; omit per-function breakdown tables in favor of totals unless `context.detailed_cost_breakdown: true` is set.
- `event_topology` filters: return only non-default filter policies; omit pass-all rules to reduce output verbosity.

## Quality Checklist

- [ ] All use cases have assigned function designs with memory and timeout values
- [ ] Cold start risk is assessed for every function with runtime-specific recommendations
- [ ] Nanoservice anti-patterns identified and flagged with consolidation suggestions
- [ ] SQS visibility timeout is ≥ 6× function timeout for all queue-triggered functions
- [ ] IaC scaffold contains no hardcoded credentials or environment-specific values
- [ ] Cost estimate covers both p50 and p95 traffic scenarios
- [ ] Observability config includes at minimum: error rate, p99 duration, throttle, and DLQ depth alerts
- [ ] Provisioned concurrency recommendations include cost justification

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| `use_cases` is empty | Reject: `{"error": "NO_USE_CASES", "min_items": 1}` |
| Function `max_execution_ms` exceeds platform limit | Flag as `LIMIT_EXCEEDED`; recommend alternative: ECS Fargate Task, Cloud Run Job, Azure Container App Job |
| No `concurrency_requirements` provided | Assume `baseline_rps: 1`, `peak_rps: 10`; log assumption in feedback |
| `state_requirements: workflow` but no workflow steps definable from use_cases | Return `state_management_design.workflow_definition: null`; emit backpropagate to request workflow step details |
| Platform is `cloudflare` and `state_requirements: workflow` | Warn that Cloudflare Durable Objects provide limited workflow primitives; suggest hybrid with external orchestrator |

## 12. Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Behavior |
|------|---------|---------|----------|
| Unauthenticated public function URL | Any function with `trigger_type: http` and no authentication configured | 3600s | Pause; require explicit human confirmation that the endpoint is intentionally public |
| High provisioned concurrency cost | Provisioned concurrency overhead > 40% of total estimated monthly cost | 3600s | Present cost breakdown and alternative strategies for human cost/latency tradeoff decision |

## 13. Skill Composition

`serverless-architect` slots between `architecture-design` and `deployment-strategy`:

```yaml
composes:
  - skill: serverless-architect
    version: "^1.0.0"
    input_map:
      use_cases: "architecture.modules[*].{ name: name, description: responsibility, trigger_type: integration_protocol }"
      platform: "session.cloud_provider"
      language_runtime: "session.language_runtime"
      concurrency_requirements: "session.concurrency_profile"
    output_map:
      function_designs: "state.serverless_spec.functions"
      event_topology: "state.serverless_spec.event_topology"
      iac_scaffold: "state.serverless_spec.iac"
      cost_estimate: "state.serverless_spec.cost"
```

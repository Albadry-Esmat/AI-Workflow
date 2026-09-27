---
name: distributed-resilience-architect
version: 1.0.0
domain: architecture
description: >
  Use when designing resilience patterns for distributed systems, configuring circuit breakers, retry strategies, bulkheads, or saga transactions. Triggers on: "circuit breaker", "retry policy", "resilience design", "bulkhead pattern", "distributed transactions", "chaos engineering". Do NOT use for single-service or monolith reliability concerns — use deployment-strategy for those.
author: system
---

## Purpose

Design and specify resilience patterns for distributed systems that must maintain availability, consistency, and performance under partial failure conditions. This skill covers the full resilience engineering surface: circuit breaker implementation choices (Hystrix legacy, Resilience4j for JVM, Polly for .NET, opossum for Node.js, resilience-go for Go), bulkhead isolation strategies comparing thread-pool vs semaphore models, timeout hierarchies aligned with dependency SLAs, and retry strategies with exponential backoff, jitter variants (full/equal/decorrelated), and retry budgets to prevent thundering herd amplification during cascading failures.

For distributed transaction management, the skill evaluates saga orchestration (central coordinator with explicit state machine, Temporal/Conductor workflows) against saga choreography (event-driven, decentralized with domain events on Kafka/EventBridge) and produces sequence diagrams, compensation logic maps, idempotency key strategies, and dead-letter queue handling. It analyses CAP theorem and PACELC tradeoffs and recommends the appropriate consistency model — strong (linearizability), sequential, eventual, or weak — for each service boundary based on the domain semantics of the data involved.

The skill produces a complete Failure Mode and Effects Analysis (FMEA) report, ranking each failure mode by Risk Priority Number (Severity × Occurrence × Detectability), and generates executable chaos engineering test scenarios for LitmusChaos, Gremlin, Chaos Monkey, and Toxiproxy that validate the designed resilience patterns under controlled blast-radius conditions. All output aligns with the SRE four golden signals (latency, traffic, errors, saturation) and integrates with OpenTelemetry correlation IDs and distributed tracing span propagation via W3C TraceContext headers.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `services` | `array` | Yes | Service names, inter-dependencies, protocols, and criticality ratings |
| `failure_scenarios` | `array` | No | Known or anticipated failure modes (downstream timeout, DB overload, network partition) |
| `consistency_requirement` | `string` | No | Consistency model: `strong`, `eventual`, or `weak`. Defaults to `eventual` |
| `sla_targets` | `object` | No | SLA objectives: `availability_pct` (e.g., 99.9), `latency_p99_ms` |
| `platform` | `string` | No | Deployment platform: `aws`, `gcp`, `azure`, `k8s`, or `hybrid` |
| `context` | `object` | No | Additional context: architecture docs, existing observability stack, language runtimes |

**Input Schema:**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "services": {
      "type": "array",
      "minItems": 2,
      "items": {
        "type": "object",
        "properties": {
          "name": { "type": "string" },
          "dependencies": { "type": "array", "items": { "type": "string" } },
          "protocol": { "type": "string", "enum": ["http", "grpc", "amqp", "kafka", "tcp", "graphql"] },
          "criticality": { "type": "string", "enum": ["critical", "high", "medium", "low"] },
          "language_runtime": { "type": "string" }
        },
        "required": ["name"]
      }
    },
    "failure_scenarios": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "scenario": { "type": "string" },
          "affected_service": { "type": "string" },
          "frequency": { "type": "string", "enum": ["frequent", "occasional", "rare"] }
        }
      }
    },
    "consistency_requirement": { "type": "string", "enum": ["strong", "eventual", "weak"] },
    "sla_targets": {
      "type": "object",
      "properties": {
        "availability_pct": { "type": "number", "minimum": 90, "maximum": 99.9999 },
        "latency_p99_ms": { "type": "integer", "minimum": 1 }
      }
    },
    "platform": { "type": "string", "enum": ["aws", "gcp", "azure", "k8s", "hybrid"] },
    "context": { "type": "object" }
  },
  "required": ["services"]
}
```

## Required Context

- Service dependency graph from `architecture-design` output (modules + integration_points)
- SLA targets and error budgets if defined in `deployment-strategy` output
- Existing observability configuration (tracing backend: Jaeger/Zipkin/Tempo, metrics pipeline: Prometheus/Datadog)
- Platform-specific resilience primitives: AWS SDK retry configs, Kubernetes liveness/readiness/startup probes, Istio outlier detection

## Execution Logic

```
Step 1 — Build dependency graph and identify critical paths
  Parse services array; construct directed weighted dependency graph.
  Identify: critical paths (highest latency/failure impact), fan-out hotspots,
            single points of failure (SPOF), and deeply nested synchronous chains.
  Classify each dependency edge: synchronous blocking vs async non-blocking.
  Flag circular dependencies as architectural risks requiring saga design.
  Output: dependency_graph { nodes, edges, critical_paths[], spof_list[], max_depth }

Step 2 — Select and configure circuit breaker patterns
  For each synchronous dependency edge:
    Recommend library by language runtime: Resilience4j (JVM), Polly (dotnet),
    opossum (Node.js), go-resilience (Go), py-breaker (Python).
    Configure state machine parameters:
      failure_rate_threshold_pct (default: 50), slow_call_rate_threshold_pct (default: 100),
      slow_call_duration_threshold_ms, wait_duration_open_s (default: 60),
      permitted_calls_in_half_open (default: 5),
      sliding_window_type: count-based (default: 10 calls) or time-based (default: 60s).
    Assign fallback strategy: static_default_response | cached_last_good | degraded_feature | fail_fast.
  Output: circuit_breaker_configs[]

Step 3 — Design bulkhead isolation strategies
  For each service, partition concurrency resources by upstream consumer criticality.
  Thread pool bulkhead (blocking stacks): max_concurrent_calls, max_wait_duration_ms, queue_capacity.
  Semaphore bulkhead (reactive/non-blocking stacks): max_concurrent_calls only.
  Name bulkhead pools by domain: payments-pool, search-pool, notifications-pool, auth-pool.
  Map each pool to a resource quota (% of thread pool or semaphore count).
  Output: bulkhead_designs[]

Step 4 — Define timeout hierarchy
  Work from leaf services upward; apply the N-tier rule:
    each_ancestor_timeout = max(direct_child_timeout) × 1.5 + p99_processing_overhead_ms.
  Define per-protocol timeouts: connect_timeout, read_timeout, write_timeout, idle_timeout.
  Account for: HTTP/2 stream deadlines, gRPC deadline propagation, Kafka consumer poll interval,
               database statement timeout, connection pool acquisition timeout.
  Output: timeout_hierarchy { per_service: { connect_ms, read_ms, write_ms }, per_protocol: {...} }

Step 5 — Design retry strategies with jitter and budgets
  For each idempotent operation only (flag non-idempotent mutations explicitly):
    base_delay_ms (default: 100), multiplier (default: 2.0), max_attempts (default: 3),
    max_delay_ms_cap (default: 30000).
    Jitter selection: FULL (random[0, base*2^n]) for uniform load distribution,
                      EQUAL (base/2 + random[0, base/2]) for smoother spread,
                      DECORRELATED (delay = random[base, prev_delay*3]) for aggressive spreading.
    Retry budget: max_retry_ratio_pct (default: 10%) — prevents retry amplification.
    Non-retriable status codes: 400, 401, 403, 404, 422 (business validation), 501.
  Output: retry_policies[]

Step 6 — Design rate limiting configurations
  Per service ingress: token bucket (burst_capacity, refill_rate_per_s) or sliding_window_counter.
  Per client identity (API key, tenant_id, user_id): quota (requests/minute) and burst_limit.
  Recommend implementation: Redis-backed Lua atomic scripts (INCR+EXPIRE), Kong rate-limit
  plugin with Redis cluster, Envoy local (per-pod) and global (via rate limit service) modes.
  Configure response headers: X-RateLimit-Limit, X-RateLimit-Remaining, Retry-After.
  Output: rate_limit_configs[]

Step 7 — Saga design for distributed transactions
  Identify multi-service write operations requiring atomicity or compensation.
  For each saga:
    Evaluate orchestration (Temporal workflow, AWS Step Functions, Conductor) vs
    choreography (Kafka domain events, AWS EventBridge, choreography with outbox pattern).
    Map all steps and their compensating transactions (explicit rollback operations).
    Define idempotency key strategy: UUID v4 generated at saga initiation, propagated via header.
    Handle partial failure: compensation execution order (reverse), compensation retries (max 3),
    dead-letter queue for uncompensatable failures, manual intervention workflow.
  Output: saga_designs[]

Step 8 — Produce FMEA report
  For each service and inter-service integration point, enumerate failure modes:
    timeout, crash/OOM, data corruption, split brain, network partition, cascade overload,
    dependency version skew, certificate expiry, connection pool exhaustion.
  Rate each: Severity (1-10 impact on business), Occurrence (1-10 likelihood),
             Detectability (1-10 inverse — 10=undetectable, 1=always detected).
  RPN = Severity × Occurrence × Detectability. Flag RPN > 100 as high risk.
  Map mitigations from circuit_breaker_configs, retry_policies, timeout_hierarchy outputs.
  Output: fmea_report { failure_modes[], total_modes_analyzed, high_risk_count }

Step 9 — Generate chaos engineering scenarios
  For each failure mode with RPN > 50:
    Select tool: LitmusChaos (k8s-native), Gremlin (SaaS), Toxiproxy (network conditions),
                 Chaos Monkey (instance termination, AWS).
    Define steady_state_hypothesis: SLO metrics that must hold (e.g., error_rate < 0.1%).
    Specify blast_radius: single-pod, single-AZ, single-dependency-latency-inject.
    Define abort_condition: auto-rollback trigger threshold.
    Generate experiment_spec as YAML (LitmusChaos ChaosEngine format or Gremlin attack JSON).
  Output: chaos_scenarios[]

Step 10 — Assemble resilience specification
  Combine all outputs; generate Mermaid sequenceDiagram for top 3 saga flows.
  Add OpenTelemetry W3C TraceContext header propagation table per protocol.
  Produce implementation checklist cross-referencing each pattern to its responsible service team.
  Output: complete resilience specification document
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `resilience_patterns` | `array` | Per-service pattern assignments: `{ service, pattern, library, config_snippet }` |
| `circuit_breaker_configs` | `array` | Full circuit breaker state machine configs per dependency edge |
| `timeout_hierarchy` | `object` | Nested timeout map per service and protocol |
| `retry_policies` | `array` | Retry strategies per operation with jitter type and budget |
| `saga_designs` | `array` | Saga specs: type, steps, compensations, idempotency keys |
| `fmea_report` | `object` | Failure mode table with RPN scores and mitigations assigned |
| `chaos_scenarios` | `array` | LitmusChaos/Gremlin experiment specs for all high-RPN failure modes |
| `metrics` | `object` | Execution metrics: tokens_in, tokens_out, duration_ms, items_produced, version |
| `feedback` | `array` | Backpropagation and informational feedback entries |

**Output Schema:**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "resilience_patterns": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "service":        { "type": "string" },
          "pattern":        { "type": "string", "enum": ["circuit_breaker","bulkhead","retry","rate_limit","timeout","fallback","saga"] },
          "library":        { "type": "string" },
          "config_snippet": { "type": "string" }
        },
        "required": ["service", "pattern"]
      }
    },
    "circuit_breaker_configs": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "from_service":               { "type": "string" },
          "to_service":                 { "type": "string" },
          "failure_rate_threshold_pct": { "type": "number", "minimum": 20, "maximum": 100 },
          "wait_duration_open_s":       { "type": "integer" },
          "sliding_window_type":        { "type": "string", "enum": ["count", "time"] },
          "sliding_window_size":        { "type": "integer" },
          "fallback_strategy":          { "type": "string" }
        },
        "required": ["from_service", "to_service", "failure_rate_threshold_pct"]
      }
    },
    "timeout_hierarchy": {
      "type": "object",
      "additionalProperties": {
        "type": "object",
        "properties": {
          "connect_timeout_ms": { "type": "integer" },
          "read_timeout_ms":    { "type": "integer" },
          "write_timeout_ms":   { "type": "integer" }
        }
      }
    },
    "retry_policies": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "service":           { "type": "string" },
          "operation":         { "type": "string" },
          "max_attempts":      { "type": "integer", "minimum": 1, "maximum": 10 },
          "base_delay_ms":     { "type": "integer" },
          "multiplier":        { "type": "number" },
          "jitter":            { "type": "string", "enum": ["full","equal","decorrelated","none"] },
          "retry_budget_pct":  { "type": "number", "minimum": 1, "maximum": 25 }
        },
        "required": ["service", "max_attempts", "base_delay_ms"]
      }
    },
    "saga_designs": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "saga_name":           { "type": "string" },
          "type":                { "type": "string", "enum": ["orchestration","choreography"] },
          "steps":               { "type": "array" },
          "compensations":       { "type": "array" },
          "idempotency_strategy":{ "type": "string" }
        },
        "required": ["saga_name", "type", "steps", "compensations"]
      }
    },
    "fmea_report": {
      "type": "object",
      "properties": {
        "failure_modes": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "service":       { "type": "string" },
              "failure_mode":  { "type": "string" },
              "severity":      { "type": "integer", "minimum": 1, "maximum": 10 },
              "occurrence":    { "type": "integer", "minimum": 1, "maximum": 10 },
              "detectability": { "type": "integer", "minimum": 1, "maximum": 10 },
              "rpn":           { "type": "integer", "minimum": 1, "maximum": 1000 },
              "mitigation":    { "type": "string" }
            },
            "required": ["service", "failure_mode", "severity", "occurrence", "detectability", "rpn"]
          }
        },
        "total_modes_analyzed": { "type": "integer" },
        "high_risk_count":      { "type": "integer" }
      },
      "required": ["failure_modes", "total_modes_analyzed"]
    },
    "chaos_scenarios": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name":                     { "type": "string" },
          "target_failure_mode":      { "type": "string" },
          "tool":                     { "type": "string", "enum": ["litmuschaos","gremlin","chaos_monkey","toxiproxy"] },
          "experiment_spec":          { "type": "string" },
          "steady_state_hypothesis":  { "type": "string" },
          "abort_condition":          { "type": "string" }
        },
        "required": ["name", "tool", "steady_state_hypothesis", "abort_condition"]
      }
    },
    "metrics": {
      "type": "object",
      "properties": {
        "tokens_in":      { "type": "integer" },
        "tokens_out":     { "type": "integer" },
        "duration_ms":    { "type": "integer" },
        "items_produced": { "type": "integer" },
        "version":        { "type": "string" }
      },
      "required": ["tokens_in", "tokens_out", "duration_ms", "items_produced", "version"]
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
  "required": ["resilience_patterns","circuit_breaker_configs","timeout_hierarchy","retry_policies","saga_designs","fmea_report","chaos_scenarios","metrics","feedback"]
}
```

## Rules & Constraints

- Retry policies MUST only target idempotent operations; non-idempotent mutations (payments, order placement) must use idempotency keys instead of automatic retries.
- Circuit breaker `failure_rate_threshold_pct` MUST NOT be set below 20% to avoid false-positive tripping on transient spikes.
- Every saga MUST define a compensating transaction for every forward step; sagas with incomplete compensation maps are rejected.
- Timeout values MUST satisfy the hierarchy constraint: no ancestor timeout may be shorter than its deepest child timeout path.
- FMEA entries with RPN > 100 MUST have a non-empty `mitigation` field before output is finalized.
- Chaos scenarios MUST define both `steady_state_hypothesis` and `abort_condition`; experiments without safety gates are rejected as incomplete.
- Do NOT recommend Hystrix (Netflix, maintenance mode since 2018) for new implementations; use Resilience4j, Polly, or opossum.
- Rate limiting MUST include both global (per-service) and per-client-identity limits; missing per-client limits produce a warning.

## Security Considerations

- Circuit breaker fallback responses MUST NOT expose internal error details, stack traces, service topology, or downstream dependency names to external callers.
- Rate limiting counters MUST be backed by a distributed store (Redis cluster, Memcached) — in-process counters are ineffective against multi-instance deployments and DDoS scenarios.
- OpenTelemetry correlation IDs and W3C TraceContext headers MUST NOT carry PII, authentication tokens, or sensitive payload data.
- Saga compensation logs and dead-letter queue write access MUST be restricted to the saga orchestrator service identity only; no shared credentials.
- Chaos engineering experiments targeting production infrastructure MUST require explicit HITL gate approval — staging-only by default.

## Token Optimization

- Compress the `services` input to adjacency-list format before processing; strip verbose descriptions and metadata fields.
- Limit FMEA output to top 20 failure modes ranked by RPN; set `fmea_report.truncated: true` if the full set exceeds 20 entries.
- Generate Mermaid `sequenceDiagram` only for sagas with ≥ 3 compensation steps; use tabular format for simpler flows.
- Return `config_snippet` values as compact YAML (inline style, no block comments) to minimize output token count.

## Quality Checklist

- [ ] All critical synchronous dependency edges have circuit breaker configurations assigned
- [ ] Timeout hierarchy is consistent — no ancestor timeout shorter than descendant child timeout
- [ ] All retry policies specify jitter type and retry budget percentage
- [ ] Every saga has a compensation transaction defined for every forward step
- [ ] FMEA covers all services listed in the `services` input array
- [ ] All FMEA entries with RPN > 100 have non-empty mitigation assignments
- [ ] All chaos scenarios include both `steady_state_hypothesis` and `abort_condition`
- [ ] No deprecated Hystrix library recommendations present in circuit breaker output

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| Fewer than 2 services in input | Reject: `{"error": "INSUFFICIENT_SERVICES", "min_services": 2}` |
| Circular dependency detected in graph | Flag as `ARCHITECTURAL_RISK`; produce spec for non-cyclic edges; recommend saga to break the cycle |
| SLA target is mathematically unachievable given dependency chain | Emit warning with achievable SLA calculation; continue with best-effort spec |
| No `consistency_requirement` provided | Default to `eventual`; log assumption in feedback as `type: info` |
| FMEA produces > 50 failure modes | Return top 50 by RPN; set `fmea_report.truncated: true` with total count |

## 12. Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Behavior |
|------|---------|---------|----------|
| High-RPN approval | Any `fmea_report.failure_mode.rpn > 200` | 3600s | Pause; present top-5 high-RPN items and proposed mitigations for human sign-off before finalizing |
| Production chaos approval | Any `chaos_scenario` targeting a production environment label | 7200s | Block; require explicit human approval before scenario is included in execution plan |
| Incomplete saga compensation | Any saga with > 5 steps where compensation map is partial | 3600s | Present incomplete compensation map for stakeholder review; block output until completed |

## 13. Skill Composition

`distributed-resilience-architect` slots after `architecture-design` and before `deployment-strategy`:

```yaml
composes:
  - skill: distributed-resilience-architect
    version: "^1.0.0"
    input_map:
      services: "architecture.modules[*].{ name: name, dependencies: dependencies, protocol: integration_protocol }"
      platform: "session.cloud_provider"
      sla_targets: "session.sla_targets"
      consistency_requirement: "session.consistency_model"
    output_map:
      resilience_patterns: "state.resilience_spec.patterns"
      circuit_breaker_configs: "state.resilience_spec.circuit_breakers"
      chaos_scenarios: "state.resilience_spec.chaos_plan"
      fmea_report: "state.resilience_spec.fmea"
```

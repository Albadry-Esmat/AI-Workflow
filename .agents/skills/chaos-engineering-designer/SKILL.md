---
name: chaos-engineering-designer
version: 1.0.0
domain: testing
description: >
  Use when designing chaos engineering experiments to proactively validate system resilience before failures occur in production. Triggers on: "chaos engineering", "fault injection", "resilience experiments", "chaos testing", "blast radius analysis". Do NOT use when distributed-resilience-architect has not yet produced a resilience baseline — run that skill first.
author: system
---

## Purpose

Chaos engineering is the discipline of intentionally injecting controlled failures into a system to discover weaknesses before they manifest as production incidents. This skill designs structured chaos experiments grounded in the **steady-state hypothesis** — a measurable, observable definition of normal system behavior (e.g., "p99 latency < 200ms, error rate < 0.1%") that must hold during and after every experiment. Each experiment is designed to falsify the hypothesis in a controlled way, expanding confidence in system resilience with every successful trial. The skill supports four major chaos platforms: LitmusChaos (Kubernetes-native ChaosEngine CRDs), Gremlin (SaaS fault injection via agent), AWS Fault Injection Simulator (FIS with ExperimentTemplate), and Chaos Mesh (CRD-based, CNCF), selecting the appropriate tool based on the declared `chaos_platform` input and target infrastructure.

Experiments are organized across four fault categories: **network** (latency injection, packet loss, partition, DNS failure), **compute** (CPU stress, memory pressure, pod kill, node drain), **application** (process kill, exception injection, thread starvation, slow consumer), and **data** (disk fill, I/O throttling, corrupt write simulation, database failover). For each category, blast radius controls are applied aligned with `blast_radius_tolerance` — starting at the `service` level (single pod or instance), escalating to `namespace` (all replicas), and finally `cluster` (cross-AZ or cross-region faults). Rollback procedures are specified before any experiment runs, and abort conditions are expressed as quantitative thresholds tied directly to SLO metrics to guarantee automatic containment.

The skill produces a complete **resilience scorecard** for each service and an end-to-end **GameDay plan** — a facilitated, time-boxed event where engineering teams execute curated experiments in a controlled environment to build organizational muscle memory. When `continuous_chaos` is enabled, the skill designs a recurring minimal experiment suite integrated into the CI/CD pipeline as a chaos gate, running on every deployment to staging. All experiment outputs are linked to observability requirements needed to validate the steady-state hypothesis, ensuring that metrics, traces, and alerts are verified present and healthy before any fault is injected.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `services` | `array` | Yes | Target services with dependencies, criticality, and deployment topology |
| `chaos_platform` | `string` | No | Chaos tool: `litmus`, `gremlin`, `aws_fis`, `chaos_mesh`. Default: `litmus` |
| `experiment_scope` | `array` | No | Fault categories: `network`, `compute`, `application`, `data`. Default: all four |
| `blast_radius_tolerance` | `string` | No | Maximum blast radius: `service`, `namespace`, `cluster`. Default: `service` |
| `continuous_chaos` | `boolean` | No | Design a recurring CI/CD chaos gate suite. Default: `false` |
| `context` | `object` | No | `{ resilience_baseline, observability_stack, slo_targets, environment }` |

**Input Schema:**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["services"],
  "properties": {
    "services": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": ["name"],
        "properties": {
          "name":         { "type": "string" },
          "dependencies": { "type": "array", "items": { "type": "string" } },
          "criticality":  { "type": "string", "enum": ["critical", "high", "medium", "low"] },
          "replicas":     { "type": "integer", "minimum": 1 },
          "namespace":    { "type": "string" },
          "cloud_region": { "type": "string" }
        }
      }
    },
    "chaos_platform": {
      "type": "string",
      "enum": ["litmus", "gremlin", "aws_fis", "chaos_mesh"],
      "default": "litmus"
    },
    "experiment_scope": {
      "type": "array",
      "items": { "type": "string", "enum": ["network", "compute", "application", "data"] },
      "default": ["network", "compute", "application", "data"]
    },
    "blast_radius_tolerance": {
      "type": "string",
      "enum": ["service", "namespace", "cluster"],
      "default": "service"
    },
    "continuous_chaos": { "type": "boolean", "default": false },
    "context": {
      "type": "object",
      "properties": {
        "resilience_baseline": { "type": "object" },
        "observability_stack": { "type": "string", "enum": ["prometheus", "datadog", "cloudwatch"] },
        "slo_targets":         { "type": "object" },
        "environment":         { "type": "string", "enum": ["staging", "canary", "production"] }
      }
    }
  }
}
```

## Required Context

- `distributed-resilience-architect` output is **mandatory** — the FMEA report (`fmea_report.failure_modes[]`) and `chaos_scenarios[]` provide the initial risk-ranked experiment catalog; without a resilience baseline this skill cannot prioritize experiments and will emit `backpropagate` and halt.
- Observability stack configuration is required to validate the steady-state hypothesis: Prometheus (scrape interval, PromQL), Datadog (monitor IDs), or CloudWatch (metric namespaces and alarm ARNs) must have active data points within the last 5 minutes before any experiment runs.
- Deployment topology details — Kubernetes namespace names, pod label selectors, AWS resource ARNs, or Gremlin target identifiers — are required for experiment target resolution in platform-native spec generation.
- SLO targets from `slo-sla-designer` output are used to compute quantitative abort thresholds for every steady-state hypothesis.

## Execution Logic

```
Step 1 — Validate inputs and load resilience baseline
  Require services.length >= 1; reject if empty.
  Load distributed-resilience-architect output from state scope "resilience_spec":
    Extract fmea_report.failure_modes[] sorted by rpn descending.
    Extract chaos_scenarios[] already identified in the resilience spec.
  If no resilience_spec in state: emit backpropagate targeting distributed-resilience-architect; halt.
  Load slo_targets from state scope "slo_sla_designer" or context.slo_targets.
  If no slo_targets: derive minimal set: error_rate_pct=1.0, latency_p99_ms=500; warn in feedback.
  Output: validated_services[], ranked_failure_modes[], existing_chaos_scenarios[]

Step 2 — Define steady-state hypotheses per service
  For each service in services[]:
    Map to slo_targets (error_rate_pct, latency_p99_ms, availability_pct if present).
    Compose hypothesis: { service, metric_name, operator, threshold, measurement_window_s }
      Example: { service: "payment-svc", metric_name: "http_request_error_rate",
                 operator: "lt", threshold: 0.01, measurement_window_s: 60 }
    Assign probe type by observability_stack:
      prometheus: PromQL expression string (rate(http_requests_total{status=~"5.."}[1m]) / rate(...))
      datadog:    Datadog monitor query string (avg:trace.web.request.errors{service:X}.as_rate())
      cloudwatch: MetricName + Namespace + Statistic + Period
  Validate that a steady-state hypothesis exists for every critical/high-criticality service.
  Emit warning for medium/low services without hypothesis (non-blocking).
  Output: steady_state_hypotheses[] { service, metric_name, operator, threshold,
                                       measurement_window_s, probe_type, probe_query, abort_threshold }

Step 3 — Design experiment catalog per fault category
  For each fault category in experiment_scope[]:
    network:
      Enumerate: pod-network-latency (100ms, 500ms, 2000ms bands), packet-loss (5%, 20%, 100%),
                 network-partition (isolate service from specific dependency), dns-chaos (NXDOMAIN).
    compute:
      Enumerate: pod-kill (single instance), node-taint (NoSchedule drain),
                 cpu-hog (80%, 100%), memory-hog (80% RSS), disk-fill (90% inode exhaustion).
    application:
      Enumerate: container-kill (SIGKILL), container-pause (SIGSTOP), http-error-inject (503),
                 thread-starvation, slow-consumer (artificial lag).
    data:
      Enumerate: db-pod-kill (primary failover), db-connection-loss (partition on DB port),
                 disk-io-stress (latency on PVC), corrupt-payload-inject (upstream mock).
  For each experiment: assign initial blast_radius = service; link to ranked_failure_mode by name match.
  Apply escalation path: service → namespace → cluster (only if blast_radius_tolerance permits).
  Output: experiment_catalog[] { id, name, fault_category, fault_type, target_service,
                                  blast_radius, escalation_allowed, linked_failure_mode_rpn }

Step 4 — Compute blast radius analysis per experiment
  For each experiment in experiment_catalog[]:
    Identify direct blast scope: affected pods, replicas, or instances count.
    Trace dependency fan-out: which downstream services experience indirect failure.
    Compute blast_radius_score:
      (affected_critical_services × 3) + (affected_high_services × 2) + (affected_medium_services × 1)
    Flag experiment as HIGH_BLAST if blast_radius_score > 5 or blast_radius == "cluster".
    Enforce blast_radius_tolerance constraint:
      "cluster" scope requested but tolerance == "service" or "namespace": exclude; emit warning.
      "namespace" scope requested but tolerance == "service": exclude; emit warning.
  HIGH_BLAST experiments require HITL gate before scheduling.
  Output: blast_radius_analysis { experiments_analyzed, high_blast_count,
                                   excluded_experiments[], per_experiment_scores[] }

Step 5 — Design rollback procedures for every experiment
  For each experiment in (experiment_catalog minus excluded_experiments):
    Define automatic rollback trigger linked to steady_state_hypothesis abort_threshold:
      Example: "abort if http_request_error_rate > 0.05 sustained for 30s"
    Define platform-specific rollback action:
      LitmusChaos:  ChaosEngine .spec.jobCleanUpPolicy=delete; verify ChaosResult verdict=Stopped.
      Gremlin:      DELETE /attacks/{attack_id}; poll until attack.state == "Complete".
      AWS FIS:      StopExperiment API; poll until ExperimentState == "stopped".
      Chaos Mesh:   kubectl delete <CRD> <name>; verify pod label chaos=injecting removed.
    Set max_duration_s: default 300s; override to 60s for HIGH_BLAST experiments.
    Set cooldown_s: 120s after rollback completes before next experiment slot begins.
  Output: rollback_procedures[] { experiment_id, abort_condition, rollback_action,
                                   max_duration_s, cooldown_s }

Step 6 — Define observability requirements per experiment
  For each experiment:
    Identify required metrics to confirm steady-state hypothesis during fault injection:
      Minimum: error_rate, latency_p99, availability proxy (health check response time).
      Recommended: saturation (CPU%, memory RSS, connection pool utilization), throughput (RPS).
    Map each metric to observability_stack probe; verify data exists within last 5 minutes.
    Flag OBSERVABILITY_GAP if required metric has no active data:
      OBSERVABILITY_GAP blocks experiment scheduling.
      Emit backpropagate feedback entry targeting observability skill with gap details.
  Output: observability_requirements[] { experiment_id, required_metrics[], probe_queries[],
                                          observability_gaps[], gap_count }

Step 7 — Design scheduling plan and GameDay agenda
  Sort experiments: blast_radius_score ascending, then linked_failure_mode_rpn descending.
  Apply progressive escalation: service-scope before namespace-scope before cluster-scope.
  Build sequential schedule with buffers:
    slot_duration_s = max_duration_s + cooldown_s + 60  (60s observation window)
  Compose GameDay agenda phases:
    Phase 1 (0–60 min): Network faults on non-critical services. Phase 2 (60–120 min): Compute+app on high-criticality.
    Phase 3 (120–180 min): Dependency failures (DB kill, cache, queue). Phase 4 (180+ min): HIGH_BLAST (HITL required).
  If continuous_chaos == true:
    Select top 3 lowest-blast-radius experiments (blast_radius == "service" only) as CI suite.
    Combined CI suite runtime MUST be <= 300s; reject any candidate experiment exceeding budget.
    Generate GitHub Actions job YAML: trigger on push to staging branch; environment: staging only.
    Add chaos_gate step: fail pipeline if any steady_state_hypothesis threshold breaches detected.
  Output: scheduling_plan { phases[], total_duration_min, gameday_agenda, continuous_chaos_suite? }

Step 8 — Generate platform-native experiment specs
  For each experiment in scheduled plan:
    LitmusChaos: Emit ChaosEngine YAML (apiVersion: litmuschaos.io/v1alpha1, kind: ChaosEngine).
                 Include spec.chaosServiceAccount, spec.experiments[].spec.components.env[].
                 Embed ChaosProbe for steady-state validation (type: promProbe or cmdProbe).
    Gremlin:     Emit JSON attack definition { target: { type, labels }, command: { type, args } }.
    AWS FIS:     Emit ExperimentTemplate JSON { targets: {}, actions: {}, stopConditions: [] }.
                 stopConditions reference CloudWatch alarm ARNs from observability_requirements.
    Chaos Mesh:  Emit CRD YAML by fault type: NetworkChaos, PodChaos, IOChaos, or HTTPChaos.
                 Embed Workflow step with StatusCheck for steady-state probe.
  Output: experiments[] { id, name, platform, fault_category, blast_radius,
                           spec_yaml, pre_validation, post_validation }

Step 9 — Produce resilience scorecard
  For each service in services[]:
    experiments_targeting:       count of experiments with target_service == this service.
    blast_radius_score_max:      highest blast_radius_score among all targeting experiments.
    observability_gap_count:     sum of gap_count from observability_requirements for this service.
    excluded_experiment_count:   experiments excluded due to blast_radius_tolerance violation.
    gaps: enumerate as strings: "observability_gap: <metric>", "no_experiment_for: <category>".
    service_resilience_score: base=100 minus 10 per observability gap,
      minus 5 per excluded experiment, minus 15 if no hypothesis for critical/high service.
  overall_score = mean(service_resilience_score[]) rounded to integer.
  Flag services with service_resilience_score < 60 as "RESILIENCE_RISK".
  Output: resilience_scorecard { per_service[], overall_score, resilience_risk_services[] }
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `experiments` | `array` | Platform-native specs: `{ id, name, platform, fault_category, blast_radius, spec_yaml, pre_validation, post_validation }` |
| `steady_state_hypotheses` | `array` | Per-service hypothesis definitions with probe queries and abort thresholds |
| `blast_radius_analysis` | `object` | Per-experiment blast scores, HIGH_BLAST flags, and excluded experiment list |
| `observability_requirements` | `array` | Required metrics, probe queries, and identified observability gaps per experiment |
| `rollback_procedures` | `array` | Abort conditions, platform-specific rollback actions, max durations, and cooldowns |
| `scheduling_plan` | `object` | Phased GameDay agenda, total duration, and optional CI continuous chaos suite |
| `resilience_scorecard` | `object` | Per-service resilience scores, gap enumeration, and RESILIENCE_RISK flags |
| `metrics` | `object` | Execution metrics: tokens_in, tokens_out, duration_ms, items_produced, version |
| `feedback` | `array` | Backpropagation and informational feedback entries |

**Output Schema:**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["experiments", "steady_state_hypotheses", "blast_radius_analysis",
               "observability_requirements", "rollback_procedures", "scheduling_plan",
               "resilience_scorecard", "metrics", "feedback"],
  "properties": {
    "experiments": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "name", "platform", "spec_yaml"],
        "properties": {
          "id":              { "type": "string" },
          "name":            { "type": "string" },
          "platform":        { "type": "string", "enum": ["litmus", "gremlin", "aws_fis", "chaos_mesh"] },
          "fault_category":  { "type": "string", "enum": ["network", "compute", "application", "data"] },
          "blast_radius":    { "type": "string", "enum": ["service", "namespace", "cluster"] },
          "spec_yaml":       { "type": "string" },
          "pre_validation":  { "type": "string" },
          "post_validation": { "type": "string" }
        }
      }
    },
    "steady_state_hypotheses": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["service", "metric_name", "operator", "threshold"],
        "properties": {
          "service":              { "type": "string" },
          "metric_name":          { "type": "string" },
          "operator":             { "type": "string", "enum": ["lt", "gt", "lte", "gte", "eq"] },
          "threshold":            { "type": "number" },
          "measurement_window_s": { "type": "integer", "minimum": 10 },
          "probe_type":           { "type": "string", "enum": ["prometheus", "datadog", "cloudwatch"] },
          "probe_query":          { "type": "string" },
          "abort_threshold":      { "type": "number" }
        }
      }
    },
    "blast_radius_analysis": {
      "type": "object",
      "required": ["experiments_analyzed", "high_blast_count", "excluded_experiments", "per_experiment_scores"],
      "properties": {
        "experiments_analyzed":  { "type": "integer" },
        "high_blast_count":      { "type": "integer" },
        "excluded_experiments":  { "type": "array", "items": { "type": "string" } },
        "per_experiment_scores": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["experiment_id", "blast_radius_score", "high_blast"],
            "properties": {
              "experiment_id":      { "type": "string" },
              "blast_radius_score": { "type": "integer" },
              "high_blast":         { "type": "boolean" }
            }
          }
        }
      }
    },
    "observability_requirements": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["experiment_id", "required_metrics"],
        "properties": {
          "experiment_id":      { "type": "string" },
          "required_metrics":   { "type": "array", "items": { "type": "string" } },
          "probe_queries":      { "type": "array", "items": { "type": "string" } },
          "observability_gaps": { "type": "array", "items": { "type": "string" } },
          "gap_count":          { "type": "integer", "minimum": 0 }
        }
      }
    },
    "rollback_procedures": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["experiment_id", "abort_condition", "rollback_action", "max_duration_s"],
        "properties": {
          "experiment_id":   { "type": "string" },
          "abort_condition": { "type": "string" },
          "rollback_action": { "type": "string" },
          "max_duration_s":  { "type": "integer", "minimum": 30, "maximum": 3600 },
          "cooldown_s":      { "type": "integer", "minimum": 30 }
        }
      }
    },
    "scheduling_plan": {
      "type": "object",
      "required": ["phases", "total_duration_min"],
      "properties": {
        "phases":                 { "type": "array" },
        "total_duration_min":     { "type": "integer" },
        "gameday_agenda":         { "type": "string" },
        "continuous_chaos_suite": { "type": "object" }
      }
    },
    "resilience_scorecard": {
      "type": "object",
      "required": ["per_service", "overall_score"],
      "properties": {
        "per_service": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["service", "service_resilience_score"],
            "properties": {
              "service":                  { "type": "string" },
              "service_resilience_score": { "type": "integer", "minimum": 0, "maximum": 100 },
              "blast_radius_score_max":   { "type": "integer" },
              "observability_gap_count":  { "type": "integer" },
              "gaps":                     { "type": "array", "items": { "type": "string" } }
            }
          }
        },
        "overall_score":            { "type": "integer", "minimum": 0, "maximum": 100 },
        "resilience_risk_services": { "type": "array", "items": { "type": "string" } }
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
        "tokens_in":            { "type": "integer" },
        "tokens_out":           { "type": "integer" },
        "duration_ms":          { "type": "integer" },
        "items_produced":       { "type": "integer" },
        "experiments_designed": { "type": "integer" },
        "version":              { "type": "string" }
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

- Every experiment MUST define a `steady_state_hypothesis` with a quantitative, measurable threshold before any spec is emitted — qualitative descriptions ("the system should be healthy") are rejected as incomplete.
- Rollback procedures MUST be designed and verified resolvable before any experiment spec is included in the scheduling plan — an experiment without a defined abort condition and rollback action is categorically rejected.
- Experiments targeting `blast_radius == "cluster"` are prohibited in any environment unless the cluster-scope HITL gate has been explicitly cleared by a named human approver.
- Blast radius MUST default to the smallest scope sufficient to validate the target failure mode — escalation to `namespace` or `cluster` requires documented justification in the experiment `spec_yaml` comments.
- Experiments MUST only target environments labeled `staging` or `canary` by default; `context.environment == "production"` requires explicit human confirmation AND a cleared production-chaos HITL gate.
- The `continuous_chaos` CI suite MUST contain at most 3 experiments with combined runtime <= 300 seconds; any candidate experiment exceeding this budget is excluded with an `info` feedback entry.
- All `OBSERVABILITY_GAP` findings MUST be emitted as `backpropagate` feedback targeting the `observability` skill before the scheduling plan is finalized — gaps block their associated experiments.

## Security Considerations

- Chaos experiment execution credentials (Kubernetes ServiceAccount tokens, Gremlin API keys, AWS IAM roles for FIS) MUST follow least-privilege — agents must hold no write permissions outside the declared target namespace or resource ARN scope.
- Experiment authorization MUST be enforced by a named approval workflow (pull request approval, change ticket reference, or HITL gate sign-off) before any spec is passed to an execution engine — auto-execution of unapproved experiments is prohibited.
- Blast radius containment boundaries MUST be validated against live infrastructure topology immediately before experiment start — pod selector matches, namespace membership, and resource group bindings must be confirmed to prevent scope creep beyond declared targets.
- Experiment audit logs — including approver identity, spec hash, start timestamp, abort timestamp, and steady-state probe results — MUST be written to an immutable, append-only log store before experiment teardown completes; log write failures abort the experiment.

## Token Optimization

- Compress the `services` input to `{ name, criticality, dependencies[] }` only before processing — strip label selectors, deployment annotations, and environment-specific metadata; resolve those from state in Step 8 when generating platform-native specs.
- Emit `spec_yaml` as abbreviated templates with `{{PLACEHOLDER}}` markers for variable fields (namespace, pod selector, duration, resource ARN); write fully resolved specs to state files, not inline in the output payload.
- Limit experiment catalog generation to the top 20 failure modes ranked by RPN; set `blast_radius_analysis.truncated: true` and include the total unprocessed count if the full FMEA table exceeds 20 entries.

## Quality Checklist

- [ ] Every service with `criticality == "critical"` or `"high"` has at least one steady-state hypothesis with a quantitative threshold
- [ ] Every experiment in the scheduling plan has a corresponding rollback procedure with a quantitative abort condition
- [ ] Blast radius analysis has been computed and all HIGH_BLAST experiments are explicitly flagged
- [ ] No experiment with `blast_radius == "cluster"` appears in the scheduling plan without a cleared HITL gate record
- [ ] All OBSERVABILITY_GAP findings are reported as `backpropagate` feedback entries targeting `observability`
- [ ] Platform-native spec YAML is emitted for every non-excluded scheduled experiment
- [ ] Resilience scorecard covers all services listed in the `services` input and flags any with score < 60

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| No `resilience_spec` found in state | Emit `backpropagate` targeting `distributed-resilience-architect`; halt with `{"error": "MISSING_RESILIENCE_BASELINE"}` |
| Experiment escapes declared blast radius during runtime | Automatic platform rollback; log event as `BLAST_RADIUS_BREACH`; suspend all remaining experiments pending HITL review |
| Rollback action fails (agent unreachable or API error) | Emit critical feedback; flag experiment as `ROLLBACK_FAILED`; halt all subsequent experiments in the current session |
| Steady state cannot be established pre-experiment due to observability gap | Block that experiment; emit `backpropagate` to `observability`; advance to next viable experiment in schedule |

## 12. Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Behavior |
|------|---------|---------|----------|
| Cluster-scope experiment approval | Any experiment with `blast_radius == "cluster"` OR `blast_radius_tolerance == "cluster"` | 7200s | Pause; present full blast radius analysis, rollback procedure, and abort conditions for mandatory named-approver sign-off; experiment is excluded from scheduling plan until gate clears |
| Continuous chaos in production | `continuous_chaos == true` AND `context.environment == "production"` | 3600s | Block; require explicit human confirmation with named approver identity recorded; emit warning that production continuous chaos requires a 30-day canary observation period and a cleared security review before activation |

## 13. Skill Composition

`chaos-engineering-designer` slots after `distributed-resilience-architect` and `slo-sla-designer`, producing inputs consumed by `runbook-generator` and `observability`:

```yaml
composes_with:
  - skill: distributed-resilience-architect
    role: upstream
    note: "provides fmea_report.failure_modes[] and chaos_scenarios[] as the risk-ranked experiment catalog"
  - skill: slo-sla-designer
    role: upstream
    note: "provides slo_targets used to define steady-state hypothesis thresholds and abort conditions"
  - skill: runbook-generator
    role: downstream
    note: "consumes rollback_procedures and scheduling_plan to generate operational runbooks"
  - skill: observability
    role: downstream
    note: "consumes observability_requirements to verify metrics are instrumented before experiments run"

emits_events:
  - chaos_experiment.designed
  - chaos_experiment.gameday_plan_ready
  - chaos_experiment.resilience_risk_flagged
```

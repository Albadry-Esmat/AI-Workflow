---
name: slo-sla-designer
version: 1.0.0
domain: deployment
description: >
  Use when defining Service Level Objectives, Service Level Indicators, and error budgets for
  production services. Triggers on: "SLO design", "SLI definition", "error budget policy",
  "burn rate alerting", "SLA tier design", "reliability targets", "availability targets",
  "multi-window burn rate". Do NOT use for infrastructure capacity planning or deployment
  configuration — use deployment-strategy instead.
author: system
---

## Purpose

The slo-sla-designer skill produces the complete reliability measurement framework for production services: SLI metric definitions, SLO targets calibrated to business criticality, error budget calculations, multi-window burn-rate alerting rules, external SLA tier commitments, toil identification inventories, and a sequenced reliability improvement roadmap. It operationalizes the Google SRE book's reliability engineering model into concrete, platform-specific configuration artifacts.

SLI definitions are emitted as runnable metric queries for the specified monitoring platform: Prometheus recording rules with `record: service:sli_availability:ratio_rate5m`, Datadog metric monitors with `avg(last_5m):sum:trace.web.request.hits{status:5xx}` expressions, CloudWatch metric math combining `(RequestCount - ErrorCount) / RequestCount`, and Dynatrace/New Relic NRQL equivalents. Each SLI is typed as one of: availability (successful request ratio), latency (histogram percentile), throughput (request rate), saturation (resource utilization), or correctness (data integrity for data pipelines).

Error budget alerting follows the Google SRE multi-window, multi-burn-rate model: four alert conditions with two severity levels (page and ticket) across four time windows (1h, 6h, 1d, 3d), consuming 2%, 5%, 10%, and 10% of the monthly error budget respectively when burn rates of 14×, 6×, 3×, and 1× are sustained. This model balances alerting sensitivity with precision, eliminating false positives from transient spikes while catching sustained degradations early. The skill also bridges into SLA definitions for external customers, translating internal SLO targets into customer-facing commitments with appropriate safety margins.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `services` | `array` | Yes | Services to design for: `{ service_name, criticality: tier1|tier2|tier3, user_facing: bool, description? }` |
| `monitoring_platform` | `string` | No | Platform: `prometheus`, `datadog`, `cloudwatch`, `dynatrace`, `newrelic`. Default: `prometheus` |
| `existing_metrics` | `array[string]` | No | Available metric names to use in SLI queries (avoids inventing metric names) |
| `sla_tiers` | `array` | No | Customer tiers: `{ tier_name, customer_type, expected_availability_pct }` |
| `error_budget_policy` | `string` | No | Policy on budget exhaustion: `pause_deploys`, `alert_only`, `burn_down`. Default: `alert_only` |
| `context` | `object` | No | `{ organization, product, compliance_requirements[], window_days? }` |

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
        "required": ["service_name", "criticality", "user_facing"],
        "properties": {
          "service_name": { "type": "string" },
          "criticality": { "type": "string", "enum": ["tier1", "tier2", "tier3"] },
          "user_facing": { "type": "boolean" },
          "description": { "type": "string" }
        }
      }
    },
    "monitoring_platform": {
      "type": "string",
      "enum": ["prometheus", "datadog", "cloudwatch", "dynatrace", "newrelic"],
      "default": "prometheus"
    },
    "existing_metrics": {
      "type": "array",
      "items": { "type": "string" }
    },
    "sla_tiers": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["tier_name", "customer_type"],
        "properties": {
          "tier_name": { "type": "string" },
          "customer_type": { "type": "string" },
          "expected_availability_pct": { "type": "number", "minimum": 90, "maximum": 100 }
        }
      }
    },
    "error_budget_policy": {
      "type": "string",
      "enum": ["pause_deploys", "alert_only", "burn_down"],
      "default": "alert_only"
    },
    "context": {
      "type": "object",
      "properties": {
        "organization": { "type": "string" },
        "product": { "type": "string" },
        "compliance_requirements": {
          "type": "array",
          "items": { "type": "string", "enum": ["soc2", "hipaa", "pci_dss", "iso27001"] }
        },
        "window_days": { "type": "integer", "minimum": 7, "maximum": 90, "default": 30 }
      }
    }
  }
}
```

## Required Context

- `services[].criticality` drives SLO target calibration: tier1 (business-critical, user-facing) → 99.9%–99.99%; tier2 (important, user-facing) → 99.5%–99.9%; tier3 (internal, best-effort) → 99.0%–99.5%.
- `existing_metrics` prevents the skill from generating placeholder metric names that don't exist in the monitoring platform — always prefer using real metrics.
- `error_budget_policy=pause_deploys` requires integration with a deployment gate; the skill emits a `backpropagate` to deployment-strategy noting the freeze mechanism needed.
- `window_days` defaults to 30 (calendar-month rolling window per Google SRE convention); 7-day and 28-day windows are also valid.

## Execution Logic

```
Step 1 — Classify services and determine SLO target ranges
  tier1 + user_facing=true:  availability SLO = 99.9% (8.7h downtime/year budget).
                              latency SLO = p99 < 500ms (or existing baseline - 20%).
  tier1 + user_facing=false: availability SLO = 99.5%.
  tier2 + user_facing=true:  availability SLO = 99.5%.
  tier2 + user_facing=false: availability SLO = 99.0%.
  tier3 (any):               availability SLO = 99.0%.
  Compute error_budget_minutes = (1 - slo_pct/100) × window_days × 24 × 60.
    99.9% / 30d = 43.2 minutes. 99.5% / 30d = 216 minutes. 99.0% / 30d = 432 minutes.
  Output: service_classifications[] { service_name, slo_pct, error_budget_minutes, window_days }

Step 2 — Define SLI metric queries per monitoring platform
  Availability SLI = (total_requests - error_requests) / total_requests
    prometheus: record: job:sli_availability:ratio_rate5m
                expr: sum(rate(http_requests_total{status!~"5.."}[5m])) by (job)
                      / sum(rate(http_requests_total[5m])) by (job)
    datadog:    query: sum:trace.web.request.hits{!status:error}.as_rate()
                       / sum:trace.web.request.hits{*}.as_rate()
    cloudwatch: (RequestCount - HTTPCode_Target_5XX_Count) / RequestCount (metric math)
    newrelic:   NRQL: SELECT percentage(count(*), WHERE error IS FALSE) FROM Transaction
  Latency SLI = histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))
    prometheus: histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, job))
    datadog:    percentile(99):trace.web.request{*}
  Saturation SLI = 1 - avg(container_memory_working_set_bytes / container_spec_memory_limit_bytes)
  Output: sli_definitions[] { service, sli_type, indicator_name, metric_query, measurement_window }

Step 3 — Generate error budget recording rules and current burn rate metrics
  For Prometheus, emit additional recording rules:
    job:error_budget_remaining:ratio = 1 - (1 - job:sli_availability:ratio_rate30d) / (1 - slo_target)
    job:error_budget_burn_rate:ratio_rate1h = (1 - job:sli_availability:ratio_rate1h) / (1 - slo_target)
    job:error_budget_burn_rate:ratio_rate6h = (1 - job:sli_availability:ratio_rate6h) / (1 - slo_target)
  For Datadog: emit SLO widget configuration JSON with rolling 30-day window.
  For CloudWatch: emit CloudWatch Composite Alarm and metric math for burn rate.
  Output: error_budget_recording_rules[] { service, rule_name, expr_or_query }

Step 4 — Generate multi-window, multi-burn-rate alerting rules (Google SRE model)
  Four alert conditions derived from error budget consumption math:
    PAGE (fast burn):   window=1h  AND burn_rate > 14.4  → 2% budget consumed in 1h  → fire!
    PAGE (slow burn):   window=6h  AND burn_rate > 6     → 5% budget consumed in 6h  → fire!
    TICKET (medium):    window=1d  AND burn_rate > 3     → 10% budget consumed in 1d → ticket
    TICKET (slow):      window=3d  AND burn_rate > 1     → 10% budget consumed in 3d → ticket
  Prometheus alerting rules format:
    - alert: SLOFastBurnPage
      expr: job:error_budget_burn_rate:ratio_rate1h{job="<svc>"} > 14.4
            AND job:error_budget_burn_rate:ratio_rate5m{job="<svc>"} > 14.4
      for: 2m
      labels: { severity: page, slo: availability }
      annotations: { summary: "Fast burn: >14.4× budget consumption rate", runbook: "<url>" }
  Datadog: monitor with multi_alert formula across 1h and 6h windows.
  Output: error_budget_rules[] { service, alert_name, severity, burn_rate_threshold,
                                  window, budget_consumed_pct, alert_query }

Step 5 — Define SLA tiers for external customers
  For each sla_tier: apply SLO safety margin of -0.1% to -0.5% below internal SLO target:
    tier1 SLO 99.9% → Enterprise SLA commitment = 99.5% (safety margin for measurement error)
    tier2 SLO 99.5% → Business SLA commitment = 99.0%
    tier3 SLO 99.0% → Standard SLA commitment = 98.0%
  Include: measurement_window, exclusions (maintenance windows, force majeure), credit_policy:
    uptime < SLA by 0.1–1%: 10% service credit. By 1–5%: 25%. By >5%: 50%.
  Output: sla_definitions[] { tier_name, availability_pct, response_time_sla_ms, window,
                               exclusions[], credit_table[], measurement_methodology }

Step 6 — Identify toil and automation opportunities
  Classify operational work against toil criteria (Google SRE: manual, repetitive, automatable,
    tactical, no enduring value, O(n) growth with service scale):
    - Manual deployment health checks after each release → automate with smoke test + canary
    - Manual log parsing for on-call triage → automate with structured logging + alert correlation
    - Manual certificate renewal reminders → automate with cert-manager / ACM auto-renewal
    - Manual database backup verification → automate with backup restore tests in CI
    - Manual scaling adjustments during traffic events → automate with HPA + KEDA
  Compute toil_pct = estimated toil hours / total on-call hours per month.
  Output: toil_items[] { toil_description, estimated_hours_per_month, automation_approach,
                          automation_tool, effort_weeks, toil_pct_reduction }

Step 7 — Produce reliability improvement roadmap
  Phase 1 (0–4 weeks):  Deploy SLI recording rules and dashboards. Set up error budget tracking.
  Phase 2 (4–8 weeks):  Implement multi-window burn-rate alerting. Wire to PagerDuty/OpsGenie.
  Phase 3 (8–16 weeks): Eliminate top toil items. Implement error budget freeze policy if applicable.
  Phase 4 (16+ weeks):  Raise SLO targets for tier1 services after 3 consecutive months > SLO.
  Output: reliability_roadmap[] { phase, title, duration, actions[], success_metric }
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `sli_definitions` | `array` | `{ service, sli_type, indicator_name, metric_query, measurement_window }` |
| `slo_targets` | `array` | `{ service, slo_pct, window_days, error_budget_minutes, rationale }` |
| `error_budget_rules` | `array` | `{ service, alert_name, severity, burn_rate_threshold, window, alert_query }` |
| `sla_definitions` | `array` | `{ tier_name, availability_pct, response_time_sla_ms, exclusions[], credit_table[] }` |
| `toil_items` | `array` | `{ toil_description, estimated_hours_per_month, automation_approach, toil_pct_reduction }` |
| `reliability_roadmap` | `array` | Phased improvement plan: `{ phase, title, duration, actions[], success_metric }` |
| `metrics` | `object` | Execution metrics |
| `feedback` | `array` | Backpropagation and advisory entries |

**Output Schema:**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["sli_definitions", "slo_targets", "error_budget_rules",
               "toil_items", "reliability_roadmap", "metrics", "feedback"],
  "properties": {
    "sli_definitions": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["service", "sli_type", "indicator_name", "metric_query", "measurement_window"],
        "properties": {
          "service": { "type": "string" },
          "sli_type": { "type": "string", "enum": ["availability", "latency", "throughput", "saturation", "correctness"] },
          "indicator_name": { "type": "string" },
          "metric_query": { "type": "string" },
          "measurement_window": { "type": "string" }
        }
      }
    },
    "slo_targets": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["service", "slo_pct", "window_days", "error_budget_minutes"],
        "properties": {
          "service": { "type": "string" },
          "slo_pct": { "type": "number" },
          "window_days": { "type": "integer" },
          "error_budget_minutes": { "type": "number" },
          "rationale": { "type": "string" }
        }
      }
    },
    "error_budget_rules": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["service", "alert_name", "severity", "burn_rate_threshold", "window"],
        "properties": {
          "service": { "type": "string" },
          "alert_name": { "type": "string" },
          "severity": { "type": "string", "enum": ["page", "ticket"] },
          "burn_rate_threshold": { "type": "number" },
          "window": { "type": "string" },
          "budget_consumed_pct": { "type": "number" },
          "alert_query": { "type": "string" }
        }
      }
    },
    "sla_definitions": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "tier_name": { "type": "string" },
          "availability_pct": { "type": "number" },
          "response_time_sla_ms": { "type": "number" },
          "exclusions": { "type": "array", "items": { "type": "string" } },
          "credit_table": { "type": "array" }
        }
      }
    },
    "toil_items": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "toil_description": { "type": "string" },
          "estimated_hours_per_month": { "type": "number" },
          "automation_approach": { "type": "string" },
          "automation_tool": { "type": "string" },
          "effort_weeks": { "type": "integer" },
          "toil_pct_reduction": { "type": "number" }
        },
        "required": ["toil_description", "automation_approach"]
      }
    },
    "reliability_roadmap": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "phase": { "type": "integer" },
          "title": { "type": "string" },
          "duration": { "type": "string" },
          "actions": { "type": "array", "items": { "type": "string" } },
          "success_metric": { "type": "string" }
        },
        "required": ["phase", "title", "actions"]
      }
    },
    "metrics": {
      "type": "object",
      "properties": {
        "tokens_in": { "type": "integer" },
        "tokens_out": { "type": "integer" },
        "duration_ms": { "type": "integer" },
        "services_processed": { "type": "integer" },
        "sli_definitions_produced": { "type": "integer" },
        "alert_rules_generated": { "type": "integer" },
        "version": { "type": "string" }
      },
      "required": ["tokens_in", "tokens_out", "duration_ms", "services_processed", "version"]
    },
    "feedback": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "type": { "type": "string", "enum": ["backpropagate", "info", "warning"] },
          "from_skill": { "type": "string" },
          "target_skill": { "type": "string" },
          "reason": { "type": "string" }
        },
        "required": ["type", "from_skill", "reason"]
      }
    }
  }
}
```

## Rules & Constraints

- SLO targets MUST apply a service criticality tier mapping — never set all services to the same arbitrary SLO percentage.
- Error budget burn rate thresholds MUST follow the Google SRE multi-window model exactly: 14.4× (1h), 6× (6h), 3× (1d), 1× (3d). Deviations require explicit rationale in feedback.
- SLA external commitments MUST be at least 0.1% below the internal SLO target to preserve a safety margin; never commit externally to exactly the internal target.
- `error_budget_policy=pause_deploys` MUST emit a `backpropagate` to deployment-strategy documenting the freeze gate mechanism required.
- Prometheus recording rules for burn rates MUST cover 5m, 30m, 1h, 6h, 1d, and 3d windows to support all four alert conditions.
- Toil items MUST be classified against the five Google SRE toil criteria (manual, repetitive, automatable, tactical, O(n) growth); items failing fewer than 3 criteria are reclassified as overhead, not toil.
- Do NOT suggest SLO targets above 99.99% without explicit tier1 justification — four-nines requires dedicated reliability engineering investment.

## Security Considerations

- SLI metric queries must not expose secrets, API keys, or PII in label selectors — use only service/job/namespace labels.
- SLA tier definitions containing customer-specific commitments are confidential business documents — mark them as such in the output `context` metadata.
- Error budget dashboards showing current burn rates must be access-controlled to the service team — note this in the reliability roadmap.

## Token Optimization

- Pass `existing_metrics` as a flat list of metric name strings — no descriptions needed; the skill infers SLI mapping from naming conventions.
- Omit `sla_tiers` if external SLA commitments are not needed; this removes the entire Step 5 execution branch.
- Request a single `monitoring_platform` per invocation; multi-platform output can be achieved by calling the skill twice.

## Quality Checklist

- [ ] Every service has at least one availability SLI and one latency SLI defined
- [ ] Error budget calculated in minutes (not percentage only) for each service
- [ ] All four multi-window burn-rate alert rules present for each tier1 service
- [ ] External SLA availability commitment is >= 0.1% below internal SLO target for every tier
- [ ] Toil items reference specific automation tools and estimated effort
- [ ] Reliability roadmap has at least 3 phases with measurable success criteria
- [ ] `monitoring_platform` query syntax is correct for the declared platform
- [ ] `error_budget_policy` effect is documented in feedback if it is `pause_deploys`

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| `existing_metrics` not provided | Generate canonical metric name stubs (e.g., `http_requests_total`); emit `warning` noting these must be validated against actual instrumentation |
| `services` contains only tier3 services | Generate 99.0% SLO targets with 2-window burn-rate alerts (page + ticket only); emit `info` noting simplified alerting is appropriate |
| `error_budget_policy=pause_deploys` with no deployment system context | Emit the SLO config; emit `backpropagate` to deployment-strategy to add the freeze gate mechanism |
| `monitoring_platform` not recognized | Default to `prometheus`; emit `warning` noting the override |
| No `sla_tiers` provided | Skip SLA definitions; emit `info` noting external SLA output requires `sla_tiers` input |

## 12. Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Behavior |
|------|---------|---------|----------|
| SLO target above 99.99% suggested | Any tier1 service computed SLO >= 99.99% | 3600s | Pause; present cost/engineering implications of four-nines reliability; require human confirmation |
| error_budget_policy=pause_deploys selected | `error_budget_policy` is `pause_deploys` | 1800s | Present impact on release velocity to human; require explicit acknowledgment before emitting config |

## 13. Skill Composition

```yaml
composes_with:
  - skill: observability
    role: downstream
    note: "observability skill instruments the SLI recording rules into the monitoring platform"
  - skill: load-test-designer
    role: downstream
    note: "load-test-designer receives slo_targets[] to parameterize acceptance thresholds"
  - skill: runbook-generator
    role: downstream
    note: "runbook-generator uses error_budget_rules[] alert names to link alerts to runbooks"
  - skill: deployment-strategy
    role: sibling
    note: "deployment-strategy receives error_budget_policy to implement deploy-freeze gates"

input_from_state:
  - scope: architecture
    field: services[*].name
    maps_to: services[*].service_name
  - scope: deployment_strategy
    field: environments[*].monitoring_platform
    maps_to: monitoring_platform

emits_events:
  - slo.designed
  - slo.freeze_policy.requires_gate
  - slo.four_nines.requested
```

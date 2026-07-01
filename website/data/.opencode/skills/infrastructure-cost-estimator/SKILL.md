---
name: infrastructure-cost-estimator
version: 1.0.0
domain: deployment
description: 'Use when estimating monthly cloud infrastructure costs from a deployment plan before provisioning resources. Triggers on: "infrastructure cost estimate", "monthly cloud spend", "AWS vs GCP vs Azure cost", "cost of this deployment", "infrastructure pricing", "cloud cost comparison", "budget estimate for infrastructure". Do NOT use when the deployment plan has not yet been produced — run deployment-strategy first.'
author: system
---

## Purpose

Produce a monthly cloud infrastructure cost projection from `deployment-strategy` output before any resource is provisioned. The skill maps compute, storage, database, CDN, and network resources to standard cloud SKUs for AWS, GCP, and Azure using built-in public list-price reference tables (2026 rates). It generates a recommended configuration, two price/performance alternatives (budget and premium), specific cost optimisation suggestions, and recommended monitoring alert thresholds. Output is presented alongside the deployment approval HITL gate so teams can make cost-informed infrastructure decisions.

**Pricing disclaimer:** Estimates are based on public list prices and are for reference only. Actual costs are affected by reserved instance commitments, sustained-use discounts, data transfer actuals, and negotiated enterprise agreements. Always verify with the cloud provider's pricing calculator before committing to infrastructure.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `deployment_plan` | `object` | Yes | Output from `deployment-strategy`: environments, compute specs, DB config, storage, CDN, regions |
| `traffic_profile` | `object` | No | `requests_per_day` (integer), `data_transfer_gb_month` (number), `peak_multiplier` (number, default: 2.0) |
| `cloud_preferences` | `array[string]` | No | Providers to estimate — subset of `["AWS","GCP","Azure"]` (default: all three) |
| `optimization_target` | `string` | No | `"cost"` \| `"performance"` \| `"balanced"` (default: `"balanced"`) |
| `currency` | `string` | No | ISO-4217 currency code (default: `"USD"`) — note: all internal prices are USD; other currencies use indicative exchange rates |
| `requirements` | `array[object]` | No | Structured requirements from `requirement-analyzer` — used for cost-per-feature apportionment when provided |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "deployment_plan": {
      "type": "object",
      "properties": {
        "environments": { "type": "array" },
        "compute":      { "type": "array" },
        "database":     { "type": "object" },
        "storage":      { "type": "object" },
        "cdn":          { "type": "object" },
        "regions":      { "type": "array", "items": { "type": "string" } }
      },
      "required": ["environments"]
    },
    "traffic_profile": {
      "type": "object",
      "properties": {
        "requests_per_day":        { "type": "integer", "minimum": 0 },
        "data_transfer_gb_month":  { "type": "number", "minimum": 0 },
        "peak_multiplier":         { "type": "number", "minimum": 1, "maximum": 20, "default": 2.0 }
      }
    },
    "cloud_preferences": {
      "type": "array",
      "items": { "type": "string", "enum": ["AWS", "GCP", "Azure"] },
      "default": ["AWS", "GCP", "Azure"]
    },
    "optimization_target": {
      "type": "string",
      "enum": ["cost", "performance", "balanced"],
      "default": "balanced"
    },
    "currency": { "type": "string", "default": "USD" },
    "requirements": { "type": "array" }
  },
  "required": ["deployment_plan"]
}
```

## Required Context

- `deployment-strategy@^1.1.0` output is required — the `deployment_plan` input must include at minimum `environments` and at least one of: `compute`, `database`, `storage`.
- `architecture-design@^1.3.0` output is recommended for cost-per-feature apportionment (provides module-to-feature mapping).
- No external API calls are made — pricing is based on internal static reference tables.

## Execution Logic

```
Step 1 — Parse and normalise deployment plan
  Extract resource manifest from deployment_plan:
    compute[]:  { name, cpu_vcpu, ram_gb, instance_count, environment, workload_type }
    storage[]:  { name, gb, tier (standard|archival|premium), type (object|block|file) }
    database[]: { name, engine, tier (managed|self-hosted), vcpu, ram_gb, storage_gb }
    cdn:        { enabled, data_transfer_gb_month }
    regions[]:  list of cloud regions (count determines multi-region multiplier)
  If spec fields are missing: infer from environment tier:
    "small":  compute = 2 vCPU / 4 GB / 1 instance
    "medium": compute = 4 vCPU / 16 GB / 2 instances
    "large":  compute = 8 vCPU / 32 GB / 3 instances
  Set confidence: high (all specs present), medium (some inferred), low (mostly inferred)
  Output: normalised_resources, confidence_level

Step 2 — Apply traffic profile multipliers
  network_transfer_gb = traffic_profile.data_transfer_gb_month or (requests_per_day × 0.001 × 30)
  peak_compute_factor = 1 + (peak_multiplier - 1) × 0.10
    (peak multiplier applies for 10% of monthly hours — conservative sizing)
  cdn_transfer_gb = cdn.data_transfer_gb_month or network_transfer_gb × 0.60
  Output: scaled_resources

Step 3 — Calculate cost per provider
  For each provider in cloud_preferences:
    Load provider pricing table (built-in reference, on-demand rates, 2026):
      AWS:   general-purpose compute $0.0464/vCPU-hour, $0.0058/GB-RAM-hour
             standard storage $0.023/GB-month
             managed RDS postgres $0.138/vCPU-hour
             egress $0.09/GB, CloudFront CDN $0.0085/GB
      GCP:   general-purpose compute $0.0475/vCPU-hour, $0.0064/GB-RAM-hour
             standard storage $0.020/GB-month
             Cloud SQL postgres $0.145/vCPU-hour
             egress $0.08/GB, Cloud CDN $0.0080/GB
      Azure: general-purpose compute $0.0480/vCPU-hour, $0.0060/GB-RAM-hour
             standard storage $0.018/GB-month
             Azure DB postgres $0.142/vCPU-hour
             egress $0.087/GB, Azure CDN $0.0090/GB
    Compute cost:
      = Σ (instance.vcpu × vcpu_rate + instance.ram_gb × ram_rate)
        × instance_count × 730 hours × peak_compute_factor
    Storage cost:
      = Σ (storage.gb × tier_rate[storage.tier])
    Database cost:
      = Σ (db.vcpu × db_vcpu_rate + db.ram_gb × db_ram_rate) × 730
        + db.storage_gb × storage_standard_rate
    Network cost:
      = network_transfer_gb × egress_rate
    CDN cost (if cdn.enabled):
      = cdn_transfer_gb × cdn_rate
    Region multiplier:
      = 1.0 for single region
      = 1.8 for 2 regions (active-passive)
      = 2.5 for 3+ regions (active-active)
    Staging overhead:
      = (compute_cost + storage_cost) × 0.30 (staging = 30% of production)
    Monthly estimate:
      = (compute_cost + storage_cost + database_cost + network_cost + cdn_cost)
        × region_multiplier + staging_overhead
    Breakdown:
      { compute, storage, db, network, cdn, staging, total }
    Output: provider_estimate { provider, monthly_estimate_usd, breakdown, confidence }

Step 4 — Select recommended configuration
  optimization_target == "cost"        → lowest monthly_estimate_usd provider, baseline config
  optimization_target == "performance" → provider with best SLA reputation (AWS us-east-1 > GCP us-central1 > Azure eastus), premium config
  optimization_target == "balanced"    → median-cost provider, baseline config
  Generate justification string
  Output: recommended_config

Step 5 — Generate alternative configurations
  Budget config (target ~50% of recommended baseline):
    Changes: single-region, auto-scaling min=1 instance, remove staging environment,
             downgrade DB to smallest tier, disable CDN
    Estimate: apply changes to normalised_resources and recalculate for recommended provider
    Label: "budget"
    Description: "Reduced redundancy. Suitable for non-production or early-stage deployments."

  Premium config (target ~2× recommended baseline):
    Changes: multi-region active-active (3 regions), 3+ instances per service,
             DB with 2 read replicas, premium CDN tier, dedicated compute tier
    Estimate: apply changes to normalised_resources and recalculate for recommended provider
    Label: "premium"
    Description: "Full HA, multi-region. Suitable for regulated or high-availability requirements."
  Output: alternative_configs list

Step 6 — Identify cost optimisation suggestions
  Evaluate applicable suggestions from catalogue:
    - Spot/preemptible instances for batch workloads (if workload_type=batch detected): up to 70% compute savings
    - Committed use discounts / reserved instances for always-on workloads: up to 60% compute savings
    - S3 Intelligent Tiering / GCS Autoclass for object storage > 50 GB: up to 40% storage savings
    - Reduce multi-region to active-passive if SLA allows: 40% compute savings
    - Downgrade staging DB to dev tier: estimate $X/month savings
    - Enable CDN compression to reduce data transfer volume: up to 30% network savings
  Select top 3 most impactful suggestions (by estimated savings amount)
  Output: cost_optimization_suggestions (max 5, min 1)

Step 7 — Cost per feature apportionment (if requirements provided)
  For each feature in requirements:
    Identify implementing modules from architecture (or infer from requirement domain)
    Compute module_weight = (module.vcpu + module.ram_gb × 0.5) / total_resource_weight
    feature_monthly_cost = recommended_config.monthly_estimate_usd × module_weight
  Output: cost_per_feature list

Step 8 — Set budget alert thresholds
  baseline = recommended_config.monthly_estimate_usd
  alert_thresholds = {
    alert_80pct:  round(baseline × 0.80, 2),
    alert_100pct: round(baseline, 2),
    alert_120pct: round(baseline × 1.20, 2)
  }
  Output: budget_alert_thresholds

Step 9 — Check feedback triggers
  If recommended_config.monthly_estimate_usd > session.budget_constraint (if set):
    Emit feedback: cost_exceeds_budget_constraint to deployment-strategy
  If max(cost_estimates.monthly_estimate_usd) / min(cost_estimates.monthly_estimate_usd) > 1.5:
    Emit feedback: cost_differential_exceeds_50pct_across_providers to orchestrator
  Output: feedback entries

Step 10 — Assemble output
  Return: cost_estimates, recommended_config, alternative_configs,
          cost_optimization_suggestions, cost_per_feature (if computed),
          budget_alert_thresholds, metrics, feedback
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `cost_estimates` | `array[object]` | Per provider: `provider`, `monthly_estimate_usd`, `breakdown`, `confidence` |
| `recommended_config` | `object` | Best option for `optimization_target` with `provider`, `monthly_estimate_usd`, `justification` |
| `alternative_configs` | `array[object]` | Two alternatives: `label` (budget/premium), `monthly_estimate_usd`, `changes`, `description` |
| `cost_optimization_suggestions` | `array[object]` | Specific savings opportunities: `suggestion`, `estimated_saving_pct`, `effort` |
| `cost_per_feature` | `array[object]` | Optional — feature cost attribution when `requirements` provided |
| `budget_alert_thresholds` | `object` | `alert_80pct`, `alert_100pct`, `alert_120pct` in USD |
| `metrics` | `object` | **REQUIRED.** Execution metrics including `pricing_tables_version` |
| `feedback` | `array[object]` | **REQUIRED.** Feedback loop entries |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "cost_estimates": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "provider":              { "type": "string", "enum": ["AWS","GCP","Azure"] },
          "monthly_estimate_usd":  { "type": "number", "minimum": 0 },
          "breakdown": {
            "type": "object",
            "properties": {
              "compute":  { "type": "number" },
              "storage":  { "type": "number" },
              "db":       { "type": "number" },
              "network":  { "type": "number" },
              "cdn":      { "type": "number" },
              "staging":  { "type": "number" }
            }
          },
          "confidence": { "type": "string", "enum": ["high","medium","low"] }
        },
        "required": ["provider", "monthly_estimate_usd", "breakdown", "confidence"]
      }
    },
    "recommended_config": {
      "type": "object",
      "properties": {
        "provider":             { "type": "string" },
        "monthly_estimate_usd": { "type": "number" },
        "config_label":         { "type": "string", "enum": ["baseline","budget","premium"] },
        "justification":        { "type": "string" }
      },
      "required": ["provider", "monthly_estimate_usd", "justification"]
    },
    "alternative_configs": {
      "type": "array",
      "minItems": 2,
      "maxItems": 2,
      "items": {
        "type": "object",
        "properties": {
          "label":                { "type": "string", "enum": ["budget","premium"] },
          "monthly_estimate_usd": { "type": "number" },
          "changes":              { "type": "array", "items": { "type": "string" } },
          "description":          { "type": "string" }
        },
        "required": ["label", "monthly_estimate_usd", "changes", "description"]
      }
    },
    "cost_optimization_suggestions": {
      "type": "array",
      "minItems": 1,
      "maxItems": 5,
      "items": {
        "type": "object",
        "properties": {
          "suggestion":            { "type": "string" },
          "estimated_saving_pct":  { "type": "integer", "minimum": 0, "maximum": 100 },
          "effort":                { "type": "string", "enum": ["low","medium","high"] }
        },
        "required": ["suggestion", "estimated_saving_pct"]
      }
    },
    "cost_per_feature": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "feature":         { "type": "string" },
          "monthly_cost_usd":{ "type": "number" },
          "pct_of_total":    { "type": "number" }
        },
        "required": ["feature", "monthly_cost_usd"]
      }
    },
    "budget_alert_thresholds": {
      "type": "object",
      "properties": {
        "alert_80pct":  { "type": "number" },
        "alert_100pct": { "type": "number" },
        "alert_120pct": { "type": "number" }
      },
      "required": ["alert_80pct", "alert_100pct", "alert_120pct"]
    },
    "metrics": {
      "type": "object",
      "properties": {
        "tokens_in":             { "type": "integer" },
        "tokens_out":            { "type": "integer" },
        "duration_ms":           { "type": "integer" },
        "items_produced":        { "type": "integer" },
        "version":               { "type": "string" },
        "pricing_tables_version":{ "type": "string" },
        "providers_estimated":   { "type": "integer" },
        "confidence":            { "type": "string" }
      },
      "required": ["tokens_in", "tokens_out", "duration_ms", "items_produced", "version", "pricing_tables_version"]
    },
    "feedback": {
      "type": "array",
      "items": { "$ref": "#/$defs/feedback_entry" }
    }
  },
  "required": ["cost_estimates", "recommended_config", "alternative_configs", "cost_optimization_suggestions", "budget_alert_thresholds", "metrics", "feedback"],
  "$defs": {
    "feedback_entry": {
      "type": "object",
      "properties": {
        "type":         { "type": "string", "enum": ["backpropagate", "info", "warning"] },
        "from_skill":   { "type": "string" },
        "target_skill": { "type": "string" },
        "reason":       { "type": "string" },
        "evidence":     { "type": "object" }
      },
      "required": ["type", "from_skill", "reason"]
    }
  }
}
```

## Rules & Constraints

- `deployment_plan` is required — reject with `MISSING_DEPLOYMENT_PLAN` if absent.
- The skill MUST include the pricing disclaimer in every output `metrics` object as `pricing_tables_version` and in the Purpose section.
- `alternative_configs` MUST always return exactly 2 items: `budget` and `premium`.
- `cost_optimization_suggestions` MUST return at least 1 and at most 5 suggestions.
- `peak_multiplier` is capped at 20.0 to prevent extreme outlier estimates.
- The skill MUST NOT make external HTTP calls to cloud provider pricing APIs.
- Prices are static reference tables — label every output with `"confidence": "medium"` minimum unless all resource specs are explicitly provided in the deployment plan.
- Currency conversion for non-USD currencies uses indicative rates only and must include a warning in `feedback`.

## Security Considerations

- `deployment_plan` may contain environment-specific configuration — do not log or echo deployment plan contents beyond normalised resource specs.
- Do NOT include account IDs, project IDs, or cloud credentials that may appear in `deployment_plan` in any output field.
- Pricing output is advisory only — do not represent estimates as contractual commitments.

## Token Optimization

- Compress `deployment_plan` to the resource manifest only (Step 1 normalisation) before cost calculation — strip narrative descriptions, architecture diagrams, and implementation notes.
- Process one provider at a time to limit working set.
- For cost-per-feature: process requirements in batches of 10.
- Omit `cost_per_feature` entirely from output if `requirements` not provided (do not return empty array — omit the field).
- Cap `breakdown` object to 6 line items maximum — merge minor items into "other" if needed.

## Quality Checklist

- [ ] `deployment_plan` validated and normalised before estimation
- [ ] Confidence level assigned correctly based on spec completeness
- [ ] All three providers estimated (unless `cloud_preferences` restricts)
- [ ] `alternative_configs` contains exactly budget + premium
- [ ] `cost_optimization_suggestions` contains 1–5 items
- [ ] `pricing_tables_version` included in metrics
- [ ] Feedback triggered for cost > budget or >50% provider differential
- [ ] No external API calls made
- [ ] Pricing disclaimer present in output metadata

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| `deployment_plan` missing | Return error: `{"error": "MISSING_DEPLOYMENT_PLAN"}` |
| `deployment_plan` has no compute, storage, or DB specs | Use "medium" environment tier defaults, set `confidence: low`, emit warning |
| Invalid `cloud_preferences` value | Skip invalid provider, continue with valid ones; emit warning |
| `peak_multiplier` > 20 | Cap at 20, emit warning |
| `optimization_target` not in enum | Default to `"balanced"`, emit info feedback |
| All providers produce identical estimate | Return estimates as-is, set `cost_differential_exceeds_50pct_across_providers: false` |

## 12. Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Behavior |
|------|---------|---------|----------|
| Provider cost differential | >50% cost difference between cheapest and most expensive provider | 3600s | Surface comparison table to human; require explicit provider selection before deployment-strategy proceeds |
| Cost exceeds budget constraint | `recommended_config.monthly_estimate_usd` exceeds declared `session.budget_constraint` | 3600s | Present cost breakdown and alternatives; backpropagate to deployment-strategy with target spend |

## 13. Skill Composition

`infrastructure-cost-estimator` runs after deployment-strategy and presents output alongside the deployment approval gate:

```yaml
composes:
  - skill: infrastructure-cost-estimator
    version: "^1.0.0"
    input_map:
      deployment_plan:    "deployment_strategy.deployment_plan"
      traffic_profile:    "session.traffic_profile"
      cloud_preferences:  "session.cloud_preferences"
      optimization_target:"session.optimization_target"
      requirements:       "requirement_analyzer.requirements"
    output_map:
      cost_estimates:               "state.infrastructure_cost_estimates"
      recommended_config:           "state.recommended_infrastructure"
      budget_alert_thresholds:      "state.budget_alert_thresholds"
```

Consumes from: `deployment-strategy@^1.1.0`, `architecture-design@^1.3.0`
Produces for: `deployment-strategy@^1.1.0` (feedback loop for cost-driven redesign)

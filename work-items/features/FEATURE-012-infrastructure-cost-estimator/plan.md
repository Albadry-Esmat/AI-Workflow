# FEATURE-012 — Implementation Plan: Infrastructure Cost Estimator

## Target Skills / Artifacts

| Skill / Artifact | Action | Notes |
|---|---|---|
| `.opencode/skills/infrastructure-cost-estimator/SKILL.md` (SKL-072) | Create | New skill — full 13-section spec |
| `skills/registry.json` | Update | Register SKL-072 with domain: deployment, phase: 7 |
| `skills/index.yaml` | Update | Add index entry for infrastructure-cost-estimator |

---

## §1 — Skill Overview

`infrastructure-cost-estimator` consumes the output of `deployment-strategy` and produces a monthly cost projection for AWS, GCP, and Azure. It uses built-in static pricing reference tables (public list prices as of 2026) and applies traffic profile multipliers to scale estimates. Output is presented alongside the deployment approval HITL gate to enable cost-informed decision-making before any resource is provisioned.

**Pricing disclaimer embedded in every output:** "Estimates are based on public list prices and are for reference only. Actual costs are affected by reserved instance commitments, sustained-use discounts, data transfer actuals, and negotiated enterprise agreements. Verify with the cloud provider's pricing calculator before committing to infrastructure."

---

## §2 — Resource Extraction Schema

From `deployment_plan`, the skill extracts a normalised resource manifest:

```json
{
  "compute": [
    {
      "name": "api-server",
      "cpu_vcpu": 4,
      "ram_gb": 16,
      "instance_count": 3,
      "environment": "production",
      "workload_type": "always-on"
    }
  ],
  "storage": [
    { "name": "object-store", "gb": 500, "tier": "standard", "type": "object" }
  ],
  "database": [
    { "name": "primary-db", "engine": "postgres", "tier": "managed", "vcpu": 4, "ram_gb": 16, "storage_gb": 100 }
  ],
  "cdn": { "enabled": true, "data_transfer_gb_month": 200 },
  "regions": ["us-east-1"],
  "environments": ["production", "staging"]
}
```

---

## §3 — Pricing Table Structure

Built-in pricing tables map normalised resource types to provider SKUs:

```json
{
  "provider": "AWS",
  "as_of": "2026-01",
  "compute": {
    "general_purpose_vcpu_hour": 0.0464,
    "general_purpose_gb_ram_hour": 0.0058
  },
  "storage": {
    "standard_gb_month": 0.023,
    "archival_gb_month": 0.004
  },
  "database": {
    "managed_postgres_vcpu_hour": 0.138,
    "managed_postgres_gb_ram_hour": 0.017
  },
  "network": {
    "egress_gb": 0.09,
    "cdn_gb": 0.0085
  }
}
```

Tables exist for AWS, GCP, and Azure. Prices are on-demand rates (no discounts applied).

---

## §4 — Cost Calculation Logic

For each provider:

```
compute_cost = Σ (instance.vcpu × vcpu_hour_rate + instance.ram_gb × ram_hour_rate)
               × instance_count × 730 hours/month

storage_cost = Σ (storage.gb × tier_rate)

database_cost = Σ (db.vcpu × db_vcpu_hour_rate + db.ram_gb × db_ram_hour_rate) × 730
              + db.storage_gb × storage_standard_rate

cdn_cost = cdn.data_transfer_gb_month × cdn_gb_rate

network_cost = traffic_profile.data_transfer_gb_month × egress_rate

peak_adjustment = multiply compute by min(traffic_profile.peak_multiplier, 3.0) for 10% of hours
                  (conservative peak sizing)

monthly_estimate = compute_cost + storage_cost + database_cost + cdn_cost + network_cost
                 + staging_overhead (staging = 30% of production compute + storage)
```

Confidence level:
- `high`: all required resource specs present in deployment_plan
- `medium`: some specs inferred from environment tier (small/medium/large)
- `low`: minimal specs, heavy inference required

---

## §5 — Alternative Configuration Generation

**Budget config** (target: ~50% of baseline):
- Replace always-on compute with auto-scaling (min 1 instance)
- Remove staging environment (dev-only)
- Use single-region deployment
- Downgrade DB to smaller tier
- Disable CDN (direct serving)

**Premium config** (target: ~2× baseline):
- Multi-region active-active deployment
- Full HA: 3+ instances per service with load balancer
- Read replicas for database
- Enterprise CDN with edge caching
- 99.99% SLA tier compute

---

## §6 — Cost Optimisation Analysis

The skill identifies the top 3 optimisation opportunities from this catalogue:
- Use spot/preemptible instances for batch workloads (up to 70% savings)
- Enable S3 Intelligent Tiering / GCS Autoclass for object storage (up to 40%)
- Use committed use discounts / reserved instances for stable workloads (up to 60%)
- Reduce multi-region to active-passive (failover) vs. active-active (40% compute savings)
- Downgrade staging DB to development tier (saves ~$X/month)
- Enable CDN compression to reduce data transfer volume (up to 30%)

---

## §7 — Cost Per Feature Apportionment

If `requirements` are provided alongside the deployment plan:

```
For each major feature in requirements:
  Identify primary modules from architecture that implement the feature
  Apportion resource costs by module CPU/RAM/storage weight
  feature_cost_pct = module_resource_weight / total_resource_weight
  feature_monthly_cost = monthly_estimate × feature_cost_pct
```

---

## §8 — Budget Alert Thresholds

```
For each provider estimate:
  alert_threshold_80pct = monthly_estimate × 0.8
  alert_threshold_100pct = monthly_estimate
  alert_threshold_120pct = monthly_estimate × 1.2 (anomaly detection)

Output as CloudWatch/Monitoring-compatible alert config values
```

---

## §9 — Feedback Routes

| Event | Target Skill | Action |
|---|---|---|
| `cost_exceeds_budget_constraint` | `deployment-strategy` | backpropagate: request lower-cost configuration (specify target monthly spend) |
| `cost_differential_exceeds_50pct_across_providers` | orchestrator | HITL surface: significant provider cost spread — human provider selection required |

---

## §10 — Orchestration Position

```
Phase 7 pipeline:
  [deployment-strategy] → [infrastructure-cost-estimator] → [HITL: deployment_approval_request]
                                                              (cost summary presented alongside)
                        ↓ (feedback loop if cost > budget)
                    [deployment-strategy revised]
```

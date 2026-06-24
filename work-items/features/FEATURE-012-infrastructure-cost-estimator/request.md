# FEATURE-012 — Request: Infrastructure Cost Estimator

**Origin:** Identified during ASE-OS enhancement analysis (2026-06-24).

---

## Problem Statement

`deployment-strategy` defines environments, compute specs, database tiers, CDN configuration, storage requirements, and target regions — but never produces a cost estimate. Teams commit to infrastructure decisions without knowing the monthly bill. A Kubernetes cluster vs. serverless vs. managed PaaS can differ by 10× in cost for the same workload, yet the current pipeline provides no signal to distinguish them on cost.

This means:
- Architecture and deployment decisions are made without financial visibility
- Budget surprises occur after infrastructure is provisioned and hard to reverse
- No basis exists for cost–performance trade-off discussions in the HITL gate
- Multi-cloud comparisons (AWS vs. GCP vs. Azure) require external tooling and manual effort
- Cost optimisation opportunities (reserved instances, spot workloads, tiered storage) are never surfaced

## Requested Behaviour

After `deployment-strategy` produces its output, `infrastructure-cost-estimator` should:

1. Parse the deployment plan to extract compute resources (CPU, RAM, instance count, environment tiers), storage (GB, tier), database configuration, CDN usage, and network transfer volumes
2. Apply traffic profile multipliers (requests/day, data transfer/month, peak multiplier) to scale estimates
3. Map resources to standard SKUs for each requested cloud provider (AWS, GCP, Azure) using built-in public list-price tables (2026 rates)
4. Produce a **monthly cost projection** per provider with line-item breakdown (compute, storage, DB, network, CDN)
5. Generate **two alternative configurations**: "budget" (reduced redundancy, ~50% cost) and "premium" (full HA, ~2× cost)
6. Identify top cost optimisation suggestions (e.g., spot instances for batch, S3 intelligent tiering)
7. If requirements are available, apportion costs to features by resource usage
8. Set recommended monitoring alert thresholds at 80% of estimated spend

Cost estimates are based on public list prices as reference points. Actual costs depend on reserved instance discounts, data transfer patterns, and negotiated enterprise agreements. Teams must verify with cloud provider pricing calculators before committing.

## Scope

- `.opencode/skills/infrastructure-cost-estimator/SKILL.md` — new skill (SKL-072)
- `skills/registry.json` — register new skill
- `skills/index.yaml` — add index entry

## Out of Scope

- Real-time API calls to cloud provider pricing APIs (static reference tables only)
- Provisioning or modifying infrastructure (IaC generation is in `deployment-strategy`)
- Licensing costs for commercial software running on infrastructure
- FinOps tooling integration (AWS Cost Explorer, GCP Billing, Azure Cost Management)
- Negotiated enterprise discount modelling

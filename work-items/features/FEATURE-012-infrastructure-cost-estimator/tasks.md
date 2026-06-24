# FEATURE-012 — Tasks & Acceptance Criteria

## Acceptance Criteria

### AC-1: Cost Estimate Produced Per Provider
- Given a valid `deployment_plan` from `deployment-strategy`
- When `infrastructure-cost-estimator` executes with `cloud_preferences: ["AWS", "GCP", "Azure"]`
- Then `cost_estimates` contains one entry per requested provider
- And each entry includes `provider`, `monthly_estimate_usd`, `breakdown` (compute, storage, db, network, cdn line items), and `confidence` (high / medium / low)

### AC-2: Traffic Profile Applied
- Given `traffic_profile` is provided with `requests_per_day`, `data_transfer_gb_month`, and `peak_multiplier`
- When `infrastructure-cost-estimator` executes
- Then network and CDN cost line items reflect the `data_transfer_gb_month` value
- And compute line items apply peak sizing at `peak_multiplier` for 10% of monthly hours

### AC-3: Alternative Configurations Generated
- Given any valid `deployment_plan`
- When `infrastructure-cost-estimator` executes
- Then `alternative_configs` contains exactly two alternatives: `budget` (~50% of baseline) and `premium` (~2× baseline)
- And each alternative includes the configuration changes made (e.g., "removed staging, min 1 compute instance")

### AC-4: Recommended Config Reflects Optimization Target
- Given `optimization_target: "cost"`
- When `infrastructure-cost-estimator` executes
- Then `recommended_config` selects the lowest-cost provider and configuration
- Given `optimization_target: "performance"` → selects the premium config for the best-performing provider
- Given `optimization_target: "balanced"` → selects the baseline config with best cost-per-performance ratio

### AC-5: Cost Optimisation Suggestions Produced
- Given any valid `deployment_plan`
- When `infrastructure-cost-estimator` executes
- Then `cost_optimization_suggestions` contains at least 1 and at most 5 specific suggestions
- And each suggestion quantifies the estimated saving (e.g., "up to 60% savings on compute")

### AC-6: Budget Alert Thresholds Set
- Given a completed cost estimate
- When `infrastructure-cost-estimator` executes
- Then `budget_alert_thresholds` contains `alert_80pct`, `alert_100pct`, and `alert_120pct` values
- And the 80% threshold equals `monthly_estimate_usd × 0.8` for the recommended provider

---

## Definition of Done (DoD)

- [ ] `infrastructure-cost-estimator/SKILL.md` (SKL-072) created with full 13-section spec
- [ ] Skill header `description` field follows exact auto-trigger format
- [ ] All 6 acceptance criteria above verified against SKILL.md spec
- [ ] Input schema validated: `deployment_plan` required; all other inputs optional with correct defaults
- [ ] Output schema validated: all output fields present with correct types
- [ ] Pricing disclaimer included in SKILL.md Purpose section and in output metrics
- [ ] Feedback routes documented: `cost_exceeds_budget_constraint` → `deployment-strategy`, `cost_differential_exceeds_50pct_across_providers` → orchestrator HITL
- [ ] HITL gate defined: >50% cost differential across providers requires human provider selection
- [ ] Skill registered in `skills/registry.json` with `status: draft`, `domain: deployment`, `phase: 7`
- [ ] Index entry added to `skills/index.yaml`
- [ ] `scripts/validate-skills.sh` exits 0

---

## Sub-Tasks

| ID | Description | Skill / File | Est. SP |
|---|---|---|---|
| F012-T1 | Author `infrastructure-cost-estimator/SKILL.md` — sections 1–6 (header, purpose, inputs, context, execution, outputs) | new skill | 2.0 |
| F012-T2 | Author `infrastructure-cost-estimator/SKILL.md` — sections 7–13 (rules, security, tokens, quality, failures, HITL, composition) | new skill | 1.5 |
| F012-T3 | Define pricing table schema and reference data for AWS, GCP, Azure (on-demand 2026 rates) | new skill | 2.0 |
| F012-T4 | Register SKL-072 in `skills/registry.json` and `skills/index.yaml` | registry | 0.5 |
| F012-T5 | Run `validate-skills.sh` and verify exit 0 | CI | 0.5 |
| F012-T6 | Integration test: deployment-strategy output → infrastructure-cost-estimator → HITL gate cost summary | testing | 1.5 |
| **Total** | | | **8 SP** |

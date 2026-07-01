---
name: cloud-architecture-reviewer
version: 1.0.0
domain: cloud
description: >
  Use when evaluating cloud architectures against Well-Architected Framework pillars, identifying cost optimization opportunities, or generating a prioritized remediation roadmap. Triggers on: "well-architected review", "cloud architecture assessment", "cost optimization", "cloud posture review", "WAF audit". Do NOT use for designing new architectures from scratch — use architecture-design for that.
author: system
---

## Purpose

Evaluate existing or proposed cloud architectures against the three major cloud provider frameworks: the AWS Well-Architected Framework (6 pillars: Operational Excellence, Security, Reliability, Performance Efficiency, Cost Optimization, Sustainability), the Google Cloud Architecture Framework (6 pillars: System Design, Operational Excellence, Security Privacy Compliance, Reliability, Performance Optimization, Cost Optimization), and the Azure Well-Architected Framework (5 pillars: Reliability, Security, Cost Optimization, Operational Excellence, Performance Efficiency). This skill unifies all three frameworks into a normalized scoring model, enabling consistent multi-cloud assessments.

For each pillar, the skill produces a quantitative score (0–100), a list of specific findings with severity ratings, and concrete improvement recommendations with estimated effort and expected impact. Security pillar analysis identifies posture gaps against CIS Benchmarks, CSP-native security services (AWS Security Hub, GCP Security Command Center, Azure Defender), and NIST CSF categories. Cost optimization analysis covers compute right-sizing recommendations (EC2/GCE/VM instance family selection), reserved capacity strategies (Reserved Instances, Committed Use Discounts, Reserved VM Instances), spot/preemptible/spot-priority usage patterns, storage tier optimization (S3 Intelligent-Tiering, GCS Autoclass, Azure Blob lifecycle management), and data transfer cost reduction.

The skill generates a prioritized remediation roadmap organized into immediate (0–2 weeks), short-term (1–3 months), and long-term (3–12 months) horizons. Each roadmap item carries an effort estimate (person-days), a risk rating for the change, and links back to the pillar finding it addresses. The output is designed to be consumed directly by engineering teams for sprint planning and by finance stakeholders for cost governance.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `architecture_description` | `string` | Yes | Prose or structured description of the cloud architecture under review |
| `cloud_provider` | `string` | Yes | Primary cloud provider: `aws`, `gcp`, `azure`, or `multi` |
| `pillar_focus` | `array` | No | Subset of pillars to assess; omit for full assessment |
| `workload_type` | `string` | No | Workload classification: `web`, `batch`, `ml`, `real_time`, `storage`, `data_warehouse` |
| `current_monthly_cost` | `number` | No | Current monthly cloud spend in USD (enables cost savings % calculations) |
| `context` | `object` | No | Additional context: existing IaC, compliance requirements, team size, maturity level |

**Input Schema:**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "architecture_description": { "type": "string", "minLength": 50 },
    "cloud_provider": {
      "type": "string",
      "enum": ["aws", "gcp", "azure", "multi"]
    },
    "pillar_focus": {
      "type": "array",
      "items": {
        "type": "string",
        "enum": ["operational_excellence","security","reliability","performance","cost_optimization","sustainability"]
      }
    },
    "workload_type": {
      "type": "string",
      "enum": ["web","batch","ml","real_time","storage","data_warehouse"]
    },
    "current_monthly_cost": { "type": "number", "minimum": 0 },
    "context": {
      "type": "object",
      "properties": {
        "compliance_frameworks": { "type": "array", "items": { "type": "string" } },
        "team_size": { "type": "integer" },
        "maturity_level": { "type": "string", "enum": ["startup","growing","established","enterprise"] }
      }
    }
  },
  "required": ["architecture_description", "cloud_provider"]
}
```

## Required Context

- Architecture description (prose, diagram description, or IaC summary) is mandatory
- If `context.compliance_frameworks` is provided, security pillar assessment expands to cover the specified frameworks (PCI DSS, HIPAA, SOC 2, GDPR, ISO 27001)
- Optional: existing `security-review` output to avoid duplicating vulnerability identification
- Optional: cost billing export (AWS Cost Explorer, GCP Billing, Azure Cost Management) for precise right-sizing recommendations

## Execution Logic

```
Step 1 — Normalize architecture description
  Parse architecture_description into structural components:
    compute_resources[], storage_resources[], network_topology, iam_model,
    observability_stack, deployment_method, data_classification.
  Map to cloud-provider-specific services and terminology.
  Output: normalized_architecture_map

Step 2 — Select applicable framework pillars
  If pillar_focus is provided: assess only specified pillars.
  Else: assess all 6 pillars (AWS WAF) or equivalent for gcp/azure.
  Map pillar names to provider equivalents for multi-cloud assessments.
  Output: pillar_assessment_plan[]

Step 3 — Assess Operational Excellence pillar
  Evaluate: IaC adoption (Terraform/CDK/Bicep/Deployment Manager), CI/CD maturity,
            runbook completeness, alerting coverage (mean time to detect),
            change management process, post-incident review practices,
            tagging strategy for resource governance.
  Score 0-100. Generate findings[].
  Output: operational_excellence_assessment

Step 4 — Assess Security pillar
  Evaluate: IAM least-privilege (overly permissive roles, wildcard policies, unused permissions),
            network segmentation (VPC/VNet/VPC design, security groups, NACLs, private endpoints),
            data encryption (at rest: AES-256/CMK, in transit: TLS 1.2+ enforced),
            secrets management (no hardcoded credentials, rotation policies),
            audit logging (CloudTrail/Cloud Audit Logs/Azure Monitor enabled, log retention),
            threat detection (GuardDuty/Security Command Center/Defender for Cloud),
            vulnerability scanning (Inspector/Container Analysis/Defender for Containers),
            compliance posture vs CIS Benchmarks level 1 and 2.
  Score 0-100. Generate findings[] with CIS Benchmark references.
  Output: security_assessment

Step 5 — Assess Reliability pillar
  Evaluate: multi-AZ or multi-region deployment, RTO/RPO vs backup strategy alignment,
            health check and auto-recovery configuration, load balancer health probes,
            database replication and failover (RDS Multi-AZ, Cloud SQL HA, Azure SQL AG),
            queue depth and consumer scaling, chaos engineering maturity,
            dependency on single-AZ NAT gateway or single-region endpoints.
  Score 0-100. Generate findings[].
  Output: reliability_assessment

Step 6 — Assess Performance Efficiency pillar
  Evaluate: compute instance type selection vs workload profile (CPU-optimized, memory-optimized),
            auto-scaling configuration (target tracking vs step scaling),
            caching layers (ElastiCache/Cloud Memorystore/Azure Cache, CDN coverage),
            database query performance (index coverage, read replicas),
            network latency (placement groups, proximity placement groups, CDN edge locations),
            storage IOPS provisioning vs actual utilization.
  Score 0-100. Generate findings[].
  Output: performance_assessment

Step 7 — Assess Cost Optimization pillar
  Evaluate: compute right-sizing (compare instance type to utilization metrics if available),
            reserved capacity coverage (% of baseline compute on RI/CUD/RVI vs on-demand),
            spot/preemptible instance usage for fault-tolerant workloads,
            idle resources (stopped instances, unattached EBS volumes, unused Elastic IPs),
            storage tier alignment (cold data on Glacier/Coldline/Archive),
            data transfer costs (cross-AZ, cross-region, egress patterns),
            over-provisioned NAT gateway usage.
  If current_monthly_cost provided: calculate estimated_savings_usd and savings_pct per item.
  Score 0-100. Generate cost_optimizations[].
  Output: cost_assessment

Step 8 — Assess Sustainability pillar (if in scope)
  Evaluate: region selection for renewable energy mix (AWS/GCP carbon footprint tools),
            rightsizing impact on carbon, serverless vs always-on compute preference,
            batch workload scheduling for off-peak grid hours,
            storage lifecycle policies reducing retained data volume.
  Score 0-100. Generate findings[].
  Output: sustainability_assessment

Step 9 — Calculate overall score and identify critical risks
  overall_score = weighted_average(pillar_scores, weights_by_pillar_focus).
  critical_risks = findings where severity == "critical" across all pillars.
  For each critical risk: generate remediation with effort_days and risk_rating.
  Output: overall_score, critical_risks[]

Step 10 — Build prioritized remediation roadmap
  Group all findings by priority tier:
    immediate (0-2 weeks): critical severity or zero-effort quick wins.
    short_term (1-3 months): high severity, medium effort.
    long_term (3-12 months): medium severity, high effort, strategic improvements.
  Sort within tier by: severity DESC, estimated_effort ASC (easiest high-value first).
  Output: remediation_roadmap[]
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `pillar_scores` | `object` | Pillar → `{ score: 0-100, findings: [], top_recommendation }` |
| `critical_risks` | `array` | Critical findings: `{ risk, severity, pillar, remediation, effort_days }` |
| `cost_optimizations` | `array` | Cost actions: `{ action, category, estimated_savings_pct, estimated_savings_usd, effort }` |
| `security_gaps` | `array` | Security findings with CIS Benchmark references and remediation steps |
| `reliability_improvements` | `array` | Reliability findings with RTO/RPO impact assessments |
| `remediation_roadmap` | `array` | Prioritized action plan: `{ tier, priority, action, pillar, effort_days, risk_rating }` |
| `overall_score` | `number` | Weighted average score across all assessed pillars (0–100) |
| `metrics` | `object` | Execution metrics: tokens_in, tokens_out, duration_ms, items_produced, version |
| `feedback` | `array` | Backpropagation and informational feedback entries |

**Output Schema:**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "pillar_scores": {
      "type": "object",
      "additionalProperties": {
        "type": "object",
        "properties": {
          "score":            { "type": "number", "minimum": 0, "maximum": 100 },
          "findings":         { "type": "array" },
          "top_recommendation":{ "type": "string" }
        },
        "required": ["score", "findings"]
      }
    },
    "critical_risks": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "risk":         { "type": "string" },
          "severity":     { "type": "string", "enum": ["critical","high","medium","low"] },
          "pillar":       { "type": "string" },
          "remediation":  { "type": "string" },
          "effort_days":  { "type": "integer" }
        },
        "required": ["risk", "severity", "pillar", "remediation"]
      }
    },
    "cost_optimizations": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "action":                  { "type": "string" },
          "category":                { "type": "string", "enum": ["compute","storage","network","database","reserved_capacity","idle_resources"] },
          "estimated_savings_pct":   { "type": "number" },
          "estimated_savings_usd":   { "type": "number" },
          "effort":                  { "type": "string", "enum": ["hours","days","weeks"] }
        },
        "required": ["action", "category", "estimated_savings_pct"]
      }
    },
    "security_gaps": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "gap":            { "type": "string" },
          "cis_reference":  { "type": "string" },
          "severity":       { "type": "string", "enum": ["critical","high","medium","low"] },
          "remediation":    { "type": "string" }
        },
        "required": ["gap", "severity", "remediation"]
      }
    },
    "reliability_improvements": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "improvement": { "type": "string" },
          "rto_impact":  { "type": "string" },
          "rpo_impact":  { "type": "string" },
          "effort_days": { "type": "integer" }
        },
        "required": ["improvement"]
      }
    },
    "remediation_roadmap": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "tier":        { "type": "string", "enum": ["immediate","short_term","long_term"] },
          "priority":    { "type": "integer", "minimum": 1 },
          "action":      { "type": "string" },
          "pillar":      { "type": "string" },
          "effort_days": { "type": "integer" },
          "risk_rating": { "type": "string", "enum": ["low","medium","high"] }
        },
        "required": ["tier", "priority", "action", "pillar"]
      }
    },
    "overall_score": { "type": "number", "minimum": 0, "maximum": 100 },
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
  "required": ["pillar_scores","critical_risks","cost_optimizations","security_gaps","reliability_improvements","remediation_roadmap","overall_score","metrics","feedback"]
}
```

## Rules & Constraints

- Every assessed pillar MUST produce at least one finding; a pillar with zero findings requires an explicit justification note in `pillar_scores[pillar].top_recommendation`.
- Critical risk findings MUST appear in the `immediate` remediation roadmap tier; they MUST NOT be deferred to `long_term`.
- Cost optimization estimates MUST carry a confidence qualifier (high/medium/low) when `current_monthly_cost` is not provided; avoid fabricating USD figures without a baseline.
- Security pillar assessment MUST cross-reference CIS Benchmark controls for the identified cloud provider.
- `overall_score` MUST be calculated as a weighted average; if only a subset of pillars is assessed, the score scope MUST be documented in feedback.
- Remediation roadmap items MUST reference their originating pillar finding by ID — orphan roadmap items are not allowed.
- Multi-cloud (`cloud_provider: multi`) assessments MUST explicitly identify which provider each finding applies to.

## Security Considerations

- Architecture description input may contain sensitive topology information; it MUST NOT be logged or persisted beyond the execution context.
- Security gap findings MUST describe the class of issue (e.g., "overly permissive IAM role") without outputting actual ARNs, resource IDs, or account numbers from the input.
- Cost data (current_monthly_cost) MUST be treated as confidential; it MUST NOT appear in feedback fields that may be routed to less-privileged consumers.
- Remediation steps that involve IAM changes MUST flag the risk of over-permissive intermediate states during rollout.

## Token Optimization

- Compress `architecture_description` to a structured component summary before pillar assessment; strip narrative prose, keep service names and connection types only.
- Limit `pillar_scores[pillar].findings` to the top 5 findings per pillar by severity; emit `findings_truncated: true` if more exist.
- Return `remediation_roadmap` sorted with immediate-tier items first; truncate to top 20 items with `roadmap_truncated: true` flag if the full list exceeds 20 entries.
- Omit `estimated_savings_usd` if `current_monthly_cost` is absent — return `null` rather than fabricated estimates.

## Quality Checklist

- [ ] All requested pillars have quantitative scores between 0 and 100
- [ ] Every critical risk appears in the immediate remediation tier
- [ ] Cost optimizations include confidence qualifiers when no baseline cost is provided
- [ ] Security gaps cross-reference CIS Benchmark controls for the target provider
- [ ] Remediation roadmap items reference their source pillar findings
- [ ] Multi-cloud assessments label findings by provider
- [ ] `overall_score` computation method is documented in the output or feedback
- [ ] No actual ARNs, resource IDs, or account numbers appear in output fields

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| `architecture_description` is fewer than 50 characters | Reject: `{"error": "INSUFFICIENT_DESCRIPTION", "min_length": 50}` |
| `cloud_provider: multi` but description only mentions one provider | Proceed as single-provider; emit warning in feedback |
| `pillar_focus` contains an unrecognized pillar name | Reject unknown pillars; assess recognized pillars; list unrecognized in feedback |
| No cost data provided for cost_optimization pillar | Produce qualitative recommendations only; set `estimated_savings_usd: null` throughout |
| Architecture too complex to assess all pillars in one pass | Assess in priority order: Security → Reliability → Cost → Operational Excellence → Performance → Sustainability; note `partial_assessment: true` |

## 12. Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Behavior |
|------|---------|---------|----------|
| Critical security gap approval | Any `security_gaps[].severity == "critical"` | 3600s | Pause; present all critical security gaps to security lead for acknowledgement before roadmap is finalized |
| Cost optimization action review | Any cost action with `estimated_savings_pct > 30` | 3600s | Pause; present high-impact cost changes to finance/platform owner for sign-off |

## 13. Skill Composition

`cloud-architecture-reviewer` can be composed after `architecture-design` or as a standalone review:

```yaml
composes:
  - skill: cloud-architecture-reviewer
    version: "^1.0.0"
    input_map:
      architecture_description: "architecture.component_diagram"
      cloud_provider: "session.cloud_provider"
      workload_type: "session.workload_type"
      current_monthly_cost: "session.monthly_cost_usd"
    output_map:
      critical_risks: "state.review.critical_risks"
      remediation_roadmap: "state.review.roadmap"
      overall_score: "state.review.waf_score"
```

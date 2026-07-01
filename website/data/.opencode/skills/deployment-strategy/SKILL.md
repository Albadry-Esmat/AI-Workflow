---
name: deployment-strategy
version: 1.1.0
domain: deployment
description: 'Use when asked to define a deployment strategy, set up environments, plan CI/CD pipelines, configure feature flags, or produce infrastructure-as-code. Triggers on: "deployment strategy", "how do we deploy", "CI/CD", "rollback", "feature flags", "infrastructure", "IaC".'
author: system
---

## Purpose

Produce a production-ready deployment strategy that bridges testing and operations. The skill defines environment topology, promotion gates, rollback procedures, feature flag policy, and IaC scaffolding. It is the final step before production release.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `architecture` | `object` | Yes | Modules, data_flow, integration_points from architecture-design |
| `test_plan` | `object` | No | Test plan and quality gates from testing-strategy |
| `quality_gates` | `array[object]` | No | Existing quality gates to enforce during promotion |
| `infrastructure_context` | `object` | No | Existing infra setup, cloud provider, orchestration platform |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "architecture": { "type": "object" },
    "test_plan": { "type": "object" },
    "quality_gates": { "type": "array" },
    "infrastructure_context": {
      "type": "object",
      "properties": {
        "provider": { "type": "string", "enum": ["aws", "gcp", "azure", "on_prem", "hybrid"] },
        "orchestration": { "type": "string" },
        "existing_infra": { "type": "string" }
      }
    }
  },
  "required": ["architecture"]
}
```

## Required Context

- Architecture modules and integration points from `architecture-design`.
- Test plan and required quality gates from `testing-strategy` (recommended).

## Execution Logic

```
Step 1 — Define environment model
  Establish environments: dev, staging, pre-prod, production.
  For each: purpose, access level, data classification, deployment frequency.
  Output: environment topology

Step 2 — Define promotion rules
  For each environment promotion (dev→staging→pre-prod→production):
  - Required quality gates (tests pass, coverage threshold, security scan, approval)
  - Required artifact signatures (container hash, version tag)
  - Automatic vs manual promotion
  Output: promotion rule set

Step 3 — Define rollback criteria and procedure
  Conditions triggering rollback: error rate spike, latency increase, failed health check, security alert.
  Rollback strategy: full revert, feature flag toggle, canary revert.
  Output: rollback playbook

Step 4 — Define feature flag strategy
  Flag naming convention, flag lifecycle (dev→staging→production→retire), flag ownership.
  Flag types: release toggle, ops toggle, permission toggle, experiment toggle.
  Output: feature flag governance

Step 5 — Define deployment pattern
  Choose pattern: blue-green, canary, rolling, or shadow deployment.
  Based on: module criticality, integration complexity, rollback speed requirements.
  Output: deployment pattern per module

Step 6 — Infrastructure-as-Code scaffolding
  Generate IaC structure: module naming, resource hierarchy, network topology, secret management approach.
  Output: IaC scaffold definition

Step 7 — Assemble deployment plan
  Combine all into structured deployment strategy.
  Output: complete deployment plan

Step 8 — Generate Deployment Approval Request
  Compile a formal deployment_approval_request artifact containing:
    - release_summary: one-paragraph description of what is being deployed
    - guard_verdicts: verdicts from all guard skills run in this pipeline cycle
    - readiness_score: score from implementation-completeness-guard (if available)
    - deployment_plan: pattern, environments, estimated duration
    - rollback_summary: rollback procedure and estimated recovery time
    - risks: all risks with impact >= high
    - action_required: "approve_or_reject" — explicitly states no automatic deployment will occur
  The pipeline MUST halt at this point. Deployment CANNOT proceed without explicit user confirmation.
  Output: deployment_approval_request artifact
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `environments` | `array[object]` | Environment definitions (name, purpose, access, promotion_type) |
| `promotion_rules` | `array[object]` | Promotion gates (from_env, to_env, gates, auto) |
| `rollback_criteria` | `array[object]` | Rollback triggers (metric, threshold, cooldown, procedure) |
| `feature_flags` | `object` | Feature flag governance (naming, lifecycle, types, ownership) |
| `deployment_plan` | `object` | Deployment strategy (pattern, schedule, health_check, monitoring) |
| `risks` | `array[object]` | Deployment risks (description, impact, mitigation) |
| `deployment_approval_request` | `object` | **Mandatory** — formal approval request artifact; pipeline halts until user confirms |
| `metrics` | `object` | Deployment analysis metrics |
| `feedback` | `array[object]` | Feedback loop entries |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "environments": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": { "type": "string" },
          "purpose": { "type": "string" },
          "access_level": { "type": "string", "enum": ["restricted", "team", "company", "public"] },
          "promotion_type": { "type": "string", "enum": ["auto", "manual"] },
          "data_classification": { "type": "string", "enum": ["synthetic", "anonymized", "real"] }
        },
        "required": ["name", "purpose", "promotion_type"]
      }
    },
    "promotion_rules": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "from_env": { "type": "string" },
          "to_env": { "type": "string" },
          "gates": { "type": "array", "items": { "type": "string" } },
          "auto": { "type": "boolean" }
        },
        "required": ["from_env", "to_env", "gates"]
      }
    },
    "rollback_criteria": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "metric": { "type": "string" },
          "threshold": { "type": "string" },
          "cooldown_seconds": { "type": "integer" },
          "procedure": { "type": "string", "enum": ["auto_rollback", "flag_toggle", "manual"] }
        },
        "required": ["metric", "threshold", "procedure"]
      }
    },
    "feature_flags": {
      "type": "object",
      "properties": {
        "naming_pattern": { "type": "string" },
        "lifecycle": { "type": "array", "items": { "type": "string" } },
        "types": { "type": "array", "items": { "type": "string" } }
      },
      "required": ["naming_pattern", "lifecycle", "types"]
    },
    "deployment_plan": {
      "type": "object",
      "properties": {
        "pattern": { "type": "string", "enum": ["blue_green", "canary", "rolling", "shadow"] },
        "health_check_endpoint": { "type": "string" },
        "monitoring_dashboard": { "type": "string" },
        "estimated_duration": { "type": "string" }
      },
      "required": ["pattern"]
    },
    "risks": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "description": { "type": "string" },
          "impact": { "type": "string", "enum": ["critical", "high", "medium", "low"] },
          "mitigation": { "type": "string" }
        },
        "required": ["description", "impact", "mitigation"]
      }
    },
    "deployment_approval_request": {
      "type": "object",
      "description": "Mandatory formal approval request. The pipeline MUST halt here. No deployment occurs without explicit user confirmation.",
      "required": ["release_summary", "action_required", "deployment_plan_summary", "rollback_summary"],
      "properties": {
        "release_summary":       { "type": "string", "description": "One-paragraph description of what is being deployed and why." },
        "guard_verdicts": {
          "type": "array",
          "description": "All guard skill verdicts collected during this pipeline cycle.",
          "items": {
            "type": "object",
            "required": ["guard", "verdict"],
            "properties": {
              "guard":      { "type": "string" },
              "verdict":    { "type": "string", "enum": ["pass", "block", "not_run"] },
              "violations": { "type": "integer" }
            }
          }
        },
        "readiness_score":        { "type": "integer", "minimum": 0, "maximum": 100 },
        "deployment_plan_summary": {
          "type": "object",
          "properties": {
            "pattern":            { "type": "string" },
            "environments":       { "type": "array", "items": { "type": "string" } },
            "estimated_duration": { "type": "string" }
          }
        },
        "rollback_summary": {
          "type": "object",
          "properties": {
            "procedure":            { "type": "string" },
            "estimated_recovery":   { "type": "string" }
          }
        },
        "high_risks": {
          "type": "array",
          "description": "Risks with impact: critical or high only.",
          "items": { "type": "object" }
        },
        "action_required": {
          "type": "string",
          "enum": ["approve_or_reject"],
          "description": "Always 'approve_or_reject'. The pipeline has stopped and awaits explicit user decision."
        }
      }
    },
    "metrics": {
      "type": "object",
      "properties": {
        "tokens_in": { "type": "integer" },
        "tokens_out": { "type": "integer" },
        "duration_ms": { "type": "integer" },
        "items_produced": { "type": "integer" },
        "version": { "type": "string" },
        "environment_count": { "type": "integer" },
        "promotion_gates_total": { "type": "integer" },
        "auto_gates": { "type": "integer" },
        "manual_gates": { "type": "integer" }
      },
      "required": ["tokens_in", "tokens_out", "duration_ms", "items_produced", "version", "environment_count", "promotion_gates_total"]
    },
    "feedback": {
      "type": "array",
      "items": { "$ref": "#/$defs/feedback_entry" }
    }
  },
  "required": ["environments", "promotion_rules", "rollback_criteria", "feature_flags", "deployment_plan", "risks", "deployment_approval_request", "metrics", "feedback"],
  "$defs": {
    "feedback_entry": {
      "type": "object",
      "properties": {
        "type": { "type": "string", "enum": ["backpropagate", "info", "warning"] },
        "from_skill": { "type": "string" },
        "target_skill": { "type": "string" },
        "reason": { "type": "string" },
        "evidence": { "type": "object" }
      },
      "required": ["type", "from_skill", "reason"]
    }
  }
}
```

## Rules & Constraints

- At minimum: dev, staging, and production environments MUST be defined.
- Production promotion MUST require manual approval gate.
- Rollback procedure for production MUST be automated (auto_rollback or flag_toggle).
- Feature flags MUST have a retire step in their lifecycle.
- `deployment_approval_request` MUST always be present in the output — it is never optional.
- `deployment_approval_request.action_required` MUST always be `"approve_or_reject"` — the pipeline MUST NOT continue automatically past this point under any condition.

## Security Considerations

- Environment `access_level` MUST reflect principle of least privilege.
- Production credentials MUST use a secret manager — never hardcoded.
- Rollback procedures MUST preserve data integrity (no destructive rollbacks without backup).
- Deployment artifacts MUST be signed and versioned.

## Quality Checklist

- [ ] All environments defined with purpose and promotion type
- [ ] Production promotion requires manual gate
- [ ] Rollback procedure exists for production
- [ ] Feature flags have complete lifecycle (create → activate → deactivate → retire)
- [ ] Deployment pattern is appropriate for system criticality
- [ ] IaC scaffold references no hardcoded secrets
- [ ] deployment_approval_request is present with all required fields populated
- [ ] deployment_approval_request.action_required = "approve_or_reject"

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| No architecture input | Return error: `{"error": "NO_ARCHITECTURE"}` |
| Single environment only | Flag as risk, propose standard 3-tier as default |
| No test plan provided | Generate minimal gates (unit tests pass, build succeeds) with `"gates_minimal": true` |
| Conflicting deployment patterns | Use blue-green as safe default, document trade-off |

## 9. Token Optimization

- Compress `architecture` input to module names + integration contract types only.
- Omit `technical_decisions` and `component_diagram` from architecture input — not needed for deployment.
- Use abbreviated environment names in internal logic: `dev`, `stg`, `preprod`, `prod`.
- Cap `rollback_criteria` at 5 entries — most critical triggers only.
- Omit `feature_flags` details in output summary if count > 10; reference to separate flag config instead.

## 12. Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Behavior |
|------|---------|---------|----------|
| Deploy approval | **Always — mandatory, non-bypassable** | 0 (wait indefinitely) | Pipeline halts after Step 8. The deployment_approval_request artifact is presented to the user. Deployment CANNOT proceed under any condition without explicit `approve` response. Auto-continue on timeout is DISABLED for this gate. |

- Gate presents: `deployment_approval_request` in full — release summary, guard verdicts, readiness score, deployment plan, rollback summary, high risks.
- **Approved**: orchestrator advances to the deployment execution step.
- **Rejected**: pipeline halts, partial results returned, no deployment occurs.
- **Modified**: apply modifications to promotion rules or rollback strategy, re-run from Step 2, re-generate approval request.

> **Governance invariant**: deployment is strictly manual and user-controlled. This gate cannot be bypassed, skipped, or auto-continued regardless of timeout.

## 13. Skill Composition

`deployment-strategy` may follow `testing-strategy` in a pre-release meta-skill. See `testing-strategy` Section 13 for the composition definition.

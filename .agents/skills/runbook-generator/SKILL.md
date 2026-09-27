---
name: runbook-generator
version: 1.0.0
domain: documentation
description: >
  Use when generating operational runbooks, incident response playbooks, and on-call escalation
  procedures. Triggers on: "write a runbook", "incident response playbook", "on-call procedures",
  "failure scenario documentation", "post-mortem template", "escalation tree", "status page
  templates", "P0 playbook". Do NOT use for general API or feature documentation — use
  documentation-generator instead.
author: system
---

## Purpose

The runbook-generator skill produces structured, actionable operational documentation that on-call engineers can execute under pressure during active incidents. Unlike general-purpose documentation, runbooks produced by this skill are optimized for time-to-resolution: they begin with fast symptom-to-detection mappings, progress through ordered diagnosis commands with expected versus anomalous output examples, and end with concrete mitigation steps with exact command strings, rollback procedures, and verification criteria. Every runbook is linked to the specific monitoring alert that fires it.

The skill generates the full operational documentation suite: runbooks for common failure scenarios (service degradation, database failover, cache stampede, deployment rollback, certificate expiration, rate limit breach, memory OOM kill, disk pressure, upstream dependency outage); an incident severity classification matrix aligning P0–P3 levels to business impact scope and response time SLAs; communication templates for status page updates (Statuspage.io/Atlassian format), internal Slack incident channel announcements, and customer-facing email notifications; a 5-whys post-mortem template with timeline reconstruction, contributing factors, and SMART action items with owners and due dates; escalation trees with role placeholders (Primary On-Call, Secondary, Incident Commander, Engineering Manager, VP Engineering); and a self-validation checklist for runbook quality assurance.

Runbooks are rendered in Markdown format suitable for embedding directly in Confluence, Notion, Backstage TechDocs, or a Git wiki. The skill bridges slo-sla-designer (which defines the SLO breach conditions that trigger runbook invocation) and observability (which instruments the alerts that link to runbooks via `runbook_url` annotation in Prometheus alerting rules or Datadog monitor `message` field).

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `service_name` | `string` | Yes | Name of the service these runbooks apply to |
| `failure_scenarios` | `array` | Yes | Scenarios to cover: `{ scenario_name, symptoms[], impact, estimated_frequency? }` |
| `monitoring_platform` | `string` | No | `prometheus`, `datadog`, `cloudwatch`, `dynatrace`, `newrelic`. Default: `prometheus` |
| `alert_definitions` | `array` | No | Existing alert rules: `{ alert_name, condition, severity }` — links alerts to runbooks |
| `on_call_rotation` | `object` | No | `{ team_name, primary_role, secondary_role, escalation_levels[] }` |
| `incident_process` | `string` | No | Incident tooling: `pagerduty`, `opsgenie`, `victorops`, `custom`. Default: `custom` |
| `context` | `object` | No | `{ repository_url, deployment_platform, documentation_platform, sla_response_times? }` |

**Input Schema:**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["service_name", "failure_scenarios"],
  "properties": {
    "service_name": { "type": "string", "minLength": 1 },
    "failure_scenarios": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": ["scenario_name", "symptoms", "impact"],
        "properties": {
          "scenario_name": { "type": "string" },
          "symptoms": { "type": "array", "items": { "type": "string" }, "minItems": 1 },
          "impact": { "type": "string" },
          "estimated_frequency": { "type": "string" }
        }
      }
    },
    "monitoring_platform": {
      "type": "string",
      "enum": ["prometheus", "datadog", "cloudwatch", "dynatrace", "newrelic"],
      "default": "prometheus"
    },
    "alert_definitions": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["alert_name", "condition"],
        "properties": {
          "alert_name": { "type": "string" },
          "condition": { "type": "string" },
          "severity": { "type": "string", "enum": ["critical", "high", "warning", "info"] }
        }
      }
    },
    "on_call_rotation": {
      "type": "object",
      "properties": {
        "team_name": { "type": "string" },
        "primary_role": { "type": "string" },
        "secondary_role": { "type": "string" },
        "escalation_levels": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "level": { "type": "integer" },
              "role": { "type": "string" },
              "timeout_minutes": { "type": "integer" }
            }
          }
        }
      }
    },
    "incident_process": {
      "type": "string",
      "enum": ["pagerduty", "opsgenie", "victorops", "custom"],
      "default": "custom"
    },
    "context": {
      "type": "object",
      "properties": {
        "repository_url": { "type": "string" },
        "deployment_platform": { "type": "string" },
        "documentation_platform": { "type": "string" },
        "sla_response_times": { "type": "object" }
      }
    }
  }
}
```

## Required Context

- `failure_scenarios[].symptoms` must be observable signals (error messages, metric names, user complaints) — not root causes, which are discovered during the runbook execution.
- `alert_definitions` should map to the SLO alert rules produced by slo-sla-designer; without them, runbooks cannot include the "triggered by alert X" header.
- For PagerDuty/OpsGenie/VictorOps `incident_process`, escalation tree uses the platform's native escalation policy format.
- `context.documentation_platform` affects Markdown flavor: Confluence uses `{code}` blocks, GitHub/GitLab uses fenced code blocks, Backstage TechDocs uses MkDocs extensions.

## Execution Logic

```
Step 1 — Classify failure scenarios by incident severity
  Map each scenario's `impact` description to severity using impact-scope criteria:
    P0 (Critical):  Complete service outage. All users affected. Revenue-impacting.
                    Response SLA: acknowledge in 5 minutes, bridge in 15 minutes.
    P1 (Major):     Significant degradation. >25% of users affected. Core feature broken.
                    Response SLA: acknowledge in 15 minutes, resolution ETA in 30 minutes.
    P2 (Minor):     Partial degradation. <25% of users affected. Workaround available.
                    Response SLA: acknowledge in 30 minutes, resolution ETA in 2 hours.
    P3 (Low):       Cosmetic issue or single-user impact. No workaround needed immediately.
                    Response SLA: acknowledge in 2 hours, scheduled fix in next sprint.
  Output: scenario_classifications[] { scenario_name, severity_level, response_sla }

Step 2 — Generate structured runbook per failure scenario
  For each scenario, produce a Markdown runbook document with sections:
    # Runbook: <scenario_name>
    ## Metadata
      - Service: <service_name>
      - Severity: <P0|P1|P2|P3>
      - Triggered by alert: <alert_name if matched> | Manual if no alert match
      - Last reviewed: <YYYY-MM-DD placeholder>
      - Owner: <team_name>
    ## Symptoms
      Bulleted list of observable signals from failure_scenarios[].symptoms.
    ## Impact Assessment
      Description of user-facing impact and scope from failure_scenarios[].impact.
    ## Detection
      1. Check alert in <monitoring_platform> dashboard: <dashboard_link_placeholder>
      2. Verify with: kubectl get pods -n <namespace> | grep <service_name>
                      kubectl logs -n <namespace> deployment/<service_name> --tail=100
                      <platform-specific metric query>
    ## Diagnosis Steps
      Ordered numbered steps with exact commands and expected vs. anomalous output:
      1. Check service health: curl -s https://<SERVICE_URL>/health | jq .
         Expected: {"status": "ok"}   Anomalous: connection refused / 503
      2. Check error rate: <prometheus/datadog query for error_rate>
         Expected: < 0.1%   Anomalous: > 1%
      3. Check upstream dependencies: <dependency health check commands>
      4. Check resource utilization: kubectl top pods -n <namespace>
         Expected: CPU < 80%, Memory < 85%   Anomalous: OOMKilled, CPU throttling
    ## Mitigation Steps
      Ordered numbered steps for each identified root cause class:
        If deployment regression: kubectl rollout undo deployment/<service_name> -n <namespace>
        If database connection exhaustion: kubectl scale deployment/<service_name> --replicas=0 then 2
        If cache stampede: set cache warm-up flag; temporarily increase TTL
        If certificate expiration: kubectl delete secret <tls-secret> && cert-manager renew
        If rate limit breach: increase rate limit in ConfigMap or temporarily disable
    ## Verification
      After applying mitigation, verify resolution:
        - Error rate returns to baseline: <metric query with expected value>
        - All pods Running: kubectl get pods -n <namespace> -l app=<service_name>
        - Health check passes: <health endpoint curl command>
    ## Escalation
      If not resolved in <resolution_sla>: escalate to Level 2 per escalation tree.
    ## Related Runbooks
      Links to related scenarios (dependency outage, database failover, etc.)
  Output: runbooks[] { scenario, title, severity_level, markdown_content, alert_link }

Step 3 — Generate incident severity classification matrix
  Produce a Markdown table defining P0/P1/P2/P3 with columns:
    Level | Definition | User Impact | Revenue Impact | Response Time | Resolution SLA | Examples
    P0    | Total outage | 100% users | Direct revenue loss | 5min ack | 1h MTTR | site down, DB unreachable
    P1    | Major degradation | >25% users | Significant | 15min ack | 4h MTTR | checkout broken, auth down
    P2    | Minor degradation | <25% users | Indirect | 30min ack | 24h MTTR | slow search, minor UI bug
    P3    | Cosmetic / individual | 1 user | None | 2h ack | Sprint | typo, wrong color
  Include: escalation policy, war room criteria (P0 always, P1 if unresolved > 30min),
           communication cadence (P0: every 15min, P1: every 30min, P2: every 2h).
  Output: incident_severity_matrix { levels[], war_room_criteria, communication_cadence }

Step 4 — Generate communication templates
  Status page (Statuspage.io / Atlassian format):
    Investigating: "We are investigating reports of [issue description] affecting [service].
                    Impact: [user-facing description]. Next update in [X] minutes."
    Identified:    "We have identified the issue as [root cause summary]. Our team is working on
                    a fix. ETA: [time]. Impact: [current user-facing status]."
    Monitoring:    "A fix has been applied. We are monitoring for full recovery.
                    Impact: [reduced impact description]."
    Resolved:      "This incident has been resolved. [Service] is fully operational as of [time].
                    [Brief one-line cause]. A post-mortem will be published within [N] business days."
  Slack incident channel template:
    :rotating_light: *INCIDENT DECLARED: [service_name] [P-level]*
    *Status:* Investigating | *Impact:* [description] | *IC:* @<incident_commander>
    *Bridge:* [link_placeholder] | *Ticket:* [link_placeholder]
  Customer notification email template:
    Subject: [Service Name] Service Disruption Notice
    Body: Brief professional description of impact and timeline, no technical jargon.
  Output: communication_templates { status_page{}, slack_templates{}, customer_email{} }

Step 5 — Generate post-mortem template
  Structure (blameless, systems-thinking focused):
    ## Incident Overview
      - Title, date/time (UTC), duration, severity, services affected, author(s), reviewers
    ## Timeline (UTC)
      | Time | Event | Actor |   (minimum 5 rows: first alert, detection, IC declared, fix applied, resolved)
    ## Impact Summary
      - Users affected: <N> (estimated/measured)
      - Error rate peak: <pct>%  Duration: <minutes>
      - Revenue impact: <estimate or N/A>
    ## Root Cause Analysis (5-Whys)
      Why 1: [symptom observed] → Why 2: [immediate cause] → Why 3: [contributing system]
      → Why 4: [process gap] → Why 5: [systemic root cause]
    ## Contributing Factors
      Bulleted list of conditions that made this incident worse or harder to detect.
    ## What Went Well
      Bulleted list: fast detection, good communication, effective rollback, etc.
    ## What Could Be Improved
      Bulleted list: gaps in monitoring, unclear runbook, slow escalation, etc.
    ## Action Items
      | Action | Owner | Due Date | Priority | Status |
      (SMART: Specific, Measurable, Assignable, Realistic, Time-bound)
    ## Lessons Learned
      One paragraph summary for organizational knowledge base.
  Output: postmortem_template { markdown_template, sections_list[] }

Step 6 — Generate escalation tree and on-call procedures
  Escalation tree with timeout-based auto-escalation:
    Level 1 (0min):  Primary On-Call — <PRIMARY_ONCALL_NAME> — contact via <incident_process>
    Level 2 (15min): Secondary On-Call — <SECONDARY_ONCALL_NAME> — contact via phone/SMS
    Level 3 (30min): Incident Commander (Engineering Manager) — contact via <IC_CONTACT>
    Level 4 (60min): VP Engineering escalation — contact via <VP_CONTACT>
    Level 5 (P0 only): Executive (CEO/CTO if customer SLA breach) — contact via <EXEC_CONTACT>
  For PagerDuty: emit escalation policy JSON with escalation_rules[] and num_loops.
  For OpsGenie: emit escalation policy YAML with steps[] and repeat settings.
  For VictorOps: emit routing key and escalation policy configuration.
  Output: escalation_tree { levels[], incident_process_config, auto_escalation_timeouts }

Step 7 — Generate runbook validation checklist
  Self-assessment checklist for each runbook:
    - [ ] All diagnosis commands include expected AND anomalous output examples
    - [ ] All kubectl/CLI commands include namespace/environment flags
    - [ ] Mitigation steps are ordered from least-disruptive to most-disruptive
    - [ ] Rollback procedure is documented as a distinct section
    - [ ] Verification criteria include a specific metric threshold, not just "check the dashboard"
    - [ ] Alert name is linked to the runbook via monitoring platform annotation
    - [ ] Escalation section references the escalation tree with correct timeouts
    - [ ] "Last reviewed" date is populated and within the last 90 days
  Output: runbook_validation_checklist[] { item, validation_type: automated|manual }
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `runbooks` | `array` | `{ scenario, title, severity_level, markdown_content, alert_link, detection_steps[], mitigation_steps[], escalation }` |
| `incident_severity_matrix` | `object` | P0–P3 definitions with response SLAs, war room criteria, and communication cadence |
| `communication_templates` | `object` | `{ status_page: { investigating, identified, monitoring, resolved }, slack_templates{}, customer_email{} }` |
| `postmortem_template` | `object` | Blameless post-mortem Markdown template with 5-whys and SMART action items |
| `escalation_tree` | `object` | `{ levels[], incident_process_config, auto_escalation_timeouts }` |
| `runbook_validation_checklist` | `array` | `{ item, validation_type: automated|manual }` |
| `metrics` | `object` | Execution metrics |
| `feedback` | `array` | Backpropagation and advisory entries |

**Output Schema:**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["runbooks", "incident_severity_matrix", "communication_templates",
               "postmortem_template", "escalation_tree", "runbook_validation_checklist",
               "metrics", "feedback"],
  "properties": {
    "runbooks": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["scenario", "title", "severity_level", "markdown_content"],
        "properties": {
          "scenario": { "type": "string" },
          "title": { "type": "string" },
          "severity_level": { "type": "string", "enum": ["P0", "P1", "P2", "P3"] },
          "markdown_content": { "type": "string" },
          "alert_link": { "type": "string" },
          "detection_steps": { "type": "array", "items": { "type": "string" } },
          "mitigation_steps": { "type": "array", "items": { "type": "string" } },
          "escalation": { "type": "string" }
        }
      }
    },
    "incident_severity_matrix": {
      "type": "object",
      "properties": {
        "levels": { "type": "array" },
        "war_room_criteria": { "type": "string" },
        "communication_cadence": { "type": "object" }
      },
      "required": ["levels"]
    },
    "communication_templates": {
      "type": "object",
      "properties": {
        "status_page": {
          "type": "object",
          "properties": {
            "investigating": { "type": "string" },
            "identified": { "type": "string" },
            "monitoring": { "type": "string" },
            "resolved": { "type": "string" }
          },
          "required": ["investigating", "resolved"]
        },
        "slack_templates": { "type": "object" },
        "customer_email": { "type": "object" }
      },
      "required": ["status_page"]
    },
    "postmortem_template": {
      "type": "object",
      "properties": {
        "markdown_template": { "type": "string" },
        "sections_list": { "type": "array", "items": { "type": "string" } }
      },
      "required": ["markdown_template"]
    },
    "escalation_tree": {
      "type": "object",
      "properties": {
        "levels": { "type": "array" },
        "incident_process_config": { "type": "object" },
        "auto_escalation_timeouts": { "type": "object" }
      },
      "required": ["levels"]
    },
    "runbook_validation_checklist": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "item": { "type": "string" },
          "validation_type": { "type": "string", "enum": ["automated", "manual"] }
        },
        "required": ["item", "validation_type"]
      }
    },
    "metrics": {
      "type": "object",
      "properties": {
        "tokens_in": { "type": "integer" },
        "tokens_out": { "type": "integer" },
        "duration_ms": { "type": "integer" },
        "runbooks_generated": { "type": "integer" },
        "scenarios_covered": { "type": "integer" },
        "version": { "type": "string" }
      },
      "required": ["tokens_in", "tokens_out", "duration_ms", "runbooks_generated", "version"]
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

- Every runbook MUST include exact CLI commands — no "run the health check script" vague references.
- Diagnosis steps MUST include both expected output and anomalous output examples so engineers can quickly confirm whether they are on the correct path.
- Mitigation steps MUST be ordered from least-disruptive to most-disruptive (avoid "restart everything" as Step 1).
- Post-mortem templates MUST be blameless — focus on system and process failures, not individual mistakes; never name individuals in the "What Could Be Improved" section.
- Escalation timeouts MUST be explicit numeric values (minutes) — "escalate if unresolved" without a timeout is not acceptable.
- Communication templates MUST use neutral, professional language with no technical jargon in customer-facing variants.
- All placeholder values (names, URLs, contact info) MUST be wrapped in `<PLACEHOLDER_NAME>` format for easy find-and-replace.
- Runbooks exceeding 500 lines of Markdown should be split into sub-runbooks linked from a parent runbook index.

## Security Considerations

- Escalation trees contain personnel contact information — mark these documents as internal-only and restrict Git repository access accordingly.
- CLI commands in runbooks must not contain credentials — use `kubectl get secret <name> -o jsonpath=...` patterns, not hardcoded passwords.
- Post-mortem documents may contain root-cause details that are security-sensitive — note that they should be stored in access-controlled documentation systems.
- Status page communication templates must not reveal internal system architecture, database names, or infrastructure details to external customers.

## Token Optimization

- Pass `failure_scenarios[].symptoms` as a short bulleted list, not prose paragraphs — the skill formats them into Markdown.
- Omit `alert_definitions` if alert-to-runbook linking is not required; the skill generates runbooks without alert anchors.
- For large numbers of scenarios (> 10), request runbooks for the highest-severity scenarios first; lower-severity scenarios can be generated in a second invocation.

## Quality Checklist

- [ ] Every runbook contains at least 3 numbered diagnosis steps with expected vs. anomalous output
- [ ] Every runbook's mitigation section covers at least 2 distinct root cause classes
- [ ] All CLI commands include namespace, environment, or deployment name flags
- [ ] Escalation tree has explicit timeout values for every level transition
- [ ] Communication templates are written without internal technical jargon
- [ ] Post-mortem template includes 5-whys section and SMART action items table
- [ ] All placeholder values use `<PLACEHOLDER_NAME>` format consistently
- [ ] Runbook validation checklist covers at least 8 quality criteria

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| `failure_scenarios` contains vague scenarios without specific symptoms | Generate runbook with generic detection steps; emit `warning` requesting specific observable signals |
| `alert_definitions` not provided | Generate runbooks without alert link annotations; emit `info` noting alert mapping requires `alert_definitions` |
| `on_call_rotation` not provided | Generate escalation tree with generic role placeholders (`<PRIMARY_ONCALL>`, `<IC>`, `<VP_ENG>`); emit `info` |
| `incident_process` is `pagerduty` but no PagerDuty service key in context | Generate standard escalation tree; emit `info` noting PagerDuty integration config requires service key |
| More than 15 failure scenarios requested | Process first 10 by severity; emit `warning` noting remaining scenarios need a second invocation |

## 12. Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Behavior |
|------|---------|---------|----------|
| P0 runbook review | Any scenario classified as P0 severity | 7200s | Route generated P0 runbook to senior engineer for manual review before publishing; P0 runbooks must be human-validated |
| Escalation tree with executive contact | Escalation level 5 (executive) auto-generated | 3600s | Pause; require human to confirm executive escalation contact details are current and approved |

## 13. Skill Composition

```yaml
composes_with:
  - skill: slo-sla-designer
    role: upstream
    note: "slo-sla-designer provides error_budget_rules[].alert_name for runbook alert linking"
  - skill: observability
    role: downstream
    note: "observability embeds runbook_url annotations into Prometheus/Datadog alert definitions"
  - skill: chaos-engineering-designer
    role: sibling
    note: "chaos experiments generate failure scenarios that can feed into failure_scenarios input"
  - skill: deployment-strategy
    role: upstream
    note: "deployment-strategy rollback procedures are referenced in deployment-regression runbooks"

input_from_state:
  - scope: slo_sla_designer
    field: error_budget_rules[*].alert_name
    maps_to: alert_definitions[*].alert_name
  - scope: architecture
    field: services[*].dependencies
    maps_to: failure_scenarios (dependency outage scenarios)

emits_events:
  - runbook.generated
  - runbook.p0.requires_review
  - runbook.escalation.executive_contact_flagged
```

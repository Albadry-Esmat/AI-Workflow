---
name: security-review
version: 1.0.0
domain: security
description: 'Use when asked to review security, find vulnerabilities, perform threat modeling, or assess risks in code or architecture. Triggers on: "security review", "find vulnerabilities", "threat modeling", "is this secure", "security risks", "OWASP", "penetration test", "security audit".'
author: system
---

## Purpose

Identify security vulnerabilities at the architecture and code level before they reach production. The skill produces a threat model, maps findings to OWASP Top 10 / CWE categories, assigns risk ratings, and generates actionable remediation steps. It is invoked after architecture design is complete and during code review cycles.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `architecture` | `object` | Yes | Output from architecture-design (modules, data_flow, integration_points, technical_decisions) |
| `code_snippets` | `array[object]` | No | Code to analyze (file_path, language, code) |
| `threat_model_context` | `string` | No | Existing threat model, compliance requirements (PCI, HIPAA, SOC2), or security policies |
| `strictness` | `string` | No | `"quick"`, `"standard"`, `"deep"` (default: `"standard"`) |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "architecture": { "type": "object" },
    "code_snippets": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "file_path": { "type": "string" },
          "language": { "type": "string" },
          "code": { "type": "string" }
        },
        "required": ["file_path", "language", "code"]
      }
    },
    "threat_model_context": { "type": "string" },
    "strictness": { "type": "string", "enum": ["quick", "standard", "deep"], "default": "standard" }
  },
  "required": ["architecture"]
}
```

## Required Context

- Architecture design from `architecture-design` (mandatory).
- Code base from `clean-code-review` output (optional but recommended for thorough review).

## Execution Logic

```
Step 1 — Map attack surface
  From architecture modules and integration points, identify:
  - External entry points (APIs, webhooks, message queues)
  - Authentication/authorization boundaries
  - Data stores and transit paths
  - Third-party dependencies
  Output: attack surface map

Step 2 — Threat modeling (STRIDE per module)
  For each module: Spoofing, Tampering, Repudiation, Information Disclosure, DoS, Elevation of Privilege.
  Score each threat: likelihood × impact.
  Output: STRIDE threat matrix

Step 3 — Analyze authentication and authorization
  Review auth flows from architecture. Check: credential storage, token handling, role hierarchy, permission model.
  If code_snippets provided, validate implementation against design.
  Output: auth analysis findings

Step 4 — Analyze data protection
  Review data flow for: encryption at rest, encryption in transit, PII handling, data retention policies.
  Flag plaintext sensitive data flows.
  Output: data protection findings

Step 5 — Analyze dependency and supply chain (if code provided)
  Review dependencies for known vulnerabilities.
  Flag outdated packages, insecure protocols, unverified sources.
  Output: dependency risk assessment

Step 6 — OWASP / CWE mapping
  Map each finding to OWASP Top 10 category and CWE identifier.
  Output: classified finding list

Step 7 — Prioritize and generate remediation
  Assign CVSS-style severity (Critical, High, Medium, Low, Info).
  For each finding: remediation steps, effort estimate, priority order.
  Output: prioritized remediation plan
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `vulnerabilities` | `array[object]` | Security findings (id, owasp, cwe, severity, location, description) |
| `threat_model` | `object` | STRIDE threat matrix per module |
| `remediation` | `array[object]` | Remediation steps (finding_id, action, effort, priority) |
| `risks` | `array[object]` | Business risks (description, likelihood, impact, severity) |
| `metrics` | `object` | Counts by severity, coverage |
| `feedback` | `array[object]` | Feedback loop entries for backpropagation |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "vulnerabilities": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": { "type": "string", "pattern": "^SEC-\\d{4}$" },
          "owasp": { "type": "string" },
          "cwe": { "type": "string" },
          "severity": { "type": "string", "enum": ["critical", "high", "medium", "low", "info"] },
          "location": { "type": "string" },
          "description": { "type": "string" },
          "affected_module": { "type": "string" }
        },
        "required": ["id", "severity", "description"]
      }
    },
    "threat_model": {
      "type": "object",
      "properties": {
        "modules": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "module": { "type": "string" },
              "stride": {
                "type": "object",
                "properties": {
                  "spoofing": { "type": "string", "enum": ["none", "low", "medium", "high", "critical"] },
                  "tampering": { "type": "string" },
                  "repudiation": { "type": "string" },
                  "info_disclosure": { "type": "string" },
                  "dos": { "type": "string" },
                  "elevation": { "type": "string" }
                }
              }
            },
            "required": ["module", "stride"]
          }
        }
      },
      "required": ["modules"]
    },
    "remediation": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "finding_id": { "type": "string" },
          "action": { "type": "string" },
          "effort": { "type": "string", "enum": ["minutes", "hours", "days", "weeks"] },
          "priority": { "type": "integer", "minimum": 1, "maximum": 5 }
        },
        "required": ["finding_id", "action", "priority"]
      }
    },
    "risks": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "description": { "type": "string" },
          "likelihood": { "type": "string", "enum": ["rare", "unlikely", "possible", "likely", "almost_certain"] },
          "impact": { "type": "string", "enum": ["critical", "high", "medium", "low"] },
          "severity": { "type": "string", "enum": ["critical", "high", "medium", "low"] }
        },
        "required": ["description", "likelihood", "impact", "severity"]
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
        "critical": { "type": "integer" },
        "high": { "type": "integer" },
        "medium": { "type": "integer" },
        "low": { "type": "integer" },
        "info": { "type": "integer" },
        "threat_model_modules": { "type": "integer" }
      },
      "required": ["tokens_in", "tokens_out", "duration_ms", "items_produced", "version", "critical", "high", "medium", "low"]
    },
    "feedback": {
      "type": "array",
      "items": { "$ref": "#/$defs/feedback_entry" }
    }
  },
  "required": ["vulnerabilities", "threat_model", "remediation", "risks", "metrics", "feedback"],
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

- Every vulnerability MUST map to an OWASP category and CWE identifier.
- Critical vulnerabilities MUST include a remediation step.
- Do NOT scan for generic secrets (API keys, tokens) — that is a separate concern.
- `threat_model` MUST cover every module from the architecture input.

## Security Considerations

- This skill handles security-sensitive output. Results MUST NOT be exposed outside authorized channels.
- Vulnerability details MUST be abstract (describe the class of issue, not the exact exploit path).
- Remediation MUST NOT introduce new attack vectors (e.g., disabling security controls).

## Quality Checklist

- [ ] Every module has a STRIDE assessment
- [ ] All vulnerabilities have remediation steps
- [ ] Critical findings have priority 1
- [ ] CVSS-like severity assigned correctly (not over/under-rated)
- [ ] OWASP mapping is accurate per finding

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| No architecture provided | Return error: `{"error": "NO_ARCHITECTURE"}` |
| Code in unparseable language | Skip code analysis, flag in metrics, continue with architecture-only review |
| No threats found | Return empty vulnerabilities with `"clean": true` flag |
| Too many findings (>50) | Group by OWASP category, return top 20 with `"truncated": true` |

## 9. Token Optimization

- Compress `architecture` input to module names + integration points only. Strip `metadata`, `component_diagram`, and `technical_decisions` before passing to STRIDE modeling.
- Use abbreviated STRIDE labels: `S`, `T`, `R`, `I`, `D`, `E`.
- Limit `threat_model.modules` to the 10 highest-risk modules if total exceeds 15.
- Omit `remediation.improved_code` (code changes belong to clean-code-review, not this skill).
- Truncate `code_snippets` input to first 100 lines per file.

## 12. Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Behavior |
|------|---------|---------|----------|
| Security posture approval | Any `vulnerability.severity` is `critical` OR `risks` contains `severity: critical` | 3600s | Pause, present full threat model and critical findings for sign-off |

- Gate presents: critical count, high count, threat model summary, top 3 remediation items.
- If rejected: re-run architecture-design with security constraints added (backpropagate).

## 13. Skill Composition

`security-review` may be composed with `clean-code-review` in a `full-audit` meta-skill. See `clean-code-review` Section 13 for the composition definition.

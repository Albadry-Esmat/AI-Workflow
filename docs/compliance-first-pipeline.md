# Compliance-First Pipeline

**FEATURE-017** | Pipeline version `1.0.0` | Entry skill: `compliance-profiler` (SKL-116)

---

## Overview

The **compliance-first pipeline** is a variant of the full delivery pipeline that inserts
structured compliance gates at three critical checkpoints: after architecture design, after
test-suite generation, and after deployment strategy. A new `compliance-profiler` skill runs
at pipeline entry to collect the applicable regulatory frameworks and emit a
`compliance_requirements` artifact that every downstream skill receives as a mandatory
constraint.

**When to use this pipeline instead of `full-pipeline`:**

| Scenario | Recommended pipeline |
|----------|----------------------|
| SaaS product handling user PII under GDPR | `compliance-first` |
| US healthcare application (ePHI) | `compliance-first` |
| Cloud service seeking SOC 2 Type II certification | `compliance-first` |
| Internal tool with no regulatory exposure | `full-pipeline` |
| Any project where a compliance audit is planned | `compliance-first` |
| Rapid prototype / proof of concept | `full-pipeline` |

The pipeline produces three machine-readable compliance coverage reports
(`artifacts/compliance-architecture-<ts>.md`, `artifacts/compliance-test-suite-<ts>.md`,
`artifacts/compliance-deployment-<ts>.md`) that can be used as audit evidence.

---

## Supported Frameworks

| Framework | Code | Scope | Key Use Cases |
|-----------|------|-------|---------------|
| **SOC 2 Type II** | `soc2` | Security, Availability, Confidentiality Trust Service Criteria | SaaS, cloud services, B2B products |
| **HIPAA** | `hipaa` | US Health Insurance Portability and Accountability Act — Security Rule | Healthcare apps, ePHI processing, US medical devices |
| **GDPR** | `gdpr` | EU General Data Protection Regulation | Any service processing personal data of EU residents |
| **ISO 27001:2022** | `iso27001` | Information Security Management System (international standard) | Enterprise software, government contracts, international expansion |
| **Custom** | `custom` | User-defined control set | Internal security policies, contractual obligations, bespoke audit frameworks |

Multiple frameworks can be combined. Controls are deduplicated by ID when frameworks overlap.

---

## Quick Start

### Interactive mode (recommended for first run)

Invoke the pipeline with no framework pre-selection. `compliance-profiler` will present
an interactive HITL prompt at pipeline start:

```json
{
  "pipeline_config": {
    "pipeline": "compliance-first"
  }
}
```

The profiler will ask:
- Which frameworks apply (SOC 2 / HIPAA / GDPR / ISO 27001 / Custom)
- Highest data classification level (public / internal / confidential / restricted)
- Applicable jurisdictions (required when GDPR is selected)

### CI mode (non-interactive)

Pre-select frameworks to skip the HITL prompt:

```json
{
  "pipeline_config": {
    "pipeline": "compliance-first",
    "compliance_frameworks": ["soc2", "gdpr"],
    "data_classification": "confidential",
    "jurisdiction": ["EU", "US-CA"],
    "ci_mode": true,
    "clarify_enabled": false
  }
}
```

### Multi-framework example (HIPAA + SOC 2)

```json
{
  "pipeline_config": {
    "pipeline": "compliance-first",
    "compliance_frameworks": ["hipaa", "soc2"],
    "data_classification": "restricted",
    "ci_mode": true
  }
}
```

> **Note:** `data_classification: "restricted"` automatically escalates all `should`-severity
> controls in the HIPAA and SOC 2 catalogs to `must`. This increases the number of blocking
> controls and raises the coverage bar.

### Custom controls

```json
{
  "pipeline_config": {
    "pipeline": "compliance-first",
    "compliance_frameworks": ["soc2", "custom"],
    "ci_mode": true
  },
  "custom_controls": [
    {
      "id": "CORP-001",
      "title": "Data residency: all PII stored in EU region",
      "description": "System must not store PII outside EU-West-1 or EU-Central-1 regions.",
      "severity": "must"
    },
    {
      "id": "CORP-002",
      "title": "Penetration test within 12 months",
      "description": "A third-party penetration test must have been conducted within the last 12 months.",
      "severity": "should"
    }
  ]
}
```

---

## Coverage Gate Behaviour

### Verdict levels

| Verdict | Meaning | Pipeline effect |
|---------|---------|-----------------|
| `pass` | Must coverage ≥ threshold AND should coverage ≥ 80% | Pipeline continues automatically |
| `warn` | Must coverage ≥ threshold BUT should coverage < 80% | Pipeline continues with a warning logged |
| `block` | Must coverage < threshold | **Pipeline halts.** HITL gate fires. Human must intervene. |

### Default thresholds

```
must_coverage:    100%  (all must controls must be evidenced)
should_coverage:   80%  (advisory — pipeline continues with warn below 80%)
```

### Lowering the floor for MVP pipelines

To allow shipping with partial must-control coverage during early development, set
`coverage_floor: 80` in the skill inputs. This is valid for development/staging pipelines
only. **Production pipelines should always use the 100% default.**

```json
{
  "pipeline_config": {
    "pipeline": "compliance-first",
    "compliance_frameworks": ["soc2"],
    "ci_mode": true
  },
  "phase_overrides": {
    "phase-2b-compliance-check": {
      "coverage_floor": 80
    },
    "phase-7b-compliance-check": {
      "coverage_floor": 80
    },
    "phase-9b-compliance-check": {
      "coverage_floor": 80
    }
  }
}
```

### Gate positions

```
phase-0-compliance      → HITL: "Confirm compliance frameworks" (timeout: 300s)
phase-2-architecture    → ...
phase-2b-compliance-check → CONDITION: verdict !== 'block'
phase-4-planning        → ...
phase-5-impact          → ...
phase-6-execution       → ...
phase-7-quality         → ...
phase-7b-compliance-check → CONDITION: verdict !== 'block'
phase-8-audit           → CONDITION: readiness_score >= 85
phase-9-deploy          → HITL: "Approve deployment" (timeout: 3600s, non-bypassable)
phase-9b-compliance-check → HITL: "Final compliance sign-off" (timeout: 3600s, non-bypassable)
phase-10-docs           → (async, no gate)
```

---

## Framework-Specific Controls

### SOC 2 Type II (8 controls: 6 must, 2 should)

| Control ID | Title | Severity |
|------------|-------|----------|
| CC6.1 | Logical access restricted to authorized users | must |
| CC6.2 | User provisioning and de-provisioning process | must |
| CC6.6 | Encryption of data in transit | must |
| CC6.7 | Encryption of data at rest for restricted/confidential data | must |
| CC7.2 | Vulnerability management and monitoring | must |
| CC8.1 | Change management process for production | must |
| A1.1 | System availability commitments documented | should |
| A1.2 | Capacity planning process | should |

### HIPAA Security Rule (8 controls: 7 must, 1 should)

| Control ID | Title | Severity |
|------------|-------|----------|
| 164.312(a)(1) | Access control: unique user identification | must |
| 164.312(a)(2) | Automatic logoff for inactive sessions | must |
| 164.312(b) | Audit controls: hardware/software/procedure | must |
| 164.312(c)(1) | Integrity: protect ePHI from alteration/destruction | must |
| 164.312(d) | Person or entity authentication | must |
| 164.312(e)(1) | Transmission security: encrypt ePHI in transit | must |
| 164.308(a)(1) | Security management process and risk analysis | must |
| 164.308(a)(5) | Security awareness training | should |

### GDPR (9 controls: 8 must, 1 should)

| Control ID | Title | Severity |
|------------|-------|----------|
| Art.5 | Data minimisation and purpose limitation | must |
| Art.6 | Lawful basis for processing | must |
| Art.13 | Privacy notices and transparency | must |
| Art.17 | Right to erasure ("right to be forgotten") | must |
| Art.20 | Data portability | must |
| Art.25 | Privacy by design and by default | must |
| Art.32 | Appropriate technical security measures | must |
| Art.33 | Data breach notification within 72 hours | must |
| Art.35 | DPIA for high-risk processing (**escalated to must** when EU jurisdiction detected) | should / must |

### ISO 27001:2022 Annex A (11 controls: 10 must, 1 should)

| Control ID | Title | Severity |
|------------|-------|----------|
| A.5.1 | Information security policies | must |
| A.5.15 | Access control policy | must |
| A.6.3 | Information security awareness and training | must |
| A.8.3 | Information access restriction | must |
| A.8.5 | Secure authentication | must |
| A.8.7 | Protection against malware | must |
| A.8.24 | Use of cryptography | must |
| A.8.25 | Secure development lifecycle | must |
| A.8.28 | Secure coding practices | must |
| A.8.32 | Change management | must |
| A.8.33 | Test information protection | should |

---

## Configuration Options

All keys are set under `pipeline_config` in the pipeline invocation.

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `compliance_frameworks` | `array[string]` | `null` (HITL prompt) | Pre-select frameworks: `["soc2", "hipaa", "gdpr", "iso27001", "custom"]`. |
| `ci_mode` | `boolean` | `false` | Skip the HITL framework selection prompt. Requires `compliance_frameworks` to be set. |
| `data_classification` | `string` | `"confidential"` | Highest sensitivity level: `"public"`, `"internal"`, `"confidential"`, `"restricted"`. |
| `jurisdiction` | `array[string]` | `[]` | Legal jurisdictions, e.g. `["EU", "US-CA"]`. Triggers GDPR Art.35 escalation for EU codes. |
| `clarify_enabled` | `boolean` | `false` | Enable the HITL clarification phase (phase-1b) for ambiguous requirements. |
| `coverage_floor` | `integer` | `100` | Minimum must-control coverage % across all three gates. Set to `80` for MVP. |
| `should_floor` | `integer` | `80` | Minimum should-control coverage % for advisory warnings. |

---

## Reading Coverage Reports

### Report location

Coverage reports are written to the `artifacts/` directory (relative to the pipeline working
directory) immediately after each compliance gate runs:

```
artifacts/
  compliance-architecture-<ISO-timestamp>.md
  compliance-test-suite-<ISO-timestamp>.md
  compliance-deployment-<ISO-timestamp>.md
```

> **Note:** The `compliance_requirements` artifact itself is stored only in `session_context`
> and is **not** written to `artifacts/` to avoid committing regulatory exposure metadata to
> version control.

### Report structure

Each coverage report contains:

```markdown
# Compliance Coverage Report — <stage_name>
**Stage:** architecture | test-suite | deployment
**Frameworks:** soc2, gdpr
**Generated:** 2026-07-09T14:32:00Z
**Verdict:** PASS | WARN | BLOCK

## Coverage Summary
| Severity | Controls | Covered | Coverage |
|----------|----------|---------|----------|
| must     | 14       | 14      | 100%     |
| should   | 3        | 2       | 67%      |
| may      | 0        | 0       | —        |

## Uncovered Must Controls
(empty when verdict is PASS or WARN)

## Uncovered Should Controls
- Art.35 — DPIA for high-risk processing

## Covered Controls
| ID     | Evidence keyword found |
|--------|------------------------|
| CC6.1  | "RBAC", "IAM"          |
| CC6.6  | "TLS", "HTTPS"         |
| ...    | ...                    |
```

### Using reports as audit evidence

The three coverage reports together form a compliance evidence trail for:
- **SOC 2 readiness assessments** — attach to Type II audit package
- **HIPAA risk analysis** — demonstrates documented security controls
- **GDPR DPIA** — provides evidence of privacy-by-design assessment
- **ISO 27001 internal audit** — maps controls to implemented measures

---

## Troubleshooting

### Pipeline blocks at phase-2b-compliance-check (architecture gate)

**Symptom:** `verdict: "block"` — architecture compliance coverage is below 100%.

**Common causes and fixes:**

| Uncovered control | What's missing | Fix |
|-------------------|----------------|-----|
| CC6.1 / A.5.15 | No access control model described | Add RBAC or IAM section to architecture doc |
| CC6.6 / 164.312(e)(1) | No TLS/encryption mentioned | Specify TLS 1.2+ for all API endpoints in architecture |
| CC6.7 | No encryption-at-rest for DB/storage | Add KMS or AES-256 encryption to data store design |
| Art.17 | Right to erasure not addressed | Add data deletion API or soft-delete policy to architecture |
| Art.25 | Privacy by design not documented | Add privacy-by-design section to architecture output |
| 164.312(b) | No audit logging design | Add structured audit log module to architecture |

**Resolution path:**
1. Review the `artifacts/compliance-architecture-<ts>.md` report — check the "Uncovered Must Controls" section
2. Each uncovered control has a `fix_hint` — follow it to update the architecture
3. Re-run the architecture phase and compliance gate
4. Reply `OVERRIDE <reason>` at the HITL gate only if you have explicit approval authority and can document the exception

---

### Pipeline blocks at phase-7b-compliance-check (test-suite gate)

**Symptom:** Test suite does not cover compliance controls.

**Common causes and fixes:**

| Issue | Fix |
|-------|-----|
| No authentication tests | Add test cases: "should reject unauthenticated requests", "should enforce MFA" |
| No encryption verification tests | Add integration test that confirms TLS on all endpoints |
| No data deletion test | Add test: "DELETE /user/:id should purge all PII" |
| No audit log test | Add test: "critical operations should emit audit log entries" |

---

### Pipeline blocks at phase-9b-compliance-check (deployment gate)

**Symptom:** Deployment configuration has uncovered compliance controls.

**Common causes and fixes:**

| Issue | Fix |
|-------|-----|
| No secrets management in deployment | Add KMS / Vault / AWS Secrets Manager reference to deployment config |
| No change management process | Add CI/CD approval workflow and deployment gating to deployment-strategy output |
| No availability commitments (SOC 2 A1.1) | Add SLA targets and failover architecture to deployment plan |
| No backup / DR plan | Add backup schedule and DR runbook reference to deployment strategy |

---

### HITL gate timeout at phase-0-compliance

If the framework selection HITL times out (300s with no response), `compliance-profiler`
defaults to `["soc2"]` with `data_classification: "confidential"`. A `WARN` is logged and
the pipeline continues. To prevent this in CI, always set `ci_mode: true` with explicit
`compliance_frameworks`.

---

### `data_classification: "restricted"` blocks more controls than expected

When `data_classification` is `"restricted"`, all `should`-severity controls in the HIPAA
and SOC 2 catalogs are automatically escalated to `must`. This increases the must-control
count and raises the 100% coverage requirement. Review the full escalated control list in
the profiler output before running the pipeline.

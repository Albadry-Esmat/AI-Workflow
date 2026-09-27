---
name: compliance-profiler
version: 1.0.0
domain: governance
description: 'Use at pipeline entry to interactively collect applicable compliance frameworks (SOC 2 Type II, HIPAA, GDPR, ISO 27001, or custom) and emit a structured compliance_requirements artifact that downstream skills use as a mandatory constraint. Triggers on: "compliance requirements", "SOC 2", "HIPAA", "GDPR", "ISO 27001", "compliance standards", "regulatory requirements", "compliance-first pipeline", "collect compliance frameworks".'
author: system
---

## Purpose

Gather the compliance and regulatory frameworks that apply to the project and emit a
structured `compliance_requirements` artifact. This artifact is injected as a mandatory
constraint into every downstream skill in the compliance-first pipeline
(architecture-design, feature-planning, test-generator, deployment-strategy).

Without this skill, the pipeline has no structured compliance context and cannot enforce
framework-specific controls. compliance-profiler MUST run before any design or
implementation skill in the compliance-first pipeline.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `frameworks` | `array[string]` | No | Pre-selected frameworks. Skips HITL prompt if provided. Allowed values: `"soc2"`, `"hipaa"`, `"gdpr"`, `"iso27001"`, `"custom"`. |
| `custom_controls` | `array[object]` | No | Custom compliance controls when `"custom"` is in `frameworks`. Each object: `{ id, title, description, severity: "must"\|"should"\|"may" }`. |
| `data_classification` | `string` | No | Highest data sensitivity level handled by the system. Enum: `"public"`, `"internal"`, `"confidential"`, `"restricted"`. Default: `"confidential"`. |
| `jurisdiction` | `array[string]` | No | Applicable legal jurisdictions (e.g. `["EU", "US-CA", "US-HIPAA"]`). Used to select GDPR vs CCPA controls. |
| `skip_hitl` | `boolean` | No | When `true`, skips the interactive HITL prompt and uses `frameworks` as-is. For CI mode. Default: `false`. |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "frameworks": {
      "type": "array",
      "items": { "type": "string", "enum": ["soc2", "hipaa", "gdpr", "iso27001", "custom"] },
      "minItems": 1
    },
    "custom_controls": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "title", "description", "severity"],
        "properties": {
          "id":          { "type": "string" },
          "title":       { "type": "string" },
          "description": { "type": "string" },
          "severity":    { "type": "string", "enum": ["must", "should", "may"] }
        }
      }
    },
    "data_classification": {
      "type": "string",
      "enum": ["public", "internal", "confidential", "restricted"],
      "default": "confidential"
    },
    "jurisdiction": {
      "type": "array",
      "items": { "type": "string" }
    },
    "skip_hitl": { "type": "boolean", "default": false }
  }
}
```

## Required Context

- Pipeline configuration for `data_classification` and `jurisdiction` defaults.
- Project description from `requirement-analyzer` output (if available) for context-aware control selection.

## Execution Logic

```
Step 1 — Determine applicable frameworks
  IF frameworks[] is provided AND skip_hitl=true:
    Use provided frameworks[] directly. Skip Step 2.
  ELSE:
    Proceed to Step 2 (HITL prompt).

Step 2 — HITL: Collect framework selection
  Present to user:
    "Which compliance frameworks apply to this project? Select all that apply:
      [ ] SOC 2 Type II — Security, Availability, Confidentiality controls (SaaS/cloud services)
      [ ] HIPAA         — Health data privacy and security (US healthcare)
      [ ] GDPR          — Personal data protection (EU residents, or international)
      [ ] ISO 27001     — Information security management system (international standard)
      [ ] Custom        — Provide your own control list
    Data classification (highest sensitivity): [public / internal / confidential / restricted]
    Jurisdictions (if GDPR selected): [e.g. EU, US-CA]"
  Wait for response (timeout: 300s).
  On timeout: default to ["soc2"] with data_classification="confidential". Log WARN.
  Parse selected frameworks from response.
  IF "custom" selected AND custom_controls[] not provided in input:
    Prompt user: "Provide custom controls as JSON array: [{id, title, description, severity}]"
    Wait for response (timeout: 180s). On timeout: skip custom controls, emit warning.

Step 3 — Load control catalog for selected frameworks
  For each selected framework:
    "soc2":
      Load SOC 2 TSC controls:
        CC6.1 — Logical access restricted to authorized users (must)
        CC6.2 — User provisioning and de-provisioning process (must)
        CC6.6 — Encryption of data in transit (must)
        CC6.7 — Encryption of data at rest for restricted/confidential data (must)
        CC7.2 — Vulnerability management and monitoring (must)
        CC8.1 — Change management process for production (must)
        A1.1   — System availability commitments documented (should)
        A1.2   — Capacity planning process (should)
    "hipaa":
      Load HIPAA Security Rule controls:
        164.312(a)(1) — Access control: unique user identification (must)
        164.312(a)(2) — Automatic logoff for inactive sessions (must)
        164.312(b)    — Audit controls: hardware/software/procedure (must)
        164.312(c)(1) — Integrity: protect ePHI from alteration/destruction (must)
        164.312(d)    — Person or entity authentication (must)
        164.312(e)(1) — Transmission security: encrypt ePHI in transit (must)
        164.308(a)(1) — Security management process and risk analysis (must)
        164.308(a)(5) — Security awareness training (should)
    "gdpr":
      Load GDPR controls:
        Art.5    — Data minimisation and purpose limitation (must)
        Art.6    — Lawful basis for processing (must)
        Art.13   — Privacy notices and transparency (must)
        Art.17   — Right to erasure ("right to be forgotten") (must)
        Art.20   — Data portability (must)
        Art.25   — Privacy by design and by default (must)
        Art.32   — Appropriate technical security measures (must)
        Art.33   — Data breach notification within 72 hours (must)
        Art.35   — Data Protection Impact Assessment (DPIA) for high-risk processing (should)
    "iso27001":
      Load ISO 27001:2022 Annex A controls:
        A.5.1   — Information security policies (must)
        A.5.15  — Access control policy (must)
        A.6.3   — Information security awareness and training (must)
        A.8.3   — Information access restriction (must)
        A.8.5   — Secure authentication (must)
        A.8.7   — Protection against malware (must)
        A.8.24  — Use of cryptography (must)
        A.8.25  — Secure development lifecycle (must)
        A.8.28  — Secure coding practices (must)
        A.8.32  — Change management (must)
        A.8.33  — Test information protection (should)
    "custom":
      Append custom_controls[] to control list.
  Build merged controls[]: all controls from all selected frameworks (deduplicated by id).
  Output: merged controls[]

Step 4 — Classify controls by severity
  Partition controls into:
    must_controls[]:   severity="must"  → pipeline gate blocks if coverage < 100%
    should_controls[]: severity="should" → pipeline gate warns if coverage < 80%
    may_controls[]:    severity="may"   → informational only, no gate

Step 5 — Assemble compliance_requirements artifact
  Build artifact:
  {
    "frameworks":           selected frameworks[],
    "data_classification":  resolved data_classification,
    "jurisdiction":         resolved jurisdiction[],
    "controls":             merged controls[],
    "must_controls_count":  count of must_controls,
    "should_controls_count": count of should_controls,
    "coverage_threshold": {
      "must_pct":   100,
      "should_pct":  80
    },
    "generated_at": ISO timestamp,
    "version": "1.0.0"
  }

Step 6 — Emit telemetry and return
  Emit event: compliance_requirements.generated
  Return output.
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `compliance_requirements` | `object` | Structured compliance artifact. Passed as constraint to all downstream skills. |
| `frameworks_selected` | `array[string]` | Names of selected compliance frameworks. |
| `controls_count` | `integer` | Total number of controls loaded (must + should + may). |
| `must_controls_count` | `integer` | Number of blocking controls (severity="must"). |
| `coverage_threshold` | `object` | `{ must_pct: 100, should_pct: 80 }` — thresholds enforced by compliance-gate. |
| `metrics` | `object` | `tokens_in`, `tokens_out`, `duration_ms`, `items_produced`, `version`. |
| `feedback` | `array[object]` | Feedback loop entries (warnings for timeout defaults, missing custom controls, etc.). |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["compliance_requirements", "frameworks_selected", "controls_count", "must_controls_count", "coverage_threshold", "metrics", "feedback"],
  "properties": {
    "compliance_requirements": { "type": "object" },
    "frameworks_selected":    { "type": "array", "items": { "type": "string" } },
    "controls_count":         { "type": "integer", "minimum": 0 },
    "must_controls_count":    { "type": "integer", "minimum": 0 },
    "coverage_threshold": {
      "type": "object",
      "properties": {
        "must_pct":   { "type": "integer", "minimum": 0, "maximum": 100 },
        "should_pct": { "type": "integer", "minimum": 0, "maximum": 100 }
      }
    },
    "metrics": { "type": "object" },
    "feedback": { "type": "array", "items": { "type": "object" } }
  }
}
```

## Rules & Constraints

- **compliance-profiler MUST run before any design or implementation skill** in the compliance-first pipeline. Its `compliance_requirements` output is a prerequisite for `compliance-gate`.
- If `frameworks[]` is empty and `skip_hitl=true`, emit `warning` and default to `["soc2"]`. Never produce an empty control list.
- `data_classification="restricted"` automatically escalates all `should` controls in the HIPAA and SOC 2 catalogs to `must`.
- GDPR jurisdiction detection: if `jurisdiction[]` contains any EU member state code OR `"EU"`, include GDPR Art.35 (DPIA) as `must` regardless of its default severity.
- Custom controls with `severity="must"` are treated identically to framework controls — they block the pipeline if not covered.
- `compliance_requirements` is a **read-only constraint artifact**. Downstream skills consume it but MUST NOT modify it.

## Security Considerations

- `compliance_requirements` may contain jurisdiction identifiers that reveal the project's geographic or regulatory exposure. The artifact is stored in `session_context.compliance_requirements` and is NOT written to `artifacts/` (avoids committing regulatory metadata to git).
- The HITL prompt MUST NOT solicit or accept API credentials, authentication details, or sensitive system configuration. It collects only framework selections and jurisdiction codes.
- If `"hipaa"` is selected, all subsequent skill outputs should be treated as potentially health-system-adjacent and must not include identifiable health data in export artifacts.

## Token Optimization

- Load only the control entries for selected frameworks — do not load the full SOC 2 / HIPAA / GDPR / ISO 27001 text.
- Control catalog is embedded in this skill's execution context (no external fetch required).
- HITL prompt is a single round-trip — collect all framework selections and data classification in one message.
- The `compliance_requirements` artifact is a compact JSON object (typically < 3 KB); pass it by reference (`session_context.compliance_requirements`) in downstream skills rather than inlining.

## Quality Checklist

- [ ] At least one framework selected (no empty framework list)
- [ ] All selected frameworks have at least one `must` control
- [ ] Custom controls validated: each has `id`, `title`, `description`, `severity`
- [ ] `coverage_threshold` set: `{ must_pct: 100, should_pct: 80 }`
- [ ] `data_classification="restricted"` escalates applicable `should` controls to `must`
- [ ] GDPR jurisdiction detection: EU codes trigger Art.35 escalation
- [ ] HITL timeout default logged as WARN with defaulted values
- [ ] `compliance_requirements` stored in `session_context` (NOT written to `artifacts/`)

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| HITL timeout (300s) with no `frameworks` input | Default to `["soc2"]`, `data_classification="confidential"`. Emit `warning`. |
| `"custom"` selected but `custom_controls[]` is empty and HITL times out (180s) | Skip custom controls, emit `warning`. Other selected frameworks still apply. |
| Invalid framework value in `frameworks[]` | Emit `warning` for each invalid value, skip them, continue with valid frameworks. |
| No valid frameworks after filtering | Emit `warning`, default to `["soc2"]`. Never return empty controls. |

## Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Behavior on Timeout |
|------|---------|---------|---------------------|
| Framework selection | `skip_hitl=false` AND `frameworks[]` not provided | 300s | Default to `["soc2"]`, `data_classification="confidential"`. Log WARN. |
| Custom controls input | `"custom"` in frameworks AND `custom_controls[]` empty | 180s | Skip custom controls, emit `warning`. |

## Skill Composition

`compliance-profiler` v1.0.0 runs as step 0 in the `compliance-first.json` pipeline. Its `compliance_requirements` output is passed to every subsequent skill as a mandatory constraint input.

```yaml
composes:
  - skill: compliance-profiler
    version: "^1.0.0"
    input_map: { "frameworks": "pipeline_config.compliance_frameworks", "skip_hitl": "pipeline_config.ci_mode" }
    output_map: { "compliance_requirements": "compliance_requirements", "coverage_threshold": "coverage_threshold" }

pipeline_position: phase-0-compliance in compliance-first.json
downstream_consumers:
  - compliance-gate (SKL-117): receives compliance_requirements + stage output
  - architecture-design: receives compliance_requirements as constraint
  - feature-planning: receives compliance_requirements as constraint
  - test-generator: receives compliance_requirements as constraint
  - deployment-strategy: receives compliance_requirements as constraint
```

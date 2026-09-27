---
name: compliance-gate
version: 1.0.0
domain: governance
description: 'Guard skill that validates a pipeline stage output against the compliance_requirements artifact from compliance-profiler. Computes coverage across applicable controls and blocks the pipeline if must-control coverage < threshold (default 100%, configurable to 80% for MVP). Emits a coverage report. Triggers on: "compliance check", "compliance gate", "validate compliance coverage", "regulatory gate", "coverage below threshold".'
author: system
---

## Purpose

Evaluate a pipeline stage output (architecture, plan, test suite, or deployment config)
against the `compliance_requirements` artifact from `compliance-profiler`. For each
applicable control, determine whether the stage output provides evidence of coverage.
Block the pipeline if `must` control coverage falls below the threshold (default 100%).
Emit a coverage report to `artifacts/compliance-<timestamp>.md`.

compliance-gate is designed to run multiple times in the compliance-first pipeline —
after architecture, after test-generator, and after deployment-strategy — each time
evaluating the stage output against the same `compliance_requirements`.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `compliance_requirements` | `object` | Yes | Output from `compliance-profiler`. Contains `controls[]`, `must_controls_count`, `coverage_threshold`. |
| `stage_output` | `object` | Yes | Output of the pipeline stage to validate. Schema-agnostic — the gate inspects it for compliance evidence. |
| `stage_name` | `string` | Yes | Name of the stage being validated (e.g. `"architecture"`, `"test-suite"`, `"deployment"`). Used in the coverage report. |
| `coverage_floor` | `integer` | No | Minimum `must` coverage percentage to pass. Default: `100`. Configurable down to `80` for MVP. Range: 0–100. |
| `must_floor` | `integer` | No | Alias for `coverage_floor`. If both provided, `must_floor` takes precedence. |
| `should_floor` | `integer` | No | Minimum `should` coverage percentage to warn. Default: `80`. |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["compliance_requirements", "stage_output", "stage_name"],
  "properties": {
    "compliance_requirements": { "type": "object" },
    "stage_output":   { "type": "object" },
    "stage_name":     { "type": "string" },
    "coverage_floor": { "type": "integer", "minimum": 0, "maximum": 100, "default": 100 },
    "must_floor":     { "type": "integer", "minimum": 0, "maximum": 100 },
    "should_floor":   { "type": "integer", "minimum": 0, "maximum": 100, "default": 80 }
  }
}
```

## Required Context

- `compliance_requirements` from `session_context.compliance_requirements` (set by compliance-profiler).
- `stage_output` from the prior pipeline phase's skill output.

## Execution Logic

```
Step 1 — Resolve thresholds
  must_threshold  = must_floor if provided, else coverage_floor if provided, else 100
  should_threshold = should_floor if provided, else 80

Step 2 — Load controls from compliance_requirements
  controls[] = compliance_requirements.controls[]
  must_controls[]   = controls where severity="must"
  should_controls[] = controls where severity="should"
  may_controls[]    = controls where severity="may"

Step 3 — Evidence mapping: scan stage_output for compliance evidence
  For each control C in controls[]:
    Search stage_output (recursively, all string-valued fields) for evidence of C's coverage:
      Evidence indicators (framework-specific):
        Access control controls (CC6.1, 164.312(a)(1), A.5.15, A.8.3): look for:
          - "authentication", "authorization", "RBAC", "access control", "IAM",
            "least privilege", "multi-factor", "MFA", "SSO"
        Encryption controls (CC6.6, CC6.7, 164.312(e)(1), A.8.24): look for:
          - "TLS", "HTTPS", "AES", "encryption at rest", "KMS", "secrets management"
        Audit/logging controls (164.312(b), A.8.15): look for:
          - "audit log", "audit trail", "logging", "monitoring", "CloudWatch", "Datadog"
        Change management (CC8.1, A.8.32): look for:
          - "CI/CD", "pull request", "review", "approval workflow", "change control"
        Data minimisation/GDPR Art.5: look for:
          - "data minimisation", "purpose limitation", "retention policy", "data lifecycle"
        Right to erasure/GDPR Art.17: look for:
          - "delete user data", "data deletion", "right to erasure", "account deletion"
        Availability/A1.1: look for:
          - "SLA", "uptime", "availability", "redundancy", "failover", "DR"
        Secure development (A.8.25, A.8.28): look for:
          - "SAST", "DAST", "code review", "security testing", "dependency scan"
        Custom controls: match by searching stage_output for the control's title keywords
    Assign coverage status:
      "covered"   — evidence found directly in stage_output
      "partial"   — related terms found but incomplete evidence
      "uncovered" — no evidence found

Step 4 — Compute coverage percentages
  must_covered    = count of must_controls with status="covered" or "partial"
  must_pct        = (must_covered / len(must_controls)) * 100  [0 if no must_controls]
  should_covered  = count of should_controls with status="covered" or "partial"
  should_pct      = (should_covered / len(should_controls)) * 100  [0 if no should_controls]

Step 5 — Determine verdict
  IF must_pct < must_threshold:
    verdict = "block"
    block_reason = "Must-control coverage {must_pct:.0f}% is below required threshold {must_threshold}%"
    List uncovered must_controls in block details
  ELSE IF should_pct < should_threshold:
    verdict = "warn"
    warn_reason = "Should-control coverage {should_pct:.0f}% is below advisory threshold {should_threshold}%"
  ELSE:
    verdict = "pass"

Step 6 — Write coverage report
  Write to artifacts/compliance-{stage_name}-{timestamp}.md:
  ---
  # Compliance Coverage Report — {stage_name}
  **Stage:** {stage_name}
  **Frameworks:** {compliance_requirements.frameworks joined}
  **Generated:** {timestamp}
  **Verdict:** {verdict} (BLOCK / WARN / PASS)

  ## Coverage Summary
  | Severity | Controls | Covered | Coverage |
  |----------|----------|---------|----------|
  | must     | N        | N       | N%       |
  | should   | N        | N       | N%       |
  | may      | N        | N       | N%       |

  ## Uncovered Must Controls
  (list uncovered must controls with id, title, fix_hint)

  ## Uncovered Should Controls
  (list uncovered should controls with id, title)

  ## Covered Controls
  (list covered controls with id and evidence excerpt)
  ---
  Output: report_path

Step 7 — Emit telemetry and return
  Return output.
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `verdict` | `string` | `"pass"`, `"warn"`, or `"block"`. `"block"` halts the pipeline at the gate. |
| `must_coverage_pct` | `number` | Percentage of `must` controls covered (0–100). |
| `should_coverage_pct` | `number` | Percentage of `should` controls covered (0–100). |
| `uncovered_must_controls` | `array[object]` | List of uncovered `must` controls with `id`, `title`, `fix_hint`. |
| `uncovered_should_controls` | `array[object]` | List of uncovered `should` controls. |
| `report_path` | `string` | Path to the written coverage report Markdown file. |
| `metrics` | `object` | `tokens_in`, `tokens_out`, `duration_ms`, `items_produced`, `version`. |
| `feedback` | `array[object]` | Feedback entries. |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["verdict", "must_coverage_pct", "should_coverage_pct", "uncovered_must_controls", "uncovered_should_controls", "report_path", "metrics", "feedback"],
  "properties": {
    "verdict":                  { "type": "string", "enum": ["pass", "warn", "block"] },
    "must_coverage_pct":        { "type": "number", "minimum": 0, "maximum": 100 },
    "should_coverage_pct":      { "type": "number", "minimum": 0, "maximum": 100 },
    "uncovered_must_controls":  { "type": "array", "items": { "type": "object" } },
    "uncovered_should_controls":{ "type": "array", "items": { "type": "object" } },
    "report_path":              { "type": "string" },
    "metrics":                  { "type": "object" },
    "feedback":                 { "type": "array", "items": { "type": "object" } }
  }
}
```

## Rules & Constraints

- `verdict: "block"` MUST halt the pipeline gate immediately. The orchestrator MUST NOT advance past a compliance gate that returned `block`.
- `verdict: "warn"` does NOT halt the pipeline — it emits a warning and continues.
- `must_floor` takes precedence over `coverage_floor` if both are provided.
- The coverage floor may be lowered to 80% for MVP (development) pipelines by setting `coverage_floor: 80`. Production pipelines SHOULD use 100%.
- Evidence mapping (Step 3) is keyword-based and may produce false positives or false negatives. The HITL approval gate allows human review before blocking.
- compliance-gate does not modify `compliance_requirements`. It only reads it.
- coverage report is always written, even when verdict is `"pass"`. This creates an audit trail.

## Security Considerations

- The coverage report (`artifacts/compliance-<stage>-<timestamp>.md`) MUST NOT include raw stage output content — only control IDs, titles, and evidence keywords. Stage outputs may contain sensitive architectural or security details.
- If `compliance_requirements.frameworks` includes `"hipaa"`, coverage reports must be treated as health-system-adjacent metadata and SHOULD be excluded from public-facing repositories.
- `verdict: "block"` gates require human sign-off. The orchestrator MUST NOT auto-advance on timeout.

## Token Optimization

- Evidence mapping (Step 3) is a keyword scan — no LLM inference required for control matching. Run deterministically.
- Only uncovered controls are included in the full report body — covered controls are summarized in the table only.
- `compliance_requirements` is passed by reference from `session_context` — do not re-embed the full artifact in this skill's input.

## Quality Checklist

- [ ] `compliance_requirements.controls[]` loaded correctly from input
- [ ] Evidence mapping run for ALL controls in ALL severity levels
- [ ] `must_pct` computed correctly: covered / total * 100
- [ ] `verdict: "block"` set when `must_pct < must_threshold`
- [ ] Coverage report written to `artifacts/compliance-{stage_name}-{timestamp}.md`
- [ ] Uncovered must controls listed with `fix_hint`
- [ ] HITL gate raised when `verdict: "block"`
- [ ] Report DOES NOT contain raw stage output content (PII / architecture details)

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| `compliance_requirements` missing or empty | Emit `warning`, set `verdict: "warn"`, write partial report. Cannot `block` without controls. |
| `stage_output` is empty `{}` | All controls are uncovered. Compute coverage as 0%. Set verdict based on thresholds. |
| Coverage report write fails | Emit `warning` with error. Return output without `report_path`. Do not block pipeline for report write failure. |
| HITL gate timeout (3600s) | Gate stays blocked. `bypass_on_timeout: false`. Human decision required. |

## Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Behavior on Timeout |
|------|---------|---------|---------------------|
| Compliance block review | `verdict: "block"` | 3600s | Gate remains blocked. `bypass_on_timeout: false`. Human must review uncovered controls and either fix and re-run, or explicitly approve with `OVERRIDE <reason>`. |

## Skill Composition

`compliance-gate` v1.0.0 runs multiple times in the `compliance-first.json` pipeline — after architecture, after test-generator, and after deployment-strategy.

```yaml
composes:
  - skill: compliance-gate
    version: "^1.0.0"
    input_map:
      compliance_requirements: "compliance_requirements"
      stage_output: "phase_outputs['phase-2-architecture']"
      stage_name: "architecture"
    output_map:
      verdict: "architecture_compliance_verdict"

pipeline_positions:
  - compliance-first.json: phase-2b-compliance-check (after architecture)
  - compliance-first.json: phase-7b-compliance-check (after test-generator)
  - compliance-first.json: phase-9b-compliance-check (after deployment-strategy)
```

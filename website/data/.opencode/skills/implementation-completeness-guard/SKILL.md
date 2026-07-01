---
name: implementation-completeness-guard
version: 1.0.0
domain: governance
description: 'Use when enforcing the release readiness threshold before deployment approval. Triggers on: "completeness gate", "release readiness gate", "block release if incomplete", "enforce readiness score", "completeness guard".'
author: system
---

## Purpose

Enforce the release readiness threshold by consuming the readiness score from the implementation-completeness-auditor (SKL-033) and blocking pipeline advancement if the score is below the configured threshold. This guard is the enforcement mechanism for the completeness audit — it converts the auditor's score into a binary `pass` / `block` verdict that the orchestrator can act on as a `validation_check` gate.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `readiness_score` | `integer` | Yes | Numeric score (0–100) from implementation-completeness-auditor (SKL-033) |
| `readiness_level` | `string` | Yes | Level string from auditor: release_ready / conditional / not_ready / blocked |
| `gaps` | `array[object]` | Yes | Gap list from auditor |
| `release_threshold` | `integer` | No | Minimum score required (default: 85, configurable per pipeline) |
| `approval_context` | `object` | No | Prior human approval to release despite score < threshold (conditional override) |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["readiness_score", "readiness_level", "gaps"],
  "properties": {
    "readiness_score":   { "type": "integer", "minimum": 0, "maximum": 100 },
    "readiness_level":   { "type": "string", "enum": ["release_ready", "conditional", "not_ready", "blocked"] },
    "gaps":              { "type": "array" },
    "release_threshold": { "type": "integer", "minimum": 0, "maximum": 100, "default": 85 },
    "approval_context":  { "type": "object" }
  }
}
```

## Required Context

- `readiness_score`, `readiness_level`, and `gaps` from `implementation-completeness-auditor` (SKL-033).

## Execution Logic

```
Step 1 — Evaluate score against threshold
  If readiness_score >= release_threshold: proceed to Step 3.
  If readiness_score < release_threshold: proceed to Step 2.
  Output: threshold evaluation result

Step 2 — Check for approved override
  If approval_context is present and approval_context.scope = "completeness_override":
    If approval_context.approved_score <= readiness_score: accept override.
    Else: block (score has regressed below approved baseline).
  If no approval_context: emit block verdict.
  Output: override evaluation result

Step 3 — Evaluate critical gaps
  Regardless of score, check gaps for classification: "missing" on priority: "critical" requirements.
  Any critical requirement with missing classification = block, even if score >= threshold.
  Output: critical gap check result

Step 4 — Assemble verdict
  pass: score >= threshold AND no critical missing gaps
  block: score < threshold without override, OR critical missing gap exists
  Output: guard verdict with score summary and critical gaps
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `verdict` | `string` | `pass` or `block` |
| `readiness_score` | `integer` | Score from auditor (passed through) |
| `release_threshold` | `integer` | Threshold used for this evaluation |
| `score_delta` | `integer` | Difference between score and threshold (negative = below threshold) |
| `critical_gaps` | `array[object]` | Any missing critical requirements that caused a block |
| `override_applied` | `boolean` | Whether an approved override was used |
| `metrics` | `object` | tokens_in, tokens_out, duration_ms, items_produced, version |
| `feedback` | `array[object]` | Backpropagate to implementation-completeness-auditor or code-generator |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["verdict", "readiness_score", "release_threshold", "score_delta", "metrics", "feedback"],
  "properties": {
    "verdict":            { "type": "string", "enum": ["pass", "block"] },
    "readiness_score":    { "type": "integer" },
    "release_threshold":  { "type": "integer" },
    "score_delta":        { "type": "integer" },
    "critical_gaps": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "req_id":         { "type": "string" },
          "classification": { "type": "string" },
          "remediation":    { "type": "string" }
        }
      }
    },
    "override_applied":  { "type": "boolean" },
    "metrics":   { "$ref": "#/$defs/metrics" },
    "feedback":  { "type": "array", "items": { "$ref": "#/$defs/feedback_entry" } }
  },
  "$defs": {
    "metrics": {
      "type": "object",
      "required": ["tokens_in", "tokens_out", "duration_ms", "items_produced", "version"],
      "properties": {
        "tokens_in": { "type": "integer" }, "tokens_out": { "type": "integer" },
        "duration_ms": { "type": "integer" }, "items_produced": { "type": "integer" },
        "version": { "type": "string" }
      }
    },
    "feedback_entry": {
      "type": "object",
      "required": ["type", "from_skill", "reason"],
      "properties": {
        "type":         { "type": "string", "enum": ["backpropagate", "info", "warning"] },
        "from_skill":   { "type": "string" },
        "target_skill": { "type": "string" },
        "reason":       { "type": "string" },
        "evidence":     { "type": "object" }
      }
    }
  }
}
```

## Block Conditions (verdict = "block")

| Condition | Rule |
|-----------|------|
| readiness_score < release_threshold without override | `below_threshold` |
| Critical requirement has classification: missing | `critical_requirement_missing` |
| Override score has regressed | `override_score_regressed` |

## Rules & Constraints

- This guard is the FINAL gate before deployment approval. A `block` verdict unconditionally halts the release pipeline.
- The `release_threshold` default is 85. It can be configured per pipeline in `pipeline_config` but MUST NOT be set below 70.
- `readiness_level: "blocked"` from the auditor always produces `verdict: "block"` — no override is possible.
- Override mechanism (`approval_context`) requires a prior human_approval gate decision. It cannot be self-generated by the pipeline.

## Security Considerations

- Read-only — never modifies source code or documentation.
- Do not expose requirement text verbatim in `critical_gaps` output if requirements contain confidential business logic — use `req_id` references only.

## Token Optimization

- This is a lightweight evaluation skill — no large payloads are loaded.
- `critical_gaps` is filtered to `classification: "missing"` and `priority: "critical"` only — not the full gap list.

## Quality Checklist

- [ ] `readiness_score` compared against `release_threshold` (default 85, floor 70)
- [ ] All `critical` requirements checked for `classification: "missing"`
- [ ] `override_applied` flag set correctly based on `approval_context` presence
- [ ] `score_delta` computed as `readiness_score - release_threshold`
- [ ] Verdict is exactly `"pass"` or `"block"` — no other values

## Failure Scenarios

| Scenario | Action |
|----------|--------|
| `readiness_score` absent from input | Emit `verdict: "block"`, `reason: "missing_score"` |
| `release_threshold` set below 70 in pipeline_config | Reject config: emit `verdict: "block"`, `reason: "invalid_threshold"` |
| `readiness_level: "blocked"` from auditor | Emit `verdict: "block"` — override is NOT possible in this case |
| `approval_context` present but no prior HITL gate logged | Emit `verdict: "block"`, `reason: "invalid_override_context"` |

## Human-in-the-Loop Gates

- If `verdict: "block"` and `reason: "below_threshold"`, a human may provide an `approval_context` to override the threshold for this release only. This requires an explicit human-approval gate decision — it cannot be pipeline-generated.
- If `verdict: "block"` and `reason: "critical_requirement_missing"` or `readiness_level: "blocked"`, no human-approval override is possible. The missing requirements must be implemented.

## Skill Composition

```yaml
composes:
  - skill: implementation-completeness-guard
    version: "^1.0.0"
    input_map:
      readiness_score: "audit_readiness_score"
      readiness_level: "audit_readiness_level"
      gaps:            "audit_gaps"
    output_map:
      verdict:      "completeness_guard_verdict"
      score_delta:  "readiness_score_delta"
```

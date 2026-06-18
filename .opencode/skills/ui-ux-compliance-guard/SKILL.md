---
name: ui-ux-compliance-guard
version: 1.0.0
domain: governance
description: 'Use when validating UI implementation against design system rules and UX architecture contracts. Triggers on: "UI compliance check", "design system guard", "UX compliance", "check hardcoded colors", "accessibility compliance check", "component contract validation".'
author: system
---

## Purpose

Enforce UI/UX architecture compliance by inspecting component implementations against the contracts defined by the frontend-ux-architect skill (SKL-031). The guard detects hardcoded design values, missing component states, accessibility violations, and deviations from the design token system. It emits a `pass` or `block` verdict consumed by the orchestrator as a `validation_check` gate.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `component_contracts` | `array[object]` | Yes | Component contracts from frontend-ux-architect (SKL-031) |
| `code_map` | `object` | Yes | System state code map for scanning component implementations |
| `token_requirements` | `array[object]` | No | Token requirement list from frontend-ux-architect (SKL-031) |
| `accessibility_report` | `object` | No | Accessibility report from frontend-ux-architect (SKL-031) |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["component_contracts", "code_map"],
  "properties": {
    "component_contracts":  { "type": "array" },
    "code_map":             { "type": "object" },
    "token_requirements":   { "type": "array" },
    "accessibility_report": { "type": "object" }
  }
}
```

## Required Context

- `component_contracts` from `frontend-ux-architect` (SKL-031).
- `code_map` from system state (SKL-021).

## Execution Logic

```
Step 1 — Detect hardcoded design values
  Scan component files in code_map for:
    - Hardcoded hex colors (#xxx, rgb(), rgba(), hsl())
    - Hardcoded pixel values for spacing/sizing not referencing tokens
    - Hardcoded font-size, font-weight, line-height values
  Output: hardcoded value violation list with file:line references

Step 2 — Check component state coverage
  For each component contract, verify the implementation includes:
    - default state
    - loading state (for async/data-bound components)
    - empty state (for list/data components)
    - error state (for async/form components)
    - disabled state (for interactive components)
  Output: missing state coverage list

Step 3 — Validate component prop contracts
  For each component contract, check that all required props are present in the implementation.
  Flag: missing required props, props with wrong types, props not in contract.
  Output: prop contract violation list

Step 4 — Check accessibility implementation
  Scan component implementations for:
    - Interactive elements without keyboard handlers (onClick without onKeyDown/onKeyUp)
    - Images without alt attribute
    - Form inputs without associated label
    - Missing ARIA attributes where required by the accessibility_report
    - Touch targets smaller than 44×44px (where detectable from style props)
  Output: accessibility implementation gap list

Step 5 — Check design token usage
  Scan component styles for direct primitive token usage (bypassing semantic aliases).
  Cross-reference token_requirements for unresolved token gaps.
  Output: token compliance violations

Step 6 — Assemble verdict
  Block conditions: hardcoded colors, missing required props, critical accessibility violations.
  Warning conditions: missing non-critical states, token alias bypasses.
  Output: guard verdict with violation list
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `verdict` | `string` | `pass` or `block` |
| `violations` | `array[object]` | Block-level violations (rule, file, line, severity, remediation) |
| `warnings` | `array[object]` | Warning-level issues |
| `metrics` | `object` | tokens_in, tokens_out, duration_ms, items_produced, version |
| `feedback` | `array[object]` | Backpropagate to frontend-ux-architect or code-generator |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["verdict", "violations", "metrics", "feedback"],
  "properties": {
    "verdict": { "type": "string", "enum": ["pass", "block"] },
    "violations": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["rule", "severity", "remediation"],
        "properties": {
          "rule":        { "type": "string" },
          "component":   { "type": "string" },
          "file":        { "type": "string" },
          "line":        { "type": "integer" },
          "severity":    { "type": "string", "enum": ["critical", "major", "minor"] },
          "remediation": { "type": "string" }
        }
      }
    },
    "warnings":  { "type": "array" },
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
| Hardcoded color value in component | `hardcoded_color` |
| Required prop missing from implementation | `missing_required_prop` |
| Critical accessibility violation from report not remediated | `accessibility_violation_unresolved` |
| Component missing loading or error state | `missing_required_state` |

## Rules & Constraints

- Read-only — never modifies component files.
- A `block` verdict halts the pipeline gate.
- File and line references are required for all violations.
- Only components defined in `component_contracts` are in scope.

## Security Considerations

- Read-only — never modifies component files.
- Do not emit raw component source in violation output — emit file path, line reference, and rule name only.
- Accessibility violations with PII implications (e.g., unlabeled password fields) are classified as `critical`.

## Token Optimization

- Scan component files at style-prop and attribute level — do not load full file contents.
- Violations capped at 20 entries per check type.

## Quality Checklist

- [ ] All component contracts from `component_contracts` have been checked
- [ ] Hardcoded color/spacing values flagged (not design token references)
- [ ] All required props verified against implementation signatures
- [ ] Loading and error states verified for every interactive component
- [ ] Accessibility report cross-checked against implemented ARIA attributes
- [ ] Verdict is exactly `"pass"` or `"block"` — no other values

## Failure Scenarios

| Scenario | Action |
|----------|--------|
| `component_contracts` is empty | Emit `verdict: "pass"` with warning: no contracts to check |
| `code_map` is missing or empty | Emit `verdict: "block"`, `reason: "empty_code_map"` |
| `accessibility_report` missing | Skip accessibility check, emit warning |
| Component file not found in code_map | Log as `missing_implementation` violation (critical) |

## Human-in-the-Loop Gates

- UI/UX guard `block` verdicts require a fix + re-run — there is no human-approval bypass for compliance violations.
- If `accessibility_report` is absent, a human reviewer must confirm accessibility was tested by other means before the pipeline advances.

## Skill Composition

```yaml
composes:
  - skill: ui-ux-compliance-guard
    version: "^1.0.0"
    input_map:
      component_contracts: "ux_component_contracts"
      code_map:            "system_state.code_map"
    output_map:
      verdict:    "ui_guard_verdict"
      violations: "ui_guard_violations"
```

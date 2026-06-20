---
name: ui-ux-compliance-guard
version: 2.0.0
domain: governance
description: 'Use when validating UI implementation against design system rules and UX architecture contracts. Triggers on: "UI compliance check", "design system guard", "UX compliance", "check hardcoded colors", "accessibility compliance check", "component contract validation", "visual quality score", "motion quality review".'
author: system
---

## Purpose

Enforce UI/UX architecture compliance by inspecting component implementations against the contracts defined by `frontend-ux-architect` (SKL-031) and the design system produced by `design-system-generator` (SKL-038). In v2.0.0 the guard extends beyond structural contract checking to produce dimensional quality scores across three axes: **visual quality** (consistency, modernity, brand alignment, professional appearance), **UX quality** (discoverability, learnability, efficiency, accessibility), and **motion quality** (smoothness, purpose, performance, user impact). It emits a `pass` or `block` verdict consumed by the orchestrator as a `validation_check` gate, along with scored dimensions that drive continuous design improvement.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `component_contracts` | `array[object]` | Yes | Component contracts from frontend-ux-architect (SKL-031) |
| `code_map` | `object` | Yes | System state code map for scanning component implementations |
| `token_requirements` | `array[object]` | No | Token requirement list from frontend-ux-architect (SKL-031) |
| `accessibility_report` | `object` | No | Accessibility report from frontend-ux-architect (SKL-031) |
| `motion_spec` | `object` | No | Motion brief from frontend-ux-architect or motion-design-architect (SKL-052) |
| `visual_excellence_targets` | `object` | No | Typography, color, depth targets from frontend-ux-architect v2.0.0 |
| `creativity_level` | `string` | No | `standard` (default), `premium`, or `world-class` — adjusts scoring thresholds |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["component_contracts", "code_map"],
  "properties": {
    "component_contracts":       { "type": "array" },
    "code_map":                  { "type": "object" },
    "token_requirements":        { "type": "array" },
    "accessibility_report":      { "type": "object" },
    "motion_spec":               { "type": "object" },
    "visual_excellence_targets": { "type": "object" },
    "creativity_level": {
      "type": "string",
      "enum": ["standard", "premium", "world-class"],
      "default": "standard"
    }
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
    - Hardcoded hex colors (#xxx, rgb(), rgba(), hsl(), oklch())
    - Hardcoded pixel values for spacing/sizing not referencing tokens
    - Hardcoded font-size, font-weight, line-height values not referencing tokens
    - Hardcoded animation durations, easing values not referencing motion tokens
    - Hardcoded box-shadow values not referencing elevation tokens
  Output: hardcoded value violation list with file:line references

Step 2 — Check component state coverage
  For each component contract, verify the implementation includes:
    - default state
    - loading state (for async/data-bound components)
    - empty state (for list/data components)
    - error state (for async/form components)
    - disabled state (for interactive components)
    - If enhancement_opportunities present: verify at minimum one enhancement is implemented
  Output: missing state coverage list

Step 3 — Validate component prop contracts
  For each component contract, check that all required props are present.
  Flag: missing required props, props with wrong types, props not in contract.
  Output: prop contract violation list

Step 4 — Check accessibility implementation
  Scan component implementations for:
    - Interactive elements without keyboard handlers
    - Images without alt attribute
    - Form inputs without associated label
    - Missing ARIA attributes required by the accessibility_report
    - Touch targets smaller than 44×44px (where detectable from style props)
    - Animated elements without prefers-reduced-motion media query guard
    - Color-only information differentiation (error states that rely solely on red color)
  Output: accessibility implementation gap list

Step 5 — Check design token usage
  Scan component styles for:
    - Direct primitive token usage bypassing semantic aliases
    - Motion value overrides bypassing motion token system
    - Cross-reference token_requirements for unresolved token gaps
  Output: token compliance violations

Step 6 — Score visual quality (0–100 per dimension)
  Evaluate implemented UI against visual excellence standards:
    consistency (0–25):
      - All components in the feature use the same spacing unit
      - Font sizes follow the defined typographic scale
      - Corner radii consistent across similar component types
      - Icon size and weight consistent throughout
    modernity (0–25):
      - Components use semantic HTML elements (not div-soup)
      - Focus states use visible ring with offset (not browser default)
      - Skeleton loaders present (not spinner-only)
      - Typography uses system variable font or defined typeface (not system-ui fallback only)
    brand_alignment (0–25):
      - Primary interactive color matches brand token
      - Component personality consistent with product tone (formal/playful/minimal)
      - Design differentiation: not generic Bootstrap/MUI clone appearance
      If visual_excellence_targets provided: score against targets
    professional_appearance (0–25):
      - No layout overflow or horizontal scroll at any defined breakpoint
      - Empty states have meaningful illustration or message (not blank white)
      - Error messages are friendly and actionable (not raw HTTP codes)
      - Loading states never show raw JSON or undefined values
  Output: visual_quality_score { consistency, modernity, brand_alignment, professional_appearance, total }

Step 7 — Score UX quality (0–100 per dimension)
  discoverability (0–25):
    - Primary actions are visually prominent (hierarchy is clear)
    - Navigation structure matches information architecture from navigation_map
    - Search/filter affordances present for list views with > 10 items
    - Onboarding empty states guide first action (not blank with no affordance)
  learnability (0–25):
    - Interaction patterns consistent with platform conventions (reference HIG/Material 3)
    - Tooltips or labels present for icon-only buttons
    - Progressive disclosure used where applicable (advanced options hidden by default)
    - Confirmation required for irreversible destructive actions
  efficiency (0–25):
    - Keyboard shortcuts defined for power-user actions (if feature warrants)
    - Forms use autocomplete attributes (email, name, tel)
    - Bulk actions available for multi-select list views
    - Table/list columns sortable where data sorting is meaningful
  accessibility (0–25):
    - All violations from accessibility_report resolved
    - Screen reader landmark regions correct (main, nav, aside, header, footer)
    - Focus management correct for modal open/close
    - All interactive elements reachable and operable via keyboard alone
  Output: ux_quality_score { discoverability, learnability, efficiency, accessibility, total }

Step 8 — Score motion quality (0–100 per dimension) — only when motion_spec provided
  smoothness (0–25):
    - No layout-triggering properties animated (no width/height/top/left without transform alternative)
    - Animations use transform and opacity only (GPU-composited)
    - No animation jank detectable from code patterns (no synchronous DOM reads in animation loop)
  purpose (0–25):
    - Every animation has a defined UX purpose (not decorative for decoration's sake)
    - Transitions communicate state change (not arbitrary movement)
    - Micro-interactions provide feedback (button press, form success, error shake)
  performance (0–25):
    - will-change hints applied to animated elements (not over-applied)
    - Stagger sequences bounded (≤ 12 items staggered — beyond that is imperceptible)
    - 3D scenes have defined GPU memory budget
    - Animation durations within acceptable range (instant ≤ 100ms, fast ≤ 200ms, normal ≤ 400ms)
  user_impact (0–25):
    - prefers-reduced-motion media query present for all animations (accessibility requirement)
    - Animations do not block user interaction
    - Page load animations do not delay time-to-interactive > 300ms
    - Scroll-triggered animations do not fire on initial load before scroll
  Output: motion_quality_score { smoothness, purpose, performance, user_impact, total }

Step 9 — Assemble verdict
  Block conditions (any single condition forces verdict = "block"):
    - Hardcoded colors detected
    - Missing required props
    - Critical accessibility violations unresolved
    - Missing loading or error state on async components
    - prefers-reduced-motion guard missing on any animation (when motion_spec present)
  Warning conditions:
    - Missing non-critical states
    - Token alias bypasses (semantic layer skipped)
    - visual_quality_score.total < 60 (when creativity_level = premium or world-class)
    - motion_quality_score.total < 70 (when motion_spec provided)
  Block threshold overrides:
    - standard:    visual_quality_score.total ≥ 40 to pass warnings
    - premium:     visual_quality_score.total ≥ 70 required for pass
    - world-class: visual_quality_score.total ≥ 85 required for pass
  Output: guard verdict with full violation list and quality scores
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `verdict` | `string` | `pass` or `block` |
| `violations` | `array[object]` | Block-level violations (rule, component, file, line, severity, remediation) |
| `warnings` | `array[object]` | Warning-level issues |
| `visual_quality_score` | `object` | Scored dimensions: consistency, modernity, brand_alignment, professional_appearance, total |
| `ux_quality_score` | `object` | Scored dimensions: discoverability, learnability, efficiency, accessibility, total |
| `motion_quality_score` | `object` | Scored dimensions: smoothness, purpose, performance, user_impact, total (null when no motion_spec) |
| `improvement_recommendations` | `array[object]` | Prioritized suggestions for next iteration (dimension, current_score, recommendation) |
| `metrics` | `object` | tokens_in, tokens_out, duration_ms, items_produced, version |
| `feedback` | `array[object]` | Backpropagate to frontend-ux-architect, design-system-generator, or code-generator |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["verdict", "violations", "visual_quality_score", "ux_quality_score", "metrics", "feedback"],
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
    "warnings": { "type": "array" },
    "visual_quality_score": {
      "type": "object",
      "required": ["consistency", "modernity", "brand_alignment", "professional_appearance", "total"],
      "properties": {
        "consistency":           { "type": "integer", "minimum": 0, "maximum": 25 },
        "modernity":             { "type": "integer", "minimum": 0, "maximum": 25 },
        "brand_alignment":       { "type": "integer", "minimum": 0, "maximum": 25 },
        "professional_appearance": { "type": "integer", "minimum": 0, "maximum": 25 },
        "total":                 { "type": "integer", "minimum": 0, "maximum": 100 }
      }
    },
    "ux_quality_score": {
      "type": "object",
      "required": ["discoverability", "learnability", "efficiency", "accessibility", "total"],
      "properties": {
        "discoverability": { "type": "integer", "minimum": 0, "maximum": 25 },
        "learnability":    { "type": "integer", "minimum": 0, "maximum": 25 },
        "efficiency":      { "type": "integer", "minimum": 0, "maximum": 25 },
        "accessibility":   { "type": "integer", "minimum": 0, "maximum": 25 },
        "total":           { "type": "integer", "minimum": 0, "maximum": 100 }
      }
    },
    "motion_quality_score": {
      "type": ["object", "null"],
      "properties": {
        "smoothness":   { "type": "integer", "minimum": 0, "maximum": 25 },
        "purpose":      { "type": "integer", "minimum": 0, "maximum": 25 },
        "performance":  { "type": "integer", "minimum": 0, "maximum": 25 },
        "user_impact":  { "type": "integer", "minimum": 0, "maximum": 25 },
        "total":        { "type": "integer", "minimum": 0, "maximum": 100 }
      }
    },
    "improvement_recommendations": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["dimension", "current_score", "recommendation"],
        "properties": {
          "dimension":       { "type": "string" },
          "current_score":   { "type": "integer" },
          "recommendation":  { "type": "string" },
          "priority":        { "type": "string", "enum": ["high", "medium", "low"] }
        }
      }
    },
    "metrics":  { "$ref": "#/$defs/metrics" },
    "feedback": { "type": "array", "items": { "$ref": "#/$defs/feedback_entry" } }
  },
  "$defs": {
    "metrics": {
      "type": "object",
      "required": ["tokens_in", "tokens_out", "duration_ms", "items_produced", "version"],
      "properties": {
        "tokens_in":      { "type": "integer" },
        "tokens_out":     { "type": "integer" },
        "duration_ms":    { "type": "integer" },
        "items_produced": { "type": "integer" },
        "version":        { "type": "string" }
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
| Critical accessibility violation unresolved | `accessibility_violation_unresolved` |
| Missing loading or error state on async component | `missing_required_state` |
| Animation missing prefers-reduced-motion guard | `motion_accessibility_violation` |
| visual_quality_score.total below threshold for creativity_level | `visual_quality_below_threshold` |

## Rules & Constraints

- Read-only — never modifies component files.
- A `block` verdict halts the pipeline gate.
- File and line references are required for all violations.
- Only components defined in `component_contracts` are in scope.
- Quality scores are always emitted even when verdict is `pass` — they feed the improvement loop.
- `motion_quality_score` is `null` when no `motion_spec` is provided.
- `improvement_recommendations` are generated for all dimensions scoring below 80.

## Security Considerations

- Read-only — never modifies component files.
- Do not emit raw component source in violation output — emit file path, line reference, and rule name only.
- Accessibility violations with PII implications (e.g., unlabeled password fields) are classified as `critical`.

## Token Optimization

- Scan component files at style-prop and attribute level — do not load full file contents.
- Violations capped at 20 entries per check type.
- Quality scoring uses heuristic pattern matching — no full AST parse required.

## Quality Checklist

- [ ] All component contracts checked for hardcoded values
- [ ] All required props verified against implementation signatures
- [ ] Loading and error states verified for all async components
- [ ] All accessibility violations cross-checked
- [ ] prefers-reduced-motion guard checked when motion_spec provided
- [ ] visual_quality_score computed with all 4 dimensions populated
- [ ] ux_quality_score computed with all 4 dimensions populated
- [ ] motion_quality_score computed when motion_spec provided
- [ ] improvement_recommendations generated for all dimensions < 80
- [ ] Verdict is exactly `"pass"` or `"block"`

## Failure Scenarios

| Scenario | Action |
|----------|--------|
| `component_contracts` empty | Emit `verdict: "pass"` with warning: no contracts to check |
| `code_map` missing or empty | Emit `verdict: "block"`, `reason: "empty_code_map"` |
| `accessibility_report` missing | Skip accessibility check, emit warning, set accessibility dimension to 0 |
| Component file not found in code_map | Log as `missing_implementation` violation (critical) |
| `visual_excellence_targets` missing with `creativity_level: world-class` | Use defaults; flag as info that scoring may be inaccurate |

## Human-in-the-Loop Gates

- UI/UX guard `block` verdicts require a fix + re-run — there is no human-approval bypass.
- When `creativity_level` is `world-class` and `visual_quality_score.total` < 85: human design review required before override.
- If `accessibility_report` is absent, a human reviewer must confirm accessibility was tested by other means before the pipeline advances.

## Skill Composition

```yaml
composes:
  - skill: ui-ux-compliance-guard
    version: "^2.0.0"
    input_map:
      component_contracts:       "ux_component_contracts"
      code_map:                  "system_state.code_map"
      motion_spec:               "motion_brief"
      visual_excellence_targets: "visual_spec"
      creativity_level:          "world-class"
    output_map:
      verdict:               "ui_guard_verdict"
      violations:            "ui_guard_violations"
      visual_quality_score:  "visual_score"
      ux_quality_score:      "ux_score"
      motion_quality_score:  "motion_score"
```

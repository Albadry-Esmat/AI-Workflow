---
name: frontend-ux-architect
version: 1.0.0
domain: design
description: 'Use when designing, reviewing, or validating the UI/UX architecture of any screen, component system, or interaction flow. Triggers on: "design the UI", "review the UX", "validate the interface", "define screen structure", "accessibility review", "design system compliance".'
author: system
---

## Purpose

Design and validate the UI/UX architecture layer for any feature or application. The skill defines screen structure, navigation architecture, component contracts, interaction patterns, accessibility rules, and theme system constraints. It is the authoritative source for all frontend design decisions and enforces enterprise-grade UX consistency before any implementation begins.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `requirements` | `array[object]` | Yes | Validated requirements from requirement-analyzer (must include id, type, statement) |
| `architecture` | `object` | Yes | System architecture output from architecture-design (modules, data_flow) |
| `design_constraints` | `object` | No | Framework, component library, breakpoints, token system in use |
| `existing_components` | `array[string]` | No | List of already-defined components to prevent duplication |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["requirements", "architecture"],
  "properties": {
    "requirements": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": ["id", "type", "statement"],
        "properties": {
          "id":        { "type": "string" },
          "type":      { "type": "string", "enum": ["F", "NF", "C"] },
          "statement": { "type": "string" }
        }
      }
    },
    "architecture": {
      "type": "object",
      "required": ["modules"],
      "properties": {
        "modules":          { "type": "array" },
        "data_flow":        { "type": "array" },
        "integration_points": { "type": "array" }
      }
    },
    "design_constraints": {
      "type": "object",
      "properties": {
        "framework":         { "type": "string" },
        "component_library": { "type": "string" },
        "breakpoints":       { "type": "array", "items": { "type": "string" } },
        "token_system":      { "type": "string" }
      }
    },
    "existing_components": {
      "type": "array",
      "items": { "type": "string" }
    }
  }
}
```

## Required Context

- Validated requirements from `requirement-analyzer` (SKL-001).
- Architecture module list from `architecture-design` (SKL-002).
- Design constraints if the project has an established component library or token system.

## Execution Logic

```
Step 1 — Identify UI-bearing requirements
  Filter requirements to those with visible user interaction.
  Group by user role and workflow domain.
  Output: UI requirement groups with user journey context

Step 2 — Define screen inventory
  Map each requirement group to one or more screens/views.
  Assign each screen: name, route pattern, primary action, primary data entity.
  Output: screen inventory with route and responsibility

Step 3 — Define navigation architecture
  Map transitions between screens. Identify modal vs. page navigations.
  Specify deep-link URL structure, back-navigation behavior, and breadcrumb logic.
  Output: navigation map with transition types and URL patterns

Step 4 — Design layout system
  For each screen category (list, detail, form, dashboard, empty), define the layout shell.
  Specify responsive breakpoint behavior per layout.
  Output: layout system with region definitions per screen category

Step 5 — Define component contracts
  Identify reusable components from the screen inventory.
  For each: define name, responsibility, required props, optional props, variants, states.
  Cross-check against existing_components to prevent duplication.
  Output: component contract list

Step 6 — Define interaction patterns
  For each complex interaction (forms, DataGrids, modals, drag-and-drop, notifications):
    Define all states: loading, empty, error, success, disabled.
    Define keyboard interaction rules.
    Define animation and transition specifications.
  Output: interaction pattern specs

Step 7 — Enforce accessibility rules
  Verify WCAG 2.1 AA compliance at architecture level.
  Flag any requirement that introduces color-only differentiation, non-keyboard-navigable flows, or missing landmark regions.
  Output: accessibility compliance checklist with violations flagged

Step 8 — Define token requirements
  List all design token categories required by this feature.
  Flag any token gaps that need to be added to the token system.
  Output: token requirement list with primitive/semantic/component tier assignments

Step 9 — Assemble UX architecture document
  Combine all outputs into structured artifact.
  Output: complete UX architecture spec
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `screens` | `array[object]` | Screen inventory (name, route, primary_action, layout_type, requirements_covered) |
| `navigation_map` | `array[object]` | Transitions (from, to, trigger, type: page/modal/drawer) |
| `layout_system` | `object` | Layout shells by screen category with responsive behavior |
| `component_contracts` | `array[object]` | Component definitions (name, responsibility, props, variants, states) |
| `interaction_patterns` | `array[object]` | Pattern specs (name, states, keyboard_rules, animation) |
| `accessibility_report` | `object` | Compliance status, violations, remediation actions |
| `token_requirements` | `array[object]` | Token gaps (name, tier, category, reason) |
| `metadata` | `object` | Requirement coverage, screen count, component count, version |
| `metrics` | `object` | tokens_in, tokens_out, duration_ms, items_produced, version |
| `feedback` | `array[object]` | Backpropagate entries for requirement-analyzer or architecture-design if gaps found |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["screens", "navigation_map", "component_contracts", "accessibility_report", "metadata", "metrics", "feedback"],
  "properties": {
    "screens": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["name", "route", "layout_type", "requirements_covered"],
        "properties": {
          "name":                 { "type": "string" },
          "route":                { "type": "string" },
          "primary_action":       { "type": "string" },
          "layout_type":          { "type": "string", "enum": ["list", "detail", "form", "dashboard", "wizard", "empty"] },
          "requirements_covered": { "type": "array", "items": { "type": "string" } }
        }
      }
    },
    "navigation_map": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["from", "to", "trigger", "type"],
        "properties": {
          "from":    { "type": "string" },
          "to":      { "type": "string" },
          "trigger": { "type": "string" },
          "type":    { "type": "string", "enum": ["page", "modal", "drawer", "tab", "accordion"] }
        }
      }
    },
    "component_contracts": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["name", "responsibility", "props"],
        "properties": {
          "name":           { "type": "string" },
          "responsibility": { "type": "string" },
          "props": {
            "type": "array",
            "items": {
              "type": "object",
              "required": ["name", "type", "required"],
              "properties": {
                "name":     { "type": "string" },
                "type":     { "type": "string" },
                "required": { "type": "boolean" },
                "default":  {}
              }
            }
          },
          "variants": { "type": "array", "items": { "type": "string" } },
          "states":   { "type": "array", "items": { "type": "string" } }
        }
      }
    },
    "accessibility_report": {
      "type": "object",
      "required": ["status", "violations"],
      "properties": {
        "status":     { "type": "string", "enum": ["compliant", "violations_found", "not_evaluated"] },
        "violations": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["rule", "location", "severity", "remediation"],
            "properties": {
              "rule":        { "type": "string" },
              "location":    { "type": "string" },
              "severity":    { "type": "string", "enum": ["critical", "major", "minor"] },
              "remediation": { "type": "string" }
            }
          }
        }
      }
    },
    "metadata": {
      "type": "object",
      "properties": {
        "version":              { "type": "string" },
        "requirement_coverage": { "type": "number", "minimum": 0, "maximum": 1 },
        "screen_count":         { "type": "integer" },
        "component_count":      { "type": "integer" }
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
        "tokens_in":       { "type": "integer" },
        "tokens_out":      { "type": "integer" },
        "duration_ms":     { "type": "integer" },
        "items_produced":  { "type": "integer" },
        "version":         { "type": "string" }
      }
    },
    "feedback_entry": {
      "type": "object",
      "required": ["type", "from_skill", "reason"],
      "properties": {
        "type":          { "type": "string", "enum": ["backpropagate", "info", "warning"] },
        "from_skill":    { "type": "string" },
        "target_skill":  { "type": "string" },
        "reason":        { "type": "string" },
        "evidence":      { "type": "object" }
      }
    }
  }
}
```

## Rules & Constraints

- Every screen MUST cover at least one UI-bearing requirement — orphan screens are not allowed.
- Every component contract MUST define at minimum: loading state, empty state, error state.
- `accessibility_report.status` MUST be `compliant` or violations must be `severity: critical` with remediation actions before this skill's output is accepted by the pipeline.
- Hardcoded values (colors, pixel sizes) detected in component props are an automatic `critical` violation.
- Navigation transitions MUST be fully bidirectional unless explicitly noted as one-way.

## Security Considerations

- No component contract may expose internal API response fields directly in UI props — use view-model mapping.
- Error messages in UI must not expose stack traces, internal IDs, or database errors to end users.
- Forms that handle authentication or PII must flag required security review to `security-review` skill.

## Token Optimization

- Compress `requirements` to ID + statement only.
- For large screen inventories (> 20 screens), group into workflow domains and summarize per domain.
- Component contracts use short type annotations (e.g. `string`, `boolean`, `ReactNode`) — no full TypeScript generics in this output.

## Quality Checklist

- [ ] All UI requirements have at least one screen assigned
- [ ] All screens have a defined layout_type
- [ ] No component duplicates an existing component from existing_components
- [ ] Accessibility report shows `compliant` or all critical violations have remediation
- [ ] Navigation map covers all inter-screen transitions
- [ ] Every interactive component has at minimum: default, hover, focus, disabled, loading states

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| No UI-bearing requirements found | Return error: `{"error": "NO_UI_REQUIREMENTS", "hint": "Check requirement types — NF or C requirements may not produce screens"}` |
| Design constraint conflicts with accessibility | Flag as critical violation, propose compliant alternative |
| Component library unknown | Default to generic HTML semantics, flag token_requirements as unresolved |
| Requirement ambiguity about screen scope | Backpropagate to requirement-analyzer with clarification request |

## Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Behavior |
|------|---------|---------|----------|
| UX architecture approval | Always — screen structure affects all downstream implementation | 3600s | Present screen inventory, navigation map, and accessibility report status for sign-off |

## Skill Composition

`frontend-ux-architect` is a primitive domain skill. Example inclusion in a pipeline:

```yaml
composes:
  - skill: frontend-ux-architect
    version: "^1.0.0"
    input_map:
      requirements: "validated_requirements"
      architecture: "system_architecture"
    output_map:
      screens: "screen_inventory"
      component_contracts: "ui_component_contracts"
```

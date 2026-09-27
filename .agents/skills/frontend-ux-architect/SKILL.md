---
name: frontend-ux-architect
version: 2.0.0
domain: design
description: 'Use when designing, reviewing, or validating the UI/UX architecture of any screen, component system, or interaction flow. Triggers on: "design the UI", "review the UX", "validate the interface", "define screen structure", "accessibility review", "design system compliance", "motion design spec", "creative layout".'
author: system
---

## Purpose

Design and validate the UI/UX architecture layer for any feature or application. The skill defines screen structure, navigation architecture, component contracts, interaction patterns, accessibility rules, theme system constraints, motion design specifications, and creative layout strategies. It is the authoritative source for all frontend design decisions and enforces premium, world-class UX consistency before any implementation begins. When `creativity_level` is `premium` or `world-class`, the skill evaluates design against reference products such as Linear, Stripe, Apple, Arc Browser, Raycast, and Figma and recommends innovative patterns beyond standard enterprise templates. When `motion_requirements` is provided, the skill generates a full motion specification consumed by `motion-design-architect` (SKL-052). When `domain_constraints` is provided by `mobile-platform-specialist`, platform-specific layout and PWA constraints are applied.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `requirements` | `array[object]` | Yes | Validated requirements from requirement-analyzer (must include id, type, statement) |
| `architecture` | `object` | Yes | System architecture output from architecture-design (modules, data_flow) |
| `design_constraints` | `object` | No | Framework, component library, breakpoints, token system in use |
| `existing_components` | `array[string]` | No | List of already-defined components to prevent duplication |
| `creativity_level` | `string` | No | `standard` (default), `premium`, or `world-class` — controls design ambition and reference set |
| `motion_requirements` | `array[object]` | No | Motion categories required: micro-interaction, page-transition, scroll-experience, advanced-motion, 3d |
| `domain_constraints` | `object` | No | Domain constraints from `mobile-platform-specialist`. When present, activates mobile-first layout constraints, platform-specific navigation patterns, and PWA capability checklist. |

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
        "modules":            { "type": "array" },
        "data_flow":          { "type": "array" },
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
    },
    "creativity_level": {
      "type": "string",
      "enum": ["standard", "premium", "world-class"],
      "default": "standard"
    },
    "motion_requirements": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["type"],
        "properties": {
          "type":     { "type": "string", "enum": ["micro-interaction", "page-transition", "scroll-experience", "advanced-motion", "3d"] },
          "priority": { "type": "string", "enum": ["required", "optional"], "default": "required" },
          "context":  { "type": "string" }
        }
      }
    }
  }
}
```

## Required Context

- Validated requirements from `requirement-analyzer` (SKL-001).
- Architecture module list from `architecture-design` (SKL-002).
- Design constraints if the project has an established component library or token system.
- When `creativity_level` is `premium` or `world-class`: reference product patterns from Linear, Stripe, Apple, Arc Browser, Raycast, Figma, Airbnb, Vercel, Notion, and Slack are applied.

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
  If creativity_level is "premium" or "world-class":
    Evaluate alternative layout patterns beyond standard grid systems:
      - Bento grid: varied card sizes, content-adaptive cells (reference: Linear, Raycast)
      - Editorial layout: magazine-style asymmetric compositions, strong typographic hierarchy
      - Modular system: recombinable content blocks with multiple valid arrangements
      - Layered depth: foreground/midground/background content layers with parallax potential
    Recommend the most appropriate innovative layout per screen category.
  Specify responsive breakpoint behavior per layout.
  Output: layout system with region definitions per screen category, creative_layout_approach

Step 5 — Define component contracts
  Identify reusable components from the screen inventory.
  For each: define name, responsibility, required props, optional props, variants, states.
  Cross-check against existing_components to prevent duplication.
  If creativity_level is "premium" or "world-class":
    Flag opportunities for micro-interaction enhancements on interactive components.
    Identify components that benefit from advanced visual treatments
    (glassmorphism buttons, elevated cards, animated counters, shimmer loading states).
  Output: component contract list with enhancement_opportunities

Step 6 — Define interaction patterns
  For each complex interaction (forms, DataGrids, modals, drag-and-drop, notifications):
    Define all states: loading, empty, error, success, disabled.
    Define keyboard interaction rules.
    Define animation and transition specifications.
  If creativity_level is "premium" or "world-class":
    Apply premium interaction standards:
      - Hover: subtle scale + shadow transition (not color flash)
      - Focus: high-visibility ring with offset (not default browser outline)
      - Button press: spring-based scale feedback (0.97 scale, 120ms spring)
      - Form success: celebratory micro-animation before navigation
      - List items: staggered entrance animation (40ms delay per item)
      - Skeleton loaders: shimmer animation (not static gray blocks)
  Output: interaction pattern specs

Step 7 — Enforce accessibility rules
  Verify WCAG 2.1 AA compliance at architecture level.
  Flag any requirement that introduces color-only differentiation,
  non-keyboard-navigable flows, or missing landmark regions.
  Check motion sensitivity: all animations must respect prefers-reduced-motion.
  High contrast theme: verify all UI is legible at 4.5:1 minimum contrast ratio.
  Output: accessibility compliance checklist with violations flagged

Step 8 — Define token requirements
  List all design token categories required by this feature:
    Standard: color, typography, spacing, border-radius, shadow
    Extended (always include for premium/world-class):
      - motion: duration, easing, spring stiffness/damping/mass
      - elevation: shadow levels 0–5 (reference Material Design 3)
      - blur: backdrop blur values (glass effects, layered UI)
      - glass: background-color opacity + blur combinations
      - variable-font: font-weight range, font-variation-settings
  Flag any token gaps that need to be added to the token system.
  Output: token requirement list with primitive/semantic/component tier assignments

Step 9 — Apply visual excellence standards (premium and world-class only)
  Evaluate each screen against the following dimensions:
    Typography:
      - Font pairing (heading + body + mono): at minimum 2 type scales
      - Reading rhythm: line-height 1.5–1.7 for body, tighter for display
      - Typographic scale: use a defined modular scale (1.250 major third, 1.333 perfect fourth)
      - Variable font: recommend if framework supports it (Inter Variable, Geist)
    Color system:
      - Semantic color intent coverage: brand, neutral, success, warning, error, info
      - Emotional resonance: evaluate color palette tone for product category
      - Dynamic themes: verify all colors have dark-mode semantic equivalents
      - APCA contrast: for decorative elements use APCA rather than WCAG contrast
    Depth system:
      - Elevation hierarchy: background → surface → overlay → modal → tooltip (5 levels)
      - Shadow style: recommend diffuse soft shadows over hard drop shadows
      - Glassmorphism: appropriate for floating panels, sidebars, navigation overlays
      - Neumorphism: flag as low accessibility — only use where contrast can be maintained
    Spatial harmony:
      - 4px or 8px base unit spacing system
      - Consistent padding/margin rhythm across all components
  Output: visual_excellence_targets with typography_spec, color_spec, depth_spec, spacing_spec

Step 10 — Generate motion specification (when motion_requirements provided)
  For each motion_requirements entry, generate a motion brief:
    micro-interaction:
      Define per-component: trigger, property animated, duration, easing, spring params.
      Reference patterns: Stripe button hover (box-shadow + translateY), Linear list interactions.
    page-transition:
      Define shared element transitions (hero → detail, list item → full screen).
      Define route change strategy: fade, slide, morphing layout.
      Reference: Framer Motion layout animations, Apple UIKit transitions.
    scroll-experience:
      Define scroll-triggered reveals: threshold, direction, stagger.
      Define parallax layers if depth is required.
      Reference: Apple product pages, Stripe homepage.
    advanced-motion:
      Define physics parameters: spring stiffness (default 300), damping (default 30), mass (default 1).
      Define choreography: which elements animate first, delay chain.
      Define stagger pattern: 40–60ms between items.
      Reference: Framer Motion, Motion One.
    3d:
      Identify which elements benefit from 3D enhancement.
      Specify: perspective depth, rotation ranges, interaction triggers.
      Specify library: Spline (for authored 3D), React Three Fiber (for programmatic), CSS perspective (for simple tilt).
  Output: motion_spec (consumed by motion-design-architect SKL-052)

Step 11 — Apply platform-specific and PWA constraints (if domain_constraints present)
  Mobile (from mobile-platform-specialist domain_constraints):
    Navigation patterns:
      iOS:     Tab bar (bottom) for primary nav; navigation controller for drill-down;
               no hamburger menus (Apple HIG violation for primary navigation)
      Android: Bottom navigation bar (Material 3); Navigation Drawer for secondary;
               back gesture handling (predictive back gesture, Android 13+)
    Touch targets: minimum 44×44pt (iOS) / 48×48dp (Android) for all interactive elements
    Safe areas: account for Dynamic Island, notch, home indicator, and navigation bar insets
    Haptic feedback: define haptic patterns for primary actions (success, warning, error)
    List performance: virtual scrolling required for lists > 100 items
    Offline UX: define skeleton loaders, offline banners, and retry affordances
  PWA (if requirements contain "PWA", "progressive web app", "installable", "offline support"):
    Service Worker: define caching strategy per route
    Web App Manifest: name, short_name, icons, theme_color, display: standalone
    Install prompt: define when to show (after 2 meaningful interactions)
    Offline fallback page: custom offline.html
    Browser compatibility matrix: Chrome, Firefox, Safari, Edge (latest 2 stable versions)
  Output: platform_constraints, pwa_manifest_spec, browser_compatibility_matrix

Step 12 — Assemble UX architecture document
  Combine all outputs into structured artifact.
  Include design_rationale for all non-standard decisions.
  Output: complete UX architecture spec
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `screens` | `array[object]` | Screen inventory (name, route, primary_action, layout_type, requirements_covered) |
| `navigation_map` | `array[object]` | Transitions (from, to, trigger, type: page/modal/drawer) |
| `layout_system` | `object` | Layout shells by screen category with responsive behavior and creative_layout_approach |
| `component_contracts` | `array[object]` | Component definitions (name, responsibility, props, variants, states, enhancement_opportunities) |
| `interaction_patterns` | `array[object]` | Pattern specs (name, states, keyboard_rules, animation) |
| `accessibility_report` | `object` | Compliance status, violations, remediation actions |
| `token_requirements` | `array[object]` | Token gaps (name, tier, category, reason) — includes motion, blur, elevation, glass tokens |
| `visual_excellence_targets` | `object` | Typography, color, depth, spacing specifications (populated when creativity_level ≠ standard) |
| `motion_spec` | `object` | Motion brief per requirement category (populated when motion_requirements provided) |
| `creative_recommendations` | `array[object]` | Optional innovative patterns with reference product, rationale, and implementation complexity |
| `metadata` | `object` | Requirement coverage, screen count, component count, creativity_level, version |
| `metrics` | `object` | tokens_in, tokens_out, duration_ms, items_produced, version |
| `feedback` | `array[object]` | Backpropagate entries for requirement-analyzer or architecture-design if gaps found |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["screens", "navigation_map", "component_contracts", "accessibility_report", "token_requirements", "metadata", "metrics", "feedback"],
  "properties": {
    "screens": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["name", "route", "layout_type", "requirements_covered"],
        "properties": {
          "name":                  { "type": "string" },
          "route":                 { "type": "string" },
          "primary_action":        { "type": "string" },
          "layout_type":           { "type": "string", "enum": ["list", "detail", "form", "dashboard", "wizard", "empty", "bento", "editorial", "immersive"] },
          "requirements_covered":  { "type": "array", "items": { "type": "string" } },
          "creative_layout_notes": { "type": "string" }
        }
      }
    },
    "navigation_map": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["from", "to", "trigger", "type"],
        "properties": {
          "from":             { "type": "string" },
          "to":               { "type": "string" },
          "trigger":          { "type": "string" },
          "type":             { "type": "string", "enum": ["page", "modal", "drawer", "tab", "accordion", "shared-element"] },
          "motion_hint":      { "type": "string" }
        }
      }
    },
    "component_contracts": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["name", "responsibility", "props"],
        "properties": {
          "name":                    { "type": "string" },
          "responsibility":          { "type": "string" },
          "props":                   { "type": "array" },
          "variants":                { "type": "array", "items": { "type": "string" } },
          "states":                  { "type": "array", "items": { "type": "string" } },
          "enhancement_opportunities": { "type": "array", "items": { "type": "string" } }
        }
      }
    },
    "accessibility_report": {
      "type": "object",
      "required": ["status", "violations"],
      "properties": {
        "status":              { "type": "string", "enum": ["compliant", "violations_found", "not_evaluated"] },
        "motion_safe":         { "type": "boolean" },
        "high_contrast_ready": { "type": "boolean" },
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
    "token_requirements": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["name", "tier", "category"],
        "properties": {
          "name":     { "type": "string" },
          "tier":     { "type": "string", "enum": ["primitive", "semantic", "component"] },
          "category": { "type": "string", "enum": ["color", "spacing", "typography", "radius", "shadow", "motion", "z-index", "blur", "elevation", "glass", "variable-font"] },
          "reason":   { "type": "string" }
        }
      }
    },
    "visual_excellence_targets": {
      "type": "object",
      "properties": {
        "typography_spec": {
          "type": "object",
          "properties": {
            "heading_font": { "type": "string" },
            "body_font":    { "type": "string" },
            "mono_font":    { "type": "string" },
            "scale_ratio":  { "type": "number" },
            "variable_font": { "type": "boolean" }
          }
        },
        "color_spec": {
          "type": "object",
          "properties": {
            "palette_tone":   { "type": "string" },
            "semantic_colors": { "type": "array", "items": { "type": "string" } },
            "dark_mode_ready": { "type": "boolean" }
          }
        },
        "depth_spec": {
          "type": "object",
          "properties": {
            "elevation_levels": { "type": "integer", "minimum": 3, "maximum": 6 },
            "shadow_style":     { "type": "string", "enum": ["hard", "soft", "diffuse", "layered"] },
            "glass_usage":      { "type": "array", "items": { "type": "string" } }
          }
        },
        "spacing_spec": {
          "type": "object",
          "properties": {
            "base_unit":  { "type": "integer", "enum": [4, 8] },
            "scale_type": { "type": "string", "enum": ["linear", "fibonacci", "geometric"] }
          }
        }
      }
    },
    "motion_spec": {
      "type": "object",
      "properties": {
        "micro_interactions": { "type": "array" },
        "page_transitions":   { "type": "array" },
        "scroll_experiences": { "type": "array" },
        "advanced_motion":    { "type": "array" },
        "3d_elements":        { "type": "array" },
        "reduced_motion_fallbacks": { "type": "array" }
      }
    },
    "creative_recommendations": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["pattern", "rationale", "reference"],
        "properties": {
          "pattern":    { "type": "string" },
          "rationale":  { "type": "string" },
          "reference":  { "type": "string" },
          "complexity": { "type": "string", "enum": ["low", "medium", "high"] },
          "impact":     { "type": "string", "enum": ["low", "medium", "high"] }
        }
      }
    },
    "metadata": {
      "type": "object",
      "properties": {
        "version":              { "type": "string" },
        "requirement_coverage": { "type": "number", "minimum": 0, "maximum": 1 },
        "screen_count":         { "type": "integer" },
        "component_count":      { "type": "integer" },
        "creativity_level":     { "type": "string" }
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
- `accessibility_report.status` MUST be `compliant` or all `critical` violations must include remediation before this skill's output is accepted.
- `accessibility_report.motion_safe` MUST be `true` — every animation must have a `prefers-reduced-motion` fallback.
- Hardcoded values (colors, pixel sizes) detected in component props are an automatic `critical` violation.
- Navigation transitions MUST be fully bidirectional unless explicitly noted as one-way.
- When `creativity_level` is `world-class`: at least 2 `creative_recommendations` with `impact: "high"` are required.
- `visual_excellence_targets` MUST be populated when `creativity_level` is `premium` or `world-class`.
- `motion_spec` MUST be populated when `motion_requirements` array is non-empty.
- All motion specs MUST include `reduced_motion_fallbacks` — this is not optional.

## Security Considerations

- No component contract may expose internal API response fields directly in UI props — use view-model mapping.
- Error messages in UI must not expose stack traces, internal IDs, or database errors to end users.
- Forms handling authentication or PII must flag required security review to `security-review` skill.
- 3D and WebGL elements must declare GPU memory budget — runaway 3D scenes are a performance/availability risk.

## Token Optimization

- Compress `requirements` to ID + statement only.
- For large screen inventories (> 20 screens), group into workflow domains and summarize per domain.
- Component contracts use short type annotations — no full TypeScript generics in this output.
- `creative_recommendations` capped at 5 entries; rank by impact descending.
- When `creativity_level` is `standard`, omit `visual_excellence_targets` and `creative_recommendations` entirely.

## Quality Checklist

- [ ] All UI requirements have at least one screen assigned
- [ ] All screens have a defined layout_type
- [ ] No component duplicates an existing component from existing_components
- [ ] Accessibility report shows `compliant` or all critical violations have remediation
- [ ] `motion_safe: true` in accessibility_report
- [ ] Navigation map covers all inter-screen transitions
- [ ] Every interactive component has: default, hover, focus, disabled, loading states
- [ ] `token_requirements` includes motion and elevation categories when creativity_level ≠ standard
- [ ] `visual_excellence_targets` populated for premium/world-class
- [ ] All motion specs include reduced_motion_fallbacks
- [ ] `creative_recommendations` includes at minimum 2 entries for world-class level

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| No UI-bearing requirements found | Return error: `{"error": "NO_UI_REQUIREMENTS", "hint": "Check requirement types — NF or C requirements may not produce screens"}` |
| Design constraint conflicts with accessibility | Flag as critical violation, propose compliant alternative |
| `motion_requirements` present but no motion tokens in token_requirements | Auto-add motion token category to token_requirements; emit info feedback |
| `creativity_level: world-class` but no product reference context | Apply Linear/Stripe patterns as baseline references |
| 3D motion requirement but no compatible framework in design_constraints | Flag as warning; recommend React Three Fiber or Spline depending on complexity |
| Requirement ambiguity about screen scope | Backpropagate to requirement-analyzer with clarification request |

## Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Behavior |
|------|---------|---------|----------|
| UX architecture approval | Always | 3600s | Present screen inventory, navigation map, accessibility report, and visual excellence targets for sign-off |
| Creative direction approval | `creativity_level` is `world-class` | 3600s | Present `creative_recommendations` with reference products and complexity estimates for explicit approval before downstream skills run |

## Skill Composition

`frontend-ux-architect` is a primitive domain skill. Example inclusion in a pipeline:

```yaml
composes:
  - skill: frontend-ux-architect
    version: "^2.0.0"
    input_map:
      requirements:     "validated_requirements"
      architecture:     "system_architecture"
      creativity_level: "world-class"
      motion_requirements:
        - { type: "micro-interaction", priority: "required" }
        - { type: "page-transition",   priority: "required" }
    output_map:
      screens:                  "screen_inventory"
      component_contracts:      "ui_component_contracts"
      token_requirements:       "token_requirements"
      visual_excellence_targets: "visual_spec"
      motion_spec:              "motion_brief"
      creative_recommendations: "creative_rec"
```

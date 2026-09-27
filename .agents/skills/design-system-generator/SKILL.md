---
name: design-system-generator
version: 2.0.0
domain: design
description: 'Use when generating design system artifacts — token files, component scaffolds, Storybook config, and theme configuration — from a UX architecture spec. Triggers on: "generate the design system", "create token files", "scaffold the component library", "generate Storybook config", "produce theme config", "build the design foundation", "generate motion tokens", "multi-theme system".'
author: system
---

## Purpose

Generate the concrete design system artifact layer from the token requirements and component contracts produced by `frontend-ux-architect`. This skill bridges the gap between a UX architecture specification and actual files on disk: it produces a multi-tier token file set (CSS custom properties, Tailwind theme extension, JSON token bundle), typed component stubs with all required states, Storybook configuration, and multi-theme system support. In v2.0.0 the skill adds advanced token categories — motion (spring, easing, duration, choreography), elevation (5-level shadow system), blur/glass effects, and variable font configuration — and generates a complete four-theme system (light/dark/high-contrast/accessibility). It is the authoritative source for the design system file manifest and must run before `code-generator` so that token names and component interfaces are established before implementation begins.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `token_requirements` | `array[object]` | Yes | Token gap list from `frontend-ux-architect` (name, tier, category, reason) |
| `component_contracts` | `array[object]` | Yes | Component definitions from `frontend-ux-architect` (name, responsibility, props, variants, states) |
| `design_constraints` | `object` | Yes | Framework, component library, CSS strategy, token format preference |
| `visual_excellence_targets` | `object` | No | Typography, color, depth, spacing specs from `frontend-ux-architect` v2.0.0 |
| `motion_spec` | `object` | No | Motion brief from `frontend-ux-architect` or `motion-design-architect` (SKL-052) |
| `theme_modes` | `array[string]` | No | Theme variants to generate (default: `["light", "dark"]`) |
| `existing_token_files` | `array[string]` | No | Paths to existing token files to merge rather than replace |
| `storybook_version` | `string` | No | Target Storybook version (default: `"8"`) |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["token_requirements", "component_contracts", "design_constraints"],
  "properties": {
    "token_requirements": {
      "type": "array",
      "minItems": 1,
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
    "component_contracts": {
      "type": "array",
      "minItems": 1,
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
    "design_constraints": {
      "type": "object",
      "required": ["framework"],
      "properties": {
        "framework":         { "type": "string" },
        "component_library": { "type": "string" },
        "css_strategy":      { "type": "string", "enum": ["css-variables", "tailwind", "css-modules", "styled-components"] },
        "token_format":      { "type": "string", "enum": ["css-variables", "json", "style-dictionary", "tailwind-config"] }
      }
    },
    "visual_excellence_targets": { "type": "object" },
    "motion_spec":               { "type": "object" },
    "theme_modes": {
      "type": "array",
      "items": { "type": "string", "enum": ["light", "dark", "high-contrast", "accessibility"] },
      "default": ["light", "dark"]
    },
    "existing_token_files": { "type": "array", "items": { "type": "string" } },
    "storybook_version":    { "type": "string" }
  }
}
```

## Required Context

- `token_requirements` and `component_contracts` from `frontend-ux-architect` (SKL-031) — this skill cannot run before SKL-031 completes.
- `design_constraints.framework` must be known.
- `existing_token_files` prevents destructive overwrites when incrementally extending an established design system.
- `motion_spec` enables generation of the motion token tier — without it, motion tokens are stubbed with system defaults.

## Execution Logic

```
Step 1 — Resolve token inventory
  Group token_requirements by tier: primitive → semantic → component.
  Add implicit required categories if not already present:
    - motion: always add base motion tokens (duration-instant: 50ms, duration-fast: 120ms,
              duration-normal: 250ms, duration-slow: 400ms, easing-standard, easing-decelerate,
              easing-accelerate, spring-default: {stiffness:300, damping:30, mass:1})
    - elevation: always add 5-level elevation scale (elevation-0 through elevation-4)
    - blur: always add base blur tokens (blur-sm: 4px, blur-md: 8px, blur-lg: 16px, blur-xl: 24px)
  If motion_spec provided: derive motion tokens from spring parameters and timing in motion_spec.
  If visual_excellence_targets provided: derive typography scale from typography_spec.
  Flag any token name conflicts with existing_token_files.
  Output: resolved token map with names, values, and tier assignments

Step 2 — Generate primitive token file
  Emit the foundational values for all token categories:
    Color palette: full 50–950 scales for brand, neutral, success, warning, error, info
    Spacing scale: 4px or 8px base unit, 0–96 steps
    Type scale: modular scale from visual_excellence_targets.typography_spec or default Major Third (1.25)
    Radius scale: 0, 2, 4, 6, 8, 12, 16, 24, 32, full
    Shadow levels: 5 levels — elevation-0 (none) through elevation-4 (dramatic)
    Motion primitives: duration steps, named easing curves (cubic-bezier), spring parameter sets
    Blur values: 4 blur levels from blur-sm to blur-xl
    Z-index scale: base, raised, overlay, modal, toast, tooltip
  Format: per design_constraints.token_format
  Output: primitives.css / primitives.json / tailwind-tokens.js

Step 3 — Generate semantic token file
  Map semantic tokens to primitives for each theme mode:
    Required semantic namespaces:
      Background:    bg-base, bg-surface, bg-elevated, bg-overlay
      Text:          text-primary, text-secondary, text-tertiary, text-disabled, text-inverse
      Border:        border-default, border-focus, border-strong
      Interactive:   interactive-primary, interactive-primary-hover, interactive-primary-pressed
                     interactive-secondary, interactive-secondary-hover
                     interactive-danger, interactive-danger-hover
      Status:        status-success, status-warning, status-error, status-info
      Motion:        motion-duration-fast, motion-duration-normal, motion-easing-standard
                     motion-spring-default (stiffness/damping/mass as custom properties)
      Elevation:     elevation-0 through elevation-4 (box-shadow values)
      Glass:         glass-bg (color + opacity), glass-blur (backdrop-filter value)
                     glass-border (semi-transparent border color)
  If theme_modes includes "high-contrast":
    Override semantic colors to meet WCAG AAA (7:1 contrast ratio) on all text/bg pairs
  If theme_modes includes "accessibility":
    Override motion durations: instant=0ms, fast=0ms (respects prefers-reduced-motion system setting)
    Increase all touch targets to 48px minimum
    Remove glass/blur effects (can cause vestibular disorders)
  Output: semantic-[theme].css for each theme mode

Step 4 — Generate component token file
  Emit component-scoped tokens from semantic layer:
    Button:  btn-bg, btn-bg-hover, btn-text, btn-border, btn-radius, btn-padding-x, btn-padding-y
             btn-motion-duration, btn-motion-easing, btn-press-scale (0.97)
    Input:   input-bg, input-border, input-border-focus, input-text, input-placeholder
    Card:    card-bg, card-border, card-radius, card-shadow (→ elevation-1),
             card-hover-shadow (→ elevation-2), card-motion-duration
    Badge:   badge-bg, badge-text, badge-radius, badge-padding
    Modal:   modal-bg, modal-glass-bg, modal-glass-blur, modal-shadow (→ elevation-3)
    Nav:     nav-bg, nav-glass-bg, nav-glass-blur, nav-border
  Output: component-tokens.css / component-tokens.json

Step 5 — Generate multi-theme configuration
  For each theme mode in theme_modes:
    If css_strategy is "css-variables":
      Emit :root { ... } block for light (default).
      Emit [data-theme="dark"] { ... } override block.
      Emit [data-theme="high-contrast"] { ... } override block (if requested).
      Emit @media (prefers-reduced-motion: reduce) { ... } motion override block (always).
    If css_strategy is "tailwind":
      Emit tailwind.config.ts with extend block, darkMode: "class", custom theme keys.
      Emit tailwind-themes plugin for high-contrast and accessibility themes.
    If css_strategy is "style-dictionary":
      Emit style-dictionary config with platforms: css, json, ios, android.
  Output: theme config file(s)

Step 6 — Generate variable font configuration (if variable-font in token_requirements)
  If visual_excellence_targets.typography_spec.variable_font is true:
    Emit @font-face declarations for Inter Variable, Geist, or specified font.
    Define font-variation-settings utilities for weight axes (wght 100–900).
    Emit Tailwind font-weight utilities that map to variation-settings.
  Output: fonts.css + font-face declarations

Step 7 — Scaffold component stubs
  For each component_contract:
    Emit a typed stub file with:
      - Functional component with required props typed
      - All states as prop variants: default, hover, focus, loading, error, disabled, empty
      - Data-attribute based state classes for CSS targeting: data-state="loading"
      - JSDoc from responsibility field
      - If enhancement_opportunities present: include commented enhancement hints
    Emit CSS module or className using component token variables.
  Output: one stub file per component (e.g. Button.tsx, Card.tsx)

Step 8 — Generate Storybook configuration
  Emit .storybook/main.ts with framework from design_constraints.framework.
  Emit .storybook/preview.ts:
    - Import all theme CSS files
    - Add theme toggle toolbar item (light/dark/high-contrast/accessibility)
    - Add viewport addon with breakpoints from design_constraints
    - Add a11y addon for accessibility checking
  Emit one Story file per component (CSF3 format):
    - Default story (default theme, default state)
    - One story per variant × per theme mode
    - Interaction story for animated components (using play function)
  Output: .storybook/main.ts + .storybook/preview.ts + stories/[ComponentName].stories.tsx

Step 9 — Assemble file manifest
  Collect all generated file paths with sizes and purposes.
  Validate: every token referenced in component stubs exists in the token files.
  Validate: every semantic token references a primitive (no orphan semantics).
  Flag any unresolved token references as violations.
  Output: file_manifest with path, type, size_estimate, purpose per file
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `token_files` | `array[object]` | Generated token file specs (path, format, tier, token_count, content_summary) |
| `theme_config` | `object` | Theme configuration file spec (path, strategy, theme_modes, token_references) |
| `component_stubs` | `array[object]` | Scaffolded component file specs (path, component_name, props_count, stories_path) |
| `storybook_config` | `object` | Storybook setup (main_config_path, preview_path, story_count, framework, theme_modes) |
| `motion_tokens` | `object` | Summary of generated motion token set (duration_steps, easing_curves, spring_presets) |
| `file_manifest` | `array[object]` | Full list of all generated files (path, type, purpose) |
| `violations` | `array[object]` | Unresolved token references, naming conflicts, missing required tokens |
| `metadata` | `object` | token_count, component_count, theme_count, file_count, version |
| `metrics` | `object` | tokens_in, tokens_out, duration_ms, items_produced, version |
| `feedback` | `array[object]` | Backpropagate to frontend-ux-architect if token gaps cannot be resolved |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["token_files", "theme_config", "component_stubs", "file_manifest", "violations", "metadata", "metrics", "feedback"],
  "properties": {
    "token_files": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["path", "format", "token_count"],
        "properties": {
          "path":            { "type": "string" },
          "format":          { "type": "string", "enum": ["css-variables", "json", "tailwind-config", "style-dictionary"] },
          "tier":            { "type": "string", "enum": ["primitive", "semantic", "component"] },
          "token_count":     { "type": "integer" },
          "content_summary": { "type": "string" }
        }
      }
    },
    "theme_config": {
      "type": "object",
      "required": ["path", "strategy", "theme_modes"],
      "properties": {
        "path":             { "type": "string" },
        "strategy":         { "type": "string" },
        "theme_modes":      { "type": "array", "items": { "type": "string" } },
        "token_references": { "type": "integer" }
      }
    },
    "component_stubs": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["path", "component_name"],
        "properties": {
          "path":           { "type": "string" },
          "component_name": { "type": "string" },
          "props_count":    { "type": "integer" },
          "states":         { "type": "array", "items": { "type": "string" } },
          "stories_path":   { "type": "string" }
        }
      }
    },
    "storybook_config": {
      "type": "object",
      "required": ["main_config_path", "story_count"],
      "properties": {
        "main_config_path": { "type": "string" },
        "preview_path":     { "type": "string" },
        "story_count":      { "type": "integer" },
        "framework":        { "type": "string" },
        "theme_modes":      { "type": "array", "items": { "type": "string" } }
      }
    },
    "motion_tokens": {
      "type": "object",
      "properties": {
        "duration_steps":  { "type": "integer" },
        "easing_curves":   { "type": "array", "items": { "type": "string" } },
        "spring_presets":  { "type": "array" }
      }
    },
    "file_manifest": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["path", "type", "purpose"],
        "properties": {
          "path":    { "type": "string" },
          "type":    { "type": "string", "enum": ["token", "theme", "component", "story", "config", "font"] },
          "purpose": { "type": "string" }
        }
      }
    },
    "violations": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["rule", "file", "severity"],
        "properties": {
          "rule":        { "type": "string" },
          "file":        { "type": "string" },
          "severity":    { "type": "string", "enum": ["critical", "major", "minor"] },
          "remediation": { "type": "string" }
        }
      }
    },
    "metadata": {
      "type": "object",
      "properties": {
        "token_count":     { "type": "integer" },
        "component_count": { "type": "integer" },
        "theme_count":     { "type": "integer" },
        "file_count":      { "type": "integer" },
        "version":         { "type": "string" }
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

## Rules & Constraints

- Token files MUST follow the three-tier hierarchy: primitive → semantic → component. No component token may reference a primitive directly.
- Motion tokens MUST always be generated, even when `motion_spec` is absent — use system defaults.
- A `@media (prefers-reduced-motion: reduce)` block MUST be emitted — motion sensitivity is non-optional.
- Every component stub MUST have a corresponding Story file.
- `theme_modes` MUST always include `"light"` — it is the canonical base; all other themes are overrides.
- The high-contrast theme MUST meet WCAG AAA (7:1) — flagged as `critical` violation if any pair falls below.
- If `existing_token_files` are provided, new tokens MUST be merged (not overwritten); conflicts surface as `critical` violations.
- Hardcoded hex values or pixel values in token files are a `critical` violation.
- Glass tokens (`glass-bg`, `glass-blur`) MUST NOT appear in the accessibility theme — surface as auto-removed with info feedback.

## Security Considerations

- Token files are build artifacts — must not contain secrets, API keys, or environment-specific URLs.
- Component stub files must not import from runtime environment (`process.env`).
- Theme configuration files referencing CDN URLs for font loading must flag those URLs for security review.
- WebGL/3D component stubs must include a memory-budget comment declaring max GPU memory usage.

## Token Optimization

- For large token sets (> 100 tokens): output a category summary table instead of the full list.
- Component stubs emitted as path + interface summary only unless `dry_run: false` is explicit.
- Compress `component_contracts` to name + props + states only during processing.

## Quality Checklist

- [ ] Every `token_requirements` entry has a corresponding entry in `token_files`
- [ ] Motion token category present in `token_files` (always required)
- [ ] Elevation token category present in `token_files` (always required)
- [ ] All three token tiers (primitive, semantic, component) represented in `token_files`
- [ ] Every component in `component_contracts` has a stub file and a story file
- [ ] `theme_config` includes all requested `theme_modes`
- [ ] `@media (prefers-reduced-motion)` override block present in output
- [ ] `violations` array empty or all items are `severity: minor`
- [ ] No raw hex or pixel values in token files
- [ ] Glass tokens absent from accessibility theme

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| `design_constraints.framework` unknown | Return error: `{"error": "UNKNOWN_FRAMEWORK"}` |
| Token naming conflict with existing files | Surface as `critical` violation; do not overwrite |
| `component_contracts` empty | Return error: `{"error": "NO_COMPONENT_CONTRACTS", "hint": "Run frontend-ux-architect (SKL-031) first"}` |
| `theme_modes` includes `high-contrast` but no color contrast metadata | Auto-compute WCAG AAA compliant overrides from primitive palette; flag as `info` |
| Storybook version unsupported | Default to Storybook 8 CSF3; log as `info` |
| `motion_spec` absent | Generate motion tokens using system defaults; emit `info` feedback |

## Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Behavior |
|------|---------|---------|----------|
| Design system review | Always | 3600s | Present file manifest, token count per tier, theme modes, motion token summary, and violations for sign-off before code-generator runs |

## Skill Composition

```yaml
composes:
  - skill: design-system-generator
    version: "^2.0.0"
    input_map:
      token_requirements:       "ux_architecture.token_requirements"
      component_contracts:      "ux_architecture.component_contracts"
      design_constraints:       "architecture.design_constraints"
      visual_excellence_targets: "ux_architecture.visual_excellence_targets"
      motion_spec:              "motion_brief"
      theme_modes:              ["light", "dark", "high-contrast"]
    output_map:
      token_files:      "design_system.token_files"
      component_stubs:  "design_system.component_stubs"
      motion_tokens:    "design_system.motion_tokens"
      file_manifest:    "design_system.file_manifest"
```

---
name: design-system-generator
version: 1.0.0
domain: design
description: 'Use when generating design system artifacts — token files, component scaffolds, Storybook config, and theme configuration — from a UX architecture spec. Triggers on: "generate the design system", "create token files", "scaffold the component library", "generate Storybook config", "produce theme config", "build the design foundation".'
author: system
---

## Purpose

Generate the concrete design system artifact layer from the token requirements and component contracts produced by `frontend-ux-architect`. This skill bridges the gap between a UX architecture specification and actual files on disk: it produces design token files (CSS custom properties, Tailwind theme extension, JSON token bundle), typed component stubs (scaffolded with required props and states), and Storybook configuration. It is the authoritative source for the design system file manifest and must run before `code-generator` so that token names and component interfaces are established before implementation begins.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `token_requirements` | `array[object]` | Yes | Token gap list from `frontend-ux-architect` (name, tier, category, reason) |
| `component_contracts` | `array[object]` | Yes | Component definitions from `frontend-ux-architect` (name, responsibility, props, variants, states) |
| `design_constraints` | `object` | Yes | Framework, component library, CSS strategy, token format preference |
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
          "category": { "type": "string", "enum": ["color", "spacing", "typography", "radius", "shadow", "motion", "z-index"] },
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
          "name":           { "type": "string" },
          "responsibility": { "type": "string" },
          "props":          { "type": "array" },
          "variants":       { "type": "array", "items": { "type": "string" } },
          "states":         { "type": "array", "items": { "type": "string" } }
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
    "existing_token_files": {
      "type": "array",
      "items": { "type": "string" }
    },
    "storybook_version": { "type": "string" }
  }
}
```

## Required Context

- `token_requirements` and `component_contracts` from `frontend-ux-architect` (SKL-031) — this skill cannot run before SKL-031 completes.
- `design_constraints.framework` must be known — without it, component stub file extensions and import conventions cannot be determined.
- `existing_token_files` prevents destructive overwrites when incrementally extending an established design system.

## Execution Logic

```
Step 1 — Resolve token inventory
  Group token_requirements by tier: primitive → semantic → component.
  For each required token: derive a naming convention based on design_constraints.token_format.
  Flag any token name conflicts with existing_token_files.
  Output: resolved token map with names, values (defaulted where derivable), and tier assignments

Step 2 — Generate primitive token file
  Emit the foundational color palette, spacing scale, type scale, radius scale, shadow levels.
  Format: CSS custom properties (--color-brand-500), Tailwind extend block, or JSON object
           depending on design_constraints.token_format.
  Output: primitives.css / primitives.json / tailwind-tokens.js

Step 3 — Generate semantic token file
  Map semantic tokens to primitives: --color-surface-primary → var(--color-neutral-50).
  Semantic tokens must cover: background, surface, text, border, interactive, status.
  Output: semantic.css / semantic.json

Step 4 — Generate component token file
  Emit component-scoped tokens from semantic layer: --btn-bg → var(--color-interactive-primary).
  One file per component or a single component-tokens file depending on component count.
  Output: component-tokens.css / component-tokens.json

Step 5 — Generate theme configuration
  If css_strategy is "tailwind": emit tailwind.config.ts extend block with all token keys.
  If css_strategy is "css-variables": emit :root { ... } blocks with light + dark mode sections.
  If css_strategy is "style-dictionary": emit style-dictionary config pointing to the token files.
  Output: theme config file

Step 6 — Scaffold component stubs
  For each component_contract:
    Emit a typed stub file: functional component with required props typed, all states as
    prop variants, empty render returning a semantic HTML element with the component token class.
    Include JSDoc from responsibility field.
  Output: one stub file per component (e.g. Button.tsx, Card.tsx)

Step 7 — Generate Storybook configuration
  Emit .storybook/main.ts with framework auto-detected from design_constraints.framework.
  Emit one Story file per component (CSF3 format): Default story + one story per variant.
  Output: .storybook/main.ts + stories/[ComponentName].stories.tsx per component

Step 8 — Assemble file manifest
  Collect all generated file paths, sizes, and purposes into the output manifest.
  Validate: every token referenced in component stubs exists in the token files.
  Flag any unresolved token references as violations.
  Output: file_manifest with path, type, size_estimate, purpose per file
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `token_files` | `array[object]` | Generated token file specs (path, format, content_summary, token_count) |
| `theme_config` | `object` | Theme configuration file spec (path, strategy, token_references) |
| `component_stubs` | `array[object]` | Scaffolded component file specs (path, component_name, props_count, stories_path) |
| `storybook_config` | `object` | Storybook setup file spec (main_config_path, story_count, framework) |
| `file_manifest` | `array[object]` | Full list of all generated files (path, type, purpose) |
| `violations` | `array[object]` | Unresolved token references, naming conflicts, missing required tokens |
| `metadata` | `object` | token_count, component_count, file_count, version |
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
      "required": ["path", "strategy"],
      "properties": {
        "path":              { "type": "string" },
        "strategy":          { "type": "string" },
        "token_references":  { "type": "integer" }
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
          "stories_path":   { "type": "string" }
        }
      }
    },
    "storybook_config": {
      "type": "object",
      "required": ["main_config_path", "story_count"],
      "properties": {
        "main_config_path": { "type": "string" },
        "story_count":      { "type": "integer" },
        "framework":        { "type": "string" }
      }
    },
    "file_manifest": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["path", "type", "purpose"],
        "properties": {
          "path":    { "type": "string" },
          "type":    { "type": "string", "enum": ["token", "theme", "component", "story", "config"] },
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

- Token files MUST follow the three-tier hierarchy: primitive → semantic → component. No component token may reference a primitive directly — it must go through a semantic token.
- Every component stub MUST have a corresponding Story file — a component without a story is not considered scaffolded.
- The `token_format` in `design_constraints` is the single source of truth for output format — do not mix formats within the same project.
- If `existing_token_files` are provided, new tokens MUST be merged in (not overwritten) and name conflicts MUST be surfaced as `violations`.
- Component stub files are placeholders — they define the interface and states only. Logic and markup are filled in by `code-generator` (SKL-028).
- Hardcoded hex values or pixel values in token files are a `critical` violation — all values must be tokenized.

## Security Considerations

- Token files are build artifacts — they must not contain secrets, API keys, or environment-specific URLs.
- Component stub files must not import from runtime environment (no `process.env` in stub layer).
- Theme configuration files that reference CDN URLs for font loading must flag those URLs for security review.

## Token Optimization

- For large token sets (> 100 tokens): output a summary table (category → count) instead of the full token list in the main response; full list goes into the file manifest.
- Component stubs are emitted as path + interface summary only — not full file content — unless `dry_run: false` is explicit.
- Compress component_contracts to name + props + states only during processing.

## Quality Checklist

- [ ] Every `token_requirements` entry has a corresponding entry in `token_files`
- [ ] All three token tiers (primitive, semantic, component) are represented in `token_files`
- [ ] Every component in `component_contracts` has a stub file and a story file
- [ ] `theme_config` references only tokens defined in `token_files` (no dangling references)
- [ ] `violations` array is empty or all items are `severity: minor`
- [ ] No raw hex or pixel values appear in token files

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| `design_constraints.framework` is unknown | Return error: `{"error": "UNKNOWN_FRAMEWORK", "hint": "Provide framework in design_constraints (react, vue, svelte, angular)"}` |
| Token naming conflict with existing files | Surface as `critical` violation; do not overwrite — require explicit resolution |
| `component_contracts` is empty | Return error: `{"error": "NO_COMPONENT_CONTRACTS", "hint": "Run frontend-ux-architect (SKL-031) first to produce component contracts"}` |
| Storybook version not supported | Default to Storybook 8 CSF3 format; log as `info` feedback |
| Token tier cycle detected | Return error: `{"error": "TOKEN_CYCLE", "detail": "Component token references a component token — must resolve through semantic layer"}` |

## Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Behavior |
|------|---------|---------|----------|
| Design system review | Always — token names and component interfaces are the contract all downstream implementation depends on | 3600s | Present file manifest, token count per tier, and any violations for sign-off before code-generator runs |

## Skill Composition

`design-system-generator` runs after `frontend-ux-architect` and before `code-generator` in any website pipeline:

```yaml
composes:
  - skill: design-system-generator
    version: "^1.0.0"
    input_map:
      token_requirements:  "ux_architecture.token_requirements"
      component_contracts: "ux_architecture.component_contracts"
      design_constraints:  "architecture.design_constraints"
    output_map:
      token_files:      "design_system.token_files"
      component_stubs:  "design_system.component_stubs"
      file_manifest:    "design_system.file_manifest"
```

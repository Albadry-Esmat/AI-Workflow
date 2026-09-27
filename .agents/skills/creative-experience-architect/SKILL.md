---
name: creative-experience-architect
version: 1.0.0
domain: design
description: 'Use when designing innovative interfaces, exploring premium layout systems, or creating immersive and story-driven digital experiences beyond standard enterprise patterns. Triggers on: "creative experience", "innovative layout", "bento layout", "immersive interface", "story-driven UI", "premium interaction design", "beyond the dashboard", "Awwwards-level design". Do NOT use for standard CRUD screens or dashboards without a creative brief — use frontend-ux-architect for those.'
author: system
---

## Purpose

Architect world-class, emotionally resonant, and visually differentiated digital experiences that transcend standard component-grid templates. The skill synthesizes industry-leading design patterns (Linear, Arc Browser, Raycast, Apple, Stripe, Figma, Airbnb, Awwwards winners) into concrete interface architectures for unique layouts, story-driven flows, immersive environments, and premium interaction systems. It is the creative counterpart to `frontend-ux-architect` — where that skill enforces structure and constraints, this skill explores maximum creative expression within accessibility and performance bounds. Output feeds into `frontend-ux-architect` as `creative_recommendations` and directly into `motion-design-architect` (SKL-052) for motion choreography.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `product_brief` | `object` | Yes | Product category, target audience, brand personality, product goals |
| `screens` | `array[object]` | No | Existing screen inventory from `frontend-ux-architect` to reimagine |
| `component_contracts` | `array[object]` | No | Existing component contracts to enhance with creative patterns |
| `visual_excellence_targets` | `object` | No | Typography, color, depth targets from `frontend-ux-architect` |
| `inspiration_references` | `array[string]` | No | Reference products or URLs (e.g. "Linear", "Arc Browser", "Stripe homepage") |
| `creative_scope` | `array[string]` | No | Which creative domains to explore: `layout`, `motion`, `storytelling`, `immersive`, `3d`, `typography` (default: all) |
| `accessibility_constraints` | `object` | No | Minimum accessibility requirements — creative patterns must respect these |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["product_brief"],
  "properties": {
    "product_brief": {
      "type": "object",
      "required": ["product_category", "brand_personality"],
      "properties": {
        "product_category":  { "type": "string" },
        "target_audience":   { "type": "string" },
        "brand_personality": { "type": "string", "description": "e.g. minimal-precise, warm-playful, powerful-dark, elegant-premium" },
        "product_goals":     { "type": "array", "items": { "type": "string" } },
        "differentiators":   { "type": "array", "items": { "type": "string" } }
      }
    },
    "screens":                    { "type": "array" },
    "component_contracts":        { "type": "array" },
    "visual_excellence_targets":  { "type": "object" },
    "inspiration_references":     { "type": "array", "items": { "type": "string" } },
    "creative_scope": {
      "type": "array",
      "items": { "type": "string", "enum": ["layout", "motion", "storytelling", "immersive", "3d", "typography"] }
    },
    "accessibility_constraints": {
      "type": "object",
      "properties": {
        "min_contrast_ratio":     { "type": "number", "default": 4.5 },
        "reduced_motion_support": { "type": "boolean", "default": true },
        "keyboard_navigable":     { "type": "boolean", "default": true }
      }
    }
  }
}
```

## Required Context

- `product_brief` — the foundational creative brief; without it, recommendations cannot be aligned to product identity.
- `visual_excellence_targets` from `frontend-ux-architect` v2.0.0 when evolving an existing design.
- `inspiration_references` dramatically improve output quality; include at least one reference product.

## Execution Logic

```
Step 1 — Analyze product identity and creative opportunity
  Derive creative positioning from product_brief:
    product_category + brand_personality → creative archetype:
      developer-tool + minimal-precise        → "Precision Dark" (Linear, Raycast)
      consumer-app + warm-playful             → "Delightful Everyday" (Duolingo, Airbnb)
      enterprise-platform + powerful-dark     → "Command Experience" (Vercel, GitHub)
      premium-product + elegant-premium       → "Curated Luxury" (Apple, Stripe)
      creative-tool + expressive-vibrant      → "Expressive Canvas" (Figma, Miro)
      productivity + calm-focused             → "Calm Technology" (Notion, Things)
      marketing-site + high-impact            → "Immersive Showcase" (Awwwards winners)
  Map inspiration_references to pattern libraries:
    Linear:      Precise typography, generous whitespace, smooth micro-interactions,
                 keyboard-first design, subtle glassmorphism on overlays
    Raycast:     Command-palette UI, dark mode default, instant feedback, no-chrome chrome,
                 powerful without visual noise, fast → feels responsive
    Arc Browser: Personality-driven UI, custom themes, spatial sidebar, fun micro-interactions,
                 personality at every touchpoint, color as identity
    Stripe:      Storytelling homepage, gradient meshes, 3D product illustrations,
                 developer-first docs, trust-building visual language
    Apple:       Typography as hero, product-centric photography, scroll storytelling,
                 hardware-software integration in UI metaphors, restraint in decoration
    Figma:       Canvas paradigm, multiplayer-first UI, floating toolbars,
                 drag-as-primary-interaction, spatial navigation
    Airbnb:      Photography-first, emotional destination design, strong CTAs,
                 trust signals baked into every component, human warmth
    Vercel:      Dark-mode-first, clean deployment UI, instant visual feedback,
                 CLI aesthetic meets web polish, performance as design principle
    Notion:      Block-based composition, minimal-until-you-need-it chrome,
                 database views (table, board, gallery, calendar), powerful = simple
    Awwwards:    Site-of-the-Day level — full-page scroll takeovers,
                 CSS art, SVG morphing, WebGL scenes, experimental layouts
  Output: creative_archetype, pattern_library_reference_set

Step 2 — Explore innovative layout patterns
  For each screen in scope (or for the product as a whole if no screens provided):
    Evaluate which non-standard layout pattern best serves the content and creative archetype:
      BENTO GRID LAYOUT (reference: Linear dashboard, iOS widgets):
        Cell structure: varied card sizes on a 12-column grid (1×1, 2×1, 2×2, 3×1, 1×2)
        Content-adaptive: cell size derives from content density, not arbitrary placement
        Hover choreography: adjacent cells subtly shift when a cell is focused
        Empty-cell behavior: placeholder cell with add-action (not blank void)
        When to use: dashboards, feature showcases, profile pages, content hubs
      EDITORIAL LAYOUT (reference: magazine design, Apple Events pages):
        Type-as-hero: display font at 96–160px, tight leading, full-bleed sections
        Asymmetric composition: content does not align to standard 12-column grid
        Section transitions: each scroll section has distinct visual identity
        Pull quotes: highlight key statements at 200% body size
        When to use: marketing pages, about pages, long-form content, product stories
      SPATIAL / CANVAS LAYOUT (reference: Figma, Miro, Spline):
        Infinite canvas metaphor: scroll in two dimensions
        Objects float in space with z-index depth
        Camera movements: pan, zoom, animate-to-selection
        When to use: creative tools, mind-maps, visual databases, design tools
      COMMAND PALETTE UI (reference: Raycast, Linear Command+K):
        Keyboard-first interaction model
        Full-screen dimmed overlay with focused search input
        Fuzzy-search results with keyboard navigation
        Recent actions, shortcuts, suggested commands
        When to use: power-user tools, developer platforms, productivity apps
      LAYERED DEPTH (reference: macOS, iPadOS multitasking):
        Multiple layers of content simultaneously visible at different depths
        Background: blurred/dimmed context
        Midground: active workspace
        Foreground: floating panels, tooltips, overlays (glassmorphism)
        Depth communicated through shadow, blur, scale, not z-index alone
      TIMELINE / FEED LAYOUT (reference: Linear activity, GitHub feed):
        Vertical time axis with connective thread
        Grouped events with collapsible sections
        Inline actions on hover (no mode switching)
        When to use: activity logs, changelogs, audit trails, social feeds
      IMMERSIVE FULL-SCREEN (reference: Apple product pages, Stripe homepage):
        Each section occupies 100vh
        Scroll-linked animations progress through narrative
        Sticky hero with dissolving content on scroll
        When to use: marketing landing pages, product showcases, onboarding flows
    For each proposed layout: specify implementation approach, constraints, and creative rationale.
  Output: layout_explorations (array, one per screen or context)

Step 3 — Design story-driven flows
  For product tours, onboarding sequences, and narrative dashboards:
    Define the story arc:
      Act 1 — Hook (0–5 seconds): immediate value demonstration
        Technique: animated product preview, live demo, or "aha moment" before any form
      Act 2 — Educate (5–30 seconds): progressive value revelation
        Technique: scroll-driven feature reveals, interactive hotspots, split-screen comparisons
      Act 3 — Convert (30s+): call to action in full context
        Technique: social proof at peak interest, frictionless sign-up (progressive auth)
    For guided onboarding:
      Step count: ≤ 5 steps for primary onboarding
      Progress indicator: always visible, non-blocking
      Skip affordance: always available (respect user autonomy)
      Value-first: show the product in context before asking for input
      Celebration: micro-delight at onboarding completion (confetti, animation, personalized message)
    For narrative dashboards:
      Data storytelling: guide attention through data with visual hierarchy, not data dumps
      Contextual annotation: explain "why this number matters" inline
      Trend spotlighting: highlight the most significant change, not all changes equally
    Define each narrative step as: { screen, content_type, transition_to_next, emotion_target }
  Output: story_flows (array, one per narrative context)

Step 4 — Specify immersive and interactive backgrounds
  For pages requiring environmental richness (marketing, landing, hero sections):
    Option A — Gradient Mesh Animation:
      Technique: CSS mesh gradients animated with keyframes
      Colors: derived from brand palette (primary + complement)
      Motion: slow drift (20–60s cycle), no rapid movement
      Performance: CSS only, no canvas, GPU-composited via transform
      Accessibility: prefers-reduced-motion → static gradient
    Option B — Particle System:
      Technique: lightweight canvas-based particle system (< 200 particles)
      Behavior: floating, connecting lines at proximity threshold
      Interaction: particles react to cursor position (attraction/repulsion)
      Performance: 60fps on mid-tier hardware; auto-disable below 45fps
      Accessibility: prefers-reduced-motion → static background
    Option C — Noise Texture Animation:
      Technique: CSS + SVG feTurbulence filter animated
      Use case: organic, non-geometric depth (premium product feel)
      Performance: CSS filter — GPU accelerated
    Option D — Interactive Geometry:
      Technique: SVG path morphing, CSS clip-path animation
      Use case: geometric brand identities, tech products
      Interaction: responds to scroll position (progress-linked)
    Option E — WebGL / Spline 3D Background:
      Library: Spline (authored scene) or Three.js (programmatic)
      Use case: product showcases, hero sections where 3D communicates product value
      Constraint: one WebGL context per page maximum; mobile fallback required
      Performance: declare draw-call budget; disable on CPU rendering
    Select best option(s) per screen based on product_brief.brand_personality and performance budget.
  Output: background_system_specs (array)

Step 5 — Design premium component enhancements
  For each component in component_contracts (or generate as recommendations without contracts):
    Evaluate creative enhancement opportunities:
      BUTTON:
        Gradient fill on primary CTA (brand angle gradient, 135deg)
        Icon slide animation on hover (icon slides from center, no layout shift)
        Shimmer loading state (animated gradient sweep)
        Keyboard shortcut badge displayed inline (⌘K, ⌥⏎)
      CARD:
        Glassmorphism treatment (backdrop-blur + semi-transparent bg + thin border)
        Gradient border (conic-gradient border-image for premium feel)
        3D tilt on hover (CSS perspective + rotateX/Y on mousemove, max 5deg)
        Reveal-on-hover action bar (translateY from bottom, blur-to-focus transition)
      NAVIGATION:
        Spotlight indicator (smooth sliding highlight under active item)
        Glass header (backdrop-filter: blur(20px), semi-transparent, border-bottom)
        Condensed on scroll (height reduction with smooth transition)
        Command palette integration (⌘K opens command overlay)
      INPUT:
        Floating label with spring animation
        Success check icon with spring scale animation
        Error shake keyframe animation
        Character count with dynamic color (green → yellow → red)
      TABLE / LIST:
        Staggered row entrance animation
        Hover row: subtle background reveal + inline action buttons
        Sort animation: rows reorder with spring physics (layout animation)
        Empty state: illustrated zero-state with primary CTA
      MODAL / DIALOG:
        Spring entrance (scale 0.95→1.0, opacity 0→1, spring-default)
        Backdrop: blur + dark overlay (not black void)
        Dismiss animation: scale down + fade, spring-snappy
      DATA VISUALIZATION:
        Number roll animation on first view (count up from 0)
        Bar charts with staggered entrance
        Line charts with path drawing animation (stroke-dashoffset)
        Sparklines embedded inline in table cells
    For each enhancement: document trigger, animation spec, accessibility fallback, complexity (low/medium/high).
  Output: component_enhancement_specs (array)

Step 6 — Specify typography as design medium
  Move beyond functional type to expressive typographic design:
    DISPLAY TYPOGRAPHY:
      Use case: hero headings, section titles, marketing pages
      Technique: variable font weight from 100–900 in a single word (split spans)
      Size: 80–160px on desktop, fluid scaling with clamp()
      Leading: 0.9–1.0 for display (tighter than body)
      Tracking: -0.03em to -0.05em (negative tracking for large display text)
    KINETIC TYPOGRAPHY:
      Use case: onboarding, product tours, animated headlines
      Technique: word-by-word fade-in (Framer Motion + stagger), character-level animation
      Reference: Apple Event slides, Framer marketing site
    GRADIENT TEXT:
      Technique: background-clip: text + linear-gradient fill
      Use case: hero headlines for premium/creative products
      Constraint: WCAG fails for gradient text — pair with solid alt for screen readers
    TABULAR NUMBERS:
      Use case: financial data, analytics dashboards
      Font-feature-settings: "tnum" 1 — ensures number columns align perfectly
    MONO FOR TECHNICAL CONTENT:
      Use case: code blocks, command interfaces, developer tools
      Font: Geist Mono, JetBrains Mono, or Fira Code (with ligatures)
    RESPONSIVE TYPE FLUID SCALING:
      Replace breakpoint-based font sizes with CSS clamp():
      font-size: clamp(1.25rem, 2.5vw + 0.5rem, 2.5rem)
  Output: typography_system_spec

Step 7 — Synthesize creative brief
  Rank all creative proposals by:
    Impact:     how significantly does this improve the product experience?
    Feasibility: how much effort does this require to implement correctly?
    Differentiation: does this make the product noticeably different from competitors?
    Accessibility risk: does this create accessibility complexity?
  Score each proposal: impact (1–5) × differentiation (1–5) / (feasibility × accessibility_risk)
  Select top recommendations per creative scope area.
  For each recommendation, define:
    - pattern name
    - reference product
    - design rationale
    - implementation complexity
    - estimated impact
    - accessibility notes
    - integration path (which skill receives this: frontend-ux-architect, motion-design-architect, code-generator)
  Output: creative_brief (ranked recommendations with integration paths)
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `creative_archetype` | `object` | Derived creative positioning (archetype name, personality traits, guiding aesthetic principles) |
| `layout_explorations` | `array[object]` | Innovative layout proposals per screen/context with rationale and constraints |
| `story_flows` | `array[object]` | Narrative arc designs for tours, onboarding, and storytelling interfaces |
| `background_system_specs` | `array[object]` | Immersive background techniques with performance and accessibility specs |
| `component_enhancement_specs` | `array[object]` | Premium interaction and visual enhancements per component |
| `typography_system_spec` | `object` | Expressive typography recommendations (display, kinetic, gradient, fluid scaling) |
| `creative_brief` | `array[object]` | Ranked, scored recommendations with reference, rationale, complexity, impact, and integration path |
| `metadata` | `object` | proposals_generated, scope_covered, top_recommendation, version |
| `metrics` | `object` | tokens_in, tokens_out, duration_ms, items_produced, version |
| `feedback` | `array[object]` | Backpropagate top recommendations to frontend-ux-architect as creative_recommendations |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["creative_archetype", "layout_explorations", "creative_brief", "metadata", "metrics", "feedback"],
  "properties": {
    "creative_archetype": {
      "type": "object",
      "required": ["name", "personality_traits", "aesthetic_principles"],
      "properties": {
        "name":                { "type": "string" },
        "personality_traits":  { "type": "array", "items": { "type": "string" } },
        "aesthetic_principles": { "type": "array", "items": { "type": "string" } },
        "reference_products":  { "type": "array", "items": { "type": "string" } }
      }
    },
    "layout_explorations": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["context", "layout_pattern", "rationale", "complexity"],
        "properties": {
          "context":         { "type": "string" },
          "layout_pattern":  { "type": "string" },
          "rationale":       { "type": "string" },
          "reference":       { "type": "string" },
          "complexity":      { "type": "string", "enum": ["low", "medium", "high"] },
          "constraints":     { "type": "array", "items": { "type": "string" } }
        }
      }
    },
    "story_flows": { "type": "array" },
    "background_system_specs": { "type": "array" },
    "component_enhancement_specs": { "type": "array" },
    "typography_system_spec": { "type": "object" },
    "creative_brief": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["pattern", "reference", "rationale", "complexity", "impact", "integration_path"],
        "properties": {
          "pattern":             { "type": "string" },
          "reference":           { "type": "string" },
          "rationale":           { "type": "string" },
          "complexity":          { "type": "string", "enum": ["low", "medium", "high"] },
          "impact":              { "type": "string", "enum": ["low", "medium", "high"] },
          "accessibility_notes": { "type": "string" },
          "integration_path":    { "type": "string" },
          "score":               { "type": "number" }
        }
      }
    },
    "metadata": {
      "type": "object",
      "properties": {
        "proposals_generated":  { "type": "integer" },
        "scope_covered":        { "type": "array", "items": { "type": "string" } },
        "top_recommendation":   { "type": "string" },
        "version":              { "type": "string" }
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

- All creative proposals MUST include an `accessibility_notes` field — beauty does not excuse exclusion.
- Gradient text MUST always include a plain-text screen-reader alternative.
- WebGL backgrounds are capped at one per page — multiple WebGL contexts are prohibited.
- Particle systems must auto-disable when frame rate drops below 45fps.
- Every layout exploration must be tagged with `complexity` — high-complexity proposals require a feasibility note.
- `creative_brief` entries must be scored and ranked — the highest-scored item becomes `top_recommendation`.

## Security Considerations

- Third-party creative resources (Spline CDN, Google Fonts, external asset CDNs) must be flagged for CSP review.
- WebGL contexts loading remote 3D assets must validate origin and integrity.
- Canvas-based particle systems must not access microphone, camera, or device sensors.

## Token Optimization

- Compress `component_contracts` to name only when generating enhancement specs — full prop details not needed.
- `creative_brief` output capped at 10 ranked proposals — emit only the top 10 by score.
- Skip `story_flows` generation when `creative_scope` does not include `storytelling`.
- Skip `background_system_specs` when `creative_scope` does not include `immersive`.

## Quality Checklist

- [ ] creative_archetype derived from product_brief.brand_personality
- [ ] layout_explorations covers all screens (or top-3 most impactful if scope is large)
- [ ] At least 2 layout proposals per screen (to present real options)
- [ ] All component_enhancement_specs include accessibility fallbacks
- [ ] creative_brief has ≥ 5 proposals, all scored and ranked
- [ ] top_recommendation identified in metadata
- [ ] All accessibility_notes populated (not empty)
- [ ] WebGL / 3D proposals include GPU budget and mobile fallback

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| `product_brief.brand_personality` missing | Return error: `{"error": "MISSING_BRAND_PERSONALITY", "hint": "Provide brand_personality (e.g. minimal-precise, warm-playful, powerful-dark)"}` |
| `inspiration_references` empty | Default to archetype-appropriate references (functional → Linear; premium → Apple/Stripe) |
| All proposals are high complexity | Flag as warning; include at least 1 low/medium complexity quick-win proposal |
| Accessibility constraints cannot be met by a proposal | Remove proposal from creative_brief; note in feedback why it was excluded |

## Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Behavior |
|------|---------|---------|----------|
| Creative direction approval | Always | 7200s | Present creative_archetype, top layout_explorations, and ranked creative_brief for product stakeholder sign-off before any motion or implementation work begins |
| 3D / WebGL approval | `background_system_specs` includes WebGL option | 3600s | Requires explicit GPU budget approval before proceeding |

## Skill Composition

```yaml
composes:
  - skill: creative-experience-architect
    version: "^1.0.0"
    input_map:
      product_brief:              "product.brief"
      screens:                    "ux_architecture.screens"
      component_contracts:        "ux_architecture.component_contracts"
      visual_excellence_targets:  "ux_architecture.visual_excellence_targets"
      inspiration_references:     ["Linear", "Stripe", "Apple"]
      creative_scope:             ["layout", "motion", "storytelling", "immersive"]
    output_map:
      creative_brief:              "creative_direction.brief"
      layout_explorations:         "creative_direction.layouts"
      component_enhancement_specs: "creative_direction.component_enhancements"
```

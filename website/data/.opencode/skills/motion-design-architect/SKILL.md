---
name: motion-design-architect
version: 1.0.0
domain: design
description: 'Use when designing a motion system, reviewing animations, planning transitions, or choreographing multi-element interactions. Triggers on: "motion design", "animation system", "design the transitions", "choreograph interactions", "motion architecture", "spring animation", "scroll-driven animation". Do NOT use for static UI layout without animation requirements.'
author: system
---

## Purpose

Design the complete motion system for a product — from the governing motion philosophy and token hierarchy down to per-component animation specs, interaction choreography, and performance budgets. The skill consumes the `motion_spec` brief emitted by `frontend-ux-architect` (SKL-031) and produces a detailed motion architecture document ready for implementation with Framer Motion, Motion One, CSS animations, or GSAP. It enforces motion accessibility (prefers-reduced-motion), GPU compositing constraints, and timing science (human perception thresholds, spring physics) throughout. When `creative_direction` is `immersive` or `cinematic`, the skill also specifies 3D scene integration with Spline or React Three Fiber.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `motion_spec` | `object` | Yes | Motion brief from `frontend-ux-architect` (SKL-031) — micro_interactions, page_transitions, scroll_experiences, advanced_motion, 3d_elements |
| `component_contracts` | `array[object]` | Yes | Component list from `frontend-ux-architect` — defines which components receive motion |
| `design_constraints` | `object` | Yes | Framework, animation library preference, performance budget |
| `visual_excellence_targets` | `object` | No | Visual spec from `frontend-ux-architect` — used to align motion with brand personality |
| `creative_direction` | `string` | No | `functional` (default), `expressive`, `immersive`, or `cinematic` |
| `existing_motion_tokens` | `object` | No | Already-defined motion token values to extend rather than replace |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["motion_spec", "component_contracts", "design_constraints"],
  "properties": {
    "motion_spec": {
      "type": "object",
      "properties": {
        "micro_interactions":       { "type": "array" },
        "page_transitions":         { "type": "array" },
        "scroll_experiences":       { "type": "array" },
        "advanced_motion":          { "type": "array" },
        "3d_elements":              { "type": "array" },
        "reduced_motion_fallbacks": { "type": "array" }
      }
    },
    "component_contracts": { "type": "array" },
    "design_constraints": {
      "type": "object",
      "required": ["framework"],
      "properties": {
        "framework":           { "type": "string" },
        "animation_library":   { "type": "string", "enum": ["framer-motion", "motion-one", "gsap", "css", "auto"] },
        "performance_budget":  { "type": "object",
          "properties": {
            "max_animation_fps_drop": { "type": "integer", "default": 5 },
            "max_gpu_memory_mb":      { "type": "integer", "default": 128 },
            "max_tti_delay_ms":       { "type": "integer", "default": 300 }
          }
        }
      }
    },
    "visual_excellence_targets": { "type": "object" },
    "creative_direction": {
      "type": "string",
      "enum": ["functional", "expressive", "immersive", "cinematic"],
      "default": "functional"
    },
    "existing_motion_tokens": { "type": "object" }
  }
}
```

## Required Context

- `motion_spec` from `frontend-ux-architect` (SKL-031) — without it, the scope of motion work cannot be determined.
- `design_constraints.framework` must be known to select the correct animation library.
- When `creative_direction` is `immersive` or `cinematic`: 3D library selection (Spline vs. React Three Fiber) is determined by complexity.

## Execution Logic

```
Step 1 — Define motion philosophy and guiding principles
  Derive motion personality from creative_direction and visual_excellence_targets:
    functional:   Motion serves clarity — transitions orient, not entertain.
                  Durations: 120–250ms. Easing: ease-out, ease-in-out. No decorative animation.
    expressive:   Motion communicates brand character.
                  Durations: 200–400ms. Spring physics for interactive elements.
                  Micro-interactions on key moments (success, error, hover).
    immersive:    Motion creates environment — the UI feels alive.
                  Scroll-driven narratives. Layered depth. Parallax elements.
                  3D integration for hero sections or product showcases.
    cinematic:    Motion is the primary design medium.
                  Page transitions are choreographed sequences.
                  Staggered entrances, shared-element morphing, physics-based throws.
                  GPU budget must be explicitly declared.
  Define three motion rules for this product:
    - Timing rule: default duration for interactive feedback
    - Easing rule: preferred curve family (spring vs. bezier)
    - Choreography rule: simultaneous vs. sequential vs. staggered
  Output: motion_philosophy { personality, rules[3], library_recommendation }

Step 2 — Define and validate motion token set
  Extend or create motion tokens from existing_motion_tokens:
    Duration tier (primitives):
      duration-instant: 50ms   (system feedback — checkbox tick, toggle)
      duration-fast:    120ms  (hover effects, icon state changes)
      duration-normal:  250ms  (panel open, tooltip appear, card expand)
      duration-slow:    400ms  (page transitions, complex reveals)
      duration-glacial: 800ms  (storytelling reveals, cinematic only)
    Easing tier (primitives — named cubic-bezier functions):
      easing-linear:      cubic-bezier(0, 0, 1, 1)
      easing-standard:    cubic-bezier(0.4, 0, 0.2, 1)   (Material Design standard)
      easing-decelerate:  cubic-bezier(0, 0, 0.2, 1)     (elements entering the screen)
      easing-accelerate:  cubic-bezier(0.4, 0, 1, 1)     (elements leaving the screen)
      easing-spring-out:  cubic-bezier(0.34, 1.56, 0.64, 1)  (bouncy — use sparingly)
    Spring tier (physics parameters — for Framer Motion / Motion One):
      spring-snappy:  { stiffness: 400, damping: 30, mass: 1 }   (button press, toggle)
      spring-default: { stiffness: 300, damping: 30, mass: 1 }   (general interactions)
      spring-gentle:  { stiffness: 200, damping: 25, mass: 1 }   (large panel open)
      spring-wobbly:  { stiffness: 200, damping: 15, mass: 1 }   (playful — expressive/cinematic only)
    Stagger tier (delay increments):
      stagger-tight:  30ms per item  (dense lists, chips)
      stagger-normal: 50ms per item  (card grids, navigation items)
      stagger-loose:  80ms per item  (feature sections, storytelling)
  Validate: all token names match the motion token naming schema from design-system-generator.
  Enforce: spring-wobbly must not appear in functional creative_direction.
  Output: motion_token_set (complete motion token definitions)

Step 3 — Specify micro-interactions
  For each micro_interaction in motion_spec.micro_interactions:
    Define the complete animation spec:
      trigger:     hover | focus | active | checked | error | success | custom
      element:     component name and target sub-element (e.g. Button > .icon)
      properties:  list of animated CSS properties (transform, opacity, box-shadow only — GPU safe)
      values:      { from, to } pair for each property
      duration:    reference to a duration token
      easing:      reference to an easing token or spring token
      delay:       0 unless intentional choreography
      reduced_motion_fallback: { override: "instant" | "skip" | "replace", replacement_description }
    Flag any micro-interaction that animates layout-triggering properties:
      (width, height, padding, margin, top, left, right, bottom, font-size)
      These MUST be replaced with transform equivalents or removed.
    Reference patterns for specific triggers:
      Button hover:    translateY(-1px) + box-shadow elevation increase + duration-fast
      Button press:    scale(0.97) spring-snappy
      Card hover:      translateY(-2px) + shadow elevation + duration-normal easing-decelerate
      Input focus:     border-color transition + box-shadow ring + duration-fast
      Checkbox toggle: scale 0→1 with spring-snappy + opacity fade
      Success state:   brief scale(1.1)→scale(1) with spring-snappy + color transition
      Error state:     translateX shake pattern (keyframes: 0→-4px→4px→-2px→2px→0)
  Output: micro_interaction_specs (array, one per component interaction)

Step 4 — Specify page transitions
  For each page_transition in motion_spec.page_transitions:
    Define the transition strategy:
      fade:          opacity 0→1, duration-slow, easing-decelerate. Simplest, least disorienting.
      slide:         translateX ±100% outgoing + translateX 0 incoming.
                     Direction must be semantically meaningful (right = forward, left = back).
      shared-element: Define shared element pairs (source selector → destination selector).
                     Use Framer Motion layoutId or View Transitions API.
                     Animate: position (layout), size (layout), border-radius (layout), opacity (opacity).
                     Duration: duration-slow. Spring: spring-gentle.
      morph:         Container morphs shape/position — use Framer Motion layout prop.
                     Requires both source and destination to be in the DOM simultaneously.
      Define: entering animation (new route arrives), exiting animation (old route leaves).
      Define: interrupt behavior (what happens if user navigates during transition).
      Define: reduced_motion_fallback (always: instant swap, no animation).
    Library-specific implementation notes:
      Framer Motion: AnimatePresence + motion.div with variants + layoutId for shared elements
      React Router v7+: use View Transitions API (startViewTransition)
      Next.js App Router: page.tsx wraps with motion.div; layout.tsx AnimatePresence
  Output: page_transition_specs (array, one per route transition pair)

Step 5 — Specify scroll experiences
  For each scroll_experience in motion_spec.scroll_experiences:
    Define scroll-triggered animation spec:
      trigger:     IntersectionObserver threshold (default: 0.1 — element 10% visible)
      element:     target element selector or component name
      enter_animation: { from, to, duration, easing } triggered on enter viewport
      exit_animation:  { from, to, duration, easing } triggered on exit (optional)
      stagger:     if multiple children — stagger_token reference + direction (top-down | bottom-up)
    Define parallax specs (if scroll_experience.type = "parallax"):
      layer:       background | midground | foreground
      speed:       0.0 (anchored) to 1.0 (full parallax)
      property:    translateY only (translateX parallax causes horizontal scroll — prohibited)
    Define scroll-progress-linked animation (if scroll_experience.type = "progress-linked"):
      progress_source: window scroll position or specific container scroll
      animated_property: opacity | scaleX | translateY (GPU-safe only)
      from_progress: 0.0 (start animating when scroll progress is 0%)
      to_progress:   1.0 (finish animating at scroll progress 100%)
    Implementation library selection:
      CSS only:      Intersection Observer API + CSS transitions/animations
      Framer Motion: useScroll + useTransform hooks
      Motion One:    scroll() function with timeline
      GSAP ScrollTrigger: for complex narrative sequences
    Enforce: scroll animations MUST NOT trigger before user has scrolled (no on-load reveals).
    Enforce: reduced_motion_fallback must be defined (skip animation, show final state immediately).
  Output: scroll_experience_specs (array)

Step 6 — Specify advanced motion (choreography and physics)
  For each advanced_motion in motion_spec.advanced_motion:
    Define choreography sequence:
      sequence: ordered list of { element, animation, offset_ms } steps
      Each step references micro_interaction_specs or defines its own animation inline.
      Validate: no two elements animate simultaneously unless intended (document intent).
    Define stagger system (if applicable):
      parent:   container component name
      children: child selector (e.g. li, .card)
      stagger:  stagger token reference
      direction: forward | reverse | center-out | random (random only for cinematic)
    Define physics throws (if creative_direction is immersive or cinematic):
      initial_velocity: pixels per second
      spring:           spring token reference
      boundary:         constrain motion within viewport or container
    Validate: total choreography duration ≤ 2000ms (beyond this users feel stuck).
    Validate: stagger sequences ≤ 12 items (beyond 12 items the stagger is imperceptible).
  Output: advanced_motion_specs (array, one per choreography unit)

Step 7 — Specify 3D integration (if 3d_elements present in motion_spec)
  For each 3d_element in motion_spec.3d_elements:
    Select library:
      Spline:             authored 3D scenes, no code required, embed via <spline-viewer>.
                          Use for: hero backgrounds, product visuals, decorative 3D.
                          Constraint: max 1 Spline scene per page (heavy GPU cost).
      React Three Fiber:  programmatic 3D with full React integration.
                          Use for: interactive product configurators, data visualizations, games.
      CSS perspective:    perspective() + rotateX/rotateY transforms.
                          Use for: tilt effects, card flips, hover depth — lowest GPU cost.
    Define interaction contract:
      trigger:        hover | scroll | pointer-position | click | auto-rotate
      rotation_range: { x: [-15, 15], y: [-15, 15] } degrees (CSS perspective tilt)
      perspective:    800px–1200px (closer = more dramatic)
    Define GPU budget:
      max_draw_calls:   declare maximum expected draw calls
      max_triangles:    for Spline/R3F scenes — declare polygon budget
      target_fps:       60fps minimum; drop to 30fps on low-end devices gracefully
    Define fallback for devices without GPU:
      static_image:  provide a static PNG fallback for the 3D scene
      reduced_3d:    CSS perspective tilt only (no Spline/R3F)
  Output: 3d_integration_specs (array)

Step 8 — Compile accessibility motion rules
  Produce the complete prefers-reduced-motion ruleset:
    For every animation defined in steps 3–7:
      If type = micro-interaction:  reduce to instant (duration: 0ms)
      If type = page-transition:    replace with opacity fade only (duration-fast)
      If type = scroll-experience:  skip animation — show final state immediately
      If type = stagger:            collapse to simultaneous (no stagger delay)
      If type = 3d:                 disable rotation/tilt — show static state
      If type = parallax:           disable parallax — scroll normally
    Generate the @media (prefers-reduced-motion: reduce) CSS block.
    Generate the shouldReduceMotion utility function (Framer Motion hook).
  Output: accessibility_motion_spec (complete reduced-motion ruleset)

Step 9 — Validate and score motion quality
  Apply motion quality dimensions from ui-ux-compliance-guard criteria:
    smoothness:   confirm all animations use transform + opacity only (GPU-composited)
    purpose:      confirm each animation has a documented UX rationale
    performance:  confirm durations within budget, stagger ≤ 12 items, 3D has GPU budget
    user_impact:  confirm prefers-reduced-motion coverage is 100%
  Output: motion_quality_preview { smoothness, purpose, performance, user_impact, total }

Step 10 — Assemble motion architecture document
  Combine all outputs into the motion architecture artifact.
  Output: complete motion_architecture
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `motion_philosophy` | `object` | Governing personality, 3 motion rules, library recommendation |
| `motion_token_set` | `object` | Complete motion token definitions (duration, easing, spring, stagger tiers) |
| `micro_interaction_specs` | `array[object]` | Per-component interaction specs (trigger, properties, duration, easing, fallback) |
| `page_transition_specs` | `array[object]` | Route transition designs (entering, exiting, shared elements, interrupt behavior) |
| `scroll_experience_specs` | `array[object]` | Scroll-triggered and parallax animation specs |
| `advanced_motion_specs` | `array[object]` | Choreography sequences, stagger systems, physics throws |
| `3d_integration_specs` | `array[object]` | 3D element specs with library, GPU budget, fallback (null when no 3D in motion_spec) |
| `accessibility_motion_spec` | `object` | Complete prefers-reduced-motion ruleset for every defined animation |
| `motion_quality_preview` | `object` | Pre-implementation quality score estimate (smoothness, purpose, performance, user_impact, total) |
| `metadata` | `object` | animation_count, component_coverage, library_used, creative_direction, version |
| `metrics` | `object` | tokens_in, tokens_out, duration_ms, items_produced, version |
| `feedback` | `array[object]` | Backpropagate to frontend-ux-architect if motion_spec is incomplete |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["motion_philosophy", "motion_token_set", "micro_interaction_specs", "accessibility_motion_spec", "metadata", "metrics", "feedback"],
  "properties": {
    "motion_philosophy": {
      "type": "object",
      "required": ["personality", "rules", "library_recommendation"],
      "properties": {
        "personality":            { "type": "string", "enum": ["functional", "expressive", "immersive", "cinematic"] },
        "rules":                  { "type": "array", "minItems": 3, "maxItems": 3, "items": { "type": "string" } },
        "library_recommendation": { "type": "string" }
      }
    },
    "motion_token_set": {
      "type": "object",
      "required": ["duration", "easing", "spring", "stagger"],
      "properties": {
        "duration": { "type": "object" },
        "easing":   { "type": "object" },
        "spring":   { "type": "object" },
        "stagger":  { "type": "object" }
      }
    },
    "micro_interaction_specs": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["component", "trigger", "properties", "duration_token", "easing_token", "reduced_motion_fallback"],
        "properties": {
          "component":               { "type": "string" },
          "trigger":                 { "type": "string" },
          "properties":              { "type": "array", "items": { "type": "string" } },
          "values":                  { "type": "object" },
          "duration_token":          { "type": "string" },
          "easing_token":            { "type": "string" },
          "delay_ms":                { "type": "integer" },
          "reduced_motion_fallback": { "type": "object" }
        }
      }
    },
    "page_transition_specs": { "type": "array" },
    "scroll_experience_specs": { "type": "array" },
    "advanced_motion_specs": { "type": "array" },
    "3d_integration_specs": { "type": ["array", "null"] },
    "accessibility_motion_spec": {
      "type": "object",
      "required": ["css_block", "js_utility", "coverage_percentage"],
      "properties": {
        "css_block":           { "type": "string" },
        "js_utility":          { "type": "string" },
        "coverage_percentage": { "type": "integer", "minimum": 100, "maximum": 100 }
      }
    },
    "motion_quality_preview": {
      "type": "object",
      "required": ["smoothness", "purpose", "performance", "user_impact", "total"],
      "properties": {
        "smoothness":  { "type": "integer", "minimum": 0, "maximum": 25 },
        "purpose":     { "type": "integer", "minimum": 0, "maximum": 25 },
        "performance": { "type": "integer", "minimum": 0, "maximum": 25 },
        "user_impact": { "type": "integer", "minimum": 0, "maximum": 25 },
        "total":       { "type": "integer", "minimum": 0, "maximum": 100 }
      }
    },
    "metadata": {
      "type": "object",
      "properties": {
        "animation_count":      { "type": "integer" },
        "component_coverage":   { "type": "number" },
        "library_used":         { "type": "string" },
        "creative_direction":   { "type": "string" },
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

- Every defined animation MUST have a `reduced_motion_fallback` — `accessibility_motion_spec.coverage_percentage` must equal 100.
- Only `transform` and `opacity` are permitted as animated properties — all other properties are a `critical` violation.
- Stagger sequences are capped at 12 items — beyond this the stagger delay is imperceptible and wastes budget.
- Total choreography sequence duration must not exceed 2000ms.
- `spring-wobbly` token is prohibited for `creative_direction: functional`.
- 3D scenes (Spline or React Three Fiber) must declare a GPU memory budget — no undeclared 3D.
- `accessibility_motion_spec.coverage_percentage` must equal 100 before output is accepted — every animation must have a reduced-motion fallback.

## Security Considerations

- 3D scenes loaded from Spline CDN must be flagged for Content-Security-Policy `connect-src` review.
- WebGL contexts must declare a max GPU memory budget — runaway scenes are a DoS vector on low-end devices.
- Animation libraries loaded from CDN (GSAP, etc.) must be pinned to exact versions.

## Token Optimization

- Compress `component_contracts` to name + states only during processing.
- `micro_interaction_specs`: output trigger + properties + tokens only — omit verbose rationale per spec.
- For `creative_direction: functional`: skip steps 6 (advanced motion physics) and 7 (3D) entirely.

## Quality Checklist

- [ ] motion_philosophy defines personality and exactly 3 governing rules
- [ ] motion_token_set covers all 4 tiers: duration, easing, spring, stagger
- [ ] Every micro_interaction_spec uses only transform + opacity properties
- [ ] Every micro_interaction_spec references duration and easing tokens (not raw values)
- [ ] Every animation type has a reduced_motion_fallback defined
- [ ] accessibility_motion_spec.coverage_percentage = 100
- [ ] No stagger sequence exceeds 12 items
- [ ] No choreography sequence exceeds 2000ms total
- [ ] 3D specs declare GPU budget (when present)
- [ ] motion_quality_preview.total ≥ 70

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| `motion_spec` is empty | Return error: `{"error": "EMPTY_MOTION_SPEC", "hint": "Run frontend-ux-architect (SKL-031) with motion_requirements to generate a motion_spec"}` |
| Layout-triggering property detected in animation spec | Replace with GPU-safe equivalent; emit `critical` violation |
| `creative_direction: cinematic` but no GPU budget declared | Block until GPU budget is explicitly declared |
| Stagger sequence > 12 items | Auto-cap at 12; emit warning with rationale |
| 3D spec present but framework lacks WebGL support | Fallback to CSS perspective tilt; emit info feedback |

## Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Behavior |
|------|---------|---------|----------|
| Motion system approval | Always | 3600s | Present motion_philosophy, token_set summary, and motion_quality_preview for sign-off before implementation |
| 3D integration approval | `3d_integration_specs` is non-empty | 3600s | Present GPU budget declaration and fallback strategy for explicit approval |

## Skill Composition

```yaml
composes:
  - skill: motion-design-architect
    version: "^1.0.0"
    input_map:
      motion_spec:               "ux_architecture.motion_spec"
      component_contracts:       "ux_architecture.component_contracts"
      design_constraints:        "architecture.design_constraints"
      visual_excellence_targets: "ux_architecture.visual_excellence_targets"
      creative_direction:        "expressive"
    output_map:
      motion_token_set:         "design_system.motion_tokens"
      micro_interaction_specs:  "motion.micro_interactions"
      page_transition_specs:    "motion.page_transitions"
      accessibility_motion_spec: "motion.accessibility"
```

---
name: ux-research-synthesizer
version: 1.0.0
domain: design
description: 'Use when analyzing user flows, mapping journeys, detecting friction points, or evaluating a UI against usability heuristics. Triggers on: "user flow analysis", "journey mapping", "find friction points", "usability review", "heuristic evaluation", "UX research", "detect pain points". Do NOT use for visual design reviews or code compliance checks — use ui-ux-compliance-guard for those.'
author: system
---

## Purpose

Evaluate a proposed or implemented UX against evidence-based usability principles to detect friction, cognitive overload, missing affordances, and accessibility barriers before they reach users. The skill synthesizes user journey analysis, heuristic evaluation (Nielsen's 10 + 5 modern digital extensions), friction scoring, and accessibility experience auditing into a structured research output that drives UX improvement. It operates on UX architecture documents (from `frontend-ux-architect`), screen inventories, or implemented code maps. Output feeds directly into `frontend-ux-architect` as backpropagation to revise navigation, flows, and interaction patterns.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `screens` | `array[object]` | Yes | Screen inventory from `frontend-ux-architect` (name, route, layout_type, requirements_covered) |
| `navigation_map` | `array[object]` | Yes | Navigation transitions from `frontend-ux-architect` |
| `interaction_patterns` | `array[object]` | No | Interaction pattern specs from `frontend-ux-architect` |
| `component_contracts` | `array[object]` | No | Component contracts — used to verify state coverage |
| `user_personas` | `array[object]` | No | User personas with role, goals, technical_proficiency, accessibility_needs |
| `existing_flows` | `array[object]` | No | Documented user flows to analyze (name, steps array) |
| `accessibility_report` | `object` | No | Accessibility report from `frontend-ux-architect` |
| `evaluation_scope` | `array[string]` | No | Subset of heuristics to evaluate (default: all 15) |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["screens", "navigation_map"],
  "properties": {
    "screens": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": ["name", "route", "layout_type"],
        "properties": {
          "name":        { "type": "string" },
          "route":       { "type": "string" },
          "layout_type": { "type": "string" },
          "primary_action": { "type": "string" }
        }
      }
    },
    "navigation_map": { "type": "array" },
    "interaction_patterns": { "type": "array" },
    "component_contracts":  { "type": "array" },
    "user_personas": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "role":                  { "type": "string" },
          "goals":                 { "type": "array", "items": { "type": "string" } },
          "technical_proficiency": { "type": "string", "enum": ["novice", "intermediate", "expert"] },
          "accessibility_needs":   { "type": "array", "items": { "type": "string" } }
        }
      }
    },
    "existing_flows": { "type": "array" },
    "accessibility_report": { "type": "object" },
    "evaluation_scope": { "type": "array", "items": { "type": "string" } }
  }
}
```

## Required Context

- `screens` and `navigation_map` from `frontend-ux-architect` (SKL-031) — the primary UX artifact under evaluation.
- `user_personas` when available significantly improve journey accuracy.
- When evaluating implemented UIs: `component_contracts` enables state coverage analysis.

## Execution Logic

```
Step 1 — Reconstruct user journeys
  For each primary user goal (derived from screens and user_personas.goals):
    Trace the complete path through the navigation_map:
      - Entry point (onboarding, home, search, deep link)
      - Happy path (primary goal completion)
      - Error path (what happens when something goes wrong)
      - Recovery path (how user gets back on track)
    Annotate each step with:
      - Cognitive load estimate: low | medium | high
        (high = > 3 decisions, dense information, ambiguous affordances)
      - Emotional state estimate: neutral | engaged | frustrated | delighted
      - Time-on-step estimate: < 5s | 5–30s | > 30s
    Flag journeys with total steps > 7 for goal completion as high-friction candidates.
  Output: user_journey_maps (array, one per identified user goal)

Step 2 — Apply heuristic evaluation (15 heuristics)
  Nielsen's 10 Usability Heuristics:
    H1  Visibility of system status
    H2  Match between system and real world
    H3  User control and freedom
    H4  Consistency and standards
    H5  Error prevention
    H6  Recognition over recall
    H7  Flexibility and efficiency of use
    H8  Aesthetic and minimalist design
    H9  Help users recognize, diagnose, and recover from errors
    H10 Help and documentation

  5 Modern Digital Extensions:
    H11 Mobile-first and touch optimization (44px targets, swipe affordances)
    H12 Progressive disclosure (complexity staged, not dumped)
    H13 Real-time feedback (optimistic UI, instant validation, skeleton loaders)
    H14 Trust and transparency (data usage, permissions, pricing clarity)
    H15 Empty state quality (first-run experience, no-results, error states)

  For each heuristic, evaluate each screen in scope:
    severity: 0 (not a problem) | 1 (cosmetic) | 2 (minor) | 3 (major) | 4 (catastrophic)
    location: screen name + component or region
    description: what is observed
    recommendation: specific fix
  Output: heuristic_evaluation (array of findings per heuristic)

Step 3 — Detect friction patterns
  Friction pattern library — check each against the screen and flow data:
    F1  Dead-end screens: screens with no clear primary action or next step
    F2  Orphan screens: screens reachable but not listed in navigation_map
    F3  Pogo-sticking: user must navigate back more than once to complete a goal
    F4  Permission wall: required action blocked by unrelated permission request
    F5  Registration gate: feature requires sign-up before demonstrating value
    F6  Form overload: form with > 7 fields without progressive disclosure
    F7  Error-only validation: form validates only on submit (not on blur)
    F8  Ambiguous CTAs: multiple equally-weighted primary actions on one screen
    F9  Hidden affordances: key functionality only discoverable by hover (not touch-safe)
    F10 Breadcrumb absence: views more than 2 levels deep with no location indicator
    F11 Confirmation debt: destructive actions without confirmation dialog
    F12 Loading opacity: data loading with no skeleton, spinner, or progress indicator
    F13 Empty void: empty states with no guidance, illustration, or call-to-action
    F14 Jargon overload: technical or domain-specific language without explanation
    F15 Scroll surprise: content below fold with no scroll affordance visible
  For each detected friction pattern: record location, severity (1–4), and remediation.
  Output: friction_report (array of detected patterns)

Step 4 — Score information architecture
  Evaluate the navigation_map structure:
    Depth: maximum navigation depth (ideal ≤ 3 levels from any entry point)
    Breadth: maximum navigation items per level (ideal ≤ 7 per level — Miller's Law)
    Balance: ratio of orphan screens to connected screens (target: 0%)
    Findability: for each screen, how many taps/clicks from home (ideal ≤ 3)
    Labeling clarity: are screen names self-explanatory without context?
  Output: ia_score { depth, breadth, balance, findability, labeling_clarity, total }

Step 5 — Accessibility experience audit
  Beyond WCAG technical compliance — evaluate the lived accessibility experience:
    Screen reader journey:
      - Trace the primary user journey using screen reader only
      - Flag any step where a screen reader user would be stuck or confused
      - Check focus order matches visual reading order
      - Check that dynamic content updates are announced (aria-live regions)
    Keyboard-only journey:
      - Trace the primary user journey using keyboard only
      - Flag any interactive element not reachable or operable by keyboard
      - Check modal focus trap and restoration on close
      - Check skip-to-content link present for main navigation
    Cognitive accessibility:
      - Reading level: flag screens with content above grade 8 reading level
      - Time pressure: flag any timed actions without sufficient warning
      - Consistency: flag patterns that behave differently across screens
      - Distraction: flag auto-playing media, flashing content (WCAG 2.3.1)
    Situational accessibility:
      - Low connectivity: is essential content available without full page load?
      - Bright light: is contrast sufficient for outdoor/bright-light use?
      - One-handed use: are primary actions reachable with thumb on mobile?
  Output: accessibility_experience_audit

Step 6 — Synthesize recommendations
  Group all findings by priority (critical → major → minor → cosmetic).
  For each critical or major finding:
    Produce a specific, actionable recommendation with:
      - what to change
      - where (screen + component)
      - why (which heuristic or friction pattern)
      - expected UX improvement
  Produce a top-5 highest-impact recommendations list.
  Compute overall UX health score (0–100):
    Base: 100
    Deductions:
      - Each catastrophic (severity 4) finding: -15
      - Each major (severity 3) finding: -8
      - Each minor (severity 2) finding: -3
      - Each cosmetic (severity 1) finding: -1
    Minimum: 0
  Output: recommendations (prioritized array), ux_health_score

Step 7 — Assemble research synthesis
  Combine all outputs.
  Flag any findings that require backpropagation to frontend-ux-architect (navigation changes, screen additions, interaction pattern updates).
  Output: complete ux_research_synthesis
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `user_journey_maps` | `array[object]` | Goal-oriented journey traces with cognitive load and emotional state per step |
| `heuristic_evaluation` | `array[object]` | Findings per heuristic (H1–H15) with severity, location, recommendation |
| `friction_report` | `array[object]` | Detected friction patterns (F1–F15) with severity and remediation |
| `ia_score` | `object` | Information architecture quality scores (depth, breadth, balance, findability, labeling_clarity, total) |
| `accessibility_experience_audit` | `object` | Screen reader, keyboard, cognitive, and situational accessibility findings |
| `recommendations` | `array[object]` | Prioritized actionable recommendations (top 5 flagged) |
| `ux_health_score` | `integer` | Overall UX quality score 0–100 |
| `metadata` | `object` | screens_evaluated, heuristics_applied, friction_patterns_checked, version |
| `metrics` | `object` | tokens_in, tokens_out, duration_ms, items_produced, version |
| `feedback` | `array[object]` | Backpropagate critical findings to frontend-ux-architect for redesign |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["user_journey_maps", "heuristic_evaluation", "friction_report", "ia_score", "recommendations", "ux_health_score", "metadata", "metrics", "feedback"],
  "properties": {
    "user_journey_maps": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["goal", "entry_point", "steps", "total_steps", "friction_level"],
        "properties": {
          "goal":          { "type": "string" },
          "entry_point":   { "type": "string" },
          "steps":         { "type": "array" },
          "total_steps":   { "type": "integer" },
          "friction_level": { "type": "string", "enum": ["low", "medium", "high"] }
        }
      }
    },
    "heuristic_evaluation": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["heuristic_id", "severity", "location", "description", "recommendation"],
        "properties": {
          "heuristic_id":    { "type": "string" },
          "severity":        { "type": "integer", "minimum": 0, "maximum": 4 },
          "location":        { "type": "string" },
          "description":     { "type": "string" },
          "recommendation":  { "type": "string" }
        }
      }
    },
    "friction_report": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["pattern_id", "severity", "location", "remediation"],
        "properties": {
          "pattern_id":  { "type": "string" },
          "severity":    { "type": "integer", "minimum": 1, "maximum": 4 },
          "location":    { "type": "string" },
          "remediation": { "type": "string" }
        }
      }
    },
    "ia_score": {
      "type": "object",
      "required": ["depth", "breadth", "balance", "findability", "labeling_clarity", "total"],
      "properties": {
        "depth":             { "type": "integer", "minimum": 0, "maximum": 20 },
        "breadth":           { "type": "integer", "minimum": 0, "maximum": 20 },
        "balance":           { "type": "integer", "minimum": 0, "maximum": 20 },
        "findability":       { "type": "integer", "minimum": 0, "maximum": 20 },
        "labeling_clarity":  { "type": "integer", "minimum": 0, "maximum": 20 },
        "total":             { "type": "integer", "minimum": 0, "maximum": 100 }
      }
    },
    "accessibility_experience_audit": {
      "type": "object",
      "properties": {
        "screen_reader_findings": { "type": "array" },
        "keyboard_findings":      { "type": "array" },
        "cognitive_findings":     { "type": "array" },
        "situational_findings":   { "type": "array" }
      }
    },
    "recommendations": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["what", "where", "why", "impact", "priority"],
        "properties": {
          "what":     { "type": "string" },
          "where":    { "type": "string" },
          "why":      { "type": "string" },
          "impact":   { "type": "string" },
          "priority": { "type": "string", "enum": ["critical", "major", "minor", "cosmetic"] },
          "top_5":    { "type": "boolean" }
        }
      }
    },
    "ux_health_score": { "type": "integer", "minimum": 0, "maximum": 100 },
    "metadata": {
      "type": "object",
      "properties": {
        "screens_evaluated":          { "type": "integer" },
        "heuristics_applied":         { "type": "integer" },
        "friction_patterns_checked":  { "type": "integer" },
        "version":                    { "type": "string" }
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

- All 15 heuristics (H1–H15) must be evaluated for every run — partial evaluation requires explicit `evaluation_scope` override.
- All 15 friction patterns (F1–F15) must be checked against the navigation_map.
- `ux_health_score` ≤ 60 triggers automatic backpropagation to `frontend-ux-architect` with critical findings.
- Journey maps are required for every unique primary user goal — no orphan goal is left unmapped.
- Every severity-4 (catastrophic) finding requires a specific recommendation — not a general note.

## Security Considerations

- This skill reads UX architecture artifacts only — it does not access user data or real telemetry.
- When `user_personas` are provided, they must be synthetic/representative — not real user PII.
- Recommendations that touch authentication flows must flag `security-review` (SKL-006) as required.

## Token Optimization

- Compress `screens` to name + route + layout_type for heuristic evaluation.
- Friction pattern check uses rule-based pattern matching — no verbose per-screen analysis.
- `heuristic_evaluation`: emit findings only (severity > 0) — omit passing heuristics from output to reduce payload.

## Quality Checklist

- [ ] User journey mapped for every primary user goal
- [ ] All 15 heuristics applied (or documented scope override)
- [ ] All 15 friction patterns checked
- [ ] ia_score covers all 5 dimensions
- [ ] accessibility_experience_audit covers all 4 dimensions
- [ ] top_5 recommendations flagged in recommendations array
- [ ] ux_health_score computed correctly
- [ ] Backpropagation emitted for all severity-4 findings

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| `screens` array empty | Return error: `{"error": "NO_SCREENS", "hint": "Run frontend-ux-architect (SKL-031) first"}` |
| `navigation_map` empty | Skip journey mapping; flag all screens as orphans (F2) |
| No user_personas provided | Use generic persona: intermediate-proficiency user, no accessibility needs |
| `ux_health_score` ≤ 40 | Escalate: emit `critical` feedback to frontend-ux-architect; recommend full redesign of worst-scoring flows |

## Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Behavior |
|------|---------|---------|----------|
| UX research review | `ux_health_score` ≤ 60 | 3600s | Present top-5 recommendations and ia_score for human prioritization before backpropagation triggers redesign |

## Skill Composition

```yaml
composes:
  - skill: ux-research-synthesizer
    version: "^1.0.0"
    input_map:
      screens:              "ux_architecture.screens"
      navigation_map:       "ux_architecture.navigation_map"
      interaction_patterns: "ux_architecture.interaction_patterns"
      component_contracts:  "ux_architecture.component_contracts"
    output_map:
      recommendations:  "ux_research.recommendations"
      ux_health_score:  "ux_research.health_score"
      friction_report:  "ux_research.friction"
```

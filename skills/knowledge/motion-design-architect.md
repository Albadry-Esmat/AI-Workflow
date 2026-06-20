# Motion Design Architecture — Knowledge Reference
#
# Version:  1.0.0
# Domain:   design / motion
# Skill:    .opencode/skills/motion-design-architect/SKILL.md
#
# Purpose:
#   Authoritative knowledge base for designing motion systems, specifying
#   animations, choreographing interactions, and enforcing performance and
#   accessibility standards for all UI motion.

## Principles

- **Only transform and opacity animate**: these are the only GPU-composited properties. Width, height, margin, padding, top, left trigger layout recalculation — use scale/translate instead.
- **Duration is perception**: instant (≤ 50ms) = system response; fast (120ms) = hover/toggle; normal (250ms) = panel/menu; slow (400ms) = page transition. Exceeding 400ms for interactive feedback feels broken.
- **Spring physics over bezier**: spring animations feel physically grounded and respond to interruption correctly. Cubic-bezier animations don't respond to mid-animation velocity changes.
- **Choreography is communication**: the order, direction, and timing of multiple elements animating together tells a visual story. Randomness is noise; sequential reveals are narrative.
- **prefers-reduced-motion is non-negotiable**: 100% of animations must have a fallback. Vestibular disorders affect ~35% of people over 40.

## Motion Token Architecture

| Tier | Token Type | Example Values |
|------|-----------|----------------|
| Duration | Primitive | instant: 50ms, fast: 120ms, normal: 250ms, slow: 400ms, glacial: 800ms |
| Easing | Primitive | standard, decelerate, accelerate, spring-out (cubic-bezier values) |
| Spring | Physics | snappy {k:400,d:30}, default {k:300,d:30}, gentle {k:200,d:25}, wobbly {k:200,d:15} |
| Stagger | Timing increment | tight: 30ms, normal: 50ms, loose: 80ms |

Spring parameters: `stiffness (k)` = how fast it snaps back; `damping (d)` = how much it oscillates; `mass` = resistance to change. Higher stiffness = snappier. Lower damping = more bounce.

## Micro-Interaction Patterns

| Trigger | Recommended Pattern | Duration Token | Spring Token |
|---------|-------------------|---------------|-------------|
| Button hover | translateY(-1px) + shadow elevation++ | fast | — |
| Button press | scale(0.97) | — | spring-snappy |
| Card hover | translateY(-2px) + shadow elevation++ | normal | — |
| Input focus | border-color + box-shadow ring | fast | — |
| Checkbox check | scale 0→1 + opacity | — | spring-snappy |
| Success | scale(1.1)→(1.0) + color | — | spring-snappy |
| Error | translateX shake keyframe | fast | — |
| List item hover | background reveal + action bar | normal | — |

## Animation Library Selection Guide

| Scenario | Library | Reason |
|----------|---------|--------|
| React, complex page transitions | Framer Motion | Native React, layout animations, AnimatePresence, gesture support |
| Vanilla JS, performance-critical | Motion One | Web Animations API native, smallest bundle |
| Complex timeline sequences, GSAP-style | GSAP | Industry standard for complex orchestration, ScrollTrigger |
| CSS-only, no JS needed | CSS Transitions + Keyframes | Zero bundle, GPU-composited, simplest approach |
| 3D authored scenes | Spline | No code, visual editor, CDN embed |
| 3D programmatic, React | React Three Fiber | Full R3F + Drei ecosystem |

## Scroll Animation Patterns

| Pattern | Technique | Performance | Use Case |
|---------|-----------|-------------|----------|
| Entrance reveal | Intersection Observer + CSS class | Excellent | Section headings, feature cards |
| Parallax | useScroll + useTransform (translateY only) | Good | Hero backgrounds, depth layers |
| Progress-linked | scroll() API or useScroll | Good | Progress bars, storytelling |
| Narrative storyboard | GSAP ScrollTrigger + timeline | Medium | Complex marketing sequences |

Rule: scroll animations MUST NOT fire on page load before user has scrolled.

## 3D Integration Decision Matrix

| Complexity | Interactivity | Library | GPU Budget |
|-----------|---------------|---------|-----------|
| Simple tilt effect | Hover response | CSS perspective | Minimal (CPU) |
| Static 3D scene | None | Spline embed | High (WebGL) — 1 per page max |
| Animated 3D scene | Scroll/hover | Spline + scroll events | Very high — desktop only |
| Programmatic geometry | Full interaction | React Three Fiber | High — declare budget |
| Data visualization 3D | User input | Three.js + D3 | Medium-high |

Mobile fallback is MANDATORY for all WebGL contexts: provide a static PNG or CSS-perspective alternative.

## Performance Budgets

| Metric | Target | Maximum |
|--------|--------|---------|
| Animation FPS drop | 0 | 5fps below 60fps |
| GPU memory (3D) | 64MB | 128MB |
| Time-to-interactive delay | 0ms | 300ms |
| Stagger item count | ≤ 8 | ≤ 12 |
| Choreography sequence total | ≤ 1200ms | ≤ 2000ms |
| WebGL contexts per page | 0–1 | 1 |

## Accessibility Motion Standards

```css
@media (prefers-reduced-motion: reduce) {
  /* Micro-interactions: instant (0ms duration) */
  *, *::before, *::after {
    animation-duration:   0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration:  0.01ms !important;
  }
  /* Page transitions: instant swap */
  .page-transition { transition: none !important; }
  /* Scroll animations: show final state immediately */
  .scroll-reveal { opacity: 1 !important; transform: none !important; }
  /* Parallax: disable */
  .parallax-layer { transform: none !important; }
}
```

```js
// Framer Motion hook
import { useReducedMotion } from 'framer-motion';
const shouldReduceMotion = useReducedMotion();
const springConfig = shouldReduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 300, damping: 30 };
```

## Anti-Patterns

- Animating `width`, `height`, `margin`, `padding`, `top`, `left`, `right`, `bottom` (triggers layout).
- Using `will-change: all` — only apply to elements that are actively animating.
- Stagger sequences exceeding 12 items (delay becomes imperceptible noise).
- Choreography sequences exceeding 2000ms total (users feel trapped).
- Using `spring-wobbly` for functional/enterprise interfaces (too playful for context).
- Loading 3D scenes without a mobile fallback and GPU budget declaration.
- Scroll animations that fire on page load before the user has scrolled.
- Using opacity alone for page transitions (no spatial context for navigation direction).
- Missing `prefers-reduced-motion` — this is a WCAG 2.1 Level AA requirement (2.3.3).

## Source References

- Framer Motion Documentation — Spring physics, AnimatePresence, Layout animations
- Motion One Documentation — Web Animations API, scroll()
- GSAP Documentation — ScrollTrigger, Timeline
- Apple Human Interface Guidelines — Motion and Animation
- Material Design 3 — Motion System (Easing, Duration, Choreography)
- WCAG 2.1 SC 2.3.3 — Animation from Interactions
- WebGL Performance Best Practices — Khronos Group
- CSS Triggers — Paul Lewis (layout, paint, composite classification)

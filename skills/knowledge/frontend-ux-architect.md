# Frontend UI/UX Architecture — Knowledge Reference
#
# Version:  2.0.0
# Domain:   design / ui-ux
# Skill:    .opencode/skills/frontend-ux-architect/SKILL.md
#
# Purpose:
#   Authoritative knowledge base for designing, validating, and enforcing
#   premium, world-class UI/UX architecture — covering screen structure,
#   advanced motion systems, creative layout patterns, visual excellence
#   standards, and evidence-based interaction design.

## Principles

- **Hierarchy first**: every screen has one primary action and one primary focal point.
- **Theme-driven styling**: no hardcoded colors, spacing, or font sizes — all values reference design tokens.
- **Accessibility by design**: WCAG 2.1 AA (minimum) is a structural constraint applied at architecture time, not a post-hoc audit. Every animation must respect `prefers-reduced-motion`.
- **Component contract**: each reusable component has an explicit prop contract before implementation begins.
- **Empty states are first-class**: every data-bound view defines empty, loading, and error states.
- **Progressive disclosure**: complex UIs expose only what the current task requires.
- **Motion has purpose**: every animation communicates — state change, orientation, feedback, or delight. Decorative animation without UX purpose is waste.
- **Visual excellence is measurable**: consistency, modernity, brand alignment, and professional appearance are scored dimensions, not opinions.

## Screen Architecture

| Layer | Responsibility |
|-------|---------------|
| Layout shell | Page frame, navigation, sidebar/top-bar, footer |
| Region containers | Logical zones within the layout (content, aside, toolbar) |
| Feature panels | Self-contained UI sub-sections (FilterPanel, DataTable, DetailsDrawer) |
| Atomic components | Buttons, inputs, badges — single-responsibility UI atoms |

Each layer is independently replaceable without affecting adjacent layers.

## Navigation Architecture

- All navigation states (active, hover, disabled, loading) must be explicitly defined.
- Deep-link URLs reflect application state — no navigation via hidden state.
- Back-navigation behavior defined for every modal, drawer, and multi-step flow.
- Breadcrumb logic specified for views more than 2 levels deep.

## Responsive Design Rules

- Mobile-first layout design, adapted upward.
- Breakpoints as named tokens (sm, md, lg, xl) — never raw pixel values.
- Grid: 4/8/12 columns per breakpoint.
- No horizontal scroll at any viewport ≥ 320px.
- Fluid type sizing: `clamp()` preferred over breakpoint-based font-size overrides.

## Theme System

- Design tokens: single source of truth for color, spacing, typography, elevation, border-radius, motion.
- Three-tier hierarchy: **primitives** → **semantics** → **component tokens**.
- Dark mode: swap semantic tier only — primitives and component tiers unchanged.
- Four theme modes: light (default), dark, high-contrast (WCAG AAA 7:1), accessibility (no motion, no glass, larger targets).
- No component references a primitive token directly.

## Advanced Layout Patterns

| Pattern | Reference Products | When to Use |
|---------|-------------------|-------------|
| Bento Grid | Linear, iOS Widgets | Dashboards, feature showcases, profile pages |
| Editorial | Apple Events, magazines | Marketing pages, product stories, about sections |
| Spatial / Canvas | Figma, Miro | Creative tools, visual databases, mind-mapping |
| Command Palette | Raycast, Linear | Power-user tools, developer platforms |
| Layered Depth | macOS, iPadOS | Complex workspaces with multiple concurrent contexts |
| Immersive Full-Screen | Apple product pages, Stripe | Marketing landing, product showcases |

## Motion Principles

- **Only transform and opacity animate** — all other properties trigger layout recalculation (CPU, not GPU).
- **Duration taxonomy**: instant (50ms) → fast (120ms) → normal (250ms) → slow (400ms).
- **Spring physics preferred** over cubic-bezier for interactive elements — feels alive, not robotic.
- **Stagger cap**: ≤ 12 items — beyond this the delay is imperceptible.
- **Choreography ceiling**: total sequence ≤ 2000ms — longer and users feel blocked.
- **Accessibility first**: every animation has a `prefers-reduced-motion` fallback. No exceptions.

## Visual Excellence Standards

### Typography
- Font pairing: heading (expressive/geometric) + body (neutral/legible) + mono (technical)
- Modular scale: 1.25 Major Third or 1.333 Perfect Fourth
- Display typography: negative tracking (−0.03em to −0.05em), tight leading (0.9–1.0)
- Body typography: generous leading (1.5–1.7), comfortable measure (60–80 characters)
- Variable fonts: recommended when framework supports (Inter Variable, Geist)
- Tabular numbers: `font-feature-settings: "tnum" 1` for numeric columns

### Color Systems
- Semantic namespaces: background, text, border, interactive, status (success/warning/error/info)
- Emotional resonance: color palette tone aligned with product category
- APCA contrast for decorative; WCAG AA minimum for all informational text
- Dynamic themes: every color has dark-mode semantic equivalent

### Depth System
- 5 elevation levels: 0 (flat surface) → 4 (modal, dramatic shadow)
- Shadow style: diffuse soft shadows preferred over hard drop shadows
- Glassmorphism: floating panels, sidebars, navigation overlays (backdrop-blur + semi-transparent)
- Neumorphism: avoid — fails accessibility contrast requirements in most implementations

### Spacing
- 4px or 8px base unit — consistently applied throughout
- Geometric or Fibonacci scale for harmonious proportions

## Interaction Patterns

| Pattern | Required Specification |
|---------|----------------------|
| Form submission | Loading state, success feedback, field-level error, server error |
| Confirmation dialogs | Required for irreversible actions; cancel always accessible |
| Drag and drop | Visual affordance, drop target highlight, Escape cancel |
| Infinite scroll | Loading skeleton, end-of-list state, error/retry |
| Notifications | Duration, dismissibility, action buttons, stacking behavior |
| DataGrid | Sorting, filtering, row selection, bulk actions, empty state |

## Creative Reference Library

| Product | Design Signature |
|---------|----------------|
| Linear | Precise dark UI, smooth micro-interactions, keyboard-first |
| Raycast | Command palette, no-chrome chrome, instant feedback |
| Arc Browser | Personality-driven, custom themes, spatial sidebar |
| Stripe | Gradient meshes, 3D illustrations, storytelling homepage |
| Apple | Typography hero, scroll storytelling, product photography |
| Figma | Canvas paradigm, multiplayer UI, drag-as-primary interaction |
| Airbnb | Photography-first, emotional destination, human warmth |
| Vercel | Dark-mode-first, CLI aesthetic, performance as design principle |
| Notion | Block composition, powerful = simple, database views |
| Awwwards winners | WebGL, SVG morphing, full-page scroll takeovers |

## Accessibility Standards

- All interactive elements keyboard-navigable with visible focus indicators.
- Color not sole differentiator (red error also needs icon/label).
- All images have descriptive alt text; decorative images use alt="".
- Form fields have associated labels (not placeholder-only).
- Minimum touch target: 44×44px (iOS) / 48×48dp (Android).
- Screen reader landmark regions: main, nav, aside, header, footer.
- Focus management: modals trap focus on open; restore focus on close.
- Motion accessibility: prefers-reduced-motion covers 100% of animations.

## Anti-Patterns

- Hardcoded hex colors or pixel values in component files.
- Modals that cannot be dismissed via keyboard (Escape key).
- Forms validating on submit only (should validate on blur + submit).
- DataGrids with no loading, empty, or error state.
- Navigation that breaks browser back/forward behavior.
- Tooltips as the primary label for an interactive element.
- Animating width/height/margin/padding (use transform instead).
- WebGL on mobile without a static fallback and GPU budget.
- Stagger sequences with > 12 items.
- Total animation choreography exceeding 2000ms.
- Glassmorphism in accessibility theme (causes vestibular issues).

## Source References

- Nielsen Norman Group: 10 Usability Heuristics
- WCAG 2.1 / WCAG 2.2 — W3C Accessibility Guidelines
- APCA — Advanced Perceptual Contrast Algorithm
- Material Design 3 — Token System Architecture, Motion System
- Human Interface Guidelines — Apple
- Atomic Design Methodology — Brad Frost
- Inclusive Components — Heydon Pickering
- Framer Motion Documentation — Physics and Spring System
- Motion One Documentation — Web Animations API
- The Elements of Typographic Style — Robert Bringhurst

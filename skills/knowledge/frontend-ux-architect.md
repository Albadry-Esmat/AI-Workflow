# Frontend UI/UX Architecture
#
# Version:  1.0.0
# Domain:   design / ui-ux
# Skill:    .opencode/skills/frontend-ux-architect/SKILL.md
#
# Purpose:
#   Authoritative knowledge base for designing, validating, and enforcing
#   enterprise-grade UI/UX architecture across screens, components, and
#   interaction patterns.

## Principles

- **Hierarchy first**: every screen must have one primary action and one primary information focal point.
- **Theme-driven styling**: no hardcoded color values, spacing constants, or font sizes anywhere in component code; all values must reference design tokens.
- **Accessibility by design**: WCAG 2.1 AA compliance is not optional — it is a structural constraint applied at architecture time, not a post-hoc audit.
- **Component contract**: each reusable component has an explicit prop contract (required/optional, types, default states) before any implementation begins.
- **Empty states are first-class**: every data-bound view must have a defined empty state, loading state, and error state — not as afterthoughts.
- **Progressive disclosure**: complex UIs expose only what is needed for the current task; additional controls and information are revealed on demand.

## Screen Architecture

A well-structured screen is decomposed into:

| Layer | Responsibility |
|-------|---------------|
| Layout shell | Page frame, navigation, sidebar/top-bar, footer |
| Region containers | Logical zones within the layout (e.g. content, aside, toolbar) |
| Feature panels | Self-contained UI sub-sections (e.g. FilterPanel, DataTable, DetailsDrawer) |
| Atomic components | Buttons, inputs, badges, tooltips — single-responsibility UI atoms |

Each layer should be independently replaceable without affecting adjacent layers.

## Navigation Architecture

- All navigation states (active, hover, disabled, loading) must be explicitly defined.
- Deep-link URLs must reflect application state — no navigation via hidden state.
- Back-navigation behavior must be defined for every modal, drawer, and multi-step flow.
- Breadcrumb logic must be specified for any view more than 2 levels deep.

## Responsive Design Rules

- Layouts are designed mobile-first and adapted upward.
- Breakpoints must be defined as named tokens (e.g. `sm`, `md`, `lg`, `xl`) — never as raw pixel values.
- Grid systems use a defined column count per breakpoint (typically 4/8/12).
- No horizontal scroll on any viewport width ≥ 320px.

## Theme System

- Design tokens are the single source of truth for: color, spacing, typography, elevation, border-radius, animation duration.
- Tokens are organized in 3 tiers: **primitives** (raw values), **semantics** (role-based aliases like `color.surface.primary`), **component** (component-specific overrides).
- Dark mode is implemented by swapping the semantic tier only — primitive and component tiers remain unchanged.
- No component may reference a primitive token directly; it must go through a semantic alias.

## Interaction Patterns

| Pattern | Required Specification |
|---------|----------------------|
| Form submission | Loading state, success feedback, field-level error display, server error display |
| Confirmation dialogs | When required (irreversible actions), minimum content (action + consequence), cancel always accessible |
| Drag and drop | Visual affordance, drop target highlight, cancel on Escape |
| Infinite scroll / pagination | Loading skeleton, end-of-list state, error/retry state |
| Notifications / toasts | Duration, dismissibility, action buttons, stacking behavior |
| DataGrid | Column resizing, sorting, filtering, row selection, bulk actions, empty state |

## Accessibility Standards

- All interactive elements must be keyboard navigable and have visible focus indicators.
- Color must not be the sole differentiator of information (e.g. red/green status must also have icon or label).
- All images must have descriptive `alt` text; decorative images use `alt=""`.
- Form fields must have associated labels (not placeholder-only).
- Minimum touch target size: 44×44px.
- Screen reader landmark regions must be defined: `main`, `nav`, `aside`, `header`, `footer`.

## Component Library Governance

- All new components are evaluated against the existing library before being created. Duplication is a violation.
- Component variants (size, color, state) are defined exhaustively before implementation.
- Deprecated components carry a `@deprecated` tag with migration path; they are not deleted until all consumers are migrated.

## Anti-Patterns

- Hardcoded hex colors or pixel values in component files.
- Modals that cannot be dismissed via keyboard (Escape key) or via backdrop click.
- Forms with validation that only runs on submit (validation should run on blur + submit).
- DataGrids with no loading, empty, or error state.
- Navigation that breaks browser back/forward behavior.
- Tooltips as the primary label for an interactive element.
- Inconsistent icon usage (same action represented by different icons in different views).
- Overflow text that is truncated without tooltip to reveal the full value.

## Source References

- Nielsen Norman Group: 10 Usability Heuristics
- WCAG 2.1 — W3C Accessibility Guidelines
- Material Design 3 — Token System Architecture
- Atomic Design Methodology (Brad Frost)
- Inclusive Components (Heydon Pickering)

# UX Research Synthesis — Knowledge Reference
#
# Version:  1.0.0
# Domain:   design / ux-research
# Skill:    .opencode/skills/ux-research-synthesizer/SKILL.md
#
# Purpose:
#   Authoritative knowledge base for user flow analysis, heuristic evaluation,
#   friction pattern detection, information architecture scoring, and
#   accessibility experience auditing.

## Principles

- **Users form first impressions in 50ms**: visual hierarchy, clarity of primary action, and emotional tone must land before any interaction.
- **Miller's Law**: working memory holds 7±2 items. Navigation menus, form fields, and decision points must stay within this cognitive limit.
- **Hick's Law**: decision time increases logarithmically with the number of choices. Fewer options at each decision point reduces friction.
- **Fitts's Law**: the time to acquire a target is a function of distance and target size. Primary actions must be large and close to where the user already is.
- **The 3-Click Rule is a myth**: users don't abandon after 3 clicks — but every unnecessary step introduces an opportunity for dropout. Minimize steps, not arbitrarily to 3.
- **Emotional journey matters**: the highest-impact UX improvement is often not fixing errors but creating delight at key moments (onboarding completion, first success, milestone achievement).
- **Accessibility is part of UX, not separate from it**: a screen reader user, a keyboard-only user, and a one-handed mobile user are all valid experience paths.

## Nielsen's 10 Usability Heuristics

| ID | Heuristic | Common Violation |
|----|-----------|-----------------|
| H1 | Visibility of system status | No loading state, no progress indicator, silent failures |
| H2 | Match between system and real world | Technical jargon, icons without labels, inconsistent metaphors |
| H3 | User control and freedom | No undo, no cancel, no back navigation, destructive with no confirmation |
| H4 | Consistency and standards | Same action with different label in different locations |
| H5 | Error prevention | No validation until submit, ambiguous form field requirements |
| H6 | Recognition over recall | Requiring users to remember info from previous screen |
| H7 | Flexibility and efficiency | No keyboard shortcuts, no saved preferences, no bulk actions |
| H8 | Aesthetic and minimalist design | Competing CTAs, information overload, visual clutter |
| H9 | Help users recover from errors | Vague error messages, no suggested fix, technical error codes |
| H10 | Help and documentation | No tooltip, no inline help, no empty state guidance |

## Modern Digital Extensions (H11–H15)

| ID | Heuristic | Relevance |
|----|-----------|-----------|
| H11 | Mobile-first and touch optimization | 44px targets, swipe affordances, thumb zones |
| H12 | Progressive disclosure | Complexity staged; advanced options revealed on demand |
| H13 | Real-time feedback | Optimistic UI, instant validation, skeleton loaders |
| H14 | Trust and transparency | Data usage visible, permissions explained, pricing clear |
| H15 | Empty state quality | First-run experience guides action, not blank white void |

## Friction Pattern Library (F1–F15)

| ID | Pattern | Detection Signal |
|----|---------|-----------------|
| F1 | Dead-end screen | No primary action, no next step link |
| F2 | Orphan screen | Not in navigation_map but reachable |
| F3 | Pogo-sticking | Back navigation required > 1 time per goal step |
| F4 | Permission wall | Unrelated permission blocks required action |
| F5 | Registration gate | Sign-up required before value demonstration |
| F6 | Form overload | > 7 fields without progressive disclosure |
| F7 | Error-only validation | Validation fires only on submit |
| F8 | Ambiguous CTAs | Multiple equally-weighted primary actions |
| F9 | Hidden affordances | Key functionality hover-only (not touch-safe) |
| F10 | Breadcrumb absence | > 2 levels deep, no location indicator |
| F11 | Confirmation debt | Destructive action without confirmation dialog |
| F12 | Loading opacity | Data loading without skeleton/spinner/progress |
| F13 | Empty void | Empty states with no guidance or CTA |
| F14 | Jargon overload | Technical language without explanation |
| F15 | Scroll surprise | Content below fold, no scroll affordance |

## Information Architecture Quality Dimensions

| Dimension | Ideal | Maximum |
|-----------|-------|---------|
| Navigation depth | ≤ 3 levels from any entry | 4 levels |
| Navigation breadth per level | ≤ 7 items | 9 items |
| Orphan screen ratio | 0% | 5% |
| Goal completion in taps | ≤ 3 | 5 |
| Screen name self-explanation | All without context | — |

## Severity Classification

| Level | Label | UX Impact |
|-------|-------|-----------|
| 4 | Catastrophic | Blocks task completion; user cannot proceed |
| 3 | Major | Significant difficulty completing task; likely to abandon |
| 2 | Minor | Causes delay or confusion; user recovers with effort |
| 1 | Cosmetic | Negligible impact; irritating but not blocking |
| 0 | Not an issue | Observed but no impact |

## UX Health Score Formula

```
Base: 100
Deductions:
  Severity 4 (catastrophic): -15 per finding
  Severity 3 (major):        -8 per finding
  Severity 2 (minor):        -3 per finding
  Severity 1 (cosmetic):     -1 per finding
Minimum: 0

Score interpretation:
  90–100: Excellent — ready for production
  75–89:  Good — address major findings before launch
  60–74:  Fair — significant improvements needed
  40–59:  Poor — consider redesigning worst flows
  0–39:   Critical — fundamental architecture issues require redesign
```

## User Journey Cognitive Load Model

| Step Type | Cognitive Load | Signal |
|-----------|---------------|--------|
| Single clear action | Low | One obvious button, no competing elements |
| Choice between 2 options | Low | Binary decision with clear consequence |
| Choice between 3–5 options | Medium | Options with labels; user can scan |
| Form with 3–5 fields | Medium | Standard interaction, familiar pattern |
| Choice between > 5 options | High | Scanning required; consider progressive disclosure |
| Form with > 7 fields | High | Likely F6 friction — needs grouping |
| Ambiguous action | High | Button label unclear; user must think before clicking |

## Accessibility Experience (Beyond WCAG Technical)

| Dimension | Evaluation Method |
|-----------|-----------------|
| Screen reader journey | Trace goal using NVDA/VoiceOver mental model; check focus order, aria-live |
| Keyboard-only | Trace goal using Tab + Enter/Space + arrow keys only; check focus trap |
| Cognitive | Reading level < grade 8; no time pressure; consistent patterns; no autoplay |
| Situational | Works in bright light; thumb reachable CTA; usable on slow connection |

## Anti-Patterns

- Counting clicks instead of measuring cognitive friction (3-click rule fallacy).
- Evaluating only the happy path (error and recovery paths have the highest friction).
- Evaluating only desktop (most users are mobile; mobile has different friction patterns).
- Applying WCAG technical compliance as a proxy for accessibility experience.
- Ignoring first-run experience (empty states are the first thing new users see).
- Presenting data without context (ux_health_score without top recommendations is noise).

## Source References

- Nielsen, J. — 10 Usability Heuristics for User Interface Design (1994)
- Nielsen, J. — Severity Ratings for Usability Problems (1995)
- Miller, G.A. — The Magical Number Seven (1956)
- Fitts, P.M. — The Information Capacity of the Human Motor System (1954)
- Hick, W.E. — On the Rate of Gain of Information (1952)
- Norman, D.A. — The Design of Everyday Things (2013 Revised Edition)
- WCAG 2.1 / WCAG 2.2 — W3C Accessibility Guidelines
- Krug, S. — Don't Make Me Think (2014)
- Wroblewski, L. — Mobile First (2011)

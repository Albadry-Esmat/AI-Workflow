# Creative Experience Architecture — Knowledge Reference
#
# Version:  1.0.0
# Domain:   design / creative
# Skill:    .opencode/skills/creative-experience-architect/SKILL.md
#
# Purpose:
#   Authoritative knowledge base for world-class interface design patterns,
#   premium layout systems, story-driven experiences, immersive backgrounds,
#   and creative component enhancements. References industry-leading products.

## Principles

- **Brand differentiation is a competitive advantage**: functional parity means nothing in a saturated market. Emotional resonance and visual distinctiveness drive product choice.
- **Delight compounds**: micro-delights (a satisfying animation, a clever empty state) build product affection that converts to retention. Small creative investments have outsized NPS impact.
- **Creativity within constraints**: the best creative work respects the constraints — accessibility, performance, learnability — rather than sacrificing them for aesthetics.
- **Reference is not imitation**: study Linear, Stripe, and Apple not to copy their patterns but to understand the *why* behind their decisions. Then apply the principle in a way authentic to your product.
- **Motion is the fourth dimension of design**: time-based design is as important as color, typography, and space. A product without intentional motion feels static and unpolished.
- **Typography is the backbone**: 80% of UI is text. Typography decisions — scale, weight, tracking, leading — have more visual impact than any illustration or decoration.

## Creative Archetype Library

| Archetype | Products | Aesthetic Signature |
|-----------|----------|-------------------|
| Precision Dark | Linear, Raycast, Vercel | Dark background, generous negative space, subtle motion, keyboard-centric |
| Warm Everyday | Airbnb, Duolingo, Todoist | Light, photography-forward, warm palette, human illustration, playful micro-interactions |
| Command Experience | GitHub, Stripe Docs, Vercel | Dark or neutral, developer-centric, mono type, CLI-inspired, precision |
| Curated Luxury | Apple, Stripe checkout, Notion | Restraint, premium photography, display typography, scroll storytelling |
| Expressive Canvas | Figma, Miro, Canva | Canvas paradigm, color as expression, drag-heavy, creative energy |
| Calm Technology | Notion, Things, Bear | Minimal chrome, focus on content, distraction-free, content > UI |
| Immersive Showcase | Awwwards, CSS Awards winners | Full-page takeover, WebGL, scroll-linked motion, experimental layout |

## Layout Pattern Reference

### Bento Grid
- **Inspiration**: Linear.app dashboard, iOS Home Screen widgets
- **Structure**: 12-column grid; cells are 1×1, 2×1, 2×2, 3×1, 1×2 units
- **Rule**: cell size reflects content density — metrics get 1×1, charts get 2×2
- **Motion**: adjacent cells respond to hover with a subtle position shift
- **When**: dashboards, feature showcase pages, profile/settings hubs

### Editorial Layout
- **Inspiration**: Apple Events, Wallpaper* magazine digital
- **Structure**: no standard grid — composition driven by typographic hierarchy
- **Typography**: display at 120–160px, pull quotes at 200% body, tight leading
- **Sections**: each scroll section has a distinct visual identity (no template repetition)
- **When**: marketing pages, product landing pages, annual reports

### Command Palette UI
- **Inspiration**: Raycast, Linear (⌘K), VS Code Quick Open
- **Structure**: full-screen dimmed overlay, centered single input, instant fuzzy results
- **Navigation**: keyboard-only (arrow keys, Enter, Escape)
- **Content**: recent, shortcuts, all commands — grouped, labeled, keyboard hint visible
- **When**: developer tools, power-user apps, productivity platforms

### Immersive Full-Screen
- **Inspiration**: Apple iPhone product pages, Stripe homepage
- **Structure**: each section = 100vh; scroll = timeline through a narrative
- **Hero**: product renders or 3D objects that respond to scroll position
- **Type**: display text dissolves as you scroll; reveals layer by layer
- **When**: marketing, product launch pages, investor decks turned into web

## Premium Component Patterns

| Component | Premium Enhancement | Reference |
|-----------|--------------------|-|
| Button (primary) | Gradient fill + icon slide on hover | Stripe, Framer |
| Card | Glassmorphism + 3D tilt on hover (≤ 5deg) | Linear, Arc |
| Navigation | Glass header + spotlight indicator | Linear, Raycast |
| Input | Floating label + success check spring | Apple, Notion |
| Table row | Staggered entrance + hover action reveal | Linear, GitHub |
| Modal | Spring entrance (scale 0.95→1) + blur backdrop | macOS |
| Metric / KPI | Number roll animation (count up) | Stripe, Vercel |
| Progress bar | Shimmer animation (not static) | Linear |
| Empty state | Illustrated + contextual CTA | Airbnb, Figma |

## Typographic Excellence

| Technique | When | CSS |
|-----------|------|-----|
| Fluid scaling | All headlines | `clamp(1.5rem, 3vw + 0.75rem, 4rem)` |
| Negative tracking | Display (≥ 48px) | `letter-spacing: -0.03em to -0.05em` |
| Tight leading | Display type | `line-height: 0.9 to 1.0` |
| Tabular numbers | Data columns | `font-feature-settings: "tnum" 1` |
| Ligatures | Logo type, display | `font-feature-settings: "liga" 1, "calt" 1` |
| Variable weight split | Hero headlines | Split word into spans, different font-weight per span |
| Gradient text | Hero CTA, marketing | `background-clip: text; -webkit-text-fill-color: transparent` |

## Background System Techniques

| Technique | Performance | Mood | Accessibility |
|-----------|-------------|------|--------------|
| CSS mesh gradient (animated) | Excellent | Organic, warm | Static fallback trivial |
| SVG noise texture (animated) | Excellent | Textured, premium | Static fallback trivial |
| CSS clip-path geometry | Very good | Geometric, modern | Static fallback trivial |
| Particle system (canvas) | Good | Dynamic, tech | Auto-disable < 45fps |
| Spline 3D scene | Medium | Dramatic, premium | PNG fallback required |
| React Three Fiber scene | Medium | Programmatic 3D | PNG fallback required |
| CSS perspective tilt | Excellent | Subtle 3D, refined | Disable in reduced-motion |

## Story-Driven Interface Structure

```
Act 1 — Hook (0–5 seconds):
  Goal: demonstrate value before asking for anything
  Techniques: animated product preview, live demo, social proof headline

Act 2 — Educate (5–30 seconds):
  Goal: progressively reveal why this product matters
  Techniques: scroll-driven reveals, interactive hotspots, comparison sliders

Act 3 — Convert (30s+):
  Goal: capture at peak interest
  Techniques: social proof at the right moment, frictionless progressive auth
```

## Scoring Dimensions for Creative Proposals

| Dimension | What to Score |
|-----------|-------------|
| Impact | How significantly does this improve perceived quality? (1–5) |
| Differentiation | Does this make the product noticeably different from competitors? (1–5) |
| Feasibility | How much development effort does this require? (1=easy, 5=complex) |
| Accessibility risk | Does this create accessibility complexity? (1=low, 5=high) |

**Score formula**: (impact × differentiation) / (feasibility × accessibility_risk)

Higher scores = maximum impact with minimum cost and risk.

## Anti-Patterns

- Copying a reference product's pattern without understanding the underlying principle.
- Prioritizing visual novelty over usability (Awwwards-winning sites often have terrible UX).
- Gradient text without a plain-text screen-reader fallback.
- WebGL backgrounds on mobile without a static fallback.
- Bento grids with cells that have no relationship to content density.
- Command palette without keyboard accessibility.
- Particle systems that don't disable below 45fps (freezes low-end devices).
- Motion-rich onboarding that cannot be skipped.
- Dark mode implemented as an afterthought (designed light-only, dark added as color inversion).
- Typography as decoration (kinetic text with no content purpose).

## Source References

- Linear.app — Design principles and interaction philosophy
- Stripe.com — Gradient systems, storytelling pages, 3D illustration
- Apple.com product pages — Scroll storytelling, typography at scale
- Raycast.com — Command palette design, no-chrome philosophy
- Arc Browser (The Browser Company) — Personality-driven UI, spatial navigation
- Figma.com — Canvas paradigm, multiplayer design
- Awwwards.com — Site of the Day archive (interaction and layout innovation)
- CSS Design Awards — Premium web design reference
- Bringhurst, R. — The Elements of Typographic Style (typographic principles)
- Buxton, B. — Sketching User Experiences (design exploration methodology)
- Maeda, J. — The Laws of Simplicity (simplicity as design principle)

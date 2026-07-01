---
name: web-performance-optimizer
version: 1.0.0
domain: design
description: >
  Use when optimizing web application performance to meet Core Web Vitals thresholds or custom
  performance budgets. Triggers on: "optimize Core Web Vitals", "improve LCP/CLS/INP", "reduce
  bundle size", "fix performance regression", "rendering mode recommendation", "image optimization
  strategy". Do NOT use for backend API latency or database query tuning — use performance-guard
  or caching-strategy-designer for those concerns.
author: system
---

## Purpose

Produce a structured, prioritized performance optimization plan that resolves Core Web Vitals regressions and achieves custom budget targets for any modern web application. The skill analyzes the full performance surface: critical rendering path (LCP), layout stability (CLS), interaction responsiveness (INP), bundle composition, asset delivery, and rendering architecture. Every recommendation includes an expected impact estimate and implementation effort score (S/M/L) so engineering teams can prioritize high-ROI changes first.

The skill is framework-aware: it produces Next.js 14+ App Router–specific optimizations (PPR, React Server Components, next/image, next/font), Remix loader caching strategies, Nuxt 3 Nitro edge rendering guidance, SvelteKit streaming SSR, and Astro island architecture. For React-specific bottlenecks it applies React 18+ concurrent features (Suspense boundaries, useTransition, useDeferredValue), selective memoization (React.memo, useMemo cost/benefit analysis), and virtualization with @tanstack/react-virtual or react-window.

Bundle optimization is treated as a first-class concern: the skill produces code-splitting boundaries, dynamic import candidates, tree-shaking prerequisites, and `source-map-explorer` / `@next/bundle-analyzer` analysis directives. Every recommendation is tied to a measurable Lighthouse score or Web Vitals metric so the team can verify improvement with real measurement rather than assumption.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `framework` | `string` | Yes | Web framework: `nextjs`, `remix`, `nuxt`, `sveltekit`, `astro`, `plain_react` |
| `performance_report` | `object` | No | Lighthouse / CrUX baseline data (scores, metrics values in ms). Omit for greenfield. |
| `performance_targets` | `object` | No | Custom thresholds: `lcp_ms`, `cls`, `inp_ms`, `fcp_ms`, `ttfb_ms`. Defaults: LCP≤2500, CLS≤0.1, INP≤200 |
| `rendering_mode` | `string` | No | Current or target rendering mode: `csr`, `ssr`, `ssg`, `isr`, `ppr`. Default: infer from framework |
| `bundle_analysis` | `object` | No | Current bundle stats: `total_kb`, `first_load_kb`, `largest_chunk_kb`, `duplicates[]` |
| `image_inventory` | `array[object]` | No | List of images: `path`, `size_kb`, `format`, `above_fold` |
| `context` | `object` | No | Upstream context from architecture-design or feature-planning |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["framework"],
  "properties": {
    "framework": {
      "type": "string",
      "enum": ["nextjs", "remix", "nuxt", "sveltekit", "astro", "plain_react"]
    },
    "performance_report": {
      "type": "object",
      "properties": {
        "lcp_ms":         { "type": "number" },
        "cls":            { "type": "number" },
        "inp_ms":         { "type": "number" },
        "fcp_ms":         { "type": "number" },
        "ttfb_ms":        { "type": "number" },
        "lighthouse_score":{ "type": "integer", "minimum": 0, "maximum": 100 },
        "source":         { "type": "string", "enum": ["lighthouse", "crux", "manual"] }
      }
    },
    "performance_targets": {
      "type": "object",
      "properties": {
        "lcp_ms":  { "type": "number", "default": 2500 },
        "cls":     { "type": "number", "default": 0.1 },
        "inp_ms":  { "type": "number", "default": 200 },
        "fcp_ms":  { "type": "number", "default": 1800 },
        "ttfb_ms": { "type": "number", "default": 800 }
      }
    },
    "rendering_mode": {
      "type": "string",
      "enum": ["csr", "ssr", "ssg", "isr", "ppr"]
    },
    "bundle_analysis": {
      "type": "object",
      "properties": {
        "total_kb":         { "type": "number" },
        "first_load_kb":    { "type": "number" },
        "largest_chunk_kb": { "type": "number" },
        "duplicates":       { "type": "array", "items": { "type": "string" } }
      }
    },
    "image_inventory": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "path":        { "type": "string" },
          "size_kb":     { "type": "number" },
          "format":      { "type": "string", "enum": ["jpg", "png", "gif", "webp", "avif", "svg"] },
          "above_fold":  { "type": "boolean" }
        }
      }
    },
    "context": { "type": "object" }
  }
}
```

## Required Context

- Architecture from `architecture-design` (rendering architecture decisions).
- Deployment strategy from `deployment-strategy` (CDN capabilities, edge runtime availability).
- If Lighthouse data is unavailable, the skill operates in "greenfield prescriptive" mode using framework defaults.

## Execution Logic

```
Step 1 — Establish performance baseline and gap analysis
  If performance_report provided:
    Compute delta: performance_report[metric] vs performance_targets[metric].
    Classify: PASS (within target), AT_RISK (within 20% of threshold), FAIL (exceeds threshold).
  If not provided: assume worst-case CSR baseline for all metrics.
  Output: baseline_gap { metric, current, target, status: PASS|AT_RISK|FAIL, delta_ms }

Step 2 — LCP optimization analysis
  Identify LCP element (text, image, background) from performance_report context or infer from framework.
  Prescriptions by LCP category:
    Image LCP:
      - next/image with priority={true} for above-fold images; sizes prop for responsive srcset
      - Preload hint: <link rel="preload" as="image" href="..." fetchpriority="high">
      - AVIF/WebP conversion; avoid PNG/JPEG for hero images > 50 KB
      - Remove lazy loading from LCP candidate (loading="eager" explicitly)
    Text/Font LCP:
      - next/font (Next.js) or font-display: swap with preload link
      - Inline critical CSS for above-fold text to eliminate render-blocking stylesheets
    TTFB reducing LCP:
      - Move to SSG/ISR if content is static or semi-static
      - CDN edge caching with stale-while-revalidate for SSR responses
      - Remove render-blocking third-party scripts from <head>
  Output: lcp_recommendations [{ issue, fix, expected_lcp_gain_ms, effort: S|M|L }]

Step 3 — CLS optimization analysis
  Common CLS causes and fixes:
    Images without dimensions → always set width/height or aspect-ratio CSS
    Dynamic content insertion above fold → reserve space with min-height or skeleton loaders
    Web fonts causing FOUT/FOIT → font-display: optional | swap + preload critical fonts
    Ads/embeds without size reservation → wrap in fixed-size containers
    Animations using top/left instead of transform → migrate to transform/opacity (compositor thread)
    next/image: always provides implicit size reservation when width/height are set
  Output: cls_recommendations [{ issue, fix, expected_cls_reduction, effort: S|M|L }]

Step 4 — INP optimization analysis
  INP targets interaction processing time < 200ms (good) / < 500ms (needs improvement).
  React 18+ concurrent features:
    Long tasks > 50ms: wrap non-urgent state updates in startTransition()
    Input lag: wrap controlled input handlers in useDeferredValue for search/filter
    React Server Components: move data fetching out of client bundle entirely
    Virtualization: replace windowed lists with @tanstack/react-virtual v3 (default) or react-window
  JS execution:
    Defer non-critical third-party scripts: <Script strategy="lazyOnload"> (Next.js)
    Web Workers: move heavy computation (PDF gen, image processing) to Comlink-wrapped workers
    Break up long tasks: scheduler.postTask() or requestIdleCallback for analytics, tracking
  Output: inp_recommendations [{ issue, fix, expected_inp_gain_ms, effort: S|M|L }]

Step 5 — Bundle optimization analysis
  If bundle_analysis provided:
    Flag: first_load_kb > 200 KB (warning), > 350 KB (critical)
    Flag: largest_chunk_kb > 100 KB (candidate for split)
    Flag: duplicates[] (resolve via package deduplication: npm dedupe / yarn-deduplicate)
  Code splitting strategy:
    Route-based splits: Next.js App Router does this automatically per page segment
    Component-level: dynamic import for modals, drawers, heavy UI (> 20 KB) with Suspense fallback
    Library splits: avoid importing entire moment.js (replace with date-fns/dayjs); lodash → lodash-es
    Third-party: load analytics/chat widgets asynchronously after hydration
  Tree shaking prerequisites:
    All imports must use ES modules (import/export, not require/module.exports)
    Mark side-effect-free packages in package.json: "sideEffects": false
    Verify with: @next/bundle-analyzer or source-map-explorer npm run analyze
  Output: bundle_optimization { splits[], lazy_loads[], size_reduction_estimate_kb, dedup_candidates[] }

Step 6 — Rendering mode recommendation
  Evaluate based on content type and target metrics:
    CSR  → suitable for: authenticated dashboards, no SEO, highly dynamic; drawback: LCP penalty
    SSR  → suitable for: personalized SEO pages, always-fresh data; drawback: TTFB sensitive
    SSG  → suitable for: marketing, docs, blogs; best LCP; drawback: rebuild on content change
    ISR  → suitable for: e-commerce PDPs, news; balance freshness + LCP; Next.js revalidate
    PPR (Next.js 14+) → suitable for: hybrid pages with static shell + dynamic Suspense islands
  Decision matrix: apply performance_targets, framework capability, and content dynamism.
  Output: rendering_mode_recommendation { recommended_mode, rationale, migration_steps[], trade_offs[] }

Step 7 — Image optimization plan
  For each image in image_inventory (or prescriptive if not provided):
    above_fold images: format=avif (75% savings vs jpg), priority loading, explicit dimensions
    below_fold images: lazy loading, WebP fallback, responsive srcset
    SVG: inline for critical icons (< 1 KB), external for decorative
    next/image config: domains[], deviceSizes: [640,750,828,1080,1200], formats: ['image/avif','image/webp']
  Output: image_optimization [{ path, current_format, recommended_format, size_saving_estimate_kb, action }]

Step 8 — Font optimization strategy
  next/font (Next.js): zero layout shift, automatic self-hosting, font-display: optional for body fonts
  FontFace API: preload critical weights only (e.g., weight: 400,700 — not 100-900)
  Variable fonts: replace multiple weights with single variable font file (woff2 only)
  Subsetting: use unicode-range to load only required character sets (Latin vs CJK)
  GDPR note: self-host Google Fonts — third-party font CDN requests leak user IP to Google.
  Output: font_strategy { library, preload_fonts[], display_strategy, self_hosting_required }

Step 9 — Caching and CDN strategy
  Static assets: Cache-Control: public, max-age=31536000, immutable (content-hashed filenames)
  SSR responses: Cache-Control: s-maxage=60, stale-while-revalidate=600 (CDN edge cache)
  API routes: Cache-Control: private, no-store (authenticated) or s-maxage=300 (public)
  Edge middleware (Next.js): use for geo-routing, A/B testing at edge — avoid heavy computation
  CDN: CloudFront + S3 origin or Vercel Edge Network; Cloudflare Pages for global static
  Output: caching_strategy { static_assets, ssr_responses, api_routes, cdn_recommendation }

Step 10 — Assemble prioritized optimization plan
  Rank all recommendations by: impact_score (metric delta * user_session_share) descending.
  Group into: Quick Wins (S effort, high impact), Planned (M effort), Investment (L effort).
  Output: optimization_plan [{ issue, recommendation, expected_impact, effort, priority_rank }]
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `optimization_plan` | `array[object]` | Prioritized: `issue`, `recommendation`, `expected_impact`, `effort`, `priority_rank` |
| `bundle_optimization` | `object` | Code splits, lazy loads, `size_reduction_estimate_kb`, dedup candidates |
| `rendering_mode_recommendation` | `object` | Recommended mode, rationale, migration steps, trade-offs |
| `image_optimization` | `array[object]` | Per-image format, size saving, and action recommendations |
| `font_strategy` | `object` | Library, preload fonts, display strategy, self-hosting flag |
| `caching_strategy` | `object` | Cache-Control directives per asset type, CDN recommendation |
| `core_web_vitals_targets` | `object` | LCP/CLS/INP targets, current baseline, gap status, measurement approach |
| `metrics` | `object` | `tokens_in`, `tokens_out`, `duration_ms`, `items_produced`, `version` |
| `feedback` | `array[object]` | Backpropagate entries for upstream skills |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["optimization_plan", "bundle_optimization", "rendering_mode_recommendation",
               "caching_strategy", "core_web_vitals_targets", "metrics", "feedback"],
  "properties": {
    "optimization_plan": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["issue", "recommendation", "expected_impact", "effort", "priority_rank"],
        "properties": {
          "issue":              { "type": "string" },
          "recommendation":     { "type": "string" },
          "expected_impact":    { "type": "string" },
          "effort":             { "type": "string", "enum": ["S", "M", "L"] },
          "priority_rank":      { "type": "integer" }
        }
      }
    },
    "bundle_optimization": {
      "type": "object",
      "properties": {
        "splits":                    { "type": "array", "items": { "type": "string" } },
        "lazy_loads":                { "type": "array", "items": { "type": "string" } },
        "size_reduction_estimate_kb":{ "type": "number" },
        "dedup_candidates":          { "type": "array", "items": { "type": "string" } }
      }
    },
    "rendering_mode_recommendation": {
      "type": "object",
      "required": ["recommended_mode", "rationale"],
      "properties": {
        "recommended_mode":  { "type": "string" },
        "rationale":         { "type": "string" },
        "migration_steps":   { "type": "array", "items": { "type": "string" } },
        "trade_offs":        { "type": "array", "items": { "type": "string" } }
      }
    },
    "image_optimization": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "path":                  { "type": "string" },
          "current_format":        { "type": "string" },
          "recommended_format":    { "type": "string" },
          "size_saving_estimate_kb":{ "type": "number" },
          "action":                { "type": "string" }
        }
      }
    },
    "font_strategy": {
      "type": "object",
      "properties": {
        "library":               { "type": "string" },
        "preload_fonts":         { "type": "array" },
        "display_strategy":      { "type": "string" },
        "self_hosting_required": { "type": "boolean" }
      }
    },
    "caching_strategy": {
      "type": "object",
      "properties": {
        "static_assets":    { "type": "string" },
        "ssr_responses":    { "type": "string" },
        "api_routes":       { "type": "string" },
        "cdn_recommendation":{ "type": "string" }
      }
    },
    "core_web_vitals_targets": {
      "type": "object",
      "properties": {
        "lcp":  { "type": "object", "properties": { "current_ms": { "type": "number" }, "target_ms": { "type": "number" }, "status": { "type": "string" } } },
        "cls":  { "type": "object", "properties": { "current": { "type": "number" }, "target": { "type": "number" }, "status": { "type": "string" } } },
        "inp":  { "type": "object", "properties": { "current_ms": { "type": "number" }, "target_ms": { "type": "number" }, "status": { "type": "string" } } },
        "measurement_approach": { "type": "string" }
      }
    },
    "metrics": {
      "type": "object",
      "required": ["tokens_in", "tokens_out", "duration_ms", "items_produced", "version"],
      "properties": {
        "tokens_in": { "type": "integer" }, "tokens_out": { "type": "integer" },
        "duration_ms": { "type": "integer" }, "items_produced": { "type": "integer" },
        "version": { "type": "string" }
      }
    },
    "feedback": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["type", "from_skill", "reason"],
        "properties": {
          "type": { "type": "string", "enum": ["backpropagate", "info", "warning"] },
          "from_skill": { "type": "string" },
          "target_skill": { "type": "string" },
          "reason": { "type": "string" },
          "evidence": { "type": "object" }
        }
      }
    }
  }
}
```

## Rules & Constraints

- `optimization_plan` MUST be sorted by `priority_rank` ascending (rank 1 = highest priority).
- Every recommendation MUST map to a measurable metric (LCP, CLS, INP, bundle KB, Lighthouse score).
- `rendering_mode_recommendation` MUST include `migration_steps` if the current mode differs from recommended.
- LCP candidate images MUST be flagged if `loading="lazy"` is currently applied — this is a critical violation.
- Self-hosting of Google Fonts MUST be recommended when GDPR or CCPA privacy requirements are present in context.
- `bundle_optimization.size_reduction_estimate_kb` MUST be conservative (use 50th-percentile estimates, not best case).

## Security Considerations

- Service worker caching strategies MUST specify cache versioning to prevent stale-script attacks after deployments.
- `Cache-Control: immutable` MUST only be applied to content-hashed static assets — applying to non-hashed URLs creates security risks.
- Third-party scripts loaded via `<Script strategy="lazyOnload">` still execute in the page context — recommend CSP `script-src` allowlisting and SRI hashes.
- Avoid caching authenticated API responses at CDN edge — always use `Cache-Control: private, no-store` for personalized content.

## Token Optimization

- Skip LCP/CLS/INP analysis sections for metrics that are already PASS status in baseline.
- `image_optimization` — return only above_fold images and images > 100 KB; skip small decorative images.
- Pass `performance_report` as a flat metric object (6 fields max) — do not pass full Lighthouse JSON.

## Quality Checklist

- [ ] All failing Core Web Vitals (FAIL status) have at least one recommendation
- [ ] `optimization_plan` sorted by `priority_rank` with no duplicate ranks
- [ ] `rendering_mode_recommendation` includes migration steps when mode change is suggested
- [ ] `bundle_optimization.size_reduction_estimate_kb` is present and > 0 if bundle_analysis was provided
- [ ] No `loading="lazy"` on above-fold LCP images (flagged as critical if detected)
- [ ] `font_strategy.self_hosting_required` is true when privacy context is present
- [ ] `caching_strategy` covers all three asset types: static, SSR, API

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| `performance_report` absent | Operate in prescriptive mode using framework worst-case defaults; note assumption in feedback |
| Framework not in supported list | Emit `feedback.backpropagate`, request framework clarification |
| LCP element cannot be identified | Provide general critical-path rendering checklist; flag for manual Lighthouse audit |
| `rendering_mode: ppr` requested for non-Next.js framework | Recommend equivalent: Nuxt streaming SSR or SvelteKit streaming; note PPR is Next.js 14+ only |
| `bundle_analysis` shows > 500 KB first load | Escalate to `feedback.warning` with critical bundle budget breach; recommend immediate audit |

## 12. Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Behavior |
|------|---------|---------|----------|
| Rendering mode change approval | `rendering_mode_recommendation.recommended_mode` differs from current mode | 3600s | Present trade-off analysis and migration steps; require sign-off before code-generator scaffolds rendering changes |

## 13. Skill Composition

```yaml
composes:
  - skill: web-performance-optimizer
    version: "^1.0.0"
    input_map:
      framework:          "session.framework"
      performance_report: "session.lighthouse_baseline"
      bundle_analysis:    "state.bundle_stats"
      context:            "system_architecture"
    output_map:
      optimization_plan:               "state.perf_optimization_plan"
      rendering_mode_recommendation:   "state.rendering_mode"
      core_web_vitals_targets:         "state.cwv_targets"
```

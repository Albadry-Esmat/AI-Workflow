---
name: seo-optimizer
version: 1.0.0
domain: quality
description: 'Use when generating SEO artifacts or enforcing web performance standards for any website or web application. Triggers on: "optimize for SEO", "generate sitemap", "add structured data", "set up Open Graph", "Core Web Vitals budget", "robots.txt", "meta tags", "SEO audit", "search engine optimization".'
author: system
---

## Purpose

Generate the full set of SEO and web performance artifacts required for any public-facing website. This skill produces sitemap XML, robots.txt, JSON-LD structured data schemas, Open Graph and Twitter Card meta tag specifications, canonical URL rules, and Core Web Vitals (CWV) performance budgets. It enforces that every page in the screen inventory has defined meta coverage before the deployment phase. This is the only skill in the system with authority over search-engine-facing metadata contracts — no other skill may produce sitemap or structured data output.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `screens` | `array[object]` | Yes | Screen inventory from `frontend-ux-architect` (name, route, layout_type, requirements_covered) |
| `requirements` | `array[object]` | Yes | Validated requirements from `requirement-analyzer` (id, type, statement) — used to derive page intent and structured data type |
| `site_config` | `object` | Yes | Base URL, site name, default locale, canonical strategy |
| `structured_data_types` | `array[string]` | No | Explicit JSON-LD schema types to generate (e.g. `["WebSite", "Product", "BreadcrumbList"]`) |
| `performance_budget` | `object` | No | Override CWV thresholds (LCP, FID/INP, CLS — defaults: LCP ≤ 2.5s, CLS ≤ 0.1, INP ≤ 200ms) |
| `crawl_rules` | `array[object]` | No | Explicit allow/disallow rules for robots.txt (defaults: allow all, disallow /admin) |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["screens", "requirements", "site_config"],
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
          "layout_type": { "type": "string" }
        }
      }
    },
    "requirements": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": ["id", "type", "statement"],
        "properties": {
          "id":        { "type": "string" },
          "type":      { "type": "string" },
          "statement": { "type": "string" }
        }
      }
    },
    "site_config": {
      "type": "object",
      "required": ["base_url", "site_name"],
      "properties": {
        "base_url":           { "type": "string", "format": "uri" },
        "site_name":          { "type": "string" },
        "default_locale":     { "type": "string" },
        "canonical_strategy": { "type": "string", "enum": ["trailing-slash", "no-trailing-slash", "lowercase"] }
      }
    },
    "structured_data_types": {
      "type": "array",
      "items": { "type": "string" }
    },
    "performance_budget": {
      "type": "object",
      "properties": {
        "lcp_ms":  { "type": "integer" },
        "cls":     { "type": "number" },
        "inp_ms":  { "type": "integer" },
        "fcp_ms":  { "type": "integer" },
        "ttfb_ms": { "type": "integer" }
      }
    },
    "crawl_rules": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["path", "rule"],
        "properties": {
          "path": { "type": "string" },
          "rule": { "type": "string", "enum": ["allow", "disallow"] }
        }
      }
    }
  }
}
```

## Required Context

- `screens` from `frontend-ux-architect` (SKL-031) — the screen inventory defines every routable page; SEO coverage is measured per route.
- `requirements` from `requirement-analyzer` (SKL-001) — page intent drives structured data type selection (e.g. a product requirement → `Product` schema; a blog requirement → `Article` schema).
- `site_config.base_url` is required for all absolute URL generation in sitemap and canonical tags.

## Execution Logic

```
Step 1 — Classify pages by SEO intent
  For each screen in the inventory:
    Derive SEO page type: landing, listing, detail, form, auth, utility, error.
    Auth and utility pages: mark as noindex.
    Landing, listing, detail pages: mark as indexable.
  Output: page classification map with index status per route

Step 2 — Generate sitemap.xml
  Include all indexable routes with:
    <loc>: absolute URL using site_config.base_url + route
    <changefreq>: derived from layout_type (landing→monthly, listing→weekly, detail→daily)
    <priority>: derived from page type (home→1.0, landing→0.8, listing→0.7, detail→0.6)
  Exclude: noindex pages, error pages, auth pages.
  Output: sitemap.xml spec (structure + entry count)

Step 3 — Generate robots.txt
  Default: User-agent: * / Allow: /
  Apply crawl_rules overrides.
  Always disallow: /api/, /_next/, /admin/ (unless explicitly overridden).
  Always include: Sitemap: {base_url}/sitemap.xml
  Output: robots.txt spec

Step 4 — Generate meta tag specifications
  For each indexable page:
    title: derived from screen name + site name (max 60 chars)
    description: derived from covered requirements summary (max 160 chars)
    canonical: absolute URL with canonical_strategy applied
    robots: index/follow or noindex/nofollow
  Output: meta_tag_specs array — one entry per route

Step 5 — Generate Open Graph + Twitter Card specs
  For each indexable page:
    og:title, og:description (same as meta), og:url (canonical)
    og:type: website (landing/listing) or article (detail)
    og:image: placeholder reference — must be resolved by code-generator
    twitter:card: summary_large_image
    twitter:title, twitter:description
  Output: og_specs array — one entry per route

Step 6 — Generate JSON-LD structured data schemas
  Map structured_data_types (or auto-derive from requirements) to schema.org types.
  Emit one JSON-LD template per applicable page type:
    WebSite: home page only — includes SearchAction if search is a requirement
    BreadcrumbList: all listing and detail pages
    WebPage: all remaining indexable pages
    Product / Article / FAQPage: derived from requirements when applicable
  Output: structured_data array — one schema template per route + type pair

Step 7 — Define Core Web Vitals budget
  Apply performance_budget overrides or use defaults:
    LCP ≤ 2500ms, CLS ≤ 0.1, INP ≤ 200ms, FCP ≤ 1800ms, TTFB ≤ 800ms
  Map each budget threshold to a measurable implementation constraint:
    LCP → image preloading rule, critical CSS inlining rule
    CLS → reserved image dimensions rule, font-display: swap rule
    INP → event handler debounce rule, no layout-blocking scripts rule
  Output: cwv_budget with thresholds and corresponding implementation constraints

Step 8 — Validate coverage and produce compliance report
  Verify: every indexable route has meta tags, OG tags, canonical, and at least one JSON-LD schema.
  Flag any route without full coverage as a violation.
  Output: seo_compliance_report with coverage percentage and gap list
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `sitemap` | `object` | Sitemap spec (entry_count, indexable_routes, excluded_routes, format) |
| `robots_txt` | `object` | Robots.txt spec (allow_rules, disallow_rules, sitemap_url) |
| `meta_tag_specs` | `array[object]` | Per-route meta tag definitions (route, title, description, canonical, robots) |
| `og_specs` | `array[object]` | Per-route Open Graph + Twitter Card specs (route, og_title, og_type, og_image_ref) |
| `structured_data` | `array[object]` | JSON-LD schema templates per route (route, schema_type, template) |
| `cwv_budget` | `object` | Core Web Vitals thresholds with implementation constraints (lcp, cls, inp, fcp, ttfb) |
| `seo_compliance_report` | `object` | Coverage percentage, gap list, violations |
| `metadata` | `object` | indexable_page_count, noindex_page_count, schema_count, version |
| `metrics` | `object` | tokens_in, tokens_out, duration_ms, items_produced, version |
| `feedback` | `array[object]` | Backpropagate to frontend-ux-architect if route structure is ambiguous |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["sitemap", "robots_txt", "meta_tag_specs", "og_specs", "structured_data", "cwv_budget", "seo_compliance_report", "metadata", "metrics", "feedback"],
  "properties": {
    "sitemap": {
      "type": "object",
      "required": ["entry_count", "indexable_routes"],
      "properties": {
        "entry_count":       { "type": "integer" },
        "indexable_routes":  { "type": "array", "items": { "type": "string" } },
        "excluded_routes":   { "type": "array", "items": { "type": "string" } },
        "format":            { "type": "string", "enum": ["xml", "txt"] }
      }
    },
    "robots_txt": {
      "type": "object",
      "required": ["sitemap_url"],
      "properties": {
        "allow_rules":    { "type": "array", "items": { "type": "string" } },
        "disallow_rules": { "type": "array", "items": { "type": "string" } },
        "sitemap_url":    { "type": "string" }
      }
    },
    "meta_tag_specs": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["route", "title", "description", "canonical"],
        "properties": {
          "route":       { "type": "string" },
          "title":       { "type": "string", "maxLength": 60 },
          "description": { "type": "string", "maxLength": 160 },
          "canonical":   { "type": "string" },
          "robots":      { "type": "string" }
        }
      }
    },
    "og_specs": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["route", "og_title", "og_type"],
        "properties": {
          "route":         { "type": "string" },
          "og_title":      { "type": "string" },
          "og_description":{ "type": "string" },
          "og_type":       { "type": "string", "enum": ["website", "article", "product"] },
          "og_image_ref":  { "type": "string" },
          "twitter_card":  { "type": "string" }
        }
      }
    },
    "structured_data": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["route", "schema_type", "template"],
        "properties": {
          "route":       { "type": "string" },
          "schema_type": { "type": "string" },
          "template":    { "type": "object" }
        }
      }
    },
    "cwv_budget": {
      "type": "object",
      "required": ["lcp_ms", "cls", "inp_ms"],
      "properties": {
        "lcp_ms":                   { "type": "integer" },
        "cls":                      { "type": "number" },
        "inp_ms":                   { "type": "integer" },
        "fcp_ms":                   { "type": "integer" },
        "ttfb_ms":                  { "type": "integer" },
        "implementation_constraints": { "type": "array", "items": { "type": "string" } }
      }
    },
    "seo_compliance_report": {
      "type": "object",
      "required": ["coverage_percentage", "violations"],
      "properties": {
        "coverage_percentage": { "type": "number", "minimum": 0, "maximum": 100 },
        "gaps":                { "type": "array", "items": { "type": "string" } },
        "violations":          { "type": "array", "items": { "type": "object" } }
      }
    },
    "metadata": {
      "type": "object",
      "properties": {
        "indexable_page_count": { "type": "integer" },
        "noindex_page_count":   { "type": "integer" },
        "schema_count":         { "type": "integer" },
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

- Every indexable route MUST have a title (≤ 60 chars), description (≤ 160 chars), canonical URL, and at least one JSON-LD schema — missing any of these is a `critical` violation.
- Auth routes (`/login`, `/register`, `/reset-password` and similar) MUST be `noindex` — this is non-negotiable.
- API routes (`/api/*`) MUST be disallowed in robots.txt — never indexable.
- Duplicate canonical URLs across two different routes are a `critical` violation.
- CWV budget thresholds may be relaxed via `performance_budget` input but must not exceed Google's "poor" thresholds (LCP > 4s, CLS > 0.25, INP > 500ms) — if they do, a `critical` violation is raised.
- `og:image` references must point to a placeholder token, not a hardcoded URL — the actual image path is resolved by `code-generator`.

## Security Considerations

- `robots.txt` must never expose the existence of admin, internal, or API endpoints beyond what is already publicly known. Default disallow rules cover `/admin/` and `/api/`.
- JSON-LD structured data templates must not include user-generated content directly — only static schema fields. Dynamic values (product names, prices) are injected at runtime, not at spec generation time.
- `site_config.base_url` must be a verified production domain — the skill validates that it is not a localhost, staging, or IP address URL and raises a `major` violation if it is.

## Token Optimization

- For large screen inventories (> 30 routes), group by layout_type and process in batches; summarize per group in meta_tag_specs rather than expanding every route.
- Structured data templates are emitted as schema skeletons (type + required fields only) — full property expansion is done by `code-generator` at implementation time.
- `requirements` is compressed to id + statement only during classification (step 1); full objects not needed after that.

## Quality Checklist

- [ ] All indexable routes have complete meta tag coverage (title, description, canonical)
- [ ] All indexable routes have OG + Twitter Card specs
- [ ] Every indexable route has at least one JSON-LD schema
- [ ] Auth and API routes are noindex/disallowed
- [ ] `seo_compliance_report.coverage_percentage` is 100 or all gaps have remediation
- [ ] CWV budget thresholds are within Google's "good" ranges
- [ ] No duplicate canonical URLs

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| `site_config.base_url` is localhost or staging | Raise `major` violation; continue with placeholder `https://example.com` in output |
| Screen inventory has 0 indexable routes | Return error: `{"error": "NO_INDEXABLE_ROUTES", "hint": "Check that screens include non-auth, non-utility pages"}` |
| `structured_data_types` contains unknown schema.org type | Skip unknown type, log as `warning`, continue with auto-derived types |
| Title derivation exceeds 60 chars | Truncate at last word before limit, append "…", log as `minor` violation |
| CWV budget override exceeds "poor" threshold | Raise `critical` violation; revert to default thresholds |

## Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Behavior |
|------|---------|---------|----------|
| SEO strategy review | When `seo_compliance_report.coverage_percentage` < 100 or any `critical` violation exists | 3600s | Present gap list and violations for stakeholder sign-off before deployment |

## Skill Composition

`seo-optimizer` runs after `code-generator` and before `deployment-strategy` in any website pipeline:

```yaml
composes:
  - skill: seo-optimizer
    version: "^1.0.0"
    input_map:
      screens:     "ux_architecture.screens"
      requirements: "validated_requirements"
      site_config: "deployment_config.site_config"
    output_map:
      sitemap:      "seo.sitemap"
      meta_tag_specs: "seo.meta_tag_specs"
      cwv_budget:   "seo.cwv_budget"
```

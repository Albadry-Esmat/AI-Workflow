---
name: localization-architect
version: 1.0.0
domain: design
description: >
  Use when designing internationalization (i18n) and localization (l10n) architectures for software
  products. Triggers on: "i18n architecture", "localization strategy", "RTL support design",
  "ICU message format", "translation pipeline", "multi-locale setup", "Crowdin/Lokalise
  integration". Do NOT use for single-locale products with no plans for language expansion, or for
  backend-only locale formatting without a UI layer.
author: system
---

## Purpose

Design a complete internationalization and localization architecture that makes a software product linguistically and culturally adaptable to any target locale without requiring code changes for each new language. The skill addresses the full i18n surface: framework and library selection, locale file structure and key naming conventions, ICU message format for plurals and gender-aware strings (using CLDR plural rules covering 200+ languages), number/date/currency formatting via the Intl API, and a translation pipeline integrating with professional TMS platforms (Crowdin, Lokalise, Phrase).

RTL (right-to-left) and bidirectional text support is treated as a distinct architectural challenge rather than a post-launch patch. The skill designs the CSS logical properties migration strategy, RTL-aware component variants, and bidirectional text rendering (Unicode Bidirectional Algorithm). For CJK locales (Chinese, Japanese, Korean), the skill addresses character encoding, font loading, line-breaking rules, and character width considerations that affect layout.

The translation pipeline design covers the full lifecycle: string extraction from source code, submission to TMS, translation memory (TM) leverage, machine translation (MT) bootstrapping with post-editing (DeepL API, Google Cloud Translation), QA validation (ICU format check, placeholder validation, string-length limits), and continuous deployment of locale files without application redeployment. A pseudo-localization configuration is produced so engineers can test i18n completeness before any real translations are available.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `target_locales` | `array[string]` | Yes | BCP-47 locale tags to support (e.g., `["en-US", "ar-SA", "zh-CN", "ja-JP", "de-DE"]`) |
| `framework` | `string` | Yes | UI framework: `react`, `vue`, `angular`, `flutter`, `ios`, `android`, `nodejs` |
| `content_volume` | `string` | No | Approximate translation volume: `small` (<500 keys), `medium` (500-5000), `large` (5000-50000), `enterprise` (>50000). Default: `medium` |
| `translation_platform` | `string` | No | TMS platform: `crowdin`, `lokalise`, `phrase`, `custom`. Default: `custom` |
| `rtl_support` | `boolean` | No | Whether RTL locales (Arabic, Hebrew, Persian) must be supported. Default: auto-detect from `target_locales` |
| `icu_plurals_required` | `boolean` | No | Whether ICU message format is required for plural/gender rules. Default: `true` |
| `existing_i18n_setup` | `object` | No | Current i18n library and file structure if migrating |
| `context` | `object` | No | Upstream context from architecture-design or design-system-generator |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["target_locales", "framework"],
  "properties": {
    "target_locales": {
      "type": "array",
      "minItems": 1,
      "items": { "type": "string", "pattern": "^[a-z]{2,3}(-[A-Z]{2,4})?$" }
    },
    "framework": {
      "type": "string",
      "enum": ["react", "vue", "angular", "flutter", "ios", "android", "nodejs"]
    },
    "content_volume": {
      "type": "string",
      "enum": ["small", "medium", "large", "enterprise"],
      "default": "medium"
    },
    "translation_platform": {
      "type": "string",
      "enum": ["crowdin", "lokalise", "phrase", "custom"],
      "default": "custom"
    },
    "rtl_support": { "type": "boolean" },
    "icu_plurals_required": { "type": "boolean", "default": true },
    "existing_i18n_setup": {
      "type": "object",
      "properties": {
        "library":         { "type": "string" },
        "file_structure":  { "type": "string" }
      }
    },
    "context": { "type": "object" }
  }
}
```

## Required Context

- Target locale list (provided directly via `target_locales`).
- Design system from `design-system-generator` if available (typography tokens affect font and RTL decisions).
- Architecture modules from `architecture-design` (identifies locale-aware API layers, backend number/date formatting).
- Feature plan for content volume estimation if `content_volume` is not specified.

## Execution Logic

```
Step 1 — Locale analysis and RTL detection
  Parse each target_locale for:
    Script: Latin, Arabic, Hebrew, Persian → RTL; CJK → requires special typography
    CLDR plural category count: e.g., Arabic has 6 plural forms; Russian has 3; English has 2
    Number format: grouping separator, decimal separator, numeral system (Arabic-Indic numerals)
    Date format: ISO 8601 vs local conventions; calendar system (Gregorian, Hijri, Japanese)
    Currency: ISO 4217 code, symbol placement (prefix/suffix), fraction digits
  Auto-detect rtl_support: if any locale has rtl script → set rtl_support: true.
  Output: locale_analysis [{ locale, script, plural_categories, is_rtl, numeral_system, calendar }]

Step 2 — Select i18n library
  Apply selection matrix:
    react:
      Best: react-i18next v14 (with i18next ≥23, ICU support via i18next-icu plugin)
      Alt:  FormatJS / react-intl v6 (native ICU, robust Intl.MessageFormat)
      Large/enterprise: react-i18next with backend plugin (i18next-http-backend for on-demand loading)
    vue:
      Best: vue-i18n v9 (Composition API, ICU support via @intlify/vue-i18n-bridge)
    angular:
      Best: Angular built-in i18n (@angular/localize) for compile-time extraction
      Alt:  ngx-translate v15 for runtime switching without build pipeline
    flutter:
      Best: flutter_localizations + intl v0.18 (official; ARB file format)
      Alt:  easy_localization for JSON-based approach
    ios:
      Built-in: NSLocalizedString + .strings / .stringsdict files
      Modern: Swift String Catalog (.xcstrings) introduced in Xcode 15
    android:
      Built-in: strings.xml resources + CLDR plural rules in <plurals> tags
      Compose: stringResource() + pluralStringResource()
    nodejs:
      Best: i18next v23 with i18next-fs-backend
      Alt:  Lingui v4 (type-safe, compile-time extraction)
  Output: library_recommendation { library, version, plugins[], rationale, icu_supported }

Step 3 — Design locale file structure and key naming
  Directory structure:
    react/vue/node: /locales/{locale}/{namespace}.json  (e.g., /locales/en-US/common.json)
    angular: /src/locale/messages.{locale}.xlf (built-in) or /src/assets/i18n/{locale}.json (ngx-translate)
    flutter: /lib/l10n/app_{locale}.arb
    ios: /{locale}.lproj/Localizable.strings
    android: /res/values-{lang}-r{region}/strings.xml
  Key naming conventions:
    Hierarchical dot notation: "checkout.payment.submit_button"
    Namespace prefix for large apps: "common", "auth", "checkout", "product"
    No generic keys: "button" is banned → "checkout.submit_order_button"
    Context suffixes for disambiguation: "order.status_label", "order.status_badge"
    Plural keys: use ICU format inline (react-i18next) or separate key variants (angular .xlf)
  Output: locale_file_structure { directory_layout, key_naming_conventions, namespaces[] }

Step 4 — ICU message format patterns
  Design ICU pattern catalog for required plural and gender use cases:
    Simple plural (English, 2 categories):
      "{count, plural, one {# item} other {# items}}"
    Complex plural (Arabic, 6 categories):
      "{count, plural, zero {...} one {...} two {...} few {...} many {...} other {...}}"
    Select (gender):
      "{gender, select, male {He sent} female {She sent} other {They sent}}"
    Nested plural + select:
      "{gender, select, male {He has {count, plural, one {# message} other {# messages}}}
                         female {She has {count, plural, one {# message} other {# messages}}}
                         other {They have {count, plural, one {# message} other {# messages}}}}"
    Ordinals (1st, 2nd, 3rd):
      "{rank, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}"
    Date/time (use Intl.DateTimeFormat, not ICU for web):
      React/Vue/Angular: new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(date)
  Output: icu_patterns [{ pattern_type, example, plural_rule_source, locales_requiring_complex_rules[] }]

Step 5 — RTL and bidirectional layout strategy (if rtl_support: true)
  CSS logical properties migration:
    Replace: margin-left → margin-inline-start
    Replace: padding-right → padding-inline-end
    Replace: border-left → border-inline-start
    Replace: text-align: left → text-align: start
    Replace: float: left → float: inline-start (or use flexbox/grid instead)
    Replace: position left/right with inset-inline-start/end
  HTML dir attribute: set <html dir="rtl"> dynamically on locale change; avoid per-element dir.
  Icon mirroring: directional icons (arrows, checkmarks) must be mirrored in RTL;
    non-directional icons (zoom, save) must NOT be mirrored.
    CSS: [dir="rtl"] .icon-directional { transform: scaleX(-1); }
  Font stacks for Arabic/Hebrew: include system Arabic font (system-ui, Segoe UI Arabic)
    before Latin fallback; Arabic fonts require larger base font-size (16px → 18px).
  Component adjustments: flex row direction, progress bars, sliders, pagination.
  Output: rtl_strategy { css_migration_steps[], html_dir_strategy, icon_mirroring_rules, font_adjustments }

Step 6 — Number, date, and currency formatting strategy
  Use Intl API exclusively — never manual format strings:
    Number:   new Intl.NumberFormat(locale, { style: 'decimal', maximumFractionDigits: 2 }).format(n)
    Currency: new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' }).format(amount)
    Date:     new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
    Relative: new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(-1, 'day')
  Backend formatting (nodejs): same Intl API — Node.js 21+ includes full ICU data.
    Older Node.js: install full-icu npm package or build with --with-intl=full-icu.
  Flutter: intl package DateFormat, NumberFormat with locale-specific patterns from CLDR.
  Output: number_date_currency_strategy { api, examples[], backend_icu_config }

Step 7 — Locale detection strategy
  Priority order: User explicit preference → URL path parameter → Accept-Language header → Default
    URL-based (recommended for SEO): /{locale}/path (e.g., /en-US/products, /ar-SA/products)
    Subdomain-based: ar.example.com (alternative, requires DNS setup)
    Cookie/localStorage: for user preference persistence (supplement, not primary)
    Accept-Language: fallback for initial visit, parse with @formatjs/intl-localematcher
  Negotiation: match against supported locales with quality values (q=0.9); fall back to language
    without region (ar-SA → ar); then fall back to default locale.
  Framework integration:
    Next.js: i18n routing in next.config.js or App Router middleware
    Remix: locale loader pattern with cookie + Accept-Language parsing
    Angular: APP_INITIALIZER locale detection + LOCALE_ID token
  Output: locale_detection_strategy { priority_order, url_strategy, negotiation_algorithm, framework_config }

Step 8 — Translation pipeline design
  CI/CD integration:
    String extraction: i18next-parser (react/vue) | ng extract-i18n (angular) | arb-utils (flutter)
    Source locale push: translation_platform CLI → push source strings to TMS on merge to main
    Translation pull: TMS webhook → CI job pulls translated files → auto PR to locale/ directory
    Validation: i18n-ally VS Code extension for developer feedback; lingui compile for compile-time errors
  TMS-specific configurations:
    Crowdin: crowdin.yml config, source_files, translations paths, preserve_hierarchy: true
    Lokalise: lokalise.yml, file_format: json, use_automations: true
    Phrase: .phrase.yml, push/pull with --locale-code option
  Machine translation bootstrapping:
    Auto-translate new strings via TMS MT engine (DeepL/Google) → flag as "needs review"
    Translation memory (TM): leverage > 100% TM matches; enforce no-translate on TM_EXACT
  QA validation pipeline:
    ICU format validation: @formatjs/cli compile --ast (fails on malformed ICU)
    Placeholder consistency: source has {name} → translation must have {name} (not {Name})
    String length: define max character count per key (display area constraints)
    Pseudo-localization test: run before any real translation to catch hardcoded strings
  Output: translation_pipeline { extraction_cmd, push_config, pull_config, mt_strategy, qa_steps[] }

Step 9 — Pseudo-localization configuration
  Pseudo-localization transforms source strings to detect hardcoded text and layout issues:
    Method: wrap with [!!! ... !!!] prefix/suffix + expand each character (ASCII → extended Latin)
    Example: "Submit" → "[!!!Šûƀmïţ!!!]" (3x longer to test layout overflow)
    Tool: pseudo-localization npm package or i18next-pseudo-localization plugin
    Test scope: all UI components should render without truncation or overflow
    CJK simulation: use CJK characters to test font loading and line-breaking
  Output: pseudo_localization_config { tool, transformation_rules, test_procedure }

Step 10 — Implementation checklist
  Produce ordered implementation checklist:
    [ ] Install i18n library and configure ICU plugin
    [ ] Set up locale file directory structure and initial key namespaces
    [ ] Configure locale detection (URL routing + Accept-Language fallback)
    [ ] Configure TMS platform (crowdin.yml / lokalise.yml)
    [ ] Set up string extraction CI step
    [ ] Implement RTL CSS logical properties (if rtl_support)
    [ ] Enable pseudo-localization in development mode
    [ ] Configure Intl API formatting utilities
    [ ] Write i18n integration tests (locale switching, plural rendering, RTL layout)
  Output: implementation_checklist [{ step, description, tooling, effort: S|M|L }]
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `i18n_architecture` | `object` | Library, file structure, namespace strategy, detection config |
| `locale_file_structure` | `object` | Directory layout, key naming conventions, namespace list |
| `icu_patterns` | `array[object]` | Pattern type, ICU example, plural rule source, complex-rule locales |
| `rtl_strategy` | `object` | CSS logical properties migration, icon mirroring, font adjustments (null if no RTL) |
| `number_date_currency_strategy` | `object` | Intl API patterns, backend ICU config, examples |
| `translation_pipeline` | `object` | Extraction command, TMS config, MT strategy, QA steps |
| `locale_detection_strategy` | `object` | Detection priority order, URL strategy, negotiation algorithm |
| `pseudo_localization_config` | `object` | Tool, transformation rules, test procedure |
| `implementation_checklist` | `array[object]` | Ordered implementation steps with tooling and effort |
| `metrics` | `object` | `tokens_in`, `tokens_out`, `duration_ms`, `items_produced`, `version` |
| `feedback` | `array[object]` | Backpropagate entries for upstream skills |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["i18n_architecture", "locale_file_structure", "icu_patterns",
               "translation_pipeline", "locale_detection_strategy",
               "pseudo_localization_config", "implementation_checklist", "metrics", "feedback"],
  "properties": {
    "i18n_architecture": {
      "type": "object",
      "required": ["library", "file_structure", "namespace_strategy"],
      "properties": {
        "library":            { "type": "string" },
        "version":            { "type": "string" },
        "file_structure":     { "type": "string" },
        "namespace_strategy": { "type": "string" },
        "icu_supported":      { "type": "boolean" }
      }
    },
    "locale_file_structure": {
      "type": "object",
      "properties": {
        "directory_layout":       { "type": "string" },
        "key_naming_conventions": { "type": "array", "items": { "type": "string" } },
        "namespaces":             { "type": "array", "items": { "type": "string" } }
      }
    },
    "icu_patterns": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["pattern_type", "example"],
        "properties": {
          "pattern_type":                  { "type": "string" },
          "example":                       { "type": "string" },
          "plural_rule_source":            { "type": "string" },
          "locales_requiring_complex_rules":{ "type": "array", "items": { "type": "string" } }
        }
      }
    },
    "rtl_strategy":                 { "type": ["object", "null"] },
    "number_date_currency_strategy":{ "type": "object" },
    "translation_pipeline": {
      "type": "object",
      "properties": {
        "extraction_cmd": { "type": "string" },
        "push_config":    { "type": "object" },
        "pull_config":    { "type": "object" },
        "mt_strategy":    { "type": "string" },
        "qa_steps":       { "type": "array", "items": { "type": "string" } }
      }
    },
    "locale_detection_strategy": { "type": "object" },
    "pseudo_localization_config": { "type": "object" },
    "implementation_checklist": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "step":        { "type": "string" },
          "description": { "type": "string" },
          "tooling":     { "type": "string" },
          "effort":      { "type": "string", "enum": ["S", "M", "L"] }
        }
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
          "from_skill": { "type": "string" }, "target_skill": { "type": "string" },
          "reason": { "type": "string" }, "evidence": { "type": "object" }
        }
      }
    }
  }
}
```

## Rules & Constraints

- `target_locales` MUST use BCP-47 format (e.g., `en-US`, not `en_US` or `english`). Reject non-conforming tags.
- RTL support MUST be auto-detected if `target_locales` contains any of: `ar`, `ar-*`, `he`, `he-*`, `fa`, `fa-*`, `ur`, `ur-*`.
- ICU plural rules MUST reference CLDR plural category source — never invent custom plural rules.
- Generic translation key names (`button`, `title`, `text`) are flagged as anti-patterns in the checklist.
- Locale files MUST NOT be generated at runtime from API responses — they must be static assets served from CDN.
- Google Fonts loaded via third-party CDN MUST be flagged for GDPR compliance when EU locales (`de-*`, `fr-*`, `it-*`, etc.) are in `target_locales`; self-hosting must be recommended.

## Security Considerations

- Translation strings MUST be sanitized before rendering — user-supplied locale data could inject HTML/JS via `dangerouslySetInnerHTML` equivalents in i18n libraries. Use plain text rendering by default.
- TMS platform API keys (Crowdin token, Lokalise API key) MUST be stored in CI secrets — never in `crowdin.yml` or `lokalise.yml` committed to the repo.
- RTL dir attribute injection: set `dir` on `<html>` element server-side to prevent layout flash and avoid client-side XSS via `dir` attribute manipulation.

## Token Optimization

- Skip RTL strategy generation when none of the `target_locales` have RTL scripts (auto-detected in Step 1).
- Compress `locale_analysis` output to locale + plural_category_count + is_rtl only; omit calendar details unless explicitly needed.
- For `content_volume: small`, abbreviate `translation_pipeline` to essential extraction + TMS push/pull steps only.

## Quality Checklist

- [ ] All `target_locales` are valid BCP-47 tags
- [ ] RTL auto-detection triggers for Arabic/Hebrew/Persian/Urdu locales
- [ ] ICU patterns cover all plural categories required by the most complex locale in `target_locales`
- [ ] `translation_pipeline.qa_steps` includes ICU format validation
- [ ] `pseudo_localization_config` is present and includes string expansion rule
- [ ] GDPR self-hosting recommendation present when EU locales detected and external fonts in use
- [ ] `implementation_checklist` is ordered (detection → setup → extraction → pipeline → testing)
- [ ] Generic key name anti-pattern check is in `implementation_checklist`

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| Non-BCP-47 locale tag in `target_locales` | Reject entry, emit `feedback.warning` with correct format |
| Framework has no ICU support and `icu_plurals_required: true` | Recommend plugin (i18next-icu); emit `feedback.warning` if no plugin available |
| `target_locales` includes Arabic but `rtl_support: false` | Override to `true`, emit `feedback.info` explaining auto-detection |
| `translation_platform: custom` with `content_volume: enterprise` | Emit `feedback.warning` recommending Crowdin or Lokalise for scale |
| `existing_i18n_setup` library conflicts with recommended library | Produce migration guide with coexistence period; emit `feedback.info` |

## 12. Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Behavior |
|------|---------|---------|----------|
| RTL architecture review | `rtl_support: true` and > 2 RTL locales detected | 3600s | Present RTL CSS migration checklist and component adjustment list for design team review |

## 13. Skill Composition

```yaml
composes:
  - skill: localization-architect
    version: "^1.0.0"
    input_map:
      target_locales:       "session.target_locales"
      framework:            "session.framework"
      content_volume:       "feature_plan.content_volume"
      translation_platform: "session.translation_platform"
      rtl_support:          "session.rtl_required"
      context:              "design_system"
    output_map:
      i18n_architecture:          "state.i18n_architecture"
      translation_pipeline:       "state.translation_pipeline"
      rtl_strategy:               "state.rtl_strategy"
      implementation_checklist:   "state.i18n_checklist"
```

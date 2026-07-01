---
name: product-analytics-designer
version: 1.0.0
domain: planning
description: >
  Use when designing product analytics instrumentation and measurement frameworks. Triggers on:
  "design analytics tracking", "event taxonomy", "AARRR metrics", "A/B testing framework",
  "OKR/KPI tree design", "funnel analysis setup", "privacy-compliant analytics". Do NOT use for
  infrastructure/APM monitoring (use observability skill) or backend error tracking (use
  performance-guard).
author: system
---

## Purpose

Design a comprehensive product analytics and measurement system that enables data-driven product decisions. The skill produces a structured event tracking taxonomy, metric framework, experimentation design, and privacy-compliant implementation plan. It ensures every product goal maps to measurable leading and lagging indicators, and that every tracked event has an explicit owner, trigger point, and property schema — eliminating the "track everything, measure nothing" anti-pattern that plagues data-immature product teams.

The AARRR funnel (Acquisition, Activation, Retention, Referral, Revenue) framework is applied to identify the north star metric and supporting KPI tree. For each funnel stage, the skill defines conversion targets, drop-off detection events, and cohort segmentation dimensions that enable root cause analysis. The experimentation framework design covers A/B test methodology including minimum detectable effect (MDE) calculation, statistical significance threshold (p < 0.05, power ≥ 0.80), sample size estimation, holdout group design, and multiple comparison correction (Bonferroni/Benjamini-Hochberg). Feature flag integration with LaunchDarkly / Statsig / Growthbook is designed to gate experiment exposure.

Privacy compliance is treated as a first-class constraint, not an afterthought. The skill produces a GDPR/CCPA/COPPA-compliant consent management design (consent categories, conditional tracking, opt-out flows), recommends server-side tracking architectures to reduce client-side cookie dependency, and produces a data minimization plan specifying exactly which user properties are necessary for each business question. Cookieless analytics alternatives (Plausible, Fathom, server-side GA4) are evaluated when privacy requirements are strict.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `product_goals` | `array[object]` | Yes | Business goals: `goal`, `metric`, `target`, `timeframe` |
| `user_journeys` | `array[object]` | Yes | Key user flows: `journey_name`, `steps[]`, `success_event` |
| `analytics_platform` | `string` | No | Primary analytics platform: `amplitude`, `mixpanel`, `segment`, `posthog`, `ga4`, `custom`. Default: `segment` |
| `experiment_framework` | `boolean` | No | Whether to design an A/B experimentation framework. Default: `false` |
| `privacy_requirements` | `array[string]` | No | Active privacy regulations: `gdpr`, `ccpa`, `coppa`. Default: `[]` |
| `data_destinations` | `array[string]` | No | Downstream data destinations (e.g., `["bigquery", "redshift", "amplitude"]`) |
| `context` | `object` | No | Upstream context from feature-planning or requirement-analyzer |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["product_goals", "user_journeys"],
  "properties": {
    "product_goals": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": ["goal", "metric", "target"],
        "properties": {
          "goal":      { "type": "string" },
          "metric":    { "type": "string" },
          "target":    { "type": "string" },
          "timeframe": { "type": "string" }
        }
      }
    },
    "user_journeys": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": ["journey_name", "steps"],
        "properties": {
          "journey_name":  { "type": "string" },
          "steps":         { "type": "array", "items": { "type": "string" } },
          "success_event": { "type": "string" }
        }
      }
    },
    "analytics_platform": {
      "type": "string",
      "enum": ["amplitude", "mixpanel", "segment", "posthog", "ga4", "custom"],
      "default": "segment"
    },
    "experiment_framework": { "type": "boolean", "default": false },
    "privacy_requirements": {
      "type": "array",
      "items": { "type": "string", "enum": ["gdpr", "ccpa", "coppa"] }
    },
    "data_destinations": {
      "type": "array",
      "items": { "type": "string" }
    },
    "context": { "type": "object" }
  }
}
```

## Required Context

- Product goals and user journeys (required inputs).
- Feature plan from `feature-planning` (maps features to analytics touchpoints).
- Architecture from `architecture-design` (identifies frontend/backend event emission points).
- Privacy regulations from compliance context or explicit `privacy_requirements` input.

## Execution Logic

```
Step 1 — North star metric and OKR tree
  Identify the single north star metric (NSM) that best represents the product's core value delivery.
    North Star selection criteria:
      - Reflects actual user value (not vanity metric like page views)
      - Leads revenue and retention (leading indicator)
      - Owned by the product team (controllable)
    Examples: Amplitude → "Weekly Querying Users"; Slack → "Messages Sent per DAU"
  Build KPI tree:
    Level 1: North Star Metric
    Level 2: AARRR stage metrics (5 branches)
    Level 3: Leading indicators per stage (3-5 per branch)
    Level 4: Sub-metrics and diagnostic dimensions
  Map each product_goal to a KPI tree node with owner and target.
  Output: metrics_framework { north_star, aarrr_metrics, okr_tree, goal_metric_map }

Step 2 — AARRR funnel metrics definition
  For each funnel stage, define primary metric and measurement approach:
    Acquisition: new_users_by_source (UTM parameters, referral attribution, organic vs. paid)
      Key events: page_viewed (first visit), sign_up_started, sign_up_completed
    Activation: aha_moment completion rate (user reaches core value for first time)
      Key events: onboarding_step_completed, first_core_action_taken, activation_milestone_reached
    Retention: D1/D7/D30 retention rates; WAU/MAU ratio (product stickiness index)
      Key events: session_started (per user per day), feature_X_used (habit-forming feature)
    Referral: viral coefficient (invites_sent * invite_conversion_rate)
      Key events: invite_sent, invite_accepted, referral_link_clicked
    Revenue: MRR, ARPU, LTV, conversion rate (free → paid), churn rate
      Key events: checkout_started, payment_completed, subscription_upgraded, subscription_cancelled
  Output: aarrr_metrics [{ stage, primary_metric, formula, target, key_events[] }]

Step 3 — Event taxonomy design
  Naming convention (Segment/Amplitude standard):
    Format: "{Object} {Action}" (noun + past-tense verb)
    Examples: "Product Viewed", "Order Placed", "User Signed Up"
    Avoid: "click_button", "page_view" (too generic); "userSignedUp" (wrong case)
  Event property schema standards:
    All events: { event_name, timestamp (ISO 8601), user_id (or anonymous_id), session_id,
                  platform (web|ios|android), app_version, environment (production|staging) }
    Contextual: { page_url, referrer, utm_source, utm_medium, utm_campaign } (web)
    Entity-specific: defined per event below
  Build event catalog from user_journeys:
    For each step in each journey: define trigger event with properties
    For each success_event: define conversion event with revenue/value properties if applicable
  Owner assignment: map each event to a feature team or squad responsible for instrumentation.
  Output: event_taxonomy [{ event_name, category, properties[], trigger_point, owner, funnel_stage }]

Step 4 — Funnel definitions
  For each user_journey, define a formal funnel:
    funnel_name: journey_name
    steps: [{ step_name, event_name, order }]
    conversion_window: e.g., "7 days" (time allowed between funnel steps)
    conversion_target: e.g., "5% of step 1 completions reach step 5 within 7 days"
    drop_off_alert: trigger alert when step N→N+1 conversion drops > 20% week-over-week
  Cohort segmentation dimensions: device_type, acquisition_channel, plan_type, country, signup_date
  Output: funnel_definitions [{ funnel_name, steps[], conversion_window, conversion_target, segments[] }]

Step 5 — Analytics data model
  Event schema (universal across all platforms):
    events table: event_id (UUID), event_name, timestamp, user_id, anonymous_id,
                  session_id, properties (JSONB), context (JSONB), received_at
  User profile schema:
    users table: user_id, anonymous_id, created_at, first_seen_at, last_seen_at,
                 acquisition_source, plan_type, country, traits (JSONB)
  Session schema:
    sessions table: session_id, user_id, started_at, ended_at, page_count,
                    event_count, acquisition_channel, landing_page
  Warehouse-optimized schema (BigQuery/Redshift):
    Partition events table by date (event_date column) for query cost control.
    Materialize funnel intermediate tables as scheduled dbt models.
  Output: analytics_data_model { event_schema, user_schema, session_schema, warehouse_config }

Step 6 — Experimentation framework design (if experiment_framework: true)
  A/B test design methodology:
    Hypothesis format: "If we [change], [metric] will [increase/decrease] by [X]% because [reason]"
    MDE calculation: minimum_detectable_effect = 2 * std_dev * z_alpha / sqrt(n)
      Practical guidance: MDE ≤ 5% requires > 10k samples per variant; MDE ≥ 20% requires ~1k
    Statistical significance: two-tailed t-test or z-test; p < 0.05; power (1-β) ≥ 0.80
    Sample size calculator: n = 2 * (z_α/2 + z_β)² * σ² / δ² per variant
    Multiple comparisons: apply Bonferroni correction when testing > 3 metrics simultaneously
  Holdout group design:
    Global holdout: 5-10% of users excluded from all experiments (measures cumulative experiment effect)
    Per-experiment holdout: control vs. treatment (50/50 or 90/10 for risky changes)
  Feature flag integration:
    LaunchDarkly: SDK flag evaluation → analytics event with $experiment_id and $variant properties
    Statsig: built-in A/B test logging; gate.check() emits exposure event automatically
    GrowthBook: OSS option; JS SDK evaluates flag and emits exposure via analytics SDK
  Experiment lifecycle: design → hypothesis → flag setup → sample size check → launch →
    monitor (guardrail metrics) → analyze (p-value) → ship or revert → document
  Output: experiment_framework_design { methodology, mde_guidance, sample_size_formula,
                                         holdout_design, flag_integration, lifecycle_steps[] }

Step 7 — Privacy compliance design
  For each regulation in privacy_requirements:
    gdpr:
      Consent categories: Analytics (optional), Functional (required), Marketing (optional)
      Consent management platform (CMP): OneTrust, Cookiebot, or custom consent banner
      Tracking gate: analytics SDK initialized ONLY after analytics consent granted
      Right to erasure: user deletion pipeline → anonymize or delete events by user_id
      Data retention: events older than 24 months purged; aggregate metrics retained
    ccpa:
      Do Not Sell/Share link in footer → opt-out flag stored in user profile
      Data sale exclusion: Segment destination filter based on opt-out flag
      Data inventory: document all personal data categories collected per event
    coppa:
      Age gate before any tracking initialization for products targeting under-13
      No behavioral advertising tracking; no third-party SDK injection for COPPA users
  Cookieless analytics recommendation (if gdpr present):
    Server-side tracking: GA4 Measurement Protocol or Segment HTTP API (no client cookies)
    Privacy-first alternative: Plausible Analytics (no cookies, no cross-site tracking, EU-hosted)
  Data minimization plan: for each event, document which properties are necessary for the
    stated business question; remove all others (avoid "collect everything" approach).
  Output: privacy_compliance { consent_management, data_retention_policy, deletion_pipeline,
                               data_minimization, cookieless_option }

Step 8 — Dashboard template design
  North Star dashboard: NSM trend (daily/weekly), AARRR stage overview, top 3 OKR progress
  Funnel dashboard: per-funnel conversion rates, step-by-step drop-off, cohort comparison
  Retention dashboard: D1/D7/D30 retention curves, cohort heatmap, WAU/MAU ratio
  Experiment dashboard: running experiments, sample size progress, p-value tracker, winner detection
  Data freshness: dashboards should reflect data within 4 hours of event emission (streaming pipeline)
    or daily batch (warehouse pipeline, acceptable for strategic metrics).
  Output: dashboard_templates [{ dashboard_name, widgets[], data_source, refresh_rate }]

Step 9 — Implementation plan
  Phase 1 (Foundation): install analytics SDK, implement page view + user identify calls, set up
    consent management, instrument top 5 highest-priority events.
  Phase 2 (Funnels): instrument all user journey events, set up funnel reports in platform.
  Phase 3 (Retention): add session tracking, cohort analysis, D1/D7/D30 dashboards.
  Phase 4 (Experimentation): set up feature flag platform, implement experiment framework.
  Output: implementation_plan { phases[], estimated_effort, tooling[], success_criteria }
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `event_taxonomy` | `array[object]` | Event catalog: name, properties, trigger point, owner, funnel stage |
| `metrics_framework` | `object` | North star, AARRR metrics, OKR tree, goal-metric mapping |
| `funnel_definitions` | `array[object]` | Formal funnel specs: steps, conversion window, targets, segments |
| `experiment_framework_design` | `object` | A/B methodology, MDE, sample size, holdout, flag integration (null if not requested) |
| `analytics_data_model` | `object` | Event, user, session schemas; warehouse optimization config |
| `privacy_compliance` | `object` | Consent management, retention policy, deletion pipeline, data minimization |
| `dashboard_templates` | `array[object]` | Dashboard designs: widgets, data source, refresh rate |
| `implementation_plan` | `object` | Phased rollout plan with effort estimates and success criteria |
| `metrics` | `object` | `tokens_in`, `tokens_out`, `duration_ms`, `items_produced`, `version` |
| `feedback` | `array[object]` | Backpropagate entries for upstream skills |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["event_taxonomy", "metrics_framework", "funnel_definitions",
               "analytics_data_model", "privacy_compliance", "metrics", "feedback"],
  "properties": {
    "event_taxonomy": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["event_name", "properties", "trigger_point", "owner"],
        "properties": {
          "event_name":   { "type": "string" },
          "category":     { "type": "string" },
          "properties":   { "type": "array", "items": { "type": "string" } },
          "trigger_point":{ "type": "string" },
          "owner":        { "type": "string" },
          "funnel_stage": { "type": "string" }
        }
      }
    },
    "metrics_framework": {
      "type": "object",
      "required": ["north_star", "aarrr_metrics"],
      "properties": {
        "north_star":     { "type": "string" },
        "aarrr_metrics":  { "type": "array" },
        "okr_tree":       { "type": "object" },
        "goal_metric_map":{ "type": "array" }
      }
    },
    "funnel_definitions": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["funnel_name", "steps", "conversion_target"],
        "properties": {
          "funnel_name":        { "type": "string" },
          "steps":              { "type": "array" },
          "conversion_window":  { "type": "string" },
          "conversion_target":  { "type": "string" },
          "segments":           { "type": "array", "items": { "type": "string" } }
        }
      }
    },
    "experiment_framework_design": { "type": ["object", "null"] },
    "analytics_data_model":  { "type": "object" },
    "privacy_compliance":     { "type": "object" },
    "dashboard_templates":    { "type": "array" },
    "implementation_plan":    { "type": "object" },
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

- Every `product_goal` MUST map to at least one node in the `metrics_framework.okr_tree`.
- Event names MUST follow "{Object} {Action}" Segment naming convention (title case, noun + verb). Snake_case event names are flagged.
- `event_taxonomy` MUST include at least one event per step in each `user_journey`.
- `experiment_framework_design` is null when `experiment_framework: false` — do not generate it speculatively.
- GDPR compliance MUST include analytics tracking gate on consent — analytics cannot fire before consent is granted.
- North star metric MUST be a leading indicator of revenue/retention — vanity metrics (page views, app opens) cannot serve as north star without explicit justification.

## Security Considerations

- User IDs in analytics events MUST be pseudonymous (UUID, not email or name) to comply with GDPR data minimization.
- Analytics API keys (Amplitude API key, Segment write key) MUST be environment-variable references — never hardcoded in client code (treat as non-secret but still env-referenced).
- Server-side event APIs MUST authenticate via write key passed in server-to-server requests — not exposed in client bundles.
- COPPA compliance: NO user profiling, behavioral targeting, or persistent identifiers for users aged < 13.
- Data warehouse access: analytics data containing user behavior MUST have row-level access controls for PII fields.

## Token Optimization

- Skip `experiment_framework_design` generation entirely when `experiment_framework: false`.
- Compress `user_journeys` to journey name + step count for Steps 1-2; expand full steps only for event taxonomy in Step 3.
- For `analytics_platform: ga4`, skip Segment-specific property schema details; produce GA4-native event schema instead.

## Quality Checklist

- [ ] North star metric is a leading value indicator (not a vanity metric)
- [ ] All `user_journeys` have at least one event per step in `event_taxonomy`
- [ ] All event names follow "{Object} {Action}" naming convention
- [ ] GDPR tracking gate present when `gdpr` in `privacy_requirements`
- [ ] `experiment_framework_design` includes MDE calculation guidance when present
- [ ] `analytics_data_model` has partitioning strategy for warehouse table
- [ ] `implementation_plan` is phased with Phase 1 covering top-5 priority events only

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| `product_goals` empty | Reject: `{"error": "NO_PRODUCT_GOALS", "hint": "Provide at least one measurable goal"}` |
| `user_journeys` with no steps | Reject journey: emit `feedback.warning`, skip funnel definition for that journey |
| `experiment_framework: true` but no `analytics_platform` set | Default to Segment as CDC source; emit `feedback.info` |
| `privacy_requirements` includes `coppa` but no age gate in user journeys | Emit `feedback.backpropagate` to `requirement-analyzer` requesting age verification requirement |
| Conflicting GDPR + experiment framework (consent not guaranteed) | Produce server-side experiment exposure design that avoids client-side cookie dependency |

## 12. Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Behavior |
|------|---------|---------|----------|
| Analytics architecture review | Privacy regulations present (`privacy_requirements` non-empty) | 3600s | Present data minimization plan, consent gate design, and deletion pipeline for legal/privacy team review |

## 13. Skill Composition

```yaml
composes:
  - skill: product-analytics-designer
    version: "^1.0.0"
    input_map:
      product_goals:        "session.product_goals"
      user_journeys:        "feature_plan.user_journeys"
      analytics_platform:   "session.analytics_platform"
      experiment_framework: "session.experiments_enabled"
      privacy_requirements: "session.privacy_regulations"
    output_map:
      event_taxonomy:    "state.analytics_events"
      metrics_framework: "state.metrics_framework"
      funnel_definitions:"state.funnels"
      privacy_compliance:"state.privacy_plan"
```

---
name: micro-frontend-architect
version: 1.0.0
domain: design
description: >
  Use when designing micro-frontend architectures for large-scale web applications — team-aligned
  decomposition, Module Federation composition, cross-MFE communication, and CI/CD independence.
  Triggers on: "micro-frontend architecture", "Module Federation setup", "MFE decomposition",
  "split monolith into micro-frontends", "independent deployment per team". Do NOT use for
  single-team SPAs, server-side-only applications, or monoliths with fewer than 3 autonomous teams.
author: system
---

## Purpose

Design a production-grade micro-frontend (MFE) architecture that maps directly to autonomous team boundaries, enables independent deployment, and maintains a coherent user experience. The skill applies both strategic decomposition (vertical slicing by business domain vs. horizontal slicing by page layer) and tactical composition patterns, selecting the right mechanism — Module Federation 2.0 (Webpack 5 / Rspack / Vite plugin-federation), server-side includes, iframe sandboxing, or native Web Components — based on team capability, runtime isolation needs, and bundle performance budgets.

The skill addresses the complete integration surface: how MFEs discover and load each other at runtime, how shared dependencies (React, design system tokens, auth context) are managed without duplication or version conflicts, how cross-MFE navigation and deep-linking work under a shell-based routing model, and how authentication tokens and user context propagate across boundaries without coupling. It enforces Webpack `shared` singleton semantics for critical libraries and produces per-MFE webpack.config.js / vite.config.ts federation blocks ready for code-generator to scaffold.

A critical output of this skill is a CI/CD independence matrix showing which team owns which pipeline, what the independent release cadence looks like, and how the host shell's version compatibility contract (semver contracts per exposed module) prevents runtime breakage when MFEs deploy asynchronously. The skill also produces a performance budget per MFE (initial JS bundle ≤ 150 KB gzipped by default) and flags nanoservice anti-patterns where decomposition granularity exceeds team boundaries without delivering isolation value.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `current_architecture` | `string` | Yes | Starting point: `monolith`, `partial_mfe`, `greenfield` |
| `team_count` | `integer` | Yes | Number of autonomous development teams (minimum 2 for MFE to add value) |
| `mfe_boundaries` | `array[object]` | Yes | Proposed MFE split: each entry has `mfe_name`, `team`, `pages`, `routes` |
| `composition_strategy` | `string` | No | Composition mechanism: `module_federation`, `server_side`, `iframe`, `web_components`. Default: `module_federation` |
| `shared_dependencies` | `array[string]` | No | Libraries to singleton-share: e.g., `["react", "react-dom", "design-system"]` |
| `auth_model` | `string` | No | How auth propagates: `centralized` (shell owns token) or `distributed` (each MFE fetches). Default: `centralized` |
| `shell_framework` | `string` | No | Shell application framework: `react`, `vue`, `angular`, `vanilla`. Default: `react` |
| `context` | `object` | No | Upstream context (architecture, feature_plan, deployment_strategy) |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["current_architecture", "team_count", "mfe_boundaries"],
  "properties": {
    "current_architecture": {
      "type": "string",
      "enum": ["monolith", "partial_mfe", "greenfield"]
    },
    "team_count": { "type": "integer", "minimum": 2 },
    "mfe_boundaries": {
      "type": "array",
      "minItems": 2,
      "items": {
        "type": "object",
        "required": ["mfe_name", "team", "pages"],
        "properties": {
          "mfe_name": { "type": "string" },
          "team":     { "type": "string" },
          "pages":    { "type": "array", "items": { "type": "string" } },
          "routes":   { "type": "array", "items": { "type": "string" } }
        }
      }
    },
    "composition_strategy": {
      "type": "string",
      "enum": ["module_federation", "server_side", "iframe", "web_components"],
      "default": "module_federation"
    },
    "shared_dependencies": {
      "type": "array",
      "items": { "type": "string" }
    },
    "auth_model": {
      "type": "string",
      "enum": ["centralized", "distributed"],
      "default": "centralized"
    },
    "shell_framework": {
      "type": "string",
      "enum": ["react", "vue", "angular", "vanilla"],
      "default": "react"
    },
    "context": { "type": "object" }
  }
}
```

## Required Context

- Architecture modules from `architecture-design` (identifies domain boundaries to align MFE splits).
- Feature plan from `feature-planning` (determines which features belong to which MFE).
- Deployment strategy from `deployment-strategy` (informs CI/CD independence per team pipeline).
- Design system token contract from `design-system-generator` if available (shared dependency scope).

## Execution Logic

```
Step 1 — Validate MFE decomposition against team topology
  For each entry in mfe_boundaries: verify mfe_name is unique and team exists.
  Check: team_count must equal number of unique teams in mfe_boundaries (warn if mismatch).
  Anti-pattern check: flag if any MFE has < 3 pages (nanoservice smell) unless route isolation is justified.
  Flag: if team_count < 2, reject with error INSUFFICIENT_TEAMS.
  Output: validated_boundaries, anti_pattern_warnings[]

Step 2 — Design shell and host architecture
  Define shell application responsibilities:
    - Global routing (React Router 6 / Vue Router / Angular Router on shell level)
    - Auth token management and context provision
    - Design system token injection (CSS custom properties via :root)
    - Error boundary wrapping for each MFE mount point
    - Global navigation bar and footer (owned by shell or dedicated Nav MFE)
  Routing model: shell-based (recommended) vs. hash-based (legacy fallback).
  Output: shell_design { framework, responsibilities[], routing_model, entry_point }

Step 3 — Design Module Federation configuration per MFE
  For each MFE in mfe_boundaries:
    Produce ModuleFederationPlugin config (Webpack 5) or @originjs/vite-plugin-federation config:
      name: mfe_name (unique, camelCase)
      filename: "remoteEntry.js" (standard naming)
      exposes: { "./App": "./src/bootstrap" } (lazy bootstrap pattern to avoid eager singleton init)
      shared: {
        react:      { singleton: true, requiredVersion: "^18.0.0", eager: false },
        react-dom:  { singleton: true, requiredVersion: "^18.0.0", eager: false },
        [design-system]: { singleton: true, requiredVersion: "^X.Y.0" }
      }
    Shell (host) config:
      remotes: { [mfe_name]: "[mfe_name]@[remote_url]/remoteEntry.js" }
      URL strategy: env-var per environment (VITE_[MFE]_REMOTE_URL or NEXT_PUBLIC_[MFE]_URL)
  Output: module_federation_config [{ mfe_name, config_type: webpack|vite, plugin_config }]

Step 4 — Design shared dependency strategy
  Classify dependencies into three tiers:
    Tier 1 – Hard singleton (one version, crash if version mismatch): React, ReactDOM, design-system
    Tier 2 – Soft shared (prefer same version, allow fallback): React Router, i18n library
    Tier 3 – Isolated (each MFE bundles its own copy): utility libs, MFE-specific SDKs
  Version contract: define semver range per shared lib; MFE teams must not break host contract.
  Publish shared lib versions in a machine-readable CONTRACT.json at shell root.
  Output: shared_dependency_strategy { tier1[], tier2[], tier3[], contract_file_spec }

Step 5 — Design cross-MFE communication
  Evaluate communication channels:
    Custom Event Bus: window.dispatchEvent(new CustomEvent('mfe:action', { detail })) — decoupled
    Shared State Store: Zustand singleton exposed via Module Federation (use carefully, tight coupling)
    URL/Query Params: navigation events carry state in URL — best for page-level transitions
    PostMessage: for iframe-isolated MFEs only
  Recommendation: prefer Custom Event Bus for async events, URL params for navigation.
  Define event catalog: event_name, payload_schema, producer_mfe, consumer_mfes[].
  Output: communication_patterns [{ pattern, use_case, event_catalog }]

Step 6 — Design routing strategy
  Shell-level routing: shell intercepts all top-level routes, delegates sub-routes to MFE.
  MFE internal routing: each MFE uses MemoryRouter (React) or equivalent to manage sub-routes
    without polluting the shell history.
  Deep-link support: shell must rehydrate MFE route on direct URL load.
  404 handling: shell catches unmatched routes, surfaces error boundary.
  Output: routing_design { strategy, shell_routes[], mfe_routing_isolation, deeplink_handling }

Step 7 — Design authentication propagation
  centralized model:
    Shell acquires and refreshes access token; exposes via React Context or Custom Event.
    MFEs read token from shell-provided context (Module Federation exposes AuthContext).
    MFE never stores tokens — stateless auth consumers.
  distributed model:
    Each MFE performs its own silent-refresh via shared auth SDK (Module Federation singleton).
    Auth SDK published as Tier 1 singleton — single token state in memory.
  Auth context propagation: define AuthPayload schema { userId, roles, tenantId, accessToken }.
  Output: auth_propagation_design { model, token_storage, context_schema, refresh_strategy }

Step 8 — Define CI/CD independence matrix
  For each MFE team, produce pipeline specification:
    Trigger: push to /apps/[mfe_name]/** (monorepo) or repo root (polyrepo)
    Build: nx build [mfe_name] --configuration=production
    Test: nx test [mfe_name] --coverage
    Deploy: upload remoteEntry.js + assets to CDN path /[mfe_name]/[version]/
    Version strategy: semver tag per MFE; CONTRACT.json updated on release.
    Shell compatibility check: CI step reads CONTRACT.json and validates semver range.
  Output: ci_cd_independence_plan [{ mfe_name, team, trigger, build_cmd, deploy_target, version_check }]

Step 9 — Define performance budgets
  Default per-MFE budget: initial JS bundle ≤ 150 KB gzipped, total assets ≤ 500 KB.
  Measure with: webpack-bundle-analyzer, rollup-plugin-visualizer, Lighthouse CI.
  Shared dependencies excluded from MFE bundle budget (counted once at shell level).
  Budget enforcement: fail CI if bundle exceeds budget (size-limit npm package).
  Output: performance_budget { per_mfe_js_kb, per_mfe_total_kb, measurement_tool, ci_enforcement }

Step 10 — Produce migration plan (if current_architecture: monolith|partial_mfe)
  Strangler Fig pattern: extract MFEs one at a time, routing to monolith as fallback.
  Phase 1: Extract shell and design system → Phase 2: Extract leaf MFEs → Phase 3: Extract core domain MFEs.
  Define feature flag per MFE to toggle between monolith route and MFE route.
  Output: migration_plan { strategy, phases[], feature_flag_spec, rollback_procedure }

Step 11 — Assemble architecture document
  Combine all step outputs. Produce Mermaid component diagram of shell + MFEs.
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `mfe_architecture` | `object` | Shell design, MFE list, composition strategy, topology diagram |
| `module_federation_config` | `array[object]` | Per-MFE webpack/vite plugin configuration blocks |
| `shared_dependency_strategy` | `object` | Tier classification, semver contracts, CONTRACT.json spec |
| `communication_patterns` | `array[object]` | Event bus catalog, URL param patterns, PostMessage spec |
| `routing_design` | `object` | Shell routes, MFE isolation strategy, deep-link handling |
| `auth_propagation_design` | `object` | Auth model, token context schema, refresh strategy |
| `ci_cd_independence_plan` | `array[object]` | Per-team pipeline spec with build/test/deploy commands |
| `performance_budget` | `object` | Per-MFE JS and total asset size budgets with enforcement config |
| `migration_plan` | `object` | Strangler Fig phases, feature flags, rollback (null if greenfield) |
| `metrics` | `object` | `tokens_in`, `tokens_out`, `duration_ms`, `items_produced`, `version` |
| `feedback` | `array[object]` | Backpropagate entries for upstream skills |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["mfe_architecture", "module_federation_config", "shared_dependency_strategy",
               "communication_patterns", "routing_design", "ci_cd_independence_plan",
               "performance_budget", "metrics", "feedback"],
  "properties": {
    "mfe_architecture": {
      "type": "object",
      "required": ["shell", "mfes", "composition", "topology_diagram"],
      "properties": {
        "shell":            { "type": "object" },
        "mfes":             { "type": "array" },
        "composition":      { "type": "string" },
        "topology_diagram": { "type": "string" }
      }
    },
    "module_federation_config": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["mfe_name", "config_type", "plugin_config"],
        "properties": {
          "mfe_name":     { "type": "string" },
          "config_type":  { "type": "string", "enum": ["webpack", "vite", "rspack"] },
          "plugin_config":{ "type": "object" }
        }
      }
    },
    "shared_dependency_strategy": {
      "type": "object",
      "properties": {
        "tier1": { "type": "array", "items": { "type": "string" } },
        "tier2": { "type": "array", "items": { "type": "string" } },
        "tier3": { "type": "array", "items": { "type": "string" } },
        "contract_file_spec": { "type": "object" }
      }
    },
    "communication_patterns": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "pattern":      { "type": "string" },
          "use_case":     { "type": "string" },
          "event_catalog":{ "type": "array" }
        }
      }
    },
    "routing_design": { "type": "object" },
    "auth_propagation_design": { "type": "object" },
    "ci_cd_independence_plan": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["mfe_name", "team", "trigger", "build_cmd", "deploy_target"],
        "properties": {
          "mfe_name":      { "type": "string" },
          "team":          { "type": "string" },
          "trigger":       { "type": "string" },
          "build_cmd":     { "type": "string" },
          "deploy_target": { "type": "string" },
          "version_check": { "type": "string" }
        }
      }
    },
    "performance_budget": {
      "type": "object",
      "properties": {
        "per_mfe_js_kb":    { "type": "integer" },
        "per_mfe_total_kb": { "type": "integer" },
        "measurement_tool": { "type": "string" },
        "ci_enforcement":   { "type": "string" }
      }
    },
    "migration_plan": { "type": ["object", "null"] },
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
    "feedback": {
      "type": "array",
      "items": {
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
}
```

## Rules & Constraints

- `team_count` MUST be ≥ 2; MFE architecture for a single team is an anti-pattern — reject with `INSUFFICIENT_TEAMS`.
- Every MFE MUST have a unique `mfe_name` — duplicates are blocking errors.
- Singleton shared dependencies (Tier 1) MUST specify exact `requiredVersion` semver range in the federation config — omitting it causes runtime crashes.
- MFEs MUST use the lazy bootstrap pattern (`import('./bootstrap')` wrapping) to prevent singleton initialization before federation resolves.
- Remote URLs in federation config MUST reference environment variables — no hardcoded hostnames.
- Each MFE CI pipeline MUST include a `CONTRACT.json` compatibility check step before deploy.
- Performance budget MUST be enforced via `size-limit` or equivalent CI gate — advisory-only budgets are insufficient.

## Security Considerations

- Remote `remoteEntry.js` URLs MUST be served over HTTPS with CORS restricted to known shell origins.
- Module Federation does not provide code integrity guarantees — use Subresource Integrity (SRI) hashes for `remoteEntry.js` in production when loading from external CDNs.
- Auth tokens MUST NOT be passed via Custom Event Bus payloads — use Module Federation shared AuthContext singleton or secure iframe messaging with origin validation.
- CSP headers on the shell application MUST whitelist only known MFE CDN origins in `script-src`.
- Iframe-isolated MFEs require `sandbox` attribute with minimal permissions (`allow-scripts allow-same-origin` only when required).

## Token Optimization

- Compress `mfe_boundaries` to name/team/route-count only during analysis steps; expand only for config generation.
- `module_federation_config.plugin_config` returns a compact JSON object (not a rendered webpack file) — code-generator expands to actual config files.
- Skip `migration_plan` generation entirely when `current_architecture: greenfield`.

## Quality Checklist

- [ ] Every MFE in `mfe_boundaries` has a corresponding entry in `module_federation_config`
- [ ] All Tier 1 shared dependencies specify `requiredVersion` and `singleton: true`
- [ ] `topology_diagram` Mermaid renders without syntax errors
- [ ] `ci_cd_independence_plan` has one entry per unique team
- [ ] `performance_budget.per_mfe_js_kb` is ≤ 250 KB (flag if greater as anti-pattern)
- [ ] Remote URLs use environment variable references, not literal hostnames
- [ ] Auth token never appears in event_catalog payload schemas
- [ ] `migration_plan` present when `current_architecture` is `monolith` or `partial_mfe`

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| `team_count < 2` | Reject: `{"error": "INSUFFICIENT_TEAMS", "recommendation": "Use SPA with module boundaries instead"}` |
| MFE has < 3 pages (nanoservice) | Emit `feedback.warning`, suggest merging with sibling MFE under same team |
| Singleton version conflict in shared_dependencies | Flag as blocking `feedback.backpropagate`, request version alignment before proceeding |
| `module_federation` unavailable for target bundler | Recommend `web_components` fallback, document trade-offs |
| Migration from monolith with no feature flag system | Add feature flag design to output, emit dependency note |

## 12. Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Behavior |
|------|---------|---------|----------|
| Architecture approval | Always — MFE decomposition affects all team boundaries and CI/CD | 7200s | Present MFE boundary map, shared dependency tiers, and performance budgets for sign-off |
| Migration phase approval | `current_architecture: monolith` and `migration_plan.phases` count > 2 | 7200s | Present Strangler Fig phase plan and rollback procedure; require explicit approval per phase |

## 13. Skill Composition

```yaml
composes:
  - skill: micro-frontend-architect
    version: "^1.0.0"
    input_map:
      current_architecture: "session.architecture_type"
      team_count:           "session.team_count"
      mfe_boundaries:       "feature_plan.mfe_boundaries"
      shared_dependencies:  "design_system.shared_libs"
      context:              "system_architecture"
    output_map:
      module_federation_config:  "state.mfe_fed_config"
      ci_cd_independence_plan:   "state.mfe_pipelines"
      performance_budget:        "state.mfe_perf_budget"
```

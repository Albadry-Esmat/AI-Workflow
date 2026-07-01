---
name: state-management-architect
version: 1.0.0
domain: design
description: >
  Use when designing client-side and server-state management architectures for modern web or
  mobile applications. Triggers on: "design state management", "what state library should I use",
  "Redux vs Zustand", "server state caching", "optimistic updates", "offline-first state",
  "state normalization", "real-time state sync". Do NOT use for pure backend state or database
  schema design — use database-architect for persistent data models.
author: system
---

## Purpose

Design a cohesive, scalable state management architecture for web and mobile applications. The skill evaluates the full state landscape — server state, client/UI state, form state, real-time state, and auth state — and produces a prescriptive library selection, topology diagram, and implementation patterns. It prevents common anti-patterns such as storing server data in Redux, over-fetching without caching layers, and monolithic global stores that destroy render performance.

The skill covers both modern atomic state libraries (Zustand ≥4, Jotai ≥2, Recoil, Valtio) and structured patterns (Redux Toolkit ≥2 with RTK Query, NgRx ≥17 for Angular) alongside dedicated server-state solutions (TanStack Query ≥5, SWR ≥2, Apollo Client ≥3). It produces stale-while-revalidate cache policies, optimistic update rollback strategies, and persistence middleware configuration (Redux Persist ≥6, Zustand persist middleware, MMKV for React Native).

For real-time and offline scenarios, the skill designs WebSocket-to-store synchronization bridges, conflict resolution policies, and service-worker-backed cache strategies that keep the UI consistent across network transitions. All recommendations include explicit trade-off tables comparing the top two alternatives so teams can make informed decisions without guesswork.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `app_type` | `string` | Yes | Application runtime: `web_spa`, `mobile_rn`, `mobile_flutter`, `desktop_electron` |
| `state_categories` | `array[string]` | Yes | State concerns to address: `server_state`, `client_state`, `form_state`, `realtime_state`, `auth_state` |
| `framework` | `string` | Yes | UI framework: `react`, `vue`, `angular`, `svelte`, `flutter` |
| `team_size` | `string` | No | Team scale affecting boilerplate tolerance: `small` (1-3), `medium` (4-10), `large` (>10). Default: `medium` |
| `offline_support` | `boolean` | No | Whether the app must function without network connectivity. Default: `false` |
| `realtime_sync` | `boolean` | No | Whether state must sync with live server events (WebSocket/SSE). Default: `false` |
| `existing_libraries` | `array[string]` | No | Libraries already installed (e.g., `["redux", "axios"]`) to avoid migration churn |
| `context` | `object` | No | Pass-through context from upstream skills (architecture, feature_plan) |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["app_type", "state_categories", "framework"],
  "properties": {
    "app_type": {
      "type": "string",
      "enum": ["web_spa", "mobile_rn", "mobile_flutter", "desktop_electron"]
    },
    "state_categories": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "string",
        "enum": ["server_state", "client_state", "form_state", "realtime_state", "auth_state"]
      }
    },
    "framework": {
      "type": "string",
      "enum": ["react", "vue", "angular", "svelte", "flutter"]
    },
    "team_size": {
      "type": "string",
      "enum": ["small", "medium", "large"],
      "default": "medium"
    },
    "offline_support": { "type": "boolean", "default": false },
    "realtime_sync":   { "type": "boolean", "default": false },
    "existing_libraries": {
      "type": "array",
      "items": { "type": "string" }
    },
    "context": { "type": "object" }
  }
}
```

## Required Context

- Architecture module list from `architecture-design` (identifies which modules own which state slices).
- Feature plan from `feature-planning` (surfaces forms, async operations, and real-time features).
- `app_type` and `framework` must be consistent with `mobile-platform-specialist` or `frontend-ux-architect` outputs if those skills ran earlier in the pipeline.

## Execution Logic

```
Step 1 — Classify state by category and ownership
  For each item in state_categories, enumerate concrete state entities:
    server_state  → API resources (users, products, orders, etc.) inferred from architecture modules
    client_state  → UI-only state (modal open/close, active tab, sidebar collapsed, theme)
    form_state    → form field values, validation errors, submission lifecycle
    realtime_state → live event streams (chat messages, presence, notifications, live data)
    auth_state    → current user identity, session token, permissions, refresh lifecycle
  Output: state_inventory { category, entities[], ownership_module }

Step 2 — Select primary state libraries per category
  Apply selection matrix:
    server_state:
      react/vue/svelte → TanStack Query v5 (preferred) | SWR v2 (simpler) | RTK Query (if Redux already present)
      angular          → TanStack Query Angular | NgRx Data | Apollo (if GraphQL)
      flutter          → Riverpod AsyncNotifier | Bloc with Repository
    client_state:
      react small/medium → Zustand v4 (preferred) | Jotai v2 (atomic, fine-grained) | Valtio
      react large       → Redux Toolkit v2 (slice pattern) | Zustand with devtools
      vue               → Pinia v2 (official, preferred over Vuex)
      angular           → NgRx v17 Store | Akita
      svelte            → Svelte stores (built-in) | Zustand svelte adapter
      flutter           → Riverpod v2 | Bloc v8 | Provider
    form_state:
      react → React Hook Form v7 (preferred) | Formik v2 (legacy)
      vue   → VeeValidate v4 | FormKit
      angular → Angular Reactive Forms (built-in)
      flutter → flutter_form_builder | reactive_forms
    realtime_state:
      websocket bridge → Zustand socket middleware | RTK Query WebSocket cache entries | Phoenix Channels
    auth_state:
      react → dedicated auth store slice (Zustand) + token stored in memory (NOT localStorage for access tokens)
  Apply team_size modifier: small → prefer lowest boilerplate; large → prefer devtools & strict patterns.
  Output: library_recommendations [{ category, library, version_constraint, rationale, trade_offs }]

Step 3 — Design state topology
  Partition state into: global store, module/slice stores, server cache, form instances.
  Define store ownership per feature module (from architecture).
  Produce state topology diagram in Mermaid format.
  Identify shared state atoms vs. isolated component state (lifting-state-up decisions).
  Output: state_topology { global_store_slices[], server_cache_keys[], local_state_components[], topology_diagram }

Step 4 — Design cache strategy for server state
  For each API resource in server_state:
    Define: staleTime (ms), gcTime (ms), refetchOnWindowFocus, refetchInterval.
    Define: cache key structure (queryKey arrays with hierarchy).
    Define: invalidation triggers (mutations that stale which queries).
    TanStack Query v5: use queryOptions() factory pattern for type safety.
  Output: cache_strategy { resources[], default_stale_time_ms, default_gc_time_ms, invalidation_map }

Step 5 — Design optimistic update patterns
  For each write operation (create/update/delete):
    Define: optimistic mutation pattern (onMutate → snapshot → rollback in onError).
    TanStack Query: cancelQueries → setQueryData → return snapshot → queryClient.setQueryData(snapshot).
    RTK Query: pessimisticUpdate vs optimisticUpdate flag.
  Output: optimistic_update_patterns [{ operation, query_key, onMutate_steps, rollback_steps }]

Step 6 — Design offline strategy (if offline_support: true)
  Layer 1: TanStack Query persisted cache (persistQueryClient + createSyncStoragePersister for web,
           AsyncStorage persister for React Native, Hive for Flutter).
  Layer 2: Background sync queue (react-query-kit or custom mutation queue with retry).
  Layer 3: Conflict resolution policy (last-write-wins | server-wins | field-level merge).
  Service worker: Workbox precache + runtime cache strategies.
  Output: offline_strategy { persistence_adapter, sync_queue, conflict_policy, sw_config }

Step 7 — Design real-time sync bridge (if realtime_sync: true)
  WebSocket events → store updates:
    TanStack Query: socket.on('event') → queryClient.setQueryData() or queryClient.invalidateQueries()
    Zustand: socket.on('event') → store.setState() action
  Reconnection handling: exponential backoff, revalidate-all-queries on reconnect.
  Optimistic vs. confirmed state distinction for real-time mutations.
  Output: realtime_bridge { library_hooks, invalidation_on_reconnect, conflict_policy }

Step 8 — Define state persistence and hydration
  Identify which slices need persistence (auth tokens in memory, user preferences in localStorage).
  Redux Persist: whitelist/blacklist, transforms (encrypt sensitive slices via redux-persist-transform-encrypt).
  Zustand: persist middleware with partialize to exclude ephemeral UI state.
  Flutter: SharedPreferences for small state, Hive for larger structured state.
  Output: persistence_config { slices[], storage_adapter, encrypted_fields[], hydration_strategy }

Step 9 — Produce migration notes (if existing_libraries present)
  Map current library to recommended library with migration path.
  Identify coexistence period strategy (adapter patterns).
  Output: migration_notes { from, to, coexistence_strategy, migration_steps[] }

Step 10 — Assemble output document
  Combine all step outputs into structured state architecture document.
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `state_architecture` | `object` | Recommended libraries per category, state topology, and topology diagram |
| `library_recommendations` | `array[object]` | Per-category: `category`, `library`, `version_constraint`, `rationale`, `trade_offs` |
| `state_patterns` | `array[object]` | Named patterns: `pattern`, `use_case`, `code_snippet_hint` |
| `cache_strategy` | `object` | Server-state cache config: `staleTime`, `gcTime`, `queryKey_structure`, `invalidation_map` |
| `optimistic_update_patterns` | `array[object]` | Per-operation optimistic mutation and rollback steps |
| `offline_strategy` | `object` | Persistence adapter, sync queue, conflict policy, SW config (null if not requested) |
| `realtime_bridge` | `object` | WebSocket-to-store bridge design (null if not requested) |
| `persistence_config` | `object` | Store persistence slices, adapters, encrypted fields, hydration strategy |
| `migration_notes` | `object` | From/to migration path (null if no existing_libraries) |
| `metrics` | `object` | `tokens_in`, `tokens_out`, `duration_ms`, `items_produced`, `version` |
| `feedback` | `array[object]` | Backpropagate entries for upstream skills |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["state_architecture", "library_recommendations", "state_patterns", "cache_strategy", "optimistic_update_patterns", "metrics", "feedback"],
  "properties": {
    "state_architecture": {
      "type": "object",
      "required": ["recommended_libraries", "state_topology"],
      "properties": {
        "recommended_libraries": { "type": "object" },
        "state_topology": {
          "type": "object",
          "properties": {
            "global_store_slices": { "type": "array", "items": { "type": "string" } },
            "server_cache_keys":   { "type": "array", "items": { "type": "string" } },
            "local_state_components": { "type": "array", "items": { "type": "string" } },
            "topology_diagram": { "type": "string" }
          }
        }
      }
    },
    "library_recommendations": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["category", "library", "version_constraint", "rationale", "trade_offs"],
        "properties": {
          "category":          { "type": "string" },
          "library":           { "type": "string" },
          "version_constraint":{ "type": "string" },
          "rationale":         { "type": "string" },
          "trade_offs":        { "type": "array", "items": { "type": "string" } }
        }
      }
    },
    "state_patterns": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["pattern", "use_case", "code_snippet_hint"],
        "properties": {
          "pattern":          { "type": "string" },
          "use_case":         { "type": "string" },
          "code_snippet_hint":{ "type": "string" }
        }
      }
    },
    "cache_strategy": {
      "type": "object",
      "properties": {
        "default_stale_time_ms": { "type": "integer" },
        "default_gc_time_ms":    { "type": "integer" },
        "resources": { "type": "array" },
        "invalidation_map": { "type": "object" }
      }
    },
    "optimistic_update_patterns": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "operation":      { "type": "string" },
          "query_key":      { "type": "string" },
          "onMutate_steps": { "type": "array", "items": { "type": "string" } },
          "rollback_steps": { "type": "array", "items": { "type": "string" } }
        }
      }
    },
    "offline_strategy":  { "type": ["object", "null"] },
    "realtime_bridge":   { "type": ["object", "null"] },
    "persistence_config":{ "type": "object" },
    "migration_notes":   { "type": ["object", "null"] },
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

- Access tokens MUST NEVER be recommended for `localStorage` storage — only `memory` or `httpOnly cookie`. Violations are blocking errors.
- Server state (API responses) MUST NOT be duplicated into a global client store — direct the architect to TanStack Query / SWR cache as the single source of truth.
- Every recommended library must specify a version constraint (semver range, e.g., `>=5.0.0 <6`).
- `state_topology.topology_diagram` MUST be valid Mermaid syntax (graph LR or flowchart).
- If `offline_support: true` but no persistence adapter is compatible with `app_type`, emit `feedback` with `type: backpropagate` targeting `requirement-analyzer`.
- For `large` teams, every store slice MUST include a devtools/logging recommendation.
- `migration_notes` is required when `existing_libraries` is non-empty.
- Form state MUST remain local to the form component unless cross-form sharing is explicitly required.

## Security Considerations

- Access tokens stored in memory (JS variable, Zustand store) are cleared on page reload — always pair with silent-refresh patterns using `httpOnly` refresh token cookies.
- Do not recommend `redux-devtools-extension` in production builds without disabling state serialization (avoid leaking sensitive state to DevTools in prod).
- `redux-persist-transform-encrypt` should be recommended for any slice containing PII or auth credentials.
- Sensitive state fields (passwords, raw tokens) must be explicitly excluded from persistence adapters via `blacklist` or `partialize` exclusion.
- CSRF tokens should reside in a dedicated non-persisted store slice with short TTL.

## Token Optimization

- Pass `context` as a shallow reference — only include module names and state-relevant feature flags, not full architecture JSON.
- Skip `offline_strategy` and `realtime_bridge` generation when corresponding boolean inputs are `false`.
- For `state_patterns`, return hints (1-2 line pseudocode) rather than full implementation code — code-generator handles full expansion.

## Quality Checklist

- [ ] Every `state_category` in input has at least one library recommendation
- [ ] No access token in `localStorage` — flagged as security violation if found
- [ ] `topology_diagram` Mermaid renders without syntax errors
- [ ] `cache_strategy.invalidation_map` covers all mutation operations identified in feature plan
- [ ] `optimistic_update_patterns` include rollback steps for every operation
- [ ] `persistence_config.encrypted_fields` lists all auth/PII fields
- [ ] Each `library_recommendations` entry includes at least one `trade_offs` item
- [ ] Migration notes present if `existing_libraries` non-empty

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| `framework` incompatible with recommended library | Emit `feedback.warning`, recommend next-best alternative for that framework |
| `realtime_sync: true` but no WebSocket support in `app_type` context | Emit `feedback.backpropagate` to `requirement-analyzer`, suggest SSE fallback |
| Conflicting `existing_libraries` prevent clean migration | Produce coexistence adapter pattern, flag with `requires_review` status |
| `state_categories` empty | Return `{"error": "EMPTY_STATE_CATEGORIES", "message": "At least one category required"}` |
| `offline_support: true` and `realtime_sync: true` simultaneously | Produce conflict-resolution matrix, flag as `requires_review` |

## 12. Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Behavior |
|------|---------|---------|----------|
| Architecture sign-off | `migration_notes` present with breaking library changes | 3600s | Present migration impact, coexistence plan, and bundle size delta for approval |
| Security exception | Any auth state pattern deviating from memory-only access token recommendation | 3600s | Present risk analysis; require explicit sign-off before proceeding |

## 13. Skill Composition

`state-management-architect` runs after `architecture-design` and before `code-generator`:

```yaml
composes:
  - skill: state-management-architect
    version: "^1.0.0"
    input_map:
      app_type:         "session.app_type"
      state_categories: "feature_plan.state_concerns"
      framework:        "session.framework"
      offline_support:  "session.offline_support"
      realtime_sync:    "session.realtime_sync"
      context:          "system_architecture"
    output_map:
      library_recommendations: "state.library_recommendations"
      cache_strategy:          "state.cache_strategy"
      state_patterns:          "state.patterns"
```

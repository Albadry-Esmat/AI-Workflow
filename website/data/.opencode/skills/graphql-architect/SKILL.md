---
name: graphql-architect
version: 1.0.0
domain: api
description: >
  Use when designing production-grade GraphQL APIs including schema-first SDL design, resolver architecture, DataLoader patterns, federation topology, subscription support, or field-level authorization. Triggers on: "design the GraphQL API", "GraphQL schema design", "Apollo Federation", "DataLoader N+1 prevention", "GraphQL subscription architecture". Do NOT use for REST or HTTP API design — use api-design-architect instead.
author: system
---

## Purpose

Design production-grade GraphQL APIs from schema-first principles, covering every layer from SDL type definitions through to resolver execution architecture. This skill enforces the Relay Connection Specification for cursor-based pagination, DataLoader patterns to prevent N+1 query problems at the resolver level, mutation design conventions (input types, payload types, error unions), and subscription transport selection (WebSocket via graphql-ws vs. Server-Sent Events for simpler use cases).

The skill handles both monolithic GraphQL servers and federated architectures using Apollo Federation v2. For federated designs it produces subgraph SDL definitions, entity resolution (`@key` directives), and router configuration hints so teams building individual subgraphs can work in isolation without breaking federation contracts. Schema evolution strategies — field deprecation, type renaming, breaking vs. non-breaking changes — are built in to protect clients across versions.

Beyond schema design, this skill addresses the operational concerns that make GraphQL APIs safe in production: query depth and complexity limits, persisted query maps, field-level authorization directives (`@auth`, `@hasRole`), and introspection disabling in production. The output is consumed directly by `code-generator` for resolver scaffolding and by `test-generator` for schema contract tests and DataLoader unit tests.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `requirements` | `object` | Yes | Functional and non-functional requirements from requirement-analyzer |
| `entities` | `array[object]` | Yes | Domain entities with fields and relationships (name, fields[], relations[]) |
| `federation` | `boolean` | No | Whether to design for Apollo Federation v2 (default: `false`) |
| `subscription_support` | `boolean` | No | Whether to include subscription operations (default: `false`) |
| `auth_model` | `string` | No | Authorization granularity: `field_level` \| `type_level` \| `resolver_level` |
| `complexity_limit` | `integer` | No | Maximum query complexity score before rejection (default: `1000`) |
| `context` | `object` | No | Session context: existing schema, subgraph ownership map, transport config |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["requirements", "entities"],
  "properties": {
    "requirements": {
      "type": "object",
      "properties": {
        "functional":     { "type": "array", "items": { "type": "object" } },
        "non_functional": { "type": "array", "items": { "type": "object" } }
      }
    },
    "entities": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": ["name"],
        "properties": {
          "name":      { "type": "string" },
          "fields":    { "type": "array", "items": { "type": "object" } },
          "relations": { "type": "array", "items": { "type": "object" } }
        }
      }
    },
    "federation":             { "type": "boolean", "default": false },
    "subscription_support":   { "type": "boolean", "default": false },
    "auth_model": {
      "type": "string",
      "enum": ["field_level", "type_level", "resolver_level"]
    },
    "complexity_limit":       { "type": "integer", "minimum": 100, "default": 1000 },
    "context":                { "type": "object" }
  }
}
```

## Required Context

- Validated requirements from `requirement-analyzer` — used to derive query and mutation semantics.
- Architecture module map from `architecture-design` — required to assign federation subgraph ownership when `federation: true`.
- For federated designs: existing subgraph SDL files must be available in `context.existing_subgraphs` to prevent entity key conflicts.
- If `subscription_support: true`: transport infrastructure decisions (WebSocket gateway, SSE proxy) must be derivable from `context.infrastructure`.

## Execution Logic

```
Step 1 — Analyze requirements and model the type system
  Group entities by domain affinity. Identify root query fields (entry points per use case).
  Map entity relationships to GraphQL type references (one-to-one, one-to-many via Connection).
  Identify scalar types requiring custom definitions (DateTime, UUID, JSON, URL, EmailAddress).
  Output: type_map { entity_name, graphql_type, custom_scalars[], root_fields[] }

Step 2 — Design Relay-compliant connections and pagination
  For every one-to-many and many-to-many relationship: apply Relay Connection Specification.
  Connection type shape:
    type {Entity}Connection { edges: [{Entity}Edge!]! pageInfo: PageInfo! totalCount: Int! }
    type {Entity}Edge       { node: {Entity}! cursor: String! }
    type PageInfo           { hasNextPage: Boolean! hasPreviousPage: Boolean! startCursor: String endCursor: String }
  Root list queries: query { users(first: Int, after: String, last: Int, before: String): UserConnection! }
  Output: connection_types_sdl

Step 3 — Design mutations using input/payload pattern
  For every mutating operation: define a dedicated Input type and a Payload union type.
    input CreateUserInput { email: String! name: String! }
    union CreateUserResult = User | ValidationError | ConflictError
    type Mutation { createUser(input: CreateUserInput!): CreateUserResult! }
  Error types in unions carry structured fields (code, message, field) — never raw strings.
  Assign client mutation ID to all input types for client-side optimistic update tracking.
  Output: mutation_sdl, error_union_types

Step 4 — Plan DataLoader batching strategy
  For every relation field that resolves via a foreign key: define a DataLoader entry.
    DataLoader key: parent entity ID (or composite key for junction tables)
    DataLoader batch function: SELECT * FROM {table} WHERE id = ANY($1)
    Caching: per-request cache (Map), cleared between GraphQL requests — never global cache.
  Document field-to-DataLoader mapping in resolver_architecture.dataloader_map.
  Flag any field missing a DataLoader that has N-to-1 or N-to-many join behavior.
  Output: dataloader_plan { field, parent_type, loader_key, batch_fn_hint }

Step 5 — Handle federation (if federation: true)
  Assign each entity to an owning subgraph based on architecture module boundaries.
  For shareable entities: define @key(fields: "id") on owning subgraph type.
  For extended entities: define stub type with @key + @external fields in extending subgraph.
  Compose subgraph SDL files: each is a valid standalone GraphQL schema with federation directives.
  Router config: define supergraph composition hints (Apollo Router configuration).
  Output: federation_config { subgraphs[], entity_ownership_map, router_config_hint }

Step 6 — Design subscriptions (if subscription_support: true)
  Select transport:
    graphql-ws (WebSocket):  bidirectional, stateful, recommended for real-time dashboards and chat.
    SSE + HTTP:              server-push only, simpler infrastructure, recommended for feed/notification use cases.
  Define subscription operation signatures and payload types.
  Authorization: subscriptions MUST inherit the same authorization model as equivalent queries.
  Output: subscription_sdl, subscription_design { transport, auth_strategy, reconnect_behavior }

Step 7 — Define complexity and depth limits
  Complexity scoring: leaf field = 1, connection field = multiplier based on first/last argument.
  Depth limit: maximum query nesting depth (default: 10 for monolith, 7 for federated).
  Persisted queries: enumerate approved query hash list for production (disable ad-hoc in prod).
  Introspection: disable in production environments; enable in development and staging only.
  Output: complexity_rules { max_complexity, max_depth, persisted_queries_enabled, introspection_prod_disabled }

Step 8 — Authorization directives
  Apply auth_model:
    field_level:    @auth(requires: Role) on individual field definitions
    type_level:     @auth(requires: Role) on type definitions
    resolver_level: authorization logic is pushed into resolver implementations (documented as comments)
  Define Role enum and @auth directive schema definition.
  Output: authorization_directives[], auth_directive_sdl

Step 9 — Performance recommendations and schema evolution
  Identify query paths with unbounded depth (recursive types) — add depth-limit annotations.
  Identify fields likely to be hot (high frequency, large payloads) — recommend caching hints (@cacheControl).
  Schema evolution strategy: use @deprecated(reason: "...") for all removals, minimum 2-version deprecation window.
  Output: performance_recommendations[], schema_evolution_plan

Step 10 — Assemble complete GraphQL SDL
  Merge all SDL fragments: scalars, types, connections, mutations, subscriptions, directives.
  Validate: no duplicate type names, all types referenced exist, all directives declared.
  Output: schema_sdl (complete single-document SDL string)
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `schema_sdl` | `string` | Complete GraphQL SDL — single document, all types, directives, and scalars |
| `resolver_architecture` | `object` | Resolver map with DataLoader plan and execution strategy per field |
| `federation_config` | `object` | Subgraph SDL files, entity ownership map, router config (if `federation: true`) |
| `subscription_design` | `object` | Transport selection, subscription SDL, reconnect strategy (if enabled) |
| `complexity_rules` | `object` | max_complexity, max_depth, persisted_queries_enabled, introspection policy |
| `authorization_directives` | `array[object]` | Auth directive definitions with role mappings per type/field |
| `performance_recommendations` | `array[string]` | Identified hot paths, caching hints, unbounded depth warnings |
| `metrics` | `object` | tokens_in, tokens_out, duration_ms, items_produced, version |
| `feedback` | `array[object]` | Backpropagate entries for upstream skills if specification gaps found |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["schema_sdl", "resolver_architecture", "complexity_rules", "authorization_directives", "performance_recommendations", "metrics", "feedback"],
  "properties": {
    "schema_sdl": { "type": "string", "minLength": 1 },
    "resolver_architecture": {
      "type": "object",
      "properties": {
        "resolver_map":   { "type": "object" },
        "dataloader_map": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["field", "parent_type", "loader_key"],
            "properties": {
              "field":        { "type": "string" },
              "parent_type":  { "type": "string" },
              "loader_key":   { "type": "string" },
              "batch_fn_hint":{ "type": "string" }
            }
          }
        }
      }
    },
    "federation_config": {
      "type": "object",
      "properties": {
        "subgraphs":            { "type": "array" },
        "entity_ownership_map": { "type": "object" },
        "router_config_hint":   { "type": "object" }
      }
    },
    "subscription_design": {
      "type": "object",
      "properties": {
        "transport":          { "type": "string", "enum": ["graphql-ws", "sse"] },
        "subscription_sdl":   { "type": "string" },
        "auth_strategy":      { "type": "string" },
        "reconnect_behavior": { "type": "string" }
      }
    },
    "complexity_rules": {
      "type": "object",
      "required": ["max_complexity", "max_depth"],
      "properties": {
        "max_complexity":              { "type": "integer" },
        "max_depth":                   { "type": "integer" },
        "persisted_queries_enabled":   { "type": "boolean" },
        "introspection_prod_disabled": { "type": "boolean" }
      }
    },
    "authorization_directives": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["directive_name", "target_type", "role_required"],
        "properties": {
          "directive_name": { "type": "string" },
          "target_type":    { "type": "string" },
          "target_field":   { "type": "string" },
          "role_required":  { "type": "string" }
        }
      }
    },
    "performance_recommendations": { "type": "array", "items": { "type": "string" } },
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

- Every entity in `entities` MUST appear as a GraphQL type in `schema_sdl`.
- All one-to-many and many-to-many relations MUST use Relay Connection types — bare list fields (`[T!]!`) on root types are a violation.
- Every mutation MUST use dedicated Input and Payload/Result types — no scalar-only mutations or bare return types.
- Every resolver-level relation field MUST have a DataLoader entry in `resolver_architecture.dataloader_map`.
- Query complexity limit MUST be enforced at the server level — `complexity_limit: 0` is a violation.
- `introspection_prod_disabled: false` is a security violation for production-facing APIs.
- When `federation: true` every federated entity MUST declare a `@key` directive with at least one resolvable field.
- Schema evolution removals MUST go through `@deprecated` first — immediate removal of a non-deprecated field is a critical violation.

## Security Considerations

- Introspection MUST be disabled in all production environments to prevent schema enumeration attacks.
- Query depth and complexity limits are mandatory security controls — not optional performance hints.
- Subscription connections MUST authenticate using the same token/session as HTTP requests; WebSocket upgrade MUST verify auth before establishing connection.
- Field-level authorization directives must be documented even when `auth_model: resolver_level` is selected — to prevent authorization bypass by future schema additions.
- Persisted queries must be used in production to prevent injection via crafted query strings.

## Token Optimization

- Pass `entities` as compact objects (name + field names only) — strip descriptions and metadata.
- For schemas with > 30 entities, generate SDL in sections (queries, mutations, types) and store full SDL to state; return only a structural summary in the response.
- DataLoader map can be summarized as `{ field, parent_type }` pairs when context budget is constrained.
- Federation subgraph SDLs can be stored to state and referenced by name — do not inline all subgraphs in main response when > 3 subgraphs.

## Quality Checklist

- [ ] Every entity in `entities` appears as a named type in `schema_sdl`
- [ ] All one-to-many/many-to-many relations use Relay Connection types
- [ ] All mutations have dedicated Input and Payload types
- [ ] Every relation field has a DataLoader entry
- [ ] `complexity_limit` is set and enforced
- [ ] `introspection_prod_disabled: true` in `complexity_rules`
- [ ] Authorization directives cover all protected types and fields
- [ ] Schema SDL has no duplicate type definitions and all references resolve
- [ ] `@deprecated` used for any removed or renamed fields

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| `entities` array is empty | Reject: `{"error": "NO_ENTITIES", "min_entities": 1}` |
| `federation: true` but no architecture module map available | Emit backpropagate to `architecture-design`; block federation_config generation |
| Circular type reference detected | Flag as warning, add depth limit annotation, emit performance_recommendation |
| `subscription_support: true` but infrastructure context missing | Generate subscription SDL with placeholder transport; emit info feedback requesting transport config |
| Entity name collision with built-in GraphQL scalars | Auto-rename with domain prefix, emit warning in feedback |
| `complexity_limit` too low (< 100) | Override to minimum 100, emit warning |

## 12. Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Behavior |
|------|---------|---------|----------|
| Federation topology review | `federation: true` AND proposed subgraph count > 3 | 7200s | Pause; present entity ownership map and subgraph boundary proposal for senior architecture review before SDL generation proceeds |
| Breaking schema change | Field removal or type change in an existing non-deprecated schema element | 3600s | Pause; present breaking change diff and require human sign-off |

- Federation gate presents: subgraph list, entity ownership map, cross-subgraph entity dependencies, estimated composition risk.
- If rejected at gate: re-invoke from Step 5 with revised subgraph boundaries.

## 13. Skill Composition

`graphql-architect` is invoked after `architecture-design` and produces schema artifacts consumed by `code-generator` (resolver scaffolds) and `test-generator` (contract and DataLoader tests):

```yaml
composes:
  - skill: graphql-architect
    version: "^1.0.0"
    input_map:
      requirements: "validated_requirements"
      entities:     "architecture.modules[*].entities"
      federation:   "session.use_federation"
    output_map:
      schema_sdl:            "state.graphql_schema"
      resolver_architecture: "state.resolver_map"
      federation_config:     "state.federation_config"
```

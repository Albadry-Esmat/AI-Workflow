---
name: microservices-architect
version: 1.0.0
domain: architecture
description: >
  Use when decomposing monolithic or complex systems into microservices, applying Domain-Driven Design, defining service boundaries, designing saga patterns, or producing team topology alignment analysis. Triggers on: "decompose into microservices", "service boundary design", "bounded context map", "DDD decomposition", "Conway's Law analysis". Do NOT use for high-level system architecture — use architecture-design first. Do NOT use for GraphQL federation topology — use graphql-architect instead.
author: system
---

## Purpose

Decompose monolithic or complex systems into correctly bounded microservices using Domain-Driven Design principles, producing a complete service map with inter-service communication patterns, distributed transaction designs, and team topology alignment analysis. This skill goes substantially deeper than `architecture-design`'s general module decomposition — it specializes in the correctness of service boundaries, the avoidance of distributed monolith anti-patterns, and the practical tradeoffs of microservice adoption.

The skill applies DDD tactical and strategic patterns systematically: bounded context identification using linguistic boundaries and change frequency analysis, aggregate root discovery, domain event cataloging, and context map relationship types (partnership, customer/supplier, conformist, anti-corruption layer). It produces service decomposition recommendations that distinguish genuinely independent services from anemic micro-services that would create more coupling than they eliminate.

For teams migrating from a monolith, this skill produces a Strangler Fig migration plan — identifying which modules to extract first (highest isolation, lowest data coupling), how to run old and new systems in parallel, and when to cut over. For new systems, it produces a greenfield service topology with justification for each boundary decision. Conway's Law analysis ensures team structure is considered alongside technical decomposition, preventing the common failure mode where service boundaries misalign with team ownership.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `domain_description` | `string` | Yes | Description of the business domain, core use cases, and entities involved |
| `existing_modules` | `array[object]` | No | Current monolith modules with name, responsibility, and data ownership |
| `team_topology` | `array[object]` | No | Teams with name, size, and current ownership areas |
| `communication_preference` | `string` | No | `sync` \| `async` \| `hybrid` (default: `hybrid`) |
| `consistency_model` | `string` | No | `strong` \| `eventual` (default: `eventual`) |
| `context` | `object` | No | Session context: existing architecture, known pain points, target cloud platform |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["domain_description"],
  "properties": {
    "domain_description": { "type": "string", "minLength": 50 },
    "existing_modules": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["name", "responsibility"],
        "properties": {
          "name":           { "type": "string" },
          "responsibility": { "type": "string" },
          "data_owned":     { "type": "array", "items": { "type": "string" } },
          "change_frequency": {
            "type": "string",
            "enum": ["high", "medium", "low"]
          }
        }
      }
    },
    "team_topology": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["name"],
        "properties": {
          "name":            { "type": "string" },
          "size":            { "type": "integer" },
          "ownership_areas": { "type": "array", "items": { "type": "string" } },
          "team_type": {
            "type": "string",
            "enum": ["stream_aligned", "platform", "enabling", "complicated_subsystem"]
          }
        }
      }
    },
    "communication_preference": {
      "type": "string",
      "enum": ["sync", "async", "hybrid"],
      "default": "hybrid"
    },
    "consistency_model": {
      "type": "string",
      "enum": ["strong", "eventual"],
      "default": "eventual"
    },
    "context": { "type": "object" }
  }
}
```

## Required Context

- Architecture overview from `architecture-design` — required as the starting point for boundary refinement.
- If migrating from a monolith: existing module list with data ownership map is essential for safe extraction ordering.
- Team topology information is strongly recommended — without it, Conway's Law analysis falls back to a generic recommendation.
- Cloud platform target from `context.platform` — affects service discovery approach (Kubernetes service mesh vs. cloud-native discovery).

## Execution Logic

```
Step 1 — Model the domain with DDD strategic patterns
  Identify core domain (competitive differentiator), supporting domains, and generic subdomains.
  Apply linguistic boundary detection: separate ubiquitous language clusters indicate separate contexts.
  Map entity ownership: which entities belong exclusively to which domain cluster?
  Identify domain events that cross cluster boundaries (integration events).
  Output: domain_model { core_domain, supporting_domains[], generic_subdomains[], language_clusters[] }

Step 2 — Identify and define bounded contexts
  For each language cluster: define a bounded context with:
    - Name (noun phrase from ubiquitous language)
    - Responsibility statement (one sentence)
    - Owned aggregates and entities
    - Integration events produced and consumed
    - Change frequency classification (high/medium/low)
  Apply Bounded Context relationship types (context map):
    partnership:          two teams develop contexts together, synchronize frequently
    customer_supplier:    downstream depends on upstream, upstream shapes API to downstream needs
    conformist:           downstream accepts upstream's model as-is
    anti_corruption_layer: downstream translates upstream model to its own — isolates from external complexity
    published_language:   upstream publishes a well-documented shared language (e.g., OpenAPI, AsyncAPI)
    shared_kernel:        two contexts share a small subset of the domain model (use sparingly)
  Output: bounded_contexts[], context_map_relationships[]

Step 3 — Define service boundaries and decomposition
  Map each bounded context to a candidate microservice.
  Apply decomposition fitness criteria:
    KEEP as one service if: single team ownership, co-deployed always, shared database is unavoidable.
    SPLIT if: different change frequencies, different teams, independent scalability needs.
    MERGE if: two services always call each other synchronously in a chain (chatty coupling).
  Flag anemic services: services with < 3 domain operations or no owned data — recommend merging.
  Identify and flag distributed monolith risk: synchronous call chains > 3 hops deep.
  Output: service_map[] { service_name, responsibility, owned_aggregates[], apis[], events_produced[], events_consumed[] }

Step 4 — Design inter-service communication
  For each service-to-service interaction: select communication pattern.
  Pattern selection table:
    sync REST/gRPC:    query patterns, user-facing request/response, SLA < 200ms
    async events:      state change notifications, fire-and-forget, decoupled workflows
    saga choreography: distributed transaction without a coordinator (each service reacts to events)
    saga orchestration: distributed transaction with an explicit orchestrator service
  Apply communication_preference override where specified.
  Produce inter-service communication matrix.
  Output: communication_design { sync_calls[], async_events[], saga_patterns[] }

Step 5 — Design saga patterns for distributed transactions
  For each business process spanning > 1 service: design a saga.
  Choreography saga: list of domain events and compensating events per step.
    Step 1: Service A publishes OrderPlaced → Service B processes → publishes PaymentCharged or PaymentFailed
    Compensating: PaymentFailed → Service A publishes OrderCancelled (compensation)
  Orchestration saga: define an explicit Saga Orchestrator service/workflow with:
    command: each step sends a command to a target service
    reply: service replies with success or failure event
    compensation: on failure, orchestrator issues compensating commands in reverse order
  Choose choreography for simple 2-4 step sagas; orchestration for > 4 steps or complex branching.
  Output: saga_designs[] { saga_name, type, steps[], compensating_steps[], failure_modes[] }

Step 6 — Design API gateway layer
  Define gateway responsibilities: routing, auth, rate limiting, request aggregation, protocol translation.
  Select gateway pattern:
    BFF (Backend for Frontend): one gateway per client type (web, mobile, partner API)
    Single gateway:             unified entry point for all clients
    Service mesh sidecar:       cross-cutting concerns handled by service mesh (Istio, Linkerd)
  Define gateway routing rules per service.
  Output: api_gateway_design { pattern, gateway_instances[], routing_rules[], cross_cutting_concerns[] }

Step 7 — Service discovery and deployment topology
  Select discovery strategy:
    client-side: services query registry (Eureka, Consul) — suitable for JVM ecosystems
    server-side: load balancer/proxy handles discovery (Kubernetes Service, AWS ALB) — cloud-native default
    service mesh: transparent discovery via sidecar proxies — recommended for polyglot environments
  Define health check patterns: /health/live, /health/ready per service.
  Output: service_discovery_config { strategy, registry, health_check_patterns[] }

Step 8 — Migration strategy (if existing_modules provided)
  Apply Strangler Fig pattern:
    Phase 1: Identify lowest-risk extraction candidates (high isolation, small data footprint).
    Phase 2: Deploy new service alongside monolith; route new traffic to new service.
    Phase 3: Migrate data from monolith schema to new service schema (dual-write period).
    Phase 4: Cut over all traffic; monitor for parity errors.
    Phase 5: Remove deprecated monolith module.
  Prioritize extraction by: change frequency (high first) × coupling score (low first).
  Output: migration_strategy { strangler_fig_phases[], extraction_order[], dual_write_period_config }

Step 9 — Conway's Law analysis
  For each proposed service: check that exactly one team has clear ownership.
  Flag services without a clear team owner — ownership gaps predict future coordination failures.
  Flag services with > 1 team owning different parts — predict interface friction.
  Recommend team structure adjustments where decomposition misaligns with team topology.
  Output: team_alignment { service_team_map[], ownership_gaps[], recommended_team_changes[] }
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `bounded_contexts` | `array[object]` | Context definitions: name, entities, domain_events, team, relationships |
| `service_map` | `array[object]` | Services: name, responsibility, apis[], events_produced[], events_consumed[] |
| `communication_design` | `object` | Sync calls, async events, saga pattern designs |
| `api_gateway_design` | `object` | Gateway pattern, routing rules, cross-cutting concern assignments |
| `migration_strategy` | `object` | Strangler Fig phases, extraction order, dual-write config (if migrating) |
| `team_alignment` | `object` | Conway's Law analysis, service-team map, ownership gap warnings |
| `metrics` | `object` | tokens_in, tokens_out, duration_ms, items_produced, version |
| `feedback` | `array[object]` | Backpropagate entries for upstream skills if architecture gaps found |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["bounded_contexts", "service_map", "communication_design", "api_gateway_design", "team_alignment", "metrics", "feedback"],
  "properties": {
    "bounded_contexts": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["name", "responsibility", "owned_aggregates"],
        "properties": {
          "name":                 { "type": "string" },
          "responsibility":       { "type": "string" },
          "owned_aggregates":     { "type": "array", "items": { "type": "string" } },
          "domain_events":        { "type": "array", "items": { "type": "string" } },
          "team":                 { "type": "string" },
          "change_frequency":     { "type": "string", "enum": ["high", "medium", "low"] },
          "context_relationships":{ "type": "array" }
        }
      }
    },
    "service_map": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["service_name", "responsibility"],
        "properties": {
          "service_name":       { "type": "string" },
          "responsibility":     { "type": "string" },
          "owned_aggregates":   { "type": "array", "items": { "type": "string" } },
          "apis":               { "type": "array", "items": { "type": "object" } },
          "events_produced":    { "type": "array", "items": { "type": "string" } },
          "events_consumed":    { "type": "array", "items": { "type": "string" } }
        }
      }
    },
    "communication_design": {
      "type": "object",
      "properties": {
        "sync_calls":    { "type": "array" },
        "async_events":  { "type": "array" },
        "saga_patterns": { "type": "array" }
      }
    },
    "api_gateway_design": {
      "type": "object",
      "properties": {
        "pattern":                  { "type": "string" },
        "gateway_instances":        { "type": "array" },
        "routing_rules":            { "type": "array" },
        "cross_cutting_concerns":   { "type": "array", "items": { "type": "string" } }
      }
    },
    "migration_strategy": {
      "type": "object",
      "properties": {
        "strangler_fig_phases":    { "type": "array" },
        "extraction_order":        { "type": "array", "items": { "type": "string" } },
        "dual_write_period_config":{ "type": "object" }
      }
    },
    "team_alignment": {
      "type": "object",
      "properties": {
        "service_team_map":          { "type": "array" },
        "ownership_gaps":            { "type": "array", "items": { "type": "string" } },
        "recommended_team_changes":  { "type": "array", "items": { "type": "string" } }
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

- Every proposed service MUST map to at least one bounded context — orphan services with no DDD boundary justification are violations.
- Synchronous call chains deeper than 3 hops MUST be flagged as distributed monolith risk in `feedback`.
- Anemic services (< 3 domain operations and no owned data) MUST be flagged for merge consideration.
- When `consistency_model: strong`, saga designs MUST use orchestration pattern — choreography does not guarantee strong consistency.
- Every service in `service_map` MUST have exactly one owning team documented in `team_alignment.service_team_map`.
- `migration_strategy` MUST include dual-write period configuration when data migration is required.
- The HITL gate at > 20 services is mandatory and cannot be bypassed — microservice tax assessment protects against over-decomposition.

## Security Considerations

- Service-to-service calls MUST be documented with their authentication mechanism (mutual TLS, service account JWT, API key).
- API gateway MUST be the only public entry point — internal services must not be internet-exposed.
- Saga compensating transactions must be designed to be idempotent — double-execution of a compensation must not corrupt state.
- Service discovery registry must be access-controlled — unauthorized service registration enables man-in-the-middle routing attacks.

## Token Optimization

- Compress `domain_description` to key entity nouns and verb phrases before analysis.
- For large decompositions (> 15 services), summarize `service_map` per domain cluster and store full detail to state.
- `saga_patterns` can be summarized as step-count + type when context is constrained; full choreography/orchestration diagrams stored to state.
- Pass `existing_modules` as name + responsibility pairs only — strip implementation details.

## Quality Checklist

- [ ] Every bounded context has a clear responsibility statement and at least one owned aggregate
- [ ] Every service maps to exactly one bounded context
- [ ] No anemic services (< 3 operations and no data ownership) without documented merge reasoning
- [ ] No synchronous call chains > 3 hops deep without explicit justification
- [ ] Every saga has compensating transactions documented for each failure mode
- [ ] Every service has exactly one team owner in `team_alignment`
- [ ] `api_gateway_design` addresses authentication and rate limiting as cross-cutting concerns
- [ ] `migration_strategy` is present when `existing_modules` is provided

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| `domain_description` is too short (< 50 chars) | Reject: `{"error": "INSUFFICIENT_DOMAIN_DESCRIPTION", "min_length": 50}` |
| > 20 services proposed without HITL approval | Trigger HITL gate; block `service_map` output until human signs off |
| Circular service dependencies detected | Flag as critical violation; propose event-driven decoupling; emit feedback |
| Team topology provided but team count < service count | Flag ownership gaps; emit warning per unowned service |
| No clear core domain identified | Emit backpropagate to `requirement-analyzer` requesting domain clarification |
| `consistency_model: strong` with choreography saga proposed | Override to orchestration pattern, emit warning |

## 12. Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Behavior |
|------|---------|---------|----------|
| Microservice tax assessment | Proposed `service_map.length > 20` | 7200s | Pause; present service count, anemic service analysis, and modular monolith alternative recommendation; require explicit human approval to proceed with > 20 services |
| Monolith extraction plan approval | `migration_strategy` is generated | 3600s | Pause; present Strangler Fig phase plan, data migration risk, and dual-write period requirements for sign-off |

- The microservice tax gate presents: service count, anemic service list, cross-service dependency graph, and a scored recommendation for modular monolith vs. full microservices.
- If the human rejects the decomposition: re-invoke from Step 3 with a higher merge threshold.

## 13. Skill Composition

`microservices-architect` is invoked after `architecture-design` and feeds into `event-schema-designer`, `api-design-architect`, and `deployment-strategy`:

```yaml
composes:
  - skill: microservices-architect
    version: "^1.0.0"
    input_map:
      domain_description:      "requirements.domain_summary"
      existing_modules:        "architecture.modules"
      team_topology:           "session.team_topology"
      communication_preference: "session.communication_preference"
    output_map:
      bounded_contexts:     "state.bounded_contexts"
      service_map:          "state.service_map"
      communication_design: "state.inter_service_communication"
```

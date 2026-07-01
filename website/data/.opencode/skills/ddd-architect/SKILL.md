---
name: ddd-architect
version: 1.0.0
domain: architecture
description: >
  Use when applying Domain-Driven Design strategic and tactical patterns to complex business domains.
  Triggers on: "apply DDD", "define bounded contexts", "design aggregates", "ubiquitous language
  glossary", "context map", "subdomain classification", "domain event design". Do NOT use for
  simple CRUD applications, single-table data models, or systems with fewer than 3 business
  subdomains — use architecture-design directly for those cases.
author: system
---

## Purpose

Apply Domain-Driven Design (DDD) strategic and tactical patterns to produce a comprehensive domain model that guides all downstream architecture, database, and implementation decisions. The skill covers the full DDD modeling lifecycle: from strategic analysis (bounded context identification, context mapping with relationship patterns, subdomain classification) through tactical design (aggregate root identification, invariant enforcement, domain event definition, value object vs. entity classification, domain service boundaries, repository interface contracts).

Strategic patterns are applied first because they define isolation boundaries that prevent coupling — the Context Map produced here directly shapes microservice decomposition in `architecture-design` and database schema boundaries in `database-architect`. The skill enforces Eric Evans' original patterns while incorporating Vaughn Vernon's implementation guidance from "Implementing Domain-Driven Design" — specifically aggregate design rules (one aggregate per transaction, small aggregates, reference by identity), domain event naming conventions (past tense, `OrderPlaced` not `PlaceOrder`), and anti-corruption layer (ACL) placement for integrating with legacy or third-party contexts.

The skill produces a machine-readable domain model output — bounded context map, aggregate specs, domain event catalog, ubiquitous language glossary — that serves as the input contract for `architecture-design`, `database-architect`, and `code-generator`. A Mermaid context map diagram is produced for visual communication with stakeholders. Subdomains are classified by strategic importance (Core, Supporting, Generic) to guide investment prioritization: Core domains get custom implementation; Generic domains use off-the-shelf solutions.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `domain_description` | `string` | Yes | High-level description of the business domain (1-3 paragraphs) |
| `business_processes` | `array[object]` | Yes | Key business processes: `process_name`, `steps[]`, `actors[]`, `outcome` |
| `existing_bounded_contexts` | `array[object]` | No | Already-identified bounded contexts (name, responsibilities) to avoid duplication |
| `team_structure` | `array[object]` | No | Conway's Law input: team names and domain responsibilities they own |
| `subdomain_priority` | `string` | No | Which subdomain type to analyze deepest: `core`, `supporting`, `generic`. Default: `core` |
| `integration_constraints` | `array[string]` | No | External systems requiring ACL or conformist relationships |
| `context` | `object` | No | Upstream context (requirements, architecture) |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["domain_description", "business_processes"],
  "properties": {
    "domain_description": { "type": "string", "minLength": 50 },
    "business_processes": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": ["process_name", "steps"],
        "properties": {
          "process_name": { "type": "string" },
          "steps":        { "type": "array", "items": { "type": "string" } },
          "actors":       { "type": "array", "items": { "type": "string" } },
          "outcome":      { "type": "string" }
        }
      }
    },
    "existing_bounded_contexts": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name":             { "type": "string" },
          "responsibilities": { "type": "array", "items": { "type": "string" } }
        }
      }
    },
    "team_structure": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "team_name":      { "type": "string" },
          "domain_areas":   { "type": "array", "items": { "type": "string" } }
        }
      }
    },
    "subdomain_priority": {
      "type": "string",
      "enum": ["core", "supporting", "generic"],
      "default": "core"
    },
    "integration_constraints": {
      "type": "array",
      "items": { "type": "string" }
    },
    "context": { "type": "object" }
  }
}
```

## Required Context

- Business process descriptions and domain expert language from `requirement-analyzer` or directly from the user.
- Team topology from `team_structure` input (Conway's Law alignment for bounded context ownership).
- Any existing architecture from `architecture-design` if this is a refactoring exercise.

## Execution Logic

```
Step 1 — Domain vision and language extraction
  Write a 2-sentence domain vision statement from domain_description.
  Extract candidate terms (nouns, verbs, domain-specific jargon) from domain_description and process steps.
  Identify terminology conflicts (same word, different meanings in different contexts).
  Output: domain_vision_statement, candidate_terms[]

Step 2 — Subdomain identification and classification
  Group business_processes by functional affinity and strategic importance.
  Classify each subdomain:
    Core:      unique competitive advantage; custom build; highest investment
    Supporting: enables core but not differentiating; build or buy based on complexity
    Generic:   commodity; buy off-the-shelf (email, auth, payments via Stripe)
  Apply subdomain_priority: deepen tactical analysis for the priority subdomain type.
  Output: subdomain_classification [{ subdomain, type, processes[], strategic_importance, build_vs_buy }]

Step 3 — Bounded context identification
  Derive bounded contexts from subdomains and language boundary analysis:
    Rule 1: Each context owns its model — no shared mutable state across context boundaries.
    Rule 2: If the same term has different meanings in two areas → two bounded contexts.
    Rule 3: Conway's Law — if team_structure provided, align context boundaries to team ownership.
  For each context: define name, responsibilities[], ubiquitous_language_terms[], owned_aggregates[].
  Avoid God contexts (> 5 aggregates) and Nano contexts (< 1 aggregate).
  Output: bounded_contexts [{ name, responsibilities, language_terms, team_owner, subdomain }]

Step 4 — Produce Context Map
  For each pair of bounded contexts with integration needs, define the relationship pattern:
    Partnership:        two teams planning together; symmetric commitment
    Shared Kernel:      shared code subset; risky, use sparingly; explicit ownership
    Customer-Supplier:  downstream depends on upstream; upstream prioritizes downstream needs
    Conformist:         downstream accepts upstream model wholesale (no translation)
    ACL (Anti-Corruption Layer): downstream translates upstream model to protect its own model
    Open Host Service:  upstream publishes stable protocol; multiple downstreams can integrate
    Published Language: OHS with formal, versioned schema (e.g., JSON Schema, Avro, Protobuf)
    Separate Ways:      no integration; contexts are fully independent
    Big Ball of Mud:    acknowledge existing legacy; plan ACL to protect clean contexts
  Apply integration_constraints: force ACL pattern for listed external systems.
  Produce Mermaid flowchart diagram of context relationships.
  Output: context_map { relationships[], context_map_mermaid }

Step 5 — Ubiquitous language glossary
  For each bounded context, enumerate its authoritative terms:
    term: canonical name within this context
    definition: precise meaning in this context (not general English)
    synonyms_to_avoid: terms used elsewhere that conflict
    examples: 1-2 concrete examples of the term in use
  Flag cross-context homonyms (same word, different definitions) with explicit disambiguation.
  Output: ubiquitous_language [{ term, definition, context, synonyms_to_avoid, examples[] }]

Step 6 — Aggregate design for priority subdomain
  For each aggregate in the priority subdomain's bounded context(s):
    Identify aggregate root (the entity with global identity that guards invariants).
    Define constituent entities (local identity within aggregate) and value objects (identity-less).
    Define invariants: business rules the aggregate must enforce at all times.
    Size rule: prefer small aggregates; large aggregates signal missed subdomain boundaries.
    Transaction rule: one aggregate per transaction; cross-aggregate eventual consistency via domain events.
    Reference rule: aggregates reference each other only by ID, never by direct object reference.
  Output: aggregate_designs [{ aggregate_root, entities[], value_objects[], invariants[], domain_events[] }]

Step 7 — Domain event catalog
  For each business process outcome and aggregate state transition, define a domain event:
    Naming: past tense, domain language (e.g., OrderPlaced, PaymentFailed, InventoryReserved).
    Payload: minimal facts at the time of the event (IDs, key attributes, timestamp, causation_id).
    Producer: aggregate that raises the event.
    Consumers: bounded contexts that react to the event (drives eventual consistency).
  Output: domain_events [{ event_name, payload_fields[], producer_aggregate, consumer_contexts[] }]

Step 8 — Domain service identification
  Identify operations that do not naturally belong to any single aggregate or entity:
    Rule: if an operation requires coordination between multiple aggregates → domain service.
    Rule: if an operation operates on a value that has no identity → domain service or value object method.
    Example: TransferService (coordinates Debit on one Account aggregate + Credit on another).
  Output: domain_services [{ service_name, responsibility, participating_aggregates[], interface_hint }]

Step 9 — Repository interface contracts
  For each aggregate root, define the repository interface:
    findById(id: AggregateRootId): AggregateRoot | None
    save(aggregate: AggregateRoot): void
    nextId(): AggregateRootId (for ID generation)
  Note: repositories are defined at the domain layer as interfaces; infrastructure provides implementations.
  Output: repository_interfaces [{ aggregate_root, methods[], persistence_hint }]

Step 10 — Strategic decisions and team recommendations
  Produce a decision log capturing key DDD choices:
    Why each context boundary was drawn where it was.
    Which contexts should be modeled as microservices vs. modules in a monolith.
    ACL placements and their rationale.
    Team ownership assignments and Conway's Law implications.
  Output: strategic_decisions [{ decision, rationale, alternatives_considered[], affected_contexts[] }]

Step 11 — Assemble DDD model document
  Combine all step outputs into structured domain model artifact.
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `bounded_context_map` | `object` | Contexts, their responsibilities, teams, and relationship catalog |
| `ubiquitous_language` | `array[object]` | Per-context glossary: `term`, `definition`, `context`, `synonyms_to_avoid` |
| `subdomain_classification` | `array[object]` | Each subdomain: `type` (core/supporting/generic), `strategic_importance`, `build_vs_buy` |
| `aggregate_designs` | `array[object]` | Per-aggregate: root, entities, value objects, invariants, domain events |
| `domain_events` | `array[object]` | Event catalog: name, payload, producer, consumer contexts |
| `domain_services` | `array[object]` | Cross-aggregate service names, responsibilities, interface hints |
| `repository_interfaces` | `array[object]` | Repository contracts per aggregate root |
| `context_map_mermaid` | `string` | Mermaid flowchart diagram of bounded context relationships |
| `strategic_decisions` | `array[object]` | Key DDD choices with rationale and alternatives considered |
| `metrics` | `object` | `tokens_in`, `tokens_out`, `duration_ms`, `items_produced`, `version` |
| `feedback` | `array[object]` | Backpropagate entries for upstream skills |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["bounded_context_map", "ubiquitous_language", "subdomain_classification",
               "aggregate_designs", "domain_events", "context_map_mermaid",
               "strategic_decisions", "metrics", "feedback"],
  "properties": {
    "bounded_context_map": {
      "type": "object",
      "required": ["contexts", "relationships"],
      "properties": {
        "contexts": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["name", "responsibilities", "subdomain"],
            "properties": {
              "name":             { "type": "string" },
              "responsibilities": { "type": "array", "items": { "type": "string" } },
              "subdomain":        { "type": "string" },
              "team_owner":       { "type": "string" }
            }
          }
        },
        "relationships": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["upstream", "downstream", "pattern"],
            "properties": {
              "upstream":   { "type": "string" },
              "downstream": { "type": "string" },
              "pattern":    { "type": "string", "enum": ["Partnership","Shared Kernel","Customer-Supplier","Conformist","ACL","Open Host Service","Published Language","Separate Ways","Big Ball of Mud"] }
            }
          }
        }
      }
    },
    "ubiquitous_language": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["term", "definition", "context"],
        "properties": {
          "term":               { "type": "string" },
          "definition":         { "type": "string" },
          "context":            { "type": "string" },
          "synonyms_to_avoid":  { "type": "array", "items": { "type": "string" } },
          "examples":           { "type": "array", "items": { "type": "string" } }
        }
      }
    },
    "subdomain_classification": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["subdomain", "type", "strategic_importance"],
        "properties": {
          "subdomain":            { "type": "string" },
          "type":                 { "type": "string", "enum": ["core", "supporting", "generic"] },
          "strategic_importance": { "type": "string" },
          "build_vs_buy":         { "type": "string", "enum": ["build", "buy", "buy_then_wrap"] }
        }
      }
    },
    "aggregate_designs": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["aggregate_root", "invariants"],
        "properties": {
          "aggregate_root":  { "type": "string" },
          "entities":        { "type": "array", "items": { "type": "string" } },
          "value_objects":   { "type": "array", "items": { "type": "string" } },
          "invariants":      { "type": "array", "items": { "type": "string" } },
          "domain_events":   { "type": "array", "items": { "type": "string" } }
        }
      }
    },
    "domain_events": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["event_name", "producer_aggregate"],
        "properties": {
          "event_name":        { "type": "string" },
          "payload_fields":    { "type": "array", "items": { "type": "string" } },
          "producer_aggregate":{ "type": "string" },
          "consumer_contexts": { "type": "array", "items": { "type": "string" } }
        }
      }
    },
    "domain_services":       { "type": "array" },
    "repository_interfaces": { "type": "array" },
    "context_map_mermaid":   { "type": "string" },
    "strategic_decisions": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["decision", "rationale"],
        "properties": {
          "decision":               { "type": "string" },
          "rationale":              { "type": "string" },
          "alternatives_considered":{ "type": "array", "items": { "type": "string" } },
          "affected_contexts":      { "type": "array", "items": { "type": "string" } }
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

- Domain event names MUST use past tense (e.g., `OrderPlaced` not `PlaceOrder`). Present-tense names are flagged as violations.
- Aggregate transactions MUST be single-aggregate: cross-aggregate operations emit domain events for eventual consistency — never direct aggregate-to-aggregate synchronous calls.
- Every aggregate MUST declare at least one invariant — aggregates without invariants signal missed boundary design.
- `context_map_mermaid` MUST be valid Mermaid `flowchart LR` or `graph LR` syntax.
- No `Shared Kernel` relationships between Core subdomains — flag as anti-pattern requiring `Customer-Supplier` or `ACL`.
- `subdomain_classification` MUST classify every subdomain into exactly one type.
- The ubiquitous language glossary MUST flag cross-context homonyms explicitly — silent homonyms lead to coupling bugs.

## Security Considerations

- Domain events carrying PII fields (userId, email, address) MUST be flagged for encryption at rest in the event store.
- ACL boundaries serve as security boundaries — the anti-corruption layer must validate and sanitize all data crossing the boundary, not only translate it.
- Repository interfaces MUST NOT include raw SQL or query language in their signatures — keep domain layer infrastructure-agnostic.

## Token Optimization

- Compress `business_processes` to `process_name` + step count during Steps 1-3; expand full steps only for aggregate design in Steps 6-7.
- For domains with > 10 bounded contexts: produce summary context map in Step 4 and deep tactical analysis only for the `subdomain_priority` contexts.
- Skip `repository_interfaces` generation when downstream is `code-generator` — code-generator can derive from `aggregate_designs`.

## Quality Checklist

- [ ] Every `business_process` is covered by at least one bounded context
- [ ] All domain event names are past tense
- [ ] No aggregate has more than 5 constituent entities (flag large aggregates)
- [ ] `context_map_mermaid` renders without syntax errors
- [ ] Every `Shared Kernel` entry has an explicit ownership declaration
- [ ] All cross-context homonyms documented in `ubiquitous_language` with `synonyms_to_avoid`
- [ ] `strategic_decisions` has at least one entry per bounded context boundary decision
- [ ] All external system integrations use ACL or Conformist relationship pattern

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| `domain_description` < 50 characters | Reject: `{"error": "DOMAIN_DESCRIPTION_TOO_SHORT", "min_length": 50}` |
| `business_processes` empty | Reject: `{"error": "NO_BUSINESS_PROCESSES"}` |
| God context detected (> 7 aggregates in one context) | Flag as critical warning, propose decomposition alternatives |
| Cyclic dependency in context map | Flag as anti-pattern, recommend resolving with Published Language pattern |
| Team structure conflicts with proposed context boundaries | Emit Conway's Law warning in `feedback`, propose realignment |

## 12. Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Behavior |
|------|---------|---------|----------|
| Domain model approval | Always — bounded contexts define all downstream service and schema boundaries | 7200s | Present context map diagram, aggregate count, and ubiquitous language glossary for domain expert sign-off |
| Shared Kernel usage | Any `Shared Kernel` relationship identified | 3600s | Require explicit confirmation — Shared Kernel is high-risk; document ownership and change protocol |

## 13. Skill Composition

`ddd-architect` feeds directly into `architecture-design` and `database-architect`:

```yaml
composes:
  - skill: ddd-architect
    version: "^1.0.0"
    input_map:
      domain_description:  "requirements.domain_overview"
      business_processes:  "requirements.business_processes"
      team_structure:      "session.team_topology"
    output_map:
      bounded_context_map:       "state.ddd_bounded_contexts"
      aggregate_designs:         "state.ddd_aggregates"
      domain_events:             "state.ddd_events"
      ubiquitous_language:       "state.ddd_glossary"
      context_map_mermaid:       "state.context_map_diagram"
```

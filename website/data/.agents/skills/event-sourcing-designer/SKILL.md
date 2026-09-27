---
name: event-sourcing-designer
version: 1.0.0
domain: architecture
description: >
  Use when designing CQRS and Event Sourcing architectures, modeling aggregates with invariant enforcement, designing event stores, defining projection strategies, or planning snapshot policies. Triggers on: "design event sourcing", "CQRS architecture", "aggregate design", "event store schema", "projection design". Do NOT use for general event-driven messaging contracts — use event-schema-designer for topic/queue design instead.
author: system
---

## Purpose

Design CQRS (Command Query Responsibility Segregation) and Event Sourcing architectures from first principles, covering every layer from aggregate state machines and invariant enforcement through to event store infrastructure and projection read model strategies. This skill specializes in the tactical DDD patterns that make event-sourced systems correct and maintainable at scale, not just the infrastructure configuration.

Aggregate design is the foundational output: each aggregate is modeled as an explicit state machine with clearly defined commands, invariants that must hold before state transitions, and domain events that represent the state changes. This prevents the most common event sourcing failure mode — aggregates that emit events without enforcing business rules. The skill produces command handler patterns, validation logic placement, and invariant enforcement code hints that `code-generator` can materialize directly.

On the infrastructure side, this skill produces event store schema designs for EventStoreDB, Axon Framework, custom PostgreSQL append-only tables, or DynamoDB stream-based stores. Projection designs cover both live projections (synchronous read model updates) and eventual projections (async via event subscription), including rebuild strategies that allow read models to be discarded and replayed without data loss. Snapshot policies address the aggregate rehydration performance problem that emerges as event streams grow large in production.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `aggregates` | `array[object]` | Yes | Aggregate definitions: name, commands[], invariants[], initial_state |
| `read_models` | `array[object]` | Yes | Projection definitions: name, query_patterns[], events_consumed[] |
| `event_store` | `string` | No | Storage backend: `eventstoredb` \| `axon` \| `postgres` \| `dynamodb` (default: `postgres`) |
| `snapshot_policy` | `string` | No | Snapshot trigger: `every_n_events` \| `time_based` \| `manual` (default: `every_n_events`) |
| `projection_strategy` | `string` | No | Projection update timing: `live` \| `eventual` \| `scheduled` (default: `eventual`) |
| `context` | `object` | No | Session context: existing domain events, bounded context map, infrastructure constraints |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["aggregates", "read_models"],
  "properties": {
    "aggregates": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": ["name", "commands", "invariants"],
        "properties": {
          "name":          { "type": "string" },
          "commands": {
            "type": "array",
            "items": {
              "type": "object",
              "required": ["name", "payload_fields"],
              "properties": {
                "name":           { "type": "string" },
                "payload_fields": { "type": "array", "items": { "type": "string" } }
              }
            }
          },
          "invariants": {
            "type": "array",
            "items": { "type": "string" }
          },
          "initial_state": { "type": "object" }
        }
      }
    },
    "read_models": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": ["name", "query_patterns", "events_consumed"],
        "properties": {
          "name":            { "type": "string" },
          "query_patterns":  { "type": "array", "items": { "type": "string" } },
          "events_consumed": { "type": "array", "items": { "type": "string" } }
        }
      }
    },
    "event_store": {
      "type": "string",
      "enum": ["eventstoredb", "axon", "postgres", "dynamodb"],
      "default": "postgres"
    },
    "snapshot_policy": {
      "type": "string",
      "enum": ["every_n_events", "time_based", "manual"],
      "default": "every_n_events"
    },
    "projection_strategy": {
      "type": "string",
      "enum": ["live", "eventual", "scheduled"],
      "default": "eventual"
    },
    "context": { "type": "object" }
  }
}
```

## Required Context

- Bounded context map from `microservices-architect` or `architecture-design` — required to validate aggregate ownership per service.
- If extending an existing event-sourced system: prior `event_catalog` must be provided in `context.existing_events` to prevent event name collisions and schema version conflicts.
- For `postgres` event store: database schema from `database-architect` must be available or will be co-designed in Step 4.
- For `eventstoredb` or `axon`: infrastructure provisioning parameters should be available in `context.infrastructure`.

## Execution Logic

```
Step 1 — Model aggregates as state machines
  For each aggregate in `aggregates`:
    Define explicit states: the set of valid states the aggregate can be in.
    Map each command to: precondition (invariant check), state transition, and emitted event.
    Define the initial state: what does the aggregate look like after creation?
    Identify commands that are valid only in specific states (guard conditions).
  State machine notation:
    IDLE → [CreateOrder command + invariants pass] → PENDING (emits: OrderCreated)
    PENDING → [ConfirmOrder command + payment verified] → CONFIRMED (emits: OrderConfirmed)
    CONFIRMED → [CancelOrder command + within cancellation window] → CANCELLED (emits: OrderCancelled)
  Flag invariants with > 10 conditions per command as complexity warnings.
  Output: aggregate_state_machines[] { aggregate_name, states[], transitions[], guards[] }

Step 2 — Define domain events and payload schemas
  For each state transition: define the emitted domain event.
  Domain event naming: past tense, noun+verb (OrderPlaced, PaymentCharged, UserDeactivated).
  Payload design principles:
    Include all data the event represents AT THE TIME IT OCCURRED — no lookups from state.
    Do not include derived data or computed fields — include source fields only.
    Include event_version field (integer, starts at 1) for schema evolution.
    Include correlation_id for distributed tracing across saga boundaries.
  Apply versioning strategy: V1 → V2 via upcaster functions (transform old schema to new on read).
  Output: event_catalog[] { event_name, aggregate, payload_schema, version, upcaster_hint }

Step 3 — Design aggregate rehydration strategy
  Rehydration: to process a command, load aggregate by replaying its event stream from the event store.
  Performance concern: long event streams (> 500 events) make rehydration slow.
  Snapshot strategy per snapshot_policy:
    every_n_events: take snapshot every N events (N configurable, default 50); store alongside stream.
    time_based:     take snapshot every T seconds/minutes regardless of event count.
    manual:         no automatic snapshots — operators trigger manually via admin command.
  Snapshot storage: same event store as events, or separate snapshot store (recommend separate for DynamoDB).
  Snapshot schema: { aggregate_id, aggregate_type, sequence_number, state_json, taken_at }.
  Output: rehydration_strategy { method, snapshot_config, cache_strategy }

Step 4 — Design event store schema
  eventstoredb:
    Stream naming: {aggregate_type}-{aggregate_id} (e.g., order-b3d29f1a).
    Event type: matches domain event name.
    Metadata: correlation_id, causation_id, user_id, timestamp.
    Projections: EventStoreDB built-in JavaScript projections for read model updates.
  axon:
    Domain event entry table (Axon Server manages streams natively).
    Saga instance table for saga state persistence.
    Token store for projection tracking per processor group.
  postgres (custom append-only):
    Table: events (id BIGSERIAL, stream_id UUID, event_type VARCHAR, payload JSONB,
                    metadata JSONB, sequence_number BIGINT, occurred_at TIMESTAMPTZ)
    Unique constraint: (stream_id, sequence_number) — prevents concurrent write conflicts.
    Index: (stream_id, sequence_number) for stream reads; (event_type, occurred_at) for projections.
    Optimistic concurrency: include expected_version in write command; reject if mismatch.
  dynamodb:
    Partition key: stream_id, Sort key: sequence_number.
    GSI on event_type + occurred_at for projection catch-up queries.
    DynamoDB Streams enabled for live projection updates via Lambda.
  Output: event_store_schema { platform, tables_or_streams, indexes, concurrency_strategy }

Step 5 — Design command handlers
  For each aggregate command: define the command handler pattern.
  Command handler responsibilities:
    1. Load aggregate from event store (replay or snapshot + replay delta).
    2. Execute aggregate business logic (validate invariants, determine transition).
    3. Persist new events atomically (optimistic concurrency check).
    4. Publish events for projection consumers.
  Command routing: commands addressed by aggregate_type + aggregate_id.
  Idempotency: command handlers must be idempotent — deduplicate using command_id.
  Validation: input validation (schema) at command boundary; business validation inside aggregate.
  Output: command_handlers[] { command_name, aggregate, load_strategy, validation_rules, idempotency_key }

Step 6 — Design projections and read models
  For each read_model in `read_models`:
    Identify which domain events it subscribes to.
    Define the projection function: event → read model state update.
    Define the storage schema for the read model (optimized for query_patterns).
    Define rebuild strategy: replay all events from event store from position 0.
  Projection strategy per projection_strategy:
    live:       projection updates synchronously within the command transaction — strong consistency.
    eventual:   projection updates asynchronously via event subscription — eventual consistency.
    scheduled:  projection rebuilt on a schedule (e.g., nightly) — for reporting projections.
  Projection catch-up: track last processed sequence_number per projection; resume from checkpoint.
  Output: projection_designs[] { read_model_name, events_consumed[], projection_fn_hint, storage_schema, rebuild_strategy }

Step 7 — Snapshot configuration
  Produce snapshot_config with:
    snapshot_interval:   N events (for every_n_events) or duration string (for time_based).
    snapshot_store:      same event store, or separate table/bucket.
    snapshot_format:     JSON (human-readable) or MessagePack (compact binary).
    snapshot_retention:  keep last K snapshots per aggregate, delete older ones.
    cache:               in-memory LRU cache for hot aggregates (capacity, TTL).
  Output: snapshot_config { interval, store_location, format, retention, cache_config }

Step 8 — Event schema evolution plan
  Identify events likely to change (high-churn domain areas from requirements).
  Define upcaster chain: V1 → V2 → V3 transformations applied on read, not on stored data.
  Upcaster rules:
    Adding a required field: provide default value in upcaster.
    Renaming a field: map old name to new name in upcaster.
    Splitting an event: one V1 event → two V2 events (complex; document migration script).
  Store events in their original form — NEVER mutate stored events.
  Output: schema_evolution_plan { events_at_risk[], upcaster_designs[], migration_scripts_needed[] }
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `aggregate_designs` | `array[object]` | State machines: name, states, transitions, guards, invariant list |
| `event_catalog` | `array[object]` | Events: name, aggregate, payload_schema, version, upcaster_hint |
| `event_store_schema` | `object` | Platform-specific schema: tables/streams, indexes, concurrency strategy |
| `command_handlers` | `array[object]` | Handler patterns: command, aggregate, load_strategy, idempotency_key |
| `projection_designs` | `array[object]` | Read models: name, events_consumed, projection_fn_hint, rebuild_strategy |
| `snapshot_config` | `object` | Snapshot interval, store location, format, retention, cache config |
| `metrics` | `object` | tokens_in, tokens_out, duration_ms, items_produced, version |
| `feedback` | `array[object]` | Backpropagate entries for upstream skills if specification gaps found |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["aggregate_designs", "event_catalog", "event_store_schema", "command_handlers", "projection_designs", "snapshot_config", "metrics", "feedback"],
  "properties": {
    "aggregate_designs": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["name", "states", "transitions"],
        "properties": {
          "name":        { "type": "string" },
          "states":      { "type": "array", "items": { "type": "string" } },
          "transitions": {
            "type": "array",
            "items": {
              "type": "object",
              "required": ["command", "from_state", "to_state", "emits_event"],
              "properties": {
                "command":      { "type": "string" },
                "from_state":   { "type": "string" },
                "to_state":     { "type": "string" },
                "emits_event":  { "type": "string" },
                "guards":       { "type": "array", "items": { "type": "string" } }
              }
            }
          },
          "invariants":  { "type": "array", "items": { "type": "string" } }
        }
      }
    },
    "event_catalog": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["event_name", "aggregate", "payload_schema", "version"],
        "properties": {
          "event_name":      { "type": "string" },
          "aggregate":       { "type": "string" },
          "payload_schema":  { "type": "object" },
          "version":         { "type": "integer", "minimum": 1 },
          "upcaster_hint":   { "type": "string" }
        }
      }
    },
    "event_store_schema": {
      "type": "object",
      "properties": {
        "platform":            { "type": "string" },
        "tables_or_streams":   { "type": "array" },
        "indexes":             { "type": "array" },
        "concurrency_strategy":{ "type": "string" }
      }
    },
    "command_handlers": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["command_name", "aggregate", "load_strategy"],
        "properties": {
          "command_name":    { "type": "string" },
          "aggregate":       { "type": "string" },
          "load_strategy":   { "type": "string", "enum": ["replay", "snapshot_plus_replay", "snapshot_only"] },
          "idempotency_key": { "type": "string" },
          "validation_rules":{ "type": "array", "items": { "type": "string" } }
        }
      }
    },
    "projection_designs": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["read_model_name", "events_consumed", "rebuild_strategy"],
        "properties": {
          "read_model_name":   { "type": "string" },
          "events_consumed":   { "type": "array", "items": { "type": "string" } },
          "projection_fn_hint":{ "type": "string" },
          "storage_schema":    { "type": "object" },
          "rebuild_strategy":  { "type": "string", "enum": ["full_replay", "incremental_replay", "scheduled_rebuild"] }
        }
      }
    },
    "snapshot_config": {
      "type": "object",
      "properties": {
        "interval":     { "type": "string" },
        "store_location":{ "type": "string" },
        "format":       { "type": "string", "enum": ["json", "messagepack"] },
        "retention":    { "type": "object" },
        "cache_config": { "type": "object" }
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

- Every aggregate MUST have at least one command and at least one emitted event — aggregates with no events are not event-sourced, they are plain entities.
- Every domain event MUST have a versioned payload schema with an `event_version` field — unversioned events block `event_catalog` output.
- Stored events MUST NEVER be mutated — all schema evolution is handled by upcasters on the read path only.
- Every command handler MUST document an idempotency strategy using `command_id` or equivalent deduplication key.
- Every read model in `read_models` MUST have a corresponding entry in `projection_designs`.
- Aggregates with event streams expected to exceed 500 events MUST use `snapshot_policy: every_n_events` — manual or no snapshot is a performance violation.
- The HITL gate at > 50 event types per aggregate is mandatory — this level of complexity indicates a boundary design error.
- Optimistic concurrency check MUST be documented in `event_store_schema.concurrency_strategy` — no concurrency strategy is a critical violation.

## Security Considerations

- Event payloads must not contain plaintext PII in long-lived streams — PII fields must be encrypted at the field level or pseudonymized using a key that can be deleted (GDPR right-to-erasure via crypto-shredding).
- Crypto-shredding design: encrypt PII fields with a per-customer key stored in a key management service; delete key to "erase" the data in immutable events.
- Command handlers must validate that the caller is authorized to issue the command — authorization must happen before aggregate load to prevent information leakage.
- Event store access must be append-only for application users — `DELETE` and `UPDATE` rights on event tables must be revoked from application database users.
- Projection rebuild operations must be access-controlled — unauthorized replay could expose historical data or trigger unintended side effects.

## Token Optimization

- Pass `aggregates` as name + commands[name] + invariants (string list) — strip payload_fields details for initial analysis.
- For systems with > 10 aggregates, process in groups of 5 and merge outputs.
- Event catalog entries can be stored to state with summary returned (event_name + version + aggregate) when context budget is constrained.
- Projection designs can omit `storage_schema` in the response and store full schemas to state when there are > 5 read models.

## Quality Checklist

- [ ] Every aggregate has at least one command with a corresponding emitted event
- [ ] Every domain event has a versioned payload schema with `event_version`
- [ ] No stored event mutation — all evolution via upcasters documented
- [ ] Every command handler documents an idempotency strategy
- [ ] Every read model has a corresponding projection design
- [ ] Aggregates with > 500 expected events use `every_n_events` snapshot policy
- [ ] Optimistic concurrency strategy documented in `event_store_schema`
- [ ] PII fields in event payloads have crypto-shredding or encryption design
- [ ] All projection designs have a `rebuild_strategy` defined

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| `aggregates` array is empty | Reject: `{"error": "NO_AGGREGATES", "min_aggregates": 1}` |
| `read_models` array is empty | Reject: `{"error": "NO_READ_MODELS", "message": "CQRS requires at least one read model"}` |
| Aggregate has > 50 event types | Trigger HITL gate; block aggregate_designs output until boundary review |
| Unrecognized `event_store` value | Default to `postgres`, emit warning in feedback |
| Event name collision with `context.existing_events` | Auto-append `V2` suffix, emit warning in feedback |
| Circular aggregate reference detected | Flag as critical violation; emit backpropagate to `microservices-architect` |
| Command with no invariants provided | Emit info warning — zero invariants is valid but unusual; suggest review |

## 12. Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Behavior |
|------|---------|---------|----------|
| Aggregate complexity gate | Any single aggregate has > 50 event types in its catalog | 7200s | Pause; present aggregate event list, state machine complexity, and aggregate splitting recommendation for senior DDD review |
| PII in event streams | PII fields detected in event payloads without encryption strategy | 3600s | Pause; require human to confirm crypto-shredding or encryption design before event catalog is finalized |

- The aggregate complexity gate presents: event type count, state machine diagram summary, proposed split boundaries.
- If human approves split: re-invoke from Step 1 with revised aggregate boundaries.
- If human overrides: document the decision in feedback with `type: info` and proceed.

## 13. Skill Composition

`event-sourcing-designer` is invoked after `microservices-architect` defines service boundaries and feeds into `database-architect` (event store schema), `code-generator` (aggregate and handler scaffolding), and `test-generator` (aggregate invariant tests):

```yaml
composes:
  - skill: event-sourcing-designer
    version: "^1.0.0"
    input_map:
      aggregates:          "domain_model.aggregates"
      read_models:         "domain_model.read_models"
      event_store:         "session.event_store_platform"
      snapshot_policy:     "session.snapshot_policy"
    output_map:
      aggregate_designs:   "state.aggregate_designs"
      event_catalog:       "state.domain_event_catalog"
      event_store_schema:  "state.event_store_schema"
      projection_designs:  "state.projection_designs"
```

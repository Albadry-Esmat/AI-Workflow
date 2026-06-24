---
name: event-schema-designer
version: 1.0.0
domain: api
description: >
  Use when designing event schemas, messaging contracts, AsyncAPI specifications, or topic naming conventions for event-driven systems. Triggers on: "design event schemas", "AsyncAPI spec", "Kafka topic design", "CloudEvents envelope", "schema registry configuration". Do NOT use for REST or GraphQL API design. Use api-design-architect or graphql-architect for synchronous API contracts.
author: system
---

## Purpose

Design event schemas and messaging contracts for event-driven systems, producing complete AsyncAPI 3.0 specifications, CloudEvents-compliant envelope definitions, and all operational constructs required to run a reliable async messaging layer in production. This skill bridges `microservices-architect` (which defines bounded contexts and communication preferences) and `data-pipeline-architect` (which consumes event streams as data sources), providing the precise schema contracts both sides depend on.

The skill is platform-aware — it generates Kafka topic configurations, RabbitMQ exchange/queue bindings, AWS SQS/SNS topic policies, Google Pub/Sub subscription configs, AWS EventBridge event bus rules, or NATS subject hierarchies depending on the `messaging_platform` input. Schema format support spans Avro (for Confluent Schema Registry), Protobuf (for gRPC-aligned teams), and JSON Schema (as the universal default), with compatibility mode enforced at each schema registration.

Dead letter queue designs, consumer group patterns, partition strategy, and event replay architecture are first-class outputs — not afterthoughts. Schema registry integration config is generated for teams using Confluent Schema Registry or AWS Glue Schema Registry, including subject naming strategies and compatibility level settings. The `compatibility_rules` output is consumed directly by `database-guard`-equivalent validation tooling to prevent incompatible schema evolutions from being published to production.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `events` | `array[object]` | Yes | Event definitions: name, producer, consumers[], payload_description, is_domain_event |
| `messaging_platform` | `string` | Yes | Target platform: `kafka` \| `rabbitmq` \| `sqs` \| `pubsub` \| `eventbridge` \| `nats` |
| `schema_format` | `string` | No | Schema serialization: `avro` \| `protobuf` \| `json_schema` (default: `json_schema`) |
| `compatibility_mode` | `string` | No | Schema evolution mode: `backward` \| `forward` \| `full` \| `none` (default: `backward`) |
| `schema_registry` | `boolean` | No | Whether to generate schema registry integration config (default: `false`) |
| `context` | `object` | No | Session context: existing topics, consumer groups, prior schema versions |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["events", "messaging_platform"],
  "properties": {
    "events": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": ["name", "producer", "consumers", "payload_description"],
        "properties": {
          "name":                { "type": "string" },
          "producer":            { "type": "string" },
          "consumers":           { "type": "array", "items": { "type": "string" } },
          "payload_description": { "type": "string" },
          "is_domain_event":     { "type": "boolean", "default": true }
        }
      }
    },
    "messaging_platform": {
      "type": "string",
      "enum": ["kafka", "rabbitmq", "sqs", "pubsub", "eventbridge", "nats"]
    },
    "schema_format": {
      "type": "string",
      "enum": ["avro", "protobuf", "json_schema"],
      "default": "json_schema"
    },
    "compatibility_mode": {
      "type": "string",
      "enum": ["backward", "forward", "full", "none"],
      "default": "backward"
    },
    "schema_registry": { "type": "boolean", "default": false },
    "context":         { "type": "object" }
  }
}
```

## Required Context

- Architecture service map from `microservices-architect` or `architecture-design` — required to validate producer/consumer service names.
- If `schema_registry: true`: registry URL and credentials reference (not actual credentials) must be provided in `context.schema_registry_config`.
- If extending existing event catalog: prior `asyncapi_spec` must be provided in `context.existing_spec` to enforce additive-only additions.
- For `kafka`: existing topic list in `context.existing_topics` is needed to prevent topic naming collisions.

## Execution Logic

```
Step 1 — Catalog and classify all events
  For each event in `events`: classify as domain_event, integration_event, or notification_event.
    domain_event:      state change within a bounded context (e.g., OrderPlaced, UserRegistered)
    integration_event: cross-service command/notification (e.g., SendWelcomeEmail)
    notification_event: pure notification with no state implication (e.g., MetricThresholdExceeded)
  Identify event sequences and saga choreography chains.
  Output: classified_events[], saga_chains[]

Step 2 — Design CloudEvents-compliant envelope
  Wrap every event payload in a CloudEvents 1.0 envelope:
    specversion: "1.0"
    id:          UUID v4 (unique per event occurrence)
    source:      URI identifying the producing service (e.g., /services/order-service)
    type:        Reverse-DNS namespaced string (e.g., com.myapp.order.placed)
    time:        RFC 3339 timestamp
    datacontenttype: "application/json" | "application/avro" | "application/protobuf"
    subject:     Optional — entity ID the event is about (e.g., order-12345)
    data:        The domain payload
  Output: cloudevents_envelope_schema

Step 3 — Define payload schemas per event
  For each event: define the `data` payload schema in the selected `schema_format`.
    JSON Schema: standard draft-07 object schema with all fields typed and annotated.
    Avro:        record type with namespace matching reverse-DNS naming, no use of `null` defaults.
    Protobuf:    proto3 message definition with well-known type imports for Timestamp, Duration.
  Apply schema versioning: embed version as a metadata field (data.__version or schema field tag).
  Output: event_schemas[] { event_name, schema_format, schema_body, version }

Step 4 — Generate AsyncAPI 3.0 specification
  Map each event to AsyncAPI channels and operations:
    channel:   maps to a topic, queue, exchange, or subject depending on platform
    operation: send (producer) or receive (consumer)
    message:   references the payload schema in components/messages
  Produce components: messages, schemas, servers (platform-specific connection details placeholder).
  Output: asyncapi_spec (full AsyncAPI 3.0 object)

Step 5 — Topic/queue naming and partitioning strategy
  Apply naming convention: {domain}.{entity}.{event_verb} (e.g., orders.order.placed).
  Platform-specific rules:
    kafka:       topic names: {env}.{domain}.{entity}.{verb}, partition count by consumer SLA,
                 replication factor 3 for production, retention policy per event class.
    rabbitmq:    exchange type per pattern (topic for routing, fanout for broadcast),
                 dead letter exchange naming: {original_exchange}.dlx.
    sqs:         queue names: {env}-{domain}-{entity}-{verb}.fifo (FIFO for ordered events),
                 visibility timeout = max processing time * 1.5.
    pubsub:      topic: projects/{project}/topics/{domain}-{entity}-{verb}, subscription per consumer group.
    eventbridge: event bus per domain, detail-type matches event type string.
    nats:        subject: {domain}.{entity}.{verb} with wildcard subscription patterns.
  Output: topic_design { naming_convention, topic_list[], partitioning_strategy, retention_policy }

Step 6 — Schema registry configuration (if schema_registry: true)
  Confluent Schema Registry:
    Subject naming: {topic_name}-value (TopicNameStrategy) or {schema_namespace}.{type} (RecordNameStrategy).
    Compatibility level: maps from compatibility_mode input.
    Schema registration: auto-register on producer startup vs. pre-registration script.
  AWS Glue Schema Registry:
    Registry name: {domain}-schemas, namespace per event family.
    Schema format: JSON_SCHEMA or AVRO (Protobuf not natively supported — document workaround).
  Output: schema_registry_config { type, subjects[], compatibility_settings, registration_strategy }

Step 7 — Dead letter queue design
  For each consumer: define a DLQ/DLX where failed messages are routed after max_retry_attempts.
  DLQ naming: {original_topic_or_queue}.dlq (or .dlx for RabbitMQ).
  Define retry policy: exponential backoff, max 5 retries, jitter ± 10%.
  DLQ monitoring: alert when DLQ depth > 0 in production.
  Output: dlq_design { dlq_per_consumer[], retry_policy, monitoring_alerts }

Step 8 — Compatibility rules
  Based on compatibility_mode:
    backward: new schema must be readable by old consumers — no required field additions, no type changes.
    forward:  old schema must be readable by new consumers — no field removals.
    full:     both backward and forward simultaneously.
    none:     no compatibility enforced — emit CRITICAL warning; block unless HITL approved.
  Produce a checklist of prohibited and permitted operations per compatibility mode.
  Output: compatibility_rules[] { operation, permitted, reason }

Step 9 — Consumer group patterns
  For each consumer service: define consumer group ID, offset reset policy, partition assignment strategy.
  Idempotency: every consumer MUST implement idempotency using the CloudEvents `id` field as deduplication key.
  Consumer lag alerts: define thresholds per consumer group.
  Output: consumer_group_plan { groups[], offset_policy, idempotency_strategy, lag_alert_thresholds }
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `asyncapi_spec` | `object` | Full AsyncAPI 3.0 document with channels, operations, messages, and schemas |
| `event_catalog` | `array[object]` | Per-event: name, schema, producer, consumers[], version, classification |
| `topic_design` | `object` | Naming convention, topic/queue list, partitioning strategy, retention policy |
| `schema_registry_config` | `object` | Subject naming, compatibility levels, registration strategy (if enabled) |
| `dlq_design` | `object` | DLQ per consumer, retry policy, monitoring alert thresholds |
| `compatibility_rules` | `array[object]` | Permitted and prohibited schema operations per mode |
| `consumer_group_plan` | `object` | Consumer groups, offset policy, idempotency strategy, lag thresholds |
| `metrics` | `object` | tokens_in, tokens_out, duration_ms, items_produced, version |
| `feedback` | `array[object]` | Backpropagate entries for upstream skills if specification gaps found |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["asyncapi_spec", "event_catalog", "topic_design", "dlq_design", "compatibility_rules", "consumer_group_plan", "metrics", "feedback"],
  "properties": {
    "asyncapi_spec": {
      "type": "object",
      "required": ["asyncapi", "info", "channels"],
      "properties": {
        "asyncapi":   { "type": "string", "pattern": "^3\\.0" },
        "info":       { "type": "object" },
        "channels":   { "type": "object" },
        "components": { "type": "object" }
      }
    },
    "event_catalog": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["event_name", "producer", "consumers", "schema", "version"],
        "properties": {
          "event_name":     { "type": "string" },
          "producer":       { "type": "string" },
          "consumers":      { "type": "array", "items": { "type": "string" } },
          "schema":         { "type": "object" },
          "version":        { "type": "string" },
          "classification": { "type": "string", "enum": ["domain_event", "integration_event", "notification_event"] }
        }
      }
    },
    "topic_design": {
      "type": "object",
      "properties": {
        "naming_convention":    { "type": "string" },
        "topic_list":           { "type": "array" },
        "partitioning_strategy":{ "type": "object" },
        "retention_policy":     { "type": "object" }
      }
    },
    "schema_registry_config": { "type": "object" },
    "dlq_design": {
      "type": "object",
      "properties": {
        "dlq_per_consumer": { "type": "array" },
        "retry_policy":     { "type": "object" },
        "monitoring_alerts":{ "type": "array" }
      }
    },
    "compatibility_rules": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["operation", "permitted", "reason"],
        "properties": {
          "operation": { "type": "string" },
          "permitted": { "type": "boolean" },
          "reason":    { "type": "string" }
        }
      }
    },
    "consumer_group_plan": {
      "type": "object",
      "properties": {
        "groups":                { "type": "array" },
        "offset_policy":         { "type": "string" },
        "idempotency_strategy":  { "type": "string" },
        "lag_alert_thresholds":  { "type": "object" }
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

- Every event in `events` MUST have an entry in `event_catalog` with a fully defined schema.
- All event payloads MUST be wrapped in a CloudEvents 1.0 envelope — bare payload publishing without envelope is a violation.
- Every consumer MUST have a corresponding DLQ entry in `dlq_design.dlq_per_consumer`.
- `compatibility_mode: none` MUST trigger the HITL gate — it cannot be applied without human sign-off.
- Consumer idempotency is mandatory — every consumer group plan MUST document the deduplication strategy using CloudEvents `id`.
- AsyncAPI version field MUST be `3.0.x` — `2.x` is not accepted for new event schema designs.
- Topic naming MUST follow the defined convention — ad-hoc naming without convention is a violation.

## Security Considerations

- Event payloads MUST NOT contain plaintext credentials, PII without encryption annotation, or internal service IP addresses.
- CloudEvents `source` URI must identify the service by logical name, never by IP or hostname.
- Schema registry access credentials must be referenced as environment variable names only — never as literal values.
- Consumer group IDs must be namespaced per environment to prevent cross-environment consumption (e.g., `prod-order-service-consumer` vs. `staging-order-service-consumer`).
- Event replay must be access-controlled — only authorized operators should be permitted to trigger consumer group offset resets.

## Token Optimization

- Pass `events` as compact objects: name, producer, consumers[], payload_description only — strip verbose narrative.
- For large event catalogs (> 20 events), generate `asyncapi_spec` without inline examples and store full spec to state via state-manager.
- Compatibility rules table can be condensed to a one-liner per mode when context budget is constrained.

## Quality Checklist

- [ ] Every event in `events` has a corresponding entry in `event_catalog` with full schema
- [ ] All events use CloudEvents 1.0 envelope
- [ ] `asyncapi_spec.asyncapi` version is `3.0.x`
- [ ] Every consumer has a DLQ entry in `dlq_design`
- [ ] Idempotency strategy documented in `consumer_group_plan`
- [ ] `compatibility_mode: none` blocked by HITL gate
- [ ] Topic naming follows the declared convention for the selected platform
- [ ] No PII or credentials in event schema examples
- [ ] Schema registry config generated if `schema_registry: true`

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| `events` array is empty | Reject: `{"error": "NO_EVENTS", "min_events": 1}` |
| `messaging_platform` not recognized | Reject: `{"error": "UNKNOWN_PLATFORM", "supported": ["kafka","rabbitmq","sqs","pubsub","eventbridge","nats"]}` |
| `compatibility_mode: none` without HITL approval | Block spec generation; emit critical warning; trigger HITL gate |
| Producer service not found in architecture module map | Emit backpropagate to `microservices-architect`; use placeholder service name |
| Schema registry URL not provided when `schema_registry: true` | Generate config template with `${SCHEMA_REGISTRY_URL}` placeholder; emit info feedback |
| Topic naming collision with `context.existing_topics` | Auto-suffix with `-v2` and emit warning in feedback |

## 12. Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Behavior |
|------|---------|---------|----------|
| Compatibility mode none | `compatibility_mode == "none"` | 3600s | Pause; present list of breaking schema changes that will be permitted; require explicit human approval before proceeding |
| Large event catalog | `events.length > 30` | 3600s | Pause; present event classification summary and saga chain analysis for architecture review |

- The `compatibility_mode: none` gate presents: all events affected, downstream consumers impacted, and a risk summary.
- If rejected: re-invoke with `compatibility_mode: backward` or `forward` as appropriate.

## 13. Skill Composition

`event-schema-designer` is invoked after `microservices-architect` defines service boundaries and produces contracts consumed by `code-generator` (producer/consumer scaffolding) and `deployment-strategy` (topic/queue provisioning):

```yaml
composes:
  - skill: event-schema-designer
    version: "^1.0.0"
    input_map:
      events:              "microservices.communication_design.async_events"
      messaging_platform:  "session.messaging_platform"
      schema_registry:     "session.use_schema_registry"
    output_map:
      asyncapi_spec:       "state.event_contracts"
      event_catalog:       "state.event_catalog"
      topic_design:        "state.topic_design"
```

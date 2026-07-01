---
name: data-contract-enforcer
version: 1.0.0
domain: data
description: >
  Use when governing data contracts between producer and consumer teams — defining schema contracts,
  detecting breaking changes, enforcing semantic versioning on data schemas, or generating consumer
  migration plans. Triggers on: "data contract", "schema breaking change", "consumer migration plan",
  "data schema versioning", "contract violation", "producer consumer schema diff". Do NOT use for
  API contracts between microservices — use api-deprecation-manager for REST/gRPC service contracts.
author: system
---

## Purpose

Govern the formal agreements between data producer teams and data consumer teams at the schema level.
A data contract is a machine-readable specification that defines what a producer guarantees to deliver
(field names, types, constraints, SLAs, freshness) and what a consumer is permitted to depend on. This
skill handles the full contract lifecycle: defining new contracts from schemas (AsyncAPI 2.x or JSON Schema
with data-specific extensions), validating payloads against existing contracts, performing field-by-field
semantic diffs to classify changes as compatible or breaking, generating step-by-step migration plans for
consumers when breaking changes are unavoidable, producing contract test suites runnable in CI, and creating
structured consumer notification payloads.

The skill enforces semantic versioning on data schemas: compatible changes (field additions, constraint
relaxation) increment the minor version; breaking changes (field removal, type narrowing, constraint
tightening, rename without alias) require a major version bump and mandatory HITL approval before consumer
teams are notified. This prevents silent data corruption from undisclosed schema changes — the leading
cause of data pipeline failures in multi-team organizations.

This skill bridges `data-pipeline-architect` (which produces the pipeline topology) and
`compliance-mapper` (which maps data contracts to regulatory obligations). It is the runtime enforcement
point where `data-quality-validator` routes BREAKING schema drift events for formal contract management.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `operation` | `string` | Yes | `define` \| `validate` \| `diff` \| `migrate` |
| `producer_schema` | `object` | Yes | Producer's schema: JSON Schema object with contract metadata extensions |
| `consumer_schema` | `object` | No | Consumer's expected schema — required for `diff` and `validate` operations |
| `data_domain` | `string` | Yes | Owning data domain (e.g., `"orders"`, `"customers"`, `"events"`) |
| `breaking_change_policy` | `string` | No | `strict` \| `lenient` — default: `strict`. Strict: any BREAKING change requires HITL approval. Lenient: BREAKING changes emit warnings but do not block. |
| `context` | `object` | No | Prior outputs from data-pipeline-architect, data-quality-validator, or existing contract registry |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["operation", "producer_schema", "data_domain"],
  "properties": {
    "operation": {
      "type": "string",
      "enum": ["define", "validate", "diff", "migrate"]
    },
    "producer_schema": {
      "type": "object",
      "required": ["title", "version"],
      "properties": {
        "title":       { "type": "string" },
        "version":     { "type": "string", "pattern": "^[0-9]+\\.[0-9]+\\.[0-9]+$" },
        "properties":  { "type": "object" },
        "required":    { "type": "array", "items": { "type": "string" } },
        "x-owner":     { "type": "string", "description": "Owning team identifier" },
        "x-sla":       { "type": "object", "description": "SLA extensions: freshness_max_age_sec, availability_slo" },
        "x-changelog": { "type": "array", "description": "Version history entries" }
      }
    },
    "consumer_schema": {
      "type": "object",
      "description": "Required for diff and validate operations",
      "properties": {
        "title":      { "type": "string" },
        "version":    { "type": "string" },
        "properties": { "type": "object" },
        "required":   { "type": "array", "items": { "type": "string" } },
        "x-consumer": { "type": "string", "description": "Consuming team identifier" }
      }
    },
    "data_domain":  { "type": "string", "minLength": 1 },
    "breaking_change_policy": {
      "type": "string",
      "enum": ["strict", "lenient"],
      "default": "strict"
    },
    "context": { "type": "object" }
  }
}
```

## Required Context

- `producer_schema` with `version` field is mandatory for all operations.
- `consumer_schema` is required for `diff` and `validate` — skill returns error if absent.
- Optionally: prior contract from `context.contract_registry` for version continuity check.
- Optionally: `data_profile` from `data-quality-validator` for runtime null rate and type validation.
- Optionally: `compliance_requirements` from `compliance-mapper` for regulatory annotation on contract fields.

## Execution Logic

```
Step 1 — Parse and validate input schemas
  Validate producer_schema: must have title, version (semver), and properties.
  Validate consumer_schema if provided: same structure requirements.
  Parse version strings into { major, minor, patch } components.
  Check context.contract_registry for existing contract at producer_schema.title:
    If found: load prior_contract for diff baseline.
    If not found (define operation): this is a new contract registration.
  Output: parsed_producer, parsed_consumer, prior_contract (or null), operation_context

Step 2 — Classify operation
  Route to operation-specific logic:
    define:   → Steps 3, 6 (build contract definition, generate tests, skip diff/migrate)
    validate: → Steps 4, 8 (validate payload against producer contract, skip diff/migrate)
    diff:     → Steps 4, 5, 6, 7 (full diff + breaking change analysis + migration + tests)
    migrate:  → Steps 5, 7 (migration plan + consumer notifications, skip define/validate)
  Output: routing_decision

Step 3 — Build contract definition (define operation)
  Assemble contract_definition object:
    contract_id:      "{data_domain}.{producer_schema.title}.{producer_schema.version}"
    producer:         { team: producer_schema.x-owner, schema_ref, version }
    consumer:         { team: consumer_schema.x-consumer (if provided), schema_ref, version }
    sla:              producer_schema.x-sla (freshness_max_age_sec, availability_slo, latency_p99_ms)
    schema:           normalized schema with all fields, types, constraints, PII flags
    effective_date:   ISO 8601 timestamp
    expiry_policy:    "N+2 major versions" (prior contract honored for 2 major versions post-change)
  Assign semantic version from producer_schema.version or bump from prior_contract if applicable.
  Output: contract_definition

Step 4 — Field-by-field schema comparison (diff/validate operations)
  For diff: compare producer_schema.properties vs. consumer_schema.properties field by field.
  For validate: compare producer_schema.properties vs. payload field presence and types.
  Build field comparison matrix:
    For each field in consumer/payload:
      PRESENT in both:    compare type, format, constraints (required, minimum, maximum, enum, pattern)
      ADDED (producer):   compatible addition → COMPATIBLE
      REMOVED (consumer): field consumer depends on removed → BREAKING
      TYPE_CHANGED:       widening (string→anyOf) → COMPATIBLE; narrowing (number→integer) → BREAKING
      CONSTRAINT_ADDED:   new required field, new minimum, new enum restriction → BREAKING
      CONSTRAINT_REMOVED: field made optional, minimum removed → COMPATIBLE
      RENAMED:            if no alias added → BREAKING; with backward-compat alias → COMPATIBLE
  Output: field_comparison_matrix[], violations[]

Step 5 — Detect breaking vs. compatible changes
  Classify each entry in field_comparison_matrix:
    BREAKING:    any REMOVED, narrowing TYPE_CHANGED, CONSTRAINT_ADDED, RENAMED without alias
    COMPATIBLE:  any ADDED, widening TYPE_CHANGED, CONSTRAINT_REMOVED
  Compute overall change severity:
    Any BREAKING → severity: "breaking", requires major version bump
    Only COMPATIBLE → severity: "compatible", minor version bump
    No changes → severity: "unchanged"
  If breaking_change_policy == "strict" AND severity == "breaking": HITL gate triggered.
  Output: breaking_changes[], change_severity, recommended_version_bump

Step 6 — Produce contract test suite
  For each field in contract_definition.schema:
    Generate type assertion test: assert typeof(field) == declared_type
    Generate constraint test: assert value satisfies declared constraints (min, max, enum, pattern)
    Generate presence test: assert field present if required == true
  Generate SLA test: assert data freshness <= sla.freshness_max_age_sec
  Format tests as: dbt-contract tests (YAML), pytest assertions (Python), or Jest tests (TypeScript)
    depending on context.preferred_test_framework (default: dbt-contract YAML).
  Output: contract_tests[] { test_id, field, assertion_type, expression, expected_outcome }

Step 7 — Generate migration plan and consumer notifications (diff/migrate operations)
  For each BREAKING change: define migration step:
    REMOVED field:     "Add nullable alias column {old_name} in consumer transform; deprecate after {date}"
    TYPE_CHANGED:      "Cast {field} from {old_type} to {new_type} in consumer ETL; validate with test"
    CONSTRAINT_ADDED:  "Add validation for {constraint} in consumer ingest; filter invalid records"
    RENAMED:           "Update all consumer references from {old_name} to {new_name}"
  Estimate effort per step: trivial (< 1hr) | minor (1-8hr) | major (> 8hr).
  Total effort_estimate: sum of all step estimates.
  For each consuming team in context.contract_registry.consumers: generate notification payload:
    { consumer_team, contract_id, change_severity, breaking_changes[], migration_steps[],
      deadline_iso8601, support_contact }
  Output: migration_plan { steps[], effort_estimate, total_migration_days },
          consumer_notifications[]

Step 8 — Assemble final output
  Combine all step outputs into structured response.
  Emit metrics and feedback entries.
  For BREAKING changes: always emit feedback of type "backpropagate" to data-quality-validator
    and info to compliance-mapper.
  Output: complete data-contract-enforcer response
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `contract_definition` | `object` | Full contract: producer, consumer, SLA, schema, effective_date, expiry_policy |
| `violations` | `array[object]` | Schema violations: `{ field, violation_type, severity, consumer_impact }` |
| `breaking_changes` | `array[object]` | BREAKING changes detected: `{ field, change_type, old_value, new_value, severity }` |
| `migration_plan` | `object` | Steps and effort: `{ steps[], effort_estimate, total_migration_days }` |
| `contract_tests` | `array[object]` | Test definitions: `{ test_id, field, assertion_type, expression, expected_outcome }` |
| `consumer_notifications` | `array[object]` | Notification payloads per consuming team |
| `metrics` | `object` | Execution metrics: tokens_in, tokens_out, duration_ms, items_produced, version |
| `feedback` | `array[object]` | Backpropagate entries — always routes BREAKING changes to data-quality-validator |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["contract_definition", "violations", "breaking_changes",
               "migration_plan", "contract_tests", "consumer_notifications", "metrics", "feedback"],
  "properties": {
    "contract_definition": {
      "type": "object",
      "required": ["contract_id", "producer", "sla", "schema", "effective_date"],
      "properties": {
        "contract_id":    { "type": "string" },
        "producer":       { "type": "object" },
        "consumer":       { "type": "object" },
        "sla":            { "type": "object" },
        "schema":         { "type": "object" },
        "effective_date": { "type": "string", "format": "date-time" },
        "expiry_policy":  { "type": "string" }
      }
    },
    "violations": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["field", "violation_type", "severity"],
        "properties": {
          "field":           { "type": "string" },
          "violation_type":  { "type": "string" },
          "severity":        { "type": "string", "enum": ["critical", "major", "minor"] },
          "consumer_impact": { "type": "string" }
        }
      }
    },
    "breaking_changes": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["field", "change_type", "severity"],
        "properties": {
          "field":       { "type": "string" },
          "change_type": { "type": "string", "enum": ["REMOVED", "TYPE_CHANGED", "CONSTRAINT_ADDED", "RENAMED"] },
          "old_value":   {},
          "new_value":   {},
          "severity":    { "type": "string", "enum": ["breaking", "compatible"] }
        }
      }
    },
    "migration_plan": {
      "type": "object",
      "required": ["steps", "effort_estimate"],
      "properties": {
        "steps": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["step_id", "change_ref", "action", "effort"],
            "properties": {
              "step_id":   { "type": "string" },
              "change_ref":{ "type": "string" },
              "action":    { "type": "string" },
              "effort":    { "type": "string", "enum": ["trivial", "minor", "major"] }
            }
          }
        },
        "effort_estimate":    { "type": "string" },
        "total_migration_days":{ "type": "number" }
      }
    },
    "contract_tests": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["test_id", "field", "assertion_type", "expression"],
        "properties": {
          "test_id":         { "type": "string" },
          "field":           { "type": "string" },
          "assertion_type":  { "type": "string", "enum": ["type_check", "constraint_check", "presence_check", "freshness_check"] },
          "expression":      { "type": "string" },
          "expected_outcome":{ "type": "string" }
        }
      }
    },
    "consumer_notifications": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["consumer_team", "contract_id", "change_severity"],
        "properties": {
          "consumer_team":    { "type": "string" },
          "contract_id":      { "type": "string" },
          "change_severity":  { "type": "string" },
          "breaking_changes": { "type": "array" },
          "migration_steps":  { "type": "array" },
          "deadline_iso8601": { "type": "string", "format": "date-time" },
          "support_contact":  { "type": "string" }
        }
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
        "tokens_in": { "type": "integer" }, "tokens_out": { "type": "integer" },
        "duration_ms": { "type": "integer" }, "items_produced": { "type": "integer" },
        "version": { "type": "string" }
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

- `consumer_schema` is REQUIRED for `diff` and `validate` operations — absence returns error `MISSING_CONSUMER_SCHEMA`.
- `breaking_change_policy == "strict"` AND breaking changes detected MUST trigger HITL gate before consumer_notifications are dispatched.
- BREAKING changes always require a major version bump in `contract_definition` — minor/patch bumps for breaking changes are rejected.
- `migration_plan.steps` MUST cover every entry in `breaking_changes` — unaddressed breaking changes block migration_plan output.
- Consumer notifications MUST include a `deadline_iso8601` at least 14 days in the future from effective_date.
- Every BREAKING change MUST emit a `feedback` entry of `type: "backpropagate"` targeting `data-quality-validator`.
- The `expiry_policy` MUST follow the N+2 major versions rule — prior contract version honored for two major versions post-change.

## Security Considerations

- `consumer_notifications` MUST NOT include full schema payloads — reference contract_id only to prevent schema enumeration by unauthorized consumers.
- `producer_schema.x-owner` and `consumer_schema.x-consumer` MUST be team identifiers, not personal email addresses (PII in contract metadata is prohibited).
- Contract tests MUST be runnable in isolated CI environments without production data access — use synthetic data fixtures only.
- Breaking change notifications routed through secure channels only; `support_contact` MUST be a team alias, never a personal contact.

## Token Optimization

- For `validate` operations on large schemas (> 50 fields): compress field_comparison_matrix to violation entries only — pass/skip entries are counted but not serialized.
- For `diff` operations: emit `breaking_changes` first, then `compatible_changes` summary count — omit compatible change details unless explicitly requested.
- Migration plan steps are expressed as action templates with `{field}` placeholders — expand to concrete field names in consumer_notifications only.

## Quality Checklist

- [ ] consumer_schema provided for diff and validate operations
- [ ] All breaking changes have corresponding migration plan steps
- [ ] Major version bump applied for all contracts with breaking changes
- [ ] Consumer notifications include deadline at least 14 days from effective_date
- [ ] Contract tests cover all required fields with presence checks
- [ ] BREAKING changes emit backpropagate feedback to data-quality-validator
- [ ] No personal email addresses in owner or consumer fields
- [ ] expiry_policy follows N+2 major versions rule

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| `consumer_schema` absent for `diff`/`validate` | Return error: `{"error": "MISSING_CONSUMER_SCHEMA", "required_for": ["diff", "validate"]}` |
| `producer_schema.version` not semver format | Return error: `{"error": "INVALID_VERSION_FORMAT", "expected": "X.Y.Z"}` |
| Breaking changes with `breaking_change_policy == "strict"` | Trigger HITL gate; block consumer_notifications until human approval |
| Migration plan step count < breaking_changes count | Return error: `{"error": "INCOMPLETE_MIGRATION_PLAN", "uncovered": [...]}` |
| No consumers found in context.contract_registry | Emit empty `consumer_notifications: []` with info feedback; not an error |

## 12. Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Behavior |
|------|---------|---------|----------|
| Breaking change approval | `breaking_change_policy == "strict"` AND `breaking_changes.length > 0` | 7200s | Pause after Step 5; present full breaking change list, affected consumer teams, migration effort estimate, and recommended version bump for data owner and consumer team leads approval before consumer_notifications are dispatched. Rejection returns to producer for schema revision. |
| High-impact migration | `migration_plan.total_migration_days > 10` OR `breaking_changes.length > 5` | 7200s | Present migration complexity summary, effort estimate per consumer team, and rollout timeline recommendation for executive data owner sign-off |

## 13. Skill Composition

```yaml
composes:
  - skill: data-contract-enforcer
    version: "^1.0.0"
    triggered_by:
      - data-quality-validator     # routes BREAKING schema drift events here
      - data-pipeline-architect    # defines initial contracts for new pipelines
    input_map:
      operation:              "event.operation"
      producer_schema:        "pipeline_architecture.stages[-1].output_schema"
      consumer_schema:        "state.consumer_schema_registry[data_domain]"
      data_domain:            "pipeline_architecture.data_products[0].domain"
      breaking_change_policy: "session.breaking_change_policy"
    output_map:
      contract_definition:     "state.data_contracts[data_domain]"
      breaking_changes:        "state.breaking_change_log"
      contract_tests:          "state.contract_test_suite"
      consumer_notifications:  "state.pending_notifications"
    feeds_into:
      - compliance-mapper
      - deployment-strategy
      - data-quality-validator
```

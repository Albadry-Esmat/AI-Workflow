---
name: database-architect
version: 1.1.0
domain: database
description: 'Use when designing, reviewing, or validating the data model for any feature or system. Triggers on: "design the database", "create the schema", "data model review", "ERD design", "migration strategy", "indexing strategy", "audit logging design", "soft-delete pattern".'
author: system
---

## Purpose

Design and validate the data architecture layer for any feature or application. The skill produces normalized database schemas, ERD descriptions, relationship rules, indexing strategies, audit logging definitions, soft-delete patterns, and migration plans. It is the authoritative source for all data model decisions and enforces schema integrity before any implementation begins. When `domain_constraints` is provided by `saas-enterprise-architect` (v1.1.0+), the multi-tenant schema strategy — including tenancy model, Row-Level Security policies, and per-tenant migration orchestration — is applied before entity design begins.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `requirements` | `array[object]` | Yes | Validated requirements from requirement-analyzer (id, type, statement) |
| `architecture` | `object` | Yes | System architecture from architecture-design (modules, data_flow) |
| `database_constraints` | `object` | No | Database engine, version, existing schema if extension |
| `existing_schema` | `array[object]` | No | Already-defined tables to prevent duplication or conflict |
| `domain_constraints` | `object` | No | **NEW v1.1.0.** Domain constraints from `saas-enterprise-architect`. When `domain_constraints.tenancy_model` is present, multi-tenant schema strategy is applied in Step 0 before entity design. |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["requirements", "architecture"],
  "properties": {
    "requirements": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": ["id", "type", "statement"],
        "properties": {
          "id":        { "type": "string" },
          "type":      { "type": "string", "enum": ["F", "NF", "C"] },
          "statement": { "type": "string" }
        }
      }
    },
    "architecture": {
      "type": "object",
      "required": ["modules"],
      "properties": {
        "modules":    { "type": "array" },
        "data_flow":  { "type": "array" }
      }
    },
    "database_constraints": {
      "type": "object",
      "properties": {
        "engine":           { "type": "string" },
        "version":          { "type": "string" },
        "existing_schema":  { "type": "array" }
      }
    }
  }
}
```

## Required Context

- Validated requirements from `requirement-analyzer` (SKL-001).
- Architecture module list from `architecture-design` (SKL-002).
- Database engine/version constraint if the project has an established database.

## Execution Logic

```
Step 0 — Apply multi-tenant schema strategy (if domain_constraints.tenancy_model present)
  Inspect domain_constraints from saas-enterprise-architect:

  tenancy_model == "shared_db":
    - Add tenant_id UUID/BIGINT NOT NULL column to every business entity table
    - Define PostgreSQL Row-Level Security (RLS) policy on every table:
        CREATE POLICY tenant_isolation ON {table}
          USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
    - Enforce: every query in Step 5 index analysis must include tenant_id as leading column
    - Add composite index (tenant_id, primary_filter_column) on all frequently-filtered tables
    - ORM: add application-level tenant scope/guard (e.g., ActiveRecord default_scope, Django Tenant)

  tenancy_model == "schema_per_tenant":
    - All entities are defined in a parameterized schema template (not public schema)
    - Each tenant = one PostgreSQL schema; schema name = tenant slug
    - search_path is set per connection to the tenant's schema
    - Migration orchestration: track per-tenant migration state in a control plane table
      (tenant_migrations: tenant_id, migration_version, applied_at)
    - Schema creation must be idempotent; test with: CREATE SCHEMA IF NOT EXISTS {tenant_slug}
    - No cross-schema foreign keys — each schema is a fully isolated unit

  tenancy_model == "db_per_tenant":
    - Entity definitions are database-level templates; each tenant = separate database
    - Provisioning: database creation script must be automated (Terraform, Pulumi, or migration API)
    - Connection strings are per-tenant and must come from a connection registry (never hardcoded)
    - Backup and restore: per-tenant independent backup schedule
    - Migration: per-tenant migration runner; central orchestrator tracks state

  tenancy_model == "hybrid":
    - Define which entity groups are in shared_db (standard tier) vs. db_per_tenant (enterprise tier)
    - Shared entities: always include tenant_id; RLS required
    - Dedicated entities: database-level isolation for enterprise tenants
    - Promotion path: define schema migration steps to promote a tenant from shared to dedicated

  Output: tenancy_schema_strategy { model, rls_policies, tenant_column_spec, migration_orchestration }

Step 1 — Identify data-bearing requirements
  Filter requirements to those that imply persistent state or data retrieval.
  Group by bounded context (one context = one schema ownership domain).
  Output: data requirement groups with context boundaries

Step 2 — Define entities and attributes
  For each data requirement group, define: entity name, columns (name, type, constraints, nullability).
  Apply audit columns (created_at, updated_at) to all business entities.
  Apply soft-delete columns (deleted_at) to entities with referential dependencies.
  Output: entity definitions with full column specs

Step 3 — Define relationships
  Map FK relationships between entities. Assign cascade rules explicitly.
  Define junction tables for M:N relationships.
  Flag self-referential relationships with depth assumptions.
  Output: relationship map with FK rules and cascade policies

Step 4 — Generate ERD description
  Produce a Mermaid ER diagram of all entities and relationships.
  Output: ERD in Mermaid erDiagram syntax

Step 5 — Define indexing strategy
  For each table: identify PK, FK, and high-cardinality filter/sort columns.
  Recommend composite indexes for multi-column WHERE patterns.
  Flag missing FK indexes as violations.
  Output: index definition list per table

Step 6 — Define migration plan
  Classify all changes as additive, non-destructive, or destructive.
  For destructive changes: define expand/contract migration steps.
  Output: migration plan with up/down scripts structure and approval gate requirements

Step 7 — Security and PII annotation
  Flag all columns containing PII with classification (name, email, phone, etc.).
  Flag all columns containing credentials or secrets with ENCRYPTED annotation.
  Output: security annotation list

Step 8 — Validate against anti-patterns
  Check: no JSON blob catch-all columns, no missing NOT NULL, no FK without index,
  no tables > 30 columns, no circular FK references, no magic-integer enums.
  Output: anti-pattern violation list

Step 9 — Assemble database architecture document
  Combine all outputs into structured artifact.
  Output: complete database architecture spec
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `entities` | `array[object]` | Table definitions (name, columns, constraints, requirements_covered) |
| `relationships` | `array[object]` | FK relationships (from, to, type, cascade, junction_table) |
| `erd` | `string` | Mermaid erDiagram of the full schema |
| `indexes` | `array[object]` | Index definitions (table, columns, type, reason) |
| `migration_plan` | `object` | Migration steps (additive, non_destructive, destructive) with approval gate flags |
| `security_annotations` | `array[object]` | PII and encryption annotations (table, column, classification) |
| `violations` | `array[object]` | Anti-pattern violations (rule, table, column, severity, remediation) |
| `metadata` | `object` | Version, requirement coverage, entity count, relationship count |
| `metrics` | `object` | tokens_in, tokens_out, duration_ms, items_produced, version |
| `feedback` | `array[object]` | Backpropagate entries for upstream skills if gaps found |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["entities", "relationships", "erd", "indexes", "migration_plan", "violations", "metadata", "metrics", "feedback"],
  "properties": {
    "entities": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["name", "columns", "requirements_covered"],
        "properties": {
          "name": { "type": "string" },
          "columns": {
            "type": "array",
            "items": {
              "type": "object",
              "required": ["name", "type", "nullable"],
              "properties": {
                "name":        { "type": "string" },
                "type":        { "type": "string" },
                "nullable":    { "type": "boolean" },
                "default":     { "type": "string" },
                "constraints": { "type": "array", "items": { "type": "string" } },
                "annotations": { "type": "array", "items": { "type": "string" } }
              }
            }
          },
          "requirements_covered": { "type": "array", "items": { "type": "string" } }
        }
      }
    },
    "relationships": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["from_table", "to_table", "type", "cascade"],
        "properties": {
          "from_table":     { "type": "string" },
          "to_table":       { "type": "string" },
          "type":           { "type": "string", "enum": ["one_to_one", "one_to_many", "many_to_many"] },
          "cascade":        { "type": "string", "enum": ["RESTRICT", "CASCADE", "SET_NULL", "NO_ACTION"] },
          "junction_table": { "type": "string" }
        }
      }
    },
    "erd":     { "type": "string" },
    "indexes": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["table", "columns", "type", "reason"],
        "properties": {
          "table":   { "type": "string" },
          "columns": { "type": "array", "items": { "type": "string" } },
          "type":    { "type": "string", "enum": ["primary", "unique", "non_clustered", "composite", "full_text", "partial"] },
          "reason":  { "type": "string" }
        }
      }
    },
    "migration_plan": {
      "type": "object",
      "properties": {
        "additive":         { "type": "array", "items": { "type": "string" } },
        "non_destructive":  { "type": "array", "items": { "type": "string" } },
        "destructive":      { "type": "array", "items": { "type": "object", "properties": { "operation": { "type": "string" }, "requires_approval": { "type": "boolean" }, "expand_contract_steps": { "type": "array", "items": { "type": "string" } } } } }
      }
    },
    "violations": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["rule", "table", "severity", "remediation"],
        "properties": {
          "rule":        { "type": "string" },
          "table":       { "type": "string" },
          "column":      { "type": "string" },
          "severity":    { "type": "string", "enum": ["critical", "major", "minor"] },
          "remediation": { "type": "string" }
        }
      }
    },
    "metadata": {
      "type": "object",
      "properties": {
        "version":              { "type": "string" },
        "requirement_coverage": { "type": "number", "minimum": 0, "maximum": 1 },
        "entity_count":         { "type": "integer" },
        "relationship_count":   { "type": "integer" }
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

- Every entity MUST cover at least one data-bearing requirement.
- All FK relationships MUST have an explicit cascade rule — no defaults.
- Every FK column on the child table MUST have a corresponding non-clustered index entry.
- ERD MUST be parseable Mermaid `erDiagram` syntax.
- `migration_plan.destructive` entries MUST have `requires_approval: true`.
- `violations` with `severity: critical` block pipeline advancement to implementation.

## Security Considerations

- PII column annotations are mandatory — the database-guard skill (SKL-034) will reject any output with unannotated PII.
- Encrypted column annotations must reference the encryption mechanism (e.g., `-- ENCRYPTED: AES-256-GCM`).
- Application database users must not have `DROP`, `ALTER`, or `TRUNCATE` rights — document required grants in migration plan.

## Token Optimization

- Compress `requirements` to ID + statement only.
- For large schemas (> 20 entities), group by bounded context and summarize per context.
- ERD is truncated to the most critical entity cluster if > 50 entities.

## Quality Checklist

- [ ] All data-bearing requirements have at least one entity
- [ ] All FK columns have corresponding index entries
- [ ] All business entities have audit columns (created_at, updated_at)
- [ ] All soft-delete-eligible entities have deleted_at
- [ ] No violations with severity: critical
- [ ] ERD renders without syntax errors
- [ ] All destructive migration steps are flagged requires_approval: true

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| No data-bearing requirements | Return error: `{"error": "NO_DATA_REQUIREMENTS"}` |
| Circular FK reference detected | Flag as critical violation, propose junction table alternative |
| > 30 columns in a single entity | Flag as major violation, propose decomposition |
| Destructive migration with no expand/contract plan | Flag as critical violation, block migration_plan output |

## Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Behavior |
|------|---------|---------|----------|
| Schema approval | Always — schema affects all downstream implementation and migrations | 3600s | Present ERD, entity count, violation list for sign-off |
| Destructive migration approval | Any `migration_plan.destructive` entry | 7200s | Present full expand/contract steps and data impact assessment |

## Skill Composition

```yaml
composes:
  - skill: database-architect
    version: "^1.0.0"
    input_map:
      requirements: "validated_requirements"
      architecture: "system_architecture"
    output_map:
      entities:    "db_entities"
      erd:         "database_erd"
      indexes:     "db_indexes"
```

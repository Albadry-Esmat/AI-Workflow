# Database Architecture
#
# Version:  1.0.0
# Domain:   database / data-modeling
# Skill:    .opencode/skills/database-architect/SKILL.md
#
# Purpose:
#   Authoritative knowledge base for designing, validating, and governing
#   relational and non-relational database schemas for enterprise applications.

## Principles

- **Normalization first**: start at 3NF. Denormalize only with explicit justification and documented tradeoffs.
- **Schema as contract**: the database schema is a public contract — changes to it are breaking changes and must be versioned.
- **No implicit nullability**: every nullable column is a deliberate decision with a documented reason.
- **Integrity at the database level**: constraints (FK, UNIQUE, CHECK, NOT NULL) are enforced in the database, not only in application code.
- **Audit by default**: every entity that represents business data must have `created_at`, `updated_at`, and optionally `created_by`, `updated_by`.
- **Soft-delete by policy**: entities that are referenced by other records use soft-delete (`deleted_at`) rather than hard-delete to preserve referential integrity.

## Normalization Reference

| Normal Form | Rule |
|-------------|------|
| 1NF | No repeating groups; each column holds atomic values |
| 2NF | No partial dependencies on a composite key |
| 3NF | No transitive dependencies — non-key columns depend only on the primary key |
| BCNF | Every determinant is a candidate key |

Denormalization is permitted only when: (a) query performance profiling demonstrates a measurable problem, and (b) the denormalization is isolated and documented.

## Entity Design Rules

- Every entity has a surrogate primary key (`id`) using UUID v4 or a database-native sequence.
- Natural keys may be used as UNIQUE constraints but not as primary keys.
- Enumerations are stored as constrained VARCHAR columns (with CHECK constraint) or a dedicated enum type — never as magic integers.
- Polymorphic associations are discouraged; if required, document the alternative considered and why it was rejected.

## Relationship Rules

- All foreign keys must have an explicit cascade rule: `RESTRICT`, `CASCADE`, `SET NULL`, or `NO ACTION`. No implicit defaults.
- Many-to-many relationships require an explicit junction table with its own `id`, `created_at`, and at minimum both FK columns.
- Self-referential relationships (hierarchies) must document the maximum depth assumption and whether adjacency list, nested sets, or closure table is used.

## Indexing Strategy

| Scenario | Index Type |
|----------|-----------|
| Primary key lookup | Clustered (default) |
| Foreign key column | Non-clustered (always) |
| Frequently filtered column (WHERE) | Non-clustered |
| Frequently sorted column (ORDER BY) | Non-clustered |
| Full-text search | Full-text index |
| Multi-column filter (WHERE a AND b) | Composite index, order matters |
| Unique business constraint | UNIQUE index |

Index anti-patterns: indexing every column, duplicate indexes, indexes on low-cardinality boolean columns.

## Audit Logging

Every table that stores business-critical data must have:

| Column | Type | Rule |
|--------|------|------|
| `created_at` | `TIMESTAMPTZ` | Default `NOW()`, not null, immutable |
| `updated_at` | `TIMESTAMPTZ` | Updated by trigger or application on every mutation |
| `created_by` | `UUID / FK` | Optional — references user entity if applicable |
| `updated_by` | `UUID / FK` | Optional — references user entity if applicable |

For audit trails (full history), use a separate `_history` or `_audit` table or a temporal table pattern, not JSON blobs in the main table.

## Soft-Delete Pattern

```sql
-- Standard soft-delete columns
deleted_at   TIMESTAMPTZ  NULL     -- NULL means active, non-NULL means deleted
deleted_by   UUID         NULL     -- FK to users if applicable

-- Required index on soft-delete queries
CREATE INDEX idx_<table>_active ON <table>(deleted_at) WHERE deleted_at IS NULL;

-- Application queries must always include
WHERE deleted_at IS NULL
```

Hard-delete is only permitted for: session tokens, temporary working data, and ephemeral records with no downstream references.

## Migration Strategy

- Migrations are versioned sequentially and stored in a `migrations/` directory.
- Migration filenames follow the pattern: `YYYYMMDDHHMMSS_<description>.sql`
- Every migration has an `up` script and a `down` script.
- Non-destructive changes (adding columns, adding indexes, adding tables) do not require approval gates.
- Destructive changes (dropping columns, dropping tables, altering column types) require an explicit approval gate and a data backup checkpoint.
- Zero-downtime migrations use the expand/contract pattern: add new column → migrate data → drop old column across separate deployments.

## Anti-Patterns

- Storing serialized JSON in a VARCHAR column to avoid adding a proper column.
- Using a single `data JSONB` column as a catch-all for evolving entities.
- FK without an index on the child table.
- Omitting `NOT NULL` on columns that are always required.
- Using `TEXT` for columns with known bounded values (use VARCHAR with length or CHECK).
- Storing passwords, secrets, or PII without encryption-at-rest annotation.
- Tables with > 30 columns that model more than one concern (violation of single responsibility).
- Circular foreign key references.

## Performance Considerations

- Query plans should be reviewed for tables expected to exceed 1M rows.
- Pagination using `OFFSET` is prohibited for large datasets — use keyset pagination.
- Bulk inserts must use batch INSERT syntax, not N individual INSERT statements.
- JSONB columns are acceptable for truly schema-less data but must not replace normalized columns.

## Security Rules

- PII columns must be annotated with `-- PII: <classification>` in the schema definition.
- Columns storing credentials or tokens must be annotated with `-- ENCRYPTED` and must never store plaintext.
- Database user permissions follow least-privilege: application user has no DDL rights.

## Source References

- Codd, E.F. — A Relational Model of Data for Large Shared Data Banks (1970)
- Martin Fowler — Patterns of Enterprise Application Architecture
- PostgreSQL Documentation — Indexes, Constraints, Triggers
- Percona — MySQL / PostgreSQL Performance Schema Best Practices
- OWASP — Database Security Cheat Sheet

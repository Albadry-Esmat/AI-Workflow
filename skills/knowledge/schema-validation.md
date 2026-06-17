# Schema Validation — Knowledge Reference

**Skill ID:** SKL-009
**Version:** 1.0.0 | **Last updated:** 2026-06-16
**Mastery Level:** beginner
**Executable Skill:** [schema-validator](../validation/schema-validator.md)
**Primary Source:** *JSON Schema Core Specification* — Wright et al. (draft-07, 2018)

---

## Overview

Schema validation enforces structural contracts at runtime. Every skill in the pipeline produces JSON output; schema validation confirms that output is complete, correctly typed, and conforms to its declared contract before passing downstream. Without this gate, type errors and missing fields propagate silently through the pipeline and produce confusing failures far from their source.

---

## Purpose

Apply this skill to:

- Validate skill outputs between every pipeline step
- Catch missing required fields, type mismatches, and constraint violations at the boundary
- Provide field-level error reports that pinpoint exactly what is wrong
- Enforce contract compliance without coupling consumers to implementation details

---

## Principles

### P1 — Fail Fast at the Boundary *(JSON Schema draft-07)*

Validation failures should surface at the point where data crosses a boundary, not at the point where it is consumed. Fail fast; fail with precise location.

**Rules:**
- Validate immediately after a skill completes, before passing output downstream
- Report errors with JSON paths (e.g., `requirements.0.id`), not generic messages
- A validation error must halt the pipeline — it must not propagate corrupt data

### P2 — Schema as Contract *(JSON Schema Specification)*

A schema is the contract between producer and consumer. It declares what will be present, what types are expected, and what constraints apply.

**Key JSON Schema keywords:**
| Keyword | Purpose |
|---------|---------|
| `type` | Enforce data type: string, integer, boolean, array, object |
| `required` | List of property names that must be present |
| `properties` | Define shape of each property |
| `enum` | Restrict to a fixed set of values |
| `pattern` | Enforce string format via regex |
| `minimum` / `maximum` | Numeric range constraints |
| `minItems` / `maxItems` | Array length constraints |
| `$ref` / `$defs` | Reuse schema fragments without duplication |

### P3 — Strict vs Permissive Mode

| Mode | Unknown Properties | When to Use |
|------|--------------------|-------------|
| `permissive` | Ignored | Inter-skill handoffs — allow forward evolution |
| `strict` | Validation error | Contract testing — ensure no unexpected fields exist |

**Rule:** Use permissive mode in the pipeline (consumers only read what they need); use strict mode in contract tests.

---

## Practices

| Practice | Description |
|----------|-------------|
| Define `$defs` for shared types | `metrics` and `feedback_entry` appear in every skill — define once, `$ref` everywhere |
| Use `pattern` for IDs | `"^REQ-[A-Z]{3}-\\d{3}$"` — catch malformed IDs before they cause downstream failures |
| Make `required` explicit | Every field a consumer depends on must be in `required` — do not assume it will be present |
| Report errors at exact path | `requirements.2.priority` is actionable; "requirements error" is not |

---

## Anti-patterns

### AP1 — Implicit Contracts

**What:** Skills pass data to each other with no schema — consumers read what they find.
**Why harmful:** Missing fields fail silently or produce null-pointer exceptions deep in the pipeline.
**How to fix:** Every skill has a declared output schema; schema-validator runs after every step.

### AP2 — Validating Only the Happy Path

**What:** Schema only declares the structure for successful output; error output is untyped.
**Why harmful:** Error responses propagate with no structure; callers cannot parse them reliably.
**How to fix:** Define error output schemas with `error` (code string) and `message` fields as required.

### AP3 — Over-Constraining the Schema

**What:** Every optional field marked required; every string with a strict pattern.
**Why harmful:** Schema becomes brittle — valid evolutions break validation before they should.
**How to fix:** Only mark fields required if consumers will fail without them. Optional fields use `if/then` or are simply absent from `required`.

---

## Examples

### ✅ Correct — Precise Field-Level Error Report

```json
{
  "valid": false,
  "issues": [
    {
      "path": "requirements.0.id",
      "expected": "string matching ^REQ-[A-Z]{3}-\\d{3}$",
      "actual": "req-001",
      "severity": "error"
    }
  ]
}
```

### ❌ Incorrect — Vague Validation Error

```json
{
  "valid": false,
  "error": "Invalid requirements array"
}
```

---

### ✅ Correct — Shared Type via $defs

```json
{
  "$defs": {
    "feedback_entry": {
      "type": "object",
      "properties": {
        "type": { "type": "string", "enum": ["backpropagate", "info", "warning"] },
        "from_skill": { "type": "string" },
        "reason": { "type": "string" }
      },
      "required": ["type", "from_skill", "reason"]
    }
  },
  "properties": {
    "feedback": {
      "type": "array",
      "items": { "$ref": "#/$defs/feedback_entry" }
    }
  }
}
```

### ❌ Incorrect — Inline Duplication

```json
// Same feedback_entry shape copy-pasted into 11 different skill schemas
// Any change requires 11 updates — guaranteed to drift
"feedback": {
  "type": "array",
  "items": {
    "type": "object",
    "properties": { "type": ..., "from_skill": ... }
  }
}
```

---

## Related Skills

| Skill | ID | Relationship |
|-------|----|-------------|
| Orchestration | SKL-010 | Orchestrator invokes schema-validator after every skill step |
| Documentation Maintenance | SKL-011 | Schema-validator validates new doc file structure in doc-maintainer |
| All pipeline skills | SKL-001–008 | Every skill's output is validated by SKL-009 before passing downstream |

---

## Source References

| Source | Chapter / Section | Linked Content |
|--------|------------------|----------------|
| JSON Schema Core — Wright et al. (draft-07) | Full specification | P2 |
| Understanding JSON Schema — json-schema.org | Structuring a complex schema | P2, Practices |
| JSON Schema Validation draft-07 | Required, enum, pattern keywords | P1, P3 |

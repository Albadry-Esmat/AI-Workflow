---
name: database-guard
version: 1.0.0
domain: governance
description: 'Use when enforcing database schema safety before a migration or schema change is applied. Triggers on: "validate schema change", "check migration safety", "database guard", "is this migration safe", "destructive migration check".'
author: system
---

## Purpose

Enforce database schema safety by inspecting proposed schema changes and migration plans against a defined rule set. The guard runs as a `validation_check` gate in the pipeline and emits a structured `pass` or `block` verdict. It prevents destructive or unsafe database operations from reaching the deployment step without explicit approval.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `migration_plan` | `object` | Yes | Migration plan output from database-architect (SKL-032) |
| `db_entities` | `array[object]` | Yes | Entity definitions from database-architect (SKL-032) |
| `existing_schema` | `array[object]` | No | Current deployed schema for diff-based analysis |
| `override_decision_id` | `string` | No | Registry decision id (`gd_...`) from `scripts/gate-decisions.js` approving named destructive operations. The ONLY approval mechanism — bearer `approval_context` objects are never trusted. |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["migration_plan", "db_entities"],
  "properties": {
    "migration_plan":    { "type": "object" },
    "db_entities":       { "type": "array" },
    "existing_schema":   { "type": "array" },
    "override_decision_id": {
      "type": "string",
      "pattern": "^gd_[a-f0-9]{16}$",
      "description": "Registry decision id resolved by the orchestrator via scripts/resolve-override.js (scope.destructive_operations must cover each destructive entry)."
    }
  }
}
```

## Required Context

- `migration_plan` and `db_entities` from `database-architect` (SKL-032).
- A resolved `override_decision_id` if any destructive operations were previously approved (registry decision with matching scope).

## Execution Logic

```
Step 1 — Check destructive operations without a resolved approval
  Scan migration_plan.destructive for entries.
  The orchestrator MUST have resolved override_decision_id via
    node scripts/resolve-override.js --decision-id <id> --gate-id <this gate invocation>
      --gate-class general --scope-json '{"destructive_operations":[...]}'
  A destructive entry NOT covered by the resolved decision scope → block verdict.
  A bare approval_context object with NO resolvable decision id → block verdict
  with reason override_unresolved. Never mint or reinterpret approval fields.
  Output: destructive operation list + approval status

Step 2 — Check missing FK indexes
  For every FK relationship in db_entities, verify a corresponding index exists.
  Missing FK index = violation.
  Output: FK index coverage report

Step 3 — Check PII annotation completeness
  Scan all entity columns for PII indicators (email, phone, ssn, name, address, etc.).
  Any column matching PII heuristics without an explicit annotation = violation.
  Output: PII annotation gap list

Step 4 — Check critical anti-patterns
  Verify: no circular FK references, no tables > 30 columns,
  no missing NOT NULL on required columns, no magic-integer enums.
  Output: anti-pattern check results

Step 5 — Check cascade rule completeness
  All FK relationships must have an explicit cascade rule (not implicit default).
  Output: cascade rule coverage

Step 6 — Assemble verdict
  If any block-level violation exists: verdict = "block"
  If only warning-level violations: verdict = "pass" with warnings attached
  Output: guard verdict with violation list
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `verdict` | `string` | `pass` or `block` |
| `violations` | `array[object]` | All violations (rule, table, severity, remediation) |
| `blocking_findings` | `array[object]` | Blocking-findings accounting for the governance envelope: `violations` with block-level severity, each as {id: rule, reason}. Empty if and only if verdict is `pass`. |
| `warnings` | `array[object]` | Non-blocking issues that should be addressed |
| `destructive_ops_count` | `integer` | Number of destructive operations in migration plan |
| `metrics` | `object` | tokens_in, tokens_out, duration_ms, items_produced, version |
| `feedback` | `array[object]` | Backpropagate to database-architect if violations found |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["verdict", "violations", "metrics", "feedback"],
  "properties": {
    "verdict":               { "type": "string", "enum": ["pass", "block"] },
    "violations": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["rule", "severity", "remediation"],
        "properties": {
          "rule":        { "type": "string" },
          "table":       { "type": "string" },
          "column":      { "type": "string" },
          "severity":    { "type": "string", "enum": ["critical", "major", "minor"] },
          "remediation": { "type": "string" }
        }
      }
    },
    "warnings":              { "type": "array" },
    "destructive_ops_count": { "type": "integer" },
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

## Block Conditions (verdict = "block")

| Condition | Rule |
|-----------|------|
| Destructive migration without approval | `destructive_without_approval` |
| Circular FK reference | `circular_fk_reference` |
| Missing FK index | `missing_fk_index` |
| PII column without annotation | `unannotated_pii` |
| FK without explicit cascade rule | `missing_cascade_rule` |

## Rules & Constraints

- This skill is read-only — it never modifies schemas or migration files.
- A `block` verdict MUST halt the pipeline gate. The orchestrator MUST NOT advance past this guard with a `block` verdict.
- Warnings do not block but are included in the gate approval request for human review.

## Security Considerations

- This skill is read-only — it never modifies schemas or migration files.
- Do not log raw column values — log only column names and types in violation reports.
- PII annotation gaps are flagged as `critical` severity to prevent data exposure.

## Token Optimization

- Scan entity definitions only — do not load full migration SQL content into context.
- Violations list is capped at 20 entries; additional violations are summarized as count + pattern.

## Quality Checklist

- [ ] All FK relationships checked for corresponding indexes
- [ ] All PII-heuristic columns verified for annotation
- [ ] Destructive operations list cross-referenced with the resolved decision `scope.destructive_operations`
- [ ] Cascade rules verified for all FK relationships
- [ ] Anti-pattern scan completed (circular FKs, over-wide tables, magic enums)
- [ ] Verdict field is exactly `"pass"` or `"block"` — no other values

## Failure Scenarios

| Scenario | Action |
|----------|--------|
| `migration_plan` is missing or malformed | Emit `verdict: "block"`, `reason: "invalid_migration_plan"` |
| `db_entities` is empty | Emit `verdict: "block"`, `reason: "empty_entity_list"` |
| PII heuristic scan errors | Emit `verdict: "block"`, `reason: "pii_scan_error"` — fail safe |
| Circular FK detected | Emit `verdict: "block"`, `reason: "circular_fk_reference"` |

## Human-in-the-Loop Gates

- If `verdict: "block"` with `rule: "destructive_without_approval"`, the pipeline pauses for human approval of the destructive operation before the guard is re-run.
- All other `block` verdicts require code/schema fix — no approval path bypasses them.

## Skill Composition

```yaml
composes:
  - skill: database-guard
    version: "^1.0.0"
    input_map:
      migration_plan: "db_migration_plan"
      db_entities:    "db_entity_list"
    output_map:
      verdict:     "db_guard_verdict"
      violations:  "db_guard_violations"
```

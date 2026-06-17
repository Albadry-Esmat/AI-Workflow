---
name: code-repair
version: 1.0.0
domain: implementation
description: Use when fixing failing tests, compiler errors, linter violations, or type errors in existing code. Triggers on: "fix this error", "repair failing tests", "fix type errors", "fix linter violations", "the build is broken", "tests are failing".
author: system
---

## Purpose

Diagnose and repair broken code — compilation failures, failing tests, type errors, linter violations, and runtime exceptions — without introducing regressions. The code-repair skill is the automated recovery arm of the pipeline: it is triggered by `test.failed` events, `code.changed` events that produce errors, and on-demand by the orchestrator when a build is broken. It operates conservatively — minimal, targeted changes only — and always validates the repair before writing to state.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `repair_type` | `string` | Yes | `test_failure`, `compile_error`, `type_error`, `lint_violation`, or `runtime_error` |
| `failing_artifact` | `object` | Yes | The file or module with the failure: `{ path, content, language }` |
| `error_report` | `object` | Yes | The error details: `{ message, file, line, column, stack_trace? }` |
| `test_output` | `object` | No | Full test runner output (for `test_failure` type) |
| `architecture` | `object` | No | Architecture modules — used to verify repair doesn't violate contracts |
| `dependency_graph` | `object` | No | Dependency graph — used to assess repair blast radius |
| `max_iterations` | `integer` | No | Maximum repair attempts before escalating (default: 3) |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "repair_type": { "type": "string", "enum": ["test_failure", "compile_error", "type_error", "lint_violation", "runtime_error"] },
    "failing_artifact": {
      "type": "object",
      "properties": {
        "path": { "type": "string" },
        "content": { "type": "string" },
        "language": { "type": "string" }
      },
      "required": ["path", "content", "language"]
    },
    "error_report": {
      "type": "object",
      "properties": {
        "message": { "type": "string" },
        "file": { "type": "string" },
        "line": { "type": "integer" },
        "column": { "type": "integer" },
        "stack_trace": { "type": "string" }
      },
      "required": ["message", "file"]
    },
    "test_output": { "type": "object" },
    "architecture": { "type": "object" },
    "dependency_graph": { "type": "object" },
    "max_iterations": { "type": "integer", "minimum": 1, "maximum": 10 }
  },
  "required": ["repair_type", "failing_artifact", "error_report"]
}
```

## Required Context

- Architecture contracts from system state `architecture` scope (for contract-preservation validation).
- Dependency graph from `dependency-analyzer` (for blast-radius assessment).
- Test files from system state `test_files` scope (for `test_failure` repairs — to understand test intent).

## Execution Logic

```
Step 1 — Classify error root cause
  Parse error_report.message and stack_trace (if present).
  Classify root cause:
    - MISSING_IMPORT: import/require statement missing
    - TYPE_MISMATCH: wrong type passed or returned
    - NULL_REFERENCE: unguarded null/undefined access
    - CONTRACT_VIOLATION: function called with wrong arity or shape
    - LOGIC_ERROR: test assertion fails due to incorrect logic
    - LINT_STYLE: formatting or style rule violation
    - UNDEFINED_SYMBOL: reference to non-existent variable/function
  Output: root_cause { category, location, description }

Step 2 — Locate repair site
  Use error_report.line/column to locate the exact repair site in failing_artifact.content.
  For LOGIC_ERROR: also load the corresponding test file to understand expected behavior.
  Output: repair_site { line_start, line_end, context_lines }

Step 3 — Generate repair candidates
  Generate 1–3 minimal repair candidates for the root cause.
  Each candidate modifies the fewest lines possible.
  Candidate constraints:
    - Must not change any public interface/export signatures.
    - Must not remove any function, method, or class — only fix internals.
    - Must not introduce new dependencies not present in architecture.
  Output: repair_candidates list { id, description, diff, risk: low|medium|high }

Step 4 — Select and apply repair
  Select the lowest-risk candidate that addresses the root cause.
  Apply the diff to failing_artifact.content.
  Output: repaired_content

Step 5 — Validate repair
  Parse repaired_content for syntax errors.
  Check that all public exports from the original file are still present.
  Check that repair does not introduce new lint violations.
  If architecture available: verify no contract violation in repaired code.
  Output: validation_result { valid, regressions_detected, errors }

Step 6 — Iterate or escalate
  If validation fails and iterations < max_iterations: return to Step 3 with next candidate.
  If all candidates exhausted or max_iterations reached: escalate.
  Output: repair_outcome { success: boolean, iterations_used: integer }

Step 7 — Write repair and emit event
  If repair_outcome.success: write repaired_content to state via state-manager.
  Emit event: "code.changed" with { path: failing_artifact.path, repair: true }.
  Output: written_repair
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `repaired_artifact` | `object` | `{ path, content, diff }` — the repaired file |
| `root_cause` | `object` | Classified root cause of the failure |
| `repair_outcome` | `object` | `{ success, iterations_used, escalated }` |
| `validation_result` | `object` | `{ valid, regressions_detected, errors }` |
| `metrics` | `object` | Execution metrics |
| `feedback` | `array[object]` | Feedback entries |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "repaired_artifact": {
      "type": "object",
      "properties": {
        "path": { "type": "string" },
        "content": { "type": "string" },
        "diff": { "type": "string" }
      },
      "required": ["path", "content", "diff"]
    },
    "root_cause": {
      "type": "object",
      "properties": {
        "category": { "type": "string" },
        "location": { "type": "string" },
        "description": { "type": "string" }
      },
      "required": ["category", "description"]
    },
    "repair_outcome": {
      "type": "object",
      "properties": {
        "success": { "type": "boolean" },
        "iterations_used": { "type": "integer" },
        "escalated": { "type": "boolean" }
      },
      "required": ["success", "iterations_used", "escalated"]
    },
    "validation_result": {
      "type": "object",
      "properties": {
        "valid": { "type": "boolean" },
        "regressions_detected": { "type": "boolean" },
        "errors": { "type": "array" }
      },
      "required": ["valid", "regressions_detected", "errors"]
    },
    "metrics": { "$ref": "#/$defs/metrics" },
    "feedback": { "type": "array", "items": { "$ref": "#/$defs/feedback_entry" } }
  },
  "required": ["repaired_artifact", "root_cause", "repair_outcome", "validation_result", "metrics", "feedback"],
  "$defs": {
    "metrics": {
      "type": "object",
      "properties": {
        "tokens_in": { "type": "integer" },
        "tokens_out": { "type": "integer" },
        "duration_ms": { "type": "integer" },
        "items_produced": { "type": "integer" },
        "version": { "type": "string" }
      },
      "required": ["tokens_in", "tokens_out", "duration_ms", "items_produced", "version"]
    },
    "feedback_entry": {
      "type": "object",
      "properties": {
        "type": { "type": "string", "enum": ["backpropagate", "info", "warning"] },
        "from_skill": { "type": "string" },
        "target_skill": { "type": "string" },
        "reason": { "type": "string" },
        "evidence": { "type": "object" }
      },
      "required": ["type", "from_skill", "reason"]
    }
  }
}
```

## Rules & Constraints

- Repairs MUST NOT change public API signatures — only fix internals.
- Repairs MUST NOT add new external dependencies not already in the architecture.
- If `validation_result.regressions_detected === true`, the repair is rejected regardless of success.
- Maximum iterations: 10 hard ceiling regardless of `max_iterations` input.
- Escalation triggers `rollback-manager` if the broken file was previously working (has a prior snapshot).

## Security Considerations

- Repair candidates must not introduce shell execution, dynamic eval, or unsanitized input interpolation.
- If root_cause is CONTRACT_VIOLATION involving an auth or data access boundary, route to `security-review` before applying repair.

## Token Optimization

- Pass only `error_report` and `repair_site.context_lines` (±10 lines) — not the full file content.
- Candidates 2 and 3 are only generated if Candidate 1 fails validation — lazy generation.
- Store `diff` in state, not full `repaired_content` — full content reconstructed from diff on read.

## Quality Checklist

- [ ] Root cause classified before repair generation
- [ ] Repair candidates are minimal (fewest lines changed)
- [ ] Public exports preserved in repaired_content
- [ ] Regression detection runs on repaired code
- [ ] Escalation path fires when max_iterations reached

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| error_report.message empty | Reject: `{"error": "EMPTY_ERROR_MESSAGE"}` |
| All candidates fail validation | Set `repair_outcome.escalated=true`, emit backpropagate to clean-code-review |
| Root cause is LOGIC_ERROR with no test file | Emit warning, attempt repair from error message alone |
| Repaired content introduces security pattern | Reject repair, route to security-review via feedback |

## 12. Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Behavior |
|------|---------|---------|----------|
| Escalation after max iterations | `repair_outcome.escalated === true` | 3600s | Pause, present all candidates and error context for human repair |
| Security boundary in repair path | Root cause touches auth/data access | 3600s | Pause, require security-review approval before applying repair |

## 13. Skill Composition

`code-repair` is invoked by the orchestrator on `test.failed` events:

```yaml
composes:
  - skill: code-repair
    version: "^1.0.0"
    input_map:
      repair_type: "test_failure"
      failing_artifact: "event.payload.artifact"
      error_report: "event.payload.error"
      test_output: "event.payload.test_output"
    output_map:
      repaired_artifact: "state.code_map[failing_artifact.path]"
```

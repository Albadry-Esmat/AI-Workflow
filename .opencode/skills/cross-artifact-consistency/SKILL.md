---
name: cross-artifact-consistency
version: 1.0.0
domain: governance
description: 'Use after test-generator and before code-generator to validate structural consistency across requirements, architecture modules, tasks, and tests. Checks: every REQ has ≥1 test, every module maps to ≥1 task, every task references a REQ or module. Blocks pipeline on violations. HITL approval allows override with documented reason. Triggers on: "consistency check", "cross-artifact validation", "are artifacts consistent", "orphaned tasks", "uncovered modules".'
author: system
---

## Purpose

Enforce structural consistency across the four core pipeline artifacts — requirements, architecture, task breakdown, and test plan — before any code is generated. As artifacts evolve through pipeline iterations they can fall out of sync: a requirement can lose all test coverage, an architecture module can be added without corresponding tasks, or tasks can become orphaned from any feature anchor.

This skill is a **guard** — it returns a structured `consistency_violations[]` list and a binary verdict (`pass` / `block`). On `block`, the pipeline halts at this stage. A HITL override allows the team to acknowledge specific violations and proceed with a documented reason, creating an explicit audit trail.

This skill was introduced in FEATURE-010 (Cross-Artifact Consistency Guard) as SKL-114.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `requirements` | `array[object]` | Yes | Validated requirements. Each: `id` (REQ-XXX-NNN), `type`, `statement`. |
| `modules` | `array[object]` | Yes | Architecture modules from `architecture-design`. Each: `name`, `responsibility`. |
| `tasks` | `array[object]` | Yes | Task breakdown from `feature-planning`. Each: `id` (TASK-NNNN), `description`, `req_ids[]`, `module_refs[]`. |
| `test_cases` | `array[object]` | Yes | Test cases from `test-generator`. Each: `id` (TEST-NNN), `coverage_target` (REQ ID). |
| `override_approved` | `boolean` | No | If `true` (set by HITL gate), violations are acknowledged and the verdict is downgraded to `warn`. |
| `override_reason` | `string` | No | Required when `override_approved: true`. Logged in audit trail. |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["requirements", "modules", "tasks", "test_cases"],
  "properties": {
    "requirements": { "type": "array", "minItems": 1 },
    "modules":      { "type": "array", "minItems": 1 },
    "tasks":        { "type": "array", "minItems": 1 },
    "test_cases":   { "type": "array" },
    "override_approved": { "type": "boolean" },
    "override_reason":   { "type": "string" }
  }
}
```

## Required Context

- Requirements from `requirement-analyzer` / `clarify` — IDs and statements.
- Architecture modules from `architecture-design` — module names and responsibilities.
- Tasks from `feature-planning` — task IDs, `req_ids[]`, `module_refs[]`.
- Test cases from `test-generator` — test IDs and `coverage_target` (REQ ID).

## Execution Logic

```
Step 1 — Build coverage maps
  req_ids      = Set of all requirement IDs from requirements[]
  module_names = Set of all module names from modules[]
  task_ids     = Set of all task IDs from tasks[]
  test_targets = Set of all test_case.coverage_target values

  Build:
    req_to_tests_map  { req_id → [test_ids covering it] }
    req_to_tasks_map  { req_id → [task_ids referencing it] }
    module_to_tasks_map { module_name → [task_ids referencing it] }
    task_to_reqs_map  { task_id → task.req_ids[] }
    task_to_modules_map { task_id → task.module_refs[] }

Step 2 — Check A: REQ → TEST coverage
  For each req_id in req_ids:
    If req_to_tests_map[req_id] is empty:
      Record violation:
        rule: "REQ_NO_TEST"
        severity: "error"
        entity: req_id
        message: "Requirement <req_id> has no linked test case"
        fix_hint: "Add a test case with coverage_target: <req_id> in test-generator"

Step 3 — Check B: Module → TASK mapping
  For each module_name in module_names:
    If module_to_tasks_map[module_name] is empty:
      Record violation:
        rule: "MODULE_NO_TASK"
        severity: "error"
        entity: module_name
        message: "Architecture module '<module_name>' has no linked implementation task"
        fix_hint: "Add a task with module_refs: [<module_name>] in feature-planning"

Step 4 — Check C: TASK → REQ/MODULE linkage (orphan detection)
  For each task T in tasks[]:
    has_req_link    = T.req_ids[] is non-empty AND all req_ids in T.req_ids[] are in req_ids
    has_module_link = T.module_refs[] is non-empty AND all module_refs in T.module_refs[] are in module_names
    If NOT has_req_link AND NOT has_module_link:
      Record violation:
        rule: "TASK_ORPHANED"
        severity: "warning"
        entity: T.id
        message: "Task <T.id> is not linked to any requirement or architecture module"
        fix_hint: "Add req_ids[] or module_refs[] to task <T.id>"
    If has_req_link AND some req_id in T.req_ids[] is NOT in req_ids:
      Record violation:
        rule: "TASK_UNKNOWN_REQ"
        severity: "error"
        entity: T.id
        message: "Task <T.id> references unknown requirement <bad_req_id>"
        fix_hint: "Remove or correct the req_id in task <T.id>"
    If has_module_link AND some module_ref in T.module_refs[] is NOT in module_names:
      Record violation:
        rule: "TASK_UNKNOWN_MODULE"
        severity: "error"
        entity: T.id
        message: "Task <T.id> references unknown module '<bad_module>'"
        fix_hint: "Remove or correct the module_ref in task <T.id>"

Step 5 — Check D: Test coverage_target validity
  For each test_case T in test_cases[]:
    If T.coverage_target not in req_ids:
      Record violation:
        rule: "TEST_UNKNOWN_REQ"
        severity: "error"
        entity: T.id
        message: "Test <T.id> has coverage_target '<T.coverage_target>' which is not a known requirement"
        fix_hint: "Correct coverage_target in test <T.id> to a valid REQ-XXX-NNN ID"

Step 6 — Compute verdict
  error_count   = count of violations where severity == "error"
  warning_count = count of violations where severity == "warning"

  If error_count == 0:
    verdict = "pass"
  Else If override_approved == true AND override_reason is non-empty:
    verdict = "warn"
    Record override event: { violations_overridden: error_count, reason: override_reason, timestamp }
  Else:
    verdict = "block"

Step 7 — Assemble output and emit telemetry
  Emit based on verdict:
    "pass"  → INFO: consistency_check_passed
    "warn"  → WARN: consistency_violations_overridden { error_count, override_reason }
    "block" → ERROR: consistency_check_blocked { error_count, violation_summary }
  Return complete output.
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `verdict` | `string` | `"pass"` / `"warn"` / `"block"`. `block` halts the pipeline. |
| `consistency_violations` | `array[object]` | All violations found. Fields: `rule`, `severity` (`error`/`warning`), `entity`, `message`, `fix_hint`. |
| `error_count` | `integer` | Count of severity=error violations. |
| `warning_count` | `integer` | Count of severity=warning violations. |
| `override_event` | `object` | Present only when `override_approved: true`. Fields: `violations_overridden`, `reason`, `timestamp`. |
| `metrics` | `object` | `tokens_in`, `tokens_out`, `duration_ms`, `items_produced` (total checks run), `version`. |

**Output Schema (abbreviated):**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["verdict", "consistency_violations", "error_count", "warning_count", "metrics"],
  "properties": {
    "verdict": { "type": "string", "enum": ["pass", "warn", "block"] },
    "consistency_violations": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["rule", "severity", "entity", "message", "fix_hint"],
        "properties": {
          "rule":     { "type": "string" },
          "severity": { "type": "string", "enum": ["error", "warning"] },
          "entity":   { "type": "string" },
          "message":  { "type": "string" },
          "fix_hint": { "type": "string" }
        }
      }
    },
    "error_count":   { "type": "integer", "minimum": 0 },
    "warning_count": { "type": "integer", "minimum": 0 },
    "override_event":{ "type": "object" },
    "metrics":       { "type": "object" }
  }
}
```

## Rules & Constraints

1. **Four checks are mandatory.** All four checks (REQ_NO_TEST, MODULE_NO_TASK, TASK_ORPHANED, TEST_UNKNOWN_REQ) MUST always be executed. A check CANNOT be selectively disabled via config.
2. **Block on any error.** A single `severity: error` violation produces `verdict: block` unless `override_approved: true`.
3. **Override requires reason.** `override_approved: true` without `override_reason` is invalid. The skill MUST set `verdict: block` if `override_reason` is absent or empty.
4. **Warning-only violations do not block.** `TASK_ORPHANED` violations are `severity: warning` — they are reported but never produce a `block` verdict on their own.
5. **Structural linkage only.** This skill checks structural ID-based linkage — whether IDs reference each other. It does NOT check semantic correctness (whether the test actually tests the requirement, whether the task actually implements the requirement). Semantic consistency is out of scope.
6. **Single run scope.** Only the artifacts from the current pipeline run are checked.
7. **Read-only.** This skill MUST NOT modify any upstream artifact.

## Security Considerations

- **No credential scanning.** This skill processes structured data — IDs, names, and descriptions. If any description field contains a credential pattern, emit `WARN: credential_in_input`, redact, and continue.
- **PII awareness.** Requirement statements and task descriptions in `consistency_violations[].message` fields are truncated to 100 characters. Do not write full requirement statements into violation messages.
- **Override audit trail.** Override events MUST be logged with timestamp and reason. The audit record is included in the output and written to `artifacts/consistency-overrides.log` (append-only).

## Token Optimization

- **Project all inputs before checking.** Retain only IDs and linking fields from each input array before building maps.
- **Short violation messages.** Keep `message` fields to one sentence. Full context is recoverable from the artifact IDs.
- **Batch map construction.** Build all four maps in a single pass over the task array.

## Quality Checklist

- [ ] All four check rules executed (REQ_NO_TEST, MODULE_NO_TASK, TASK_ORPHANED, TEST_UNKNOWN_REQ)
- [ ] Every requirement appears in one of: covered or uncovered category
- [ ] Every module appears in one of: mapped or unmapped category
- [ ] Every task appears in one of: linked or orphaned category
- [ ] `error_count` equals count of violations with `severity: "error"`
- [ ] `warning_count` equals count of violations with `severity: "warning"`
- [ ] `verdict: "block"` if `error_count > 0` and `override_approved !== true`
- [ ] `verdict: "warn"` if `error_count > 0` and `override_approved === true` with non-empty reason
- [ ] `verdict: "pass"` if `error_count === 0`
- [ ] Override event recorded when override path taken
- [ ] Fix hints present on every violation

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| `requirements[]` empty | Hard error: `{"error": "EMPTY_REQUIREMENTS"}`. Halt. |
| `modules[]` empty | Hard error: `{"error": "EMPTY_MODULES"}`. Halt. |
| `tasks[]` empty | Hard error: `{"error": "EMPTY_TASKS"}`. Halt. |
| `test_cases[]` empty | Run checks A–D with no test links. All requirements get REQ_NO_TEST violations. |
| `override_approved: true` but `override_reason` absent | Treat as `override_approved: false`. Emit `WARN: override_reason_required`. |
| Duplicate req_id in requirements[] | Deduplicate (first wins). Emit `WARN: duplicate_req_id`. |

## Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Behavior on timeout |
|------|---------|---------|---------------------|
| Violation override review | `verdict === "block"` | 3600s | Remain blocked — do not auto-advance on timeout. Emit `ERROR: consistency_override_timeout`. |

**Gate behavior:** When the guard produces `verdict: block`, the orchestrator presents the `consistency_violations[]` list to the user with the message: "Consistency violations found. Review the violations above. Reply OVERRIDE with a reason to proceed, or fix the violations and re-run."

If the user replies `OVERRIDE <reason>`, the orchestrator re-invokes this skill with `override_approved: true` and `override_reason: <reason>`. The skill then produces `verdict: warn`.

This gate MUST NOT auto-advance on timeout. A blocked pipeline stays blocked until a human decision is made.

## Skill Composition

`cross-artifact-consistency` v1.0.0 runs after `test-generator` and before `code-generator` in the full pipeline. It sits between `phase-7a-rtm` and `phase-7b-guards`.

```yaml
composes:
  - skill: test-generator
    version: "^2.0.0"
    output_map:
      test_cases: "state.test_cases"

  - skill: cross-artifact-consistency
    version: "^1.0.0"
    triggered_by: test-generator
    input_map:
      requirements: "validated_requirements"
      modules:      "architecture_output.modules"
      tasks:        "feature_plan.tasks"
      test_cases:   "state.test_cases"
    output_map:
      verdict:                 "consistency_verdict"
      consistency_violations:  "consistency_violations"

downstream:
  - code-generator  # blocked if verdict is "block"

upstream:
  - requirement-analyzer   # provides requirements[]
  - architecture-design    # provides modules[]
  - feature-planning       # provides tasks[].req_ids[], tasks[].module_refs[]
  - test-generator         # provides test_cases[].coverage_target
```

---
name: testing-strategy
version: 1.2.0
domain: testing
description: 'Use when asked to define a testing strategy, write a test plan, identify edge cases, set coverage targets, or specify unit/integration/e2e tests. Triggers on: "testing strategy", "test plan", "write tests", "how should we test", "test coverage", "edge cases", "quality gates", "e2e tests".'
author: system
---

## Purpose

Generate a complete testing strategy that ensures production readiness. The skill defines test scope at every level (unit, integration, e2e), identifies edge cases, sets measurable coverage targets, and establishes quality gates that must pass before deployment.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `requirements` | `array[object]` | Yes | Requirements (id, type, statement, priority) |
| `modules` | `array[object]` | Yes | Modules from architecture-design |
| `tasks` | `array[object]` | No | Tasks from feature-planning (for traceability) |
| `existing_tests` | `object` | No | Existing test coverage if this is incremental |
| `quality_gates` | `array[string]` | No | Specific quality gates to enforce |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "requirements": { "type": "array", "minItems": 1 },
    "modules": { "type": "array", "minItems": 1 },
    "tasks": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "description": { "type": "string" },
          "module": { "type": "string" },
          "req_ids": { "type": "array", "items": { "type": "string" } },
          "acceptance_criteria": {
            "type": "array",
            "items": { "type": "string" },
            "description": "Testable conditions from feature-planning — used as primary edge case seeds"
          }
        }
      }
    },
    "existing_tests": {
      "type": "object",
      "properties": {
        "coverage_percentage": { "type": "number", "minimum": 0, "maximum": 100 },
        "test_count": { "type": "integer" },
        "areas_covered": { "type": "array", "items": { "type": "string" } }
      }
    },
    "quality_gates": { "type": "array", "items": { "type": "string" } }
  },
  "required": ["requirements", "modules"]
}
```

## Required Context

- Architecture modules and integration points from `architecture-design`.
- Requirements from `requirement-analyzer`.
- Task breakdown from `feature-planning` (recommended for per-task test traceability).

## Execution Logic

```
Step 1 — Map test scope by module
  For each module, determine test levels required (unit, integration, e2e).
  Based on module layer: domain = heavy unit, infrastructure = heavy integration, presentation = e2e.
  Output: module-test-level matrix

Step 2 — Define unit tests
  For each module, list unit test targets: entities, value objects, services, use cases.
  Include expected behavior, not implementation details.
  Output: unit test spec list with mock boundaries

Step 3 — Define integration tests
  For each integration point, define contract tests.
  Test: data format, error handling, timeout, retry behavior.
  Output: integration test list with setup requirements

Step 4 — Identify edge cases
  Primary source — acceptance criteria from tasks (if tasks[] provided with acceptance_criteria):
    For each task.acceptance_criteria entry, derive:
      At least one happy-path test case (the criterion succeeds as stated).
      At least one edge case (the criterion fails or is stressed at its boundary).
      Example AC: "Given valid JWT, when GET /users/:id, then 200 + user object"
        → edge cases: expired JWT (401), non-existent user (404), DB timeout (503).
    Tag all AC-derived cases with `"ac_derived": true` for traceability.
  Secondary source — requirement boundary analysis:
    For each requirement not already covered by AC-derived cases, enumerate boundary conditions.
    Empty states, null inputs, concurrent access, rate limits, overflow.
  Output: edge case list per requirement (with ac_derived flag for AC-sourced cases)

Step 5 — Establish coverage targets
  Set minimum coverage thresholds per module and per test level.
  Suggested: domain >= 95%, application >= 85%, infrastructure >= 75%, presentation >= 60%.
  Output: coverage targets with priority

Step 6 — Define quality gates
  Gates that block promotion between environments.
  Gate examples: unit tests pass, coverage >= threshold, no critical bugs, integration tests pass.
  Output: quality gate list with pass/fail criteria

Step 7 — Generate test plan
  Combine all into structured test plan.
  Output: complete testing strategy
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `test_plan` | `object` | Overall test plan (strategy, tools, environments) |
| `test_cases` | `array[object]` | Test cases (id, module, level, description, input, expected_output) |
| `edge_cases` | `array[object]` | Edge cases (id, requirement_id, scenario, risk_level) |
| `coverage_checklist` | `array[object]` | Coverage targets per module (module, unit_target, integration_target, e2e_target) |
| `quality_gates` | `array[object]` | Quality gates (name, criteria, blocks) |
| `risks` | `array[object]` | Testing risks (description, impact, mitigation) |
| `metrics` | `object` | Execution metrics (tokens_in, tokens_out, duration_ms, items_produced, version) |
| `feedback` | `array[object]` | Feedback loop entries for cross-skill communication |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "test_plan": {
      "type": "object",
      "properties": {
        "strategy": { "type": "string", "enum": ["TDD", "BDD", "incremental", "regression_first"] },
        "frameworks": { "type": "array", "items": { "type": "string" } },
        "environments": { "type": "array", "items": { "type": "string" } }
      },
      "required": ["strategy", "frameworks"]
    },
    "test_cases": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": { "type": "string", "pattern": "^TC-\\d{4}$" },
          "module": { "type": "string" },
          "level": { "type": "string", "enum": ["unit", "integration", "e2e"] },
          "description": { "type": "string" },
          "input": { "type": "string" },
          "expected_output": { "type": "string" },
          "requirements_covered": { "type": "array", "items": { "type": "string" } }
        },
        "required": ["id", "module", "level", "description", "input", "expected_output"]
      }
    },
    "edge_cases": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": { "type": "string", "pattern": "^EC-\\d{4}$" },
          "requirement_id": { "type": "string" },
          "scenario": { "type": "string" },
          "risk_level": { "type": "string", "enum": ["critical", "high", "medium", "low"] }
        },
        "required": ["id", "requirement_id", "scenario", "risk_level"]
      }
    },
    "coverage_checklist": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "module": { "type": "string" },
          "unit_target": { "type": "number", "minimum": 0, "maximum": 100 },
          "integration_target": { "type": "number", "minimum": 0, "maximum": 100 },
          "e2e_target": { "type": "number", "minimum": 0, "maximum": 100 }
        },
        "required": ["module", "unit_target", "integration_target", "e2e_target"]
      }
    },
    "quality_gates": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": { "type": "string" },
          "criteria": { "type": "string" },
          "blocks": { "type": "string", "enum": ["commit", "pr_merge", "staging_deploy", "production_deploy"] }
        },
        "required": ["name", "criteria", "blocks"]
      }
    },
    "risks": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "description": { "type": "string" },
          "impact": { "type": "string", "enum": ["critical", "high", "medium", "low"] },
          "mitigation": { "type": "string" }
        },
        "required": ["description", "impact", "mitigation"]
      }
    },
    "metrics": { "$ref": "#/$defs/metrics" },
    "feedback": { "type": "array", "items": { "$ref": "#/$defs/feedback_entry" } }
  },
  "required": ["test_plan", "test_cases", "edge_cases", "coverage_checklist", "quality_gates", "risks", "metrics", "feedback"],
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

- Every requirement MUST be covered by at least one `test_cases` entry.
- Every integration point MUST have at least one integration-level test case.
- Edge cases MUST reference a valid `requirement_id` from input.
- Coverage targets MUST sum to >= 60% minimum across all modules.
- Quality gates MUST include at minimum: unit tests pass, coverage check, no critical/high bugs.
- If `tasks[].acceptance_criteria` is provided, every AC entry MUST produce at least one test case (TC) and one edge case (EC). AC coverage is tracked in the `test_cases[].requirements_covered` field.

## Security Considerations

- Test cases MUST NOT contain real credentials, tokens, or PII. Use placeholder values.
- Flag any test case that requires production-like secrets as `"needs_secret_mgmt": true`.
- Integration tests MUST use isolated test databases or mocks — never production resources.

## Token Optimization

- Compress module names to 3-letter codes.
- Use `TC-{NNNN}` and `EC-{NNNN}` IDs (no dashes within numbers).
- Omit `input` and `expected_output` from test cases in summary mode (keep only description + level).
- Prune `requirements` input to ID + statement only for coverage mapping.
- Cap `test_cases` at 100. For more, group into "core" (highest priority requirements) and "extended".

## Quality Checklist

- [ ] All `test_cases` IDs unique
- [ ] Every requirement ID in input has at least one TC
- [ ] Coverage targets are realistic (domain >= 95%, infra >= 75%)
- [ ] Quality gates include a production gate
- [ ] Edge cases include null/empty, concurrent, boundary scenarios
- [ ] Frameworks listed are language-appropriate (pytest for Python, Jest for TS, etc.)

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| No modules provided | Return error: `{"error": "NO_MODULES"}` |
| Framework mismatch (e.g., suggested Jest for Python) | Flag as risk, propose language-appropriate alternative |
| Coverage targets impossible (e.g., 100% E2E) | Cap at practical maximum (80% E2E), document in risks |
| Test case count exceeds 100 | Generate core set only, flag `"extended_available": true` |

## 12. Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Behavior |
|------|---------|---------|----------|
| Coverage gap | Any module layer has `unit_target < 80%` OR no production quality gate defined | 3600s | Pause, present coverage plan for approval before implementation begins |

## 13. Skill Composition

`testing-strategy` is a primitive skill. It may be included in a pre-release meta-skill:

```yaml
composes:
  - skill: testing-strategy
    version: "^1.2.0"
    input_map: { "requirements": "requirements", "modules": "modules" }
    output_map: { "test_plan": "test_plan", "quality_gates": "quality_gates" }
  - skill: deployment-strategy
    version: "^1.0.0"
    input_map: { "test_plan": "test_plan", "quality_gates": "quality_gates" }
    output_map: { "deployment_plan": "release_plan" }
```

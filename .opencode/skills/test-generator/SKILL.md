---
name: test-generator
version: 1.0.0
domain: testing
description: 'Use when generating unit tests, integration tests, or edge-case test suites from code artifacts or specifications. Triggers on: "generate tests", "write tests for this", "create test suite", "generate unit tests", "test coverage", "generate from spec".'
author: system
---

## Purpose

Generate complete, runnable test suites from code artifacts, interface contracts, or feature specifications. The test-generator is the execution arm of `testing-strategy` — where testing-strategy defines *what* to test and *how*, test-generator produces the actual test files. It targets the coverage gaps identified by `change-impact-analyzer`, regenerates tests invalidated by code changes, and always aligns generated tests with the testing strategy's tier targets (unit, integration, e2e).

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `generation_mode` | `string` | Yes | `from_code`, `from_spec`, `from_strategy`, or `fill_gaps` |
| `target` | `object` | Yes | The artifact to generate tests for (code file, interface spec, or module spec) |
| `language` | `string` | Yes | Test language: `typescript`, `python`, `go`, `rust`, `java` |
| `test_framework` | `string` | No | Framework override: `jest`, `pytest`, `go_test`, `cargo_test`, `junit` (auto-detected if absent) |
| `testing_strategy` | `object` | No | Output from testing-strategy skill — provides tier targets and edge case list |
| `coverage_report` | `object` | No | Current coverage data — used in `fill_gaps` mode to target uncovered lines |
| `invalidated_tests` | `array[string]` | No | Test file paths to regenerate (from change-impact-analyzer output) |
| `dry_run` | `boolean` | No | If true, return generated tests without writing to state (default: false) |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "generation_mode": { "type": "string", "enum": ["from_code", "from_spec", "from_strategy", "fill_gaps"] },
    "target": { "type": "object" },
    "language": { "type": "string", "enum": ["typescript", "python", "go", "rust", "java"] },
    "test_framework": { "type": "string", "enum": ["jest", "pytest", "go_test", "cargo_test", "junit"] },
    "testing_strategy": { "type": "object" },
    "coverage_report": { "type": "object" },
    "invalidated_tests": { "type": "array", "items": { "type": "string" } },
    "dry_run": { "type": "boolean" }
  },
  "required": ["generation_mode", "target", "language"]
}
```

## Required Context

- Testing strategy from `testing-strategy` output (system state `testing_strategy` scope).
- Coverage report from system state `coverage` scope (required for `fill_gaps` mode).
- Code artifacts from system state `code_map` scope (for `from_code` mode).

## Execution Logic

```
Step 1 — Validate inputs and detect framework
  Validate generation_mode-specific required fields.
  If test_framework absent: detect from language (typescript→jest, python→pytest, go→go_test, rust→cargo_test, java→junit).
  Output: validated_inputs, detected_framework

Step 2 — Extract testable surface
  from_code:     Parse target file. Extract exported functions, classes, and methods. For each: infer input types, output types, and side effects.
  from_spec:     Read target.public_api. Extract each method signature and its contracts.
  from_strategy: Read testing_strategy.test_cases. Use as the primary test case list.
  fill_gaps:     Parse coverage_report. Find uncovered lines/branches. Map to containing functions.
  Output: testable_units list { name, inputs, outputs, side_effects, is_async }

Step 3 — Generate test cases per testable unit
  For each testable_unit:
    - Happy path: valid inputs → expected outputs
    - Null/empty inputs: verify null-safety or correct error
    - Boundary values: min, max, empty string, zero, negative
    - Error path: invalid inputs → expected exceptions/errors
    - Async edge: if is_async, test timeout and rejection cases
    - Side effect verification: mocks for dependencies with interaction assertions
  If testing_strategy provided: merge its edge_cases into the generated list.
  Output: test_case_list

Step 4 — Generate test file(s)
  Apply framework-specific template (describe/it, def test_, func Test*, etc.).
  Inject test cases with descriptive names.
  Generate mock/stub setup for all external dependencies.
  Generate beforeEach/afterEach or setUp/tearDown as needed.
  Output: test_files list { path, content, framework, tier }

Step 5 — Validate generated tests
  Parse generated test files for syntax errors.
  Check that each testable_unit has at least 1 happy path and 1 error path test.
  Check that mocks correctly shadow the module under test's imports.
  Output: validation_result { valid, errors, coverage_estimate }

Step 6 — Write and emit
  If dry_run: return test_files without writing.
  If !dry_run and validation passes: write test_files to state via state-manager.
  Emit event: "file.written" with { paths: test_files[*].path, type: "test" }.
  Output: written_tests
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `test_files` | `array[object]` | Generated test files: `{ path, content, framework, tier }` |
| `test_case_summary` | `object` | Count by tier and type: `{ unit, integration, e2e, total }` |
| `validation_result` | `object` | `{ valid, errors, coverage_estimate }` |
| `coverage_estimate` | `number` | Estimated coverage increase from generated tests (0–100) |
| `metrics` | `object` | Execution metrics |
| `feedback` | `array[object]` | Feedback entries |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "test_files": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "path": { "type": "string" },
          "content": { "type": "string" },
          "framework": { "type": "string" },
          "tier": { "type": "string", "enum": ["unit", "integration", "e2e"] }
        },
        "required": ["path", "content", "framework", "tier"]
      }
    },
    "test_case_summary": {
      "type": "object",
      "properties": {
        "unit": { "type": "integer" },
        "integration": { "type": "integer" },
        "e2e": { "type": "integer" },
        "total": { "type": "integer" }
      },
      "required": ["unit", "integration", "e2e", "total"]
    },
    "validation_result": {
      "type": "object",
      "properties": {
        "valid": { "type": "boolean" },
        "errors": { "type": "array" },
        "coverage_estimate": { "type": "number" }
      },
      "required": ["valid", "errors"]
    },
    "coverage_estimate": { "type": "number", "minimum": 0, "maximum": 100 },
    "metrics": { "$ref": "#/$defs/metrics" },
    "feedback": { "type": "array", "items": { "$ref": "#/$defs/feedback_entry" } }
  },
  "required": ["test_files", "test_case_summary", "validation_result", "coverage_estimate", "metrics", "feedback"],
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

- Generated tests MUST NOT be written to state if `validation_result.valid === false`.
- Every exported function must have at least 1 happy path and 1 error path test.
- Tests MUST NOT contain hard-coded credentials, tokens, or real environment URLs — use constants or fixtures.
- `fill_gaps` mode requires `coverage_report` — reject without it.
- Maximum test files per invocation: 30. Larger suites must be batched by module.

## Security Considerations

- Strip any credential-like values from target code before analysis — do not replicate them in test assertions.
- Generated tests must not import from `node_modules` path traversals or use dynamic `require`/`import()` with user-controlled paths.

## Token Optimization

- For `from_code` mode: extract function signatures only — do not pass full file content.
- Return `content` for test files <= 300 lines. Larger files: return `path` + `test_case_summary`, write content to state.
- Omit mock boilerplate from output — it is already written to state.

## Quality Checklist

- [ ] Every testable unit has at least 1 happy path and 1 error path test
- [ ] Framework auto-detected correctly when not provided
- [ ] Syntax validation passes on all generated test files
- [ ] No credentials in generated test code
- [ ] coverage_estimate calculated from testable units covered

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| target has no exported symbols | Reject: `{"error": "NO_TESTABLE_SURFACE"}` |
| Syntax error in generated test | Return invalid test_files with errors, do NOT write to state |
| coverage_report absent in fill_gaps mode | Reject: `{"error": "COVERAGE_REPORT_REQUIRED"}` |
| >30 files requested | Reject: `{"error": "BATCH_TOO_LARGE", "max": 30}` |

## 12. Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Behavior |
|------|---------|---------|----------|
| Test coverage estimate < 40% | `coverage_estimate < 40` after generation | 1800s | Alert user: low coverage may indicate insufficient testable surface |

## 13. Skill Composition

`test-generator` is invoked after `code-generator` and after `change-impact-analyzer` detects invalidated tests:

```yaml
composes:
  - skill: test-generator
    version: "^1.0.0"
    input_map:
      generation_mode: "from_code"
      target: "code_generator.artifacts[0]"
      language: "session.language"
      testing_strategy: "state.testing_strategy"
    output_map:
      test_files: "state.test_files"
      coverage_estimate: "state.coverage_estimate"
```

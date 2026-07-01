---
name: testing-strategy
version: 2.0.0
domain: testing
description: 'Use when asked to define a testing strategy, write a test plan, identify edge cases, set coverage targets, or specify unit/integration/e2e tests. Triggers on: "testing strategy", "test plan", "write tests", "how should we test", "test coverage", "edge cases", "quality gates", "e2e tests", "property tests", "contract tests", "mutation score". Do NOT use when generating test code — use test-generator for that; this skill defines what to test and how.'
author: system
---

## Purpose

Produce a complete, layered testing strategy that gives `test-generator` and `mutation-test-generator` all the information they need to generate **perfect, high-confidence test suites**. The strategy covers every test tier (unit, integration, e2e), every test type (happy path, sad path, edge case, property-based, contract, security, performance), enforces the test pyramid, establishes a mutation score quality gate, and codifies naming conventions, test isolation rules, flakiness prevention patterns, and test data strategies. A testing strategy without a mutation score target is incomplete — a 90% line-coverage suite with a 40% mutation score provides false confidence.

The core principle is: **test behavior, not implementation**. Every test case in this strategy must be expressible as "given X, when Y, then Z" — observable output from observable input, with no assertions on internal state, private methods, or mock call counts alone.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `requirements` | `array[object]` | Yes | Requirements (id, type, statement, priority) from requirement-analyzer |
| `modules` | `array[object]` | Yes | Modules from architecture-design — includes layer, dependencies, integration points |
| `tasks` | `array[object]` | No | Tasks from feature-planning — used to derive acceptance-criteria-sourced test cases |
| `language` | `string` | No | Target language: `typescript`, `python`, `go`, `rust`, `java` — drives framework selection |
| `existing_tests` | `object` | No | Existing coverage data: `{ coverage_percentage, mutation_score, test_count, areas_covered }` |
| `quality_gates` | `array[string]` | No | Additional quality gates to enforce beyond defaults |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["requirements", "modules"],
  "properties": {
    "requirements": {
      "type": "array", "minItems": 1,
      "items": {
        "type": "object",
        "required": ["id", "type", "statement"],
        "properties": {
          "id":        { "type": "string" },
          "type":      { "type": "string", "enum": ["F", "NF", "C"] },
          "statement": { "type": "string" },
          "priority":  { "type": "string", "enum": ["critical", "high", "medium", "low"] }
        }
      }
    },
    "modules": {
      "type": "array", "minItems": 1,
      "items": {
        "type": "object",
        "required": ["name", "layer"],
        "properties": {
          "name":               { "type": "string" },
          "layer":              { "type": "string", "enum": ["domain", "application", "infrastructure", "presentation"] },
          "dependencies":       { "type": "array", "items": { "type": "string" } },
          "integration_points": { "type": "array", "items": { "type": "string" } },
          "public_api":         { "type": "array", "items": { "type": "string" } }
        }
      }
    },
    "tasks": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id":                   { "type": "string" },
          "description":          { "type": "string" },
          "module":               { "type": "string" },
          "req_ids":              { "type": "array", "items": { "type": "string" } },
          "acceptance_criteria":  { "type": "array", "items": { "type": "string" } }
        }
      }
    },
    "language": {
      "type": "string",
      "enum": ["typescript", "python", "go", "rust", "java"]
    },
    "existing_tests": {
      "type": "object",
      "properties": {
        "coverage_percentage": { "type": "number", "minimum": 0, "maximum": 100 },
        "mutation_score":      { "type": "number", "minimum": 0, "maximum": 100 },
        "test_count":          { "type": "integer" },
        "areas_covered":       { "type": "array", "items": { "type": "string" } }
      }
    },
    "quality_gates": { "type": "array", "items": { "type": "string" } }
  }
}
```

## Required Context

- Architecture modules and integration points from `architecture-design` — the layer field is critical for coverage-target assignment.
- Requirements from `requirement-analyzer` — every requirement must be covered by at least one test case.
- Task breakdown from `feature-planning` — `acceptance_criteria` entries drive AC-derived test cases.
- `language` from session context when not explicitly provided.

## Execution Logic

```
Step 1 — Classify modules and assign test pyramid targets
  Apply the test pyramid ratio: 70% unit / 20% integration / 10% e2e.
  Per layer, assign coverage targets:
    domain      → unit >= 95%, integration >= 60%, e2e >= 20%
    application → unit >= 85%, integration >= 75%, e2e >= 30%
    infrastructure → unit >= 60%, integration >= 85%, e2e >= 10%
    presentation   → unit >= 50%, integration >= 40%, e2e >= 70%
  Assign mutation_score_target per module:
    domain / application (core business logic): >= 85%
    infrastructure: >= 70%
    presentation: >= 60%
  Output: module_test_matrix { module, layer, unit_target, integration_target, e2e_target, mutation_target }

Step 2 — Select framework per layer and language
  Detect language from input or session context.
  Framework selection table:
    typescript → jest (default), vitest (if Vite/SWC project), supertest (integration HTTP)
    python     → pytest (default) with pytest-parametrize, hypothesis (PBT), responses/httpretty (HTTP mocks)
    go         → go_test with testify/assert, httptest, gomock
    rust       → cargo_test with assert macros, mockall
    java       → junit5 with mockito, assertj, rest-assured
  Also assign:
    Property-based testing library per language:
      typescript → fast-check
      python     → hypothesis
      go         → gopter or rapid
      java       → jqwik
      rust       → proptest
    Contract testing framework:
      All languages: Pact (consumer-driven contract testing)
  Output: framework_config { test_framework, pbt_library, contract_framework, mock_library }

Step 3 — Define test naming convention
  All tests MUST follow Given-When-Then semantics expressed in the test name:
    Unit:        "should <expected_behavior> when <condition>"
                 e.g. "should throw InvalidEmailError when email missing @ symbol"
    Integration: "should <outcome> given <system_state> when <action>"
                 e.g. "should persist order given empty cart when checkout called"
    E2E:         "user <persona> can <goal> via <path>"
                 e.g. "user admin can reset password via forgot-password flow"
    Property:    "always <invariant> for any <input_domain>"
                 e.g. "always returns non-negative for any valid quantity input"
    Contract:    "<consumer> expects <provider> to <contract_clause>"
                 e.g. "order-service expects payment-api to return charge_id in response"
  Output: naming_convention { unit, integration, e2e, property, contract }

Step 4 — Define test double taxonomy for this project
  Classify what to use at each boundary:
    Stub:    Use for indirect inputs — dependencies you query (return a canned value)
    Mock:    Use for indirect outputs — dependencies you command (verify call happened)
    Spy:     Use when you need BOTH real behavior AND interaction verification
    Fake:    Use for infrastructure replacements (in-memory DB, fake mail server)
    Dummy:   Use for required parameters that don't affect the test outcome
  Assign boundaries per module:
    For each module.dependencies[] — determine: stub | mock | spy | fake | dummy
  Rule: NEVER mock the system under test itself. NEVER mock value objects. DO NOT mock what you don't own.
  Output: test_double_map { module, boundary, double_type, rationale }

Step 5 — Generate test cases from requirements and acceptance criteria
  Primary source — AC-derived cases (from tasks[].acceptance_criteria):
    For each AC entry, produce:
      TC (happy path):      the criterion succeeds exactly as stated
      TC (sad path):        the criterion fails at its primary failure mode
      EC (boundary):        the criterion is stressed at numeric/length boundaries
      EC (null/empty):      required field is missing or null
    Tag all AC-derived cases: "ac_derived": true
    Example AC: "Given valid JWT, when GET /users/:id, then 200 + user object"
      → TC-happy: valid JWT + known user → 200 + user JSON
      → TC-sad: expired JWT → 401 Unauthorized
      → EC-boundary: user ID = INT_MAX → 404 or 400
      → EC-null: no Authorization header → 401 Unauthorized

  Secondary source — requirement boundary analysis (for reqs not covered by AC):
    For each requirement: enumerate ALL of:
      Equivalence classes (valid + invalid input classes)
      Boundary values (min, max, min-1, max+1, zero, negative, empty string, MAX_INT)
      State transitions (if requirement describes a state machine)
      Error conditions (network failure, timeout, constraint violation)
      Concurrent access (if requirement has no explicit serialization)
      Security edge cases (for NF requirements of type security)
  Output: test_cases[] and edge_cases[]

Step 6 — Identify property-based test candidates
  A function is a PBT candidate if:
    - It has computable invariants (output property always holds regardless of input)
    - It handles a large numeric or string input domain
    - It has commutativity, associativity, or idempotency properties
    - It is a parser, serializer, encoder, or transformer with round-trip properties
  For each PBT candidate, define:
    invariant:      the property that must always hold
    input_domain:   the generator spec for fast-check/hypothesis (e.g., "arbitrary string", "integer -1000..1000")
    shrinking_hint: smallest failing case to target if property fails
  Output: property_tests[]

Step 7 — Identify contract test targets
  A contract test is needed at every integration point between:
    - A consumer service and a provider API (REST, GraphQL, gRPC)
    - A producer and consumer of a message queue / event topic
  For each integration point:
    consumer:          module that calls the API
    provider:          module / external service being called
    contract_clauses:  the exact fields, types, and status codes the consumer relies on
    pact_interaction:  describe the interaction in Pact DSL terms
  Output: contract_tests[]

Step 8 — Define test data strategy
  Identify data categories:
    Fixtures:  static, known data for happy-path scenarios (checked into test fixtures/)
    Factories: dynamic builders for varied inputs (using @faker-js/faker, factory-boy, go-factory)
    Seeds:     database seed scripts for integration/e2e environments
  For each module requiring test data:
    Specify which factory entities are needed and their required field variations.
    Specify any seed scripts needed for integration test environments.
    Specify cleanup strategy: rollback transaction | truncate table | drop and recreate
  Output: test_data_strategy { fixtures, factories, seeds, cleanup }

Step 9 — Identify parameterized test targets
  A test is parameterizable when the same test logic applies to multiple input/output pairs.
  For each identified parameterized target:
    test_function:  the function under test
    input_table:    array of { label, input, expected_output } rows
    framework_syntax: jest.each | pytest.mark.parametrize | table-driven Go test
  Output: parameterized_tests[]

Step 10 — Define flakiness prevention rules
  Codify rules that MUST be enforced in all generated tests:
    1. NEVER assert on wall-clock time — use fake timers (jest.useFakeTimers, freezegun)
    2. NEVER depend on test execution order — each test must be fully independent
    3. NEVER share mutable state between tests — reset all stubs/mocks in afterEach/tearDown
    4. NEVER assert on log output directly — inject a logger spy instead
    5. NEVER poll with sleep() — use event-driven assertions or polling utilities with timeout
    6. NEVER use random data without a fixed seed — seed all RNG before each test
    7. NEVER leave open database connections or HTTP servers after a test — register cleanup
    8. NEVER assert on floating-point equality — use toBeCloseTo(n, precision) or epsilon comparison
  Output: flakiness_rules[]

Step 11 — Establish coverage and mutation quality gates
  Define gates at four promotion points:
    commit-gate:         unit tests pass AND branch coverage >= 80% (fast — runs in CI < 60s)
    pr-merge-gate:       all tests pass AND coverage >= module targets AND mutation_score >= 75%
    staging-deploy-gate: e2e suite passes AND no HIGH/CRITICAL regression bugs AND contract tests pass
    production-gate:     staging-gate passed AND final mutation score >= module targets AND HITL approval
  If existing_tests provided and mutation_score < 60: add a "mutation debt" risk with remediation plan.
  Output: quality_gates[]

Step 12 — Generate test plan and risks
  Assemble test_plan: strategy name, frameworks, environments, estimated test count
  Identify risks: missing test environments, external API flakiness, slow e2e suite
  Output: test_plan, risks
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `test_plan` | `object` | Strategy, frameworks, environments, pyramid ratios, estimated counts |
| `test_cases` | `array[object]` | TC-NNNN entries with type, module, tier, naming, input, expected, ac_derived flag |
| `edge_cases` | `array[object]` | EC-NNNN entries with requirement_id, scenario, risk_level, boundary type |
| `property_tests` | `array[object]` | PBT candidates with invariant, input_domain, shrinking_hint |
| `contract_tests` | `array[object]` | Consumer-provider interaction specs in Pact DSL terms |
| `parameterized_tests` | `array[object]` | Data-driven test tables with framework syntax |
| `test_data_strategy` | `object` | Fixtures, factories, seeds, cleanup strategy |
| `test_double_map` | `array[object]` | Per-module boundary → double type assignments |
| `naming_convention` | `object` | Given-When-Then naming templates per tier |
| `flakiness_rules` | `array[string]` | Enforced anti-flakiness rules for test-generator |
| `coverage_checklist` | `array[object]` | Coverage targets per module with mutation_score_target |
| `quality_gates` | `array[object]` | Gates with criteria and promotion point |
| `risks` | `array[object]` | Testing risks with impact and mitigation |
| `metrics` | `object` | Execution metrics |
| `feedback` | `array[object]` | Feedback loop entries |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["test_plan", "test_cases", "edge_cases", "property_tests", "contract_tests",
               "parameterized_tests", "test_data_strategy", "test_double_map",
               "naming_convention", "flakiness_rules", "coverage_checklist",
               "quality_gates", "risks", "metrics", "feedback"],
  "properties": {
    "test_plan": {
      "type": "object",
      "required": ["strategy", "frameworks", "pbt_library", "contract_framework"],
      "properties": {
        "strategy":           { "type": "string", "enum": ["TDD", "BDD", "property_first", "incremental", "regression_first"] },
        "frameworks":         { "type": "array", "items": { "type": "string" } },
        "pbt_library":        { "type": "string" },
        "contract_framework": { "type": "string" },
        "mock_library":       { "type": "string" },
        "environments":       { "type": "array", "items": { "type": "string" } },
        "pyramid_ratio":      {
          "type": "object",
          "properties": {
            "unit":        { "type": "number" },
            "integration": { "type": "number" },
            "e2e":         { "type": "number" }
          }
        },
        "estimated_test_count": { "type": "integer" }
      }
    },
    "test_cases": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "module", "tier", "test_type", "name", "given", "when", "then", "requirements_covered"],
        "properties": {
          "id":                   { "type": "string", "pattern": "^TC-\\d{4}$" },
          "module":               { "type": "string" },
          "tier":                 { "type": "string", "enum": ["unit", "integration", "e2e"] },
          "test_type":            { "type": "string", "enum": ["happy_path", "sad_path", "edge_case", "security_test", "performance_test"] },
          "name":                 { "type": "string", "description": "Given-When-Then formatted test name" },
          "given":                { "type": "string" },
          "when":                 { "type": "string" },
          "then":                 { "type": "string" },
          "inputs":               { "type": "object" },
          "expected_output":      { "type": "object" },
          "requirements_covered": { "type": "array", "items": { "type": "string" } },
          "ac_derived":           { "type": "boolean" },
          "priority":             { "type": "string", "enum": ["critical", "high", "medium", "low"] }
        }
      }
    },
    "edge_cases": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "requirement_id", "scenario", "risk_level", "boundary_type"],
        "properties": {
          "id":            { "type": "string", "pattern": "^EC-\\d{4}$" },
          "requirement_id": { "type": "string" },
          "scenario":      { "type": "string" },
          "risk_level":    { "type": "string", "enum": ["critical", "high", "medium", "low"] },
          "boundary_type": { "type": "string", "enum": ["null_empty", "min_max", "overflow", "concurrent", "security", "timeout", "state_transition"] }
        }
      }
    },
    "property_tests": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["function", "invariant", "input_domain", "pbt_library"],
        "properties": {
          "function":       { "type": "string" },
          "invariant":      { "type": "string", "description": "The property that must always hold" },
          "input_domain":   { "type": "string", "description": "Generator spec for PBT library" },
          "pbt_library":    { "type": "string" },
          "shrinking_hint": { "type": "string" }
        }
      }
    },
    "contract_tests": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["consumer", "provider", "interaction", "contract_clauses"],
        "properties": {
          "consumer":         { "type": "string" },
          "provider":         { "type": "string" },
          "interaction":      { "type": "string", "description": "Human-readable interaction description" },
          "contract_clauses": { "type": "array", "items": { "type": "string" } },
          "pact_dsl_hint":    { "type": "string" }
        }
      }
    },
    "parameterized_tests": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["test_function", "input_table", "framework_syntax"],
        "properties": {
          "test_function":   { "type": "string" },
          "input_table":     {
            "type": "array",
            "items": {
              "type": "object",
              "required": ["label", "input", "expected_output"],
              "properties": {
                "label":           { "type": "string" },
                "input":           { "type": "object" },
                "expected_output": {}
              }
            }
          },
          "framework_syntax": { "type": "string", "enum": ["jest.each", "vitest.each", "pytest.mark.parametrize", "table_driven_go", "junit5_parameterized"] }
        }
      }
    },
    "test_data_strategy": {
      "type": "object",
      "required": ["fixtures", "factories", "cleanup"],
      "properties": {
        "fixtures":  { "type": "array", "items": { "type": "object" } },
        "factories": { "type": "array", "items": { "type": "object" } },
        "seeds":     { "type": "array", "items": { "type": "object" } },
        "cleanup":   { "type": "string", "enum": ["rollback_transaction", "truncate_table", "drop_recreate", "mock_only"] }
      }
    },
    "test_double_map": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["module", "boundary", "double_type", "rationale"],
        "properties": {
          "module":      { "type": "string" },
          "boundary":    { "type": "string" },
          "double_type": { "type": "string", "enum": ["stub", "mock", "spy", "fake", "dummy"] },
          "rationale":   { "type": "string" }
        }
      }
    },
    "naming_convention": {
      "type": "object",
      "required": ["unit", "integration", "e2e", "property", "contract"],
      "properties": {
        "unit":        { "type": "string" },
        "integration": { "type": "string" },
        "e2e":         { "type": "string" },
        "property":    { "type": "string" },
        "contract":    { "type": "string" }
      }
    },
    "flakiness_rules":   { "type": "array", "items": { "type": "string" } },
    "coverage_checklist": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["module", "layer", "unit_target", "integration_target", "e2e_target", "mutation_score_target"],
        "properties": {
          "module":                { "type": "string" },
          "layer":                 { "type": "string" },
          "unit_target":           { "type": "number" },
          "integration_target":    { "type": "number" },
          "e2e_target":            { "type": "number" },
          "mutation_score_target": { "type": "number" }
        }
      }
    },
    "quality_gates": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["name", "criteria", "blocks"],
        "properties": {
          "name":     { "type": "string" },
          "criteria": { "type": "string" },
          "blocks":   { "type": "string", "enum": ["commit", "pr_merge", "staging_deploy", "production_deploy"] }
        }
      }
    },
    "risks": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["description", "impact", "mitigation"],
        "properties": {
          "description": { "type": "string" },
          "impact":      { "type": "string", "enum": ["critical", "high", "medium", "low"] },
          "mitigation":  { "type": "string" }
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
        "tokens_in":       { "type": "integer" },
        "tokens_out":      { "type": "integer" },
        "duration_ms":     { "type": "integer" },
        "items_produced":  { "type": "integer" },
        "version":         { "type": "string" }
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

1. **Every requirement** MUST be covered by at least one `test_cases` entry.
2. **Every integration point** MUST have a `contract_tests` entry and at least one integration-level `test_cases` entry.
3. **Every AC entry** in `tasks[].acceptance_criteria` MUST produce at least one TC (happy) + one EC (boundary).
4. **Test names** MUST follow the Given-When-Then convention defined in `naming_convention`. No test named "test1" or "it works" is acceptable.
5. **Test pyramid ratio** MUST be approximately 70/20/10. If e2e > 30% of total, flag as risk.
6. **Mutation score targets** MUST be set on every module's `coverage_checklist` entry. A module without a `mutation_score_target` is incomplete.
7. **Domain-layer modules** MUST have `unit_target >= 95%` and `mutation_score_target >= 85%`.
8. **Flakiness rules** MUST include all 8 core rules (fake timers, test independence, mock reset, no log assertions, no sleep(), seeded RNG, cleanup after hooks, float epsilon).
9. **Quality gates** MUST include a production gate with HITL approval requirement.
10. **Property tests** MUST be identified for any function that processes numeric ranges, parses input, or has mathematical invariants.
11. **Test doubles** MUST be typed (stub/mock/spy/fake/dummy) — "just mock it" is not a valid strategy.
12. The `test_plan.strategy` MUST be `property_first` when domain layer has > 5 pure functions.

## Security Considerations

- Test cases MUST NOT contain real credentials, tokens, API keys, or PII. Use constants: `VALID_TEST_TOKEN`, `TEST_USER_EMAIL`.
- Integration tests MUST use isolated test databases or sandboxed HTTP mocks — never production resources.
- Flag any test case requiring production-like secrets with `"needs_secret_mgmt": true`.
- Security test cases (type: `security_test`) MUST be generated for all authentication/authorization requirements.
- SQL injection, XSS, and path traversal edge cases MUST be listed for any module accepting user input.

## Token Optimization

- Compress module names to 3-letter codes in test_cases IDs.
- Omit `given/when/then` details in summary mode — keep only `id`, `tier`, `test_type`, `name`.
- Prune `requirements` input to `id + statement` only.
- Cap `test_cases` at 120. For larger suites, generate `core` (priority=critical/high) + flag `"extended_available": true`.
- For `property_tests`, emit invariant + input_domain only — omit shrinking_hint in summary mode.

## Quality Checklist

- [ ] All `test_cases` IDs unique (TC-NNNN format)
- [ ] Every requirement has at least one test case
- [ ] Every AC entry has a TC + EC derived pair
- [ ] `naming_convention` populated for all 5 tiers
- [ ] `mutation_score_target` set on every coverage_checklist entry
- [ ] `property_tests` list non-empty for any module with pure numeric/transform functions
- [ ] `contract_tests` list non-empty for any module with external HTTP/event dependencies
- [ ] `flakiness_rules` contains all 8 core rules
- [ ] `quality_gates` includes production gate with HITL
- [ ] `test_double_map` has entry for every module with external dependencies
- [ ] Framework is language-appropriate (pytest for Python, jest/vitest for TypeScript, etc.)

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| No modules provided | Return error: `{"error": "NO_MODULES"}` |
| Framework mismatch (Jest suggested for Python) | Flag as risk, propose language-appropriate alternative |
| Coverage targets impossible (e.g., 100% E2E for backend) | Cap at practical max, document in risks |
| Test case count exceeds 120 | Generate core set, flag `"extended_available": true` |
| No AC entries in tasks | Fall back to requirement boundary analysis only, warn in risks |
| Domain module without PBT candidates | Emit warning: "No property-test candidates identified — verify module has pure functions" |

## 12. Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Behavior |
|------|---------|---------|----------|
| Coverage gap | Any domain/application module has `unit_target < 80%` | 3600s | Pause, present coverage plan for approval before test-generator runs |
| Missing mutation target | Any module missing `mutation_score_target` | 1800s | Pause, request mutation score targets before strategy is considered complete |
| No contract tests for external dependency | Module with integration points has zero `contract_tests` | 1800s | Alert: consumer-provider contract testing is mandatory for external service integration |

## 13. Skill Composition

`testing-strategy` v2.0.0 feeds directly into `test-generator` v2.0.0 and `mutation-test-generator`:

```yaml
composes:
  - skill: testing-strategy
    version: "^2.0.0"
    triggered_by: feature-planning
    input_map:
      requirements:  "validated_requirements"
      modules:       "architecture.modules"
      tasks:         "feature_plan.tasks"
      language:      "session.language"
    output_map:
      test_plan:             "state.test_plan"
      test_cases:            "state.test_cases"
      edge_cases:            "state.edge_cases"
      property_tests:        "state.property_tests"
      contract_tests:        "state.contract_tests"
      parameterized_tests:   "state.parameterized_tests"
      test_data_strategy:    "state.test_data_strategy"
      test_double_map:       "state.test_double_map"
      naming_convention:     "state.naming_convention"
      flakiness_rules:       "state.flakiness_rules"
      quality_gates:         "state.quality_gates"
      coverage_checklist:    "state.coverage_checklist"

downstream:
  - test-generator@^2.0.0        # consumes all strategy outputs to generate test code
  - mutation-test-generator@^1.0.0  # uses mutation_score_target from coverage_checklist
  - deployment-strategy@^1.1.0   # consumes quality_gates for promotion gates
  - ci-pipeline-generator@^1.0.0 # consumes quality_gates to wire CI checks
```

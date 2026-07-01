---
name: test-generator
version: 2.0.0
domain: testing
description: 'Use when generating unit tests, integration tests, edge-case test suites, property-based tests, contract tests, or parameterized tests from code artifacts or specifications. Triggers on: "generate tests", "write tests for this", "create test suite", "generate unit tests", "test coverage", "generate from spec", "generate property tests", "generate contract tests", "fill mutation gaps". Do NOT use when defining what to test or setting coverage targets — use testing-strategy for that.'
author: system
---

## Purpose

Generate complete, runnable, mutation-resistant test suites from code artifacts, interface contracts, feature specifications, or mutation analysis gap reports. The test-generator v2.0.0 is the **execution arm** of `testing-strategy` v2.0.0 — where testing-strategy defines *what* to test and *how*, test-generator produces the actual test files.

Key capabilities added in v2.0.0:
- **BDD naming enforcement**: every generated test name follows Given-When-Then semantics — no "test1", no "it works"
- **Property-based test (PBT) generation**: fast-check (TypeScript), hypothesis (Python), gopter/rapid (Go), proptest (Rust), jqwik (Java)
- **Consumer-driven contract test generation**: Pact interactions for every consumer-provider integration point
- **Parameterized test generation**: jest.each / vitest.each / pytest.mark.parametrize / table-driven Go / JUnit 5 ParameterizedTest
- **Test data factory generation**: @faker-js/faker factories (TS), factory-boy (Python), go-factory (Go)
- **`from_mutation_gaps` mode**: targets assertion_gaps from mutation-test-generator to kill surviving mutants
- **AAA structure enforcement**: every test body scaffolded with `// Arrange / // Act / // Assert` sections
- **Vitest support**: first-class alongside Jest for TypeScript projects using Vite/SWC
- **Flakiness-free output**: all 8 flakiness prevention rules applied to every generated test

The core principle is: **test behavior, not implementation**. Every generated test asserts observable output from observable input. No assertions on private state, no mock call count checks without behavioral reason, no implementation coupling.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `generation_mode` | `string` | Yes | `from_code`, `from_spec`, `from_strategy`, `fill_gaps`, or `from_mutation_gaps` |
| `target` | `object` | Yes | The artifact to generate tests for (code file, interface spec, or module spec) |
| `language` | `string` | Yes | Test language: `typescript`, `python`, `go`, `rust`, `java` |
| `test_framework` | `string` | No | Framework override: `jest`, `vitest`, `pytest`, `go_test`, `cargo_test`, `junit5` (auto-detected if absent) |
| `pbt_library` | `string` | No | PBT library override: `fast-check`, `hypothesis`, `gopter`, `rapid`, `proptest`, `jqwik` (auto-detected from language if absent) |
| `contract_framework` | `string` | No | Contract framework override — defaults to `pact` |
| `testing_strategy` | `object` | No | Full output from testing-strategy v2.0.0 — provides all tier targets, naming conventions, property_tests, contract_tests, parameterized_tests, test_data_strategy, test_double_map, flakiness_rules |
| `property_tests` | `array[object]` | No | PBT candidates from testing-strategy v2.0.0 `property_tests` field |
| `contract_tests` | `array[object]` | No | Contract test specs from testing-strategy v2.0.0 `contract_tests` field |
| `parameterized_tests` | `array[object]` | No | Parameterized test tables from testing-strategy v2.0.0 `parameterized_tests` field |
| `test_data_strategy` | `object` | No | Factory and fixture spec from testing-strategy v2.0.0 `test_data_strategy` field |
| `test_double_map` | `array[object]` | No | Per-module boundary → double type assignments from testing-strategy v2.0.0 |
| `naming_convention` | `object` | No | GWT naming templates from testing-strategy v2.0.0 `naming_convention` field |
| `flakiness_rules` | `array[string]` | No | Anti-flakiness rules to enforce from testing-strategy v2.0.0 |
| `coverage_report` | `object` | No | Current coverage data — required in `fill_gaps` mode |
| `assertion_gaps` | `array[object]` | No | Assertion gaps from mutation-test-generator — required in `from_mutation_gaps` mode |
| `invalidated_tests` | `array[string]` | No | Test file paths to regenerate (from change-impact-analyzer output) |
| `dry_run` | `boolean` | No | If true, return generated tests without writing to state (default: false) |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["generation_mode", "target", "language"],
  "properties": {
    "generation_mode": {
      "type": "string",
      "enum": ["from_code", "from_spec", "from_strategy", "fill_gaps", "from_mutation_gaps"]
    },
    "target": { "type": "object" },
    "language": {
      "type": "string",
      "enum": ["typescript", "python", "go", "rust", "java"]
    },
    "test_framework": {
      "type": "string",
      "enum": ["jest", "vitest", "pytest", "go_test", "cargo_test", "junit5"]
    },
    "pbt_library": {
      "type": "string",
      "enum": ["fast-check", "hypothesis", "gopter", "rapid", "proptest", "jqwik"]
    },
    "contract_framework": { "type": "string", "default": "pact" },
    "testing_strategy":      { "type": "object" },
    "property_tests":        { "type": "array", "items": { "type": "object" } },
    "contract_tests":        { "type": "array", "items": { "type": "object" } },
    "parameterized_tests":   { "type": "array", "items": { "type": "object" } },
    "test_data_strategy":    { "type": "object" },
    "test_double_map":       { "type": "array", "items": { "type": "object" } },
    "naming_convention":     { "type": "object" },
    "flakiness_rules":       { "type": "array", "items": { "type": "string" } },
    "coverage_report":       { "type": "object" },
    "assertion_gaps": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["gap_id", "function", "assertion_description", "example_assertion_code"],
        "properties": {
          "gap_id":                 { "type": "string" },
          "function":               { "type": "string" },
          "assertion_description":  { "type": "string" },
          "example_assertion_code": { "type": "string" }
        }
      }
    },
    "invalidated_tests": { "type": "array", "items": { "type": "string" } },
    "dry_run":           { "type": "boolean", "default": false }
  }
}
```

## Required Context

- Testing strategy from `testing-strategy` v2.0.0 output (system state `testing_strategy` scope) — mandatory for `from_strategy` mode.
- Coverage report from system state `coverage` scope — required for `fill_gaps` mode.
- Assertion gaps from `mutation-test-generator` output — required for `from_mutation_gaps` mode.
- Code artifacts from system state `code_map` scope — for `from_code` mode.

## Execution Logic

```
Step 1 — Validate inputs and resolve framework configuration
  Validate generation_mode-specific required fields:
    fill_gaps:          requires coverage_report
    from_mutation_gaps: requires assertion_gaps (min 1 entry)
    from_strategy:      requires testing_strategy
  Resolve test_framework if absent:
    typescript → jest (default) | vitest (if target.build_tool == "vite" or "swc")
    python     → pytest
    go         → go_test
    rust       → cargo_test
    java       → junit5
  Resolve pbt_library if absent:
    typescript → fast-check
    python     → hypothesis
    go         → gopter
    rust       → proptest
    java       → jqwik
  Resolve contract_framework: default "pact"
  Resolve naming_convention: use input.naming_convention if provided;
    otherwise apply defaults:
      unit:        "should <behavior> when <condition>"
      integration: "should <outcome> given <state> when <action>"
      e2e:         "user <persona> can <goal> via <path>"
      property:    "always <invariant> for any <input_domain>"
      contract:    "<consumer> expects <provider> to <contract_clause>"
  Output: validated_inputs, framework_config { test_framework, pbt_library, contract_framework }

Step 2 — Extract testable surface
  from_code:          Parse target file. Extract exported functions, classes, methods.
                      For each: infer input types, output types, side effects, is_async, is_pure.
  from_spec:          Read target.public_api. Extract each method signature and its contracts.
  from_strategy:      Read testing_strategy.test_cases as primary test case list.
  fill_gaps:          Parse coverage_report. Find uncovered lines/branches. Map to functions.
  from_mutation_gaps: Use assertion_gaps directly as the testable surface.
                      Each gap.function is a testable unit; gap.assertion_description is the target.

  For from_code / from_spec / from_strategy / fill_gaps:
    Mark each unit as pbt_candidate if:
      is_pure == true AND (has numeric input domain OR has string parse/transform behavior
      OR has commutativity/idempotency/round-trip properties)
    Output: testable_units[] { name, inputs, outputs, side_effects, is_async, is_pure, pbt_candidate }

Step 3 — Generate standard test cases (unit / integration / e2e)
  For each testable_unit (skipped entirely in from_mutation_gaps mode):
    Apply naming convention per tier. ENFORCE: every test name must match the pattern for its tier.
    Reject any test name containing "test1", "it works", "should work", "temp", or "TODO".

    Generate cases per tier:
      UNIT tests (AAA structure enforced):
        // Arrange — set up inputs, stubs, and fakes
        Happy path:     valid inputs → expected outputs
        Null/empty:     verify null-safety or correct error thrown
        Boundary:       min, max, empty string, zero, negative, INT_MAX
        Error path:     invalid inputs → expected exceptions/errors
        Async edge:     if is_async — test timeout rejection and cancellation
        name format:    "should <expected_behavior> when <condition>"

      INTEGRATION tests:
        System state:   verify outcome given specific system/database state
        Cross-module:   verify interaction at the integration point
        name format:    "should <outcome> given <state> when <action>"

      E2E tests (if e2e tier target present in testing_strategy):
        User flow:      complete user journey from entry to observable result
        name format:    "user <persona> can <goal> via <path>"

    Apply test_double_map assignments for this module:
      stub → inject canned return value for dependency
      mock → generate toHaveBeenCalledWith / verify assertion for call
      spy  → wrap real implementation with call capture
      fake → inject in-memory substitute (FakeRepository, FakeMailer)
      dummy → pass null/undefined for unused required parameter
    Rule: never mock the system under test; never mock value objects.

  If testing_strategy provided: merge testing_strategy.test_cases and edge_cases
    into the generated list, deduplicating by (module + tier + name).
  Output: test_case_list[]

Step 4 — Generate property-based test files
  Source: input.property_tests (from testing-strategy) OR auto-detected pbt_candidates.
  For each PBT target:
    Build test using framework template:
      fast-check (TypeScript/Jest):
        it('always <invariant> for any <input_domain>', () => {
          fc.assert(fc.property(<generator>, (input) => {
            // Act
            const result = <function>(input);
            // Assert
            expect(<invariant_check>(result)).toBe(true);
          }));
        });
      fast-check (TypeScript/Vitest):
        Same template; replace it() with test(); import from 'vitest'.
      hypothesis (Python):
        @given(<strategy>)
        def test_always_<invariant>_for_any_<domain>(input):
            result = <function>(input)
            assert <invariant_check>(result)
      go_test (Go with gopter):
        properties.Property("always <invariant>",
          prop.ForAll(<generator>, func(input <type>) bool {
            result := <function>(input)
            return <invariant_check>(result)
          }))
      cargo_test (Rust with proptest):
        proptest! {
          #[test]
          fn always_<invariant>(input in <strategy>()) {
            let result = <function>(input);
            prop_assert!(<invariant_check>(result));
          }
        }
      junit5 (Java with jqwik):
        @Property
        void always_<invariant>(@ForAll <Type> input) {
          <Type> result = <function>(input);
          assertThat(<invariant_check>(result)).isTrue();
        }
    Set shrinking: enabled (fast-check), reproduce_with hint from shrinking_hint if present.
  Output: property_test_files[]

Step 5 — Generate contract test files
  Source: input.contract_tests (from testing-strategy v2.0.0).
  For each contract test spec:
    Generate Pact consumer test:
      TypeScript (Jest/Vitest):
        describe('<consumer> contract with <provider>', () => {
          const provider = new PactV3({ consumer: '<consumer>', provider: '<provider>' });
          it('<consumer> expects <provider> to <contract_clause>', async () => {
            await provider
              .given('<provider_state>')
              .uponReceiving('<interaction_description>')
              .withRequest({ method: '<METHOD>', path: '<path>', headers: {…}, body: {…} })
              .willRespondWith({ status: <status>, headers: {…}, body: MatchersV3.like({…}) })
              .executeTest(async (mockServer) => {
                // Arrange
                const client = new <ProviderClient>(mockServer.url);
                // Act
                const result = await client.<method>(<args>);
                // Assert
                expect(result).<contract_clause_assertion>;
              });
          });
        });
      Python (pytest-pact):
        @consumer('<consumer>')
        @provider('<provider>')
        def test_<consumer>_expects_<provider>_to_<clause>(pact):
            pact.given('<state>').upon_receiving('<interaction>')\
                .with_request(method='<METHOD>', path='<path>')\
                .will_respond_with(status=<status>, body=Like({…}))
            with pact:
                result = <ProviderClient>(<pact_url>).<method>(<args>)
                assert <contract_clause_assertion>(result)
    Emit pact_dsl_hint from contract_tests entry as inline comment when present.
  Output: contract_test_files[]

Step 6 — Generate parameterized test files
  Source: input.parameterized_tests (from testing-strategy v2.0.0).
  For each parameterized target:
    Apply framework_syntax:
      jest.each:
        it.each([
          ['<label1>', <input1>, <expected1>],
          ['<label2>', <input2>, <expected2>],
        ])('should return %s result for %s', (label, input, expected) => {
          // Arrange (input from table row)
          // Act
          const result = <function>(input);
          // Assert
          expect(result).toEqual(expected);
        });
      vitest.each:
        Same as jest.each but import from 'vitest'.
      pytest.mark.parametrize:
        @pytest.mark.parametrize("input,expected", [
          (<input1>, <expected1>),
          (<input2>, <expected2>),
        ])
        def test_should_<behavior>_when_<condition>(input, expected):
            # Arrange + Act
            result = <function>(input)
            # Assert
            assert result == expected
      table_driven_go:
        tests := []struct {
          name     string
          input    <InputType>
          expected <OutputType>
        }{
          {name: "<label1>", input: <input1>, expected: <expected1>},
          {name: "<label2>", input: <input2>, expected: <expected2>},
        }
        for _, tt := range tests {
          t.Run(tt.name, func(t *testing.T) {
            result := <function>(tt.input)
            assert.Equal(t, tt.expected, result)
          })
        }
      junit5_parameterized:
        @ParameterizedTest(name = "{index}: {0}")
        @MethodSource("provide<FunctionName>Args")
        void should_<behavior>_when_<condition>(<InputType> input, <OutputType> expected) {
          // Arrange (from method source)
          // Act
          <OutputType> result = <function>(input);
          // Assert
          assertThat(result).isEqualTo(expected);
        }
  Output: parameterized_test_files[]

Step 7 — Generate test data factory files
  Source: input.test_data_strategy (from testing-strategy v2.0.0).
  For each factory in test_data_strategy.factories:
    TypeScript (jest/vitest) with @faker-js/faker:
      export const make<EntityName> = (overrides: Partial<<EntityName>> = {}): <EntityName> => ({
        id:    faker.string.uuid(),
        <field>: faker.<faker_method>(),
        …overrides,
      });
    Python with factory-boy:
      class <EntityName>Factory(factory.Factory):
          class Meta:
              model = <EntityName>
          id = factory.LazyFunction(uuid.uuid4)
          <field> = factory.Faker('<faker_method>')
    Go with go-factory:
      func Make<EntityName>(overrides ...func(*<EntityName>)) *<EntityName> {
        e := &<EntityName>{ ID: uuid.New(), <field>: fake.<method>() }
        for _, o := range overrides { o(e) }
        return e
      }
  For each seed in test_data_strategy.seeds:
    Generate a seed script in target language with cleanup using the specified strategy:
      rollback_transaction: wrap seed in BEGIN/ROLLBACK
      truncate_table:       emit TRUNCATE <table> RESTART IDENTITY CASCADE after test
      drop_recreate:        emit DROP/CREATE sequence
      mock_only:            no DB seed needed; emit comment only
  Output: factory_files[]

Step 8 — Generate mutation gap assertion tests (from_mutation_gaps mode only)
  Source: input.assertion_gaps from mutation-test-generator.
  For each assertion_gap:
    Parse gap.function to identify the target function.
    Use gap.example_assertion_code as the assertion template.
    Wrap in a test function following naming convention:
      "should detect <mutation_operator> mutation in <function>"
    Apply AAA structure:
      // Arrange — minimal setup to exercise the mutated construct
      // Act    — invoke function with boundary/specific input
      // Assert — exact value assertion (not just toBeTruthy / assertTrue)
    Enforce specificity: replace toBeTruthy/assertTrue with toBe(SPECIFIC_VALUE) where possible.
    Apply flakiness_rules: use fake timers, seeded RNG, no sleep(), cleanup hooks.
  Output: mutation_gap_test_files[] (merged into test_files with tier="unit")

Step 9 — Apply flakiness rules to all generated test files
  Apply the 8 core rules to every test file produced in Steps 3–8:
    1. Wall-clock time:    replace Date.now(), time.time(), time.Now() with fake timer calls.
    2. Test order:         verify no shared mutable state between describe blocks.
    3. Mock reset:         inject afterEach(() => jest.clearAllMocks()) / teardown equivalent.
    4. No log assertions:  replace expect(console.log).toHaveBeenCalled() with spy injection.
    5. No sleep():         replace setTimeout/asyncio.sleep with fake timers or polling utilities.
    6. Seeded RNG:         wrap any Math.random / random.random / rand.Intn call with a fixed seed.
    7. Cleanup hooks:      add afterAll/teardown for DB connections and HTTP servers.
    8. Float epsilon:      replace toBe(0.1 + 0.2) with toBeCloseTo(0.3, 10).
  Track violations: any generated test that would violate a rule → add to flakiness_violations[].
  Output: cleaned test files, flakiness_violations[]

Step 10 — Validate all generated tests
  Parse every generated test file for syntax errors (language-appropriate parser simulation).
  Naming validation: every test name MUST match its tier's naming convention template.
    Violations added to naming_violations[].
  Coverage validation: every testable_unit must have ≥1 happy path + ≥1 error path test.
  Mock validation: mocks correctly shadow module under test's imports (not mocking the SUT itself).
  Assertion specificity: flag any assertion using only toBeTruthy/assertTrue/assertIsNotNone
    where a specific value is knowable → add to weak_assertion_warnings[].
  Output: validation_result { valid, errors, naming_violations, weak_assertion_warnings, coverage_estimate }

Step 11 — Write and emit
  If validation_result.valid == false: do NOT write any files; return errors only.
  If !dry_run and validation passes:
    Write all test_files, property_test_files, contract_test_files,
          parameterized_test_files, factory_files to state via state-manager.
    Emit event: "file.written" with { paths: all_written_paths, type: "test" }.
  Emit feedback: if coverage_estimate < 40 → backpropagate to testing-strategy.
  If from_mutation_gaps and ≥1 gap not covered → warning to mutation-test-generator.
  Output: written_tests, metrics, feedback
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `test_files` | `array[object]` | Standard test files: `{ path, content, framework, tier }` — unit, integration, e2e |
| `property_test_files` | `array[object]` | PBT test files: `{ path, content, pbt_library, function, invariant }` |
| `contract_test_files` | `array[object]` | Pact consumer test files: `{ path, content, consumer, provider }` |
| `parameterized_test_files` | `array[object]` | Parameterized test files: `{ path, content, framework_syntax, test_function }` |
| `factory_files` | `array[object]` | Test data factory files: `{ path, content, entity, language }` |
| `test_case_summary` | `object` | Count by tier and type: `{ unit, integration, e2e, property, contract, parameterized, total }` |
| `validation_result` | `object` | `{ valid, errors, naming_violations, weak_assertion_warnings, coverage_estimate }` |
| `coverage_estimate` | `number` | Estimated coverage increase from generated tests (0–100) |
| `naming_violations` | `array[object]` | Tests that do not follow Given-When-Then naming convention |
| `flakiness_violations` | `array[object]` | Flakiness rule violations detected in generated tests |
| `metrics` | `object` | Execution metrics |
| `feedback` | `array[object]` | Feedback entries |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": [
    "test_files", "property_test_files", "contract_test_files",
    "parameterized_test_files", "factory_files",
    "test_case_summary", "validation_result", "coverage_estimate",
    "naming_violations", "flakiness_violations", "metrics", "feedback"
  ],
  "properties": {
    "test_files": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["path", "content", "framework", "tier"],
        "properties": {
          "path":      { "type": "string" },
          "content":   { "type": "string" },
          "framework": { "type": "string" },
          "tier":      { "type": "string", "enum": ["unit", "integration", "e2e"] }
        }
      }
    },
    "property_test_files": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["path", "content", "pbt_library"],
        "properties": {
          "path":       { "type": "string" },
          "content":    { "type": "string" },
          "pbt_library":{ "type": "string" },
          "function":   { "type": "string" },
          "invariant":  { "type": "string" }
        }
      }
    },
    "contract_test_files": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["path", "content", "consumer", "provider"],
        "properties": {
          "path":     { "type": "string" },
          "content":  { "type": "string" },
          "consumer": { "type": "string" },
          "provider": { "type": "string" }
        }
      }
    },
    "parameterized_test_files": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["path", "content", "framework_syntax", "test_function"],
        "properties": {
          "path":             { "type": "string" },
          "content":          { "type": "string" },
          "framework_syntax": { "type": "string" },
          "test_function":    { "type": "string" }
        }
      }
    },
    "factory_files": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["path", "content", "entity", "language"],
        "properties": {
          "path":     { "type": "string" },
          "content":  { "type": "string" },
          "entity":   { "type": "string" },
          "language": { "type": "string" }
        }
      }
    },
    "test_case_summary": {
      "type": "object",
      "required": ["unit", "integration", "e2e", "property", "contract", "parameterized", "total"],
      "properties": {
        "unit":          { "type": "integer" },
        "integration":   { "type": "integer" },
        "e2e":           { "type": "integer" },
        "property":      { "type": "integer" },
        "contract":      { "type": "integer" },
        "parameterized": { "type": "integer" },
        "total":         { "type": "integer" }
      }
    },
    "validation_result": {
      "type": "object",
      "required": ["valid", "errors", "coverage_estimate"],
      "properties": {
        "valid":                    { "type": "boolean" },
        "errors":                   { "type": "array" },
        "naming_violations":        { "type": "array" },
        "weak_assertion_warnings":  { "type": "array" },
        "coverage_estimate":        { "type": "number" }
      }
    },
    "coverage_estimate": { "type": "number", "minimum": 0, "maximum": 100 },
    "naming_violations": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["test_name", "tier", "violation"],
        "properties": {
          "test_name": { "type": "string" },
          "tier":      { "type": "string" },
          "violation": { "type": "string" }
        }
      }
    },
    "flakiness_violations": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["test_name", "rule", "description"],
        "properties": {
          "test_name":   { "type": "string" },
          "rule":        { "type": "string" },
          "description": { "type": "string" }
        }
      }
    },
    "metrics": { "$ref": "#/$defs/metrics" },
    "feedback": { "type": "array", "items": { "$ref": "#/$defs/feedback_entry" } }
  },
  "$defs": {
    "metrics": {
      "type": "object",
      "required": ["tokens_in", "tokens_out", "duration_ms", "items_produced", "version"],
      "properties": {
        "tokens_in":      { "type": "integer" },
        "tokens_out":     { "type": "integer" },
        "duration_ms":    { "type": "integer" },
        "items_produced": { "type": "integer" },
        "version":        { "type": "string" }
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

1. Generated tests MUST NOT be written to state if `validation_result.valid === false`.
2. Every exported function MUST have at least 1 happy path test and 1 error path test.
3. **Every test name MUST follow the Given-When-Then naming convention** for its tier. Tests named "test1", "it works", "should work", "TODO" are invalid and cause `validation_result.valid = false`.
4. **AAA structure is mandatory** in every generated test body: `// Arrange`, `// Act`, `// Assert` comment blocks MUST appear in that order.
5. **Assertion specificity rule**: Prefer `toBe(SPECIFIC_VALUE)` over `toBeTruthy()` where the specific value is derivable. Weak assertions are flagged in `weak_assertion_warnings`.
6. Tests MUST NOT contain hard-coded credentials, tokens, or real environment URLs — use constants (`VALID_TEST_TOKEN`, `TEST_USER_EMAIL`) or factory-generated values.
7. `fill_gaps` mode requires `coverage_report` — reject with `{"error": "COVERAGE_REPORT_REQUIRED"}` without it.
8. `from_mutation_gaps` mode requires `assertion_gaps` (non-empty) — reject with `{"error": "ASSERTION_GAPS_REQUIRED"}` without it.
9. **Never mock the system under test itself. Never mock value objects. Do NOT mock what you don't own.**
10. Maximum test files per invocation: 30. Larger suites must be batched by module.
11. All 8 flakiness prevention rules MUST be applied. Any violation detected → added to `flakiness_violations` (does not fail validation but is surfaced).
12. PBT tests MUST enable shrinking. For fast-check: `fc.assert(fc.property(...), { numRuns: 100 })`. For hypothesis: `settings(max_examples=100)`.
13. Contract test files MUST be placed in a `__contracts__/` (Python) or `*.pact.spec.ts` (TypeScript) directory/naming convention.
14. Factory files MUST be placed in `test/factories/` or `tests/factories/`.

## Security Considerations

- Strip any credential-like values from target code before analysis — do not replicate them in test assertions.
- Generated tests MUST NOT import from `node_modules` path traversals or use dynamic `require`/`import()` with user-controlled paths.
- Replace any real API key, password, or PII found in target code with placeholder constants in generated tests.
- Contract test files must use mock server URLs, never production endpoints.

## Token Optimization

- For `from_code` mode: extract function signatures only — do not pass full file content.
- Return `content` for test files ≤ 300 lines. Larger files: return `path` + `test_case_summary`, write content to state.
- Omit mock boilerplate from output summary — it is written to state only.
- For `from_mutation_gaps` mode: process top 10 gaps by detection_difficulty (hard first) within a single invocation.
- Suppress `factory_files` content in summary mode — emit entity names + paths only.

## Quality Checklist

- [ ] Every testable unit has at least 1 happy path and 1 error path test
- [ ] Every test name follows Given-When-Then convention for its tier
- [ ] AAA structure (`// Arrange / // Act / // Assert`) present in every test body
- [ ] Framework auto-detected correctly when not provided
- [ ] Vitest used (not Jest) when target.build_tool is "vite" or "swc"
- [ ] PBT tests generated for all pbt_candidate functions
- [ ] Contract tests generated for all consumer-provider integration points
- [ ] Parameterized tests use correct framework_syntax (jest.each vs vitest.each vs pytest.mark.parametrize)
- [ ] All 8 flakiness rules applied to generated output
- [ ] Assertions are specific (toBe(VALUE) not toBeTruthy()) wherever value is knowable
- [ ] No credentials in generated test code
- [ ] Syntax validation passes on all generated test files
- [ ] `coverage_estimate` calculated from testable units covered

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| target has no exported symbols | Reject: `{"error": "NO_TESTABLE_SURFACE"}` |
| Syntax error in generated test | Return invalid test_files with errors, do NOT write to state |
| `coverage_report` absent in `fill_gaps` mode | Reject: `{"error": "COVERAGE_REPORT_REQUIRED"}` |
| `assertion_gaps` absent in `from_mutation_gaps` mode | Reject: `{"error": "ASSERTION_GAPS_REQUIRED"}` |
| `testing_strategy` absent in `from_strategy` mode | Reject: `{"error": "TESTING_STRATEGY_REQUIRED"}` |
| > 30 files requested | Reject: `{"error": "BATCH_TOO_LARGE", "max": 30}` |
| PBT library not available for language | Fall back to table-driven parameterized tests, warn in feedback |
| Pact not available | Generate manual contract snapshot tests, warn in feedback |
| Naming violation detected | Mark `valid: false`, surface all violations in `naming_violations` |

## 12. Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Behavior |
|------|---------|---------|----------|
| Low coverage estimate | `coverage_estimate < 40` after generation | 1800s | Alert user: low coverage may indicate insufficient testable surface or batch too large |
| High naming violation rate | `naming_violations.length / total_tests > 0.2` | 1800s | Pause: more than 20% of tests violate GWT naming — review naming convention before proceeding |
| Mutation gaps not fully covered | `from_mutation_gaps` mode AND any gap not addressed | 900s | Warn: surface unaddressed gaps and ask whether to expand batch or proceed |

## 13. Skill Composition

`test-generator` v2.0.0 is invoked after `code-generator`, `testing-strategy` v2.0.0, and after `mutation-test-generator` emits assertion_gaps:

```yaml
composes:
  - skill: test-generator
    version: "^2.0.0"

    # Standard invocation after code-generator
    from_code_invocation:
      input_map:
        generation_mode:   "from_code"
        target:            "code_generator.artifacts[0]"
        language:          "session.language"
        testing_strategy:  "state.testing_strategy"
        property_tests:    "state.testing_strategy.property_tests"
        contract_tests:    "state.testing_strategy.contract_tests"
        parameterized_tests: "state.testing_strategy.parameterized_tests"
        test_data_strategy:  "state.testing_strategy.test_data_strategy"
        test_double_map:     "state.testing_strategy.test_double_map"
        naming_convention:   "state.testing_strategy.naming_convention"
        flakiness_rules:     "state.testing_strategy.flakiness_rules"
      output_map:
        test_files:             "state.test_files"
        property_test_files:    "state.property_test_files"
        contract_test_files:    "state.contract_test_files"
        parameterized_test_files: "state.parameterized_test_files"
        factory_files:          "state.factory_files"
        coverage_estimate:      "state.coverage_estimate"

    # Mutation gap fill invocation after mutation-test-generator
    from_mutation_gaps_invocation:
      triggered_by: "mutation-test-generator.feedback[type=backpropagate]"
      input_map:
        generation_mode: "from_mutation_gaps"
        target:          "code_generator.artifacts[0]"
        language:        "session.language"
        assertion_gaps:  "state.assertion_gaps"
      output_map:
        test_files:       "state.test_files"
        coverage_estimate: "state.coverage_estimate"

upstream:
  - testing-strategy@^2.0.0          # provides full strategy, naming, PBT, contract, parameterized specs
  - code-generator@^1.0.0            # provides target artifacts for from_code mode
  - mutation-test-generator@^1.0.0   # provides assertion_gaps for from_mutation_gaps mode
  - change-impact-analyzer@^1.0.0    # provides invalidated_tests list

downstream:
  - mutation-test-generator@^1.0.0   # receives generated tests for mutation score validation
  - state-manager@^1.0.0             # receives written test files
```

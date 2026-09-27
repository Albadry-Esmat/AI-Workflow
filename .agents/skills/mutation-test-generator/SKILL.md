---
name: mutation-test-generator
version: 1.0.0
domain: testing
description: 'Use when analysing test suite quality by generating code mutation variants and determining whether existing tests would detect them, producing a mutation score and assertion gap report. Triggers on: "mutation testing", "mutation score", "test quality analysis", "are my tests strong enough", "assertion gaps", "surviving mutants", "test suite quality". Do NOT use when generating a new test suite from scratch — use test-generator for that; this skill analyses an existing test suite.'
author: system
---

## Purpose

Quantify the fault-detection strength of an existing test suite through static mutation analysis. The skill generates code mutation variants (flipped boolean conditions, changed operators, removed null checks, altered return values) for a given source module and statically determines which mutations would be detected (killed) by assertions in the existing test suite — without executing any code. It produces a mutation score (killed/total × 100), highlights surviving mutants as testing blind spots, and generates concrete assertion additions to kill those survivors. This answers the question "how good are our tests, really?" independent of line coverage metrics.

**Static analysis guarantee:** This skill performs NO code execution, NO test runner invocation, and NO file system side effects. Kill status is inferred by matching test assertion patterns against mutated logic constructs.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `source_code` | `string` or `object` | Yes | Code to mutate — single function string, module string, or `{filename: code_string}` map |
| `existing_tests` | `string` or `object` | Yes | Test suite code for the same module — single test file string or `{filename: test_code}` map |
| `language` | `string` | Yes | Programming language: `"typescript"` \| `"javascript"` \| `"python"` \| `"java"` \| `"go"` \| `"rust"` |
| `mutation_operators` | `array[string]` | No | Operators to apply (default: all seven) — subset of `["conditional_boundary","negate_conditionals","remove_conditionals","arithmetic_operator","return_value","void_method_calls","null_returns"]` |
| `max_mutations` | `integer` | No | Maximum mutations to generate (default: 50, max: 100) — cap prevents token explosion |
| `critical_functions` | `array[string]` | No | Function names to prioritise in mutation slot allocation |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "source_code": {
      "oneOf": [
        { "type": "string" },
        { "type": "object", "additionalProperties": { "type": "string" } }
      ]
    },
    "existing_tests": {
      "oneOf": [
        { "type": "string" },
        { "type": "object", "additionalProperties": { "type": "string" } }
      ]
    },
    "language": {
      "type": "string",
      "enum": ["typescript", "javascript", "python", "java", "go", "rust"]
    },
    "mutation_operators": {
      "type": "array",
      "items": {
        "type": "string",
        "enum": [
          "conditional_boundary",
          "negate_conditionals",
          "remove_conditionals",
          "arithmetic_operator",
          "return_value",
          "void_method_calls",
          "null_returns"
        ]
      },
      "default": ["conditional_boundary","negate_conditionals","remove_conditionals","arithmetic_operator","return_value","void_method_calls","null_returns"]
    },
    "max_mutations": {
      "type": "integer",
      "minimum": 1,
      "maximum": 100,
      "default": 50
    },
    "critical_functions": {
      "type": "array",
      "items": { "type": "string" }
    }
  },
  "required": ["source_code", "existing_tests", "language"]
}
```

## Required Context

- `test-generator@^2.0.0` or `code-generator@^1.1.0` must have produced the `existing_tests` being analysed — the skill assumes the test suite targets the same module as `source_code`.
- `language` must match the language of both `source_code` and `existing_tests`.
- No test runner, compiler, or code execution environment is required — this is static analysis only.

## Execution Logic

```
Step 1 — Parse source code and build syntax map
  Parse source_code to identify:
    functions[]: { name, lines, logic_constructs[] }
    logic_constructs: conditions, arithmetic_expressions, return_statements,
                      null_checks, void_calls, boolean_expressions
  If critical_functions provided:
    Mark those functions as priority_tier = 1
    All other functions: priority_tier = 2
  Output: syntax_map

Step 2 — Generate candidate mutations
  mutation_budget = max_mutations
  Process functions in priority order (tier 1 first, then tier 2)
  For each function in priority order:
    For each logic_construct in function:
      For each applicable mutation_operator:
        If operator applies to construct type:
          Create candidate:
            mutation_id:             "MUT-{zero_padded_sequence}"
            operator:                mutation_operator name
            location:                { function: function.name, line_estimate: construct.line }
            original_code_fragment:  verbatim code fragment (max 120 chars)
            mutated_code_fragment:   transformed fragment (max 120 chars)
          Add to candidates list
          Decrement mutation_budget
          If mutation_budget == 0: stop generation
  Shuffle non-critical candidates (randomise within tier 2 to avoid bias)
  Truncate to max_mutations
  Output: mutation_candidates (ordered: critical first)

  Mutation operator transformation rules:
    conditional_boundary:
      ">=" → ">", ">" → ">=", "<=" → "<", "<" → "<="
    negate_conditionals:
      "if (expr)" → "if (!(expr))", "while (expr)" → "while (!(expr))"
      "return expr === x" → "return expr !== x"
    remove_conditionals:
      "if (expr) { A } else { B }" → "{ A }" (always true)
      "if (expr) { A } else { B }" → "{ B }" (always false)
    arithmetic_operator:
      "+" → "-", "-" → "+", "*" → "/", "/" → "*", "%" → "*"
    return_value:
      "return true" → "return false"
      "return false" → "return true"
      "return n" (number) → "return 0"
      "return str" (string) → "return ''"
      "return obj" → "return null" (if language permits)
    void_method_calls:
      "methodCall(args);" → "/* removed: methodCall(args); */"
    null_returns:
      "return <non-null expression>" → "return null"
      "return <non-null expression>" → "return undefined" (JS/TS)

Step 3 — Parse test suite and build assertion index
  Parse existing_tests to extract:
    test_functions[]: { name, assertions[] }
    assertions[]:
      { type, target_function, expected_value, condition_tested, test_name }
  Assertion types recognised:
    equality:    assertEqual(x, y), expect(x).toBe(y), assert x == y, assertEquals
    inequality:  assertNotEqual, expect(x).not.toBe(y)
    truthiness:  assertTrue(x), expect(x).toBeTruthy(), assert x
    falsiness:   assertFalse(x), expect(x).toBeFalsy()
    null_check:  assertNotNull(x), assertNull(x), expect(x).toBeNull(), assertIsNone(x)
    range_check: expect(x).toBeGreaterThan(n), expect(x).toBeLessThan(n)
    throw_check: assertRaises, expect(fn).toThrow()
  Output: assertion_index

Step 4 — Classify kill status for each mutation
  For each mutation in mutation_candidates:
    Scan assertion_index for assertions targeting mutation.location.function:
    Kill detection rules:
      conditional_boundary:
        Killed if: a range_check assertion tests the exact boundary value
                   OR a truthiness/falsiness assertion directly tests the condition
      negate_conditionals:
        Killed if: an equality or truthiness assertion would produce opposite result
      remove_conditionals:
        Killed if: a test case exercises BOTH branches (detected by multiple assertions for same function with different inputs)
      arithmetic_operator:
        Killed if: an equality assertion checks a specific numeric result that would differ
      return_value:
        Killed if: an equality assertion checks the specific return value
        NOT killed if: assertion is only assertTrue(result) — truthy check survives false→null mutation
      void_method_calls:
        Killed if: a mock/spy assertion verifies the method was called (verify, toHaveBeenCalled)
      null_returns:
        Killed if: a null_check assertion (assertNotNull, not.toBeNull()) is present

    Set kill_status:
      "killed"   → at least one assertion directly targets the mutated construct
      "survived" → no assertion in assertion_index targets the mutated construct
      "unknown"  → mutation targets nested logic more than 2 call levels from any assertion

    If killed: killing_test = name of the test function containing the decisive assertion

    detection_difficulty:
      "easy":   mutation changes a value directly asserted in a test
      "medium": mutation changes a condition one step removed from assertion
      "hard":   mutation changes a side effect, nested branch, or indirect return path
  Output: classified_mutations

Step 5 — Calculate mutation score
  killed_count  = count(mutations where kill_status == "killed")
  total_definite = count(mutations where kill_status != "unknown")
  mutation_score = round(killed_count / max(total_definite, 1) * 100, 1)

  coverage_vs_mutation_gap =
    "Your tests have an estimated {inferred_coverage}% line coverage equivalent but only
     {mutation_score}% mutation score — approximately {gap_pct}% of logic mutations go undetected."
  Output: mutation_score, coverage_vs_mutation_gap

Step 6 — Rank and filter surviving mutations
  surviving_mutations = filter(classified_mutations, kill_status == "survived")
  Sort by: detection_difficulty DESC (hard first — most impactful blind spots)
  Truncate to top 20 by impact potential
  Output: surviving_mutations (max 20)

Step 7 — Generate assertion gaps
  For each surviving_mutation (up to 20):
    gap_id = "GAP-{zero_padded_sequence}"
    function = mutation.location.function
    assertion_description = human-readable description of missing assertion

    Generate example_assertion_code in target language:
      conditional_boundary (language=typescript):
        "expect(<function>({value: BOUNDARY_VALUE})).toBe(EXPECTED_AT_BOUNDARY);"
      negate_conditionals:
        "expect(<function>(CONDITION_FALSE_INPUT)).toBe(EXPECTED_WHEN_FALSE);"
      remove_conditionals:
        "// Test both branches:\nexpect(<function>(TRUE_INPUT)).toBe(TRUE_RESULT);\nexpect(<function>(FALSE_INPUT)).toBe(FALSE_RESULT);"
      arithmetic_operator:
        "expect(<function>(INPUTS)).toEqual(EXACT_NUMERIC_RESULT);"
      return_value:
        "expect(<function>(INPUT)).toBe(SPECIFIC_EXPECTED_VALUE); // not just toBeTruthy()"
      void_method_calls:
        "expect(<dependency>.<method>).toHaveBeenCalledWith(EXPECTED_ARGS);"
      null_returns:
        "expect(<function>(VALID_INPUT)).not.toBeNull();"

    Replace placeholders with function name and operator context
    Output: assertion_gap entry { gap_id, function, assertion_description, example_assertion_code }
  Output: assertion_gaps list

Step 8 — Emit feedback
  If mutation_score < 60:
    Emit backpropagate feedback to test-generator:
      reason: "Mutation score {mutation_score}% is below 60% threshold"
      evidence: { mutation_score, surviving_count: len(surviving_mutations), assertion_gaps }
  If critical_functions provided:
    critical_survival_rate = survived_in_critical / total_in_critical × 100
    If critical_survival_rate > 40:
      Emit warning feedback to clean-code-review:
        reason: "High mutation survival rate ({critical_survival_rate}%) in critical functions: {critical_functions}"
        evidence: { critical_functions, surviving_critical_mutations: list }
  Output: feedback entries

Step 9 — Assemble output
  Return: mutations (all classified), mutation_score, surviving_mutations,
          assertion_gaps, coverage_vs_mutation_gap, metrics, feedback
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `mutations` | `array[object]` | All generated mutations: `mutation_id`, `operator`, `location`, `original_code_fragment`, `mutated_code_fragment`, `kill_status`, `killing_test`, `detection_difficulty` |
| `mutation_score` | `number` | 0–100 percentage of mutations killed by existing tests |
| `surviving_mutations` | `array[object]` | Top 20 survived mutations sorted by impact — subset of `mutations` |
| `assertion_gaps` | `array[object]` | Concrete assertions to add: `gap_id`, `function`, `assertion_description`, `example_assertion_code` |
| `coverage_vs_mutation_gap` | `string` | Human-readable gap summary |
| `metrics` | `object` | **REQUIRED.** Execution metrics |
| `feedback` | `array[object]` | **REQUIRED.** Feedback loop entries |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "mutations": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "mutation_id":             { "type": "string", "pattern": "^MUT-\\d+$" },
          "operator":                { "type": "string" },
          "location": {
            "type": "object",
            "properties": {
              "function":      { "type": "string" },
              "line_estimate": { "type": "integer" }
            },
            "required": ["function"]
          },
          "original_code_fragment":  { "type": "string", "maxLength": 120 },
          "mutated_code_fragment":   { "type": "string", "maxLength": 120 },
          "kill_status":             { "type": "string", "enum": ["killed","survived","unknown"] },
          "killing_test":            { "type": "string" },
          "detection_difficulty":    { "type": "string", "enum": ["easy","medium","hard"] }
        },
        "required": ["mutation_id", "operator", "location", "original_code_fragment", "mutated_code_fragment", "kill_status"]
      }
    },
    "mutation_score": {
      "type": "number",
      "minimum": 0,
      "maximum": 100
    },
    "surviving_mutations": {
      "type": "array",
      "maxItems": 20,
      "items": { "$ref": "#/$defs/mutation_item" }
    },
    "assertion_gaps": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "gap_id":                  { "type": "string", "pattern": "^GAP-\\d+$" },
          "function":                { "type": "string" },
          "assertion_description":   { "type": "string" },
          "example_assertion_code":  { "type": "string" }
        },
        "required": ["gap_id", "function", "assertion_description", "example_assertion_code"]
      }
    },
    "coverage_vs_mutation_gap": { "type": "string" },
    "metrics": {
      "type": "object",
      "properties": {
        "tokens_in":          { "type": "integer" },
        "tokens_out":         { "type": "integer" },
        "duration_ms":        { "type": "integer" },
        "items_produced":     { "type": "integer" },
        "version":            { "type": "string" },
        "total_mutations":    { "type": "integer" },
        "killed_count":       { "type": "integer" },
        "survived_count":     { "type": "integer" },
        "unknown_count":      { "type": "integer" },
        "mutation_score":     { "type": "number" }
      },
      "required": ["tokens_in", "tokens_out", "duration_ms", "items_produced", "version", "mutation_score"]
    },
    "feedback": {
      "type": "array",
      "items": { "$ref": "#/$defs/feedback_entry" }
    }
  },
  "required": ["mutations", "mutation_score", "surviving_mutations", "assertion_gaps", "coverage_vs_mutation_gap", "metrics", "feedback"],
  "$defs": {
    "mutation_item": {
      "type": "object",
      "properties": {
        "mutation_id":             { "type": "string" },
        "operator":                { "type": "string" },
        "location":                { "type": "object" },
        "original_code_fragment":  { "type": "string" },
        "mutated_code_fragment":   { "type": "string" },
        "kill_status":             { "type": "string" },
        "killing_test":            { "type": "string" },
        "detection_difficulty":    { "type": "string" }
      },
      "required": ["mutation_id", "operator", "kill_status"]
    },
    "feedback_entry": {
      "type": "object",
      "properties": {
        "type":         { "type": "string", "enum": ["backpropagate", "info", "warning"] },
        "from_skill":   { "type": "string" },
        "target_skill": { "type": "string" },
        "reason":       { "type": "string" },
        "evidence":     { "type": "object" }
      },
      "required": ["type", "from_skill", "reason"]
    }
  }
}
```

## Rules & Constraints

- `source_code`, `existing_tests`, and `language` are all required — reject with error if any is missing.
- `max_mutations` is hard-capped at 100 — reject with error if value exceeds 100.
- The skill MUST NOT execute any code — kill status is determined by static assertion pattern matching only.
- `mutations` output contains ALL generated mutations (killed + survived + unknown); `surviving_mutations` is a filtered, ranked subset.
- `surviving_mutations` is limited to 20 entries maximum — prioritise by `detection_difficulty: hard` first.
- `assertion_gaps` are one-to-one with surviving mutations (one gap per survivor) — capped at 20.
- `mutation_id` format is `MUT-{zero_padded_3_digit}` (MUT-001, MUT-002, ...).
- `gap_id` format is `GAP-{zero_padded_3_digit}` (GAP-001, GAP-002, ...).
- `mutation_score` formula is fixed: `round(killed / max(total_non_unknown, 1) * 100, 1)`.
- `backpropagate` feedback to `test-generator` MUST be emitted when `mutation_score < 60`.

## Security Considerations

- `source_code` input may contain sensitive business logic — do not echo raw source code in error messages or metrics.
- `existing_tests` may contain fixture data with test credentials — do not extract or surface credential-like strings from test input.
- The skill does not write files — no filesystem access beyond receiving inputs.
- `example_assertion_code` must not include real credential values from source code or tests — use placeholder constants.

## Token Optimization

- Truncate `source_code` to first 300 lines per file if input exceeds that limit — emit `metrics.source_truncated: true`.
- Truncate `existing_tests` to first 400 lines per file — emit `metrics.tests_truncated: true`.
- Compress assertion index to type + target_function + expected_value_hint only — strip full assertion text.
- For mutation generation: emit `original_code_fragment` and `mutated_code_fragment` at 120 characters max — truncate with `...` if longer.
- Process `critical_functions` first; if token budget exhausted before non-critical functions, return what was processed with `metrics.partial_analysis: true`.

## Quality Checklist

- [ ] `source_code`, `existing_tests`, `language` all present and validated
- [ ] `max_mutations` within allowed range (1–100)
- [ ] `critical_functions` processed before non-critical
- [ ] All 7 mutation operators applied where applicable
- [ ] Kill status classification rules applied consistently per operator
- [ ] `mutation_score` formula correctly computed
- [ ] `surviving_mutations` sorted by detection_difficulty DESC
- [ ] `assertion_gaps` provide runnable example code (not just descriptions)
- [ ] `backpropagate` feedback emitted for score < 60
- [ ] No code execution attempted

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| `source_code` missing | Return error: `{"error": "MISSING_SOURCE_CODE"}` |
| `existing_tests` missing | Return error: `{"error": "MISSING_EXISTING_TESTS"}` |
| `language` not in enum | Return error: `{"error": "UNSUPPORTED_LANGUAGE", "supported": [...]}` |
| `max_mutations` > 100 | Return error: `{"error": "MAX_MUTATIONS_EXCEEDED", "max_allowed": 100}` |
| Source code unparseable | Return `{"mutations": [], "mutation_score": 0, "error_note": "Source code could not be parsed"}` with empty output |
| No logic constructs found in source | Return `{"mutations": [], "mutation_score": 100, "note": "No mutable constructs found"}` |
| `existing_tests` contains no assertions | Set all kill_status to "survived", mutation_score = 0, backpropagate |
| Source exceeds 300 lines | Process first 300 lines, set `metrics.source_truncated: true` |

## 12. Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Behavior |
|------|---------|---------|----------|
| Critical function survival | `critical_functions` provided AND survival rate > 40% in critical functions | 1800s | Alert orchestrator; present surviving critical mutants; prompt developer to add targeted assertions before pipeline proceeds |

Gate behavior:
- `pause`: halt quality gate, surface top 5 critical surviving mutants with suggested assertions
- On acknowledgement: continue pipeline with assertion_gaps attached to feedback for test-generator
- No auto-continue: critical function survival requires human attention

## 13. Skill Composition

`mutation-test-generator` composes with `test-generator` in a feedback loop:

```yaml
composes:
  - skill: mutation-test-generator
    version: "^1.0.0"
    input_map:
      source_code:        "code_generator.artifacts[module].content"
      existing_tests:     "test_generator.artifacts[test_module].content"
      language:           "session.language"
      critical_functions: "session.critical_functions"
      max_mutations:      "session.mutation_max"
    output_map:
      mutation_score:   "state.mutation_score"
      assertion_gaps:   "state.assertion_gaps"
      surviving_mutations: "state.surviving_mutations"
```

Consumes from: `test-generator@^2.0.0`, `code-generator@^1.1.0`
Produces for: `test-generator@^2.0.0` (backpropagate feedback with assertion_gaps for gap filling)

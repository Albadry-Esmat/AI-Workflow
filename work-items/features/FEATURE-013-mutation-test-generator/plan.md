# FEATURE-013 — Implementation Plan: Mutation Test Generator

## Target Skills / Artifacts

| Skill / Artifact | Action | Notes |
|---|---|---|
| `.opencode/skills/mutation-test-generator/SKILL.md` (SKL-073) | Create | New skill — full 13-section spec |
| `skills/registry.json` | Update | Register SKL-073 with domain: testing, phase: 7 |
| `skills/index.yaml` | Update | Add index entry for mutation-test-generator |

---

## §1 — Skill Overview

`mutation-test-generator` augments `test-generator` by performing static mutation analysis: it generates code mutation variants and determines whether existing tests would detect (kill) those mutations without executing any code. It produces a mutation score and pinpoints exactly which test assertions are missing. This gives teams a quantitative answer to the question "how good are our tests, really?"

The skill is static-analysis-only: no code execution, no test runner invocation, no file system writes beyond the output artifact.

---

## §2 — Mutation Operator Catalogue

Each operator defines how source code is transformed:

```json
{
  "operator": "conditional_boundary",
  "description": "Changes relational operators at boundaries",
  "transformations": [
    { "from": ">", "to": ">=" }, { "from": ">=", "to": ">" },
    { "from": "<", "to": "<=" }, { "from": "<=", "to": "<" }
  ]
},
{
  "operator": "negate_conditionals",
  "description": "Negates boolean conditions",
  "transformations": [
    { "from": "if (x)", "to": "if (!x)" },
    { "from": "while (x)", "to": "while (!x)" }
  ]
},
{
  "operator": "remove_conditionals",
  "description": "Replaces condition with constant",
  "transformations": [
    { "from": "<condition>", "to": "true" },
    { "from": "<condition>", "to": "false" }
  ]
},
{
  "operator": "arithmetic_operator",
  "description": "Replaces arithmetic operators",
  "transformations": [
    { "from": "+", "to": "-" }, { "from": "-", "to": "+" },
    { "from": "*", "to": "/" }, { "from": "/", "to": "*" }
  ]
},
{
  "operator": "return_value",
  "description": "Changes return values",
  "transformations": [
    { "from": "return x", "to": "return null" },
    { "from": "return true", "to": "return false" },
    { "from": "return n", "to": "return 0" }
  ]
},
{
  "operator": "void_method_calls",
  "description": "Removes void method calls",
  "transformations": [
    { "from": "<method_call>;", "to": "/* removed */" }
  ]
},
{
  "operator": "null_returns",
  "description": "Replaces object returns with null",
  "transformations": [
    { "from": "return <object>", "to": "return null" }
  ]
}
```

---

## §3 — Mutation Generation Algorithm

```
Step 1: Parse source_code
  Identify: all functions, conditional blocks, arithmetic expressions,
            return statements, null checks, void calls
  If critical_functions provided: prioritise those functions
  Output: syntax_map { function_name → [ logic_constructs ] }

Step 2: Generate candidate mutations
  For each logic_construct in syntax_map:
    For each applicable mutation_operator:
      Create candidate mutation:
        mutation_id: "MUT-{sequence}"
        operator: operator name
        location: { function, line_estimate }
        original_code_fragment: verbatim code fragment
        mutated_code_fragment: transformed code fragment
  Sort by: critical_functions first, then by operator impact
  Truncate to max_mutations (default: 50)
  Output: mutation_candidates list

Step 3: Classify kill status per mutation
  For each mutation_candidate:
    Scan existing_tests for assertion patterns that would detect the mutation:
      - Exact value assertions: assertEqual(result, expected_value) where expected value would change
      - Boundary assertions: assertTrue(x > threshold) where boundary change would flip result
      - Null assertions: assertNotNull(result) where null_return mutation would trigger
      - Boolean assertions: assertTrue(flag) / assertFalse(flag)
    Kill status:
      killed  → at least one assertion directly targets the mutated construct
      survived → no assertion targets the mutated construct
      unknown  → insufficient information to determine (complex indirect paths)
    If killed: identify killing_test (test function name)
    detection_difficulty:
      easy   → mutation changes a tested return value directly
      medium → mutation changes control flow one step removed from assertion
      hard   → mutation changes a side effect or nested conditional
  Output: classified_mutations list
```

---

## §4 — Mutation Score and Gap Analysis

```
killed_count   = count(mutations where kill_status == "killed")
total_count    = count(mutations where kill_status != "unknown")
mutation_score = round(killed_count / total_count * 100, 1)

surviving_mutations = filter(mutations, kill_status == "survived")
  Sort by: detection_difficulty DESC (hardest surviving mutants most actionable)
  Limit to top 20 for output

coverage_vs_mutation_gap =
  "Your tests have estimated {coverage_pct}% line coverage but only {mutation_score}%
   mutation score — approximately {gap_pct}% of logic bugs may be undetected."
```

---

## §5 — Assertion Gap Generation

For each surviving mutation, generate a concrete assertion to add:

```
For each surviving_mutation:
  gap_id = "GAP-{sequence}"
  function = mutation.location.function
  assertion_description = human-readable description of what to assert
  example_assertion_code = language-specific assertion code fragment

Examples by operator:
  conditional_boundary:
    assertion_description: "Assert that function returns different value at exact boundary"
    example_assertion_code: "expect(fn({value: BOUNDARY})).toBe(EXPECTED_AT_BOUNDARY)"

  null_returns:
    assertion_description: "Assert return value is never null for valid input"
    example_assertion_code: "expect(fn(validInput)).not.toBeNull()"

  return_value:
    assertion_description: "Assert specific return value, not just truthy"
    example_assertion_code: "expect(fn(input)).toEqual(EXACT_EXPECTED_VALUE)"
```

---

## §6 — Feedback Routes

| Event | Target Skill | Action |
|---|---|---|
| `mutation_score_below_threshold` (< 60%) | `test-generator` | backpropagate: attach assertion_gaps list for gap filling |
| `critical_function_survival_rate_high` (>40% survived in critical_functions) | `clean-code-review` | alert: high mutation survival in critical paths suggests weak assertion strategy |

---

## §7 — Orchestration Position

```
Phase 7 pipeline:
  [test-generator] → [mutation-test-generator] → [if score < 60%: backpropagate to test-generator]
                                               → [quality-scoring receives mutation_score as input]

Optional trigger: user requests mutation analysis on-demand
  "check mutation score for <module>" → orchestrator → mutation-test-generator
```

The skill is optional but recommended for:
- Modules with security-critical logic (auth, encryption, payment processing)
- Any module where `test-generator` achieved > 75% coverage (validate quality of those tests)
- Pre-release quality gates when mutation confidence is unknown

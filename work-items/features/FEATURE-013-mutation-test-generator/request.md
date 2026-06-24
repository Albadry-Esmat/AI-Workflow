# FEATURE-013 — Request: Mutation Test Generator

**Origin:** Identified during ASE-OS enhancement analysis (2026-06-24).

---

## Problem Statement

`test-generator` achieves line and branch coverage targets, and `implementation-completeness-auditor` checks that all requirements are covered. However, 80% line coverage does not guarantee that tests will catch bugs. Tests can cover code without asserting the right things — they pass even when the logic is wrong. Coverage is a necessary but not sufficient quality signal.

This means:
- A test suite with 90% coverage can miss entire categories of logical errors
- Boolean boundary conditions (`>` vs `>=`), removed null checks, and wrong return values are invisible to coverage metrics
- Teams ship code believing they have adequate test quality when their assertions are weak
- `test-generator` has no feedback mechanism to identify which assertions are missing
- The gap between "covered" and "tested" is never quantified

## Requested Behaviour

After `test-generator` produces a test suite, `mutation-test-generator` should:

1. Parse the source code to identify functions and their logic constructs (conditions, operators, return statements, null checks)
2. Apply **mutation operators** to generate a set of mutation variants (capped at `max_mutations`, prioritising `critical_functions`):
   - `conditional_boundary`: `>` → `>=`, `<` → `<=`
   - `negate_conditionals`: `if (x)` → `if (!x)`
   - `remove_conditionals`: replace condition with `true` or `false`
   - `arithmetic_operator`: `+` → `-`, `*` → `/`
   - `return_value`: change return value (null, 0, empty string, negated boolean)
   - `void_method_calls`: remove a void method call
   - `null_returns`: return null instead of object
3. For each mutation, **statically analyse** whether the existing test suite contains assertions that would detect the change (kill the mutant)
4. Classify each mutation as: `killed` (a test assertion directly targets the mutated logic), `survived` (no test checks it), or `unknown`
5. Calculate a **mutation score** (killed / total × 100)
6. Generate **assertion gaps**: concrete assertion code examples to add to tests to kill surviving mutants
7. Emit `mutation_score_below_threshold` feedback to `test-generator` when score < 60%

This skill performs **static mutation analysis** — it infers kill status by analysing test assertions against code logic patterns. It does NOT execute code or run tests. This makes it model-safe and token-efficient.

## Scope

- `.opencode/skills/mutation-test-generator/SKILL.md` — new skill (SKL-073)
- `skills/registry.json` — register new skill
- `skills/index.yaml` — add index entry

## Out of Scope

- Runtime test execution (this is static analysis only)
- Integration with mutation testing frameworks (PIT, Stryker, mutmut) — output is specifications, not runner config
- Generating complete replacement test files (it generates assertion additions only)
- Coverage measurement (that is `test-generator`'s responsibility)
- Mutation testing of infrastructure-as-code or configuration files

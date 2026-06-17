# Test Generator — Knowledge Reference

## Principles

- **Tests describe behavior, not implementation**: A generated test should validate what a function does (contract), not how it does it (implementation). Tests that break when internal implementation changes without behavioral change are brittle.
- **Every exported symbol gets a test**: No public function, method, or class may leave the code-generator → test-generator pipeline without at least a happy path and an error path test. Coverage of exported symbols is a hard gate.
- **Edge cases are the primary value**: Happy path tests give you green builds. Edge case tests prevent production outages. Generated tests must include boundary values, null inputs, and error paths — not just the expected use.
- **Mock at module boundaries**: Mocks are generated for all inter-module dependencies. Mocking internal helpers is an anti-pattern — it over-constrains implementation and makes tests brittle.
- **Tests must be readable**: A generated test name must describe the behavior being tested: `should return 401 when token is expired` — not `test_auth_1`. Test readability is a first-class generation concern.

## Test Tiers

| Tier | Scope | Generation Mode | Framework |
|------|-------|----------------|-----------|
| Unit | Single function/class | `from_code` | jest, pytest, go_test |
| Integration | Module boundary | `from_spec` | jest, pytest, go_test |
| E2E | Full flow | `from_strategy` | Playwright, Cypress, pytest |

## Test Case Categories (per testable unit)

| Category | Description | Priority |
|----------|------------|---------|
| Happy path | Valid inputs → expected output | Required |
| Null/empty inputs | null, undefined, empty string, empty array | Required |
| Boundary values | min, max, zero, negative, MAX_INT | Required |
| Error path | Invalid type, missing required field | Required |
| Async edge | Timeout, rejection, race condition | Required for async |
| Side effect | Mock interactions, call count, call args | Required if side effects present |
| Idempotency | Same input twice → same output | Recommended |

## Mock Generation Rules

- Mock boundaries: only mock imports from OTHER modules (cross-module edges in dependency graph)
- Do not mock: functions in the same file or same module
- Mock style: use `jest.mock()`, `unittest.mock.patch`, or `gomock` — framework-idiomatic
- Assertion: every mock asserts it was called (or not called) — not just that it exists

## Anti-patterns

- **Test for implementation**: Mocking private methods or asserting on internal data structures. Private internals can change without breaking the contract.
- **Single happy path only**: Generating only the successful case because it is the easiest. Error paths and edge cases are where bugs live.
- **God test**: One test function that validates 10 different behaviors. One test = one behavior. A failing test should immediately identify what is broken.
- **Unstable fixtures**: Tests that depend on global state, system time, or random values without seeding. All test inputs must be deterministic.

## Source References

- xUnit patterns (Gerard Meszaros)
- Test-Driven Development (Kent Beck)
- FIRST principles for unit tests (Fast, Independent, Repeatable, Self-validating, Timely)

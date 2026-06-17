# Testing Strategy — Knowledge Reference

**Skill ID:** SKL-005
**Version:** 1.1.0 | **Last updated:** 2026-06-16
**Mastery Level:** intermediate
**Executable Skill:** [testing-strategy](../testing/testing-strategy.md)
**Primary Source:** *Test Driven Development: By Example* — Kent Beck (2002); *Growing Object-Oriented Software, Guided by Tests* — Freeman & Pryce (2009)

---

## Overview

A testing strategy defines how a system verifies its own correctness — what kinds of tests to write, at what granularity, with what coverage expectations, and which gates must pass before promotion. Tests are not a quality activity added at the end — they are the primary tool for designing better code and the only mechanism that makes refactoring safe.

---

## Purpose

Apply this skill to:

- Define the full test plan before implementation begins
- Set measurable coverage targets per module and per layer
- Identify edge cases that are not obvious from happy-path requirements
- Define quality gates that block promotion at each environment stage

---

## Principles

### P1 — The Test Pyramid *(The Art of Software Testing, Myers; GOOS, Freeman & Pryce — Ch 1)*

Tests should be distributed across three layers with the majority at the base:

```
         /\
        /  \   E2E Tests (few, slow, expensive)
       /    \
      /------\
     /        \  Integration Tests (some, medium speed)
    /          \
   /------------\
  /              \  Unit Tests (many, fast, cheap)
 /________________\
```

**Rules:**
- 70% unit, 20% integration, 10% e2e is a reasonable starting target
- Every step up the pyramid costs more to run and maintain — keep tests as low as possible
- E2E tests verify critical user journeys only, not implementation details

### P2 — TDD Red-Green-Refactor *(TDD by Example, Beck — Part I)*

Write a failing test, make it pass with the simplest code, then clean up.

**Cycle:**
1. **Red** — write a test that fails (this test defines the new behavior)
2. **Green** — write the minimum code to make it pass (correctness only)
3. **Refactor** — clean up the code while keeping all tests green

**Rules:**
- Never write production code without a failing test — the test specifies the intent
- The green step prioritizes passing the test, not elegance
- The refactor step prioritizes readability and structure, enabled by the green tests

### P3 — Test Doubles *(GOOS, Freeman & Pryce — Ch 8)*

Isolate the unit under test using doubles. Understand the difference:

| Double Type | What it does | When to use |
|-------------|-------------|-------------|
| Stub | Returns hardcoded responses | Testing a path that depends on a collaborator |
| Mock | Verifies that a call was made with specific args | Testing that a side effect occurred |
| Fake | Works but uses a simplified implementation | In-memory repository in tests |
| Spy | Records calls for later assertion | Legacy code without injection points |

**Rule:** Prefer stubs and fakes. Overuse of mocks leads to brittle tests that test implementation, not behavior.

---

## Practices

| Practice | Description |
|----------|-------------|
| Test behaviors, not implementations | Tests describe what the system does, not how. If implementation changes but behavior stays the same, tests must not break. |
| Arrange-Act-Assert | Every test: set up → perform action → assert outcome. One concept per test. |
| Test names as documentation | `should_reject_login_with_expired_password` beats `test_login_3` |
| Cover edge cases explicitly | Null, empty, max boundary, concurrent, and error paths must each have a test |
| Enforce quality gates in CI | No PR merges without all tests passing and coverage thresholds met |

---

## Anti-patterns

### AP1 — The Ice Cream Cone (Inverted Pyramid)

**What:** Mostly E2E and integration tests; few unit tests.
**Why harmful:** Slow, brittle, expensive to maintain; failures are hard to diagnose.
**How to fix:** Push test logic down — unit test the behavior, integration test the wiring.

### AP2 — Testing Implementation Details

**What:** Tests that break when internal structure changes, even if public behavior is unchanged.
**Why harmful:** Prevents refactoring; the tests become a liability instead of an asset.
**How to fix:** Test only the public API of the unit under test. Do not assert on private methods.

### AP3 — The Megamock

**What:** A test file that mocks every dependency in a system and asserts only that mocks were called.
**Why harmful:** Does not verify behavior; only verifies that the code exists. False confidence.
**How to fix:** Test behavior through the public interface. Use fakes or stubs for I/O.

### AP4 — Flaky Tests

**What:** Tests that fail intermittently without code changes (usually due to timing, network, or shared state).
**Why harmful:** Destroys trust in the test suite; developers start ignoring failures.
**How to fix:** Eliminate shared mutable state. Use deterministic fakes. Control time in tests.

---

## Examples

### ✅ Correct — Behavior-Focused Test

```python
def test_should_reject_login_when_password_is_wrong():
    user = UserFactory.with_password("correct_pass")
    auth_service = AuthService(user_repo=InMemoryUserRepo([user]))

    result = auth_service.login("user@example.com", "wrong_pass")

    assert result.is_failure
    assert result.error_code == "INVALID_CREDENTIALS"
```

### ❌ Incorrect — Implementation-Focused Test

```python
def test_login_calls_find_by_email():
    mock_repo = Mock()
    auth_service = AuthService(user_repo=mock_repo)
    auth_service.login("user@example.com", "pass")
    # Only asserts that a method was called, not what happened
    mock_repo.find_by_email.assert_called_once_with("user@example.com")
```

---

### ✅ Correct — Edge Case Coverage

```python
@pytest.mark.parametrize("password", ["", None, " ", "a" * 1001])
def test_should_reject_invalid_password_formats(password):
    result = PasswordValidator.validate(password)
    assert result.is_invalid
```

### ❌ Incorrect — Happy Path Only

```python
def test_validate_password():
    # Only tests one valid case — no edge cases
    assert PasswordValidator.validate("SecurePass123!").is_valid
```

---

## Related Skills

| Skill | ID | Relationship |
|-------|----|-------------|
| Requirement Analysis | SKL-001 | Every test case must map to a requirement |
| Architecture Design | SKL-002 | Layer architecture determines test type (unit vs integration vs e2e) |
| Feature Planning | SKL-003 | Tasks are the scope boundary for test coverage |
| Clean Code Review | SKL-004 | Testable code is clean code — tight coupling makes testing impossible |

---

## Source References

| Source | Chapter / Section | Linked Content |
|--------|------------------|----------------|
| *TDD by Example* — Kent Beck | Part I: Money Example | P2 |
| *TDD by Example* — Kent Beck | Part III: Patterns for TDD | Practices |
| *Growing Object-Oriented Software* — Freeman & Pryce | Ch 1: What is the Point of TDD? | P1 |
| *Growing Object-Oriented Software* — Freeman & Pryce | Ch 8: Building on Third-Party Code | P3 |
| *The Art of Software Testing* — Myers | Ch 2: The Psychology and Economics of Testing | P1 |
| *Effective Unit Testing* — Lasse Koskela | Ch 3: Test Doubles | AP3 |

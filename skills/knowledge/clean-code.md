# Clean Code — Knowledge Reference

**Skill ID:** SKL-004
**Version:** 1.1.0 | **Last updated:** 2026-06-16
**Mastery Level:** intermediate
**Executable Skill:** [clean-code-review](../review/clean-code-review.md)
**Primary Source:** *Clean Code: A Handbook of Agile Software Craftsmanship* — Robert C. Martin (2008)

---

## Overview

Clean code reads like well-written prose. It is code that any developer can understand, modify, and extend without requiring the original author. Clean code minimizes cognitive load, eliminates hidden surprises, expresses intent clearly, and makes defects obvious. Robert Martin defines it as code that "does what you expect it to do" — precisely, reliably, and without mystery.

---

## Purpose

Apply this skill to:

- Evaluate existing code for readability, maintainability, and structural quality before merging
- Generate prioritized, evidence-based refactoring recommendations
- Detect the root cause of fragility and high change cost in existing code
- Enforce team-level coding standards consistently across all reviewers

---

## Principles

### P1 — Meaningful Names *(Clean Code, Ch 2)*

Names must reveal intent. A name should answer: why does this exist, what does it do, how is it used.

**Rules from Chapter 2:**
- Use intention-revealing names: `elapsedTimeInDays`, not `d`
- Avoid disinformation: `accountList` must be a `List` type, or rename it `accounts`
- Make meaningful distinctions: `getActiveAccount()`, `getActiveAccounts()`, `getActiveAccountInfo()` are three different operations
- Use pronounceable names: `genymdhms` → `generationTimestamp`
- Use searchable names: single-letter names are only acceptable for loop counters in very short scopes
- No Hungarian notation: `strName`, `iCount` — let the type system carry type information
- Class names = nouns; method names = verbs

### P2 — Functions Do One Thing *(Clean Code, Ch 3)*

A function does one thing when all statements in it are one level of abstraction below the function's name.

**Rules from Chapter 3:**
- Functions should be ≤ 20 lines; ideally 4–10 lines
- Ideal parameter count: 0 (niladic). Accept: 1 (monadic). Tolerate: 2 (dyadic). Avoid: 3+
- Never use flag (boolean) arguments — split into two named functions
- A function either commands (does something) or queries (returns a value) — never both
- Extract try/catch blocks into separate functions: `doActualWork()` + `handleError()`
- No side effects — `checkPassword()` must not initialize a session

### P3 — Comments Add Value, Not Noise *(Clean Code, Ch 4)*

If code needs a comment to explain what it does, it is not clean enough. Comments explain why, not what.

**Good comments:**
- Legal notices (copyright, license)
- Intent explanations ("We tried approach X and it failed because Y")
- Clarification of obscure third-party API usage
- TODO comments that are tracked and resolved
- Warning of consequences ("Changing this algorithm breaks the backward-compat guarantee")

**Bad comments (delete these):**
- Redundant: `// increment counter` above `counter++`
- Misleading: comments that contradict the code they describe
- Commented-out code: use version control — delete dead code
- Noise: `// Default constructor` / `// End of function`

### P4 — FIRST Test Properties *(Clean Code, Ch 9)*

Tests must be as clean as production code. They are the only mechanism that allows refactoring to be safe.

| Letter | Property | Rule |
|--------|----------|------|
| F | Fast | Tests run in milliseconds, not seconds. A slow test suite is not run. |
| I | Independent | Tests must not depend on each other or share state. |
| R | Repeatable | Same result in any environment — dev, CI, staging. |
| S | Self-Validating | Boolean pass/fail output only. No manual log inspection. |
| T | Timely | Written before or alongside production code (TDD), not after the fact. |

**Additional rules:**
- One concept per test — one logical assertion, one behavior
- Test names describe behavior: `should_reject_login_when_password_is_wrong`, not `test2`

### P5 — Single Responsibility Principle *(Clean Code, Ch 10; SOLID)*

A class has one, and only one, reason to change. Reason = actor (stakeholder) whose requirements drive a change.

**Rules:**
- Class size: measured in responsibilities, not lines. Small classes, each with one job.
- High cohesion: methods should use most of the class's variables — low cohesion signals misplaced responsibility
- If the class description requires the word "and", it has more than one responsibility

### P6 — SOLID Principles *(Cross-reference: Clean Architecture, Martin — Ch 7–11)*

| Principle | Statement | Violation Signal |
|-----------|-----------|-----------------|
| S — Single Responsibility | One reason to change | Class description contains "and" |
| O — Open/Closed | Open for extension, closed for modification | Every new feature requires editing existing classes |
| L — Liskov Substitution | Subtypes substitutable for base types | Overriding methods that weaken postconditions |
| I — Interface Segregation | Many specific interfaces over one general | Clients forced to depend on methods they never call |
| D — Dependency Inversion | Depend on abstractions, not concretions | Concrete classes imported in inner layers |

---

## Practices

| Practice | Description |
|----------|-------------|
| Extract Method | Replace inline logic with a named function that declares intent |
| Replace Magic Number | `86400` → `SECONDS_PER_DAY = 86400` — named constant with meaning |
| Introduce Explaining Variable | Name an intermediate computation result to make it readable |
| Remove Flag Parameter | Replace `render(isPdf=True)` with `render_pdf()` / `render_html()` |
| Guard Clause | Return early on invalid conditions — eliminate deep nesting |
| Compose Method | Break one long method into several collaborating small ones |
| Separate Query from Command | `is_valid()` returns bool; `validate()` throws — never both in one function |

---

## Anti-patterns

### AP1 — God Class

**What:** A class with hundreds of methods covering unrelated responsibilities.
**Why harmful:** Violates SRP; every change is risky; impossible to test independently.
**How to fix:** Identify cohesive clusters of methods and data; extract into separate classes.

### AP2 — Long Parameter List

**What:** A function with more than 3 parameters.
**Why harmful:** Hard to remember order; creates combinatorial test burden; signals a missing abstraction.
**How to fix:** Introduce a Parameter Object; group related parameters into a named struct or class.

### AP3 — Feature Envy

**What:** A method that accesses more data from another class than from its own class.
**Why harmful:** Behavior is in the wrong place; changes to the other class cascade here.
**How to fix:** Move the method to the class whose data it most uses.

### AP4 — Primitive Obsession

**What:** Using primitive types (string, int) for domain concepts like money, email, or coordinates.
**Why harmful:** No validation, no behavior, logic scattered across the codebase.
**How to fix:** Introduce a Value Object: `Email`, `Money`, `UserId`, `Coordinates`.

### AP5 — Shotgun Surgery

**What:** One conceptual change requires small edits scattered across dozens of classes.
**Why harmful:** High error surface; easy to miss a location; violates CCP.
**How to fix:** Move all related behavior into one module. Apply the Common Closure Principle.

### AP6 — Dead Code

**What:** Unreachable paths, commented-out code, unused methods, obsolete branches.
**Why harmful:** Misleads readers; generates false coverage numbers; wastes cognitive energy.
**How to fix:** Delete it. Version control preserves history. There is no "just in case."

---

## Examples

### ✅ Correct — Intention-Revealing Names

```python
# Good: names declare intent
def calculate_elapsed_time_in_days(start_date: date, end_date: date) -> int:
    return (end_date - start_date).days
```

### ❌ Incorrect — Cryptic Names

```python
# Bad: what is d? what does calc do? what are d1, d2?
def calc(d1, d2):
    return (d2 - d1).days
```

---

### ✅ Correct — Guard Clauses Eliminate Nesting

```python
def process_order(order: Order) -> None:
    if order is None:
        return
    if not order.is_valid():
        raise InvalidOrderError(order.id)
    if not order.has_items():
        return
    # main logic — not nested, easy to read
    _fulfill(order)
```

### ❌ Incorrect — Arrow Anti-pattern (Deep Nesting)

```python
def process_order(order):
    if order is not None:
        if order.is_valid():
            if order.has_items():
                # logic buried 3 levels deep
                pass
```

---

### ✅ Correct — Single Responsibility, Two Classes

```python
class OrderPricer:
    def calculate_total(self, order: Order) -> Money:
        return sum(item.price for item in order.items)

class OrderValidator:
    def validate(self, order: Order) -> ValidationResult:
        ...
# Each class has one reason to change
```

### ❌ Incorrect — God Class

```python
class OrderManager:
    def validate_order(self): ...
    def calculate_price(self): ...
    def send_confirmation_email(self): ...
    def update_inventory(self): ...
    def generate_pdf_invoice(self): ...
    def apply_discount_code(self): ...
# One class owns too many unrelated responsibilities
```

---

### ✅ Correct — Named Constant Replaces Magic Number

```python
SECONDS_PER_DAY = 86_400

def expire_session(created_at: datetime) -> bool:
    return (datetime.utcnow() - created_at).seconds > SECONDS_PER_DAY
```

### ❌ Incorrect — Magic Number

```python
def expire_session(created_at):
    return (datetime.utcnow() - created_at).seconds > 86400
# Where does 86400 come from? What if the expiry changes to 2 days?
```

---

## Related Skills

| Skill | ID | Relationship |
|-------|----|-------------|
| Architecture Design | SKL-002 | SOLID at module level is architecture; at class level is clean code |
| Testing Strategy | SKL-005 | Clean tests are a deliverable of clean code (FIRST properties) |
| Security Review | SKL-006 | Secure code avoids hidden side effects and implicit trust — clean code principles apply |
| Feature Planning | SKL-003 | Refactoring tasks are scoped by the task breakdown from SKL-003 |

---

## Source References

| Source | Chapter / Section | Linked Content |
|--------|------------------|----------------|
| *Clean Code* — Robert C. Martin | Ch 1: Clean Code | Overview |
| *Clean Code* — Robert C. Martin | Ch 2: Meaningful Names | P1 |
| *Clean Code* — Robert C. Martin | Ch 3: Functions | P2 |
| *Clean Code* — Robert C. Martin | Ch 4: Comments | P3 |
| *Clean Code* — Robert C. Martin | Ch 9: Unit Tests | P4 |
| *Clean Code* — Robert C. Martin | Ch 10: Classes | P5 |
| *Clean Code* — Robert C. Martin | Ch 17: Smells and Heuristics | Anti-patterns |
| *Clean Architecture* — Robert C. Martin | Ch 7–11: SOLID Principles | P6 |
| *Refactoring* — Martin Fowler (2018) | Extract Method, Introduce Parameter Object | Practices |
| *The Pragmatic Programmer* — Hunt & Thomas | Ch 7: While You Are Coding | P2, AP6 |

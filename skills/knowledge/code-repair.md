# Code Repair — Knowledge Reference

## Principles

- **Minimal change, maximum confidence**: A repair that touches 3 lines is better than one that rewrites 30, even if both fix the failing test. Minimal diffs reduce regression risk and are easier to review.
- **Root cause before fix**: Apply a fix only after the root cause is classified. Applying a fix without understanding the root cause produces patches that hide symptoms without resolving the underlying issue.
- **Public API is inviolable**: A repair must never change function signatures, remove exports, or modify public interface shapes. If the contract is broken, that is an architecture-design problem — not a code-repair problem.
- **Validate before write**: A repaired file must pass syntax validation and regression checks before being written to state. Writing an invalid repair is worse than the original failure.
- **Escalate on exhaustion**: After `max_iterations`, stop attempting automated repair and escalate to the human operator with a complete diagnostic report. Infinite repair loops are a system failure.

## Root Cause Classification

| Category | Indicators | Typical Fix |
|----------|------------|------------|
| `MISSING_IMPORT` | "Cannot find module", "ImportError", "undefined is not a function" | Add import statement |
| `TYPE_MISMATCH` | TypeScript TS2345, Python TypeError, Go type error | Cast, coerce, or fix function signature (PATCH only) |
| `NULL_REFERENCE` | "Cannot read property of undefined", "NullPointerException" | Add null guard |
| `CONTRACT_VIOLATION` | Test assertion fails on expected return shape | Fix return value to match contract |
| `LOGIC_ERROR` | Test assertion fails on computed value (not null) | Fix algorithm in function body |
| `LINT_STYLE` | ESLint, Flake8, golint violations | Apply formatter, fix style rule |
| `UNDEFINED_SYMBOL` | Reference to variable/function that doesn't exist in scope | Fix scope or rename reference |

## Repair Candidate Strategy

Generate candidates in order of invasiveness:

1. **Candidate 1 (minimal)**: Fix only the exact line(s) indicated by the error report
2. **Candidate 2 (contextual)**: Fix the function body containing the error
3. **Candidate 3 (module-level)**: Fix all related functions in the same module that share the root cause

Only generate Candidate 2 if Candidate 1 fails validation. Only generate Candidate 3 if Candidate 2 fails.

## Escalation Triggers

| Condition | Escalation Target |
|-----------|-----------------|
| All candidates exhausted | Human operator (HITL gate) + backpropagate to clean-code-review |
| Root cause is `CONTRACT_VIOLATION` involving auth/data | Mandatory security-review before any repair |
| Root cause is `LOGIC_ERROR` with no test intent available | Human operator (test intent must be clarified) |
| Repair would change public API | Reject repair, escalate to architecture-design |

## Anti-patterns

- **Speculative repair**: Applying a fix without first identifying the root cause. Speculative repairs have low success rates and high regression risk.
- **Silencing the error**: Adding a try/catch that swallows the exception to make the test pass. This is not a repair — it is suppression.
- **Signature mutation**: Changing a function's parameter list or return type to make a test pass. This breaks all consumers of that function.
- **Repair without test**: Applying a repair that makes the immediate test pass but doesn't verify it doesn't break other tests. All repairs must be validated against the full test suite for the affected module.

## Source References

- Program repair techniques survey (Monperrus, "Automatic Software Repair: a Bibliography")
- Delta debugging algorithm (Zeller, "Why Programs Fail")
- Mutation testing as a repair oracle

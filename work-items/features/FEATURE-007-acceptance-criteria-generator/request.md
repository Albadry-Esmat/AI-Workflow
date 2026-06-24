# FEATURE-007 — Request: Acceptance Criteria Generator

**Origin:** Identified during ASE-OS enhancement analysis (2026-06-24).

---

## Problem Statement

`requirement-analyzer` outputs structured requirements, but `testing-strategy` has to infer testability from free-text requirement descriptions. There is no formal bridge that produces executable acceptance criteria in a structured, traceable format. Tests are written to cover code, not to verify business intent.

This gap results in:
- Requirements and tests that are disconnected — no requirement ID appears in test annotations
- `test-generator` receiving no guidance on which tests correspond to which business requirements
- Requirements with low testability (ambiguous, missing expected outcomes) being silently passed through
- Edge cases and negative scenarios identified ad hoc by individual engineers, not systematically generated
- No formal coverage percentage showing what fraction of requirements have verifiable tests

## Requested Behaviour

For each validated requirement from `requirement-analyzer`, generate formal **BDD-style acceptance criteria** (Given / When / Then), assign a unique AC ID per criterion, identify negative and edge-case scenarios, and rate testability per criterion. The output feeds directly into `test-generator` and `testing-strategy` as first-class inputs, making every test traceable to a business requirement.

Untestable requirements (ambiguous, missing measurable outcomes) are flagged and backpropagated to `requirement-analyzer` for clarification rather than silently passing through.

## Scope

- `acceptance-criteria-generator/SKILL.md` (SKL-067) — new skill
- `skills/registry.json` — register SKL-067
- `skills/index.yaml` — add index entry

## Out of Scope

- Writing test code (that is `test-generator`'s responsibility)
- UI wireframes or visual acceptance criteria
- Performance benchmarks or SLA threshold definitions
- Modifying the upstream requirements — untestable requirements are flagged, not rewritten
- Gherkin step definition files or test runner configuration

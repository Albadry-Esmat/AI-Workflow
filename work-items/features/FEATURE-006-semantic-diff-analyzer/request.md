# FEATURE-006 — Request: Semantic Diff Analyzer

**Origin:** Identified during ASE-OS enhancement analysis (2026-06-24).

---

## Problem Statement

`change-impact-analyzer` works at module/file level. It knows *what files* changed but not *how behavior changed*. Two functions with opposite logic can have identical line-diff counts. This means `security-review` and `test-generator` receive imprecise impact signals — they cannot distinguish a whitespace cleanup from an auth-check removal.

This gap results in:
- Security reviews that miss logic-level regressions caused by subtle conditional changes
- Test generators that regenerate tests without knowing which existing assertions are now invalid
- Clean code reviews that lack behavioral context for assessing refactoring risk
- False confidence when a change passes line-level review but silently inverts a security guard

## Requested Behaviour

When code is modified, compare the before/after versions of each changed function and produce a **semantic change summary**: what behavioral contracts changed, what edge cases were added or removed, and what security-relevant logic was altered (auth checks, null guards, data access patterns).

The output must feed `security-review`, `test-generator`, and `clean-code-review` with behavior-level signals, replacing the current reliance on line-level diff counts. The skill runs after `change-impact-analyzer` on any `code.changed` event when `analysis_depth != "quick"`.

## Scope

- `semantic-diff-analyzer/SKILL.md` (SKL-066) — new skill
- `skills/registry.json` — register SKL-066
- `skills/index.yaml` — add index entry

## Out of Scope

- Execution or runtime instrumentation of the code under analysis
- Full formal verification or theorem proving
- Replacing `change-impact-analyzer` (this skill augments it — it does not replace it)
- Analysis of binary, compiled, or minified artifacts
- Generating fixed or corrected code — this skill is read-only analysis only

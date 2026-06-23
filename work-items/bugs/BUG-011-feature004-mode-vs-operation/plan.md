# BUG-011 — Plan: Fix "mode" → "operation" in FEATURE-004 plan.md

## Investigation

`skill-authoring/SKILL.md` uses `operation` as the invocation field name, with enum values:
`new`, `refactor`, `split`, `validate`, `evolve`

FEATURE-004/plan.md uses "mode" in two sections:
- §1 Step 3 (line 66): `mode = gap_seed`
- §2 table (lines 132–141): column header "Mode" and row "gap_seed mode"

No other FEATURE file uses "mode" in this context.

## Remediation Plan

1. In §1 Step 3: change `mode = gap_seed` → `operation = gap_seed`
2. In §2: rename table column `"Mode"` → `"Operation"`, rename note `"gap_seed mode"` → `"gap_seed operation"`, and update the description text accordingly
3. In §2 body text: change "invocation modes" → "operations" where applicable

## Files Changed

- `work-items/features/FEATURE-004-gap-to-skill-pipeline/plan.md`

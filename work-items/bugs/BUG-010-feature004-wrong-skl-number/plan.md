# BUG-010 — Plan: Fix SKL-049 → SKL-065 in FEATURE-004 planning files

## Investigation

Cross-reference of `skills/registry.json`:
- SKL-049 = `enhancement-dashboard` — **already registered, active**
- SKL-059/060 = reserved for Phase 2 (work-items/backlog)
- SKL-061–064 = reserved for Phase 3
- SKL-065 = **first free number** — correct ID for `gap-to-skill-pipeline`

FEATURE-004/plan.md references SKL-049 in 3 locations:
- Line 18: target skills table
- Line 20: registry.json update note
- Line 159: pipeline template JSON (`"skill": "SKL-049"`)

FEATURE-004/request.md references SKL-049 in 1 location:
- Line 41: scope table

## Remediation Plan

1. Replace all `SKL-049` occurrences in `plan.md` with `SKL-065`
2. Replace all `SKL-049` occurrences in `request.md` with `SKL-065`
3. Verify no other FEATURE files reference SKL-049 in the context of gap-to-skill-pipeline

## Files Changed

- `work-items/features/FEATURE-004-gap-to-skill-pipeline/plan.md`
- `work-items/features/FEATURE-004-gap-to-skill-pipeline/request.md`

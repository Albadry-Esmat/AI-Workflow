# BUG-010 — Request: FEATURE-004 assigns SKL-049 to gap-to-skill-pipeline (SKL-049 is taken)

**Reported:** 2026-06-24
**Severity:** HIGH
**Source:** Internal audit of FEATURE-004 planning files cross-referenced with skills/registry.json

---

## Description

`work-items/features/FEATURE-004-gap-to-skill-pipeline/plan.md` and `request.md` assign the skill ID **SKL-049** to the new `gap-to-skill-pipeline` skill.

SKL-049 is **already assigned** to `enhancement-dashboard` in `skills/registry.json`. Assigning SKL-049 to a second skill would create a registry collision and cause `scripts/validate-skills.sh` to fail.

The correct next-available ID for `gap-to-skill-pipeline` is **SKL-065**:
- SKL-059/060: reserved Phase 2
- SKL-061–064: reserved Phase 3
- **SKL-065: first free number**

## Impact

If the plan is executed as written, the registrar would attempt to register SKL-049 twice, breaking the registry validation and causing `validate-skills.sh` to fail with a duplicate-ID error.

## Affected Files

- `work-items/features/FEATURE-004-gap-to-skill-pipeline/plan.md` — lines 18, 20, 159
- `work-items/features/FEATURE-004-gap-to-skill-pipeline/request.md` — lines 41–43

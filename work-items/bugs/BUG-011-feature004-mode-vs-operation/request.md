# BUG-011 — Request: FEATURE-004 plan.md uses "mode" field; skill-authoring uses "operation"

**Reported:** 2026-06-24
**Severity:** MEDIUM
**Source:** Internal audit cross-referencing FEATURE-004 plan against skill-authoring/SKILL.md

---

## Description

`work-items/features/FEATURE-004-gap-to-skill-pipeline/plan.md` references the `gap_seed` invocation as:

```
mode = gap_seed
```

and

```
| Mode | Description |
```

However, `skill-authoring/SKILL.md` uses the field name **`operation`** (not `mode`) for its invocation enum. The existing operations are `new`, `refactor`, `split`, `validate`, `evolve`.

The FEATURE-004 plan must use `operation = gap_seed` and refer to "operation modes" (not "invocation modes") throughout, to be consistent with the actual skill-authoring input contract.

## Impact

An implementer following the plan verbatim would pass `mode: gap_seed` to `skill-authoring`, which would be an unrecognised field. The operation would fail silently or raise a schema validation error.

## Affected File

- `work-items/features/FEATURE-004-gap-to-skill-pipeline/plan.md` — lines 63–67, 132–141

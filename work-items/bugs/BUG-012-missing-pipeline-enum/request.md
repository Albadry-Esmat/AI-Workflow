# BUG-012 — Request: "gap-to-skill" missing from pipeline_template enum in system-state-schema.json

**Reported:** 2026-06-24
**Severity:** HIGH
**Source:** Internal audit of skills/schema/system-state-schema.json against planned pipeline templates

---

## Description

`skills/schema/system-state-schema.json` defines a `pipeline_template` enum field listing all valid pipeline identifiers. The enum currently contains 12 values (e.g., `"full-pipeline"`, `"insights-pipeline"`, `"insights-adaptation-pipeline"`) but does **not** include `"gap-to-skill"`.

FEATURE-004 creates a new `skills/pipelines/gap-to-skill.json` pipeline. Without adding `"gap-to-skill"` to the enum, any session state that uses this pipeline will fail JSON schema validation.

## Impact

- `gap-to-skill` pipeline sessions will be rejected by schema validation
- `scripts/validate-skills.sh` will fail for any session referencing the gap-to-skill pipeline
- The FEATURE-004 DoD cannot be met without this fix

## Affected File

- `skills/schema/system-state-schema.json` — `pipeline_template` enum (approximately line 42)

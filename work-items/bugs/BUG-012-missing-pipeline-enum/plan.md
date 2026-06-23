# BUG-012 — Plan: Add "gap-to-skill" to pipeline_template enum in system-state-schema.json

## Investigation

`skills/schema/system-state-schema.json` `pipeline_template` enum currently lists 12 values. The FEATURE-004 pipeline ID is `"gap-to-skill"` (as declared in `skills/pipelines/gap-to-skill.json` `pipeline_id` field). This value must be present in the enum before the pipeline can be used in validated session state.

Fix is a one-line addition to the `pipeline_template` enum in the JSON schema file.

## Remediation Plan

1. Open `skills/schema/system-state-schema.json`
2. Locate the `pipeline_template` enum array
3. Append `"gap-to-skill"` as the 13th enum value
4. Confirm JSON is still valid (well-formed)

This fix is part of the FEATURE-004 implementation DoD and is blocked on the schema file existing (which it does).

## Files Changed

- `skills/schema/system-state-schema.json`

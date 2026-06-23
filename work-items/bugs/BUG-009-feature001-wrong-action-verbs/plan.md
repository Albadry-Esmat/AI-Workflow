# BUG-009 — Plan: Fix "Create" → "Extend" in FEATURE-001 plan.md

## Investigation

Both skills confirmed to exist:
- `.opencode/skills/behavioral-telemetry-collector/SKILL.md` — v1.0.0, SKL-047
- `.opencode/skills/session-insights/SKILL.md` — v1.0.0, SKL-048

The FEATURE-001 plan's §3 and §4 describe *extension* work (adding a `capability_gap` event type to SKL-047; adding gap metrics to SKL-048 output) — not creation of new skill files. The word "Create" in the target skills table is incorrect.

Also: FEATURE-001 §5 says "Register SKL-047 and SKL-048 must be added to `skills/registry.json`" — but both are already registered. The note in §5 should be updated to say "Update their registry entries" (e.g., add `phase: 6`, `req_id: N16`).

## Remediation Plan

1. In `plan.md` lines 8–9: change `Action` column from `"Create"` → `"Extend"` for SKL-047 and SKL-048
2. Update the Notes column to reflect extension context: `"Extend existing skill — add capability_gap event type"` / `"Extend existing skill — add gap metrics output"`
3. In `plan.md` §5: change "SKL-047 and SKL-048 must be added" → "SKL-047 and SKL-048 registry entries must be updated" and list only the new fields (phase, req_id)

## Files Changed

- `work-items/features/FEATURE-001-capability-gap-detection/plan.md`

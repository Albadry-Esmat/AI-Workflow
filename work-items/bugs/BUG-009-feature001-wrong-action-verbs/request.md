# BUG-009 — Request: FEATURE-001 plan.md uses "Create" for skills that already exist

**Reported:** 2026-06-24
**Severity:** MEDIUM
**Source:** Internal audit of FEATURE-001 planning files

---

## Description

`work-items/features/FEATURE-001-capability-gap-detection/plan.md` (lines 8–9) lists SKL-047 (`behavioral-telemetry-collector`) and SKL-048 (`session-insights`) with the action verb **"Create"** in the target skills table.

Both skills already exist at:
- `.opencode/skills/behavioral-telemetry-collector/SKILL.md` (v1.0.0)
- `.opencode/skills/session-insights/SKILL.md` (v1.0.0)

Using "Create" is incorrect — the correct action is **"Extend"** (add the `capability_gap` event type to SKL-047 and add gap metrics to SKL-048 output).

## Impact

Anyone reading the FEATURE-001 plan would incorrectly attempt to create these skills from scratch, potentially overwriting the existing files or being confused when the skills already exist.

## Affected File

- `work-items/features/FEATURE-001-capability-gap-detection/plan.md` — lines 8–9

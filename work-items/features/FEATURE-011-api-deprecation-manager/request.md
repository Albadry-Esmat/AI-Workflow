# FEATURE-011 — Request: API Deprecation Manager

**Origin:** Identified during ASE-OS enhancement analysis (2026-06-24).

---

## Problem Statement

`api-versioning-architecture` (TASK-0029) designs the versioning strategy for APIs, but no skill tracks which API versions are currently live, when they were deprecated, or when they are scheduled for sunset. Breaking changes detected by `change-impact-analyzer` do not automatically trigger migration guidance for downstream consumers. API deprecations happen silently, breaking consumers without warning.

This means:
- No central registry of API version lifecycle state (current / deprecated / sunset)
- Consumers are not notified when an API they depend on is deprecated
- Migration guides must be written manually, inconsistently, and often late
- Sunset deadlines are tracked in spreadsheets or not at all
- `change-impact-analyzer` detects breaking changes but has no downstream workflow to act on them

## Requested Behaviour

When breaking API changes are detected or lifecycle operations are performed, `api-deprecation-manager` should:

1. Maintain a persistent **API registry** via `state-manager`: each entry tracks `api_id`, `version`, `status` (current / deprecated / sunset), registration date, deprecation date, planned sunset date, known consumers, and successor API ID
2. Support lifecycle operations: `register` (add new API), `deprecate` (set sunset date, create consumer work items), `sunset` (verify consumers migrated, mark retired), `query` (filter registry view), `migration-guide` (generate step-by-step guide from breaking changes)
3. Auto-generate **migration guides** from `change-impact-analyzer` breaking change output: before/after code examples per breaking change, ordered migration steps, effort estimate
4. Create **work item stubs** in the work-item system for each known consumer that must migrate before sunset
5. Detect **sunset violations**: APIs that have passed their sunset date but are still marked as active
6. Raise `breaking_change_without_deprecation` feedback to `change-impact-analyzer` when a breaking change is found for an API with no deprecation record

## Scope

- `.opencode/skills/api-deprecation-manager/SKILL.md` — new skill (SKL-071)
- `skills/registry.json` — register new skill
- `skills/index.yaml` — add index entry

## Out of Scope

- Automated API gateway configuration or runtime traffic switching
- Consumer code changes (migration is guided, not automated)
- GraphQL schema stitching or API composition
- Non-breaking change tracking (additive changes with no deprecation obligation)

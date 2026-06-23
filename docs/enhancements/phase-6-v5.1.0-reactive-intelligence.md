# Phase 6 — v5.1.0: Reactive Intelligence

**Version:** 1.0.0 | **Created:** 2026-06-23
**Target Release:** v5.1.0 | **Est. Duration:** 3–4 weeks
**Story Points:** 24 | **Features:** 5 (FEATURE-001 through FEATURE-005)
**Theme:** Close the capability gap loop — detect, create, register, retry

---

## Overview

Phase 6 adds a reactive intelligence layer to ASE-OS. When the orchestrator cannot route a user request to any existing skill, it now classifies the failure as a structured **capability gap**, logs it to telemetry, and presents a guided human-in-the-loop workflow to create a new skill that fills the gap — then automatically offers to retry the original request once the skill is registered.

This phase was scoped from the "Autonomous Skill Discovery, Validation, and Generation" feature proposal. The **fully-autonomous** creation path was rejected (HITL invariant non-negotiable). The following components were adopted:

| Adopted | Rejected |
|---|---|
| Structured gap detection + telemetry | Auto-register mode (violates HITL invariant) |
| Skill deduplication guard | External web search for best practices |
| Origin trace + approval tier metadata | Fully autonomous skill generation / execution |
| Gap-to-skill guided pipeline | Autonomous pipeline monitoring without human review |
| Gap retry execution | Batch gap processing |

---

## Features

### Phase 6 Work Items

| ID | Title | Points | Priority | req_id | Blocks |
|----|-------|--------|----------|--------|--------|
| [FEATURE-001](../../work-items/features/FEATURE-001-capability-gap-detection/) | Capability Gap Detection + Telemetry | 5 | High | [N16] | FEATURE-004, FEATURE-005 |
| [FEATURE-002](../../work-items/features/FEATURE-002-skill-deduplication-check/) | Skill Deduplication Check in skill-authoring | 5 | High | [N17] | FEATURE-004 |
| [FEATURE-003](../../work-items/features/FEATURE-003-skill-origin-trace-metadata/) | Skill Origin Trace + Approval Tier Metadata | 3 | Medium | [N18] | FEATURE-004 |
| [FEATURE-004](../../work-items/features/FEATURE-004-gap-to-skill-pipeline/) | Gap-to-Skill Reactive Pipeline | 8 | High | [N19] | FEATURE-005 |
| [FEATURE-005](../../work-items/features/FEATURE-005-gap-retry-execution/) | Gap Retry Execution | 3 | Medium | [N20] | — |
| **Total** | | **24 SP** | | | |

---

## New Skills Introduced

| Skill ID | Name | Purpose |
|---|---|---|
| SKL-047 | `behavioral-telemetry-collector` | Collect and persist structured telemetry events (capability_gap, skill_error, etc.) |
| SKL-048 | `session-insights` (extended) | End-of-session summary including gap metrics and gap_id list |
| SKL-049 | `gap-to-skill-pipeline` | Reactive pipeline — converts a logged gap into a registered skill with HITL approval |

> **Note:** SKL-047 and SKL-048 were originally defined in v2.7.0/v2.8.0. Phase 6 extends them. The `behavioral-telemetry-collector` gains the `capability_gap` event type; `session-insights` gains gap metrics output. SKL-049 is a new skill.

---

## Artifacts Modified

| Artifact | Change |
|---|---|
| `orchestrator/SKILL.md` | Gap detection block (FEATURE-001) + retry execution block (FEATURE-005) |
| `skill-authoring/SKILL.md` | Step 0 dedup guard (FEATURE-002) + `gap_seed` mode + `origin_metadata` at Step 5 (FEATURE-003) + `gap_seed` input mode (FEATURE-004) |
| `skills/schema/system-state-schema.json` | `gap_context` object (FEATURE-001) + `retry_context` object (FEATURE-005) |
| `skills/schema/registry-entry.schema.json` | `origin_metadata` object (FEATURE-003) |
| `skills/schema/dedup-check-result.schema.json` | New schema (FEATURE-002) |
| `skills/pipelines/gap-to-skill.json` | New pipeline template (FEATURE-004) |
| `skills/registry.json` | Register SKL-049 (FEATURE-004) |
| `docs/governance.md` | §5.1 Skill Approval Tiers (FEATURE-003) |
| `scripts/validate-skills.sh` | Warning for missing `origin_metadata` on pre-v5.1.0 skills (FEATURE-003) |

---

## Dependency Graph

```
FEATURE-001 (gap detection)
      │
      ├──────────────────────────────────────── FEATURE-004 (gap-to-skill pipeline)
      │                                               │
FEATURE-002 (dedup check) ─────────────────────► FEATURE-004
      │                                               │
FEATURE-003 (origin metadata) ──────────────────► FEATURE-004
                                                       │
                                                  FEATURE-005 (gap retry)
                                                       │
                                              (loop closes to FEATURE-001)
```

**Critical path:** FEATURE-001 → FEATURE-002 → FEATURE-003 → FEATURE-004 → FEATURE-005

FEATURE-001, FEATURE-002, and FEATURE-003 are independent of each other and can be implemented in parallel.

---

## Recursion Safety

Phase 6 introduces two session-state flags that together prevent any infinite loop through the reactive intelligence cycle:

| Flag | Set by | Guards against |
|---|---|---|
| `gap_to_skill_active` | FEATURE-004 at pipeline start | Nested gap-to-skill invocations |
| `retry_in_progress` | FEATURE-005 at retry start | A failed retry emitting another capability_gap |

Both flags are cleared on pipeline exit (success, rejection, or error).

---

## DoD Gate (Phase 6 Completion)

- [ ] All 5 FEATURE items completed (status.md `lifecycle_state: completed`)
- [ ] SKL-047 extended with `capability_gap` event type
- [ ] SKL-048 extended with gap metrics in session summary
- [ ] SKL-049 (`gap-to-skill-pipeline`) created and registered
- [ ] `skills/pipelines/gap-to-skill.json` created and validates against `pipeline-schema.json`
- [ ] `skill-authoring/SKILL.md` has `gap_seed` mode + Step 0 dedup guard + `origin_metadata` at Step 5
- [ ] `orchestrator/SKILL.md` has gap detection block + retry execution block + both recursion guards
- [ ] `docs/governance.md` §5.1 Skill Approval Tiers present
- [ ] `scripts/validate-skills.sh` exits 0 (origin_metadata missing → WARN, not ERROR, for pre-v5.1.0 skills)
- [ ] `docs/changelog.md` Phase 6 block written
- [ ] `docs/enhancements/README.md` updated with Phase 6 milestone row
- [ ] `work-items/indexes/features.md` updated with FEATURE-001–005 rows

---

## Risk Register

| Risk | Impact | Mitigation |
|---|---|---|
| Gap-to-skill recursion loop | HIGH | Two recursion guards (`gap_to_skill_active` + `retry_in_progress`) — see §Recursion Safety |
| `skill-authoring` `gap_seed` mode scope creep | MEDIUM | `gap_seed` mode ONLY adds pre-population; all existing modes (`create`, `refactor`, `split`, `validate`) unchanged |
| Dedup threshold false positives (0.75 too aggressive) | LOW | Threshold is a constant — can be tuned; user always has Option B (override) |
| `validate-skills.sh` backward compat breaking on `origin_metadata` | MEDIUM | Guard: warn-only rule for pre-v5.1.0 skills explicitly implemented in FEATURE-003 |

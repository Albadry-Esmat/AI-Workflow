# Phase 3 — v2.0.0: Bidirectional Sync & Metadata Completeness

**Version target:** v2.0.0
**Story points:** 16
**Tasks:** TASK-0047, TASK-0048

## Goals

Deliver the two larger, lower-urgency improvements: full bidirectional Jira sync (closing the
loop on TASK-0036) and origin metadata completeness for all 101 skills (permanently removing the
WARN from `validate-skills.sh`). The bidirectional sync is a MAJOR version bump to
`work-item-exporter` and requires Phase 2 to ship first.

---

## Tasks

| ID | Title | Points | Status |
|----|-------|--------|--------|
| TASK-0047 | `work-item-exporter` v2.0.0: bidirectional Jira sync (import direction) | 13 | pending |
| TASK-0048 | Origin metadata batch backfill: add stubs to 58 pre-v5.1.0 skills | 3 | pending |

---

## Dependency Graph

```
TASK-0045 (Phase 2) ──► TASK-0047  (Epic mapping required for import direction)
TASK-0048            ──► (independent; no downstream)
```

---

## Delivery

TASK-0048 is independent — it can ship at any point (even before Phase 1 if desired). It's
placed in Phase 3 purely due to low urgency.

TASK-0047 is the largest item in the roadmap (13 SP). It should be scoped as its own sprint with
dedicated design review before implementation begins.

**Version bumps:**
- `work-item-exporter`: `1.1.0` → `2.0.0` (MAJOR: new `direction` field, new input schema)
- No SKILL.md changes for TASK-0048 (registry.json only)

---

## Risks

| Risk | Impact | Mitigation |
|------|--------|-----------|
| `direction: "export"` backward compatibility breaks | critical | Default `direction = "export"`; all existing callers unaffected |
| Duplicate folder creation on Jira re-import | high | State-based `imported_external_ids[]` dedup (per TASK-0036 design) |
| Jira API rate limits during bulk import | medium | Import is offline (payload-based), not live API — no rate limit risk |
| Origin metadata backfill corrupts registry format | low | Script does `if (!skill.origin_metadata)` check; write verified by `validate-skills.sh` |

---

## Notes

- TASK-0047 supersedes TASK-0036 (bidirectional Jira sync). TASK-0036 remains in backlog as
  historical context. Once TASK-0047 ships, TASK-0036 can be marked `closed`.
- After Phase 3 ships, the full WIM lifecycle is complete: plan → materialize folders (Step 7c)
  → export to Jira (v1.1.0) → import from Jira (v2.0.0).

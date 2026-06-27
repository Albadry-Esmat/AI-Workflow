# Phase 2 — v1.2.0: Export Evolution & Governance

**Version target:** v1.2.0
**Story points:** 13
**Tasks:** TASK-0045, TASK-0027, TASK-0046

## Goals

Complete the WIM→Jira work item hierarchy by adding FEATURE→Epic export mapping, enforce
quality gates on skill registration, and add docs link-checking to CI. These are medium-effort
improvements that each deliver self-contained, high-value improvements to the framework.

---

## Tasks

| ID | Title | Points | Status |
|----|-------|--------|--------|
| TASK-0045 | `work-item-exporter` v1.1.0: FEATURE → Jira Epic mapping | 5 | pending |
| TASK-0027 | `skill-authoring` quality-scoring gate (existing backlog item) | 5 | open |
| TASK-0046 | CI: `docs/` broken-link check on `docs/**` changes | 3 | pending |

---

## Dependency Graph

```
TASK-0038 (Phase 1) ──► TASK-0045  (file_path fix required for Epic export)
TASK-0045            ──► TASK-0047  (Phase 3 bidirectional sync)
TASK-0027            ──► (no downstream)
TASK-0046            ──► (no downstream)
```

---

## Delivery

Three independent commits (TASK-0045, TASK-0027, TASK-0046 can be done in any order after TASK-0038).

**Version bumps:**
- `work-item-exporter`: `1.0.0` → `1.1.0` (TASK-0045)
- `skill-authoring`: current → MINOR bump (TASK-0027)
- No skill version change for TASK-0046 (CI-only change)

---

## Risks

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Jira Epic `customfield_*` name differs per Jira instance | medium | Document as configurable; use `epic_name` as generic fallback |
| Quality gate blocks legitimate skill additions during an incident | low | `bypass_quality_gate: true` with mandatory human approval entry |
| Existing docs have broken relative links | medium | Run `markdown-link-check` locally before enabling CI job |

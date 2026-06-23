# ADR-0001: Work Lifecycle Persistence Model — File-Based Markdown

**Date:** 2026-06-22
**Status:** Accepted
**Supersedes:** N/A

---

## Context

The Work Lifecycle Management Layer requires work items (BUG, TASK, CR, FIX, REVIEW, TEST, VALIDATION, DOC, etc.) to persist beyond a single pipeline session. The existing state model (`system-state-schema.json`) is session-scoped and capped at 512KB — a flat in-state store of fully detailed work items would exceed this limit for any non-trivial project (200 implementation tasks + companions + defects = ~880 items × 1.35KB = ~1.13MB, far exceeding the 512KB cap).

A persistence mechanism must be chosen that:
1. Survives pipeline session boundaries (cross-session persistence)
2. Is human-readable and inspectable without tooling
3. Is compatible with the existing file-system-based project structure
4. Does not require a running database service or external dependency
5. Works within the 512KB state-manager constraint

---

## Decision

**File-based Markdown (`.md`) persistence with in-state compressed index.**

- Each work item is stored as an individual Markdown file at `work-items/{TYPE}-{NNNN}.md`
- The system state (`work_items` scope) holds only a **compressed index** of each item: `{ id, type, status, lifecycle_state, parent_id, file_path }` (~120 bytes per item)
- Full details (description, acceptance criteria, audit trail, linked items, Jira-compatible fields) live in the `.md` file
- Skills read the index from state for routing and lifecycle decisions; they read the full `.md` file only when detailed content is needed
- Skills write state transitions to both the in-state index (status update) and the `.md` file (audit trail append)

---

## Alternatives Considered

### Option A: File-Based Markdown (Chosen ✓)

**Description:** Each work item is a `.md` file in `work-items/`. The state holds a compressed index. Full detail is in files.

**Pros:**
- No external dependency — works entirely with the existing file system
- Human-readable: engineers can inspect, edit, and version-control work items directly
- Git-trackable: work item history is captured in git diff
- Survives session boundaries naturally (files persist between pipeline runs)
- In-state footprint: 880 items × 120B = ~103KB (20% of 512KB budget) — well within limits
- Compatible with the existing doc-maintainer pattern (skill writes `.md` files)
- Jira-compatible fields can be included directly in the Markdown front matter

**Cons:**
- No query engine — reading all items requires file I/O across up to 880 files
- No ACID guarantees — a crash mid-write could leave a file in a partial state (mitigated by atomic write pattern)
- Sorting and filtering requires loading and parsing multiple files

---

### Option B: SQLite Database

**Description:** A local `work-items.db` SQLite file holds all work items and supports SQL queries.

**Pros:**
- Rich query capabilities (JOIN, filter, sort)
- ACID transactions — no partial writes
- Compact binary format — 880 items ≈ 300KB on disk

**Cons:**
- Requires a SQLite driver or tooling at runtime — adds dependency
- Not human-readable without a DB viewer
- Not git-diffable in a meaningful way
- Inconsistent with the project's file-based, AI-readable artifact model
- Binary file creates merge conflicts in git

---

### Option C: External Store (Linear, Jira, GitHub Issues)

**Description:** Work items are created directly in an external work management platform via API, with no local persistence.

**Pros:**
- Zero local storage cost
- Native platform features (notifications, assignments, sprints)

**Cons:**
- Requires API credentials and network access at pipeline runtime
- Creates external dependency that can fail or change API contracts
- Cannot operate offline or in CI environments without credentials
- Circular dependency: export IS a pipeline output — using external store as the primary store conflates source and export
- Bidirectional sync would be required to read back from external platform

---

### Option D: Full In-State Storage

**Description:** All work item details stored inside the `work_items` scope in system state JSON.

**Pros:**
- Single source of truth — no file I/O beyond state writes

**Cons:**
- 880 items × 1,350B = ~1.16MB — exceeds 512KB state limit by 2.3×
- State manager would reject writes, halting the pipeline
- Not human-readable (nested JSON state file)

---

## Consequences

### Positive
- State constraint respected: 103KB in-state footprint (20% of 512KB)
- Human-readable: work items are `.md` files reviewable in any editor or git diff
- Cross-session persistence without a database service
- Git-trackable: work item history visible in `git log work-items/`
- Compatible with existing doc-maintainer pattern (skill already writes `.md` files)
- Jira-compatible front matter can be added directly (supports U5 decision: match Jira schema)
- Atomic write pattern (write temp file, rename) mitigates partial-write risk

### Negative
- No native query engine: skills needing to filter/sort work items must load and parse files
- File I/O overhead for large item sets (mitigated by in-state index for common operations)
- Partial write risk during crash (mitigated by atomic write + state-manager snapshot before write)

### Neutral
- `work-items/` directory is a new top-level project artifact (alongside `docs/`, `.opencode/`, `skills/`)
- The compressed in-state index becomes the source of truth for routing decisions; `.md` files are the source of truth for content
- Session state initializes `work_items.items[]` from the index at session start (cold load)

---

## File Structure

```
work-items/
├── index.md                  ← human-readable summary table (auto-generated)
├── BUG-0001.md
├── FIX-0001.md
├── INVESTIGATION-0001.md
├── TASK-0001.md
├── REVIEW-0001.md
├── TEST-0001.md
├── VALIDATION-0001.md
├── CR-0001.md
└── RELEASE-0001.md
```

Each `.md` file follows this structure:

```markdown
---
id: BUG-0001
type: BUG
title: "Login fails on expired token"
status: fixing
lifecycle_state: fixing
priority: high
severity: high
created_at: 2026-06-22T10:00:00Z
updated_at: 2026-06-22T14:30:00Z
created_by_skill: defect-manager
parent_id: null
linked_items:
  - target_id: TASK-0042
    link_type: causes
    direction: inbound
  - target_id: FIX-0001
    link_type: fixes
    direction: outbound
jira_issue_type: Bug
jira_priority: High
jira_labels: [auth, backend]
---

## Description

Login endpoint throws 401 on all requests when JWT token is 1 second past expiry,
instead of returning a structured TokenExpiredError with a refresh token suggestion.

## Steps to Reproduce

1. Authenticate and receive JWT
2. Wait for token to expire
3. Make any authenticated API call

## Root Cause

`verifyToken()` calls `jwt.verify()` without catching `TokenExpiredError` separately —
all errors are mapped to generic 401.

## Acceptance Criteria

- [ ] Expired token returns `{ error: "TOKEN_EXPIRED", canRefresh: true }` with 401
- [ ] Fresh token returns normal response
- [ ] Regression test covers both paths

## Audit Trail

| Timestamp | Actor | From State | To State | Reason |
|-----------|-------|------------|----------|--------|
| 2026-06-22T10:00:00Z | defect-manager | — | reported | Defect intake |
| 2026-06-22T10:05:00Z | orchestrator (HITL) | reported | triaged | Human confirmed priority=high |
| 2026-06-22T10:10:00Z | defect-manager | triaged | investigating | Chain generated |
| 2026-06-22T14:30:00Z | code-repair | investigating | fixing | FIX-0001 in progress |
```

---

## Related Skills

- `state-manager` (SKL-020) — reads/writes the in-state compressed index
- `defect-manager` (SKL-055) — primary writer of BUG/FIX/INVESTIGATION items
- `feature-planning` (SKL-003) v2.0.0 — writer of TASK/REVIEW/TEST/VALIDATION/DOC items
- `change-request-manager` (SKL-056) — writer of CR items
- `work-item-exporter` (SKL-057) — reads `.md` files to produce export payloads
- `work-item-lifecycle-guard` (SKL-058) — validates state transitions before writes
- `doc-maintainer` (SKL-011) — may reference work items in generated docs

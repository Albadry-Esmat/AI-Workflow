# Work Item Foundation — Taxonomy, Schema & Lifecycle State Machine

**Version:** 1.0.0 | **Last updated:** 2026-06-22
**Status:** Active — Phase 1 Foundation Design
**Produced by:** Phase 1 of the Work Lifecycle Management Layer implementation plan

---

## 1. Work Item Type Taxonomy

All work items follow the `TYPE-NNNN` pattern (e.g., `BUG-0001`, `TASK-0042`).

| Type | ID Pattern | Producer Skill | Domain | Description |
|------|-----------|---------------|--------|-------------|
| `TASK` | `TASK-NNNN` | `feature-planning` v2.0.0 | Implementation | An atomic implementation unit of work |
| `REVIEW` | `REVIEW-NNNN` | `feature-planning` v2.0.0 (companion) | Quality | Code review task for a corresponding TASK |
| `TEST` | `TEST-NNNN` | `feature-planning` v2.0.0 (companion) | Quality | Test authoring task for a corresponding TASK |
| `VALIDATION` | `VALIDATION-NNNN` | `feature-planning` v2.0.0 (companion) | Quality | End-to-end validation task for a corresponding TASK |
| `DOC` | `DOC-NNNN` | `feature-planning` v2.0.0 (companion, optional) | Documentation | Documentation update task for a corresponding TASK |
| `BUG` | `BUG-NNNN` | `defect-manager` | Defect | A defect record with full reproduction and root cause |
| `INVESTIGATION` | `INVESTIGATION-NNNN` | `defect-manager` (chain) | Defect | Root cause investigation task for a BUG |
| `FIX` | `FIX-NNNN` | `defect-manager` (chain) | Defect | Implementation fix task for a BUG, executed by code-repair |
| `CLOSURE` | `CLOSURE-NNNN` | `defect-manager` (chain) | Defect | Human closure approval task for a resolved BUG |
| `CR` | `CR-NNNN` | `change-request-manager` | Change | A change request with impact analysis and task delta |

### ID Sequence Rules

- Each type has its own independent sequence (BUG-0001 and TASK-0001 can coexist)
- Sequences are tracked in the in-state index: `work_items.sequences.{TYPE}` = last assigned number
- IDs are zero-padded to 4 digits (0001–9999). If a type exceeds 9999, emit warning and continue with 5-digit IDs
- Companion IDs **share the same number as their parent** for traceability: TASK-0042 → REVIEW-0042, TEST-0042, VALIDATION-0042, DOC-0042
- Defect chain IDs use the **BUG number as a namespace**: BUG-0001 → FIX-0001, INVESTIGATION-0001, CLOSURE-0001

---

## 2. Jira-Compatible Base Schema

All work item types share the base schema below. Type-specific extensions are defined in Section 3.

### Base Schema (Markdown Front Matter + Body)

```yaml
---
# === IDENTITY ===
id: TYPE-NNNN                          # Required. Unique across all items.
type: TASK | REVIEW | TEST | VALIDATION | DOC | BUG | INVESTIGATION | FIX | CLOSURE | CR
title: "Short descriptive title"        # Required. Max 255 chars (Jira summary limit).
status: open                            # Required. See lifecycle states per type below.
lifecycle_state: open                   # Required. Fine-grained state within status.
priority: critical | high | medium | low   # Required.
severity: critical | high | medium | low | info   # Optional. Populated for BUG types.

# === TRACEABILITY ===
parent_id: TYPE-NNNN | null             # Parent work item ID (for chain items).
req_ids: [REQ-001, REQ-002]             # Linked requirement IDs.
module: "module-name"                   # Owning architecture module.

# === LIFECYCLE ===
created_at: 2026-06-22T10:00:00Z       # ISO 8601. Set on creation, never updated.
updated_at: 2026-06-22T14:30:00Z       # ISO 8601. Updated on every state change.
created_by_skill: defect-manager        # Skill that created this item.
last_updated_by_skill: code-repair      # Skill that last modified this item.

# === LINKED ITEMS ===
linked_items:
  - target_id: TASK-0042
    link_type: causes | blocks | tests | reviews | fixes | supersedes | child_of | validates | fulfills
    direction: inbound | outbound

# === JIRA EXPORT FIELDS ===
jira_issue_type: Bug | Task | Sub-task | Story | Epic | Change Request
jira_priority: Highest | High | Medium | Low | Lowest
jira_labels: [auth, backend, generated-by:defect-manager, req:REQ-001, severity:high]
jira_components: []
jira_story_points: null
jira_epic_link: null
---

## Description

{Full description of the work item. For BUGs: includes repro steps, expected vs actual behavior.}

## Acceptance Criteria

- [ ] Criterion 1
- [ ] Criterion 2

## Definition of Done

- [ ] Code written and reviewed
- [ ] Tests passing
- [ ] Documentation updated

## Audit Trail

| Timestamp | Actor Skill | From State | To State | Reason |
|-----------|-------------|------------|----------|--------|
| 2026-06-22T10:00:00Z | defect-manager | — | reported | Defect intake |
```

### Jira Priority Mapping

| Internal Priority | Jira Priority |
|-------------------|--------------|
| `critical` | `Highest` |
| `high` | `High` |
| `medium` | `Medium` |
| `low` | `Low` |

### Jira Issue Type Mapping

| Internal Type | Jira Issue Type |
|--------------|----------------|
| `BUG` | `Bug` |
| `TASK` | `Task` |
| `REVIEW` | `Task` (sub-task of TASK parent) |
| `TEST` | `Task` (sub-task of TASK parent) |
| `VALIDATION` | `Task` (sub-task of TASK parent) |
| `DOC` | `Task` (sub-task of TASK parent) |
| `FIX` | `Sub-task` (parent: BUG) |
| `INVESTIGATION` | `Sub-task` (parent: BUG) |
| `CLOSURE` | `Sub-task` (parent: BUG) |
| `CR` | `Change Request` (custom type) or `Epic` |

---

## 3. Type-Specific Schema Extensions

### BUG Extension Fields

```yaml
# Added to front matter for BUG type only:
steps_to_reproduce:
  - "Step 1"
  - "Step 2"
expected_behavior: "What should happen"
actual_behavior: "What actually happens"
root_cause: "Root cause identified during investigation (null until INVESTIGATION completes)"
environment: "production | staging | local"
affected_version: "1.2.3"
regression: false
detected_by: "test-generator | security-review | human | code-repair"
```

### CR Extension Fields

```yaml
# Added to front matter for CR type only:
change_scope: requirement | architecture | implementation | all
affected_requirements: [REQ-001, REQ-002]
affected_modules: [auth-module, api-gateway]
affected_tasks: [TASK-0010, TASK-0011]
task_delta:
  new_tasks: []
  modified_tasks: []
  cancelled_tasks: []
impact_summary: "High impact: 2 modules, 5 tasks affected"
approval_status: pending | approved | rejected
approved_by_hitl: false
```

---

## 4. Lifecycle State Machine

### 4.1 Universal States (All Types)

All types share these meta-states for coarse filtering:

| Status | Meaning |
|--------|---------|
| `open` | Created but not yet started |
| `in_progress` | Actively being worked on |
| `review` | Pending human or skill review |
| `done` | Work complete, pending closure |
| `closed` | Fully closed — terminal state |
| `cancelled` | Cancelled — terminal state |
| `blocked` | Cannot proceed, dependency unresolved |

### 4.2 TASK / REVIEW / TEST / VALIDATION / DOC Lifecycle

```
draft
  └──▶ ready
         └──▶ in_progress
                  ├──▶ blocked ──▶ in_progress
                  └──▶ review
                           └──▶ done
                                  └──▶ closed
                                  └──▶ reopened ──▶ in_progress
```

| From → To | Allowed? | Triggered By |
|-----------|---------|--------------|
| draft → ready | ✓ | feature-planning (on companion generation) |
| ready → in_progress | ✓ | orchestrator (skill assignment) |
| in_progress → blocked | ✓ | Any skill (dependency unresolved) |
| blocked → in_progress | ✓ | orchestrator (dependency resolved) |
| in_progress → review | ✓ | builder (code-generator / code-repair completes) |
| review → done | ✓ | reviewer (clean-code-review passes) |
| done → closed | ✓ | orchestrator (pipeline phase complete) |
| done → reopened | ✓ | defect-manager (regression found) |
| reopened → in_progress | ✓ | orchestrator |
| Any → cancelled | ✓ | change-request-manager (CR cancels task) |

### 4.3 BUG Lifecycle

```
reported
  └──▶ triaged (HITL gate: priority confirmation)
         └──▶ investigating
                  ├──▶ blocked (dependency unresolved)
                  │         └──▶ investigating (dependency resolved)
                  └──▶ fixing
                           └──▶ testing (regression tests)
                                    └──▶ reviewing (fix review)
                                             └──▶ validated
                                                      └──▶ closed (HITL gate)
```

| From → To | Allowed? | Triggered By |
|-----------|---------|--------------|
| reported → triaged | ✓ | HITL gate (human confirms priority + severity) |
| triaged → investigating | ✓ | defect-manager (generates chain) |
| investigating → blocked | ✓ | Any skill (dependency unresolved) |
| blocked → investigating | ✓ | orchestrator (dependency resolved) |
| investigating → fixing | ✓ | defect-manager (INVESTIGATION-NNNN done) |
| fixing → testing | ✓ | code-repair (FIX-NNNN done) |
| testing → reviewing | ✓ | test-generator (regression tests pass) |
| reviewing → validated | ✓ | clean-code-review (REVIEW-NNNN passes) |
| validated → closed | ✓ | HITL gate (human approves closure) |
| Any → reported | ✗ | Cannot reopen to initial state — create new BUG |

**Auto-FIX rule (U3 decision: all bugs and missings):**
- ALL bugs (severity: any) trigger the full defect chain: INVESTIGATION + FIX + TEST + REVIEW + VALIDATION + CLOSURE
- Security findings from security-review also trigger the chain (treated as BUG with source=security-review)
- "Missings" (incomplete implementations from implementation-completeness-auditor) trigger FIX + TEST + VALIDATION only (no INVESTIGATION, since root cause is known: requirement not implemented)

### 4.4 CR Lifecycle

```
submitted
  └──▶ impact_analysis (change-impact-analyzer runs)
         └──▶ approved (HITL gate: human reviews impact summary)
                  └──▶ planning (feature-planning re-invoked with task delta)
                           └──▶ execution
                                    └──▶ validation
                                             └──▶ closed
```

| From → To | Allowed? | Triggered By |
|-----------|---------|--------------|
| submitted → impact_analysis | ✓ | change-request-manager (auto-triggers change-impact-analyzer) |
| impact_analysis → approved | ✓ | HITL gate (human approves scope of change) |
| approved → planning | ✓ | orchestrator (invokes feature-planning with delta) |
| planning → execution | ✓ | orchestrator (tasks generated from delta) |
| execution → validation | ✓ | implementation-completeness-auditor |
| validation → closed | ✓ | HITL gate (human confirms scope delivered) |
| Any → rejected | ✓ | HITL gate (human rejects CR) → terminal state |

### 4.5 Invalid Transition Rules

The `work-item-lifecycle-guard` (SKL-058) enforces these rules:
- A `closed` or `cancelled` item CANNOT be transitioned to any other state
- A `BUG` CANNOT skip from `reported` directly to `closed` (must pass triage gate)
- A `TASK` CANNOT skip from `draft` directly to `done` (must pass through `in_progress`)
- A `CR` CANNOT move from `submitted` to `approved` without going through `impact_analysis`
- State transitions MUST be recorded in the audit trail (timestamp, actor_skill, from_state, to_state, reason)

---

## 5. In-State Compressed Index Schema

The `work_items` scope in system state holds compressed references only. Full details live in `work-items/{TYPE}-{NNNN}.md`.

```json
{
  "work_items": {
    "items": [
      {
        "id": "BUG-0001",
        "type": "BUG",
        "title": "Login fails on expired token",
        "status": "in_progress",
        "lifecycle_state": "fixing",
        "priority": "high",
        "severity": "high",
        "parent_id": null,
        "file_path": "work-items/BUG-0001.md",
        "created_at": "2026-06-22T10:00:00Z",
        "updated_at": "2026-06-22T14:30:00Z"
      }
    ],
    "sequences": {
      "TASK": 42,
      "BUG": 1,
      "FIX": 1,
      "CR": 0
    },
    "type_counts": {
      "TASK": 42,
      "REVIEW": 42,
      "TEST": 42,
      "VALIDATION": 42,
      "BUG": 1,
      "FIX": 1
    },
    "last_updated": "2026-06-22T14:30:00Z"
  }
}
```

**Size validation (confirmed in Phase 0):**
- 880 items × 120 bytes = 103KB (20.1% of 512KB budget) ✓
- Full detail in `.md` files: 880 × 1.35KB = 1.13MB (outside state, no limit)

---

## 6. Traceability Link Types

| Link Type | Meaning | Example |
|-----------|---------|---------|
| `fulfills` | This item implements a requirement | TASK-0001 fulfills REQ-001 |
| `blocks` | This item must complete before the target | TASK-0001 blocks TASK-0002 |
| `tests` | This item tests the target | TEST-0001 tests TASK-0001 |
| `reviews` | This item reviews the target | REVIEW-0001 reviews TASK-0001 |
| `fixes` | This item fixes the target bug | FIX-0001 fixes BUG-0001 |
| `causes` | This item caused the target defect | TASK-0042 causes BUG-0001 |
| `supersedes` | This item replaces the target | CR-0001 supersedes TASK-0010 |
| `child_of` | This item is a sub-task of the target | FIX-0001 child_of BUG-0001 |
| `validates` | This item validates the target | VALIDATION-0001 validates TASK-0001 |

---

## 7. Companion Generation Pattern (Feature-Planning v2.0.0)

When `companion_generation.enabled: true`, every TASK-NNNN generates:

```
TASK-0042
├── REVIEW-0042   (link: reviews TASK-0042)
├── TEST-0042     (link: tests TASK-0042)
├── VALIDATION-0042 (link: validates TASK-0042)
└── DOC-0042      (optional, link: documents TASK-0042)
```

Companion ID rule: companions share the TASK number. This makes the relationship instantly readable.

Sequencing: companion tasks are created `draft` → `ready` after TASK moves to `in_progress` → after TASK moves to `review`.

---

## 8. Defect Chain Pattern (Defect-Manager)

For every BUG-NNNN, the defect-manager generates:

```
BUG-0001 (reported)
├── INVESTIGATION-0001 (child_of BUG-0001; investigates root cause)
├── FIX-0001           (child_of BUG-0001; executed by code-repair)
├── TEST-0001          (child_of BUG-0001; regression test by test-generator)
├── REVIEW-0001        (child_of BUG-0001; fix review by clean-code-review)
├── VALIDATION-0001    (child_of BUG-0001; end-to-end validation by tester)
└── CLOSURE-0001       (child_of BUG-0001; human HITL closure gate)
```

Note: REVIEW-0001 from a BUG chain is **distinct** from REVIEW-0001 as a companion to TASK-0001. The sequences are independent per type.

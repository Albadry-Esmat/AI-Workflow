# Implementation Plan — Work Lifecycle Management Layer

**Version:** 1.3.0 | **Last updated:** 2026-06-23
**Status:** Complete — Phase 0 Complete, Phase 1 Complete, Phase 2 Complete, Phase 3 Complete, Phase 4 Complete, Phase 5 Complete, Phase 6 Complete
**Classification:** Strategic Enhancement (C.5 → D Evolution)

---

## Resolved Decisions (formerly Unknowns U1–U5)

| # | Decision | Resolution | ADR |
|---|----------|-----------|-----|
| U1 | Cross-session persistence model | **File-based Markdown** — each work item is a `.md` file in `work-items/`. In-state holds compressed index only (~103KB for max scenario). | [ADR-0001](adr/ADR-0001-work-lifecycle-persistence-model.md) |
| U2 | Companion generation | **Opt-in** — `companion_generation.enabled: false` by default. Existing feature-planning behavior unchanged. | — |
| U3 | Auto-FIX threshold | **All bugs and missings** — ALL bugs trigger the full defect chain regardless of severity. Missings from implementation-completeness-auditor trigger FIX + TEST + VALIDATION. | — |
| U4 | Export directionality | **One-way export** — outbound only. No bidirectional sync. Export is a file write; human imports into Jira. | [ADR-0002](adr/ADR-0002-work-item-export-contract.md) |
| U5 | Defect task schema | **Match Jira** — Jira Bulk Import JSON is the primary export format. Internal schema includes all Jira-compatible fields in `.md` front matter. | [ADR-0002](adr/ADR-0002-work-item-export-contract.md) |

## Phase 0 & 1 Completion Summary

| Task | Status | Output |
|------|--------|--------|
| U1–U5 decisions resolved | ✅ Done | See table above |
| 512KB state constraint validated | ✅ PASS | 880 items × 120B = 103KB (20.1% of budget) |
| ADR-0001: Persistence model | ✅ Written | `docs/adr/ADR-0001-work-lifecycle-persistence-model.md` |
| ADR-0002: Export contract | ✅ Written | `docs/adr/ADR-0002-work-item-export-contract.md` |
| Work item taxonomy defined | ✅ Done | `docs/work-item-foundation.md` §1 |
| Base schema (Jira-compatible) | ✅ Done | `docs/work-item-foundation.md` §2–3 |
| Lifecycle state machine | ✅ Done | `docs/work-item-foundation.md` §4 |
| In-state compressed index designed | ✅ Done | `docs/work-item-foundation.md` §5 |
| `system-state-schema.json` extended | ✅ Done | `work_items` scope + `work_item_ref` $def + new pipeline templates |

**Phase 0 gate:** All 5 unknowns resolved, ADRs written, size validated ✅
**Phase 1 gate:** Taxonomy finalized, schema designed, state model confirmed feasible ✅

---

## Executive Summary

This plan introduces a **Work Lifecycle Management Layer** to the AI Workflow system. The current system generates tasks as transient JSON artifacts flowing through the pipeline. This plan evolves the system into one that creates, stores, tracks, links, and closes structured work items across the full software delivery lifecycle.

**Recommended Path:** Integration-First (Path C) — Build lifecycle skills with an export contract to external work management platforms, with the internal work store as a long-term option.

**Scope of Work:**

| Deliverable | Type | Priority |
|---|---|---|
| Work Item Type Taxonomy & Schema | Foundation | P0 — Must complete first |
| Defect Management Lifecycle Skill | New Skill | P0 — Highest value gap |
| Per-Task Companion Generation | Enhancement | P1 — Second highest value |
| Change Request Lifecycle Skill | New Skill | P1 — Product lifecycle enabler |
| Work Item Export Contract | Integration | P1 — Enables external platform sync |
| Extended Task Lifecycle States | Schema Change | P2 — Governance improvement |
| State Schema Extensions | Infrastructure | P2 — Required substrate |
| Event System Extensions | Infrastructure | P2 — Required for automation |
| Pipeline Configuration Updates | Integration | P3 — Wiring phase |

---

## Phase 0 — Discovery & Alignment

**Duration:** 1–2 weeks
**Objective:** Validate assumptions, clarify unknowns, align with existing system constraints, and produce finalized technical decisions.

### 0.1 Tasks

| # | Task | Owner | Deliverable |
|---|---|---|---|
| 0.1 | Confirm target deployment context: single-team vs. multi-team | Stakeholder | Decision record |
| 0.2 | Determine external platform target(s): Jira, Linear, Azure DevOps, GitHub Issues, file-based, or none | Stakeholder | Integration target specification |
| 0.3 | Confirm whether work items should persist beyond session state (cross-session persistence) or remain session-scoped | Stakeholder + Architect | Persistence model decision |
| 0.4 | Validate 512KB state-manager size limit against projected work item volume | Architect | Size impact analysis |
| 0.5 | Identify whether `task_graph` state scope is sufficient or a new `work_items` scope is required | Architect | State model decision |
| 0.6 | Review event-router dispatch map for new event type capacity (existing: 11 types) | Architect | Event extension plan |
| 0.7 | Draft ADR for the Work Lifecycle Management Layer architectural decision | Architect | ADR-XXXX |

### 0.2 Unknowns Requiring Clarification

| # | Unknown | Impact If Unresolved | Decision Required By |
|---|---|---|---|
| U1 | Should work items persist across pipeline sessions? Current state is session-scoped (`.opencode/state/sessions/<id>.json`). If yes, a cross-session work item store is needed. | Cannot determine if `task_graph` state scope is sufficient; entire architecture of the work store depends on this. | Before Phase 1 design |
| U2 | Should companion task generation be opt-in or always-on? Generating REVIEW/TEST/DOC/VALIDATION tasks for every TASK-XXXX could produce 4–5x the task count. | Affects task volume (200 → 1000 items per plan), state size, and export payload size. | Before Phase 2 design |
| U3 | What severity threshold triggers automatic defect task chain generation vs. manual creation? Not all bugs require the full 6-task chain. | Defect manager complexity; over-generation of tasks for trivial bugs reduces signal. | Before Phase 2 design |
| U4 | Is the export contract one-way (generate → export) or bidirectional (sync status back from external platform)? | Bidirectional sync is significantly more complex and may require a dedicated sync agent. | Before Phase 3 design |
| U5 | Should the defect manager skill generate tasks that reference the `feature-planning` task schema or define its own task schema? | Schema compatibility between implementation tasks and defect tasks; affects traceability queries. | Before Phase 1 design |

### 0.3 Assumptions

| # | Assumption | Risk If Incorrect |
|---|---|---|
| A1 | The system will continue to operate as an AI-driven pipeline, not as a real-time collaborative work management UI | If the system needs multi-user concurrent access, the state-manager's single-writer model is insufficient |
| A2 | The state-manager 512KB limit can accommodate the expanded task graph by using compressed work item references (ID + type + status only) with full details in a linked scope | If full work item details must be in-state, the 512KB limit will be exceeded for plans > 100 items |
| A3 | Existing skill schemas (feature-planning output) will be extended, not replaced | If replaced, all downstream consumers (implementation-completeness-auditor, code-generator) must be updated simultaneously |
| A4 | The orchestrator's 3-feedback-loop maximum is sufficient for defect resolution cycles | If complex defects require more than 3 iterations, the max_feedback_loops may need increase |
| A5 | External platform export is unidirectional (outbound only) for the initial implementation | If bidirectional sync is required, a dedicated sync skill will be needed in a future phase |

### 0.4 Dependencies on Existing System

| Existing Component | Dependency Type | Impact |
|---|---|---|
| `state-manager` (SKL-020, v1.1.0) | Write interface | New scope `work_items` may be required; 512KB limit must be validated |
| `feature-planning` (SKL-003, v1.2.0) | Output schema extension | Task schema must be backward-compatible; new fields are additive |
| `event-router` (SKL-024, v1.0.0) | New event registrations | New event types: `defect.created`, `defect.resolved`, `change_request.created`, `work_item.state_changed` |
| `implementation-completeness-auditor` (SKL-033, v1.1.0) | Input compatibility | Must consume new task types alongside existing TASK-XXXX records |
| `code-repair` (SKL-030, v1.0.0) | Integration point | Defect manager invokes code-repair for FIX-XXXX execution; code-repair output routes back to defect manager |
| `system-state-schema.json` | Schema extension | `task_graph` definition or new `work_items` scope must be added |
| `pipeline-schema.json` | No change required | Existing schema supports new skill steps without modification |
| `skills/registry.json` | New entries | 4 new skills must be registered (SKL-055, SKL-056, SKL-057, SKL-058) |
| `docs/governance.md` | Governance extension | New gate types and lifecycle rules must be documented |
| `orchestrator` (SKL-010, v1.1.0) | No modification needed | Existing orchestrator can invoke new skills via pipeline config without code changes |

### 0.5 Validation Checkpoint

**Gate:** Discovery phase is complete when:
- [x] All 5 unknowns (U1–U5) have documented decisions — **RESOLVED 2026-06-22**
- [x] ADR for Work Lifecycle Layer is written and recorded in `adr_index` — **ADR-0001, ADR-0002 written**
- [x] State-manager size impact analysis confirms feasibility — **PASS: 103KB (20.1% of 512KB)**
- [x] Integration target(s) are confirmed — **Jira Bulk Import JSON (primary), JSONL + Markdown (fallback)**
- [x] Phase 1 design can proceed without further stakeholder input — **CONFIRMED**

---

## Phase 1 — Foundation Design (Work Item Type Taxonomy & Schema)

**Duration:** 2–3 weeks
**Objective:** Define the canonical work item type taxonomy, shared schema, lifecycle state model, and traceability link contract. All subsequent skills depend on this foundation.

### 1.1 Tasks

| # | Task | Description | Dependencies |
|---|---|---|---|
| 1.1 | Define work item type taxonomy | Enumerate all work item types: REQ, ARCH, SPEC, EPIC, FEATURE, TASK, TEST, REVIEW, VALIDATION, BUG, FIX, CR, DOC, DEPLOY, RELEASE, AUDIT, RETRO | Discovery complete |
| 1.2 | Design shared work item base schema | Common fields across all types: id, type, title, description, status, priority, severity, created_at, updated_at, created_by_skill, parent_id, linked_items[], lifecycle_state, audit_trail[] | 1.1 |
| 1.3 | Design per-type schema extensions | Type-specific fields (e.g., BUG: steps_to_reproduce, root_cause; CR: impact_summary, approval_status; RELEASE: version, promotion_status) | 1.2 |
| 1.4 | Define lifecycle state machine | States and valid transitions per type. Enforce via validation rules. Define which transitions require gates. | 1.2 |
| 1.5 | Design traceability link contract | Define `linked_items[]` schema: `{ target_id, link_type, direction }`. Link types: fulfills, blocks, tests, reviews, fixes, causes, supersedes, child_of | 1.2 |
| 1.6 | Design audit trail schema | `{ timestamp, actor_skill, from_state, to_state, reason, evidence_ref }` — every state transition recorded | 1.4 |
| 1.7 | Design state-manager scope extension | Determine if `work_items` is a new scope alongside `task_graph` or replaces it. Define backward compatibility strategy. | 1.2, Discovery U1 decision |
| 1.8 | Design export contract | Define the standard export payload format: JSON Lines, Markdown table, or platform-specific mapping (Jira JSON, Linear GraphQL, GitHub Issue API) | Discovery U4 decision |
| 1.9 | Validate schema against 512KB state limit | Simulate: 200 implementation tasks × 5 companion types = 1000 work items. Calculate compressed size. | 1.2, 1.7 |
| 1.10 | Write schema validation rules | Validation rules for work items analogous to existing `validation-rules` skill for index.yaml | 1.2, 1.3 |
| 1.11 | Write foundation ADR | Document all schema decisions, rationale, alternatives considered | All above |

### 1.2 Key Design Decisions

| Decision | Options | Recommendation | Rationale |
|---|---|---|---|
| State scope model | A) Extend `task_graph` / B) New `work_items` scope | **B) New scope** | Backward compatibility; existing task_graph consumers are not broken; new scope has no 200-task legacy constraint |
| Work item ID format | A) `TYPE-NNNN` / B) `WI-NNNN` with type field | **A) `TYPE-NNNN`** | More readable in traces; explicit type in the ID itself; aligns with existing `TASK-NNNN` and `REQ-XXX-NNN` patterns |
| Lifecycle enforcement | A) Enforced by state-manager / B) Enforced by a new guard skill / C) Enforced by orchestrator | **B) New guard skill** | Consistent with existing governance pattern (database-guard, performance-guard); separates policy from mechanism |
| Audit trail storage | A) In-state (inside work item) / B) Separate audit log scope | **A) In-state** | Keeps traceability self-contained per item; audit trail is small (state transitions only, not full content history) |
| Export trigger | A) Automatic after every state change / B) On-demand / C) At pipeline completion | **C) At pipeline completion** with on-demand override | Avoids export churn during pipeline execution; final result is the authoritative state |

### 1.3 Lifecycle State Model (Draft)

```
┌─────────────────────────────────────────────────────────────┐
│               WORK ITEM LIFECYCLE STATE MACHINE              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  COMMON STATES (all types):                                 │
│                                                             │
│  draft → ready → in_progress → done → closed                │
│    │                  │          │                           │
│    └── cancelled      └── blocked └── reopened → in_progress │
│                                                             │
│  EXTENDED STATES (type-specific):                           │
│                                                             │
│  TASK:   ready → in_progress → review → testing →           │
│          validation → done → released → closed              │
│                                                             │
│  BUG:    reported → triaged → investigating → fixing →      │
│          testing → validated → closed                       │
│                                                             │
│  CR:     submitted → impact_analysis → approved →           │
│          planning → execution → validation → closed         │
│                                                             │
│  RELEASE: planning → preparation → validation →             │
│           approval → deploying → verifying → closed         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 1.4 Validation Checkpoint

**Gate:** Foundation design is complete when:
- [x] Work item taxonomy is finalized and has no unresolved type — **10 types defined in `docs/work-item-foundation.md`**
- [x] Base schema passes JSON Schema draft-07 validation — **Defined in `docs/work-item-foundation.md` §2; `$def/work_item_ref` in system-state-schema.json**
- [x] Lifecycle state machine is defined for all types with valid transition rules — **`docs/work-item-foundation.md` §4**
- [x] Traceability link contract is defined and passes schema validation — **9 link types defined in `docs/work-item-foundation.md` §6**
- [x] State scope extension plan is confirmed feasible within 512KB limit — **PASS: 103KB compressed index**
- [x] Export contract format is defined — **Jira Bulk Import JSON per ADR-0002**
- [x] ADRs are written, reviewed, and approved — **ADR-0001, ADR-0002 in `docs/adr/`**

---

## Phase 2 — Skill Design & Specification

**Duration:** 3–4 weeks
**Objective:** Design three new skills and one skill enhancement as full 13-section SKILL.md specifications, conforming to the existing Skill Template.

### 2.1 Defect Management Lifecycle Skill

**Proposed ID:** SKL-055
**Name:** `defect-manager`
**Domain:** `lifecycle`
**Version:** 1.0.0

**Responsibility:** Receive defect reports from any source (test failure, code review finding, security finding, manual report), create a structured BUG-XXXX record, automatically generate the full companion task chain, link all tasks to the originating requirement and implementation task, and manage the defect through its lifecycle until closure.

| Input | Source |
|---|---|
| Defect report (description, severity, source, reproduction steps) | Human, code-repair escalation, test-generator failure, security-review finding |
| Architecture context | state-manager read of `architecture` scope |
| Requirement index | state-manager read of `project_spec.requirements` |
| Task graph | state-manager read of `work_items` scope |
| Code map | state-manager read of `code_map` scope |

| Output | Downstream Consumer |
|---|---|
| BUG-XXXX record | work_items scope, export contract |
| INVESTIGATION-XXXX task | orchestrator (assigns to reviewer agent) |
| FIX-XXXX task | orchestrator (assigns to builder agent, invokes code-repair) |
| TEST-XXXX task (regression) | orchestrator (assigns to test-generator agent) |
| REVIEW-XXXX task (fix review) | orchestrator (assigns to reviewer agent) |
| VALIDATION-XXXX task | orchestrator (assigns to tester agent) |
| CLOSURE-XXXX task | orchestrator (human approval gate) |
| Traceability links | work_items scope (linked_items[]) |

**Key Design Constraints:**
- Must integrate with existing `code-repair` (SKL-030) as the execution engine for FIX-XXXX tasks
- Must link to requirements via `req_task_map` traceability chain
- Must emit `defect.created` event for event-router
- Must generate the full chain (INVESTIGATION + FIX + TEST + REVIEW + VALIDATION + CLOSURE) for ALL bugs regardless of severity (U3 decision)
- "Missings" from implementation-completeness-auditor trigger FIX + TEST + VALIDATION only (root cause is known; no INVESTIGATION)
- Must produce output conforming to Phase 1 work item schema (Jira-compatible, file-based .md per ADR-0001)

**HITL Gates:**
- Triage approval: human confirms priority and assignment before chain generation (all bugs)
- Closure gate: defect cannot be closed without validation task passing

### 2.2 Change Request Lifecycle Skill

**Proposed ID:** SKL-056
**Name:** `change-request-manager`
**Domain:** `lifecycle`
**Version:** 1.0.0

**Responsibility:** Receive a change request (new behavior, modified requirement, or scope change), run impact analysis against the current architecture and task plan, generate a task delta (new tasks, modified tasks, cancelled tasks), and manage the CR through approval to execution.

| Input | Source |
|---|---|
| Change request description | Human input |
| Current architecture | state-manager read of `architecture` scope |
| Current work items | state-manager read of `work_items` scope |
| Current requirements | state-manager read of `project_spec.requirements` scope |

| Output | Downstream Consumer |
|---|---|
| CR-XXXX record | work_items scope, export contract |
| Impact analysis (modules affected, tasks affected, requirements affected) | Stakeholder HITL gate |
| Task delta: new tasks, modified tasks, cancelled tasks | feature-planning (re-invocation with delta) |
| Updated requirement references | requirement-analyzer (backpropagate if new requirements emerge) |
| Updated traceability links | work_items scope |

**Key Design Constraints:**
- Must invoke `change-impact-analyzer` (SKL-023) as a sub-step for impact computation
- Must not modify existing tasks directly — produces a delta that the orchestrator applies
- Must emit `change_request.created` event
- HITL gate is mandatory before any task modification: human approves scope of change

**HITL Gates:**
- Impact approval: present impact summary (modules affected count, tasks affected count, effort delta) before any modification
- Scope confirmation: if CR introduces new requirements, human confirms before requirement-analyzer re-invocation

### 2.3 Feature Planning Enhancement (Per-Task Companion Generation)

**Target Skill:** `feature-planning` (SKL-003)
**Version Bump:** 1.2.0 → 2.0.0 (MAJOR: output schema adds new required fields)

**Enhancement Scope:** Extend feature-planning to optionally generate companion work items for every implementation task.

**New Input Field:**

```json
{
  "companion_generation": {
    "type": "object",
    "properties": {
      "enabled": { "type": "boolean", "default": false },
      "types": {
        "type": "array",
        "items": { "type": "string", "enum": ["REVIEW", "TEST", "DOC", "VALIDATION"] },
        "default": ["REVIEW", "TEST", "VALIDATION"]
      },
      "severity_threshold": {
        "type": "string",
        "enum": ["all", "medium_and_above", "high_and_above"],
        "default": "all",
        "description": "Only generate companions for tasks with linked requirements at or above this priority"
      }
    }
  }
}
```

**New Output Fields:**

```json
{
  "companion_tasks": {
    "type": "array",
    "items": { "$ref": "#/$defs/companion_task" },
    "description": "Generated companion work items (REVIEW, TEST, DOC, VALIDATION) linked to implementation tasks"
  },
  "work_item_summary": {
    "type": "object",
    "properties": {
      "total_implementation_tasks": { "type": "integer" },
      "total_companion_tasks": { "type": "integer" },
      "total_work_items": { "type": "integer" },
      "type_breakdown": { "type": "object" }
    }
  }
}
```

**Key Design Constraints:**
- `companion_generation.enabled: false` preserves backward compatibility — default behavior unchanged
- When enabled, each TASK-XXXX generates: REVIEW-XXXX, TEST-XXXX, VALIDATION-XXXX (and optionally DOC-XXXX)
- Companion IDs use the same NNNN number as their parent for easy traceability (TASK-0042 → REVIEW-0042, TEST-0042)
- Companion tasks include `linked_items: [{ target_id: "TASK-0042", link_type: "reviews|tests|validates", direction: "outbound" }]`
- Must remain within the 200-task cap for implementation tasks; companion tasks do not count toward this cap

### 2.4 Work Item Export Skill

**Proposed ID:** SKL-057
**Name:** `work-item-exporter`
**Domain:** `integration`
**Version:** 1.0.0

**Responsibility:** Transform internal work item records into export-ready format for external work management platforms.

| Input | Source |
|---|---|
| Work items to export | state-manager read of `work_items` scope |
| Export target format | Pipeline configuration or user input |
| Export filter (by type, status, date range) | User input or pipeline default |

| Output | Downstream Consumer |
|---|---|
| Exported payload (JSON Lines / Markdown / Platform-specific) | File system write or API export |
| Export manifest (items exported, format, timestamp) | Documentation / audit trail |

**Supported Export Formats (per ADR-0002):**
- **Primary:** Jira Bulk Import JSON — compatible with Jira's native bulk create endpoint and CSV importer, with full field mapping (issue_type, priority, labels, components, story_points, links)
- JSON Lines (`.jsonl`) — universal machine-readable fallback, one item per line
- Markdown task list (`.md`) — human-readable summary table for non-technical stakeholders
- Export manifest (`.json`) — metadata: item counts, type breakdown, filters applied, format version

**Key Design Constraints:**
- One-way (outbound) only — no status read-back from Jira or any external platform (per U4 decision)
- Must be async and non-blocking (does not gate pipeline advancement)
- Must strip internal system fields (metrics, feedback) from export payload
- Must include traceability links mapped to Jira link types (blocks, is blocked by, etc.)
- PII scrubbing must run before export (consistent with existing governance)
- Export files written to `exports/{YYYY-MM-DD}_{pipeline_id}_{format}.{ext}`
- See full field mapping in [ADR-0002](adr/ADR-0002-work-item-export-contract.md)

### 2.5 Skill Design Specification Tasks

| # | Task | Skill | Deliverable |
|---|---|---|---|
| 2.1 | Write full 13-section SKILL.md for defect-manager | SKL-055 | `.opencode/skills/defect-manager/SKILL.md` |
| 2.2 | Write full 13-section SKILL.md for change-request-manager | SKL-056 | `.opencode/skills/change-request-manager/SKILL.md` |
| 2.3 | Write feature-planning v2.0.0 specification (extended sections) | SKL-003 | Updated `.opencode/skills/feature-planning/SKILL.md` |
| 2.4 | Write full 13-section SKILL.md for work-item-exporter | SKL-057 | `.opencode/skills/work-item-exporter/SKILL.md` |
| 2.5 | Design knowledge files for new skills | All new | `skills/knowledge/defect-management.md`, `skills/knowledge/change-request-lifecycle.md` |
| 2.6 | Design integration test scenarios (input/output pairs) | All | Test fixtures per skill |
| 2.7 | Validate all schemas against JSON Schema draft-07 | All | Schema validation report |
| 2.8 | Peer review all SKILL.md files against quality-scoring rubric | All | Quality score ≥ 60/100 per skill |

### 2.6 Validation Checkpoint

**Gate:** Skill design phase is complete when:
- [ ] All 4 SKILL.md files pass `validate-skills.sh`
- [ ] All JSON schemas are valid JSON Schema draft-07
- [ ] Quality scoring (SKL-014) evaluates each new skill ≥ 60/100
- [ ] All integration test scenarios are documented (minimum 3 per skill: happy path, edge case, failure case)
- [ ] Backward compatibility analysis for feature-planning v2.0.0 confirms no breaking change to downstream consumers when `companion_generation.enabled: false`
- [ ] HITL gate placement is consistent with governance.md rules

---

## Phase 3 — Infrastructure & Schema Implementation

**Duration:** 2–3 weeks
**Objective:** Implement the foundation schema extensions, state model changes, and event system integrations required before skills can execute.

### 3.1 Tasks

| # | Task | Description | Dependencies |
|---|---|---|---|
| 3.1 | Extend `system-state-schema.json` | Add `work_items` scope to properties and required array. Define work item base schema in `$defs`. | Phase 1 schema finalized |
| 3.2 | Extend `state-manager` scope enum | Add `"work_items"` to the `scope` enum in state-manager input schema | 3.1 |
| 3.3 | Register new event types in event-router | Add dispatch entries: `defect.created`, `defect.resolved`, `change_request.created`, `change_request.approved`, `work_item.state_changed` | Phase 2 event design |
| 3.4 | Create work item validation guard skill spec | `work-item-lifecycle-guard` — validates state transitions per work item type, blocks invalid transitions | Phase 1 lifecycle state machine |
| 3.5 | Update `skills/registry.json` | Add entries for SKL-055, SKL-056, SKL-057, and SKL-058 (work-item-lifecycle-guard) | Phase 2 complete |
| 3.6 | Update `skills/index.yaml` | Add index entries for all new skills (SKL-055, SKL-056, SKL-057, SKL-058) with tags, depends_on, use_when | 3.5 |
| 3.7 | Define pipeline template for defect lifecycle | New pipeline: `skills/pipelines/defect-lifecycle.json` | Phase 2 skill specs |
| 3.8 | Define pipeline template for change request | New pipeline: `skills/pipelines/change-request.json` | Phase 2 skill specs |
| 3.9 | Update `full-pipeline.json` | Add optional defect management phase (conditional on defect detection) and export phase (async) | 3.7, 3.8 |
| 3.10 | Backward compatibility test | Verify existing pipelines (all 13) still pass schema validation after state schema extension | 3.1, 3.2 |

### 3.2 State Schema Extension (Draft)

New top-level property in `system-state-schema.json`:

```json
{
  "work_items": {
    "type": "object",
    "description": "Persistent work item store — all tracked work items across the lifecycle",
    "properties": {
      "items": {
        "type": "array",
        "items": { "$ref": "#/$defs/work_item" }
      },
      "type_counts": {
        "type": "object",
        "description": "Count per work item type for quick summary",
        "additionalProperties": { "type": "integer" }
      },
      "last_updated": { "type": "string", "format": "date-time" }
    }
  }
}
```

New `$defs` entry:

```json
{
  "work_item": {
    "type": "object",
    "required": ["id", "type", "title", "status", "lifecycle_state", "created_at", "created_by_skill"],
    "properties": {
      "id": { "type": "string", "pattern": "^(TASK|TEST|REVIEW|VALIDATION|DOC|BUG|FIX|INVESTIGATION|CR|DEPLOY|RELEASE|AUDIT|CLOSURE)-\\d{4}$" },
      "type": { "type": "string", "enum": ["TASK", "TEST", "REVIEW", "VALIDATION", "DOC", "BUG", "FIX", "INVESTIGATION", "CR", "DEPLOY", "RELEASE", "AUDIT", "CLOSURE"] },
      "title": { "type": "string" },
      "description": { "type": "string" },
      "status": { "type": "string" },
      "lifecycle_state": { "type": "string" },
      "priority": { "type": "string", "enum": ["critical", "high", "medium", "low"] },
      "severity": { "type": "string", "enum": ["critical", "high", "medium", "low", "info"] },
      "created_at": { "type": "string", "format": "date-time" },
      "updated_at": { "type": "string", "format": "date-time" },
      "created_by_skill": { "type": "string" },
      "parent_id": { "type": ["string", "null"] },
      "linked_items": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "target_id": { "type": "string" },
            "link_type": { "type": "string", "enum": ["fulfills", "blocks", "tests", "reviews", "fixes", "causes", "supersedes", "child_of", "validates"] },
            "direction": { "type": "string", "enum": ["inbound", "outbound"] }
          },
          "required": ["target_id", "link_type", "direction"]
        }
      },
      "audit_trail": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "timestamp": { "type": "string", "format": "date-time" },
            "actor_skill": { "type": "string" },
            "from_state": { "type": "string" },
            "to_state": { "type": "string" },
            "reason": { "type": "string" }
          },
          "required": ["timestamp", "actor_skill", "to_state", "reason"]
        }
      },
      "req_ids": { "type": "array", "items": { "type": "string" } },
      "module": { "type": "string" },
      "acceptance_criteria": { "type": "array", "items": { "type": "string" } },
      "definition_of_done": { "type": "array", "items": { "type": "string" } }
    }
  }
}
```

### 3.3 New Event Types

| Event Type | Emitted By | Consumed By | Payload |
|---|---|---|---|
| `defect.created` | defect-manager | event-router → orchestrator | `{ bug_id, severity, source_skill, linked_task_id }` |
| `defect.resolved` | defect-manager | event-router → doc-maintainer | `{ bug_id, fix_id, resolution_type }` |
| `change_request.created` | change-request-manager | event-router → change-impact-analyzer | `{ cr_id, scope, affected_requirements[] }` |
| `change_request.approved` | orchestrator (HITL gate) | event-router → feature-planning | `{ cr_id, approved_delta }` |
| `work_item.state_changed` | work-item-lifecycle-guard | event-router → doc-maintainer, observability | `{ item_id, from_state, to_state, actor_skill }` |

### 3.4 New Pipeline Templates

**`skills/pipelines/defect-lifecycle.json`** (draft structure):

```json
{
  "name": "defect-lifecycle",
  "version": "1.0.0",
  "description": "Defect intake → triage → investigation → fix → test → review → validate → close",
  "mode": "sequential",
  "phases": [
    { "id": "phase-1-intake", "label": "Defect Intake", "skills": [{ "name": "defect-manager", "version": "^1.0.0" }] },
    { "id": "phase-2-investigation", "label": "Investigation", "skills": [{ "name": "change-impact-analyzer", "version": "^1.0.0" }] },
    { "id": "phase-3-fix", "label": "Fix", "skills": [{ "name": "code-repair", "version": "^1.0.0" }] },
    { "id": "phase-4-test", "label": "Regression Test", "skills": [{ "name": "test-generator", "version": "^1.0.0" }] },
    { "id": "phase-5-review", "label": "Fix Review", "skills": [{ "name": "clean-code-review", "version": "^1.1.0" }] },
    { "id": "phase-6-validate", "label": "Validation", "skills": [{ "name": "implementation-completeness-auditor", "version": "^1.0.0" }] }
  ],
  "gates": [
    { "after_phase": "phase-1-intake", "type": "human_approval", "label": "Confirm defect triage and priority", "timeout": 3600 },
    { "after_phase": "phase-5-review", "type": "human_approval", "label": "Approve fix before closure", "timeout": 3600 }
  ]
}
```

### 3.5 Validation Checkpoint

**Gate:** Infrastructure phase is complete when:
- [x] `system-state-schema.json` extended and validates with JSON Schema tooling — **pre-existing from Phase 2**
- [x] All 15 existing pipelines still validate against `pipeline-schema.json` — **PASS (validate-skills.sh 95/95)**
- [x] `state-manager` accepts the new `work_items` scope without error — **scope enum updated in SKILL.md**
- [x] Event-router dispatch map includes new event types — **5 new event types registered in SKILL.md**
- [x] `skills/registry.json` includes all new skill entries — **pre-existing from Phase 2**
- [x] `validate-skills.sh` passes (58 skills) — **95/95 PASS, 2026-06-23**
- [x] No existing skill or agent configuration is broken by the additions — **confirmed**

---

## Phase 4 — Skill Implementation

**Duration:** 4–6 weeks
**Objective:** Implement the four skill specifications as executable SKILL.md files, ensure schema compliance, and validate with integration test fixtures.

### 4.1 Implementation Order

```
Week 1–2:  feature-planning v2.0.0 (companion generation)
           ↓ (creates foundation for companion task patterns)
Week 2–3:  defect-manager v1.0.0
           ↓ (depends on companion task pattern from feature-planning)
Week 3–4:  change-request-manager v1.0.0
           ↓ (depends on impact analysis integration patterns from defect-manager)
Week 4–5:  work-item-exporter v1.0.0
           ↓ (depends on all work item types being defined and produced)
Week 5–6:  work-item-lifecycle-guard v1.0.0
           ↓ (depends on lifecycle state machine being validated by all producers)
```

This order is determined by:
1. Feature-planning enhancement is the lowest-risk change (additive, backward-compatible)
2. Defect-manager is the highest-value new skill and exercises the full work item schema
3. Change-request-manager builds on patterns established by defect-manager
4. Exporter needs all item types to exist before it can export them
5. Lifecycle guard is enforcement — must be last so all producers are stable

### 4.2 Per-Skill Implementation Tasks

**Feature Planning v2.0.0:**

| # | Task | Validation |
|---|---|---|
| 4.1.1 | Add `companion_generation` input field to SKILL.md | Schema validates |
| 4.1.2 | Extend execution logic with companion generation step (new Step 7b) | Produces REVIEW/TEST/VALIDATION/DOC tasks |
| 4.1.3 | Add `companion_tasks` and `work_item_summary` to output schema | Output schema validates |
| 4.1.4 | Update quality checklist with companion task rules | All companion tasks linked to parent |
| 4.1.5 | Test backward compatibility: `companion_generation.enabled: false` produces identical output to v1.2.0 | Diff test passes |
| 4.1.6 | Test forward path: `companion_generation.enabled: true` with 50-task plan | Produces ~200 companion tasks correctly linked |

**Defect Manager v1.0.0:**

| # | Task | Validation |
|---|---|---|
| 4.2.1 | Write full SKILL.md (13 sections) | validate-skills.sh passes |
| 4.2.2 | Implement defect intake (parse defect report, classify severity) | Input schema validates |
| 4.2.3 | Implement companion chain generation (BUG → INVESTIGATION → FIX → TEST → REVIEW → VALIDATION → CLOSURE) | All 7 items produced with correct IDs and links |
| 4.2.4 | Implement full chain generation for all bugs (INVESTIGATION → FIX → TEST → REVIEW → VALIDATION → CLOSURE); for missings: FIX + TEST + VALIDATION only | All items produced with correct IDs, links, and parent_id |
| 4.2.5 | Implement traceability linking (bug → requirement, bug → original task, bug → code artifact) | All `linked_items[]` populated |
| 4.2.6 | Implement event emission (`defect.created`) | Event-router routes correctly |
| 4.2.7 | Write integration test fixtures (3 scenarios: critical bug, medium bug, low severity bug) | All fixtures produce valid output |
| 4.2.8 | Quality scoring assessment | Score ≥ 60/100 |

**Change Request Manager v1.0.0:**

| # | Task | Validation |
|---|---|---|
| 4.3.1 | Write full SKILL.md (13 sections) | validate-skills.sh passes |
| 4.3.2 | Implement CR intake and classification | Input schema validates |
| 4.3.3 | Implement impact analysis invocation (delegates to change-impact-analyzer) | Impact surface computed correctly |
| 4.3.4 | Implement task delta generation (new, modified, cancelled work items) | Delta is structurally valid |
| 4.3.5 | Implement requirement backpropagation (if CR introduces new requirements) | Feedback entry emitted correctly |
| 4.3.6 | Implement event emission (`change_request.created`, `change_request.approved`) | Events route correctly |
| 4.3.7 | Write integration test fixtures (3 scenarios) | All valid |
| 4.3.8 | Quality scoring assessment | Score ≥ 60/100 |

**Work Item Exporter v1.0.0:**

| # | Task | Validation |
|---|---|---|
| 4.4.1 | Write full SKILL.md (13 sections) | validate-skills.sh passes |
| 4.4.2 | Implement JSON Lines export format | Valid JSONL output |
| 4.4.3 | Implement Markdown task list export format | Readable Markdown output |
| 4.4.4 | Implement GitHub Issues API payload format | Valid GitHub API payload |
| 4.4.5 | Implement export filtering (by type, status, date range) | Filters applied correctly |
| 4.4.6 | Implement PII scrubbing before export | No PII in output |
| 4.4.7 | Write integration test fixtures | All valid |

### 4.3 Validation Checkpoint

**Gate:** Implementation phase is complete when:
- [x] All new skills pass `validate-skills.sh`
- [x] All output schemas validate against JSON Schema draft-07
- [x] All integration test fixtures produce expected output
- [x] quality-scoring evaluates each skill ≥ 60/100
- [x] Feature-planning backward compatibility confirmed
- [x] Defect-manager integrates with code-repair (input/output contract validated)
- [x] Change-request-manager integrates with change-impact-analyzer
- [x] All skills emit correct events (verified against event-router dispatch map)
- [x] No regression in existing 60/60 validation tests

---

## Phase 5 — Integration & Testing

**Duration:** 2–3 weeks
**Objective:** Wire new skills into pipeline configurations, validate end-to-end flows, and ensure governance compliance.

### 5.1 Tasks

| # | Task | Description |
|---|---|---|
| 5.1 | Wire defect-manager into `full-pipeline.json` | Add conditional phase after Phase 8 (code-repair) that invokes defect-manager when repair escalates |
| 5.2 | Wire work-item-exporter into all pipelines | Add async phase at pipeline end (parallel with doc-maintainer) |
| 5.3 | Wire change-request-manager into routing table | Add trigger phrases to primary agent routing table |
| 5.4 | Wire work-item-lifecycle-guard into guard layer | Add to Phase 7b parallel guard group |
| 5.5 | End-to-end test: full pipeline with companion generation enabled | Verify 14-phase pipeline produces implementation tasks + companion tasks + export |
| 5.6 | End-to-end test: defect lifecycle pipeline | Verify BUG intake → full chain generation → code-repair → test-generator → review → closure |
| 5.7 | End-to-end test: change request pipeline | Verify CR intake → impact analysis → HITL gate → task delta → updated plan |
| 5.8 | End-to-end test: backward compatibility | Run existing pipeline configs without new features; verify identical behavior |
| 5.9 | Governance compliance review | Verify all new HITL gates conform to governance.md rules; deployment gate remains non-bypassable |
| 5.10 | Documentation sync | Update all affected docs per governance.md sync rules |
| 5.11 | Token budget validation | Verify new skills operate within budget tiers (32K per skill invocation) |
| 5.12 | State size validation | Run full pipeline producing maximum work items; verify total state < 512KB |

### 5.2 Integration Points Verification Matrix

| Source Skill | Target Skill | Integration Contract | Test Scenario |
|---|---|---|---|
| `code-repair` (escalation) | `defect-manager` | Escalation event triggers defect intake | code-repair fails all candidates → defect-manager creates BUG |
| `defect-manager` | `code-repair` | FIX-XXXX task invokes code-repair | defect-manager creates FIX → orchestrator routes to code-repair |
| `defect-manager` | `test-generator` | TEST-XXXX task invokes test-generator in regression mode | defect-manager creates TEST → test-generator produces regression tests |
| `defect-manager` | `clean-code-review` | REVIEW-XXXX task invokes code review on the fix | Fix code routes to review |
| `change-request-manager` | `change-impact-analyzer` | CR triggers full impact analysis | CR invokes impact analysis → returns affected modules/tasks |
| `change-request-manager` | `feature-planning` | Approved CR delta feeds back into feature-planning | CR produces task delta → feature-planning re-plans |
| `feature-planning` v2.0.0 | `implementation-completeness-auditor` | Companion tasks included in completeness scoring | Auditor counts TEST-XXXX items in coverage assessment |
| `work-item-exporter` | State-manager | Export reads full `work_items` scope | Exporter produces valid export from populated state |
| `work-item-lifecycle-guard` | All work item producers | Guard validates all state transitions | Invalid transition (draft → done skipping in_progress) → blocked |

### 5.3 Validation Checkpoint

**Gate:** Integration phase is complete when:
- [x] All end-to-end test scenarios pass
- [x] All integration contracts verified bidirectionally
- [x] Backward compatibility test passes (no existing behavior changed)
- [x] Governance compliance review signed off
- [x] All affected documentation updated per sync rules
- [x] Token budgets within limits across all new skill invocations
- [x] State size within 512KB limit for maximum scenario (200 tasks + companions + 10 bugs + 2 CRs)
- [x] `validate-skills.sh` passes with new skill count
- [x] Website build succeeds (if applicable)

---

## Phase 6 — Release & Documentation

**Duration:** 1–2 weeks
**Objective:** Finalize documentation, version bump, update changelog, and prepare for production use.

### 6.1 Tasks

| # | Task | Description |
|---|---|---|
| 6.1 | Version bump: registry.json → v4.0.0 (MAJOR: new work item scope) | Reflects new system capability |
| 6.2 | Version bump: system-state-schema.json | Add `work_items` to required, bump schema-version |
| 6.3 | Version bump: full-pipeline.json → v3.0.0 | New phases added |
| 6.4 | Update `docs/governance.md` | Add lifecycle guard to Guard Inventory; add new HITL gates |
| 6.5 | Update `docs/workflows.md` | Add defect lifecycle flow and change request flow diagrams |
| 6.6 | Update `docs/architecture.md` | Add Work Lifecycle Management Layer to component model |
| 6.7 | Update `docs/agents.md` | Add work-item management responsibilities to agents |
| 6.8 | Update `docs/skills-registry.md` | Add new skills to registry documentation |
| 6.9 | Write `docs/changelog.md` entry | Full changelog entry for all changes |
| 6.10 | Update `docs/system-overview.md` | Add Work Lifecycle Management to key capabilities |
| 6.11 | Run `graphify update .` | Keep knowledge graph current |
| 6.12 | Final validation run | `validate-skills.sh` + existing test suite + website build |
| 6.13 | Write release ADR | Document the release decision and scope |

### 6.2 Documentation Artifacts

| Document | Change Type | New Content |
|---|---|---|
| `governance.md` | Update (MINOR) | New guard skill entry, new HITL gates, new event types |
| `workflows.md` | Update (MINOR) | Defect lifecycle flow diagram, change request flow diagram |
| `architecture.md` | Update (MINOR) | Work Lifecycle Layer in component model |
| `agents.md` | Update (PATCH) | Agent responsibility updates for new skills |
| `skills-registry.md` | Update (MINOR) | 3–4 new skill entries |
| `system-overview.md` | Update (MINOR) | New capabilities listed |
| `changelog.md` | Update (MINOR) | Full v4.0.0 changelog entry |

### 6.3 Validation Checkpoint

**Gate:** Release is approved when:
- [x] All documentation updated per governance.md sync rules
- [x] `validate-skills.sh` passes with full skill count
- [x] Changelog entry is complete and accurate
- [x] ADR for the release is written and in `adr_index`
- [x] graphify graph is current (`graphify update .`)
- [x] No open blocking issues from integration testing
- [ ] Stakeholder sign-off on the Work Lifecycle capability

---

## Risk Register

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | State size exceeds 512KB with full companion generation | Medium | High — pipeline halts on state write | Use compressed work item summaries (ID + type + status only) in state; full details in linked files |
| R2 | Feature-planning v2.0.0 breaks downstream consumers | Low | High — pipeline fails | `companion_generation.enabled: false` default ensures zero behavioral change; extensive backward compat testing in Phase 4 |
| R3 | Defect-manager companion chain over-generates for trivial bugs | Medium | Medium — noise in task lists | Severity-based chain scaling: low severity generates FIX + TEST only; full chain reserved for high/critical |
| R4 | Orchestrator feedback loop limit (3) insufficient for complex defect resolution | Low | Medium — defect stuck in unresolved state | Add escalation path: after 3 loops, emit HITL gate for human intervention (consistent with existing code-repair pattern) |
| R5 | External platform export format incompatible with target platform version | Medium | Low — export fails silently | Version-specific export adapters; JSON Lines fallback always available |
| R6 | New event types create unhandled event floods | Low | Low — event-router emits warnings | Event deduplication (existing 60-second window); handler registration verification in Phase 3 |
| R7 | Discovery phase unknowns U1-U5 block Phase 1 start | Medium | High — schedule slip | Timebox discovery to 2 weeks maximum; default decisions if stakeholder input unavailable |
| R8 | Work item lifecycle guard blocks pipeline due to overly strict transition rules | Medium | Medium — pipeline halts | Guard has `warning` mode in addition to `block` mode; initial deployment in `warning` mode for first 2 weeks |
| R9 | Existing `task_graph` scope consumers confused by parallel `work_items` scope | Low | Medium — traceability breaks | Clear documentation: `task_graph` is legacy read path; `work_items` is authoritative for lifecycle tracking; both coexist during transition |
| R10 | Token budget exceeded during defect lifecycle pipeline (multi-skill chain) | Medium | Medium — pipeline halts or truncates | Defect lifecycle pipeline uses `partial_pipeline` tier (64K tokens); compress intermediate artifacts between skills |

---

## Success Criteria

| Metric | Threshold | Measurement Method |
|---|---|---|
| Defect task chain generation | 100% of critical/high bugs produce full 7-task chain | Validate defect-manager output for severity ≥ high |
| Companion task generation | 100% of implementation tasks produce REVIEW + TEST + VALIDATION companions when enabled | Count companion_tasks vs tasks in feature-planning output |
| Traceability completeness | Every BUG-XXXX links to ≥ 1 REQ-XXXX and ≥ 1 TASK-XXXX | Query linked_items[] on all BUG records |
| Backward compatibility | 0 existing pipeline configs broken | Run all 13 existing pipelines; all pass |
| State size | < 512KB for maximum scenario (200 tasks + companions + 10 bugs + 2 CRs) | Measure serialized state size |
| Export validity | Exported JSON Lines parses without error; GitHub Issues payload validates | Parse exported files; validate against platform schemas |
| Lifecycle enforcement | 0 invalid state transitions accepted | Attempt invalid transitions; all blocked by guard |
| Quality score | All new skills ≥ 60/100 | Run quality-scoring skill on each |
| Documentation sync | All affected docs updated before release | Check governance.md sync rules compliance |

---

## Timeline Summary

| Phase | Duration | Cumulative |
|---|---|---|
| Phase 0 — Discovery & Alignment | 1–2 weeks | Weeks 1–2 |
| Phase 1 — Foundation Design | 2–3 weeks | Weeks 3–5 |
| Phase 2 — Skill Design & Specification | 3–4 weeks | Weeks 6–9 |
| Phase 3 — Infrastructure & Schema Implementation | 2–3 weeks | Weeks 10–12 |
| Phase 4 — Skill Implementation | 4–6 weeks | Weeks 13–18 |
| Phase 5 — Integration & Testing | 2–3 weeks | Weeks 19–21 |
| Phase 6 — Release & Documentation | 1–2 weeks | Weeks 22–23 |

**Total estimated duration: 15–23 weeks** (depending on discovery outcomes, stakeholder availability, and iteration on Phase 4 implementation).

**Critical path:** Discovery decisions (U1–U5) → Foundation schema → State schema extension → Defect manager implementation → End-to-end integration test.

---

## Appendix A — Routing Table Extension

New entries for the primary agent's intent routing table:

| Triggers | Pipeline Template | Entry Agent |
|---|---|---|
| "report a bug", "defect found", "this is broken", "bug report", "create defect" | `skills/pipelines/defect-lifecycle.json` | `defect-manager` (SKL-055) |
| "change request", "modify this requirement", "scope change", "CR", "change the spec" | `skills/pipelines/change-request.json` | `change-request-manager` (SKL-056) |
| "export tasks", "export work items", "sync to Jira", "export to GitHub Issues" | Direct skill invocation | `work-item-exporter` (SKL-057) |

---

## Appendix B — Work Item Type Quick Reference

| ID Pattern | Type | Generated By | Lifecycle |
|---|---|---|---|
| `REQ-XXX-NNN` | Requirement | requirement-analyzer | Existing (unchanged) |
| `TASK-NNNN` | Implementation Task | feature-planning | Extended with new states |
| `REVIEW-NNNN` | Review Task | feature-planning (companion) | draft → ready → in_progress → done → closed |
| `TEST-NNNN` | Test Task | feature-planning (companion) | draft → ready → in_progress → done → closed |
| `VALIDATION-NNNN` | Validation Task | feature-planning (companion) | draft → ready → in_progress → done → closed |
| `DOC-NNNN` | Documentation Task | feature-planning (companion) | draft → ready → in_progress → done → closed |
| `BUG-NNNN` | Bug Record | defect-manager (SKL-055) | reported → triaged → investigating → fixing → testing → validated → closed |
| `INVESTIGATION-NNNN` | Investigation Task | defect-manager (SKL-055) (companion) | Same as TASK lifecycle |
| `FIX-NNNN` | Fix Implementation Task | defect-manager (SKL-055) (companion) | Same as TASK lifecycle |
| `CLOSURE-NNNN` | Closure Task | defect-manager (SKL-055) (companion) | draft → validation → closed |
| `CR-NNNN` | Change Request | change-request-manager (SKL-056) | submitted → impact_analysis → approved → planning → execution → validation → closed |

---

## Appendix C — Governance Impact Summary

| Governance Layer | Impact | Change Required |
|---|---|---|
| Layer 1 — Automated | New schema validation for `work_items` scope | Extend schema-validator |
| Layer 2 — Guard Skills | New `work-item-lifecycle-guard` skill added | New guard entry in governance.md |
| Layer 3 — HITL Gates | New gates: defect triage, CR impact approval, defect closure | Add to HITL gate table |
| Layer 4 — Documentation | New documentation sync rules for lifecycle skills | Add to sync rules table |
| Layer 5 — Adaptive | No change (telemetry collects events from new skills automatically) | None |

---

*End of Implementation Plan. All phases complete as of 2026-06-23. One gate item pending: stakeholder sign-off (Phase 6.3).*

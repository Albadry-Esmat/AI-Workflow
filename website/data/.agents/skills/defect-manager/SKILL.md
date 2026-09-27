---
name: defect-manager
version: 1.0.0
domain: lifecycle
description: 'Use when a defect is reported, a bug is found, or an implementation gap is identified. Triggers on: "report a bug", "defect found", "this is broken", "bug report", "create defect", "test failure", "regression detected", "security finding". Do NOT use for general task creation — only when a defect record and repair chain are required.'
author: system
---

## Purpose

Receive defect reports from any source — test failure, security finding, code-review escalation, or manual report — and manage the full defect lifecycle from intake to closure. For every defect, the skill creates a structured `BUG-NNNN` record, generates the complete companion task chain (INVESTIGATION → FIX → TEST → REVIEW → VALIDATION → CLOSURE), links all items to the originating requirement and implementation task, and persists each item as a Markdown file in `work-items/`. The skill is the single authoritative entry point for all defect work in the pipeline.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `defect_report` | `object` | Yes | The defect being reported |
| `defect_report.title` | `string` | Yes | Short description (max 255 chars) |
| `defect_report.description` | `string` | Yes | Full description of the defect |
| `defect_report.steps_to_reproduce` | `array[string]` | No | Reproduction steps |
| `defect_report.expected_behavior` | `string` | No | What should happen |
| `defect_report.actual_behavior` | `string` | No | What actually happens |
| `defect_report.severity` | `string` | Yes | `critical`, `high`, `medium`, `low`, `info` |
| `defect_report.source` | `string` | Yes | Origin: `human`, `test-generator`, `security-review`, `code-repair`, `implementation-completeness-auditor` |
| `defect_report.source_item_id` | `string` | No | ID of the test, security finding, or task that triggered the defect |
| `defect_report.environment` | `string` | No | `production`, `staging`, `local` |
| `defect_report.affected_module` | `string` | No | Architecture module name |
| `defect_report.linked_task_id` | `string` | No | TASK-NNNN that likely caused this defect |
| `defect_report.linked_req_ids` | `array[string]` | No | REQ-IDs this defect violates |
| `defect_type` | `string` | No | `bug` (default) or `missing` — missings from implementation-completeness-auditor generate a shorter chain |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["defect_report"],
  "properties": {
    "defect_report": {
      "type": "object",
      "required": ["title", "description", "severity", "source"],
      "properties": {
        "title":               { "type": "string", "maxLength": 255 },
        "description":         { "type": "string", "minLength": 10 },
        "steps_to_reproduce":  { "type": "array", "items": { "type": "string" } },
        "expected_behavior":   { "type": "string" },
        "actual_behavior":     { "type": "string" },
        "severity":            { "type": "string", "enum": ["critical", "high", "medium", "low", "info"] },
        "source":              { "type": "string", "enum": ["human", "test-generator", "security-review", "code-repair", "implementation-completeness-auditor"] },
        "source_item_id":      { "type": "string" },
        "environment":         { "type": "string", "enum": ["production", "staging", "local"] },
        "affected_module":     { "type": "string" },
        "linked_task_id":      { "type": "string", "pattern": "^TASK-[0-9]{4,}$" },
        "linked_req_ids":      { "type": "array", "items": { "type": "string" } }
      }
    },
    "defect_type": { "type": "string", "enum": ["bug", "missing"], "default": "bug" }
  }
}
```

## Required Context

- `work_items` scope from state-manager: to determine next BUG sequence number and write the compressed index entry.
- `architecture` scope from state-manager: to resolve `affected_module` if not provided by caller.
- `project_spec.requirements` from state-manager: to resolve `linked_req_ids` if not provided.
- `code_map` scope from state-manager: to identify files associated with the affected module.
- Foundation schema from `docs/work-item-foundation.md`: governs ID patterns, lifecycle states, Jira field mappings, and file structure.

## Execution Logic

```
Step 1 — Validate and classify defect
  Validate all required fields. Reject if title is empty or severity is missing.
  Classify defect_type if not provided:
    - source=implementation-completeness-auditor → type=missing
    - All other sources → type=bug
  Load work_items.sequences.BUG from state to determine next ID number.
  Assign: bug_id = "BUG-{next_sequence_zero_padded_4_digits}"
  Output: validated_defect, bug_id, defect_type

Step 2 — Resolve context from state
  If affected_module is absent: match description keywords against architecture.modules[].name.
  If linked_req_ids is absent: search project_spec.requirements for requirements whose
    acceptance_criteria overlap with the defect description (keyword match).
  If linked_task_id is absent and defect_type=bug: search code_map for files in affected_module
    and look up task_graph for any TASK touching those files.
  Output: resolved_module, resolved_req_ids, resolved_task_id

Step 3 — Create BUG record
  Build the BUG-NNNN Markdown file content (per docs/work-item-foundation.md §2):
    Front matter: id, type=BUG, title, status=open, lifecycle_state=reported, priority (derived
      from severity: critical/high→high priority; medium→medium; low/info→low), severity, parent_id=null,
      req_ids, module, jira_* fields, created_at, updated_at, created_by_skill=defect-manager.
    Body: Description, Steps to Reproduce, Expected/Actual behavior, Root Cause (null), Acceptance Criteria,
      Definition of Done, empty Audit Trail.
  Write file to: work-items/{bug_id}.md
  Write compressed index entry to state (work_items.items[]).
  Append audit trail entry: { timestamp, actor_skill: defect-manager, from_state: —, to_state: reported, reason: "Defect intake" }
  Output: bug_record, bug_file_path

Step 4 — HITL Gate: Triage
  Present to human: bug_id, title, severity, affected_module, linked_req_ids, source.
  Human confirms: priority (may override), assignment (skip if no team model), or rejects (cancels defect).
  On approval: advance BUG lifecycle_state: reported → triaged.
  Update work-items/{bug_id}.md audit trail.
  On rejection: set lifecycle_state=cancelled, write file, halt chain generation.
  Output: triage_result (approved | rejected), confirmed_priority

Step 5 — Generate companion task chain
  Chain generation rules:
    defect_type=bug (ALL bugs, regardless of severity):
      Generate: INVESTIGATION-{N}, FIX-{N}, TEST-{N}, REVIEW-{N}, VALIDATION-{N}, CLOSURE-{N}
      where N = same number as bug_id (BUG-0001 → all companions use suffix 0001)
    defect_type=missing:
      Generate: FIX-{N}, TEST-{N}, VALIDATION-{N} only (root cause is known; no investigation needed)

  For each companion item:
    Assign id, type, title (derived from BUG title), status=open, lifecycle_state=draft,
    priority=same as BUG, parent_id=bug_id, req_ids=same as BUG, module=same as BUG,
    created_by_skill=defect-manager, jira_issue_type=Sub-task.
    Set appropriate linked_items (child_of BUG, fixes/tests/reviews/validates BUG as applicable).
    Write work-items/{TYPE}-{N}.md
    Write compressed index entry to state.

  Write BUG's linked_items[] back to include all generated chain item IDs.
  Advance BUG lifecycle_state: triaged → investigating.
  Output: chain_items[], chain_file_paths[]

Step 6 — Link traceability
  For each chain item and BUG record, write linked_items[] with all applicable relationships:
    BUG-0001.linked_items:
      - TASK-NNNN (causes, inbound) if linked_task_id was resolved
      - REQ-NNN (fulfills, inbound) for each resolved req_id
      - FIX-0001 (child_of, outbound)
      - INVESTIGATION-0001 (child_of, outbound)
      - TEST-0001 (child_of, outbound)
      - REVIEW-0001 (child_of, outbound)
      - VALIDATION-0001 (child_of, outbound)
      - CLOSURE-0001 (child_of, outbound)
  Update work-items/BUG-NNNN.md with final linked_items front matter.
  Update work-items/index.md (auto-generated summary table).
  Output: traceability_map

Step 7 — Emit event and assemble output
  Increment work_items.sequences.BUG in state.
  Increment work_items.type_counts.BUG (and each chain type) in state.
  Emit event: defect.created
    payload: { bug_id, severity, source_skill: defect_report.source, linked_task_id, chain_item_ids[] }
  Assemble and return output (see Outputs section).
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `bug_id` | `string` | Assigned bug identifier (e.g. `BUG-0001`) |
| `bug_record` | `object` | Full BUG work item (compressed ref matching `work_item_ref` schema) |
| `chain_items` | `array[object]` | All generated companion items (INVESTIGATION, FIX, TEST, REVIEW, VALIDATION, CLOSURE) |
| `chain_item_ids` | `array[string]` | Ordered list of companion IDs |
| `traceability_map` | `object` | Links: `{ bug_id → [req_ids, task_id, chain_ids] }` |
| `triage_result` | `string` | `approved` or `rejected` |
| `files_written` | `array[string]` | Paths of all `.md` files written |
| `metrics` | `object` | Execution metrics |
| `feedback` | `array[object]` | Feedback loop entries |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["bug_id", "bug_record", "chain_items", "chain_item_ids", "traceability_map", "triage_result", "files_written", "metrics", "feedback"],
  "properties": {
    "bug_id": { "type": "string", "pattern": "^BUG-[0-9]{4,}$" },
    "bug_record": { "$ref": "../../../skills/schema/system-state-schema.json#/$defs/work_item_ref" },
    "chain_items": {
      "type": "array",
      "items": { "$ref": "../../../skills/schema/system-state-schema.json#/$defs/work_item_ref" }
    },
    "chain_item_ids": { "type": "array", "items": { "type": "string" } },
    "traceability_map": { "type": "object" },
    "triage_result": { "type": "string", "enum": ["approved", "rejected"] },
    "files_written": { "type": "array", "items": { "type": "string" } },
    "metrics": {
      "type": "object",
      "required": ["tokens_in", "tokens_out", "duration_ms", "items_produced", "version"],
      "properties": {
        "tokens_in":      { "type": "integer" },
        "tokens_out":     { "type": "integer" },
        "duration_ms":    { "type": "integer" },
        "items_produced": { "type": "integer" },
        "version":        { "type": "string" }
      }
    },
    "feedback": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["type", "from_skill", "reason"],
        "properties": {
          "type":          { "type": "string", "enum": ["backpropagate", "info", "warning"] },
          "from_skill":    { "type": "string" },
          "target_skill":  { "type": "string" },
          "reason":        { "type": "string" },
          "evidence":      { "type": "object" }
        }
      }
    }
  }
}
```

## Rules & Constraints

- **ALL bugs trigger the full 6-item chain** (INVESTIGATION + FIX + TEST + REVIEW + VALIDATION + CLOSURE), regardless of severity. There is no severity-based chain scaling.
- **Missings** (source = `implementation-completeness-auditor`, defect_type = `missing`) trigger a 3-item chain (FIX + TEST + VALIDATION) only. No INVESTIGATION or CLOSURE — root cause is known and no human closure gate is needed.
- Chain IDs share the BUG's sequence number. `BUG-0001` → `FIX-0001`, `TEST-0001`, etc. across all companion types.
- The HITL triage gate is **mandatory for all bugs**. The chain MUST NOT be generated until triage is approved.
- A `BUG` MUST NOT transition directly from `reported` to `closed`. The full lifecycle (triage → investigating → fixing → testing → reviewing → validated → closed) must be traversed.
- Every BUG record MUST link to at least one requirement (`linked_req_ids`). If no link can be resolved, emit a `warning` feedback entry and set `req_ids: []` — do not block.
- The `work-items/` directory MUST exist before writing. Create it if absent.
- `work-items/index.md` is auto-generated after every write and reflects the current full item list.
- FIX-NNNN chain items are the execution target for `code-repair` (SKL-029). The orchestrator routes FIX items to the builder agent.
- defect-manager MUST NOT invoke `code-repair` directly — it creates the FIX task; the orchestrator assigns it.
- Maximum 1 open BUG per unique `(title, affected_module)` pair. Duplicate detection: if an identical (title + module) BUG already exists with lifecycle_state ≠ `closed` or `cancelled`, emit a `warning` and return the existing BUG ID instead of creating a duplicate.

## Security Considerations

- Scan `defect_report.description` and `steps_to_reproduce` for credential patterns (API keys, tokens, passwords) before writing to `.md` files. Redact if found; emit a `warning` feedback entry.
- If `source=security-review`, tag the BUG with `jira_labels: ["security", "severity:{value}"]` and set `jira_components: ["security"]`.
- Security-sourced defects require HITL triage even if the caller would prefer to skip it.
- `work-items/` directory contents are project artifacts — do not write to paths outside `work-items/`.

## Token Optimization

- Read only `work_items.sequences` and `work_items.type_counts` from state (not the full `items[]` array) during Step 1.
- Load `architecture.modules[]` as name+description only (omit `public_api`, `files`) during context resolution.
- Load `project_spec.requirements[]` as id+title+acceptance_criteria only during context resolution.
- `chain_items` in output uses compressed `work_item_ref` format (not full detail). Full detail is in the written `.md` files.
- Skip Steps 2 context resolution if all of `affected_module`, `linked_req_ids`, and `linked_task_id` are provided by caller.

## Quality Checklist

- [ ] BUG record has all required front matter fields (id, type, title, status, lifecycle_state, priority, severity, created_at, created_by_skill)
- [ ] Chain items have correct parent_id = bug_id
- [ ] All chain items have linked_items pointing to BUG
- [ ] BUG linked_items[] includes all chain item IDs
- [ ] All `.md` files written to `work-items/` directory
- [ ] `work-items/index.md` updated after writes
- [ ] State `work_items.sequences.BUG` incremented
- [ ] `defect.created` event emitted with correct payload
- [ ] HITL triage gate executed before chain generation
- [ ] Duplicate detection check performed

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| Triage HITL rejected | Set BUG lifecycle_state=cancelled, write file, halt — no chain generated. Return `triage_result: "rejected"`. |
| `work-items/` directory missing | Create directory, continue. |
| `work_items` scope absent from state | Initialize empty `work_items` scope (items=[], sequences={}, type_counts={}), continue. |
| Duplicate BUG detected | Return existing BUG ID, emit `warning` feedback, skip chain generation. |
| Credential pattern found in description | Redact pattern (`[REDACTED]`), emit `warning`, continue with redacted content. |
| State write fails (size limit) | Emit `warning`, write `.md` file only, skip in-state index update — data is preserved on disk. |
| No matching requirement found | Set `req_ids: []`, emit `warning` feedback entry requesting manual linkage. |
| code-repair is unreachable (not in registry) | Create FIX task in `draft` state, emit `warning` — FIX will be manually assigned. |

## 12. Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Behavior |
|------|---------|---------|----------|
| Triage approval | Every defect intake (all bugs, all severities) | 3600s | Present: bug_id, title, severity, affected_module, linked_reqs. Human confirms priority or rejects. Pipeline blocked until response. |
| Closure approval | `CLOSURE-NNNN` task reached (after VALIDATION passes) | 3600s | Present: bug summary, fix summary, test results, validation result. Human approves closure. BUG advances to `closed`. |

- **Triage gate behavior on rejection:** BUG is set to `cancelled`. Chain is NOT generated. Orchestrator receives `triage_result: "rejected"` and continues without defect work.
- **Closure gate behavior on timeout:** BUG remains in `validated` state. A reminder feedback entry is emitted.

## 13. Skill Composition

`defect-manager` is invoked by the orchestrator in the `defect-lifecycle` pipeline and conditionally from `full-pipeline` when `code-repair` escalates:

```yaml
composes:
  - skill: code-repair
    version: "^1.0.0"
    role: executor_for_fix_tasks
    note: "defect-manager creates FIX-NNNN items; orchestrator routes them to code-repair. defect-manager does not invoke code-repair directly."
  - skill: test-generator
    version: "^1.0.0"
    role: executor_for_test_tasks
  - skill: clean-code-review
    version: "^1.1.0"
    role: executor_for_review_tasks
  - skill: state-manager
    version: "^1.1.0"
    role: state_read_write
    scopes: ["work_items", "architecture", "project_spec", "code_map"]

pipeline_entry:
  - pipeline: defect-lifecycle
    phase: phase-1-intake
  - pipeline: full-pipeline
    phase: phase-8d-defect-management (conditional)

event_emissions:
  - event: defect.created
    payload_fields: [bug_id, severity, source_skill, linked_task_id, chain_item_ids]
  - event: defect.resolved
    on: BUG lifecycle_state transitions to "closed" (after CLOSURE-NNNN HITL gate passes)
    payload_fields: [bug_id, fix_id, resolution_type, linked_req_ids]
  - event: work_item.state_changed
    on: every lifecycle_state transition
```

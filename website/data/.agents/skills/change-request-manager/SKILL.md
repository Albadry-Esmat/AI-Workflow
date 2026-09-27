---
name: change-request-manager
version: 1.0.0
domain: lifecycle
description: 'Use when a change request is raised, a requirement changes, or the project scope is modified. Triggers on: "change request", "modify this requirement", "scope change", "CR", "change the spec", "new requirement added", "requirement updated". Do NOT use for bug reports — use defect-manager instead.'
author: system
---

## Purpose

Receive a change request — a new requirement, a modified existing requirement, or a scope reduction — and manage it through a structured lifecycle from intake to execution. The skill runs an impact analysis (via `change-impact-analyzer`) to compute what architecture modules, tasks, and requirements are affected, then presents a HITL gate for human approval before generating the task delta (new tasks, modified tasks, cancelled tasks). The approved delta is fed back into `feature-planning` for re-planning. The skill does NOT modify existing work items directly — it produces a delta that the orchestrator applies, preserving traceability of what changed and why.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `change_request.title` | `string` | Yes | Short description of the change (max 255 chars) |
| `change_request.description` | `string` | Yes | Full description of what is changing and why |
| `change_request.change_scope` | `string` | Yes | `requirement`, `architecture`, `implementation`, or `all` |
| `change_request.affected_requirements` | `array[string]` | No | REQ-IDs being added, modified, or removed |
| `change_request.new_requirements` | `array[object]` | No | New requirements being introduced by this CR |
| `change_request.modified_requirements` | `array[object]` | No | Existing requirements with proposed changes |
| `change_request.removed_requirements` | `array[string]` | No | REQ-IDs being removed from scope |
| `change_request.requestor` | `string` | No | Who raised this CR (skill name or "human") |
| `change_request.priority` | `string` | No | `critical`, `high`, `medium`, `low` (default: `medium`) |
| `change_request.justification` | `string` | No | Business/technical reason for the change |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["change_request"],
  "properties": {
    "change_request": {
      "type": "object",
      "required": ["title", "description", "change_scope"],
      "properties": {
        "title":                    { "type": "string", "maxLength": 255 },
        "description":              { "type": "string", "minLength": 10 },
        "change_scope":             { "type": "string", "enum": ["requirement", "architecture", "implementation", "all"] },
        "affected_requirements":    { "type": "array", "items": { "type": "string" } },
        "new_requirements":         { "type": "array", "items": { "type": "object" } },
        "modified_requirements":    { "type": "array", "items": { "type": "object" } },
        "removed_requirements":     { "type": "array", "items": { "type": "string" } },
        "requestor":                { "type": "string" },
        "priority":                 { "type": "string", "enum": ["critical", "high", "medium", "low"], "default": "medium" },
        "justification":            { "type": "string" }
      }
    }
  }
}
```

## Required Context

- `architecture` scope from state-manager: modules and integration points affected by this CR.
- `work_items` scope from state-manager: current work items (compressed index) to identify what tasks are in scope.
- `project_spec.requirements` from state-manager: existing requirements to validate modification targets.
- `task_graph` scope from state-manager: existing TASK-NNNN items for delta computation.
- `work_items.sequences.CR` from state-manager: to assign next CR sequence number.
- Foundation schema from `docs/work-item-foundation.md`: governs CR lifecycle states and ID patterns.

## Execution Logic

```
Step 1 — Validate and assign CR ID
  Validate all required fields. Reject if title or change_scope is missing.
  Validate affected_requirements: each REQ-ID must exist in project_spec.requirements.
  Validate modified_requirements: each ID must exist; new content must differ from current.
  Load work_items.sequences.CR to determine next ID.
  Assign: cr_id = "CR-{next_sequence_zero_padded_4_digits}"
  Output: validated_cr, cr_id

Step 2 — Create CR record (draft state)
  Build CR-NNNN Markdown file (per docs/work-item-foundation.md §3 CR extension):
    Front matter: id=cr_id, type=CR, title, status=open, lifecycle_state=submitted,
      priority, parent_id=null, linked_items=[], jira_issue_type=Change Request,
      change_scope, affected_requirements, approval_status=pending, created_by_skill=change-request-manager.
    Body: Description, justification, empty Audit Trail.
  Write file to: work-items/{cr_id}.md
  Write compressed index entry to state.
  Emit event: change_request.created
  Output: cr_record, cr_file_path

Step 3 — Run impact analysis
  Invoke change-impact-analyzer (SKL-023) with:
    input: { proposed_change: change_request.description, affected_modules: resolved from affected_requirements, current_architecture: state.architecture }
  Parse impact analysis result:
    - affected_modules[]: which architecture modules are touched
    - affected_tasks[]: which TASK-NNNN items are affected (need modification or cancellation)
    - new_modules_required[]: modules that need to be added to the architecture
    - estimated_effort_delta: story points delta (positive = more work, negative = scope reduction)
    - risk_level: critical | high | medium | low
  Advance CR lifecycle_state: submitted → impact_analysis.
  Update work-items/{cr_id}.md with impact_summary and affected lists.
  Output: impact_analysis_result

Step 4 — HITL Gate: Impact approval
  Present to human:
    - cr_id, title, change_scope
    - Impact summary: modules affected (count + names), tasks affected (count + IDs), effort delta
    - risk_level from impact analysis
    - New/modified/removed requirements list
  Human choices:
    a) Approve — proceed with task delta generation
    b) Approve with modifications — human revises scope (reduces affected list)
    c) Reject — CR cancelled
  On approval: advance CR lifecycle_state: impact_analysis → approved.
  Set approval_status=approved, approved_by_hitl=true.
  Update work-items/{cr_id}.md.
  Emit event: change_request.approved
  On rejection: set lifecycle_state=rejected, approval_status=rejected.
  Write file, halt — no task delta generated.
  Output: approval_result, approved_scope

Step 5 — Generate task delta
  Based on approved_scope, compute:
    new_tasks[]: tasks that must be created to implement the CR
      - For each new requirement: generate task stubs (id=TASK-NNNN, status=pending, req_ids=[new_req_id])
      - Link each new task to CR: linked_items: [{ target_id: cr_id, link_type: fulfills, direction: inbound }]
    modified_tasks[]: existing tasks whose scope changes
      - Each entry: { task_id, change_type: "scope_expanded"|"scope_reduced", delta_description }
      - Do NOT modify the actual TASK-NNNN items directly — delta is passed to feature-planning
    cancelled_tasks[]: tasks that are no longer needed
      - Each entry: { task_id, reason: "requirement_removed"|"superseded_by_cr" }
  Advance CR lifecycle_state: approved → planning.
  Update work-items/{cr_id}.md with task_delta.
  Output: task_delta (new_tasks, modified_tasks, cancelled_tasks)

Step 6 — Backpropagate new requirements (if any)
  If change_request.new_requirements is non-empty:
    Emit feedback entry:
      type: backpropagate
      from_skill: change-request-manager
      target_skill: requirement-analyzer
      reason: "CR-{cr_id} introduces new requirements that must be analyzed and normalized"
      evidence: { cr_id, new_requirements: change_request.new_requirements }
  Emit feedback entry for feature-planning:
    type: backpropagate
    from_skill: change-request-manager
    target_skill: feature-planning
    reason: "CR-{cr_id} approved — re-plan with task delta"
    evidence: { cr_id, task_delta, affected_modules }
  Output: feedback_entries[]

Step 7 — Assemble output
  Update work_items.sequences.CR in state.
  Update work_items.type_counts.CR in state.
  Update work-items/index.md.
  Emit event: work_item.state_changed (for CR lifecycle_state transitions logged above)
  Assemble and return output.
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `cr_id` | `string` | Assigned CR identifier (e.g. `CR-0001`) |
| `cr_record` | `object` | Compressed CR work item reference |
| `impact_analysis` | `object` | Full impact analysis result from change-impact-analyzer |
| `approval_result` | `string` | `approved`, `approved_with_modifications`, or `rejected` |
| `task_delta` | `object` | `{ new_tasks[], modified_tasks[], cancelled_tasks[] }` |
| `files_written` | `array[string]` | Paths of all `.md` files written |
| `metrics` | `object` | Execution metrics |
| `feedback` | `array[object]` | Feedback loop entries (backpropagate to requirement-analyzer and feature-planning) |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["cr_id", "cr_record", "impact_analysis", "approval_result", "task_delta", "files_written", "metrics", "feedback"],
  "properties": {
    "cr_id": { "type": "string", "pattern": "^CR-[0-9]{4,}$" },
    "cr_record": { "$ref": "../../../skills/schema/system-state-schema.json#/$defs/work_item_ref" },
    "impact_analysis": {
      "type": "object",
      "properties": {
        "affected_modules":          { "type": "array", "items": { "type": "string" } },
        "affected_tasks":            { "type": "array", "items": { "type": "string" } },
        "new_modules_required":      { "type": "array", "items": { "type": "string" } },
        "estimated_effort_delta":    { "type": "integer" },
        "risk_level":                { "type": "string", "enum": ["critical", "high", "medium", "low"] }
      }
    },
    "approval_result": { "type": "string", "enum": ["approved", "approved_with_modifications", "rejected"] },
    "task_delta": {
      "type": "object",
      "required": ["new_tasks", "modified_tasks", "cancelled_tasks"],
      "properties": {
        "new_tasks":       { "type": "array", "items": { "type": "object" } },
        "modified_tasks":  { "type": "array", "items": { "type": "object" } },
        "cancelled_tasks": { "type": "array", "items": { "type": "object" } }
      }
    },
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
          "type":         { "type": "string", "enum": ["backpropagate", "info", "warning"] },
          "from_skill":   { "type": "string" },
          "target_skill": { "type": "string" },
          "reason":       { "type": "string" },
          "evidence":     { "type": "object" }
        }
      }
    }
  }
}
```

## Rules & Constraints

- change-request-manager MUST NOT modify existing TASK-NNNN items directly. It produces a `task_delta` that the orchestrator applies by re-invoking `feature-planning`.
- The HITL impact-approval gate is **mandatory**. A CR cannot advance from `impact_analysis` to `approved` without human confirmation.
- `affected_requirements` must contain at least one item OR `new_requirements` must be non-empty. A CR with no requirement changes is invalid.
- Cancelled tasks in `task_delta.cancelled_tasks` must have their work-item lifecycle_state set to `cancelled` by the orchestrator, not by this skill.
- change-request-manager MUST invoke `change-impact-analyzer` (SKL-023) for impact computation. It MUST NOT skip this step even if the caller provides a pre-computed impact.
- A CR that introduces new requirements MUST emit a `backpropagate` feedback entry targeting `requirement-analyzer`. This triggers re-normalization of the new requirements before feature-planning re-plans.
- The maximum feedback loop depth is 3 (orchestrator enforces this). If a CR triggers a chain that exceeds 3 loops, escalate to HITL.
- Duplicate CR detection: if an open CR with the same `affected_requirements` set already exists, emit a `warning` and ask the human to confirm creating a second CR or merging.

## Security Considerations

- Scan `change_request.description` and `justification` for credential patterns before writing to `.md`. Redact if found.
- CRs that affect security-related modules (auth, encryption, data-access) must include a `warning` feedback entry targeting `security-review`, prompting a re-run of security review on the affected modules.
- HITL approval is non-negotiable — no automated approval path is permitted.

## Token Optimization

- Load only `work_items.sequences.CR`, `project_spec.requirements[].id`, and `architecture.modules[].name` from state during Step 1 — no full content loads.
- Impact analysis is delegated to `change-impact-analyzer` (SKL-023) — do not re-derive the impact surface locally.
- `task_delta.new_tasks[]` contains task stubs only (id, title, req_ids, status=pending) — full task design happens in `feature-planning` re-invocation.
- Load `task_graph.tasks[]` as id+req_ids+module only when computing which tasks are affected (not full task objects).

## Quality Checklist

- [ ] CR record has all required front matter fields
- [ ] `change-impact-analyzer` was invoked; impact_analysis result is populated
- [ ] HITL gate executed before task delta generation
- [ ] `task_delta` contains at least one non-empty array (new_tasks, modified_tasks, or cancelled_tasks)
- [ ] All new_tasks in delta have at least one req_id
- [ ] `backpropagate` feedback entries emitted for requirement-analyzer (if new reqs) and feature-planning
- [ ] `change_request.approved` event emitted on approval
- [ ] `work-items/index.md` updated
- [ ] State sequences.CR incremented

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| HITL gate rejected | Set CR lifecycle_state=rejected, write file, return approval_result=rejected, halt. No delta produced. |
| change-impact-analyzer unavailable | Emit `warning`, produce placeholder impact_analysis with risk_level=high, continue to HITL gate with caveat. |
| REQ-ID in affected_requirements not found in state | Emit `warning` feedback, remove the unresolvable ID, continue with valid IDs. |
| No tasks found in task_graph matching affected modules | Emit `info` feedback: "No existing tasks matched — task_delta.modified_tasks is empty. New tasks may be required." |
| Feedback loop limit (3) reached | Escalate to HITL gate: present loop situation, let human decide whether to continue or abandon CR. |
| Duplicate CR detected | Emit `warning`, present existing CR ID to human, pause and request confirmation before proceeding. |

## 12. Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Behavior |
|------|---------|---------|----------|
| Impact approval | After impact_analysis completes (every CR) | 7200s | Present: affected modules, affected tasks count, effort delta, risk level, scope summary. Human approves or rejects. |
| Scope confirmation | If CR introduces new requirements (new_requirements non-empty) | 3600s | Present: new requirements list. Human confirms they are correct before requirement-analyzer re-invocation. |

- Both gates are blocking. Pipeline cannot advance until a decision is made.
- On timeout: CR remains in its current `lifecycle_state`. A reminder `info` feedback entry is emitted every 1 hour.

## 13. Skill Composition

```yaml
composes:
  - skill: change-impact-analyzer
    version: "^1.0.0"
    role: impact_computation
    input_map:
      proposed_change: change_request.description
      affected_modules: resolved_from_affected_requirements
      current_architecture: state.architecture
  - skill: requirement-analyzer
    version: "^1.2.0"
    role: new_requirement_normalization
    trigger: backpropagate feedback (when new_requirements non-empty)
  - skill: feature-planning
    version: "^2.0.0"
    role: re_planning_from_delta
    trigger: backpropagate feedback (after CR approval)
  - skill: state-manager
    version: "^1.1.0"
    role: state_read_write
    scopes: ["work_items", "architecture", "project_spec", "task_graph"]

pipeline_entry:
  - pipeline: change-request
    phase: phase-1-intake

event_emissions:
  - event: change_request.created
    on: Step 2 (CR record created)
  - event: change_request.approved
    on: Step 4 (HITL approval)
  - event: work_item.state_changed
    on: every CR lifecycle_state transition
```

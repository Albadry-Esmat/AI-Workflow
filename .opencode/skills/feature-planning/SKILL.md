---
name: feature-planning
version: 2.1.1
domain: planning
description: 'Use when asked to break down a feature or project into tasks, estimate complexity, map dependencies, define milestones, or build a delivery roadmap. Triggers on: "plan this feature", "break this down", "task breakdown", "roadmap", "milestones", "what are the steps", "sprint planning".'
author: system
---

## Purpose

Translate the architecture design into actionable development tasks. The skill produces a dependency-aware execution plan with complexity estimates, milestone definitions, and delivery phases. It is the bridge between design and implementation.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `requirements` | `array[object]` | Yes | Requirements with id, type, statement, priority |
| `modules` | `array[object]` | Yes | Modules from architecture-design (name, responsibility, dependencies) |
| `integration_points` | `array[object]` | No | Integration contracts from architecture-design |
| `team_capacity` | `object` | No | Available developers, skill sets, velocity (story points per sprint) |
| `milestones` | `array[string]` | No | Desired milestone names or dates |
| `companion_generation` | `object` | No | Controls opt-in companion task generation. Default: `{ enabled: false }`. When disabled (default), output is identical to v1.2.0. |
| `companion_generation.enabled` | `boolean` | No | Set `true` to generate REVIEW/TEST/VALIDATION/DOC companions for every TASK. Default: `false`. |
| `companion_generation.types` | `array[string]` | No | Which companion types to generate. Default: `["REVIEW", "TEST", "VALIDATION"]`. Options: add `"DOC"` for documentation tasks. |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "requirements": { "type": "array", "minItems": 1 },
    "modules": { "type": "array", "minItems": 1 },
    "integration_points": { "type": "array" },
    "team_capacity": {
      "type": "object",
      "properties": {
        "developers": { "type": "integer", "minimum": 1 },
        "velocity_per_sprint": { "type": "integer", "minimum": 1 },
        "sprint_days": { "type": "integer", "minimum": 1 }
      }
    },
    "milestones": { "type": "array", "items": { "type": "string" } },
    "companion_generation": {
      "type": "object",
      "description": "Opt-in companion task generation. Default: disabled. When disabled, output is identical to v1.2.0.",
      "properties": {
        "enabled": { "type": "boolean", "default": false },
        "types": {
          "type": "array",
          "items": { "type": "string", "enum": ["REVIEW", "TEST", "VALIDATION", "DOC"] },
          "default": ["REVIEW", "TEST", "VALIDATION"]
        }
      },
      "default": { "enabled": false }
    }
  },
  "required": ["requirements", "modules"]
}
```

## Required Context

- Output from `architecture-design` (modules, integration points).
- Requirements from `requirement-analyzer` (must include `id` field for REQ→TASK traceability).
- **Graphify retrieval-first:** Before decomposition, run `graphify query "existing task patterns and module decomposition"` if `graphify-out/graph.json` exists. Use retrieved patterns to align task granularity with established conventions and avoid duplicating tasks for already-implemented modules. Fall back to full derivation if graph unavailable.

## Execution Logic

```
Step 0 — Retrieve existing patterns (graphify)
  If graphify-out/graph.json exists: run graphify query "task decomposition and module patterns for <module names>".
  Use retrieved nodes to discover established task granularity and avoid re-decomposing already-implemented modules.
  Fall back to full derivation from modules input if graph unavailable.
  Output: existing_patterns context

Step 1 — Decompose modules into tasks
  For each module, generate granular implementation tasks.
  One task per atomic change (e.g., "Define User entity", "Create POST /users endpoint", "Write unit tests for UserService").
  Output: flat task list with module reference

Step 2 — Assign requirements, DoD, and acceptance criteria
  For each task, link to the requirement(s) it fulfills (req_ids[]).
  Derive definition_of_done: a concrete checklist of conditions the task must satisfy to be considered complete.
    Standard DoD items: "Code implemented", "Unit tests written and passing", "Code reviewed", "Docs updated".
    Add domain-specific items where applicable (e.g., "Schema migrated and rolled back successfully" for DB tasks).
  Derive acceptance_criteria: testable conditions in Given/When/Then or plain-English format.
    Each criterion must be independently verifiable by a test case.
    Example: "Given a valid JWT, when GET /users/:id is called, then the user object is returned with status 200."
  Output: tasks with req_ids, definition_of_done, and acceptance_criteria populated

Step 3 — Estimate complexity
  Assign story points using Fibonacci sequence (1, 2, 3, 5, 8, 13, 21).
  Consider: scope, risk, dependencies, unknowns.
  Output: tasks with complexity estimates and confidence rating

Step 4 — Determine dependencies
  Identify prerequisites for each task (blocked by, blocks).
  Use module dependency map from architecture-design.
  Output: dependency graph with critical path

Step 5 — Group into phases
  Sort tasks into delivery phases.
  Phase 1: Foundation (data models, core API, auth).
  Phase 2: Core features (primary use cases).
  Phase 3: Enhancement (optimization, edge cases).
  Phase 4: Polish (testing, docs, monitoring).
  Output: phased task groups

Step 6 — Assign milestones
  Map phases to milestone names or dates.
  If team_capacity provided, calculate sprint allocation.
  Output: milestone schedule

Step 7 — Build req_task_map and generate roadmap
  Assemble req_task_map: for every requirement ID in input, list the TASK-IDs that fulfill it.
  Every requirement must appear — any requirement with zero tasks is flagged as UNPLANNED risk.
  Combine phases, milestones, dependency graph, and req_task_map into final execution plan.
  Output: complete implementation roadmap with req_task_map

Step 7b — Companion task generation (opt-in; only when companion_generation.enabled = true)
  If companion_generation.enabled is false (default): skip this step entirely. Output unchanged from v1.2.0.
  If companion_generation.enabled is true:
    For each TASK-NNNN in tasks[]:
      For each type in companion_generation.types (default: REVIEW, TEST, VALIDATION):
        Generate companion item:
          id:               "{TYPE}-{SAME_NUMBER_AS_TASK}"  (e.g. TASK-0042 → REVIEW-0042, TEST-0042, VALIDATION-0042)
          type:             REVIEW | TEST | VALIDATION | DOC
          title:            "{type} for: {task.description}" (abbreviated to 200 chars)
          status:           open
          lifecycle_state:  draft
          priority:         same as parent task's complexity-derived priority
          parent_id:        TASK-NNNN
          req_ids:          same as parent task
          module:           same as parent task
          created_by_skill: feature-planning
          linked_items:     [{ target_id: TASK-NNNN, link_type: "reviews"|"tests"|"validates", direction: outbound }]
          file_path:        "work-items/{TYPE}-{NNNN}.md"
        Write companion item to work-items/{TYPE}-{NNNN}.md (per ADR-0001 file-based persistence).
        Write compressed index entry to state work_items.items[].
    Note: companion tasks do NOT count toward the 200-task cap (implementation tasks only).
    Update work_items.sequences for each companion type.
    Update work_items.type_counts for each companion type.
    Update work-items/index.md.
  Assemble companion_tasks[] and work_item_summary output fields.
  Output: companion_tasks[], work_item_summary

Step 7c — Feature folder materialization (always-on)
  Runs for every plan regardless of companion_generation setting.
  For each requirement in requirements[] (ordered: high priority first, then by requirement.id):
    If work-items/features/ already contains a folder whose request.md front matter has req_id = requirement.id:
      Skip creation. Emit info feedback: "Feature folder for {requirement.id} already exists — skipped."
    Else:
      Assign FEATURE identifier:
        Read work_items.sequences.FEATURE from state (default: 0 if absent). Increment by 1.
        Format: FEATURE-{NNN} (3-digit zero-padded, e.g. FEATURE-001).
        Write updated sequence to state immediately (prevents ID collisions on partial runs).
      Build slug from requirement.statement:
        Take first 40 characters. Lowercase. Replace all non-alphanumeric characters with '-'.
        Collapse consecutive hyphens to one. Strip leading and trailing hyphens.
        Example: "User can register with email and password" → "user-can-register-with-email-and"
      Resolve tasks: task_ids = req_task_map[requirement.id] (from Step 7). Filter tasks[] to matching IDs → task_rows.
      Create directory: work-items/features/FEATURE-{NNN}-{slug}/
      Write request.md (follows FEATURE-TEMPLATE/request.md structure):
        ID = FEATURE-{NNN}; Title = requirement.statement (truncated to 80 chars)
        Status = draft; Priority = requirement.priority; req_id = requirement.id
        Problem Statement = requirement.statement (full)
        Acceptance Criteria = requirement.acceptance_criteria[] rendered as "- [ ] {criterion}" lines
          (If acceptance_criteria absent, derive one testable criterion from the statement)
        Out of Scope = "(To be refined during review.)"
      Write plan.md (follows FEATURE-TEMPLATE/plan.md structure):
        Approach = 1-2 sentences derived from module names and task descriptions
        Modules Affected = distinct modules from task_rows[].module
        Tasks table = all task_rows (ID | Description | Complexity | Phase | Status)
        Risks = risks[] entries whose description references a task or module in this feature scope; else "None identified."
      Write tasks.md (follows FEATURE-TEMPLATE/tasks.md structure):
        Tasks table = all task_rows (ID | Description | Status)
      Write status.md (follows FEATURE-TEMPLATE/status.md structure):
        Current status = draft; Last updated = today (ISO YYYY-MM-DD)
        Note task count: "**Tasks:** {count} tasks ({task_ids joined by ', '})"
        Progress checklist: all items unchecked (draft state)
      Append to state work_items.items[]:
        { id: FEATURE-{NNN}, type: FEATURE, title: requirement.statement|truncate(80),
          status: draft, priority: requirement.priority, req_id: requirement.id,
          file_path: "work-items/features/FEATURE-{NNN}-{slug}/request.md" }
  After all requirements processed:
    Rebuild work-items/indexes/features.md (idempotent read→merge→write):
      1. Read existing rows: parse current features.md table → existing_rows[] keyed by FEATURE-NNN ID
         (treat file as empty if absent, blank, or contains only the placeholder row "| — |")
      2. Build new_rows[] for each feature created in this execution (not skipped ones)
      3. Merge: union of existing_rows + new_rows, deduplicated by FEATURE-NNN ID, sorted ascending by ID
      4. Write complete table (replaces entire file):
           "# Feature Index\n\nAll active feature requests for this project.\n\n| ID | Title | Status | Priority |\n|----|-------|--------|----------|\n"
           + one row per merged entry: "| {FEATURE-NNN} | {title|truncate(60)} | {status} | {priority} |"
  Output: feature_folders[] (paths of created folders), feature_count (integer)
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `tasks` | `array[object]` | Atomic tasks (id, module, description, complexity, req_ids, definition_of_done, acceptance_criteria, status) |
| `req_task_map` | `object` | Forward-link map: REQ-ID → [TASK-IDs] that fulfill it — authoritative traceability source |
| `dependency_map` | `object` | Dependency graph with critical path |
| `phases` | `array[object]` | Delivery phases (name, tasks, rationale) |
| `milestones` | `array[object]` | Milestones (name, target, tasks_included, estimated_duration) |
| `risks` | `array[object]` | Planning risks (description, impact, mitigation) |
| `companion_tasks` | `array[object]` | Generated companion work items (REVIEW, TEST, VALIDATION, DOC) linked to implementation tasks. Empty array when `companion_generation.enabled = false`. |
| `work_item_summary` | `object` | Summary counts: total_implementation_tasks, total_companion_tasks, total_work_items, type_breakdown. Null when companion generation disabled. |
| `feature_folders` | `array[string]` | Paths of feature folders created in this execution (one per requirement). Empty array if all folders already existed. |
| `feature_count` | `integer` | Count of feature folders created. 0 if all folders already existed. |
| `metrics` | `object` | Execution metrics (tokens_in, tokens_out, duration_ms, items_produced, version) |
| `feedback` | `array[object]` | Feedback loop entries for cross-skill communication |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "tasks": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": { "type": "string", "pattern": "^TASK-\\d{4}$" },
          "module": { "type": "string" },
          "description": { "type": "string" },
          "complexity": { "type": "integer", "enum": [1, 2, 3, 5, 8, 13, 21] },
          "confidence": { "type": "string", "enum": ["high", "medium", "low"] },
          "req_ids": { "type": "array", "items": { "type": "string" }, "minItems": 1 },
          "requirements": { "type": "array", "items": { "type": "string" }, "description": "Deprecated alias for req_ids — use req_ids for new plans" },
          "blocked_by": { "type": "array", "items": { "type": "string" } },
          "status": { "type": "string", "enum": ["pending", "in_progress", "in_review", "complete", "blocked"], "default": "pending" },
          "definition_of_done": { "type": "array", "items": { "type": "string" }, "minItems": 1 },
          "acceptance_criteria": { "type": "array", "items": { "type": "string" }, "minItems": 1 }
        },
        "required": ["id", "module", "description", "complexity", "req_ids", "definition_of_done", "acceptance_criteria"]
      }
    },
    "req_task_map": {
      "type": "object",
      "description": "Forward-link map: each REQ-ID mapped to array of TASK-IDs that fulfill it — authoritative traceability source for implementation-completeness-auditor",
      "additionalProperties": { "type": "array", "items": { "type": "string" } }
    },
    "dependency_map": {
      "type": "object",
      "properties": {
        "edges": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "from": { "type": "string" },
              "to": { "type": "string" },
              "type": { "type": "string", "enum": ["blocking", "non_blocking"] }
            },
            "required": ["from", "to", "type"]
          }
        },
        "critical_path": { "type": "array", "items": { "type": "string" } }
      }
    },
    "phases": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": { "type": "string" },
          "tasks": { "type": "array", "items": { "type": "string" } },
          "rationale": { "type": "string" }
        },
        "required": ["name", "tasks", "rationale"]
      }
    },
    "milestones": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": { "type": "string" },
          "target": { "type": "string" },
          "tasks_included": { "type": "array", "items": { "type": "string" } },
          "estimated_duration": { "type": "string" }
        },
        "required": ["name", "tasks_included"]
      }
    },
    "risks": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "description": { "type": "string" },
          "impact": { "type": "string", "enum": ["critical", "high", "medium", "low"] },
          "mitigation": { "type": "string" }
        },
        "required": ["description", "impact", "mitigation"]
      }
    },
    "companion_tasks": {
      "type": "array",
      "description": "Generated companion work items. Empty array when companion_generation.enabled=false (default). All items are work_item_ref format — full detail in work-items/ files.",
      "items": { "$ref": "../../schema/system-state-schema.json#/$defs/work_item_ref" }
    },
    "work_item_summary": {
      "type": ["object", "null"],
      "description": "Summary counts when companion_generation.enabled=true. Null when disabled.",
      "properties": {
        "total_implementation_tasks": { "type": "integer" },
        "total_companion_tasks": { "type": "integer" },
        "total_work_items": { "type": "integer" },
        "type_breakdown": {
          "type": "object",
          "additionalProperties": { "type": "integer" }
        }
      }
    },
    "feature_folders": {
      "type": "array",
      "description": "Paths of feature folders created in this execution (one per requirement). Empty array if all already existed.",
      "items": { "type": "string" }
    },
    "feature_count": {
      "type": "integer",
      "description": "Count of feature folders created. 0 if all already existed.",
      "minimum": 0
    },
    "metrics": { "$ref": "#/$defs/metrics" },
    "feedback": { "type": "array", "items": { "$ref": "#/$defs/feedback_entry" } }
  },
  "required": ["tasks", "req_task_map", "dependency_map", "phases", "milestones", "risks", "companion_tasks", "work_item_summary", "feature_folders", "feature_count", "metrics", "feedback"],
  "$defs": {
    "metrics": {
      "type": "object",
      "properties": {
        "tokens_in": { "type": "integer" },
        "tokens_out": { "type": "integer" },
        "duration_ms": { "type": "integer" },
        "items_produced": { "type": "integer" },
        "version": { "type": "string" }
      },
      "required": ["tokens_in", "tokens_out", "duration_ms", "items_produced", "version"]
    },
    "feedback_entry": {
      "type": "object",
      "properties": {
        "type": { "type": "string", "enum": ["backpropagate", "info", "warning"] },
        "from_skill": { "type": "string" },
        "target_skill": { "type": "string" },
        "reason": { "type": "string" },
        "evidence": { "type": "object" }
      },
      "required": ["type", "from_skill", "reason"]
    }
  }
}
```

## Rules & Constraints

- No task larger than 21 story points. Split tasks exceeding 21 into smaller sub-tasks.
- Every task MUST trace to at least one requirement via `req_ids[]`. Tasks with no `req_ids` are rejected.
- Every task MUST include at least one `definition_of_done` item and at least one `acceptance_criteria` entry.
- `req_task_map` MUST include an entry for every requirement in the input. A requirement with zero tasks is flagged as a CRITICAL UNPLANNED risk.
- Critical path MUST be acyclic. Raise error if cycle detected.
- `blocked_by` field MUST only reference task IDs that exist in the same plan.
- Phases MUST be ordered sequentially. No skipping phases.
- Task `status` defaults to `pending`. Only the orchestrator may advance status to `in_review` or `complete`.
- **v2.0.0 backward compatibility:** When `companion_generation.enabled = false` (default), the output of v2.0.0 is **identical** to v1.2.0. `companion_tasks` is an empty array `[]` and `work_item_summary` is `null`. No downstream consumer is broken.
- **Companion ID contract:** Companion IDs MUST share the same numeric suffix as their parent TASK. `TASK-0042` → `REVIEW-0042`, `TEST-0042`, `VALIDATION-0042`, `DOC-0042`. This is a hard constraint — no exception.
- **Companion task cap:** Companion tasks do NOT count toward the 200-task implementation cap. The cap applies only to `tasks[]` (TASK-NNNN items).
- **Companion tasks are draft on creation.** They advance to `ready` when their parent TASK advances to `in_progress`. They advance to `in_progress` when parent TASK advances to `review`. The orchestrator manages these transitions.
- **No duplicate companions:** If a companion file `work-items/{TYPE}-{NNNN}.md` already exists (e.g., from a previous run), skip creation and emit an `info` feedback entry.
- **Step 7c always runs.** Feature folder materialization is unconditional — not gated by `companion_generation` or any other flag. Every `feature-planning` execution creates at minimum one `work-items/features/FEATURE-{NNN}-{slug}/` folder per requirement. Existing folders (detected by `req_id` in `request.md` front matter) are skipped and emitted as `info` feedback entries — never overwritten.
- **FEATURE ID format:** `FEATURE-{NNN}` — 3-digit zero-padded. Assigned from `work_items.sequences.FEATURE` in state; sequence written back immediately after assignment to prevent collisions on partial runs.

## Security Considerations

- Do not include credentials, tokens, or deployment URLs in task descriptions.
- Flag tasks that touch auth, secrets management, or data encryption with `"security_sensitive": true`.

## Token Optimization

- Use `TASK-{NNNN}` short IDs (no hyphens within the number portion).
- Compress module names to 2-letter codes in task IDs (e.g., `USR` for User module).
- Omit `blocked_by` array for tasks with no dependencies (empty array = no block).
- Prune `requirements` input to ID + priority only before processing.
- Cap task count at 200. Split into parallel sub-plans if exceeded.

## Quality Checklist

- [ ] All task IDs unique
- [ ] Every `blocked_by` reference resolves to an existing task ID
- [ ] Every task has `req_ids` with at least one requirement ID
- [ ] Every task has at least one `definition_of_done` item
- [ ] Every task has at least one `acceptance_criteria` entry
- [ ] `req_task_map` contains an entry for every requirement in the input
- [ ] Critical path is computed and present
- [ ] Phase 1 has zero external dependencies (foundation first)
- [ ] No task has complexity 0 or negative
- [ ] All requirements from input are covered by at least one task (via req_task_map)
- [ ] `companion_tasks` is `[]` when `companion_generation.enabled = false` (backward compat)
- [ ] `work_item_summary` is `null` when `companion_generation.enabled = false`
- [ ] When companion generation is enabled: every TASK-NNNN has a companion for each requested type
- [ ] Companion IDs share the same numeric suffix as parent TASK
- [ ] Companion items have `parent_id` set to their TASK's id
- [ ] Companion `.md` files written to `work-items/` when companion generation is enabled
- [ ] `work-items/features/FEATURE-{NNN}-{slug}/` folder created for every requirement in input (or skip logged via `info` feedback)
- [ ] `request.md`, `plan.md`, `tasks.md`, `status.md` written to each created feature folder
- [ ] `work-items/indexes/features.md` reflects all created features (placeholder row removed)
- [ ] `work_items.sequences.FEATURE` incremented correctly (one increment per new folder)
- [ ] `work_items.items[]` state updated with FEATURE-type entries
- [ ] Pre-existing feature folders emitted as `info` feedback entries (not overwritten)

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| Cycle detected in dependency graph | Break cycle by removing lowest-priority edge, flag in risks |
| Input has 0 requirements | Return error: `{"error": "NO_REQUIREMENTS", "message": "feature-planning requires at least one requirement"}` |
| Module from tasks not found in input modules list | Flag orphan tasks, assign to "UNKNOWN" module, emit warning |
| Task count exceeds 200 | Split into Phase 1 (first 200) + deferred phases, flag `"truncated": true` |

## 12. Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Behavior |
|------|---------|---------|----------|
| Roadmap approval | Total story points > 100 OR milestone count > 4 OR any task has `confidence: low` | 3600s | Pause, present task summary and critical path for stakeholder approval |

- Gate presents: phase count, total complexity, critical path, risks.
- If rejected: revise scope, re-run from Step 1.

## 13. Skill Composition

`feature-planning` is a primitive skill. It may be included in a planning meta-skill:

```yaml
  composes:
  - skill: feature-planning
    version: "^2.1.0"
    input_map: { "modules": "architecture_modules", "requirements": "requirements", "companion_generation": "companion_generation" }
    output_map: { "tasks": "implementation_tasks", "req_task_map": "req_task_map", "milestones": "delivery_milestones", "companion_tasks": "companion_tasks", "work_item_summary": "work_item_summary", "feature_folders": "feature_folders", "feature_count": "feature_count" }
  - skill: state-manager
    version: "^1.1.0"
    role: state_read_write
    scopes: ["work_items"]
    note: "Step 7b (companion generation, opt-in): reads work_items.sequences for ID assignment; writes companion items to work_items.items[]; increments sequences/type_counts. Step 7c (feature materialization, always-on): reads/writes work_items.sequences.FEATURE; appends FEATURE entries to work_items.items[]."
```

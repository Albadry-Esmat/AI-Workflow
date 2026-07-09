---
name: task-dag
version: 1.0.0
domain: planning
description: 'Use after feature-planning to analyze task dependencies and produce an executable DAG. Identifies parallel-safe task groups and computes the critical path. Outputs artifacts/task-dag-<timestamp>.json (machine-readable) and artifacts/task-dag-<timestamp>.md (Mermaid diagram). The orchestrator uses the DAG to suggest parallel execution groups. Triggers on: "generate task DAG", "find parallel tasks", "task dependency graph", "critical path", "which tasks can run in parallel".'
author: system
---

## Purpose

Analyze the task breakdown from `feature-planning` to build a directed acyclic graph (DAG) of task dependencies. Tasks that have no data or logical dependencies on each other are grouped as parallel-safe. The critical path — the longest sequence of dependent tasks — is identified and highlighted. The DAG is written to two durable artifacts: a machine-readable JSON file and a human-readable Mermaid flowchart.

The orchestrator reads the DAG to suggest parallel execution groups to the user, reducing perceived delivery time. This skill is strictly read-only — it reads task breakdown output and produces DAG artifacts without modifying any upstream artifact.

This skill was introduced in FEATURE-016 (Auto-Parallel Task DAG) as SKL-113.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `tasks` | `array[object]` | Yes | Task breakdown from `feature-planning`. Each entry: `id` (TASK-NNNN), `description`, `estimated_hours` (optional), `req_ids[]`, `module_refs[]`, `depends_on[]` (explicit upstream TASK IDs). |
| `session_id` | `string` | Yes | UUID v4 of the active pipeline session. |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["tasks", "session_id"],
  "properties": {
    "tasks": {
      "type": "array", "minItems": 1,
      "items": {
        "type": "object",
        "required": ["id", "description"],
        "properties": {
          "id":           { "type": "string", "pattern": "^TASK-\\d{4}$" },
          "description":  { "type": "string" },
          "estimated_hours": { "type": "number", "minimum": 0 },
          "req_ids":      { "type": "array", "items": { "type": "string" } },
          "module_refs":  { "type": "array", "items": { "type": "string" } },
          "depends_on":   { "type": "array", "items": { "type": "string", "pattern": "^TASK-\\d{4}$" } }
        }
      }
    },
    "session_id": { "type": "string", "format": "uuid" }
  }
}
```

## Required Context

- Task breakdown from `feature-planning` (SKL-003). The `depends_on[]` field on each task provides explicit dependency declarations. The `description`, `req_ids[]`, and `module_refs[]` fields are used for semantic dependency inference when explicit declarations are absent.
- `session_id` from orchestrator session context.

## Execution Logic

```
Step 1 — Validate and ingest tasks
  Validate every task ID against ^TASK-\d{4}$.
  Non-conforming IDs: emit WARN: id_format_violation, skip task.
  Detect duplicate task IDs: deduplicate (first wins), emit WARN: duplicate_task_id.
  Build task_map: { task_id → task_object }

Step 2 — Build explicit dependency edges
  For each task T in tasks[]:
    For each dep_id in T.depends_on[]:
      Validate dep_id format. If invalid: emit WARN: invalid_depends_on_id, skip edge.
      If dep_id not in task_map: emit WARN: unknown_dependency { from: T.id, to: dep_id }, skip edge.
      If valid: add directed edge T.id → dep_id to edge_set (T depends on dep_id).
  Represent as adjacency list: predecessors_of[task_id] = [task_ids that must complete first]

Step 3 — Semantic dependency inference (for tasks with no explicit depends_on)
  For each task T with depends_on[] empty or absent:
    Scan T.description for TASK-NNNN tokens. For each found token matching a task in task_map:
      Add inferred edge. Record in inference_log: { from: T.id, inferred_dep: token, source: "description_token_scan" }
    If T.module_refs overlaps with another task U's module_refs AND T.req_ids overlaps U.req_ids:
      Add inferred edge T → U (T depends on U, assuming same-module same-req work must sequence).
      Record in inference_log with source: "shared_module_and_req"
  Inferred edges are marked is_inferred: true in the output.

Step 4 — Cycle detection (topological sort)
  Perform Kahn's algorithm (BFS topological sort) on the full edge set.
  If topological sort fails (cycle detected):
    Identify the cycle(s) using DFS back-edge detection.
    Emit error: dependency_cycle { cycle: [task_ids in cycle] } for each cycle.
    Remove ALL edges in the cycle (break cycles by removing the inferred edge first; if no
      inferred edge exists, remove the lexicographically last explicit edge in the cycle).
    Emit WARN: cycle_broken { removed_edge: { from, to }, reason: "cycle_resolution" }
    Re-run topological sort until no cycles remain.
  topological_order: array of task_ids in dependency-resolved execution order.

Step 5 — Identify parallel groups
  Assign each task a level:
    Level 0: tasks with no predecessors (entry tasks).
    Level N: tasks whose all predecessors are at level ≤ N-1.
    (Use BFS from entry tasks, tracking max predecessor level + 1 for each task)
  parallel_groups[]: array indexed by level:
    Each group: { level, tasks: [task_ids], can_run_parallel: true }
  Tasks within the same level have no dependency between them and are parallel-safe.

Step 6 — Compute critical path
  For each task T, compute earliest_start and earliest_finish:
    If estimated_hours absent: use default_duration = 4 hours.
    earliest_start[T] = max(earliest_finish[pred] for pred in predecessors_of[T])
    earliest_finish[T] = earliest_start[T] + (T.estimated_hours ?? 4)
  Critical path: the sequence of tasks forming the longest-duration path from any Level 0 task
    to any terminal task (no successors).
  total_duration_hours: sum of estimated_hours along critical path.
  critical_path_task_ids[]: ordered array of task IDs on the critical path.

Step 7 — Assemble DAG JSON output
  dag_nodes[]: one entry per task:
    { task_id, description, level, is_critical_path, estimated_hours,
      predecessors[], successors[], is_inferred: boolean,
      earliest_start_hours, earliest_finish_hours }
  dag_edges[]: one entry per edge:
    { from, to, is_inferred }
  parallel_groups[]: as computed in Step 5
  critical_path: { task_ids[], total_duration_hours }

Step 8 — Generate Mermaid diagram
  Produce a Mermaid flowchart LR (left-to-right) diagram:
    graph LR
      For each task: <TASK-ID>["TASK-ID: <description_truncated_to_40_chars>"]
      Style critical path nodes: style TASK-XXXX fill:#f96,stroke:#c00 (orange-red)
      Style parallel-safe entry nodes: style TASK-XXXX fill:#9f9,stroke:#090 (green)
      For each edge: from --> to (explicit) or from -.-> to (inferred, dashed)
  Limit diagram to 50 tasks max. If tasks.length > 50: include only critical path +
    Level 0 and Level 1 nodes. Emit WARN: dag_diagram_truncated { total_tasks, included_tasks }.

Step 9 — Write artifacts
  Timestamp: ISO 8601 with colons as hyphens.
  If artifacts/ does not exist: create silently.

  Write artifacts/task-dag-<timestamp>.json: full dag_nodes[], dag_edges[],
    parallel_groups[], critical_path, inference_log[], run_id, skill, timestamp.
  Write artifacts/task-dag-<timestamp>.md:
    # Task DAG — <session_id>
    ## Critical Path (total <total_duration_hours>h)
    (ordered list of critical path task IDs and descriptions)
    ## Parallel Groups
    (table: Level | Tasks | Parallel-safe)
    ## Mermaid Diagram
    ```mermaid
    <mermaid_content>
    ```
    ## Inferred Edges
    (table of inferred edges with inference source)
  Update symlink artifacts/task-dag-latest.json → artifacts/task-dag-<timestamp>.json.
  Output: md_artifact_path, json_artifact_path

Step 10 — Emit telemetry and return
  Emit INFO: task_dag_written { total_tasks, parallel_groups_count, critical_path_length,
    total_duration_hours, md_artifact_path, json_artifact_path }
  Return complete output object.
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `dag_nodes` | `array[object]` | One node per task: `task_id`, `level`, `is_critical_path`, `estimated_hours`, `predecessors[]`, `successors[]`, `is_inferred`, `earliest_start_hours`, `earliest_finish_hours`. |
| `dag_edges` | `array[object]` | All dependency edges: `from`, `to`, `is_inferred`. |
| `parallel_groups` | `array[object]` | Groups of parallel-safe tasks: `level`, `tasks[]`, `can_run_parallel: true`. |
| `critical_path` | `object` | `task_ids[]` (ordered), `total_duration_hours`. |
| `inference_log` | `array[object]` | Records of semantically inferred edges. |
| `md_artifact_path` | `string` | Relative path to Mermaid Markdown artifact. |
| `json_artifact_path` | `string` | Relative path to JSON DAG artifact. |
| `metrics` | `object` | `tokens_in`, `tokens_out`, `duration_ms`, `items_produced` (total tasks), `version`. |

## Rules & Constraints

1. **DAG invariant.** The output MUST be cycle-free. Cycles detected in input data MUST be broken before producing output. The cycle-breaking strategy is: remove inferred edges first, then lexicographically last explicit edge.
2. **Level assignment is deterministic.** Within a parallel group, task ordering is by `task_id` lexicographically to ensure reproducible output.
3. **Default duration is 4 hours.** When `estimated_hours` is absent, 4 hours is used for critical path calculation. This is noted in the artifact header.
4. **Inferred edges are non-authoritative.** The `is_inferred: true` flag MUST be set on inferred edges. They are removable by HITL feedback without affecting explicit edges.
5. **Diagram cap at 50 tasks.** Mermaid diagrams beyond 50 nodes become unreadable. Diagrams are truncated to critical path + level 0/1. The full DAG is always available in the JSON artifact.
6. **Single run scope.** The DAG covers only tasks from the current pipeline run. Cross-run or historical DAG merging is out of scope.
7. **Read-only.** This skill MUST NOT modify `feature-planning` output or any other upstream artifact.

## Security Considerations

- **No code execution.** Task descriptions may contain code snippets. Treat all strings as data — never execute or evaluate them.
- **PII stripping.** Task descriptions written to artifact files are PII-stripped before writing (email, phone, name patterns → `[REDACTED]`).
- **Path safety.** Artifact path is `artifacts/task-dag-<ISO-timestamp>.*`. Task IDs and descriptions MUST NOT influence the output directory.
- **Credential detection.** Any credential-pattern value in input emits `WARN: credential_in_input`, is redacted, and processing continues.

## Token Optimization

- **Project tasks before processing.** Retain only `id`, `description`, `estimated_hours`, `depends_on[]`, `module_refs[]`, `req_ids[]` per task during all steps.
- **Skip semantic inference for tasks with explicit depends_on.** Only run semantic inference for tasks where `depends_on[]` is empty or absent.
- **Mermaid truncation.** For large task sets, produce the truncated Mermaid (≤50 nodes). The full structural data is in the JSON artifact — do not inflate the Mermaid at the cost of tokens.
- **Inference log compression.** If more than 20 inferred edges, include only the first 20 in the inference_log returned to orchestrator. The full log is in the JSON artifact.

## Quality Checklist

- [ ] Every task from input appears in `dag_nodes[]` exactly once
- [ ] No cycles in `dag_nodes[]` / `dag_edges[]`
- [ ] `critical_path.task_ids[]` forms a valid path from a level-0 node to a terminal node
- [ ] `critical_path.total_duration_hours` equals sum of `estimated_hours` along the critical path
- [ ] All nodes on the critical path have `is_critical_path: true`
- [ ] Every `parallel_groups[N].tasks[]` contains only tasks at level N
- [ ] No task appears in more than one parallel group
- [ ] All `dag_edges[]` reference valid task IDs in `dag_nodes[]`
- [ ] Inferred edges have `is_inferred: true`
- [ ] JSON artifact parses without error
- [ ] `artifacts/task-dag-latest.json` symlink updated
- [ ] Mermaid diagram syntax is valid (no unclosed brackets, correct arrow syntax)

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| `tasks[]` empty or absent | Hard error: `{"error": "EMPTY_TASKS"}`. Halt. No artifacts written. |
| All tasks have no dependencies | Produce single-level DAG (all tasks at level 0, all parallel-safe). |
| Dependency cycle detected | Break cycle per rules, emit `WARN: cycle_broken`, continue. |
| Unknown `depends_on` reference | Skip edge, emit `WARN: unknown_dependency`. |
| `tasks.length > 500` | Process first 500 sorted by `task_id`. Emit `WARN: tasks_truncated`. |
| JSON serialization failure | Retry once. Write Markdown only if retry fails. |

## Human-in-the-Loop Gates

This skill is fully automated. No HITL gate is defined. The DAG and parallel group suggestions are advisory — the user decides which tasks to actually parallelize.

The orchestrator presents the `parallel_groups` summary to the user as a recommendation at pipeline completion (not as a blocking gate). The user may disregard the suggestions without consequence.

| Gate | Trigger | Timeout | Behavior |
|------|---------|---------|----------|
| None | — | — | Fully automated. |

## Skill Composition

`task-dag` v1.0.0 runs after `feature-planning` and before `code-generator` in the full pipeline. It inserts between `phase-3-planning` and `phase-4-impact-analysis`.

```yaml
composes:
  - skill: feature-planning
    version: "^2.2.0"
    output_map:
      tasks: "feature_plan.tasks"

  - skill: task-dag
    version: "^1.0.0"
    triggered_by: feature-planning
    input_map:
      tasks:      "feature_plan.tasks"
      session_id: "session.id"
    output_map:
      json_artifact_path: "task_dag_artifact_path"
      parallel_groups:    "task_parallel_groups"
      critical_path:      "task_critical_path"

downstream:
  - code-generator   # receives parallel_groups as advisory context
  - orchestrator     # reads parallel_groups to suggest parallel execution to user

upstream:
  - feature-planning@^2.2.0  # provides tasks[].depends_on[], tasks[].estimated_hours
```

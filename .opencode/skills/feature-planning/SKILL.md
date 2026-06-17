---
name: feature-planning
version: 1.1.0
domain: planning
description: Use when asked to break down a feature or project into tasks, estimate complexity, map dependencies, define milestones, or build a delivery roadmap. Triggers on: "plan this feature", "break this down", "task breakdown", "roadmap", "milestones", "what are the steps", "sprint planning".
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
    "milestones": { "type": "array", "items": { "type": "string" } }
  },
  "required": ["requirements", "modules"]
}
```

## Required Context

- Output from `architecture-design` (modules, integration points).
- Requirements from `requirement-analyzer`.

## Execution Logic

```
Step 1 — Decompose modules into tasks
  For each module, generate granular implementation tasks.
  One task per atomic change (e.g., "Define User entity", "Create POST /users endpoint", "Write unit tests for UserService").
  Output: flat task list with module reference

Step 2 — Assign requirements to tasks
  Link each task to the requirement(s) it fulfills.
  Output: tasks with requirement traceability

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

Step 7 — Generate roadmap
  Combine phases, milestones, and dependencies into final execution plan.
  Output: complete implementation roadmap
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `tasks` | `array[object]` | Atomic tasks (id, module, description, complexity, requirements) |
| `dependency_map` | `object` | Dependency graph with critical path |
| `phases` | `array[object]` | Delivery phases (name, tasks, rationale) |
| `milestones` | `array[object]` | Milestones (name, target, tasks_included, estimated_duration) |
| `risks` | `array[object]` | Planning risks (description, impact, mitigation) |
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
          "requirements": { "type": "array", "items": { "type": "string" } },
          "blocked_by": { "type": "array", "items": { "type": "string" } }
        },
        "required": ["id", "module", "description", "complexity", "requirements"]
      }
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
    "metrics": { "$ref": "#/$defs/metrics" },
    "feedback": { "type": "array", "items": { "$ref": "#/$defs/feedback_entry" } }
  },
  "required": ["tasks", "dependency_map", "phases", "milestones", "risks", "metrics", "feedback"],
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
- Every task MUST trace to at least one requirement.
- Critical path MUST be acyclic. Raise error if cycle detected.
- `blocked_by` field MUST only reference task IDs that exist in the same plan.
- Phases MUST be ordered sequentially. No skipping phases.

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
- [ ] Critical path is computed and present
- [ ] Phase 1 has zero external dependencies (foundation first)
- [ ] No task has complexity 0 or negative
- [ ] All requirements from input are covered by at least one task

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
    version: "^1.1.0"
    input_map: { "modules": "architecture_modules", "requirements": "requirements" }
    output_map: { "tasks": "implementation_tasks", "milestones": "delivery_milestones" }
```

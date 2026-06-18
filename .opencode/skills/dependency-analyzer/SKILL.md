---
name: dependency-analyzer
version: 1.1.0
domain: architecture
description: 'Use when analyzing module or library dependency graphs, detecting cycles, finding affected modules, or computing ripple effects of a change. Triggers on: "analyze dependencies", "what depends on this", "dependency graph", "find affected modules", "ripple effect", "dependency cycle".'
author: system
---

## Purpose

Build and maintain a directed dependency graph across modules, files, and libraries. For any change, the skill computes the full set of affected modules, API surfaces, and transitive downstream consumers. It is invoked before any modification to ensure the impact surface is known before execution begins, and continuously to keep the system's dependency graph synchronized with the actual codebase structure.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `operation` | `string` | Yes | `build`, `update`, `query`, or `cycle_check` |
| `code_map` | `object` | No | Current code map (file tree with module assignments). Required for `build`. |
| `changed_files` | `array[string]` | No | File paths that changed. Required for `update` and `query`. |
| `query_target` | `string` | No | Module or file name to query dependents/dependencies for. Required for `query`. |
| `modules` | `array[object]` | No | Module definitions from architecture-design output. Required for `build`. |
| `existing_graph` | `object` | No | Previously built dependency graph to update incrementally. |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "operation": { "type": "string", "enum": ["build", "update", "query", "cycle_check"] },
    "code_map": { "type": "object" },
    "changed_files": { "type": "array", "items": { "type": "string" } },
    "query_target": { "type": "string" },
    "modules": { "type": "array" },
    "existing_graph": { "type": "object" }
  },
  "required": ["operation"]
}
```

## Required Context

- Architecture modules from `architecture-design` (SKL-002) output — required for `build`.
- Current code map from system state (`state-manager` read of `code_map` scope).
- **Retrieval-first (graphify):** For `query` and `cycle_check` operations, first attempt `graphify query "<query_target>"` or `graphify path "<A>" "<B>"` to obtain a scoped subgraph. This avoids loading the full dependency_graph from state (token savings: ~60–80% on iterative sessions). Fall back to full state load only if `graphify-out/graph.json` is absent or the query returns no results.

## Execution Logic

```
Step 1 — Validate operation inputs
  build:      Require code_map and modules.
  update:     Require changed_files and existing_graph.
  query:      Require query_target.
  cycle_check: Require existing_graph or code_map.
  Output: validated inputs

Step 2 — Build or load graph
  build:   Parse every file in code_map. Extract import/require/use statements.
           Map each import to its owning module. Build directed edges (importer → imported).
           Classify edges: internal (same module), cross-module, external (library).
  update:  Load existing_graph. For each changed file, re-parse imports.
           Remove stale edges from changed files. Add new edges.
  query/cycle_check:
           Retrieval-first: Run `graphify query "<query_target>"` to get scoped subgraph.
           If graphify unavailable or returns 0 nodes: load existing_graph from
             state-manager (scope: "dependency_graph") as fallback.
  Output: dependency_graph

Step 3 — Detect cycles
  Run DFS cycle detection on the full graph.
  Report all cycles as ordered node lists.
  Classify cycle severity: within-module (warning), cross-module (error), circular library (info).
  Output: cycle_report

Step 4 — Query affected modules (for update and query operations)
  Given changed_files or query_target: traverse graph to find all transitive dependents.
  Classify each affected module: direct (depth 1), transitive (depth 2+).
  Compute ripple depth (max distance from change origin).
  Output: affected_modules list

Step 5 — Assemble output
  Return dependency_graph, cycle_report, affected_modules, graph_stats.
  Output: final result
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `dependency_graph` | `object` | Full directed graph: `{ nodes: [...], edges: [{ from, to, type, depth }] }` |
| `affected_modules` | `array[object]` | Modules affected by the queried change: `{ name, depth, reason }` |
| `cycle_report` | `object` | `{ cycles: [[...]], severity: string }` — empty if no cycles |
| `graph_stats` | `object` | Node count, edge count, max depth, critical path |
| `metrics` | `object` | Execution metrics |
| `feedback` | `array[object]` | Feedback entries |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "dependency_graph": {
      "type": "object",
      "properties": {
        "nodes": { "type": "array" },
        "edges": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "from": { "type": "string" },
              "to": { "type": "string" },
              "type": { "type": "string", "enum": ["internal", "cross-module", "external"] },
              "depth": { "type": "integer" }
            },
            "required": ["from", "to", "type"]
          }
        }
      },
      "required": ["nodes", "edges"]
    },
    "affected_modules": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": { "type": "string" },
          "depth": { "type": "integer" },
          "reason": { "type": "string" }
        },
        "required": ["name", "depth", "reason"]
      }
    },
    "cycle_report": {
      "type": "object",
      "properties": {
        "cycles": { "type": "array", "items": { "type": "array", "items": { "type": "string" } } },
        "severity": { "type": "string", "enum": ["none", "warning", "error"] }
      },
      "required": ["cycles", "severity"]
    },
    "graph_stats": { "type": "object" },
    "metrics": { "$ref": "#/$defs/metrics" },
    "feedback": { "type": "array", "items": { "$ref": "#/$defs/feedback_entry" } }
  },
  "required": ["dependency_graph", "affected_modules", "cycle_report", "graph_stats", "metrics", "feedback"],
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

- Cross-module circular dependencies are errors — they must be reported and block downstream execution.
- Within-module cycles are warnings — reported but do not block.
- `affected_modules` traversal is capped at depth 10 to prevent runaway computation on large codebases.
- External library edges are tracked but not traversed for ripple analysis.
- Graph must be updated after every `code.changed` event before any downstream skill executes.

## Security Considerations

- Do not expose absolute file system paths in graph nodes — use project-relative paths only.
- Dependency graph is read-only for all skills except `state-manager` and this skill.

## Token Optimization

- For `query` operations, return only the `affected_modules` list — omit the full graph.
- For `update` operations, return only the diff (new nodes/edges, removed nodes/edges).
- Graph nodes use short IDs (module name only), not full metadata objects.

## Quality Checklist

- [ ] Cycle detection runs on every build or update
- [ ] All required inputs are validated before graph traversal
- [ ] affected_modules includes depth and reason for every entry
- [ ] cycle_report severity is correctly classified
- [ ] Graph stats include node count, edge count, max depth

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| code_map absent for build | Reject: `{"error": "MISSING_CODE_MAP"}` |
| Cross-module cycle detected | Return cycle_report with severity=error, emit backpropagate feedback to architecture-design |
| query_target not found in graph | Return empty affected_modules with info feedback |
| Graph traversal exceeds depth 10 | Truncate at depth 10, set `"truncated": true` in graph_stats |

## 12. Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Behavior |
|------|---------|---------|----------|
| Cross-module cycle detected | `cycle_report.severity === "error"` | 1800s | Pause pipeline, present cycle path to architect for resolution |

## 13. Skill Composition

`dependency-analyzer` feeds `change-impact-analyzer` as a prerequisite:

```yaml
composes:
  - skill: dependency-analyzer
    version: "^1.0.0"
    input_map: { "operation": "query", "query_target": "changed_module" }
    output_map: { "affected_modules": "impact_modules" }
```

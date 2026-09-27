---
name: multi-repo-coordinator
version: 1.0.0
domain: architecture
description: 'Use when analyzing cross-repository dependency impact, coordinating breaking changes across multiple services or shared libraries in a polyrepo architecture, or generating synchronized work items for each affected repository. Triggers on: "analyze cross-repo impact", "multi-repo coordinator", "breaking change affects multiple repos". Do NOT use for single-repository projects or intra-repo dependency analysis — use dependency-analyzer instead.'
author: system
---

## Purpose

multi-repo-coordinator maintains a cross-repo dependency registry across polyrepo microservice systems, detects breaking changes that ripple across service boundaries, topologically sequences a safe migration plan, and generates synchronized work item stubs for each affected repository. It bridges the gap between `dependency-analyzer` (intra-repo) and the real-world reality of shared libraries consumed by multiple independent services — each in its own repo — with no automatic cross-repo impact signalling.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `operation` | `string` | Yes | `"register"` \| `"analyze-impact"` \| `"sync-work-items"` \| `"query"` |
| `primary_repo` | `object` | Yes | Repo under change: `name`, `type` (library/service/api), `current_version` |
| `change_description` | `object` | No | Change-impact-analyzer output — required for `analyze-impact` |
| `repo_registry` | `array` | No | List of repos and declared dependencies — used in `register` batch upserts |
| `breaking_changes` | `array` | No | Detected breaking API/interface changes — required for `analyze-impact` |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "operation": {
      "type": "string",
      "enum": ["register", "analyze-impact", "sync-work-items", "query"]
    },
    "primary_repo": {
      "type": "object",
      "properties": {
        "name":            { "type": "string" },
        "type":            { "type": "string", "enum": ["library", "service", "api"] },
        "current_version": { "type": "string" }
      },
      "required": ["name", "type", "current_version"]
    },
    "change_description": { "type": "object" },
    "repo_registry": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name":         { "type": "string" },
          "type":         { "type": "string", "enum": ["library", "service", "api"] },
          "dependencies": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "name":               { "type": "string" },
                "version_constraint": { "type": "string" }
              },
              "required": ["name", "version_constraint"]
            }
          }
        },
        "required": ["name", "type"]
      }
    },
    "breaking_changes": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "interface_name": { "type": "string" },
          "change_type":    { "type": "string", "enum": ["removed", "signature-changed", "behaviour-changed", "additive"] },
          "description":    { "type": "string" }
        },
        "required": ["interface_name", "change_type"]
      }
    }
  },
  "required": ["operation", "primary_repo"]
}
```

## Required Context

- Cross-repo registry must be seeded via one or more `register` operations before `analyze-impact` can produce meaningful results.
- `breaking_changes` array must be supplied for `analyze-impact` operations; it is typically sourced from `change-impact-analyzer` output.
- `change_description` from `change-impact-analyzer` must be provided when `operation == "analyze-impact"` for full context.
- state-manager must be accessible for reading and writing `cross_repo_registry` under the project-level scope.

## Execution Logic

```
Step 1 — Load cross-repo registry
  Read state_manager["cross_repo_registry"] (project-level scope).
  If no entry exists: initialise cross_repo_registry as an empty array.
  Output: current_registry[]

Step 2 — Dispatch operation

  [register]
    Validate primary_repo: name, type, current_version all present.
    If repo_registry is supplied: process each entry as a batch upsert.
    For each repo to upsert:
      If repo.name already exists in current_registry: update dependencies + last_updated.
      Else: append new entry with last_updated = now().
    Write updated registry to state_manager["cross_repo_registry"].
    Output: cross_repo_registry (updated)

  [analyze-impact]
    Require breaking_changes to be non-empty; reject if absent.
    Build consumer_graph:
      For each repo in current_registry: check if primary_repo.name appears in repo.dependencies[].name.
      Collect all matching repos as consumers of primary_repo.
    Assess impact_severity per consumer per breaking_change:
      change_type == "removed"            → critical
      change_type == "signature-changed"  → high
      change_type == "behaviour-changed"  → medium
      change_type == "additive"           → low
    Determine risk_level:
      Any consumer has critical → risk_level = critical
      No critical but any high  → risk_level = high
      All medium/low            → risk_level = medium or low accordingly
    Output: consumer_graph, impact_report { affected_repos[], unaffected_repos[], risk_level }

  [sync-work-items]
    Require impact_report to be present in session state or provided via change_description.
    For each repo in impact_report.affected_repos:
      Generate work_item_stub:
        title:          "[<repo_name>] Update dependency on <primary_repo.name>@<current_version>"
        description:    "Affected interfaces: <affected_interfaces[]>. Required changes: <required_changes[]>"
        cross_ref_link: "<primary_repo.name>:<current_version>:<change_id>"
        affected_interfaces: from impact_report entry
        suggested_fix:  guidance string based on change_type
    Output: synchronized_work_items[]

  [query]
    Filter current_registry by primary_repo.name (exact match) or primary_repo.type (type filter).
    Return matching entries.
    Output: cross_repo_registry (filtered subset)

Step 3 — Circular dependency detection  [analyze-impact only]
  Run DFS cycle detection on consumer_graph (directed graph of repo → dependency edges).
  If cycle found:
    Classify as critical_risk.
    Emit feedback: type=backpropagate, reason=circular_cross_repo_dependency_detected,
      evidence={ cycle_path: [...], primary_repo: name }.
    Add block note to impact_report.
  Output: cycle_report { has_cycle: boolean, cycle_path: [] }

Step 4 — Topological sort  [analyze-impact only, non-cycle nodes only]
  Apply Kahn's algorithm to consumer_graph (excluding cycle nodes):
    In-degree calculation: repos with no upstream dependencies first.
    Process BFS queue until all reachable nodes are sorted.
  Append primary_repo last (it is the source of all changes).
  Generate rationale: "Repos with no upstream consumers updated first to prevent cascading failures."
  Output: migration_coordination_plan { update_sequence[], rationale }

Step 5 — HITL gate check  [analyze-impact only]
  If impact_report.risk_level == "high" or "critical":
    Emit feedback: type=backpropagate, target_skill=orchestrator,
      reason="high_impact_cross_repo_change: {N} repos affected at {risk_level} risk",
      evidence={ impact_report, affected_count: N }.
    Pipeline must pause for human review before sync-work-items proceeds.
  Output: feedback entries
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `cross_repo_registry` | `array[object]` | All tracked repos: `repo_name`, `type`, `dependencies[]`, `last_updated` |
| `impact_report` | `object` | For analyze-impact: `affected_repos[]`, `unaffected_repos[]`, `risk_level` |
| `synchronized_work_items` | `array[object]` | Work item stubs per affected repo with cross-reference links |
| `migration_coordination_plan` | `object` | `update_sequence[]` (topologically safe order) + `rationale` |
| `metrics` | `object` | **REQUIRED.** Execution metrics |
| `feedback` | `array[object]` | **REQUIRED.** Feedback loop entries |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "cross_repo_registry": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "repo_name":       { "type": "string" },
          "type":            { "type": "string", "enum": ["library", "service", "api"] },
          "current_version": { "type": "string" },
          "dependencies": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "name":               { "type": "string" },
                "version_constraint": { "type": "string" }
              }
            }
          },
          "last_updated": { "type": "string", "format": "date-time" }
        },
        "required": ["repo_name", "type", "last_updated"]
      }
    },
    "impact_report": {
      "type": "object",
      "properties": {
        "affected_repos": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "repo_name":           { "type": "string" },
              "impact_severity":     { "type": "string", "enum": ["critical", "high", "medium", "low"] },
              "affected_interfaces": { "type": "array", "items": { "type": "string" } },
              "required_changes":    { "type": "array", "items": { "type": "string" } }
            },
            "required": ["repo_name", "impact_severity"]
          }
        },
        "unaffected_repos": { "type": "array", "items": { "type": "string" } },
        "risk_level":       { "type": "string", "enum": ["low", "medium", "high", "critical"] }
      }
    },
    "synchronized_work_items": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "repo_name":             { "type": "string" },
          "title":                 { "type": "string" },
          "description":           { "type": "string" },
          "cross_ref_link":        { "type": "string" },
          "affected_interfaces":   { "type": "array", "items": { "type": "string" } },
          "suggested_fix":         { "type": "string" }
        },
        "required": ["repo_name", "title", "cross_ref_link"]
      }
    },
    "migration_coordination_plan": {
      "type": "object",
      "properties": {
        "update_sequence": { "type": "array", "items": { "type": "string" } },
        "rationale":       { "type": "string" }
      }
    },
    "metrics":  { "$ref": "#/$defs/metrics" },
    "feedback": { "type": "array", "items": { "$ref": "#/$defs/feedback_entry" } }
  },
  "required": ["cross_repo_registry", "metrics", "feedback"],
  "$defs": {
    "metrics": {
      "type": "object",
      "properties": {
        "tokens_in":      { "type": "integer" },
        "tokens_out":     { "type": "integer" },
        "duration_ms":    { "type": "integer" },
        "items_produced": { "type": "integer" },
        "version":        { "type": "string" }
      },
      "required": ["tokens_in", "tokens_out", "duration_ms", "items_produced", "version"]
    },
    "feedback_entry": {
      "type": "object",
      "properties": {
        "type":         { "type": "string", "enum": ["backpropagate", "info", "warning"] },
        "from_skill":   { "type": "string" },
        "target_skill": { "type": "string" },
        "reason":       { "type": "string" },
        "evidence":     { "type": "object" }
      },
      "required": ["type", "from_skill", "reason"]
    }
  }
}
```

## Rules & Constraints

- `analyze-impact` MUST NOT execute if `breaking_changes` is absent or empty — reject with `MISSING_BREAKING_CHANGES` error.
- `sync-work-items` MUST NOT execute without a preceding `analyze-impact` result available in session state for the same `primary_repo` — reject with `MISSING_IMPACT_REPORT`.
- The cross-repo registry is project-scoped — it persists across pipeline runs (not session-scoped).
- Circular dependencies detected in the consumer graph are classified as `critical_risk` and MUST emit `backpropagate` feedback — they cannot be silently ignored.
- Topological sort excludes nodes involved in detected cycles — a best-effort safe sequence is still produced for the cycle-free subgraph.
- Maximum registry size: 500 repo entries. Reject register operations that would exceed this with `REGISTRY_CAPACITY_EXCEEDED`.
- `sync-work-items` generates at most 50 work item stubs per invocation. Paginate for larger impact sets.

## Security Considerations

- The cross-repo registry stores repository names, types, versions, and dependency graphs — no source code, no credentials, no environment values.
- `repo_registry` input entries must be validated: reject entries with empty names, reject version constraints that are not valid semver ranges.
- Work item stubs must not include file paths, internal hostnames, or access tokens in description or cross_ref_link fields.
- `change_description` input may originate from change-impact-analyzer output — validate that it does not contain embedded executable content before processing.

## Token Optimization

- For `register` and `query` operations: no LLM calls required — pure data operations on the registry JSON.
- For `analyze-impact`: pass only `breaking_changes` field names and `change_type` values (not full descriptions) when building the consumer graph. Full descriptions are used only in the rationale string.
- For `sync-work-items`: generate stubs using a template (not LLM generation) to keep token cost near zero.
- Prune `cross_repo_registry` output to include only repos relevant to `primary_repo` when returning from `analyze-impact` — not the full registry.

## Quality Checklist

- [ ] Input validated against schema for all four operations
- [ ] `analyze-impact` rejects empty `breaking_changes`
- [ ] Consumer graph built correctly from registry dependency declarations
- [ ] DFS cycle detection runs before topological sort
- [ ] Topological sort produces valid ordering for all non-cycle nodes
- [ ] `backpropagate` feedback emitted for high/critical risk_level
- [ ] `metrics` and `feedback` fields present in every response

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| `analyze-impact` called without `breaking_changes` | `{"error": "MISSING_BREAKING_CHANGES"}` |
| `sync-work-items` called without prior impact_report | `{"error": "MISSING_IMPACT_REPORT"}` |
| Registry > 500 entries on register | `{"error": "REGISTRY_CAPACITY_EXCEEDED", "max": 500}` |
| Cycle detected in consumer graph | Continue with partial sort; emit `circular_cross_repo_dependency_detected` feedback |
| state-manager unavailable | `{"error": "STATE_MANAGER_UNAVAILABLE"}` — halt operation |
| Unknown operation value | `{"error": "UNKNOWN_OPERATION", "allowed": ["register","analyze-impact","sync-work-items","query"]}` |

## 12. Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Behavior |
|------|---------|---------|----------|
| High cross-repo impact | `impact_report.risk_level == "high"` | 86400s | Pause pipeline; present impact_report to human; wait for explicit approval before sync-work-items |
| Critical cross-repo impact | `impact_report.risk_level == "critical"` | None | Pause pipeline; mandatory human review; no auto-continue |
| Circular dependency detected | `cycle_report.has_cycle == true` | None | Pause pipeline; present cycle path to human; require explicit confirmation to proceed with partial sort |

## 13. Skill Composition

```yaml
composes:
  - skill: change-impact-analyzer
    version: "^1.1.0"
    input_map:
      change_description: "change_description"
    output_map:
      breaking_changes: "breaking_changes"
  - skill: dependency-analyzer
    version: "^1.1.0"
    input_map:
      scope: "intra-repo"
    output_map:
      dependency_graph: "local_dependency_context"
  - skill: state-manager
    version: "^1.1.0"
    input_map:
      operation: "read"
      scope: "project"
      key: "cross_repo_registry"
    output_map:
      value: "current_registry"
```

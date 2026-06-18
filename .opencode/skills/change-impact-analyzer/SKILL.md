---
name: change-impact-analyzer
version: 1.1.0
domain: architecture
description: 'Use when computing the full impact surface of a proposed change before executing it. Triggers on: "what is the impact of this change", "impact analysis", "what will break", "change impact", "blast radius", "before I change this".'
author: system
---

## Purpose

Before any modification is executed, compute the complete impact surface across all dimensions: affected modules, API breaking changes, test invalidation, documentation drift, security boundary crossings, and dependency ripple effects. The skill ensures the orchestrator executes only the required downstream skills and prevents cascading failures from untracked changes. It is non-optional — every modification in the ASE-OS pipeline passes through change-impact-analyzer before execution.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `change_description` | `string` | Yes | Human-readable description of the proposed change |
| `change_type` | `string` | Yes | `code`, `architecture`, `dependency`, `configuration`, `schema`, or `documentation` |
| `affected_files` | `array[string]` | Yes | File paths that will be modified |
| `architecture` | `object` | No | Current architecture modules from system state |
| `dependency_graph` | `object` | No | Current dependency graph from dependency-analyzer |
| `test_state` | `object` | No | Current test state (coverage map, last run results) |
| `security_state` | `object` | No | Current security state (open findings, boundaries) |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "change_description": { "type": "string", "minLength": 1 },
    "change_type": { "type": "string", "enum": ["code", "architecture", "dependency", "configuration", "schema", "documentation"] },
    "affected_files": { "type": "array", "items": { "type": "string" }, "minItems": 1 },
    "architecture": { "type": "object" },
    "dependency_graph": { "type": "object" },
    "test_state": { "type": "object" },
    "security_state": { "type": "object" }
  },
  "required": ["change_description", "change_type", "affected_files"]
}
```

## Required Context

- Architecture from `architecture-design` output (or system state `architecture` scope).
- Dependency graph from `dependency-analyzer` output (or system state `dependency_graph` scope).
- **Retrieval-first (graphify):** For module mapping and transitive impact steps, first attempt:
  - `graphify query "<changed_module>"` — retrieves the immediate neighbor subgraph (avoids full architecture load).
  - `graphify path "<changed_module>" "<dependent_module>"` — shortest path for specific consumer chains.
  Fall back to full state reads of `architecture` and `dependency_graph` only if `graphify-out/graph.json` is absent. Token savings: ~50–70% on typical impact analysis calls.

## Execution Logic

```
Step 1 — Map changed files to modules
  Retrieval-first: Run `graphify query "<changed_file>"` to resolve owning module.
  If graphify unavailable: identify owning module from architecture state slice.
  For each file in affected_files: identify owning module from architecture.
  Flag files that belong to no module as "unassigned" (warning).
  Output: module_assignments

Step 2 — Compute module impact
  Retrieval-first: Run `graphify query "<changed_module>"` to get transitive dependents.
  For specific consumer chains: run `graphify path "<changed_module>" "<consumer>"`.
  If graphify unavailable: traverse full dependency_graph from state.
  Classify each: direct (depth 1), transitive (depth 2+), isolated (no dependents).
  Output: module_impact_list

Step 3 — Detect API surface changes
  For each changed file: identify exported interfaces, public functions, types, and events.
  Classify changes: breaking (removed/renamed/type-changed) vs. non-breaking (added optional).
  Output: api_change_report { breaking: [], non_breaking: [] }

Step 4 — Identify invalidated tests
  For each affected module: find tests mapped to that module in test_state.
  Classify: directly invalidated (tests that import changed files), indirectly invalidated (tests of dependent modules).
  Output: test_impact { invalidated: [], at_risk: [], safe: [] }

Step 5 — Identify documentation impact
  For each affected module and changed API: find documentation sections that reference them.
  Flag sections that reference removed or renamed interfaces.
  Output: documentation_impact { stale_sections: [], requires_update: [] }

Step 6 — Detect security boundary crossings
  For each changed file: check if it touches auth, session, data access, encryption, or external API boundaries from security_state.
  Flag any change that modifies a security-critical path.
  Output: security_impact { boundaries_crossed: [], severity: string }

Step 7 — Compute required downstream skills
  Based on all impact dimensions, determine the minimal set of skills to invoke:
    code change:          clean-code-review, testing-strategy, doc-maintainer
    api breaking change:  + architecture-design (contract update), security-review
    security boundary:    + security-review (mandatory)
    test invalidation:    + test-generator (regenerate invalidated tests)
    doc impact:           + doc-maintainer (automatic via event)
  Output: required_skills list with reason for each

Step 8 — Assemble impact report
  Combine all dimension outputs into a single structured report.
  Assign overall impact_severity: low / medium / high / critical.
  Output: final impact_report
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `module_impact` | `array[object]` | Affected modules with depth and reason |
| `api_change_report` | `object` | Breaking and non-breaking API changes |
| `test_impact` | `object` | Invalidated, at-risk, and safe test groups |
| `documentation_impact` | `object` | Stale sections and sections requiring update |
| `security_impact` | `object` | Security boundaries crossed and severity |
| `required_skills` | `array[object]` | Downstream skills to invoke with reason |
| `impact_severity` | `string` | Overall severity: `low`, `medium`, `high`, `critical` |
| `metrics` | `object` | Execution metrics |
| `feedback` | `array[object]` | Feedback entries |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "module_impact": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "module": { "type": "string" },
          "depth": { "type": "integer" },
          "reason": { "type": "string" }
        },
        "required": ["module", "depth", "reason"]
      }
    },
    "api_change_report": {
      "type": "object",
      "properties": {
        "breaking": { "type": "array", "items": { "type": "object" } },
        "non_breaking": { "type": "array", "items": { "type": "object" } }
      },
      "required": ["breaking", "non_breaking"]
    },
    "test_impact": {
      "type": "object",
      "properties": {
        "invalidated": { "type": "array", "items": { "type": "string" } },
        "at_risk": { "type": "array", "items": { "type": "string" } },
        "safe": { "type": "array", "items": { "type": "string" } }
      },
      "required": ["invalidated", "at_risk", "safe"]
    },
    "documentation_impact": {
      "type": "object",
      "properties": {
        "stale_sections": { "type": "array", "items": { "type": "string" } },
        "requires_update": { "type": "array", "items": { "type": "string" } }
      },
      "required": ["stale_sections", "requires_update"]
    },
    "security_impact": {
      "type": "object",
      "properties": {
        "boundaries_crossed": { "type": "array", "items": { "type": "string" } },
        "severity": { "type": "string", "enum": ["none", "low", "medium", "high", "critical"] }
      },
      "required": ["boundaries_crossed", "severity"]
    },
    "required_skills": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "skill": { "type": "string" },
          "reason": { "type": "string" },
          "mandatory": { "type": "boolean" }
        },
        "required": ["skill", "reason", "mandatory"]
      }
    },
    "impact_severity": { "type": "string", "enum": ["low", "medium", "high", "critical"] },
    "metrics": { "$ref": "#/$defs/metrics" },
    "feedback": { "type": "array", "items": { "$ref": "#/$defs/feedback_entry" } }
  },
  "required": ["module_impact", "api_change_report", "test_impact", "documentation_impact", "security_impact", "required_skills", "impact_severity", "metrics", "feedback"],
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

- `security-review` is always mandatory in `required_skills` when `security_impact.severity` is `high` or `critical`.
- Breaking API changes always require `architecture-design` to be re-run before code execution continues.
- This skill is read-only — it never modifies code, state, or artifacts.
- If `dependency_graph` is absent, impact analysis runs in degraded mode (module-level only, no transitive depth).
- Impact severity is `critical` if: breaking API changes AND security boundary crossed AND test coverage > 30% invalidated.

## Security Considerations

- Does not expose internal file paths in API change reports — use module-scoped names.
- `security_state` slice passed in must be pre-filtered to exclude raw vulnerability payloads.

## Token Optimization

- Load only `affected_files` and their immediate module mappings — not the full code_map.
- Return `required_skills` as skill names only (not full skill spec objects).
- Omit `test_impact.safe` from output unless explicitly requested.

## Quality Checklist

- [ ] All affected_files are mapped to modules
- [ ] Breaking vs non-breaking API changes are correctly classified
- [ ] security-review is in required_skills when security boundary is crossed
- [ ] impact_severity matches the highest-severity dimension
- [ ] required_skills includes mandatory flag for each entry

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| affected_files is empty | Reject: `{"error": "NO_FILES_SPECIFIED"}` |
| Architecture unavailable | Run in degraded mode, emit warning, skip module classification |
| Dependency graph unavailable | Skip transitive impact, emit warning |
| All test coverage invalidated (>80%) | Set impact_severity=critical, add rollback-manager to required_skills |

## 12. Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Behavior |
|------|---------|---------|----------|
| Critical impact | `impact_severity === "critical"` | 3600s | Pause, present full impact report for human review before any skill executes |
| Breaking API change | `api_change_report.breaking.length > 0` | 3600s | Pause, present breaking changes and affected consumers for approval |

## 13. Skill Composition

`change-impact-analyzer` is invoked at the start of every execution step:

```yaml
composes:
  - skill: change-impact-analyzer
    version: "^1.0.0"
    input_map:
      change_description: "task.description"
      change_type: "code"
      affected_files: "task.target_files"
    output_map:
      required_skills: "execution_plan.skills"
      impact_severity: "execution_plan.severity"
```

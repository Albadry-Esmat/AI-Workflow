# FEATURE-015 — Implementation Plan: Multi-Repo Coordinator

## Target Skills / Artifacts

| Skill / Artifact | Action | Notes |
|---|---|---|
| `.opencode/skills/multi-repo-coordinator/SKILL.md` (SKL-075) | Create | New skill — full 13-section spec |
| `skills/registry.json` | Update | Register SKL-075 with `status: draft` |
| `skills/index.yaml` | Update | Add index entry for multi-repo-coordinator |

---

## §1 — Skill: multi-repo-coordinator

**Purpose:** Coordinates changes across multiple repositories by maintaining a persistent cross-repo dependency registry, detecting breaking changes that ripple across service boundaries, topologically sequencing safe update order, and generating synchronized work item stubs per affected repo.

### Supported Operations

| Operation | Description | Required Inputs |
|---|---|---|
| `register` | Add or update a repo and its dependencies in the cross-repo registry | `primary_repo`, optionally `repo_registry` |
| `analyze-impact` | Find all repos affected by breaking changes in the primary repo | `primary_repo`, `change_description`, `breaking_changes` |
| `sync-work-items` | Create work item stubs for each affected repo with cross-repo refs | `primary_repo`, `impact_report` (from prior analyze-impact) |
| `query` | Return filtered view of the cross-repo dependency registry | `primary_repo` (filter key) |

### Input Schema

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
    "repo_registry":      { "type": "array" },
    "breaking_changes":   { "type": "array" }
  },
  "required": ["operation", "primary_repo"]
}
```

### Output Schema (summary)

```json
{
  "cross_repo_registry": "array — repo_name, type, dependencies[], last_updated",
  "impact_report": {
    "affected_repos":   "array — repo_name, impact_severity, affected_interfaces[], required_changes[]",
    "unaffected_repos": "array",
    "risk_level":       "low | medium | high | critical"
  },
  "synchronized_work_items":    "array — title, description, cross_ref_link, affected_interfaces[]",
  "migration_coordination_plan": {
    "update_sequence": "array — ordered list of repo names (dependency-safe)",
    "rationale":       "string"
  },
  "metrics":  "object",
  "feedback": "array"
}
```

### Execution Steps

**Step 1 — Load registry from state-manager**
Read the cross-repo registry from `state_manager["cross_repo_registry"]`. If no entry exists, initialise as an empty array.

**Step 2 — Execute operation**

*register:*
- Validate `primary_repo` fields.
- Upsert: if `primary_repo.name` already exists in registry, update its `dependencies` and `last_updated`; otherwise append.
- If `repo_registry` array is supplied, process each entry as a batch upsert.
- Write updated registry back to state-manager.

*analyze-impact:*
- For each entry in `breaking_changes`, build a consumer graph: walk all registry repos; collect those whose `dependencies` list includes `primary_repo.name`.
- Assess `impact_severity` per consumer: `critical` (interface removed), `high` (signature changed), `medium` (behaviour changed), `low` (additive change only).
- Determine `risk_level` of the overall impact: critical if any consumer is critical; high if no critical but any high; medium if all medium/low; low if only additive.

*sync-work-items:*
- For each repo in `impact_report.affected_repos`, generate a work item stub: title (`"[<repo>] Update dependency on <primary_repo.name>@<current_version>"`), description (affected interfaces + recommended fix), `cross_ref_link` (primary change identifier).

*query:*
- Filter registry by operation parameters (by `primary_repo.name` or `type`). Return matching entries.

**Step 3 — Circular dependency detection** (analyze-impact only)
Run DFS cycle detection on the consumer graph. If a cycle is detected: classify as `critical_risk`; emit `circular_cross_repo_dependency_detected` feedback with cycle path in evidence. Add a `block_risks` note to `impact_report`.

**Step 4 — Topological sort** (analyze-impact only)
Apply Kahn's algorithm to the consumer graph (excluding any nodes involved in detected cycles). Produce `migration_coordination_plan.update_sequence`: repos with no upstream consumers listed first, primary_repo listed last. Add `rationale` string explaining the sequence reasoning.

**Step 5 — HITL gate check**
If `impact_report.risk_level` is `"high"` or `"critical"`: emit feedback with `type: "backpropagate"`, `target_skill: "orchestrator"`, reason indicating risk level and affected repo count. Orchestrator must pause pipeline and present `impact_report` to human before sync-work-items can proceed.

---

## §2 — State-Manager Key Structure

```json
{
  "cross_repo_registry": [
    {
      "repo_name":       "<string>",
      "type":            "library | service | api",
      "current_version": "<semver>",
      "dependencies": [
        { "name": "<string>", "version_constraint": "<semver range>" }
      ],
      "last_updated": "<ISO-8601>"
    }
  ]
}
```

---

## §3 — Impact Severity Matrix

| Change Type | Impact Severity |
|---|---|
| Interface removed | critical |
| Method signature changed (breaking) | high |
| Return type or error contract changed | high |
| Default behaviour changed (non-additive) | medium |
| New optional field / additive change | low |

---

## §4 — Registry Entry

```json
{
  "id": "SKL-075",
  "name": "multi-repo-coordinator",
  "version": "1.0.0",
  "domain": "architecture",
  "status": "draft",
  "phase": 7,
  "req_id": "N19"
}
```

---

## §5 — Validation

`scripts/validate-skills.sh` must pass (exit 0) after SKL-075 is registered.

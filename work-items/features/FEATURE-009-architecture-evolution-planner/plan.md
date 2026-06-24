# FEATURE-009 — Implementation Plan: Architecture Evolution Planner

## Target Skills / Artifacts

| Skill / Artifact | Action | Notes |
|---|---|---|
| `architecture-evolution-planner/SKILL.md` (SKL-069) | Create | New skill — phased migration plan from current to target architecture |
| `skills/registry.json` | Update | Register SKL-069 with `status: draft` |
| `skills/index.yaml` | Update | Add index entry for SKL-069 |

---

## §1 — Skill Purpose and Pipeline Position

`architecture-evolution-planner` is an on-demand skill invoked when a team needs to transition from an existing deployed architecture to a desired target architecture. It produces a phased, independently-deployable migration plan with per-phase rollback criteria and a mandatory HITL gate before any implementation begins.

Pipeline position:

```
On-demand trigger (user requests migration plan):
  architecture-design (current)  ─┐
  architecture-design (target)   ─┤→ architecture-evolution-planner   ← THIS SKILL
  adr-generator (historical ADRs) ─┘        │
  dependency-analyzer ───────────────────────┘
                                             ↓
                                       HITL Gate (non-bypassable)
                                             ↓
                               feature-planning (per-phase tasks)
                               adr-generator   (from adrs_to_create stubs)
```

---

## §2 — Input Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "current_architecture": {
      "type": "object",
      "description": "Current deployed architecture — modules, boundaries, and data flow from architecture-design output",
      "required": true
    },
    "target_architecture": {
      "type": "object",
      "description": "Desired future architecture — modules, boundaries, and data flow",
      "required": true
    },
    "historical_adrs": {
      "type": "array",
      "items": { "type": "object" },
      "description": "Prior ADRs that constrain the evolution path (optional)"
    },
    "constraints": {
      "type": "object",
      "properties": {
        "zero_downtime":             { "type": "boolean", "default": false },
        "max_phase_duration_weeks":  { "type": "integer", "minimum": 1, "default": 2 },
        "allowed_patterns": {
          "type": "array",
          "items": {
            "type": "string",
            "enum": ["strangler-fig", "branch-by-abstraction", "expand-contract", "parallel-run"]
          }
        }
      }
    },
    "team_capacity": {
      "type": "object",
      "properties": {
        "developers":        { "type": "integer", "minimum": 1 },
        "sprints_available": { "type": "integer", "minimum": 1 }
      }
    }
  },
  "required": ["current_architecture", "target_architecture"]
}
```

---

## §3 — Execution Steps Specification

### Step 1 — Diff Current vs. Target Architecture

Compare `current_architecture.modules` and `target_architecture.modules`:
- `added`: modules present in target but not in current
- `removed`: modules present in current but not in target
- `changed`: modules present in both with different interfaces, boundaries, or data flows
- `unchanged`: modules present in both with no detectable difference

Identify breaking changes: interface removals, renamed public APIs, changed data contracts.

Output: `architecture_diff { added[], removed[], changed[], unchanged[], breaking_changes[] }`

### Step 2 — Analyze Dependency Graph for Safe Refactoring Order

For the set of `changed` and `removed` modules, perform a topological sort:
- Build directed dependency graph: module A → module B means "A depends on B"
- Apply Kahn's algorithm (or equivalent) to determine safe refactoring order
- Leaf modules (no downstream dependents in the target architecture) are refactored first
- Detect circular dependencies: if cycle detected → emit `backpropagate` to `architecture-design` with reason `circular_dependency_in_evolution_path`, and halt

Output: `dependency_order[]` (topologically sorted module list)

### Step 3 — Select Migration Pattern Per Module

For each module in `dependency_order`, select the appropriate migration pattern based on:
- **strangler-fig**: module exposes a public API consumed by external systems — wrap and redirect incrementally
- **branch-by-abstraction**: module is an internal implementation detail — introduce abstraction layer, swap impl behind it
- **expand-contract**: module owns a shared data schema (database table, message format) — expand schema first, migrate consumers, then contract
- **parallel-run**: module performs critical business logic that cannot tolerate regression — run old and new in parallel, compare outputs, switch when validated

Respect `constraints.allowed_patterns` — reject selections not in the allowed list.
Consult `historical_adrs` for prior pattern choices that must be honored.

Output: `pattern_assignments { module, pattern, rationale }`

### Step 4 — Group Changes Into Sprint-Sized Phases

Group `pattern_assignments` into phases where each phase satisfies all of:
- Affects ≤ 3 modules
- Is independently deployable (no cross-phase hard dependency at runtime)
- Total estimated sprints ≤ `constraints.max_phase_duration_weeks / 2`
- Has a clear, testable completion criterion

Assign each phase:
- `phase_id`: `PHASE-01`, `PHASE-02`, etc.
- `title`: descriptive name
- `modules_affected[]`
- `migration_pattern`
- `estimated_sprints`
- `acceptance_criteria[]`

Output: `phase_groups[]`

### Step 5 — Identify Feature Flags Per Phase

For each phase that modifies a user-visible behavior or public API endpoint:
- Identify the feature flag(s) needed to enable gradual rollout
- Naming convention: `<module_name>_<change_description>_enabled` (e.g., `payment_service_v2_enabled`)
- Flag each phase's `feature_flags_required[]` field

Output: `feature_flags` per phase

### Step 6 — Define Backward Compatibility Contracts and Rollback Criteria

For each phase:
- `backward_compat_contract`: what must remain unchanged during and after this phase (e.g., "the /orders API endpoint MUST continue to accept the v1 request format for 30 days after phase completion")
- `rollback_criteria`: specific measurable condition that triggers rollback (e.g., "error rate on /orders endpoint exceeds 0.5% within 24 hours of deployment")

Validate `zero_downtime` constraint:
- For each phase requiring a hard cutover, service lock, or schema lock: flag in `risks[]`
- If `constraints.zero_downtime = true` and any hard-cutover phase exists: set `summary.zero_downtime_compliant = false` and emit halt feedback

Output: `backward_compat_contracts`, `rollback_criteria`, `risks[]`

### Step 7 — Generate ADR Stubs

For each significant architectural decision made during evolution planning:
- Selecting a migration pattern for a non-trivial module
- Choosing to defer a module migration to a later phase
- Accepting a backward-compatibility trade-off
- Introducing a new abstraction layer

Generate ADR stub: `{ title, context, decision, consequences, status: "draft" }`.

Output: `adrs_to_create[]`

### Step 8 — Assemble Final Output and Emit Feedback

Combine all phase outputs into `evolution_phases[]`.
Build `summary`: `{ total_phases, total_sprints, breaking_changes_count, zero_downtime_compliant }`.
Emit feedback:
- IF circular dependency detected: `backpropagate` to `architecture-design`, reason: `circular_dependency_in_evolution_path`
- IF `zero_downtime_compliant = false` and `constraints.zero_downtime = true`: halt, emit to HITL

Output: full skill output

---

## §4 — Output Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "evolution_phases": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "phase_id":                { "type": "string", "pattern": "^PHASE-[0-9]{2,}$" },
          "title":                   { "type": "string" },
          "modules_affected":        { "type": "array", "items": { "type": "string" } },
          "migration_pattern":       { "type": "string",
            "enum": ["strangler-fig", "branch-by-abstraction", "expand-contract", "parallel-run"] },
          "feature_flags_required":  { "type": "array", "items": { "type": "string" } },
          "backward_compat_contract":{ "type": "string" },
          "rollback_criteria":       { "type": "string" },
          "estimated_sprints":       { "type": "integer", "minimum": 1 },
          "acceptance_criteria":     { "type": "array", "items": { "type": "string" } }
        },
        "required": ["phase_id", "title", "modules_affected", "migration_pattern",
                     "feature_flags_required", "backward_compat_contract",
                     "rollback_criteria", "estimated_sprints", "acceptance_criteria"]
      }
    },
    "dependency_order": { "type": "array", "items": { "type": "string" } },
    "risks": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "phase_id":    { "type": "string" },
          "risk":        { "type": "string" },
          "mitigation":  { "type": "string" },
          "severity":    { "type": "string", "enum": ["low", "medium", "high", "critical"] }
        },
        "required": ["phase_id", "risk", "mitigation", "severity"]
      }
    },
    "adrs_to_create": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "title":        { "type": "string" },
          "context":      { "type": "string" },
          "decision":     { "type": "string" },
          "consequences": { "type": "string" },
          "status":       { "type": "string", "enum": ["draft"] }
        },
        "required": ["title", "context", "decision", "consequences", "status"]
      }
    },
    "summary": {
      "type": "object",
      "properties": {
        "total_phases":          { "type": "integer" },
        "total_sprints":         { "type": "integer" },
        "breaking_changes_count":{ "type": "integer" },
        "zero_downtime_compliant":{ "type": "boolean" }
      },
      "required": ["total_phases", "total_sprints", "breaking_changes_count", "zero_downtime_compliant"]
    },
    "metrics":  { "$ref": "#/$defs/metrics" },
    "feedback": { "type": "array", "items": { "$ref": "#/$defs/feedback_entry" } }
  },
  "required": ["evolution_phases", "dependency_order", "risks", "adrs_to_create", "summary", "metrics", "feedback"]
}
```

---

## §5 — Feedback Routes

| Condition | Feedback Type | Target Skill | Reason |
|---|---|---|---|
| Circular dependency detected in evolution path | `backpropagate` | `architecture-design` | `circular_dependency_in_evolution_path` |
| `zero_downtime_compliant = false` AND `constraints.zero_downtime = true` | halt + HITL | human | `zero_downtime_constraint_violated` |

---

## §6 — Registry Entry

SKL-069 must be added to `skills/registry.json`:
```json
{
  "id": "SKL-069",
  "name": "architecture-evolution-planner",
  "version": "1.0.0",
  "domain": "architecture",
  "status": "draft",
  "phase": 7,
  "req_id": "N24"
}
```

`scripts/validate-skills.sh` must pass (exit 0) after registration.

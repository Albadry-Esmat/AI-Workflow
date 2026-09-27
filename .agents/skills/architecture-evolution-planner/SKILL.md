---
name: architecture-evolution-planner
version: 1.0.0
domain: architecture
description: >
  Use when planning a safe, incremental migration from a current system architecture to a
  target architecture with phased rollout, rollback criteria, and backward-compatibility
  contracts. Triggers on: "plan architecture migration", "evolve from v1 to v2", "incremental
  refactoring plan", "how do we migrate this architecture", "strangler-fig migration plan".
  Do NOT use for greenfield architecture design — use architecture-design instead.
author: system
---

## Purpose

`architecture-evolution-planner` produces a phased, sprint-sized migration roadmap for teams that need to transition from a current deployed architecture to a desired target state without resorting to big-bang rewrites or accepting unplanned downtime. Given the current architecture, target architecture, and historical ADRs, it diffs the two states, sorts changed modules into a topologically safe refactoring order, selects the appropriate migration pattern per module (strangler-fig, branch-by-abstraction, expand-contract, or parallel-run), groups changes into independently deployable phases, identifies feature flags for gradual rollout, and defines rollback criteria and backward-compatibility contracts per phase. A mandatory, non-bypassable HITL gate prevents auto-execution — evolution plans commit teams to multi-sprint work and must receive explicit human approval before implementation begins.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `current_architecture` | `object` | Yes | Current deployed architecture from `architecture-design` output — modules, boundaries, data flow |
| `target_architecture` | `object` | Yes | Desired future architecture — modules, boundaries, data flow |
| `historical_adrs` | `array[object]` | No | Prior ADRs that constrain the evolution path (prior pattern choices, rejected alternatives) |
| `constraints` | `object` | No | `zero_downtime` (bool), `max_phase_duration_weeks` (int, default 2), `allowed_patterns` (array of pattern names) |
| `team_capacity` | `object` | No | `developers` (int), `sprints_available` (int) — used for phase sizing validation |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "current_architecture": {
      "type": "object",
      "description": "Current architecture from architecture-design output",
      "required": true
    },
    "target_architecture": {
      "type": "object",
      "description": "Target architecture from architecture-design output",
      "required": true
    },
    "historical_adrs": {
      "type": "array",
      "items": { "type": "object" }
    },
    "constraints": {
      "type": "object",
      "properties": {
        "zero_downtime": {
          "type": "boolean",
          "default": false
        },
        "max_phase_duration_weeks": {
          "type": "integer",
          "minimum": 1,
          "default": 2
        },
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

## Required Context

- `architecture-design@^1.3.0` output format for both `current_architecture` and `target_architecture` — must include `modules[]`, `boundaries[]`, and `data_flow[]` sub-fields.
- `dependency-analyzer@^1.1.0` output is recommended for accurate topological sorting; if absent, the skill infers dependencies from `architecture.modules[].dependencies`.
- `historical_adrs` from `adr-generator@^1.0.0` are used to avoid re-selecting patterns already rejected in prior decisions.
- **This skill is on-demand only.** It is not triggered automatically by code-changed events. Caller must supply both architecture inputs explicitly.

## Execution Logic

```
Step 1 — Diff current vs. target architecture
  Compare current_architecture.modules[] and target_architecture.modules[] by module name:
    added:     present in target, absent in current
    removed:   present in current, absent in target
    changed:   present in both; has different interfaces, boundaries, or data contracts
    unchanged: present in both with no detectable difference
  Identify breaking changes within "changed" modules:
    removed public interfaces, renamed public APIs, changed data contracts (schema fields removed)
  Flag: breaking_changes[] for later phase ordering
  Output: architecture_diff { added[], removed[], changed[], unchanged[], breaking_changes[] }

Step 2 — Analyze dependency graph for safe refactoring order
  Build directed dependency graph from:
    - dependency-analyzer output if available in session state
    - otherwise: current_architecture.modules[].dependencies[]
  Perform topological sort (Kahn's algorithm):
    Process leaf modules first (modules with no downstream dependents in the evolved set).
    Modules consumed by many others are scheduled last.
  Detect circular dependencies:
    IF cycle detected:
      → HALT execution
      → { type: "backpropagate", from_skill: "architecture-evolution-planner",
          target_skill: "architecture-design", reason: "circular_dependency_in_evolution_path",
          evidence: { cycle_path: [...] } }
      → Return partial output with error
  Output: dependency_order[] (topologically sorted list of module names)

Step 3 — Select migration pattern per module
  For each module in architecture_diff.changed[] and architecture_diff.removed[]:
    Apply pattern selection criteria:
      strangler-fig:          module has a public API consumed by external systems or other teams;
                              incremental traffic routing possible; old and new can coexist
      branch-by-abstraction:  module is an internal implementation; callers can be updated to
                              use an abstraction layer before the implementation is swapped
      expand-contract:        module owns a shared data schema (database table, message format,
                              event envelope); must expand first, migrate consumers, then contract
      parallel-run:           module performs critical business logic that cannot tolerate
                              undetected regression; run old and new simultaneously, compare outputs

    Reject pattern if not in constraints.allowed_patterns (if constraints.allowed_patterns is set).
    Consult historical_adrs: if a pattern was explicitly rejected for this module in a prior ADR,
    do not re-select it.
  Output: pattern_assignments { module, pattern, rationale }[]

Step 4 — Group changes into sprint-sized phases
  Group pattern_assignments into phases satisfying all constraints:
    (a) Each phase affects ≤ 3 modules
    (b) Each phase is independently deployable (no cross-phase runtime hard dependency)
    (c) Each phase has estimated_sprints ≤ max_phase_duration_weeks / 2
    (d) Each phase has a clear, binary completion criterion
  Assign phase metadata:
    phase_id:         "PHASE-01", "PHASE-02", etc. (zero-padded)
    title:            descriptive name reflecting the primary transformation
    modules_affected: array of module names
    migration_pattern: selected pattern for the primary module in the phase
    estimated_sprints: derived from module complexity and team_capacity.developers
    acceptance_criteria: 2–3 measurable assertions that define phase completion
  Output: evolution_phases[] (ordered, starting with leaf modules)

Step 5 — Identify feature flags per phase
  For each phase where:
    - The phase modifies a user-visible behavior or public API endpoint, OR
    - The migration_pattern is "strangler-fig" or "parallel-run"
  Identify required feature flags:
    Naming convention: {module_name}_{change_description}_enabled
    (e.g., payment_service_v2_enabled, order_api_strangler_enabled)
  Assign feature_flags_required[] to each qualifying phase.
  Phases with branch-by-abstraction or expand-contract on internal modules may have
  empty feature_flags_required[] if no user-visible behavior changes.
  Output: feature_flags_required[] per phase

Step 6 — Define backward-compat contracts and rollback criteria
  For each phase:
    backward_compat_contract: what the phase MUST NOT break during and after deployment.
      Format: "[interface/endpoint] MUST [continue to / still] [specific behavior] for [duration]"
      Example: "The /v1/orders endpoint MUST continue to accept v1 request format for 30 days"
    rollback_criteria: specific measurable condition that triggers rollback.
      Format: "[metric] exceeds [threshold] within [time window] of deployment"
      Example: "Error rate on /orders exceeds 0.5% within 24 hours of deployment"
  Validate zero_downtime constraint:
    Identify phases requiring hard cutover, schema lock, or service restart.
    IF constraints.zero_downtime = true AND any such phase exists:
      Set summary.zero_downtime_compliant = false
      Add risk entry: { phase_id, risk: "hard cutover required", severity: "critical",
                        mitigation: "apply expand-contract or parallel-run pattern instead" }
      Emit halt feedback: { type: "backpropagate", reason: "zero_downtime_constraint_violated",
                            evidence: { violating_phases: [...] } }
  Output: backward_compat_contracts, rollback_criteria, risks[]

Step 7 — Generate ADR stubs
  For each significant architectural decision made during planning:
    Selecting a non-obvious migration pattern (strangler-fig over branch-by-abstraction choice)
    Deferring a module migration to a later phase with explicit justification
    Accepting a backward-compatibility trade-off or time-limited compatibility window
    Introducing a new abstraction layer not present in either current or target architecture
  Build ADR stub:
    title:        "ADR: [decision summary]"
    context:      why this decision arose (1–2 sentences)
    decision:     the chosen approach (1 sentence)
    consequences: trade-offs and what this decision constrains going forward (2–3 sentences)
    status:       "draft"
  Output: adrs_to_create[]

Step 8 — Assemble final output and emit feedback
  Combine all phase outputs into evolution_phases[].
  Build summary:
    total_phases           = evolution_phases.length
    total_sprints          = Σ(phase.estimated_sprints)
    breaking_changes_count = architecture_diff.breaking_changes.length
    zero_downtime_compliant = true if no hard-cutover phases, false otherwise
  Emit feedback:
    IF circular dependency detected (Step 2): backpropagate to architecture-design (already emitted)
    IF zero_downtime_constraint_violated (Step 6): halt feedback (already emitted)
    ELSE: emit info feedback summarizing plan: total_phases, total_sprints
  Output: full skill output — HOLD for HITL gate before forwarding to feature-planning
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `evolution_phases` | `array[object]` | Ordered migration phases: `phase_id`, `title`, `modules_affected`, `migration_pattern`, `feature_flags_required`, `backward_compat_contract`, `rollback_criteria`, `estimated_sprints`, `acceptance_criteria` |
| `dependency_order` | `array[string]` | Topologically sorted module list (leaf modules first) |
| `risks` | `array[object]` | Migration risks per phase: `phase_id`, `risk`, `mitigation`, `severity` |
| `adrs_to_create` | `array[object]` | ADR stubs for key migration decisions: `title`, `context`, `decision`, `consequences`, `status` |
| `summary` | `object` | `total_phases`, `total_sprints`, `breaking_changes_count`, `zero_downtime_compliant` |
| `metrics` | `object` | **REQUIRED.** Execution metrics |
| `feedback` | `array[object]` | **REQUIRED.** Backpropagation entries and halt signals |

**Output Schema:**

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
          "title":                   { "type": "string", "minLength": 1 },
          "modules_affected":        { "type": "array", "items": { "type": "string" }, "maxItems": 3 },
          "migration_pattern": {
            "type": "string",
            "enum": ["strangler-fig", "branch-by-abstraction", "expand-contract", "parallel-run"]
          },
          "feature_flags_required":  { "type": "array", "items": { "type": "string" } },
          "backward_compat_contract":{ "type": "string", "minLength": 1 },
          "rollback_criteria":       { "type": "string", "minLength": 1 },
          "estimated_sprints":       { "type": "integer", "minimum": 1 },
          "acceptance_criteria":     { "type": "array", "items": { "type": "string" }, "minItems": 1 }
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
          "phase_id":   { "type": "string" },
          "risk":       { "type": "string" },
          "mitigation": { "type": "string" },
          "severity":   { "type": "string", "enum": ["low", "medium", "high", "critical"] }
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
        "total_phases":           { "type": "integer", "minimum": 0 },
        "total_sprints":          { "type": "integer", "minimum": 0 },
        "breaking_changes_count": { "type": "integer", "minimum": 0 },
        "zero_downtime_compliant":{ "type": "boolean" }
      },
      "required": ["total_phases", "total_sprints", "breaking_changes_count", "zero_downtime_compliant"]
    },
    "metrics":  { "$ref": "#/$defs/metrics" },
    "feedback": { "type": "array", "items": { "$ref": "#/$defs/feedback_entry" } }
  },
  "required": ["evolution_phases", "dependency_order", "risks",
               "adrs_to_create", "summary", "metrics", "feedback"],
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

- Both `current_architecture` and `target_architecture` are **required**. Reject if either is absent.
- This skill is **on-demand only** — it is never triggered automatically by a `code.changed` event.
- Each phase in `evolution_phases` MUST affect **at most 3 modules** — larger groupings must be further split.
- **Circular dependency detection is mandatory.** If a cycle is found in Step 2, the skill halts and backpropagates to `architecture-design`. It does not produce partial phases.
- `migration_pattern` for each phase MUST be drawn only from `constraints.allowed_patterns` if that field is set. If a required pattern is not in the allowed list, emit a `warning` and propose the nearest allowed alternative.
- The **HITL gate after output is non-bypassable** (`bypassable: false`). The orchestrator MUST NOT forward `evolution_phases` to `feature-planning` or `code-generator` without explicit human approval.
- `adrs_to_create` are **stubs only** — titles, context, decision, and consequences fields. Full ADR authoring is delegated to `adr-generator`.
- `zero_downtime_compliant = false` does NOT automatically halt the plan — it generates a risk entry and sets the flag. Halting occurs only if `constraints.zero_downtime = true`.
- Maximum `evolution_phases` count: 20. Plans requiring more phases must be split into sub-roadmaps.

## Security Considerations

- Architecture objects passed as input may contain sensitive module names, data flow descriptions, or boundary definitions. Do not echo raw architecture payloads in feedback `evidence` fields — reference by module name only.
- Feature flag names are derived from module names — ensure they are alphanumeric with underscores only (no special characters, no path separators) to prevent downstream injection in flag configuration systems.
- `historical_adrs` are read-only context — they constrain pattern selection but are never modified.
- ADR stubs in `adrs_to_create` must not include credentials, keys, or environment-specific values even if such data appears in architecture input.

## Token Optimization

- Pass only the `modules[]` and `data_flow[]` sub-arrays from architecture inputs, not full architecture objects, when calling this skill via the orchestrator.
- For large architectures (> 50 modules), process the `architecture_diff` in the first pass and only load full module details for `changed` and `removed` modules in subsequent steps.
- Return `summary` as the primary orchestrator signal; pass `evolution_phases` in full only when the HITL gate requires the complete plan presentation.
- Omit `unchanged` modules from `evolution_phases` entirely — they do not appear in any phase.
- `adrs_to_create` stubs should be concise (< 150 words combined across all four fields per ADR).

## Quality Checklist

- [ ] Both `current_architecture` and `target_architecture` validated as non-empty objects before processing
- [ ] `architecture_diff` correctly classifies all modules as added/removed/changed/unchanged
- [ ] Topological sort produces a valid ordering with leaf modules first
- [ ] Circular dependency check runs before any phase grouping begins
- [ ] Each phase contains ≤ 3 modules
- [ ] Each phase has non-empty `rollback_criteria` and `backward_compat_contract`
- [ ] `migration_pattern` for each phase respects `constraints.allowed_patterns` if set
- [ ] Feature flags named using module-name-based convention (no special characters)
- [ ] `adrs_to_create` generated for all non-trivial pattern selection decisions
- [ ] `zero_downtime_compliant` set correctly based on presence of hard-cutover phases
- [ ] HITL gate declared as non-bypassable

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| `current_architecture` missing | Reject: `{"error": "MISSING_CURRENT_ARCHITECTURE"}` |
| `target_architecture` missing | Reject: `{"error": "MISSING_TARGET_ARCHITECTURE"}` |
| Circular dependency detected | Halt; emit `backpropagate` to `architecture-design`; return partial output with `{"error": "CIRCULAR_DEPENDENCY", "cycle": [...]}` |
| `constraints.allowed_patterns` excludes all applicable patterns for a module | Emit `warning` per module; propose nearest allowed alternative; continue with warning in `risks[]` |
| `total_phases > 20` after grouping | Reject: `{"error": "PLAN_TOO_LARGE", "phases": N, "guidance": "split into sub-roadmaps by domain boundary"}` |
| `zero_downtime = true` AND hard-cutover phase required | Set `zero_downtime_compliant = false`; add critical risk entry; emit halt feedback; do NOT auto-continue |
| `historical_adrs` malformed | Emit `warning` feedback, skip ADR consultation, continue with pattern selection without historical constraints |

## 12. Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Behavior |
|------|---------|---------|----------|
| Evolution plan approval | Always — after any successful `evolution_phases` output is produced | None (no timeout) | Pause; present full `evolution_phases`, `summary`, `risks`, and `adrs_to_create` to architecture owner; require explicit APPROVE or REJECT; no auto-continue |
| Zero-downtime constraint violated | `zero_downtime_compliant = false` AND `constraints.zero_downtime = true` | None (no timeout) | Halt before APPROVE gate; require human to either relax `zero_downtime` constraint or revise target architecture to eliminate hard-cutover phases |

Gate behavior: `pause` with `bypassable: false` for the plan approval gate. The orchestrator MUST NOT forward `evolution_phases` to `feature-planning` or any implementation skill without an explicit APPROVE response. REJECT discards the plan and returns the user to architecture-design. REVISE allows the user to modify `constraints` or target architecture and re-invoke the skill.

## 13. Skill Composition

`architecture-evolution-planner` is invoked on-demand and feeds `feature-planning` and `adr-generator`:

```yaml
composes:
  - skill: architecture-evolution-planner
    version: "^1.0.0"
    input_map:
      current_architecture: "state.architecture.current"
      target_architecture:  "state.architecture.target"
      historical_adrs:      "state.adrs"
      constraints:
        zero_downtime:            "session.zero_downtime_required"
        max_phase_duration_weeks: "session.max_sprint_weeks"
        allowed_patterns:         "session.allowed_migration_patterns"
      team_capacity:
        developers:        "session.team_size"
        sprints_available: "session.sprints_available"
    output_map:
      evolution_phases: "state.evolution.phases"
      dependency_order: "state.evolution.dependency_order"
      adrs_to_create:   "state.evolution.adr_stubs"
      summary:          "state.evolution.summary"

  # HITL gate (non-bypassable) — must be satisfied before proceeding
  - gate:
      type: HITL
      label: "Architecture Evolution Plan Approval"
      options: ["APPROVE", "REJECT", "REVISE"]
      bypassable: false

  - skill: feature-planning
    version: "^2.0.0"
    condition: "gate.result == 'APPROVE'"
    input_map:
      evolution_phases: "state.evolution.phases"

  - skill: adr-generator
    version: "^1.0.0"
    condition: "state.evolution.adr_stubs.length > 0"
    input_map:
      adr_stubs: "state.evolution.adr_stubs"
```

`dependency-analyzer` provides the dependency graph as supplementary context:

```yaml
  - skill: dependency-analyzer
    version: "^1.1.0"
    input_map:
      modules: "state.architecture.current.modules"
    output_map:
      dependency_graph: "state.dependency_graph"
```

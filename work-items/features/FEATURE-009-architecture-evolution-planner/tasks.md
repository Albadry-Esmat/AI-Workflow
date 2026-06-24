# FEATURE-009 — Tasks & Acceptance Criteria

## Acceptance Criteria

### AC-1: Architecture Diff Produces Module Classification
- Given `current_architecture` and `target_architecture` objects with module definitions
- When `architecture-evolution-planner` runs
- Then the output identifies all modules as `added`, `removed`, or `changed`
- And modules present in both with identical interfaces are classified as `unchanged`

### AC-2: Dependency Order Is Topologically Correct
- Given a target architecture with inter-module dependencies
- When the skill computes `dependency_order`
- Then leaf modules (no dependents) appear before modules that depend on them
- And no module appears before all of its dependencies have been listed

### AC-3: Each Phase Is Independently Deployable and Sprint-Sized
- Given a non-trivial architecture migration with more than 3 changed modules
- When `evolution_phases` is produced
- Then each phase affects at most 3 modules
- And each phase includes `rollback_criteria` and `backward_compat_contract` strings
- And each phase includes `migration_pattern` drawn from the allowed set

### AC-4: Feature Flags Identified Per Phase
- Given a phase that transitions a public-facing API or user-visible behavior
- When the phase is assembled
- Then `feature_flags_required` is a non-empty array naming the flags needed for gradual rollout

### AC-5: Zero-Downtime Constraint Enforced
- Given `constraints.zero_downtime: true`
- When any phase would require a service restart, lock, or hard cutover
- Then that phase is flagged in `risks` with `mitigation` referencing a zero-downtime alternative pattern
- And `summary.zero_downtime_compliant` is `false`
- And a `halt` feedback entry is emitted with reason `zero_downtime_constraint_violated`

### AC-6: ADR Stubs Generated for Migration Decisions
- Given an evolution plan with at least one non-trivial migration pattern selection
- When the skill produces output
- Then `adrs_to_create` contains at least one ADR stub with `title`, `context`, `decision`, and `consequences` fields

### AC-7: HITL Gate Is Non-Bypassable
- Given a completed evolution plan output
- When the orchestrator attempts to proceed to implementation
- Then execution halts at the HITL gate until explicit human approval is received
- And the gate cannot be auto-continued on timeout

---

## Definition of Done (DoD)

- [ ] `architecture-evolution-planner/SKILL.md` (SKL-069) created following 13-section template exactly
- [ ] All 8 execution steps defined with clear intermediate artifact outputs
- [ ] Architecture diff step produces `added`, `removed`, `changed`, `unchanged` classifications
- [ ] Topological sort step defined for dependency ordering (leaf-first)
- [ ] Migration pattern selection criteria defined for all four patterns: strangler-fig, branch-by-abstraction, expand-contract, parallel-run
- [ ] Phase grouping rules defined: ≤ 3 modules per phase, independently deployable
- [ ] Feature flag identification step defined
- [ ] Zero-downtime constraint validation defined with halt behavior
- [ ] ADR stub generation step defined
- [ ] HITL gate declared as non-bypassable with `bypassable: false`
- [ ] Feedback routes defined: `circular_dependency` → `architecture-design`, `zero_downtime_violated` → halt + HITL
- [ ] `skills/registry.json` updated with SKL-069 (`status: draft`)
- [ ] All 7 acceptance criteria above verified
- [ ] `docs/changelog.md` Phase 7 block updated
- [ ] `status.md` lifecycle_state set to `completed`

---

## Sub-Tasks

| ID | Description | Skill / File | Est. SP |
|---|---|---|---|
| F009-T1 | Create `architecture-evolution-planner/SKILL.md` (SKL-069) — full 13-section spec | new skill | 5.0 |
| F009-T2 | Define architecture diff step (added/removed/changed/unchanged module classification) | new skill | 1.0 |
| F009-T3 | Define topological sort for dependency-safe refactoring order | new skill | 1.0 |
| F009-T4 | Define migration pattern selection algorithm (4 patterns with selection criteria) | new skill | 2.0 |
| F009-T5 | Define phase grouping rules (≤ 3 modules, independently deployable, rollback criteria) | new skill | 1.0 |
| F009-T6 | Define feature flag identification and zero-downtime constraint validation | new skill | 1.0 |
| F009-T7 | Define ADR stub generation and feedback routing | new skill | 1.0 |
| F009-T8 | Register SKL-069 in `skills/registry.json` with `status: draft` | registry | 0.5 |
| F009-T9 | Run `validate-skills.sh` and verify exit 0 | CI | 0.5 |
| **Total** | | | **13 SP** |

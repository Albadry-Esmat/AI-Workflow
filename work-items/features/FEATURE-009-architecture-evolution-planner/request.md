# FEATURE-009 — Request: Architecture Evolution Planner

**Origin:** Identified during ASE-OS enhancement analysis (2026-06-24).

---

## Problem Statement

`architecture-design` is a point-in-time skill. Once a system is built, there is no skill to plan how to evolve from Architecture v1 → v2 safely and incrementally without breaking running systems. Teams either do big-bang rewrites (high risk, long freeze) or no refactoring at all (debt accumulates), because there is no structured tool for planning incremental, independently deployable migrations.

This gap results in:
- No incremental migration path between architectural states — only "rewrite everything" or "keep everything"
- ADRs documenting the target state but no execution plan for reaching it
- Circular dependencies discovered mid-migration that block progress
- Downtime caused by module transitions that were not designed for zero-downtime handoff
- No rollback criteria defined before migration work begins, making recovery ad hoc

## Requested Behaviour

Take the **current architecture** + **target architecture** + **historical ADRs** and produce a **phased migration plan**: which modules to refactor first (topological dependency order), which strangler-fig or branch-by-abstraction patterns to apply, feature-flag-gated transitions, backward-compatibility contracts per phase, and rollback criteria. Each phase is sized to complete in one sprint and be independently deployable.

A mandatory HITL gate after output prevents auto-execution — evolution plans commit teams to multi-sprint refactoring work and must receive explicit human approval before implementation begins.

## Scope

- `architecture-evolution-planner/SKILL.md` (SKL-069) — new skill
- `skills/registry.json` — register SKL-069
- `skills/index.yaml` — add index entry

## Out of Scope

- Executing the migration (that requires `code-generator` and `deployment-strategy` per phase)
- Runtime traffic shaping or canary rollout configuration (handled by `deployment-strategy`)
- Database migration scripts (handled by `database-architect`)
- ADR authoring — this skill generates ADR *stubs*; `adr-generator` authors the full documents
- Greenfield architecture design — this skill requires a current architecture as starting state

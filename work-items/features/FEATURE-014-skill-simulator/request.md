# FEATURE-014 — Request: Skill Simulator

**Origin:** Identified during ASE-OS enhancement analysis (2026-06-24).

---

## Problem Statement

Individual skills expose `dry_run` flags (ADR generator, code generator, etc.) but there is no **system-level** dry-run that previews the entire pipeline's outputs before committing any file writes. Teams running the pipeline for the first time, or testing a new pipeline configuration, have no way to see "what would happen" without actually changing files.

This means:
- New pipeline configurations are deployed blind — the first feedback comes from a real run that may write incorrect files
- HITL gate placement cannot be previewed — users discover gate positions only when the pipeline pauses mid-run
- Token costs are unpredictable — teams have no way to estimate consumption before committing to a run
- Security and guard skills that would block the pipeline remain invisible until they execute against real artifacts
- First-time pipeline users have no safe rehearsal mode

## Requested Behaviour

When a user requests a pipeline simulation:

1. Load the pipeline configuration and resolve all skill references against the registry
2. Build the execution graph (skill sequence + parallel groups) without invoking any skill's real logic
3. For each skill in order, generate a **structured preview** of its outputs based on the input payload — using the output schema, not full LLM generation
4. Propagate preview outputs as inputs to subsequent skills through the graph
5. At guard skills: predict verdict based on known block patterns in the input
6. At HITL gates: record gate point, trigger condition, and estimated approval likelihood
7. Aggregate all files that would be written across all skills
8. Calculate token estimates based on skill complexity weights
9. Produce a unified **simulation report** with go/no-go summary

The simulation is entirely read-only. No files are written, no state changes occur, and no `code.changed` or other downstream events are emitted.

## Scope

- `.opencode/skills/skill-simulator/SKILL.md` — new skill (SKL-074)
- `skills/registry.json` — register new skill
- `skills/index.yaml` — add index entry

## Out of Scope

- Execution of real skill logic during simulation (all outputs are schema-based previews)
- Simulation of skills that interact with external systems (network calls, credential stores)
- Automatic promotion of simulation results to real pipeline runs
- Simulating more than two parallel branch groups simultaneously

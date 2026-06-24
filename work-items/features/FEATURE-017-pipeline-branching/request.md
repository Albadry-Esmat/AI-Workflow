# FEATURE-017 — Request: Pipeline Branching

**Origin:** Identified during ASE-OS enhancement analysis (2026-06-24).

---

## Problem Statement

The orchestrator executes exactly one pipeline path. When two architecture approaches are both viable, there is no way to explore both in parallel and compare them objectively before committing. Teams either pick one approach arbitrarily (risk: wrong choice), or do time-consuming manual exploration (risk: inconsistent evaluation criteria, no formal comparison record).

This means:
- Architecture decisions default to the first idea rather than the best idea
- There is no objective comparison mechanism — evaluation is informal and undocumented
- Both approaches cannot be evaluated against the same downstream criteria (security risk, test complexity, effort estimate) simultaneously
- The losing architecture variant leaves no documented record — ADRs lack a "what we considered and rejected" section
- Teams revisit architecture decisions post-implementation when the cost of change is highest

## Requested Behaviour

When a user wishes to explore two architecture approaches before committing, `pipeline-branching` should:

1. Accept two named architecture variants (Branch A and Branch B) from the user
2. Create **two isolated execution contexts** in state-manager — one per branch — preventing cross-contamination of artifacts
3. Run `feature-planning`, `security-review`, `testing-strategy`, and `clean-code-review` for **both branches in parallel**
4. Produce a **side-by-side comparison scorecard** with per-criterion scores across: complexity, security risk, testability, estimated effort, and cost
5. Generate a **system recommendation** with justification based on the evaluation criteria
6. Present the scorecard and recommendation at a **mandatory HITL gate** — no timeout, user must explicitly select Branch A or B
7. Promote the winning branch artifacts to the main pipeline context; archive the losing branch in state-manager
8. Generate an **ADR stub** documenting both variants and the selection rationale for adr-generator

Only two branches (A/B) are supported in v1.0.0. Forking is only available at the `architecture-design` stage.

## Scope

- `.opencode/skills/pipeline-branching/SKILL.md` — new skill (SKL-077)
- `skills/registry.json` — register new skill
- `skills/index.yaml` — add index entry

## Out of Scope

- More than two branches simultaneously (A/B/C multi-branch is not supported)
- Forking at stages other than `architecture-design` in v1.0.0
- Automatic branch selection without human approval
- Merging artifacts from both branches into a hybrid architecture
- Branch comparison for non-architecture pipeline stages

# FEATURE-015 — Request: Multi-Repo Coordinator

**Origin:** Identified during ASE-OS enhancement analysis (2026-06-24).

---

## Problem Statement

The current system operates on a single repository. Modern systems — especially microservices — span multiple repos. `dependency-analyzer` and `change-impact-analyzer` only analyze intra-repo dependencies. A breaking change in a shared library can silently break 5 consuming services across different repos with no cross-repo impact signal.

This means:
- Breaking API changes in shared libraries propagate invisibly to downstream consumers
- Teams in separate repos receive no automatic notification of upstream breaking changes
- There is no topologically-safe update sequencing across a polyrepo system
- Cross-repo dependency data is stored nowhere — each repo appears isolated to the system
- Work items for coordinated rollouts must be created manually and are frequently misaligned

## Requested Behaviour

When a change is introduced to a shared library or API-producing service, `multi-repo-coordinator` should:

1. Maintain a **cross-repo dependency registry** — a persistent map of which repos consume which shared libraries at which version constraints
2. When breaking changes are detected in a library repo, identify all consuming service repos and assess the severity of impact per consumer
3. Topologically sort the consumer graph to produce a **migration coordination plan** — which repo updates first to avoid cascading failures
4. Generate synchronized **work item stubs** for each affected repo referencing the primary change
5. Detect and flag **circular cross-repo dependencies** as critical risk requiring immediate HITL escalation

The output should be actionable: a cross-repo impact report ranked by severity, synchronized work items with cross-references, and a sequenced rollout plan.

## Scope

- `.opencode/skills/multi-repo-coordinator/SKILL.md` — new skill (SKL-075)
- `skills/registry.json` — register new skill
- `skills/index.yaml` — add index entry

## Out of Scope

- Intra-repo dependency analysis (that is `dependency-analyzer`'s responsibility)
- Automated code changes across repos (requires human approval per repo)
- Git integration or direct repository access
- Real-time webhook-based change detection
- Version control system operations

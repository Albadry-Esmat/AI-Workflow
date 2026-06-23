# ADR-0003 — Work Lifecycle Management Layer: v4.0.0 Release

**Status:** Accepted  
**Date:** 2026-06-23  
**Deciders:** Primary orchestrator  
**Supersedes:** N/A  
**Related:** [ADR-0001](ADR-0001-work-lifecycle-persistence-model.md), [ADR-0002](ADR-0002-work-item-export-contract.md)

---

## Context

The AI Workflow system (ASE-OS) has grown from a code generation pipeline into a full software delivery lifecycle orchestrator. Prior to v4.0.0, the system lacked cross-session work item tracking: bugs were reported ad hoc, change requests were not formalized, and generated tasks had no persistent lifecycle state. This made it impossible to track defect resolution, enforce state transitions, or export work items to external platforms.

The Work Lifecycle Management Layer was designed and implemented across Phases 0–6 of `docs/implementation-plan-work-lifecycle.md`. This ADR records the release decision, scope boundary, and architectural choices made during the implementation.

---

## Decision

**Release the Work Lifecycle Management Layer as v4.0.0 of the AI Workflow system.**

The release introduces 4 new skills (SKL-055–058), 2 new pipeline templates, a new work item file store (`work-items/`), and extends the existing full pipeline (`full-pipeline.json` v3.0.0) with conditional defect management and async export phases.

---

## Scope

| Component | Change | Version |
|-----------|--------|---------|
| `defect-manager` (SKL-055) | New skill | 1.0.0 |
| `change-request-manager` (SKL-056) | New skill | 1.0.0 |
| `work-item-exporter` (SKL-057) | New skill | 1.0.0 |
| `work-item-lifecycle-guard` (SKL-058) | New guard skill | 1.0.0 |
| `feature-planning` (SKL-003) | Enhancement: companion generation | 2.0.0 |
| `orchestrator` (SKL-010) | Routing table extension + new pipeline templates | 1.2.0 |
| `state-manager` (SKL-020) | `work_items` scope added to scope enum | 1.2.0 |
| `event-router` (SKL-024) | 5 new event type registrations | — |
| `skills/pipelines/defect-lifecycle.json` | New pipeline | 1.0.0 |
| `skills/pipelines/change-request.json` | New pipeline | 1.0.1 |
| `skills/pipelines/full-pipeline.json` | Phases 7b (guard), 8d (defect), 10b (export) added | 3.0.0 |
| `skills/registry.json` | 4 new entries; version bump | 4.0.0 |
| `skills/graph/skill-graph.yaml` | 4 new nodes, 16 new edges | 2.7.1 |
| `docs/governance.md` | Guard inventory + 4 new HITL gate rows | 2.4.0 |
| `docs/workflows.md` | 2 new pipeline flow diagrams | 2.3.0 |
| `docs/architecture.md` | Work Lifecycle Layer section | 2.2.0 |
| `docs/agents.md` | Skill assignments for new skills | 1.2.0 |
| `docs/skills-registry.md` | 4 new skill entries | 3.0.0 |
| `docs/system-overview.md` | 4 new capabilities | 4.0.0 |
| `work-items/` | New cross-session file store (file-based Markdown) | — |

---

## Key Architectural Decisions (Resolved in Phases 0–1)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **U1: Cross-session persistence** | File-based Markdown (`work-items/*.md`) | State-manager 512KB limit cannot hold full work item details; files provide unlimited capacity with a compressed index in state (~104KB max for 880 items) |
| **U2: Companion generation** | Opt-in (`companion_generation.enabled: false`) | Zero behavioral change for existing feature-planning callers; opt-in prevents accidental task explosion |
| **U3: Auto-fix threshold** | All bugs trigger full chain | Consistent policy; no severity-based complexity; missings get shorter chain (FIX+TEST+VALIDATION only) |
| **U4: Export directionality** | One-way outbound only | Bidirectional sync requires a dedicated sync agent; deferred to a future phase |
| **U5: Defect task schema** | Jira-compatible (Bulk Import JSON) | Direct importability into most enterprise work management platforms without transformation |

---

## Integration Contracts (Verified in Phase 5.2)

| Source | Target | Mechanism |
|--------|--------|-----------|
| `feature-planning` companion tasks | `implementation-completeness-auditor` | Companion items written to `work_items` scope; auditor reads work items for completeness scoring |
| `defect-manager` FIX-NNNN | `code-repair` | FIX task created in `work_items`; orchestrator routes FIX tasks to builder agent (code-repair). defect-manager does NOT invoke code-repair directly. |
| `change-request-manager` | `change-impact-analyzer` | Direct invocation (Step 3); `input_map` defined in Skill Composition |
| `change-request-manager` | `feature-planning` | Backpropagate feedback entry with `task_delta` as evidence; orchestrator re-invokes feature-planning |
| All lifecycle skills | `work-item-exporter` | All write to `work_items` scope + `work-items/` files; exporter reads from both sources |

---

## Governance Decisions

- **Lifecycle guard initial mode:** `warning` (not `block`) for the first 2 weeks. This prevents pipeline halts during the stabilization period. Mode should be changed to `block` after producers are stable.
- **All new HITL gates** conform to `docs/governance.md` Layer 3 rules: `type: human_approval`, no auto-continue. See governance.md for new gate rows.
- **PII scrubbing** is mandatory in work-item-exporter before any export file write. This aligns with existing governance.md Layer 1 PII protection rules.
- **Deployment gate invariant** is unaffected. The new pipelines (defect-lifecycle, change-request) do not include deployment phases and therefore do not require the non-bypassable deployment gate.

---

## Bugs Fixed During Phase 5

| Bug | File | Fix |
|-----|------|-----|
| `feature-planning "^1.2.0"` in change-request.json won't resolve to v2.0.0 | `skills/pipelines/change-request.json` | Changed to `"^2.0.0"` (v1.0.0 → v1.0.1) |
| Closure gate timeout mismatch: SKILL.md says 7200s, pipeline says 3600s | `defect-manager/SKILL.md` §12 | Updated SKILL.md to 3600s (matches pipeline) |
| Impact approval gate timeout mismatch: SKILL.md says 3600s, pipeline says 7200s | `change-request-manager/SKILL.md` §12 | Updated SKILL.md to 7200s (matches pipeline; CR impact review deserves more time) |

---

## Validation Gate Status

| Check | Status |
|-------|--------|
| `validate-skills.sh` 95/95 | ✅ PASS |
| All 5 integration contracts verified | ✅ PASS |
| All new HITL gates conform to governance.md | ✅ PASS |
| State size validated (104KB < 512KB budget) | ✅ PASS |
| Token budgets within tier limits | ✅ PASS (write agent tier: 100K) |
| All docs updated per governance sync rules | ✅ PASS |
| Registry version bumped (3.0.0 → 4.0.0) | ✅ PASS |
| ADR written and recorded | ✅ This document |

---

## Consequences

**Positive:**
- Bugs and change requests are now first-class, persistent entities with lifecycle enforcement
- Full traceability chain: requirement → task → bug → fix → test → closure
- Jira export enables external project management without bidirectional complexity
- companion generation provides a structured path from tasks to test/review coverage

**Negative / Risks:**
- Work items directory (`work-items/`) grows unbounded — requires periodic archiving for long-running projects
- Token budget is tight for multi-skill pipelines; mitigated by session context compression
- Lifecycle guard in `warning` mode may allow invalid transitions during stabilization

**Future Work:**
- Switch lifecycle guard from `warning` to `block` mode after 2-week stabilization
- Add bidirectional Jira sync as a dedicated sync skill (Phase 7 if approved)
- Implement work item archiving for completed/closed items (Phase 7)

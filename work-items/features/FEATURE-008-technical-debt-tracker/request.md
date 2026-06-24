# FEATURE-008 — Request: Technical Debt Tracker

**Origin:** Identified during ASE-OS enhancement analysis (2026-06-24).

---

## Problem Statement

`clean-code-review` finds issues in the current pipeline run but has no memory of prior runs. There is no cross-session record of unresolved technical debt, no debt trend, and no cost-of-delay analysis. Teams accumulate debt invisibly until it becomes a crisis.

This gap results in:
- The same debt items resurfacing every pipeline run with no persistent identity or tracking
- No visibility into whether debt is growing, stable, or being reduced across sessions
- `feature-planning` receiving no debt signal, so sprint planning ignores remediation capacity
- No prioritized remediation backlog — engineers must manually triage the same review output repeatedly
- No economic model for deferral cost, so debt deferral decisions lack financial justification

## Requested Behaviour

Maintain a persistent **technical debt register** across pipeline sessions. Each run of `clean-code-review` contributes new issues. `technical-debt-tracker` consolidates them, deduplicates resolved items, calculates a **debt score** (0–100, lower is better), projects the maintenance cost over time using a simple interest model, and surfaces a prioritized remediation backlog ranked by ROI.

The skill supports four operations: `record` (ingest new review output), `query` (retrieve debt items by filter), `report` (generate full debt analysis), and `resolve` (mark items as fixed).

## Scope

- `technical-debt-tracker/SKILL.md` (SKL-068) — new skill
- `skills/registry.json` — register SKL-068
- `skills/index.yaml` — add index entry

## Out of Scope

- Automatically fixing debt items (that is `code-repair`'s responsibility)
- Real-time code analysis — debt is recorded from `clean-code-review` output, not raw code
- Tracking infrastructure or security debt (handled by `security-review` and `deployment-strategy`)
- Cross-project aggregation — scope is single `project_id` per invocation

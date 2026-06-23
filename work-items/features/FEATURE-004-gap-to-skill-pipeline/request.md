# FEATURE-004 — Request: Gap-to-Skill Reactive Pipeline

**Origin:** Derived from analysis of the "Autonomous Skill Discovery, Validation, and Generation" feature proposal (2026-06-23). The fully-autonomous creation path was rejected (violates HITL invariant). The human-guided reactive pipeline was adopted.

---

## Problem Statement

FEATURE-001 logs capability gaps and preserves them in session state. But there is no structured path from "gap detected" to "skill created and registered." The current situation forces users to:

1. Manually notice that a gap was logged
2. Separately invoke `skill-authoring` from scratch
3. Remember (or find) the exact original request that triggered the gap
4. Re-specify domain, triggers, and description with no pre-population from the gap context

This friction means that most logged gaps are never acted on. The gap telemetry accumulates but capabilities are not added. Additionally:

- There is no mechanism to pre-populate the `skill-authoring` scaffold from the gap's domain and raw prompt
- There is no recursion guard preventing a gap-to-skill invocation from triggering another gap event (infinite loop risk)
- The workflow crosses three existing skills (`skill-authoring`, `quality-scoring`, skill registration) with no defined coordination layer

## Requested Behaviour

When `gap_context` is present in session state, the user can invoke a dedicated `gap-to-skill` pipeline that:

1. Restores the original request context from `gap_context`
2. Pre-populates the `skill-authoring` scaffold with domain, suggested triggers, and a description template derived from the raw prompt (`gap_seed` mode — see FEATURE-002/FEATURE-003 prerequisites)
3. Runs deduplication check (FEATURE-002 Step 0) against pre-populated inputs
4. Guides the user through SKILL.md authoring (confirm or override each pre-filled field)
5. Runs quality scoring (quality-scoring skill)
6. Requires explicit HITL approval before registering the new skill — this gate is **non-bypassable**
7. On approval: registers the skill with `origin_metadata.source = "gap-triggered"` (FEATURE-003), clears `gap_context` from session state, and writes `retry_context` (for FEATURE-005)
8. Presents the user with a retry prompt: "Skill `<ID>` registered. Retry your original request now?"

A recursion guard MUST prevent the pipeline from being invoked while another gap-to-skill execution is already active in the same session (`max_concurrent_instances: 1`).

The `gap_seed` input mode in `skill-authoring` is an **explicit prerequisite** for this feature and must be implemented as part of this FEATURE's DoD — it is not assumed to pre-exist.

## Scope

- `skills/gap-to-skill-pipeline/SKILL.md` (SKL-065) — new pipeline skill
- `skill-authoring/SKILL.md` — add `gap_seed` invocation mode (pre-populated scaffold entry point)
- `skills/registry.json` — register SKL-065
- `skills/pipelines/gap-to-skill.json` — new pipeline template

## Out of Scope

- Automatic skill creation without human HITL approval (non-negotiable; governance invariant)
- Background or asynchronous gap processing
- Batching multiple gaps into a single pipeline execution
- Any change to the standard `skill-authoring` `create` / `refactor` / `split` / `validate` modes beyond adding `gap_seed`

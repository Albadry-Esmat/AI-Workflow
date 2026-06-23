# FEATURE-002 — Request: Skill Deduplication Check in skill-authoring

**Origin:** Derived from analysis of the "Autonomous Skill Discovery, Validation, and Generation" feature proposal (2026-06-23). The validation/guard component was adopted as a pre-creation check inside `skill-authoring`.

---

## Problem Statement

Currently, when a user invokes `skill-authoring` to create a new skill, there is no check to detect whether a semantically equivalent skill already exists in the registry. Two authors working independently, or the gap-to-skill pipeline generating a skill for a domain that is already partially covered, can produce near-duplicate skills (e.g., "deployment-validator" and "deploy-safety-check") that overlap in triggers, scope, and outputs.

Consequences:
- **Registry bloat** — redundant skills increase maintenance surface area
- **Routing ambiguity** — duplicate trigger patterns cause the routing table to match the wrong skill or fail to break ties deterministically
- **Wasted effort** — the author may spend several story points producing a skill that already exists or that could have been an extension of an existing one
- **Silent knowledge loss** — if a near-duplicate is allowed without comment, the system never records why two similar skills exist

## Requested Behaviour

Before `skill-authoring` generates a SKILL.md scaffold, it MUST:

1. Extract proposed triggers and domain from the author's input
2. Query `skills/registry.json` for existing skills in the same domain
3. Compute a similarity score against each candidate (trigger overlap + description similarity)
4. If any candidate exceeds the **deduplication threshold** (similarity ≥ 0.75):
   - Halt scaffold generation
   - Surface the top matching skill(s) with IDs and similarity scores
   - Present a HITL choice: extend the existing skill, proceed with a new one (override), or cancel
5. If the author confirms intent to proceed despite the duplicate hit (Option B), record the decision in the new skill's `origin_metadata.dedup_override` field (see FEATURE-003)

The check MUST NOT run when `skill-authoring` is invoked in `refactor`, `split`, or `validate` mode — only on net-new `create` / `gap_seed` invocations.

## Scope

- `skill-authoring/SKILL.md` — add deduplication guard as Step 0 in the `create` and `gap_seed` workflows
- `skills/schema/dedup-check-result.schema.json` — new schema for the structured result object

## Out of Scope

- Merging or auto-refactoring existing duplicate skills
- Semantic embedding model selection (v1 uses token-overlap approximation only)
- Any change to `skill-authoring`'s `refactor`, `split`, or `validate` modes
- Retroactive deduplication audit of the existing 58-skill registry

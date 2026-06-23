# FEATURE-005 — Request: Gap Retry Execution

**Origin:** Derived from analysis of the "Autonomous Skill Discovery, Validation, and Generation" feature proposal (2026-06-23). The loop-closure / re-execution component was adopted to complete the reactive intelligence cycle.

---

## Problem Statement

After FEATURE-004 successfully registers a new skill to fill a capability gap, the user still faces a manual step: re-entering the original request to actually use the new skill. They must:

1. Remember the exact original request that triggered the gap
2. Re-type or copy-paste it into a new message
3. Trust that the new skill's trigger patterns match their re-phrased version

This is a friction point that breaks the flow of work. The purpose of the entire gap-detection → skill-creation loop is to handle the request. Without an automatic retry offer, the loop is open-ended: the system logs the gap, creates the skill, but never confirms that the original problem is actually solved.

There is also a correctness concern: if the retry matches a different skill than the one just created (because the triggers were imprecise), the user should know immediately, before they consider the gap "closed."

## Requested Behaviour

After FEATURE-004 registers a new skill and writes `retry_context` to session state, the orchestrator MUST:

1. Detect `retry_context` on the next user interaction (or immediately after registration)
2. Present: "Retry your original request now? → `<raw_prompt>`  [YES] [NO] [LATER]"
3. If YES:
   - Set `retry_in_progress = true` in session state (recursion guard)
   - Re-route the original `raw_prompt` through the standard orchestrator routing table
   - If it matches (confidence ≥ 0.5): execute the skill pipeline normally, clear `retry_context`
   - If it does NOT match: surface "The new skill did not match — consider refining its trigger patterns" — do NOT emit a new `capability_gap` event — clear `retry_context`
4. If NO: clear `retry_context` immediately
5. If LATER: keep `retry_context` (TTL continues) and process the user's current request normally

`retry_context` is session-scoped with a 1-hour TTL. It is cleared after execution (success or failure) or explicit NO.

## Scope

- `orchestrator/SKILL.md` — retry execution block (detect `retry_context`, show prompt, re-route)
- `skills/schema/system-state-schema.json` — add `retry_context` optional object

## Out of Scope

- Automatic retry without user confirmation
- Retry of multiple gaps in a single batch
- Retry after session expiry (TTL: 1 hour — non-negotiable, session-scoped only)
- Any modification to how the routed skill executes (standard pipeline applies)

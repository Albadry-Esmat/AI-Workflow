# FEATURE-001 — Request: Capability Gap Detection + Telemetry

**Origin:** Derived from analysis of the "Autonomous Skill Discovery, Validation, and Generation" feature proposal (2026-06-23). The autonomous/auto-register components were rejected; gap detection and structured logging were adopted.

---

## Problem Statement

When a user submits a request that no existing skill can handle, the orchestrator currently returns a generic fallback message — "Which stage of the pipeline do you need?" — and stops. Nothing is recorded. No one knows what capability was missing, how often it happens, or what domain it belongs to.

This means:
- Capability gaps are invisible at the system level
- Session summaries have no record of unmet requests
- The adaptive pipeline cannot surface gap patterns (what it cannot see, it cannot propose fixes for)
- Users hit a dead end with no forward path

## Requested Behaviour

When the orchestrator cannot route a request above a minimum confidence threshold:

1. Classify the failure as a formal **capability gap** (not just a routing miss)
2. Log a structured `capability_gap` event to the telemetry system (domain, intent, confidence score)
3. Return a clear, actionable response: "No skill found. This gap has been logged. You may create a new skill via the gap-to-skill workflow."
4. Write the original request to session state so re-execution is possible after a skill is created

Session summaries should expose gap counts and top gap domains so system administrators can see where new skills are most needed.

## Scope

- `orchestrator/SKILL.md` — routing dead-end detection + gap event emission
- `behavioral-telemetry-collector/SKILL.md` (SKL-047) — new `capability_gap` event type
- `session-insights/SKILL.md` (SKL-048) — gap metrics in session summary
- `skills/schema/system-state-schema.json` — `gap_context` optional object

## Out of Scope

- Automatic skill creation (requires human approval — see FEATURE-004)
- External web search for best practices
- Any change to existing routing logic for requests that DO match a skill

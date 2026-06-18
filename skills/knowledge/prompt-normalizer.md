# Prompt Normalizer — Knowledge Reference

**Skill ID:** SKL-040
**Version:** 1.0.0 | **Last updated:** 2026-06-18
**Mastery Level:** intermediate
**Executable Skill:** [prompt-normalizer](../meta/prompt-normalizer.md)
**Primary Sources:**
- *Grice's Cooperative Principle* — H.P. Grice, 1975
- *Prompt Engineering Guide* — Anthropic, 2024
- *Designing Voice User Interfaces* — Cathy Pearl, O'Reilly, 2016

---

## Overview

`prompt-normalizer` is a pre-routing intent extraction skill that runs before any pipeline is selected. It takes a raw user message and produces a structured intent object — identifying what the user wants to do, what they are talking about, and whether enough information exists to route confidently. When the intent is clear, it produces a normalized prompt; when it is ambiguous, it generates exactly one clarifying question. The skill exists because routing accuracy degrades as user phrasings diverge from the system's keyword triggers, and silent misrouting is worse than a single well-placed question.

---

## Purpose

Apply this skill to:

- Reduce routing failures caused by vague or keyword-free user prompts
- Prevent silent misrouting by scoring confidence before committing to a pipeline
- Produce structured, machine-readable intent that downstream skills can consume without re-parsing natural language
- Ask one precise clarifying question instead of guessing or overwhelming the user with a menu of options

---

## Principles

### P1 — Cooperative Communication Requires Minimum Necessary Contribution *(Grice, 1975 — Cooperative Principle, Maxim of Quantity)*

Grice's Maxim of Quantity states that a speaker should make their contribution as informative as required — no more, no less. Applied to prompt normalization: the normalizer must not add information the user did not provide (violates "no more") and must not withhold a clarification when routing would fail silently (violates "no less"). The normalizer asks exactly one question when one piece of information is missing, and routes immediately when nothing is missing.

**Rules derived from this principle:**

- Never add constraints, technologies, or scope boundaries the user did not state or clearly imply
- Never ask more than one clarification question per turn
- Never route with unresolved ambiguity flags without surfacing a clarification

### P2 — Intent Has Structure: Verb + Object + Constraint *(Prompt Engineering Guide — Anthropic, 2024, §Structured Prompts)*

Well-formed instructions follow a consistent structure: an action verb (what to do), an object (what to do it to), and optional constraints (how, how much, what to avoid). Vague prompts fail not because users are unclear, but because they omit one of these components — most commonly the object or the constraint. The normalizer's extraction steps (steps 1–4) are a direct implementation of this structure: verbs map to `intent_type`, nouns map to `subject`, qualifiers map to `scope_signals`.

**Rules derived from this principle:**

- Classify `intent_type` from the dominant verb, not from nouns or qualifiers
- Identify `subject` from the primary noun phrase — it is the most commonly missing element
- Treat qualifiers as scope signals, not intent signals — they modify intent, they do not define it

### P3 — Ask Once, Ask Right: Single-Question Disambiguation Outperforms Multi-Question Flows *(Designing Voice User Interfaces — Pearl, 2016, Ch. 5: Handling Errors)*

In conversational interface design, presenting users with multiple simultaneous questions is one of the most common causes of session abandonment. Pearl's research on voice UI error handling shows that a single, precisely targeted repair question resolves ambiguity in 85%+ of cases without user frustration. The normalizer implements this by selecting only the first (highest-priority) ambiguity flag for the clarification question — all others are deferred to the next turn.

**Rules derived from this principle:**

- Select exactly one ambiguity flag for clarification — never surface multiple
- Prioritize flags in this order: MISSING_SUBJECT → MISSING_INTENT → MULTI_INTENT → CONTEXT_REQUIRED → SCOPE_CONFLICT
- Frame clarification questions as closed or bounded-choice questions, not open-ended ones

---

## Practices

| Practice | Description |
|----------|-------------|
| **Verb-first classification** | Classify `intent_type` from the first strong action verb found — not from nouns or the routing table. Verbs are more stable than terminology across user populations. |
| **Subject extraction before routing** | Always identify the subject noun phrase before attempting routing. A missing subject is the single most common cause of routing failure and must be caught first. |
| **Priority-ordered flag resolution** | Resolve ambiguity flags in a fixed priority order (MISSING_SUBJECT first). This makes clarification behavior predictable and testable. |
| **Confidence gating** | Never route with `confidence: low`. A wrong pipeline is harder to recover from than a one-turn delay. |
| **Short normalized prompts** | Cap normalized prompts at 200 characters. Downstream routing keyword matching degrades on long sentences — precision beats completeness here. |
| **Session context for pronoun resolution** | Before flagging CONTEXT_REQUIRED, check `session_context.prior_turns` for a referent. Most pronouns resolve from the immediately preceding turn. |

---

## Anti-patterns

### AP1 — Hallucinated Normalization

**What it is:** The normalizer adds technical details, constraints, or scope boundaries that the user did not say or imply — e.g., turning "fix my login" into "Fix the JWT authentication token expiry bug in the auth module using a sliding window approach."

**Why it is harmful:** The user's actual problem may be entirely different. Adding unimplied constraints narrows the pipeline inappropriately and wastes tokens when the downstream skill rejects or ignores the fabricated details.

**How to fix it:** Only include information found in `signal_map` (step 1). If a detail is not in `scope_signals` or the subject, it must not appear in `normalized_prompt`.

---

### AP2 — Silent Low-Confidence Routing

**What it is:** The normalizer routes a prompt to a pipeline despite `confidence: low` or multiple ambiguity flags, because a plausible match exists in the routing table.

**Why it is harmful:** A misrouted pipeline runs through multiple phases before failing, consuming significant tokens and time, and returning an unhelpful result that must be discarded.

**How to fix it:** Enforce the rule: `confidence == "low"` always maps to `action: request_pipeline_selection`. A routing table match is necessary but not sufficient.

---

### AP3 — Multi-Question Clarification

**What it is:** The normalizer lists all detected ambiguity flags as a numbered question list — e.g., "I need to know: (1) what module? (2) build or review? (3) quick or thorough?"

**Why it is harmful:** Users perceive this as a failure mode ("the AI doesn't understand me") and frequently abandon the session or repeat the original vague prompt verbatim. It also violates Grice's Maxim of Manner (be brief and orderly).

**How to fix it:** Select exactly one flag — the highest-priority unresolved one — and ask one bounded question. Defer the rest to subsequent turns.

---

### AP4 — Over-eager Normalization

**What it is:** The normalizer calls itself on prompts that already contain unambiguous routing triggers — e.g., running on "review this code for SOLID violations" which already maps cleanly to `quick-review.json`.

**Why it is harmful:** Adds unnecessary latency (one extra LLM round-trip) and risks distorting a perfectly clear prompt.

**How to fix it:** The orchestrator should short-circuit prompt-normalizer when the raw prompt already matches a routing table trigger with high keyword density. Invoke prompt-normalizer only when no trigger match is found or when confidence is low.

---

## Examples

### ✅ Correct — Clear intent, zero ambiguity flags → route immediately

**Input:**
```
"can u take a look at my auth module it feels messy"
```

**Output:**
```json
{
  "intent_object": {
    "intent_type": "review",
    "subject": "auth module",
    "scope_signals": [],
    "ambiguity_flags": []
  },
  "normalized_prompt": "Review code quality of the auth module — check for SOLID violations, anti-patterns, and refactoring opportunities.",
  "routing_decision": {
    "confidence": "high",
    "suggested_pipeline": "quick-review.json",
    "suggested_entry_agent": "reviewer"
  },
  "clarification_request": null,
  "action": "route_immediately"
}
```

---

### ✅ Correct — One ambiguity flag → single targeted question

**Input:**
```
"can u help me build it"
```

**Session context:** no prior turns

**Output:**
```json
{
  "intent_object": {
    "intent_type": "build",
    "subject": null,
    "scope_signals": [],
    "ambiguity_flags": ["MISSING_SUBJECT"]
  },
  "normalized_prompt": null,
  "routing_decision": {
    "confidence": "medium",
    "suggested_pipeline": null,
    "suggested_entry_agent": null
  },
  "clarification_request": "What module, feature, or system are you looking to build?",
  "action": "ask_clarification"
}
```

---

### ❌ Incorrect — Hallucinated normalization

**Input:**
```
"fix the login"
```

**Bad output (DO NOT DO THIS):**
```json
{
  "normalized_prompt": "Fix the JWT token expiry bug in the login endpoint by implementing a 24-hour sliding window refresh strategy.",
  "action": "route_immediately"
}
```

**Why wrong:** The user said nothing about JWT, token expiry, or sliding windows. This violates P1 (no more than what was said) and AP1. The correct output would set `subject = "login"`, `intent_type = "build"` (repair is a build variant), zero ambiguity flags if the subject is clear, and produce `normalized_prompt = "Fix the login — diagnose and repair the failing behaviour."`.

---

### ❌ Incorrect — Multi-question clarification

**Input:**
```
"help me with the thing"
```

**Bad output (DO NOT DO THIS):**
```
"I need to know several things before I can help:
1. What module or feature is 'the thing'?
2. Do you want to build something new or review existing code?
3. How thorough should this be — quick scan or full review?"
```

**Why wrong:** Three questions violate P3 (ask once, ask right). The correct output selects only MISSING_SUBJECT (highest priority flag) and asks: `"What module, feature, or system are you referring to?"`

---

## Related Skills

| Skill | ID | Relationship |
|-------|----|-------------|
| Orchestration | SKL-010 | Parent — orchestrator invokes prompt-normalizer as step 0 before routing table lookup |
| Event Router | SKL-025 | Sibling meta skill — event-router handles internal system events; prompt-normalizer handles human-typed prompts |
| Requirement Analysis | SKL-001 | Downstream consumer — when action is `route_immediately` on a requirements pipeline, requirement-analyzer receives the normalized prompt as its primary input |

---

## Source References

| Source | Chapter / Section | Linked Content |
|--------|------------------|----------------|
| *Logic and Conversation* — H.P. Grice (1975) | Cooperative Principle: Maxims of Quantity and Manner | P1, AP3 |
| *Prompt Engineering Guide* — Anthropic (2024) | §Structured Prompts: Verb + Object + Constraint | P2, AP1 |
| *Designing Voice User Interfaces* — Cathy Pearl, O'Reilly (2016) | Ch. 5: Handling Errors and Confirmations | P3, AP3, AP4 |

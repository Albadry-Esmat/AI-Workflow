---
name: multi-agent-debate
version: 1.0.0
domain: architecture
description: 'Use when adversarial validation of an architecture proposal is needed before planning begins. Triggers on: "debate architecture", "validate architecture adversarially", "architect vs reviewer", "multi-agent debate", "critique-harden architecture", "consensus-based review". Inspired by Microsoft AutoGen ConversableAgent debate pattern. Only for full-pipeline and architecture-only pipelines. Controlled by pipeline config flag: debate_architecture: true.'
author: system
---

## Purpose

Runs an adversarial debate loop between an Architect agent (proposes) and a Reviewer agent
(critiques) until consensus is reached or `max_rounds` is exceeded. Produces a
critique-hardened architecture artifact that has survived adversarial validation before
feature planning begins.

**When to invoke:** After `phase-2-architecture` and before `phase-2b-design` (UX + DB).
Enabled via `pipeline_config.debate_architecture: true`. Skipped if the flag is absent or
`false`.

**Why adversarial validation matters:** Single-pass architecture decisions propagate
unchallenged through all downstream phases. Low-quality decisions discovered in code review
(Phase 6) or at the HITL gate are expensive to fix late. Multi-agent debate surfaces
structural weaknesses at the cheapest point in the pipeline.

**Inspired by:** Microsoft AutoGen's `ConversableAgent` debate pattern.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `architecture_proposal` | `object` | Yes | Output from `architecture-design` skill — the architecture to be debated. |
| `critique_criteria` | `array[string]` | No | Criteria the Reviewer evaluates against. Default: standard criteria set (see below). |
| `max_rounds` | `integer` | No | Maximum debate rounds. Default: `5`. Max: `10`. |
| `consensus_threshold` | `float` | No | Fraction of criteria that must reach `"pass"` verdict for convergence. Default: `0.80`. Range: `0.5–1.0`. |
| `session_id` | `string` | Yes | UUID v4 of the active session. |

**Default `critique_criteria`:**
```
1. Module boundaries are cohesive (single responsibility per module)
2. No circular dependencies between modules
3. All external integrations have defined contracts (API/event schemas)
4. Data flow is unidirectional or explicitly justified if bidirectional
5. Security boundaries are explicit (auth layers, trust boundaries)
6. No single points of failure without documented mitigation
7. Technology choices are justified with explicit tradeoff rationale
8. Scalability constraints are acknowledged and bounded
9. Module count is justified (not over-engineered for scope)
10. All requirements are traceable to at least one module
```

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["architecture_proposal", "session_id"],
  "properties": {
    "architecture_proposal": { "type": "object" },
    "critique_criteria": {
      "type": "array",
      "items": { "type": "string" },
      "minItems": 1,
      "maxItems": 20
    },
    "max_rounds": {
      "type": "integer",
      "minimum": 1,
      "maximum": 10,
      "default": 5
    },
    "consensus_threshold": {
      "type": "number",
      "minimum": 0.5,
      "maximum": 1.0,
      "default": 0.80
    },
    "session_id": { "type": "string", "format": "uuid" }
  }
}
```

## Required Context

- `architecture_proposal` must be the output from `architecture-design@^1.1.0` or later.
- `session_id` must match the active pipeline session.
- `pipeline_config.debate_architecture` must be `true` in the pipeline configuration for
  this skill to be invoked (enforced by orchestrator).

## Execution Logic

```
Step 1 — Initialize debate state
  SET effective_criteria = critique_criteria ?? DEFAULT_CRITERIA (10 items)
  SET effective_max_rounds = max_rounds ?? 5
  SET effective_threshold = consensus_threshold ?? 0.80
  SET total_criteria = len(effective_criteria)
  SET required_passing = ceil(total_criteria * effective_threshold)
  SET round = 1
  SET debate_transcript = []
  SET criteria_verdicts = { criterion: "pending" for each criterion }
  Output: initialized_debate_state

Step 2 — Round loop (repeat until termination condition met)
  ── ARCHITECT TURN ──────────────────────────────────────────────────────────
  Round 1:
    Architect presents architecture_proposal verbatim.
    architect_response = { round: 1, type: "initial_proposal", content: architecture_proposal }

  Round N > 1:
    Architect receives concerns[] from Round N-1 where verdict == "concern" or "reject".
    Architect produces revised_proposal addressing each concern:
      For each concern: either resolve it (modify affected module/decision) or explicitly
      rebut it with evidence from requirements.
    architect_response = {
      round: N, type: "revised_proposal",
      content: revised_proposal,
      addressed_concerns: [{ concern_id, resolution | rebuttal }]
    }

  ── REVIEWER TURN ───────────────────────────────────────────────────────────
  Reviewer evaluates each criterion against the current architect_response.content:
    For each criterion C:
      IF C already reached "pass" in a prior round: retain "pass" (pass is sticky).
      ELSE:
        verdict = "pass" | "concern" | "reject"
        evidence = specific reference to the architecture that justifies verdict
        remediation = concrete suggestion (for concern/reject verdicts only)
        criteria_verdicts[C] = verdict
    reviewer_response = {
      round: N, type: "critique",
      criteria: [{ criterion, verdict, evidence, remediation }],
      concerns: [criteria where verdict != "pass"]
    }

  ── CONSENSUS SCORE ─────────────────────────────────────────────────────────
  passing_count = count(criteria_verdicts where verdict == "pass")
  consensus_score = passing_count / total_criteria

  ── APPEND TO TRANSCRIPT ────────────────────────────────────────────────────
  debate_transcript.append({
    round: N,
    architect_response: architect_response,
    reviewer_concerns: reviewer_response.concerns,
    consensus_score: consensus_score
  })

  ── TERMINATION CHECK ───────────────────────────────────────────────────────
  CONVERGED:  IF consensus_score >= effective_threshold:
                SET termination = "converged"
                SET final_architecture = architect_response.content
                BREAK

  STALEMATE:  IF N >= 2:
                previous_concerns = debate_transcript[N-2].reviewer_concerns
                current_concerns  = reviewer_response.concerns
                IF set(current_concern.criterion) == set(previous_concern.criterion):
                  ← same criteria remain unresolved in consecutive rounds
                  SET termination = "stalemate"
                  SET final_architecture = architect_response.content (best-effort)
                  BREAK

  MAX_ROUNDS: IF round == effective_max_rounds:
                SET termination = "max_rounds"
                SET final_architecture = architect_response.content (best-effort)
                BREAK

  INCREMENT round

Step 3 — Handle escalation (if termination != "converged")
  IF termination == "stalemate" OR termination == "max_rounds":
    Escalate to HITL gate:
      Present:
        - Debate transcript (all rounds)
        - Current consensus_score (<threshold%)
        - Unresolved concerns with evidence and remediation suggestions
        - Recommendation: "Review unresolved concerns before proceeding to planning"
      Human choices:
        "override" → accept current final_architecture as-is; continue pipeline
        "re_scope" → modify critique_criteria and restart debate (loops back to Step 1)
        "reject"   → halt pipeline; do not proceed to planning
      Gate timeout: 3600s.
      On timeout: escalate to pipeline error; do NOT auto-accept.
  Output: hitl_decision (if applicable)

Step 4 — Assemble output
  SET unresolved_concerns = [criteria where verdict != "pass" in final round]
  Return output per output schema.
  Output: debate_result
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `final_architecture` | `object` | Critique-hardened architecture proposal. Same structure as `architecture-design` output. |
| `debate_transcript` | `array[object]` | Full debate log: `[{round, architect_response, reviewer_concerns, consensus_score}]` |
| `consensus_reached` | `boolean` | `true` if convergence achieved before max_rounds. |
| `termination` | `string` | One of: `"converged"`, `"stalemate"`, `"max_rounds"`, `"hitl_override"`, `"hitl_reject"`. |
| `rounds_taken` | `integer` | Number of complete rounds executed. |
| `final_consensus_score` | `float` | Consensus score at termination (0.0–1.0). |
| `unresolved_concerns` | `array[object]` | Criteria still at `"concern"` or `"reject"` at termination. Surfaced to feature-planning as architectural risks. |
| `metrics` | `object` | Execution metrics |
| `feedback` | `array[object]` | Feedback entries (warnings for stalemate, escalations, etc.) |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["final_architecture", "debate_transcript", "consensus_reached", "termination",
               "rounds_taken", "final_consensus_score", "unresolved_concerns", "metrics", "feedback"],
  "properties": {
    "final_architecture":    { "type": "object" },
    "debate_transcript": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["round", "consensus_score"],
        "properties": {
          "round":             { "type": "integer" },
          "architect_response": { "type": "object" },
          "reviewer_concerns": { "type": "array" },
          "consensus_score":   { "type": "number", "minimum": 0, "maximum": 1 }
        }
      }
    },
    "consensus_reached":     { "type": "boolean" },
    "termination": {
      "type": "string",
      "enum": ["converged", "stalemate", "max_rounds", "hitl_override", "hitl_reject"]
    },
    "rounds_taken":          { "type": "integer", "minimum": 1 },
    "final_consensus_score": { "type": "number", "minimum": 0, "maximum": 1 },
    "unresolved_concerns":   { "type": "array", "items": { "type": "object" } },
    "metrics": {
      "type": "object",
      "required": ["tokens_in", "tokens_out", "duration_ms", "items_produced", "version"],
      "properties": {
        "tokens_in":      { "type": "integer" },
        "tokens_out":     { "type": "integer" },
        "duration_ms":    { "type": "integer" },
        "items_produced": { "type": "integer" },
        "version":        { "type": "string" }
      }
    },
    "feedback": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["type", "from_skill", "reason"],
        "properties": {
          "type":       { "type": "string", "enum": ["backpropagate", "info", "warning"] },
          "from_skill": { "type": "string" },
          "reason":     { "type": "string" }
        }
      }
    }
  }
}
```

## Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Behavior |
|------|---------|---------|----------|
| Debate escalation | `termination = "stalemate"` or `"max_rounds"` | 3600s | Present transcript, consensus score, unresolved concerns. Human: override (accept), re_scope (restart), or reject. No timeout auto-accept — timeout → pipeline error. |

If `consensus_reached = true`, no HITL gate is raised — the debate converged autonomously.

## Rules & Constraints

- **Pass is sticky:** Once a criterion reaches `"pass"` in any round, it MUST NOT regress to
  `"concern"` or `"reject"` in subsequent rounds. This prevents indefinite oscillation.
- **Reviewer must cite evidence:** Every `"concern"` or `"reject"` verdict MUST include an
  `evidence` reference to a specific element in the architecture (module name, data flow,
  decision). Uncited verdicts are invalid — treat as `"pass"` with a warning.
- **max_rounds hard cap:** The debate MUST terminate after `effective_max_rounds` regardless
  of consensus score. There is no way to extend beyond the cap at runtime.
- **Stalemate detection:** Compare the set of unresolved criterion keys across consecutive
  rounds. If they are identical (same concerns, round after round), declare STALEMATE
  immediately rather than waiting for max_rounds.
- **Unresolved concerns propagate:** `unresolved_concerns[]` from the debate MUST be passed
  as `architecture_risks[]` to the `feature-planning` skill input — ensuring planners are
  aware of unresolved architectural tensions.
- **Not invoked by default:** This skill is opt-in. Pipelines must set
  `debate_architecture: true` in `pipeline_config` to enable it.
- **Quality gate for registration:** Per governance §5.1, this skill required quality-scoring
  ≥ 70/100 and HITL approval before registry registration. Score: 87/100 (approved).

## Security Considerations

- The Architect and Reviewer agents operate on architecture metadata (module names, data
  flows, decisions) — they MUST NOT have access to actual source code, credentials, or
  infrastructure details.
- Debate transcripts are stored in `session_context` and are subject to the same retention
  and compression rules as other skill outputs.
- The HITL escalation gate MUST NOT time out silently — a timed-out gate MUST surface as a
  pipeline error, not a silent approval.

## Token Optimization

- Debate rounds are iterative — only pass delta context between rounds (concerns[] from
  prior round), not the full transcript. This keeps per-round token count bounded.
- Pass-sticky rule keeps the criteria evaluation context small: only unresolved criteria
  are re-evaluated in each round.
- Maximum token budget per debate: `max_rounds × (architecture_tokens + criteria_tokens)`.
  For a 10-criterion debate with `max_rounds=5`: approximately 25,000–40,000 tokens total.
- `debate_transcript` is compressed after the debate completes (Step 3i of orchestrator)
  — retaining round summaries only (consensus_score, count of concerns).

## Quality Checklist

- [ ] `architecture_proposal` validated against architecture-design output schema before Round 1
- [ ] Reviewer cites evidence for every non-pass verdict
- [ ] Pass-sticky rule enforced (no criterion regresses from pass)
- [ ] STALEMATE detection fires on identical concern sets in consecutive rounds
- [ ] MAX_ROUNDS cap enforced regardless of consensus_score
- [ ] HITL escalation raised on STALEMATE or MAX_ROUNDS — never auto-accepted on timeout
- [ ] `unresolved_concerns[]` propagated to feature-planning as `architecture_risks[]`
- [ ] `termination` field accurately reflects actual termination reason
- [ ] `debate_transcript` has one entry per round executed
- [ ] Token emission event sent after debate completes (TASK-0066 — `skill.tokens_consumed`)

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| `architecture_proposal` is empty or malformed | Return error: `{"error": "INVALID_ARCHITECTURE_PROPOSAL"}`. Do not begin debate. |
| Reviewer produces uncited verdict | Treat as `"pass"` with `warning` feedback: "Reviewer verdict for criterion <C> has no evidence citation — treated as pass." |
| HITL escalation gate timeout (3600s) | Return `{"error": "DEBATE_GATE_TIMEOUT"}`. Pipeline halts. Never auto-accept. |
| HITL human selects `"re_scope"` | Restart debate from Step 1 with modified `critique_criteria`. Max 1 re-scope allowed per invocation. |
| `max_rounds` exceeded before convergence | Emit `warning` feedback, escalate to HITL (Step 3). Do NOT auto-proceed. |
| `consensus_threshold` cannot be met in any configuration | Emit `warning` suggesting criteria relaxation; escalate to HITL. |

## 13. Skill Composition

```yaml
consumes_from:
  - skill: architecture-design
    version: "^1.1.0"
    role: architecture_proposal input

produces_for:
  - skill: feature-planning
    version: "^2.1.0"
    passes: final_architecture, unresolved_concerns (as architecture_risks[])
  - skill: frontend-ux-architect
    version: "^2.0.0"
    passes: final_architecture (same as architecture-design would pass)
  - skill: database-architect
    version: "^1.1.0"
    passes: final_architecture

pipeline_entry:
  - pipeline: full-pipeline
    phase: phase-2a-debate (optional — enabled by debate_architecture: true)
  - pipeline: architecture-only
    phase: phase-2a-debate (optional)
```

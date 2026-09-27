---
name: clarify
version: 1.0.0
domain: requirements
description: 'Use when requirements need targeted clarification before architecture begins. Analyzes
  requirement-analyzer output, identifies ambiguous or under-specified requirements, generates ≤5
  targeted questions, and suspends the pipeline at a HITL gate until answers are provided. Triggers
  on: "clarify requirements", "need more info", "ambiguous requirements", inserted automatically
  between requirement-analyzer and architecture-design in full-pipeline.'
author: system
---

## Purpose

Prevent ambiguous requirements from propagating into architecture decisions. The `clarify` skill
analyzes the output of `requirement-analyzer`, identifies the requirements most likely to produce
incorrect architecture if left unresolved, generates ≤ 5 high-impact targeted questions, and
suspends the pipeline at a HITL gate until answers are provided. If no ambiguities are found, it
emits `clarifications_needed: false` and the pipeline advances automatically without interruption.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `requirements` | `array[object]` | Yes | Normalized requirements from `requirement-analyzer` |
| `open_questions` | `array[string]` | Yes | Existing open questions from `requirement-analyzer` |
| `assumptions` | `array[object]` | Yes | Assumptions detected by `requirement-analyzer` |
| `project_context` | `object` | No | Parsed `CONSTITUTION.md` (injected by orchestrator, FEATURE-006) |
| `skip_clarify` | `boolean` | No | Default `false`. Set `true` for CI/non-interactive runs to bypass the HITL gate |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "requirements": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id":        { "type": "string" },
          "type":      { "type": "string", "enum": ["F", "NF", "C"] },
          "statement": { "type": "string" },
          "priority":  { "type": "string", "enum": ["critical", "high", "medium", "low"] }
        },
        "required": ["id", "type", "statement", "priority"]
      }
    },
    "open_questions":  { "type": "array", "items": { "type": "string" } },
    "assumptions": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "statement":  { "type": "string" },
          "confidence": { "type": "string", "enum": ["high", "medium", "low"] }
        },
        "required": ["statement", "confidence"]
      }
    },
    "project_context": { "type": "object" },
    "skip_clarify":    { "type": "boolean", "default": false }
  },
  "required": ["requirements", "open_questions", "assumptions"]
}
```

## Required Context

- Output from `requirement-analyzer` (all three fields: `requirements`, `open_questions`, `assumptions`).
- `project_context` from `CONSTITUTION.md` if available — used to resolve ambiguities that are already
  answered by the constitution (tech stack, team conventions) without asking the user again.
- This skill is designed to run once per pipeline. Do NOT invoke it more than once per pipeline run.

## Execution Logic

```
Step 1 — Constitution pre-filter
  If project_context is not null:
    For each open question and assumption with confidence != "high":
      Check whether project_context.tech_stack, .architectural_constraints, or .team_conventions
      already answer it.
      If answered by constitution: mark as RESOLVED_BY_CONSTITUTION; exclude from output questions.
  This step reduces unnecessary HITL interruption when the constitution covers the ambiguity.
  Output: pre_filtered_items[] (open questions and assumptions NOT resolved by constitution)

Step 2 — Score ambiguity impact
  For each requirement in requirements[]:
    Compute ambiguity_score (0.0–1.0):
      + 0.4 if statement contains vague terms: "fast", "efficient", "user-friendly", "scalable",
             "secure", "easy", "flexible", "modern", "robust", "simple", "seamless", "nice"
      + 0.3 if statement lacks a quantifier (no number, percentage, duration, or unit)
      + 0.2 if statement actor is undefined ("the user" without a defined user role)
      + 0.1 if this requirement was flagged in open_questions or assumptions
    Tag requirements with ambiguity_score > 0.4 as NEEDS_CLARIFICATION.
  For each assumption with confidence == "low" or "medium":
    Tag as NEEDS_CLARIFICATION with score = 0.6.
  Output: scored_items[]

Step 3 — Generate targeted questions
  Sort scored_items[] by ambiguity_score descending.
  Take the top N items (N = min(5, count of items with score ≥ 0.5)).
  For each selected item:
    Generate one targeted, specific question.
    Questions MUST be:
      - Answerable with a single sentence or a specific value
      - Phrased as a closed question (yes/no) or quantitative request ("What is the target P95 latency?")
      - Directly tied to the requirement or assumption ID
      - NOT open-ended ("What else should we know?")
    Format: { "q_id": "CLQ-001", "req_id": "REQ-XXX-NNN", "question": "...", "impact": "high|medium" }
  Output: questions[]

Step 4 — Fast-path check
  If questions[] is empty (all ambiguities resolved by constitution or no ambiguities detected):
    Set clarifications_needed = false.
    Proceed to Step 7 (assemble output) without HITL interruption.
    Log: "Clarify: no ambiguities found — advancing automatically."
  Else:
    Set clarifications_needed = true.
    Proceed to Step 5.
  Output: clarifications_needed (bool)

Step 5 — Present HITL gate (only if clarifications_needed = true)
  If skip_clarify = true:
    Mark all questions as SKIPPED_IN_CI.
    Set answers = [] for each question.
    Log WARN: clarify_gate_skipped_in_ci.
    Proceed to Step 6 without waiting.
  Else:
    Present to user:
      "──────────────────────────────────────────────────────────
       CLARIFICATION REQUIRED before architecture can begin.
       Found <N> ambiguous requirement(s). Please answer each question.
       ──────────────────────────────────────────────────────────
       <for each question:>
       [CLQ-NNN] (re: <req_id>) — Impact: <impact>
       <question text>
       ──────────────────────────────────────────────────────────"
    Wait for user response (HITL gate — pipeline is suspended).
    On response: parse answer for each CLQ-NNN question.
    If no response within 3600s: mark all unanswered questions as TIMED_OUT.
      Log WARN: clarify_gate_timed_out.
    Output: answers[]

Step 6 — Merge answers into requirements
  For each answered question with status != SKIPPED_IN_CI and != TIMED_OUT:
    Find the linked requirement (req_id).
    Append the answer as an explicit constraint to the requirement's statement.
    Example: "The system SHALL respond within 200ms (P95) for the search endpoint."
    Log the merge: { q_id, req_id, answer_applied: true }
  For unanswered/skipped questions:
    Leave requirements unchanged. Flag as UNRESOLVED in output.
  Output: updated_requirements[], unresolved_items[]

Step 7 — Write clarification artifact
  If clarifications_needed = true AND skip_clarify = false:
    Write artifacts/clarifications-<timestamp>.md:
      # Clarification Session — <run_id>
      **Timestamp:** <ISO8601>
      **Questions asked:** <N>
      **Questions answered:** <M>
      **Questions skipped/timed out:** <K>

      | Q ID | Req ID | Question | Answer | Status |
      |------|--------|----------|--------|--------|
      | CLQ-001 | REQ-XXX-001 | <question> | <answer> | answered|skipped|timed_out |
  Output: artifact_path (or null if clarifications_needed = false)

Step 8 — Assemble output
  Return output object (see Outputs section).
  Emit INFO: clarify_complete { questions_asked: N, answered: M, skipped: K }.
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `clarifications_needed` | `boolean` | `true` if HITL gate was triggered; `false` if auto-advanced |
| `updated_requirements` | `array[object]` | Requirements with answers merged in (same schema as input) |
| `unresolved_items` | `array[object]` | Questions that were skipped or timed out |
| `questions` | `array[object]` | All questions generated (with q_id, req_id, question, answer, status) |
| `artifact_path` | `string` \| `null` | Path to clarifications artifact, or `null` if none written |
| `metrics` | `object` | `tokens_in`, `tokens_out`, `duration_ms`, `items_produced`, `version` |
| `feedback` | `array[object]` | Feedback entries for orchestrator (backpropagate if requirements changed significantly) |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "clarifications_needed": { "type": "boolean" },
    "updated_requirements": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id":        { "type": "string" },
          "type":      { "type": "string", "enum": ["F", "NF", "C"] },
          "statement": { "type": "string" },
          "priority":  { "type": "string", "enum": ["critical", "high", "medium", "low"] },
          "clarified": { "type": "boolean", "description": "true if an answer was merged into this requirement" }
        },
        "required": ["id", "type", "statement", "priority"]
      }
    },
    "unresolved_items": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "q_id":   { "type": "string" },
          "req_id": { "type": "string" },
          "reason": { "type": "string", "enum": ["skipped_in_ci", "timed_out", "no_answer_provided"] }
        },
        "required": ["q_id", "req_id", "reason"]
      }
    },
    "questions": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "q_id":     { "type": "string", "pattern": "^CLQ-\\d{3}$" },
          "req_id":   { "type": "string" },
          "question": { "type": "string" },
          "impact":   { "type": "string", "enum": ["high", "medium"] },
          "answer":   { "type": "string" },
          "status":   { "type": "string", "enum": ["answered", "skipped_in_ci", "timed_out", "resolved_by_constitution"] }
        },
        "required": ["q_id", "req_id", "question", "impact", "status"]
      }
    },
    "artifact_path":  { "type": "string" },
    "metrics":        { "$ref": "#/$defs/metrics" },
    "feedback":       { "type": "array", "items": { "$ref": "#/$defs/feedback_entry" } }
  },
  "required": ["clarifications_needed", "updated_requirements", "unresolved_items", "questions", "metrics", "feedback"],
  "$defs": {
    "metrics": {
      "type": "object",
      "properties": {
        "tokens_in":      { "type": "integer" },
        "tokens_out":     { "type": "integer" },
        "duration_ms":    { "type": "integer" },
        "items_produced": { "type": "integer" },
        "version":        { "type": "string" }
      },
      "required": ["tokens_in", "tokens_out", "duration_ms", "items_produced", "version"]
    },
    "feedback_entry": {
      "type": "object",
      "properties": {
        "type":        { "type": "string", "enum": ["backpropagate", "info", "warning"] },
        "from_skill":  { "type": "string" },
        "target_skill":{ "type": "string" },
        "reason":      { "type": "string" },
        "evidence":    { "type": "object" }
      },
      "required": ["type", "from_skill", "reason"]
    }
  }
}
```

## Rules & Constraints

- Maximum 5 questions per invocation. If more than 5 ambiguities are detected, select the 5 with the
  highest `ambiguity_score`. Do NOT present more than 5 questions — user fatigue is worse than proceeding
  with some ambiguity.
- Questions MUST be phrased as specific, closed, or quantitative questions. NO open-ended questions.
- `skip_clarify: true` MUST be documented in the pipeline run log when used. It MUST NOT be the default
  for interactive runs.
- Do NOT re-analyze or modify requirements beyond merging the user's answers. The clarify skill is not
  a second pass of requirement-analyzer.
- If `clarifications_needed = false` (fast-path), the pipeline advances automatically without any user
  prompt. This is the desired behavior — do not add unnecessary confirmations.
- The skill MUST emit `feedback` with `type: "backpropagate"` targeting `requirement-analyzer` if > 3
  requirements had answers merged, indicating that a full re-analysis pass may be warranted.

## Security Considerations

- Do NOT include personally identifiable information (PII) in question text. Questions are about
  system behavior, not user data.
- The clarification artifact written to `artifacts/` contains requirement text — treat it with the same
  sensitivity as requirements documents.

## Token Optimization

- Project input: only `requirements[]`, `open_questions[]`, and `assumptions[]` are needed — strip
  `metadata` and `metrics` fields from the requirement-analyzer output before passing to this skill.
- Limit `requirements[]` to the first 50 items if > 50; the skill operates on the highest-priority
  requirements only.

## Quality Checklist

- [ ] All questions have a unique `CLQ-NNN` ID
- [ ] Each question is directly linked to a `req_id` or assumption
- [ ] No question is open-ended or speculative
- [ ] `updated_requirements` are valid against the requirement schema
- [ ] `clarifications_needed = false` only when questions[] is empty
- [ ] Artifact written to `artifacts/` when HITL gate was triggered

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| All requirements have `ambiguity_score < 0.5` | Fast-path: `clarifications_needed = false`; advance automatically |
| All ambiguities resolved by constitution | Fast-path: `clarifications_needed = false`; advance automatically |
| HITL gate times out (> 3600s) | Mark unanswered questions as `timed_out`; proceed with partially updated requirements; emit `WARN: clarify_gate_timed_out` |
| `skip_clarify: true` | Skip gate; mark all questions as `skipped_in_ci`; emit `WARN: clarify_gate_skipped_in_ci` |
| `requirements[]` is empty | Return error: `{"error": "EMPTY_REQUIREMENTS", "message": "No requirements to analyze"}` |

## 12. Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Behavior |
|------|---------|---------|----------|
| Clarification required | `clarifications_needed = true` AND `skip_clarify = false` | 3600s | Pause pipeline; present questions; resume when all answered or timeout |

- If user provides answers: merge into requirements; advance to architecture-design.
- If timeout: proceed with partial answers; emit warning; architecture-design receives partially
  clarified requirements.
- If `skip_clarify = true`: skip gate entirely; architecture-design receives original requirements.

## 13. Skill Composition

`clarify` is a sequential primitive skill in the requirements phase. It sits between
`requirement-analyzer` and `architecture-design` in the full pipeline:

```yaml
composes:
  - skill: requirement-analyzer
    version: "^1.2.0"
    output_map: { "requirements": "requirements", "open_questions": "open_questions", "assumptions": "assumptions" }
  - skill: clarify
    version: "^1.0.0"
    input_map: { "requirements": "requirements", "open_questions": "open_questions", "assumptions": "assumptions" }
    output_map: { "updated_requirements": "requirements" }
  - skill: architecture-design
    version: "^1.1.0"
    input_map: { "requirements": "updated_requirements" }
```

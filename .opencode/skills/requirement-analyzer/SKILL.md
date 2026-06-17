---
name: requirement-analyzer
version: 1.1.0
domain: requirements
description: Use when given raw requirements, a feature request, or a user story that needs to be analyzed, clarified, and structured. Triggers on: "analyze requirements", "extract requirements", "what are the requirements", "clarify this requirement", "requirement analysis", "turn this into requirements".
author: system
---

## Purpose

Transform unstructured or semi-structured requirement input into a normalized, unambiguous requirements document. The skill flags missing information, surfaces hidden assumptions, and generates targeted clarification questions. It is the entry point for every feature or system change request.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `raw_input` | `string` | Yes | Unprocessed requirement description (text, bullet list, or ticket reference) |
| `context` | `string` | No | Prior system context or related requirements |
| `domain_hints` | `array[string]` | No | Known domain keywords to improve classification |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "raw_input": { "type": "string", "minLength": 1 },
    "context": { "type": "string" },
    "domain_hints": { "type": "array", "items": { "type": "string" } }
  },
  "required": ["raw_input"]
}
```

## Required Context

- Must have system glossary if `domain_hints` is absent and domain vocabulary is used.
- Prior requirement-analyzer output if this is a refinement pass.

## Execution Logic

```
Step 1 — Parse and tokenize raw input
  Split into candidate requirement statements. Remove noise (greetings, sign-offs, metadata).
  Output: list of raw statements

Step 2 — Normalize each statement
  Assign a canonical form: "The system SHALL <action> [<constraint>]."
  De-duplicate and merge overlapping statements.
  Output: normalized requirement list

Step 3 — Classify each requirement
  Tag as functional (F), non-functional (NF), or constraint (C).
  Output: classified requirement list

Step 4 — Detect ambiguity
  Scan for vague terms ("fast", "responsive", "user-friendly", "etc.", "etc.").
  Flag missing quantifiers, undefined actors, and implicit conditions.
  Output: ambiguity list + open questions

Step 5 — Identify assumptions
  Extract every unstated precondition or belief.
  Output: assumptions list with confidence rating (high/medium/low)

Step 6 — Generate clarification questions
  For each ambiguity and low-confidence assumption, produce one targeted question.
  Output: clarification questions list

Step 7 — Assemble structured document
  Combine all artifacts into the standard output schema.
  Output: structured requirements document
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `requirements` | `array[object]` | Normalized requirements (id, type, statement, priority) |
| `open_questions` | `array[string]` | Clarification questions for the stakeholder |
| `assumptions` | `array[object]` | Assumptions detected (statement, confidence) |
| `risks` | `array[object]` | Risks identified (description, severity, impact) |
| `metadata` | `object` | Input summary, token count, version |
| `metrics` | `object` | Execution metrics (tokens_in, tokens_out, duration_ms, items_produced, version) |
| `feedback` | `array[object]` | Feedback loop entries for cross-skill communication |

**Output Schema:**

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
          "id": { "type": "string", "pattern": "^REQ-[A-Z]{3}-\\d{3}$" },
          "type": { "type": "string", "enum": ["F", "NF", "C"] },
          "statement": { "type": "string" },
          "priority": { "type": "string", "enum": ["critical", "high", "medium", "low"] }
        },
        "required": ["id", "type", "statement", "priority"]
      }
    },
    "open_questions": { "type": "array", "items": { "type": "string" } },
    "assumptions": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "statement": { "type": "string" },
          "confidence": { "type": "string", "enum": ["high", "medium", "low"] }
        },
        "required": ["statement", "confidence"]
      }
    },
    "risks": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "description": { "type": "string" },
          "severity": { "type": "string", "enum": ["critical", "high", "medium", "low"] },
          "impact": { "type": "string" }
        },
        "required": ["description", "severity", "impact"]
      }
    },
    "metadata": {
      "type": "object",
      "properties": {
        "input_token_count": { "type": "integer" },
        "requirement_count": { "type": "integer" },
        "version": { "type": "string" }
      }
    },
    "metrics": { "$ref": "#/$defs/metrics" },
    "feedback": { "type": "array", "items": { "$ref": "#/$defs/feedback_entry" } }
  },
  "required": ["requirements", "open_questions", "assumptions", "risks", "metadata", "metrics", "feedback"],
  "$defs": {
    "metrics": {
      "type": "object",
      "properties": {
        "tokens_in": { "type": "integer" },
        "tokens_out": { "type": "integer" },
        "duration_ms": { "type": "integer" },
        "items_produced": { "type": "integer" },
        "version": { "type": "string" }
      },
      "required": ["tokens_in", "tokens_out", "duration_ms", "items_produced", "version"]
    },
    "feedback_entry": {
      "type": "object",
      "properties": {
        "type": { "type": "string", "enum": ["backpropagate", "info", "warning"] },
        "from_skill": { "type": "string" },
        "target_skill": { "type": "string" },
        "reason": { "type": "string" },
        "evidence": { "type": "object" }
      },
      "required": ["type", "from_skill", "reason"]
    }
  }
}
```

## Rules & Constraints

- Every requirement MUST begin with "The system SHALL" (functional) or "The system SHALL BE" (non-functional).
- Maximum 100 requirements per invocation. Beyond that, split input into batches.
- `open_questions` MUST be phrased as closed (yes/no) or specific questions. No open-ended "What else?" questions.
- Do NOT assign priority before stakeholder validation unless `context` contains agreed priority metadata.

## Security Considerations

- Strip personally identifiable information (PII) from `raw_input` before processing. No PII in output.
- Do not store or log raw input. Only store the structured output.

## Token Optimization

- Compress `context` to the last 10 relevant requirements if it exceeds 2000 tokens.
- Use single-letter or short-key identifiers for requirement IDs.
- Prune `raw_input` by removing duplicate lines before processing.

## Quality Checklist

- [ ] Every requirement has a unique `REQ-{DOM}-{NNN}` ID
- [ ] No "TBD", "etc.", "soon", or other ambiguity markers in `statement`
- [ ] All `assumptions` have a confidence rating
- [ ] `open_questions` are specific and answerable
- [ ] Output JSON is valid against schema
- [ ] Token count reported in metadata

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| Empty `raw_input` | Return error: `{"error": "EMPTY_INPUT", "message": "raw_input must be non-empty"}` |
| Too many statements (>100) | Process first 100, emit `"truncated": true` in metadata |
| Domain detection fails | Assign generic `GEN` domain prefix, flag in metadata |
| Output exceeds 8K tokens | Chunk into paginated results with `page` and `total_pages` fields |

## 12. Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Behavior |
|------|---------|---------|----------|
| Clarification required | `open_questions` count > 5 OR any assumption has `confidence: low` | 3600s | Pause, present open_questions to stakeholder, resume when answered |

- If stakeholder provides answers, re-run Steps 6–7 with updated input.
- If no response within timeout: continue with existing open_questions, flag `"gate_skipped": true`.

## 13. Skill Composition

`requirement-analyzer` is a primitive skill and is not composed of other skills. It may be included in meta-skill compositions:

```yaml
# Example: full-analysis meta-skill
composes:
  - skill: requirement-analyzer
    version: "^1.1.0"
    input_map: { "raw_input": "user_request" }
    output_map: { "requirements": "normalized_requirements" }
```

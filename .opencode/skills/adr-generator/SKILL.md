---
name: adr-generator
version: 1.0.0
domain: documentation
description: Use when creating Architecture Decision Records from architectural choices, tech stack selections, or design tradeoffs. Triggers on: "write an ADR", "document this decision", "create an architecture decision record", "record this tradeoff", "why did we choose this".
author: system
---

## Purpose

Produce well-structured, immutable Architecture Decision Records (ADRs) that capture the context, decision, alternatives considered, consequences, and tradeoffs for every significant architectural or technical choice. ADRs are the system's institutional memory — they explain *why* the system is the way it is, not just what it is. `adr-generator` is invoked automatically whenever `architecture-design` produces a major decision, and on demand for any significant technical choice.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `decision_title` | `string` | Yes | Short title for the ADR (e.g. "Use PostgreSQL as primary data store") |
| `decision_context` | `string` | Yes | What problem or constraint forced this decision |
| `decision_made` | `string` | Yes | The actual decision in one or two sentences |
| `alternatives` | `array[object]` | Yes | At least 2 alternatives considered (including the chosen one) |
| `consequences` | `object` | Yes | Positive and negative consequences of the decision |
| `decision_date` | `string` | No | ISO date string (defaults to today) |
| `status` | `string` | No | `proposed`, `accepted`, `deprecated`, `superseded` (default: `accepted`) |
| `supersedes` | `string` | No | ADR ID this record supersedes (if any) |
| `related_skills` | `array[string]` | No | Skill IDs that produced or are affected by this decision |
| `output_path` | `string` | No | Where to write the ADR (default: `docs/adr/`) |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "decision_title": { "type": "string", "minLength": 5 },
    "decision_context": { "type": "string", "minLength": 20 },
    "decision_made": { "type": "string", "minLength": 10 },
    "alternatives": {
      "type": "array",
      "minItems": 2,
      "items": {
        "type": "object",
        "properties": {
          "name": { "type": "string" },
          "description": { "type": "string" },
          "pros": { "type": "array", "items": { "type": "string" } },
          "cons": { "type": "array", "items": { "type": "string" } },
          "chosen": { "type": "boolean" }
        },
        "required": ["name", "description", "pros", "cons", "chosen"]
      }
    },
    "consequences": {
      "type": "object",
      "properties": {
        "positive": { "type": "array", "items": { "type": "string" } },
        "negative": { "type": "array", "items": { "type": "string" } },
        "neutral": { "type": "array", "items": { "type": "string" } }
      },
      "required": ["positive", "negative"]
    },
    "decision_date": { "type": "string", "format": "date" },
    "status": { "type": "string", "enum": ["proposed", "accepted", "deprecated", "superseded"] },
    "supersedes": { "type": "string" },
    "related_skills": { "type": "array", "items": { "type": "string" } },
    "output_path": { "type": "string" }
  },
  "required": ["decision_title", "decision_context", "decision_made", "alternatives", "consequences"]
}
```

## Required Context

- ADR index from system state (`state-manager` read of `adr_index` scope) — used to assign the next ADR number.
- If `supersedes` is set: load the referenced ADR to mark it as superseded.

## Execution Logic

```
Step 1 — Validate inputs
  Require at least 2 alternatives, exactly 1 with chosen=true.
  Require at least 1 positive and 1 negative consequence.
  decision_context must be >= 20 characters.
  Output: validated_inputs

Step 2 — Assign ADR number
  Load adr_index from state. If absent: initialize at ADR-0001.
  Next ADR number = max(existing) + 1, zero-padded to 4 digits.
  Output: adr_id (e.g. "ADR-0042")

Step 3 — Build ADR document
  Generate Markdown using the MADR (Markdown Architectural Decision Records) format:
    # {adr_id}: {decision_title}
    Date: {decision_date}
    Status: {status}
    Supersedes: {supersedes or "N/A"}

    ## Context
    {decision_context}

    ## Decision
    {decision_made}

    ## Alternatives Considered
    For each alternative: name, description, pros (bulleted), cons (bulleted).
    Mark chosen alternative clearly.

    ## Consequences
    ### Positive
    {positive consequences}
    ### Negative
    {negative consequences}
    ### Neutral
    {neutral consequences if any}

    ## Related Skills
    {related_skills or "N/A"}
  Output: adr_document (Markdown string)

Step 4 — Determine output path
  Default: docs/adr/{adr_id}-{slugified_title}.md
  If output_path provided: use {output_path}/{adr_id}-{slugified_title}.md
  Output: file_path

Step 5 — Handle supersession
  If supersedes is set: update the referenced ADR's Status line to "Superseded by {adr_id}".
  Write updated superseded ADR to state.
  Output: superseded_adr_update

Step 6 — Write ADR and update index
  Write adr_document to file_path via state-manager.
  Update adr_index: append { id: adr_id, title, status, path: file_path, date }.
  Emit event: "file.written" with payload { path: file_path, type: "adr" }.
  Output: written_adr

Step 7 — Assemble output
  Return adr_id, file_path, adr_document preview (first 500 chars), metrics, feedback.
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `adr_id` | `string` | Assigned ADR identifier (e.g. `ADR-0042`) |
| `file_path` | `string` | Path where the ADR was written |
| `adr_preview` | `string` | First 500 characters of the generated ADR |
| `superseded_adr` | `string` | ID of the ADR marked as superseded (if any) |
| `metrics` | `object` | Execution metrics |
| `feedback` | `array[object]` | Feedback entries |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "adr_id": { "type": "string", "pattern": "^ADR-[0-9]{4}$" },
    "file_path": { "type": "string" },
    "adr_preview": { "type": "string" },
    "superseded_adr": { "type": "string" },
    "metrics": { "$ref": "#/$defs/metrics" },
    "feedback": { "type": "array", "items": { "$ref": "#/$defs/feedback_entry" } }
  },
  "required": ["adr_id", "file_path", "adr_preview", "metrics", "feedback"],
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

- ADRs are immutable after status=`accepted`. Only status transitions are permitted (accepted→deprecated, accepted→superseded).
- Exactly one alternative must have `chosen: true`.
- ADR IDs are monotonically increasing — gaps are not allowed.
- ADRs MUST NOT contain credentials, PII, internal IP addresses, or environment-specific values.
- `adr_index` is the only authoritative source for ADR numbering — never infer IDs from file names.

## Security Considerations

- Scan `decision_context` and `decision_made` for credential patterns before writing. Reject if found.
- ADR content is write-once — modifications to existing ADRs require a new superseding ADR, not in-place editing.

## Token Optimization

- Pass only the `alternatives` array (compact format) — omit extended descriptions for non-chosen alternatives in state storage.
- `adr_preview` in output is capped at 500 characters — full document is in state only.
- Do not load the full ADR index content — only load `{ id, status }` tuples for numbering.

## Quality Checklist

- [ ] At least 2 alternatives present, exactly 1 chosen
- [ ] At least 1 positive and 1 negative consequence
- [ ] ADR ID assigned sequentially from adr_index
- [ ] file_path follows the {adr_id}-{slug}.md convention
- [ ] Superseded ADR updated if supersedes is set

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| Zero or one alternatives | Reject: `{"error": "INSUFFICIENT_ALTERNATIVES", "minimum": 2}` |
| No chosen alternative | Reject: `{"error": "NO_CHOSEN_ALTERNATIVE"}` |
| adr_index corrupt | Re-initialize from existing files in docs/adr/, emit warning |
| supersedes references non-existent ADR | Emit warning, continue without updating superseded ADR |

## 12. Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Behavior |
|------|---------|---------|----------|
| Breaking architectural decision | `alternatives` contain security-boundary or data-model changes | 3600s | Pause, present ADR draft for human review before writing |

## 13. Skill Composition

`adr-generator` is invoked by `architecture-design` after every major decision:

```yaml
composes:
  - skill: adr-generator
    version: "^1.0.0"
    input_map:
      decision_title: "decision.title"
      decision_context: "decision.context"
      decision_made: "decision.chosen"
      alternatives: "decision.alternatives"
      consequences: "decision.consequences"
    output_map:
      adr_id: "state.adr_index[-1].id"
```

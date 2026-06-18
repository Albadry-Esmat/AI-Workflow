---
name: context-compressor
version: 1.0.0
domain: system
description: 'Use when compressing large code, history, or artifact context into semantic summaries to fit within token budgets. Triggers on: "compress context", "summarize code", "reduce token usage", "context too large", "token budget exceeded", "compress artifacts".'
author: system
---

## Purpose

Reduce the token footprint of large context payloads — code files, execution histories, skill outputs, or system state slices — by replacing them with semantically faithful summaries. The compressor preserves the information required for downstream reasoning while discarding verbatim redundancy. It is the primary mechanism by which the ASE-OS maintains operation within hard token budgets across long-running pipelines.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `content` | `string` | Yes | Raw content to compress (code, markdown, JSON, plain text) |
| `content_type` | `string` | Yes | `code`, `skill_output`, `state_slice`, `execution_log`, `documentation`, or `plain_text` |
| `max_tokens` | `integer` | Yes | Target token ceiling for the compressed output |
| `preserve_keys` | `array[string]` | No | Field names or code identifiers that must be present verbatim in output |
| `compression_goal` | `string` | No | `lossy_summary` (default), `lossless_index`, or `diff_only` |
| `downstream_skill` | `string` | No | Name of the skill that will consume the compressed output — used to tune what to preserve |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "content": { "type": "string", "minLength": 1 },
    "content_type": { "type": "string", "enum": ["code", "skill_output", "state_slice", "execution_log", "documentation", "plain_text"] },
    "max_tokens": { "type": "integer", "minimum": 100, "maximum": 32000 },
    "preserve_keys": { "type": "array", "items": { "type": "string" } },
    "compression_goal": { "type": "string", "enum": ["lossy_summary", "lossless_index", "diff_only"], "default": "lossy_summary" },
    "downstream_skill": { "type": "string" }
  },
  "required": ["content", "content_type", "max_tokens"]
}
```

## Required Context

- No prior skill output required.
- If `downstream_skill` is provided, the skill registry is consulted to understand what fields the consuming skill requires.

## Execution Logic

```
Step 1 — Measure input
  Count tokens in content. If content is already within max_tokens: return as-is with compression_ratio=1.0.
  Output: token_count, compression_needed

Step 2 — Select compression strategy
  code:           Extract public interfaces, function signatures, class definitions, and inline doc comments.
                  Discard function bodies unless listed in preserve_keys.
  skill_output:   Retain all required schema fields. Summarize array items to count + representative sample.
  state_slice:    Retain non-null fields. Compress arrays to IDs only.
  execution_log:  Summarize completed steps to status codes only. Retain last 3 steps verbatim.
  documentation:  Extract headings, first sentence of each section, and code example signatures.
  plain_text:     Extract key sentences using importance scoring (topic sentence, quantities, proper nouns).
  Output: compression_strategy

Step 3 — Apply compression
  Execute strategy from Step 2.
  Ensure preserve_keys items appear verbatim regardless of strategy.
  If downstream_skill is set: verify compressed output contains all required inputs of that skill.
  Output: compressed_content

Step 4 — Validate compression
  Count tokens in compressed_content. If still > max_tokens: apply secondary aggressive compression (summaries only).
  Verify preserve_keys are all present.
  Compute compression_ratio = (input_tokens - output_tokens) / input_tokens.
  Output: validated_compressed_content, compression_ratio

Step 5 — Assemble output
  Return compressed_content, compression_ratio, omitted_keys, preserved_keys.
  Output: final result
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `compressed_content` | `string` | Semantically compressed version of the input |
| `compression_ratio` | `number` | Fraction of tokens removed (0.0 = no compression, 0.9 = 90% reduced) |
| `omitted_keys` | `array[string]` | Identifiers or fields not present in the compressed output |
| `preserved_keys` | `array[string]` | Identifiers confirmed present verbatim |
| `metrics` | `object` | Execution metrics |
| `feedback` | `array[object]` | Feedback entries |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "compressed_content": { "type": "string" },
    "compression_ratio": { "type": "number", "minimum": 0.0, "maximum": 1.0 },
    "omitted_keys": { "type": "array", "items": { "type": "string" } },
    "preserved_keys": { "type": "array", "items": { "type": "string" } },
    "metrics": { "$ref": "#/$defs/metrics" },
    "feedback": { "type": "array", "items": { "$ref": "#/$defs/feedback_entry" } }
  },
  "required": ["compressed_content", "compression_ratio", "omitted_keys", "preserved_keys", "metrics", "feedback"],
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

- Compression MUST NOT alter the semantic meaning of preserved_keys fields.
- If `compression_goal` is `lossless_index`, the output must be reconstructible to the original given the index — emit a key-value index rather than prose.
- If output still exceeds `max_tokens` after two passes, return the best achievable result with a `warning` feedback entry.
- Do NOT compress security-sensitive fields (passwords, tokens, keys) — reject if content contains them.
- Minimum meaningful compression: `compression_ratio` must be ≥ 0.1. If input is already compact, return as-is.

## Security Considerations

- Scan content for credential patterns (API keys, tokens, passwords) before processing. If found, reject and emit `{"error": "SENSITIVE_CONTENT_DETECTED"}`.
- Compressed output must not accidentally reassemble sensitive data omitted by compression.

## Token Optimization

- This skill is itself a token optimization tool — it must be invoked at the lowest cost possible.
- Input is read linearly; no re-processing of already-compressed sections.
- Compression logic is applied in a single pass where possible.
- Metrics always use minified JSON.

## Quality Checklist

- [ ] content_type is a valid enum value
- [ ] max_tokens is a positive integer ≤ 32000
- [ ] All preserve_keys appear in compressed output
- [ ] compression_ratio is computed and present
- [ ] No credential patterns in content

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| Content already within max_tokens | Return as-is, compression_ratio=0.0 |
| Credential pattern detected | Reject: `{"error": "SENSITIVE_CONTENT_DETECTED"}` |
| Cannot compress below max_tokens | Return best result + warning feedback entry |
| preserve_keys contain identifier not in content | Warn in feedback, continue |
| content is empty | Reject: `{"error": "EMPTY_CONTENT"}` |

## 12. Human-in-the-Loop Gates

No HITL gates — this is a fully automated utility skill. If compression produces `compression_ratio < 0.05`, emit a `warning` feedback to the calling skill.

## 13. Skill Composition

`context-compressor` is composed into any skill that must respect token budgets:

```yaml
composes:
  - skill: context-compressor
    version: "^1.0.0"
    input_map:
      content: "raw_code_context"
      content_type: "code"
      max_tokens: 8000
    output_map:
      compressed_content: "scoped_context"
```

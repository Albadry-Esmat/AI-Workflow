---
name: context-compressor
version: 2.0.0
domain: system
description: 'Use when compressing large code, history, or artifact context into semantic summaries to fit within token budgets. Triggers on: "compress context", "summarize code", "reduce token usage", "context too large", "token budget exceeded", "compress artifacts".'
author: system
---

## Purpose

Reduce the token footprint of large context payloads — code files, execution histories, skill outputs, pipeline state objects, or session message histories — by replacing them with semantically faithful summaries. The compressor preserves the information required for downstream reasoning while discarding verbatim redundancy.

v2.0.0 adds three major capabilities on top of v1.0.0:
- **Cascade compression** — three escalating compression levels (light → medium → aggressive) fired automatically until the payload fits the target ceiling
- **`auto_compress` mode** — the skill can be triggered automatically by the orchestrator when context pressure is detected, without explicit invocation
- **Two new content types** — `pipeline_state` and `session_history` — with dedicated compression strategies

It is the primary mechanism by which ASE-OS maintains operation within hard token budgets across long-running pipelines.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `content` | `string` | Yes | Raw content to compress (code, markdown, JSON, plain text) |
| `content_type` | `string` | Yes | `code`, `skill_output`, `state_slice`, `execution_log`, `documentation`, `plain_text`, `pipeline_state`, or `session_history` |
| `max_tokens` | `integer` | Yes | Target token ceiling for the compressed output |
| `preserve_keys` | `array[string]` | No | Field names or code identifiers that must be present verbatim in output |
| `compression_goal` | `string` | No | `lossy_summary` (default), `lossless_index`, or `diff_only` |
| `downstream_skill` | `string` | No | Name of the skill that will consume the compressed output — used to tune what to preserve |
| `auto_compress` | `boolean` | No | If `true`, skip invocation guard — the orchestrator can call this skill automatically when context pressure exceeds the active budget tier |
| `cascade_mode` | `string` | No | `single_pass` (default) or `cascade` — `cascade` fires up to three levels (light → medium → aggressive) until `max_tokens` is met |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "content":          { "type": "string", "minLength": 1 },
    "content_type":     { "type": "string", "enum": ["code", "skill_output", "state_slice", "execution_log", "documentation", "plain_text", "pipeline_state", "session_history"] },
    "max_tokens":       { "type": "integer", "minimum": 100, "maximum": 32000 },
    "preserve_keys":    { "type": "array", "items": { "type": "string" } },
    "compression_goal": { "type": "string", "enum": ["lossy_summary", "lossless_index", "diff_only"], "default": "lossy_summary" },
    "downstream_skill": { "type": "string" },
    "auto_compress":    { "type": "boolean", "default": false },
    "cascade_mode":     { "type": "string", "enum": ["single_pass", "cascade"], "default": "single_pass" }
  },
  "required": ["content", "content_type", "max_tokens"]
}
```

## Required Context

- No prior skill output required.
- If `downstream_skill` is provided, the skill registry is consulted to understand what fields the consuming skill requires.
- If `auto_compress: true`, the orchestrator must pass a `budget_tier` annotation in the pipeline context so the compressor can calibrate the target ceiling.

## Execution Logic

```
Step 1 — Measure input
  Count tokens in content. If content is already within max_tokens: return as-is with compression_ratio=0.0.
  Determine cascade schedule: if cascade_mode=cascade, prepare [light, medium, aggressive]; else [primary].
  Output: token_count, compression_needed, cascade_schedule

Step 2 — Select compression strategy per content_type
  code:            Extract public interfaces, function signatures, class definitions, and inline doc comments.
                   Discard function bodies unless listed in preserve_keys.
  skill_output:    Retain all required schema fields. Summarize array items to count + representative sample.
  state_slice:     Retain non-null fields. Compress arrays to IDs only.
  execution_log:   Summarize completed steps to status codes only. Retain last 3 steps verbatim.
  documentation:   Extract headings, first sentence of each section, and code example signatures.
  plain_text:      Extract key sentences using importance scoring (topic sentence, quantities, proper nouns).
  pipeline_state:  Retain: current_phase, active_skill, pending_gates, error_count, last_artifact_ref.
                   Drop: full artifact payloads, historical step logs, intermediate schema snapshots.
  session_history: Retain: last 5 user turns verbatim + concise assistant summary per prior turn.
                   Drop: tool call traces, intermediate streaming tokens, duplicate system messages.
  Output: compression_strategy

Step 3 — Apply compression (per cascade level)
  LIGHT   — Apply strategy from Step 2. Keep 60–80 % of content.
  MEDIUM  — Apply strategy + remove examples, inline comments, and non-critical metadata. Target 35–60 %.
  AGGRESSIVE — Summaries only: bullet-point key facts, IDs, and error codes. Target < 35 %.

  For each cascade level (or single pass if cascade_mode=single_pass):
    a) Execute strategy at current level.
    b) Ensure preserve_keys items appear verbatim regardless of level.
    c) If downstream_skill is set: verify compressed output contains all required inputs of that skill.
    d) Count tokens in result.
    e) If within max_tokens: stop cascade, record cascade_level_used.
  Output: compressed_content, cascade_level_used

Step 4 — Validate compression
  Count tokens in compressed_content. If still > max_tokens after all cascade levels: record warning.
  Verify preserve_keys are all present.
  Compute compression_ratio = (input_tokens - output_tokens) / input_tokens.
  Compute token_efficiency_score = round(compression_ratio * information_retention_estimate * 100).
    information_retention_estimate:
      LIGHT=0.90, MEDIUM=0.70, AGGRESSIVE=0.50, single_pass best-effort=0.80.
  Output: validated_compressed_content, compression_ratio, token_efficiency_score

Step 5 — Assemble output
  Return compressed_content, compression_ratio, token_efficiency_score, cascade_level_used,
         omitted_keys, preserved_keys, metrics, feedback.
  Output: final result
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `compressed_content` | `string` | Semantically compressed version of the input |
| `compression_ratio` | `number` | Fraction of tokens removed (0.0 = no compression, 0.9 = 90% reduced) |
| `token_efficiency_score` | `number` | 0–100 composite quality score (compression depth × estimated information retention) |
| `cascade_level_used` | `string` | `"none"` \| `"light"` \| `"medium"` \| `"aggressive"` — level at which the budget target was met |
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
    "compressed_content":    { "type": "string" },
    "compression_ratio":     { "type": "number", "minimum": 0.0, "maximum": 1.0 },
    "token_efficiency_score":{ "type": "number", "minimum": 0, "maximum": 100 },
    "cascade_level_used":    { "type": "string", "enum": ["none", "light", "medium", "aggressive"] },
    "omitted_keys":          { "type": "array", "items": { "type": "string" } },
    "preserved_keys":        { "type": "array", "items": { "type": "string" } },
    "metrics":               { "$ref": "#/$defs/metrics" },
    "feedback":              { "type": "array", "items": { "$ref": "#/$defs/feedback_entry" } }
  },
  "required": ["compressed_content", "compression_ratio", "token_efficiency_score", "cascade_level_used", "omitted_keys", "preserved_keys", "metrics", "feedback"],
  "$defs": {
    "metrics": {
      "type": "object",
      "properties": {
        "tokens_in":       { "type": "integer" },
        "tokens_out":      { "type": "integer" },
        "duration_ms":     { "type": "integer" },
        "items_produced":  { "type": "integer" },
        "version":         { "type": "string" }
      },
      "required": ["tokens_in", "tokens_out", "duration_ms", "items_produced", "version"]
    },
    "feedback_entry": {
      "type": "object",
      "properties": {
        "type":         { "type": "string", "enum": ["backpropagate", "info", "warning"] },
        "from_skill":   { "type": "string" },
        "target_skill": { "type": "string" },
        "reason":       { "type": "string" },
        "evidence":     { "type": "object" }
      },
      "required": ["type", "from_skill", "reason"]
    }
  }
}
```

## Rules & Constraints

- Compression MUST NOT alter the semantic meaning of `preserve_keys` fields.
- If `compression_goal` is `lossless_index`, the output must be reconstructible to the original given the index — emit a key-value index rather than prose.
- In `cascade` mode, escalate from light → medium → aggressive automatically. Do NOT skip a level.
- If output still exceeds `max_tokens` after all three cascade levels, return the best achievable result with a `warning` feedback entry.
- `auto_compress: true` requires `auto_compress` to be explicitly allowed by the active pipeline template's `token_policy` block; the compressor must reject auto-trigger calls from pipelines that do not declare it.
- Do NOT compress security-sensitive fields (passwords, tokens, keys) — reject if content contains them.
- Minimum meaningful compression: `compression_ratio` must be ≥ 0.1 when compression is required. If input is already within budget, return as-is with `compression_ratio=0.0`.

## Security Considerations

- Scan content for credential patterns (API keys, tokens, passwords) before processing. If found, reject and emit `{"error": "SENSITIVE_CONTENT_DETECTED"}`.
- Compressed output must not accidentally reassemble sensitive data omitted by compression.
- `auto_compress` mode must not be triggered by external input not originating from the trusted pipeline orchestrator.

## Token Optimization

- This skill is itself a token optimization tool — it must be invoked at the lowest cost possible.
- Input is read linearly; no re-processing of already-compressed sections.
- Cascade mode stops as soon as the target is met — it does not run all three levels unconditionally.
- Metrics always use minified JSON.

## Quality Checklist

- [ ] `content_type` is a valid enum value (including `pipeline_state` and `session_history`)
- [ ] `max_tokens` is a positive integer ≤ 32000
- [ ] All `preserve_keys` appear in compressed output
- [ ] `compression_ratio` is computed and present
- [ ] `token_efficiency_score` is 0–100 and matches the cascade level used
- [ ] `cascade_level_used` is one of `none` / `light` / `medium` / `aggressive`
- [ ] No credential patterns in content
- [ ] `auto_compress: true` only accepted from trusted orchestrator callers

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| Content already within `max_tokens` | Return as-is, `compression_ratio=0.0`, `cascade_level_used="none"` |
| Credential pattern detected | Reject: `{"error": "SENSITIVE_CONTENT_DETECTED"}` |
| Cannot compress below `max_tokens` after all cascade levels | Return best result + `warning` feedback entry |
| `preserve_keys` contains identifier not in content | Warn in feedback, continue |
| Content is empty | Reject: `{"error": "EMPTY_CONTENT"}` |
| `auto_compress: true` but pipeline has no `token_policy` block | Reject: `{"error": "AUTO_COMPRESS_NOT_PERMITTED"}` |

## 12. Human-in-the-Loop Gates

No HITL gates — this is a fully automated utility skill. If compression produces `compression_ratio < 0.05` when compression was required, emit a `warning` feedback to the calling skill. If `cascade_mode=cascade` reaches the `aggressive` level, emit an `info` feedback so the operator is aware that significant context was dropped.

## 13. Skill Composition

`context-compressor` is composed into any skill that must respect token budgets:

```yaml
composes:
  - skill: context-compressor
    version: "^2.0.0"
    input_map:
      content: "raw_code_context"
      content_type: "code"
      max_tokens: 8000
      cascade_mode: "cascade"
    output_map:
      compressed_content: "scoped_context"
      token_efficiency_score: "compression_quality"
```

Auto-compress integration in the orchestrator:

```yaml
token_policy:
  auto_compress: true
  budget_tiers:
    - name: "standard"
      ceiling: 16000
      cascade_mode: "single_pass"
    - name: "large"
      ceiling: 32000
      cascade_mode: "cascade"
  trigger_at_percent: 85
```

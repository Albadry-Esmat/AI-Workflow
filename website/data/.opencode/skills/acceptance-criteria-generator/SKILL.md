---
name: acceptance-criteria-generator
version: 1.0.0
domain: requirements
description: >
  Use when transforming structured requirements into formal BDD-style acceptance criteria with
  traceability, testability ratings, and negative scenarios. Triggers on: "generate acceptance
  criteria", "create Given When Then from requirements", "make requirements testable",
  "BDD criteria from user stories", "turn requirements into test cases". Do NOT use when
  writing test code — use test-generator instead.
author: system
---

## Purpose

`acceptance-criteria-generator` is the formal bridge between `requirement-analyzer` and the testing skills. It transforms each structured requirement into executable BDD acceptance criteria (Given / When / Then), assigns unique AC IDs for traceability, generates negative and boundary-condition scenarios, and rates the testability of each criterion. Every criterion carries a `requirement_id` link, making requirements-to-test traceability explicit throughout the pipeline. Untestable requirements are backpropagated to `requirement-analyzer` with a structured reason and improvement suggestion rather than silently forwarded, breaking the chain at the point of ambiguity.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `requirements` | `array` | Yes | Structured requirements from `requirement-analyzer`. Each item must have `id`, `description`, `type`, `priority` |
| `context` | `object` | No | Domain context: `domain` (string), `user_roles` (array), `system_boundaries` (array) |
| `format` | `string` | No | Output format: `"gherkin"` \| `"structured"` \| `"both"`. Default: `"gherkin"` |
| `include_negative_scenarios` | `boolean` | No | Generate negative/boundary scenarios per criterion. Default: `true` |
| `testability_check` | `boolean` | No | Rate testability and flag untestable requirements. Default: `true` |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "requirements": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "properties": {
          "id":          { "type": "string", "minLength": 1 },
          "description": { "type": "string", "minLength": 1 },
          "type":        { "type": "string" },
          "priority":    { "type": "string" }
        },
        "required": ["id", "description", "type", "priority"]
      }
    },
    "context": {
      "type": "object",
      "properties": {
        "domain":            { "type": "string" },
        "user_roles":        { "type": "array", "items": { "type": "string" } },
        "system_boundaries": { "type": "array", "items": { "type": "string" } }
      }
    },
    "format": {
      "type": "string",
      "enum": ["gherkin", "structured", "both"],
      "default": "gherkin"
    },
    "include_negative_scenarios": { "type": "boolean", "default": true },
    "testability_check":          { "type": "boolean", "default": true }
  },
  "required": ["requirements"]
}
```

## Required Context

- Structured requirements from `requirement-analyzer@^1.2.0` output (or equivalent structure with `id`, `description`, `type`, `priority`).
- `context.user_roles` improves actor extraction in Given/When/Then generation; defaults to `"the user"` if absent.
- No prior skill execution is strictly required, but the skill is most accurate when requirements are pre-validated by `requirement-analyzer`.

## Execution Logic

```
Step 1 — Validate requirements input
  For each requirement in requirements[]:
    Verify presence of: id, description, type, priority.
    Reject entire invocation with structured error if any requirement is missing required fields.
  Initialize sequential AC counter: next_ac_id = 1 (formats as "AC-001", "AC-002", etc.)
  Output: validated_requirements[]

Step 2 — Extract actors, actions, and outcomes
  For each requirement description:
    actor:   extract subject noun phrase;
             default to context.user_roles[0] if present, else "the user"
    action:  extract primary verb phrase (submit, call, navigate, request, configure, upload)
    outcome: extract result clause (data is saved, response is returned, error is displayed)
    Flag as potentially_untestable if:
      - outcome is absent or cannot be extracted
      - outcome contains: "fast", "user-friendly", "intuitive", "appropriate", "sometimes",
        "often", "should be good", "as needed", "adequately"
  Output: requirement_components { actor, action, outcome, potentially_untestable }[]

Step 3 — Generate Given/When/Then (primary scenario)
  For each requirement:
    given: construct initial state enabling the action using:
           - authentication state if actor requires it
           - entity existence state if action operates on an existing resource
           - preconditions from context.system_boundaries if applicable
    when:  "[actor] [action]" — specific, using requirement language directly
    then:  present-tense, observable assertion: "[outcome] is confirmed"
           use measurable nouns where available (IDs, counts, HTTP status codes, record states)
    assign ac_id = "AC-" + zero_padded_counter (e.g., AC-001)
    increment counter
  Output: primary_scenario[] with ac_id per entry

Step 4 — Generate negative scenarios  [when include_negative_scenarios = true]
  For each requirement, generate 1–3 negative scenarios:
    Category 1 — Invalid input:
      "When [actor] submits [field] as empty/null/malformed, then [validation error] is displayed"
    Category 2 — Boundary conditions:
      "When [actor] provides a value at/beyond the allowed [min/max], then [boundary behavior]"
    Category 3 — Unauthorized access:
      "When a user without [required_role/permission] attempts [action], then a [403/401] is returned"
  Omit categories that do not apply to the requirement type (e.g., no auth scenario for a
  purely data-computation requirement).
  Output: negative_scenarios[] per AC entry (1–3 items)

Step 5 — Rate testability  [when testability_check = true]
  For each primary_scenario:
    high:   all three criteria met:
            (1) outcome is deterministic and state-checkable
            (2) outcome contains measurable nouns (ID, count, HTTP code, persisted record)
            (3) can be automated without manual observation
    medium: outcome is deterministic but requires test fixtures, seeded data, or
            mocked external services to verify
    low:    any one of:
            (1) outcome uses subjective adjectives
            (2) outcome depends on elapsed real time
            (3) outcome requires visual or human inspection
            (4) requirement was flagged potentially_untestable in Step 2
  Output: testability_ratings { req_id, rating, reason }[]

Step 6 — Flag untestable requirements
  For each requirement rated "low" or flagged potentially_untestable:
    Determine root cause:
      ambiguous_outcome         — outcome cannot be stated as a pass/fail assertion
      missing_acceptance_data   — required test data or threshold values not specified
      subjective_criteria       — outcome depends on subjective human judgment
      non_verifiable_constraint — constraint is structural/non-functional with no measurable proxy
    Build untestable_requirements entry: { requirement_id, reason, suggestion }
    suggestion should offer one concrete improvement:
      "Specify a measurable threshold, e.g., 'response time < 200ms'"
  Calculate threshold flag:
    low_testability_count_exceeds_threshold = (untestable_count / total_requirements) > 0.25
  Emit feedback:
    IF untestable_requirements is non-empty:
      → { type: "backpropagate", from_skill: "acceptance-criteria-generator",
          target_skill: "requirement-analyzer", reason: "untestable_requirement_detected",
          evidence: { untestable_requirement_ids: [...] } }
    IF low_testability_count_exceeds_threshold:
      → { type: "backpropagate", from_skill: "acceptance-criteria-generator",
          target_skill: "requirement-analyzer", reason: "low_testability_count_exceeds_threshold",
          evidence: { untestable_count: N, total: M, percentage: P } }
  Output: untestable_requirements[]

Step 7 — Build coverage map and summary statistics
  Construct coverage_map: { req_id → [ac_id, ac_id, ...] } for all requirements
  including untestable ones (they map to an empty array []).
  Calculate:
    total_requirements  = requirements.length
    total_ac_generated  = acceptance_criteria.length
    untestable_count    = untestable_requirements.length
    coverage_percentage = ((total_requirements - untestable_count) / total_requirements) × 100
  Assemble final acceptance_criteria[] by merging primary_scenario + negative_scenarios
  + testability_rating + tags per entry.
  Output: coverage_map, summary, acceptance_criteria[], finalized feedback[]
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `acceptance_criteria` | `array[object]` | BDD criteria entries: `ac_id`, `requirement_id`, `title`, `given`, `when`, `then`, `negative_scenarios`, `testability_rating`, `tags` |
| `untestable_requirements` | `array[object]` | Requirements that could not produce valid ACs: `requirement_id`, `reason`, `suggestion` |
| `coverage_map` | `object` | Maps each `requirement_id` → list of generated `ac_id` values |
| `summary` | `object` | `total_requirements`, `total_ac_generated`, `untestable_count`, `coverage_percentage` |
| `metrics` | `object` | **REQUIRED.** Execution metrics |
| `feedback` | `array[object]` | **REQUIRED.** Backpropagation entries for `requirement-analyzer` |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "acceptance_criteria": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "ac_id":              { "type": "string", "pattern": "^AC-[0-9]{3,}$" },
          "requirement_id":     { "type": "string" },
          "title":              { "type": "string" },
          "given":              { "type": "string" },
          "when":               { "type": "string" },
          "then":               { "type": "string" },
          "negative_scenarios": { "type": "array", "items": { "type": "string" } },
          "testability_rating": { "type": "string", "enum": ["high", "medium", "low"] },
          "tags":               { "type": "array", "items": { "type": "string" } }
        },
        "required": ["ac_id", "requirement_id", "title", "given", "when", "then",
                     "negative_scenarios", "testability_rating", "tags"]
      }
    },
    "untestable_requirements": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "requirement_id": { "type": "string" },
          "reason":         { "type": "string" },
          "suggestion":     { "type": "string" }
        },
        "required": ["requirement_id", "reason"]
      }
    },
    "coverage_map": {
      "type": "object",
      "additionalProperties": {
        "type": "array",
        "items": { "type": "string" }
      }
    },
    "summary": {
      "type": "object",
      "properties": {
        "total_requirements":  { "type": "integer", "minimum": 0 },
        "total_ac_generated":  { "type": "integer", "minimum": 0 },
        "untestable_count":    { "type": "integer", "minimum": 0 },
        "coverage_percentage": { "type": "number",  "minimum": 0, "maximum": 100 }
      },
      "required": ["total_requirements", "total_ac_generated",
                   "untestable_count", "coverage_percentage"]
    },
    "metrics":  { "$ref": "#/$defs/metrics" },
    "feedback": { "type": "array", "items": { "$ref": "#/$defs/feedback_entry" } }
  },
  "required": ["acceptance_criteria", "untestable_requirements",
               "coverage_map", "summary", "metrics", "feedback"],
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

- Every generated `ac_id` MUST be unique within a single invocation. Counter is sequential and zero-padded to 3+ digits.
- `requirement_id` in each AC entry MUST exactly match the `id` field of the originating requirement — no transformation, normalization, or truncation.
- Untestable requirements MUST NOT be silently forwarded — they are collected in `untestable_requirements[]` and trigger a `backpropagate` feedback to `requirement-analyzer`.
- Maximum requirements per invocation: 100. Larger batches must be split and invoked in multiple calls.
- When `include_negative_scenarios = false`: `negative_scenarios` arrays are populated as empty arrays `[]`, not omitted.
- When `testability_check = false`: all `testability_rating` values default to `"medium"` and `untestable_requirements` is returned as an empty array.
- AC IDs are local to each invocation — the caller is responsible for global uniqueness across invocations if needed.
- The skill MUST NOT modify, rewrite, or correct the upstream requirements — it flags issues via `untestable_requirements` only.

## Security Considerations

- Requirement descriptions are treated as untrusted text — no SQL, shell, or template injection from description content is possible since output is pure structured data.
- `context.user_roles` values are used verbatim in generated text — validate that they do not contain injection-pattern characters (`<`, `>`, `{`, `}`) before interpolation.
- Do not include full requirement description text in feedback `evidence` fields — reference by `requirement_id` only to minimize token exposure.
- `ac_id` values follow a strict pattern (`AC-NNN`) and are never derived from user-provided input — preventing ID injection.

## Token Optimization

- Process requirements sequentially; do not load all `given/when/then` constructions into context simultaneously for batches > 20 requirements.
- For `include_negative_scenarios = false`: skip Step 4 entirely to reduce ~30% of processing tokens.
- Return `coverage_map` as a compact object (requirement_id → ac_id array) — do not repeat AC content in the map.
- Truncate `suggestion` strings in `untestable_requirements` to 200 characters maximum to control output size.
- Omit `tags` arrays when empty rather than emitting `"tags": []` for every entry.

## Quality Checklist

- [ ] All requirements validated for required fields before Step 2 begins
- [ ] All generated `ac_id` values are unique within the invocation
- [ ] All `requirement_id` values in `acceptance_criteria` match source requirement `id` exactly
- [ ] `negative_scenarios` covers at least one of: invalid input, boundary, or auth for applicable requirements
- [ ] `testability_rating` applied to every AC entry when `testability_check = true`
- [ ] `untestable_requirements` populated for every `low`-rated requirement
- [ ] Feedback backpropagated to `requirement-analyzer` when `untestable_requirements` is non-empty
- [ ] `coverage_percentage` calculated correctly: `((total - untestable) / total) × 100`
- [ ] `summary` totals match actual array lengths

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| `requirements` array is empty or missing | Reject: `{"error": "MISSING_REQUIREMENTS", "minimum": 1}` |
| Any requirement missing `id`, `description`, `type`, or `priority` | Reject: `{"error": "INVALID_REQUIREMENT", "index": N, "missing": [...]}` |
| More than 100 requirements in one call | Reject: `{"error": "BATCH_TOO_LARGE", "max": 100, "guidance": "split into multiple calls"}` |
| All requirements are untestable | Return empty `acceptance_criteria: []`, populate `untestable_requirements`, emit `backpropagate` feedback |
| `format = "both"` but downstream skill only accepts `"gherkin"` | Emit `warning` feedback: "format=both requested; downstream skill may only consume gherkin fields" |

## 12. Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Behavior |
|------|---------|---------|----------|
| High untestable rate | `untestable_count / total_requirements > 0.50` | 3600s | Pause; present `untestable_requirements` list to product owner for requirement clarification before proceeding to testing-strategy |

Gate behavior: `pause` — pipeline halts, requirements owner is notified, execution resumes only after requirements are updated and skill is re-invoked.

## 13. Skill Composition

`acceptance-criteria-generator` runs after `requirement-analyzer` and feeds `testing-strategy` and `test-generator`:

```yaml
composes:
  - skill: acceptance-criteria-generator
    version: "^1.0.0"
    input_map:
      requirements:               "requirement_analyzer.requirements"
      context:
        domain:      "session.domain"
        user_roles:  "session.user_roles"
      format:                     "session.ac_format"
      include_negative_scenarios: true
      testability_check:          true
    output_map:
      acceptance_criteria: "state.acceptance_criteria"
      coverage_map:        "state.requirements_coverage"
      untestable_requirements: "state.untestable_requirements"

  - skill: testing-strategy
    version: "^1.2.0"
    input_map:
      acceptance_criteria: "state.acceptance_criteria"
      coverage_map:        "state.requirements_coverage"

  - skill: test-generator
    version: "^1.0.0"
    input_map:
      acceptance_criteria: "state.acceptance_criteria"
```

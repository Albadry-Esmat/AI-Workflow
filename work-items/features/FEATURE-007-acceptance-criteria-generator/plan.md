# FEATURE-007 — Implementation Plan: Acceptance Criteria Generator

## Target Skills / Artifacts

| Skill / Artifact | Action | Notes |
|---|---|---|
| `acceptance-criteria-generator/SKILL.md` (SKL-067) | Create | New skill — BDD acceptance criteria from structured requirements |
| `skills/registry.json` | Update | Register SKL-067 with `status: draft` |
| `skills/index.yaml` | Update | Add index entry for SKL-067 |

---

## §1 — Skill Purpose and Pipeline Position

`acceptance-criteria-generator` bridges `requirement-analyzer` and the testing skills. It transforms each structured requirement into formal, executable BDD-style acceptance criteria, making requirements-to-tests traceability explicit and systematic.

Pipeline position:

```
requirement-analyzer
  → acceptance-criteria-generator    ← THIS SKILL
      → testing-strategy             (receives acceptance_criteria as primary input)
      → test-generator               (receives acceptance_criteria for test scaffolding)
```

Untestable requirements are backpropagated to `requirement-analyzer` rather than forwarded, breaking the pipeline at the point of ambiguity.

---

## §2 — Input Schema

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
          "id":          { "type": "string" },
          "description": { "type": "string" },
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

---

## §3 — Execution Steps Specification

### Step 1 — Validate Requirements Input

Check each requirement for required fields: `id`, `description`, `type`, `priority`.
Reject the entire invocation with a structured error if any requirement is missing required fields — do not silently skip individual requirements.
Initialize sequential AC counter starting at `AC-001`.

Output: `validated_requirements[]`

### Step 2 — Extract Actors, Actions, and Outcomes

For each requirement description, identify:
- **Actor**: who performs the action — default to `"the user"` if implicit; use `context.user_roles[0]` if provided
- **Action**: what they do — extract verb phrases (e.g., "submits a form", "calls the endpoint", "navigates to")
- **Outcome**: what the expected result is — extract result clauses (e.g., "data is saved", "a 200 response is returned")

Flag requirement as `potentially_untestable` if:
- Outcome contains subjective/non-measurable language: "fast", "user-friendly", "intuitive", "appropriate", "sometimes"
- Outcome is absent or cannot be extracted from the description

Output: `requirement_components { actor, action, outcome, potentially_untestable }` per requirement

### Step 3 — Generate Given/When/Then (Primary Scenario)

Construct the primary (happy path) scenario per requirement:
- `given` = initial system state that enables the action (e.g., `"the user is authenticated and the order is in draft state"`)
- `when` = actor + action using specific language from the requirement description
- `then` = observable expected outcome, phrased as a present-tense assertion

Assign `ac_id = "AC-" + zero_padded_counter` (e.g., `AC-001`, `AC-002`).

Assign `testability_rating`:
- `high` = outcome is deterministic, state-checkable, fully automatable
- `medium` = outcome is deterministic but requires test fixtures, seeded data, or environment setup
- `low` = outcome is subjective, time-dependent, or requires manual observation

Output: `primary_scenario` per requirement, with `ac_id` and `testability_rating`

### Step 4 — Generate Negative Scenarios *(when `include_negative_scenarios = true`)*

For each requirement, generate 1–3 negative scenarios covering:
1. **Invalid input**: malformed data, missing required fields, type mismatches, strings where numbers expected
2. **Boundary conditions**: empty collections, maximum-length inputs, zero or negative numeric values
3. **Unauthorized access**: action attempted without required role, permission, or authentication

Format each as a one-sentence pair appended to the AC entry:
- `"When the user submits {field} as empty, then a validation error message is displayed"`
- `"When a user without the {role} role calls {endpoint}, then a 403 Forbidden response is returned"`

Output: `negative_scenarios[]` per AC entry (1–3 items)

### Step 5 — Rate Testability *(when `testability_check = true`)*

Apply testability rating criteria to each primary scenario:
- **`high`**: all three are true: (1) outcome is deterministic, (2) outcome can be asserted in code, (3) description contains measurable nouns (IDs, counts, status codes, persisted records)
- **`medium`**: outcome is deterministic but requires test fixtures (database seed, mock external service, file upload setup)
- **`low`**: any of: (1) outcome uses subjective adjectives, (2) outcome depends on elapsed time, (3) outcome requires visual/human inspection

`low` ratings flag the requirement as `potentially_untestable`.

Output: `testability_ratings { req_id, rating, reason }`

### Step 6 — Flag Untestable Requirements

For each requirement in `potentially_untestable`:
- Determine root cause: `ambiguous_outcome | missing_acceptance_data | subjective_criteria | non_verifiable_constraint`
- Build `untestable_requirements` entry: `{ requirement_id, reason, suggestion }`
- Calculate flag: if `untestable_requirements.length / total_requirements > 0.25` → set `low_testability_count_exceeds_threshold = true`

Emit feedback:
- IF `untestable_requirements` is non-empty → `backpropagate` to `requirement-analyzer`, reason: `untestable_requirement_detected`
- IF `low_testability_count_exceeds_threshold` → `backpropagate` to `requirement-analyzer`, reason: `low_testability_count_exceeds_threshold`

Output: `untestable_requirements[]`, feedback entries

### Step 7 — Build Coverage Map and Summary Statistics

Construct `coverage_map`: maps each `requirement_id` → list of all `ac_id` values generated from it.

Calculate summary:
- `total_requirements` = input requirements count
- `total_ac_generated` = count of all `acceptance_criteria` entries
- `untestable_count` = `untestable_requirements.length`
- `coverage_percentage` = `((total_requirements - untestable_count) / total_requirements) × 100`

Output: `coverage_map`, `summary`, finalized `feedback[]`

---

## §4 — Output Schema

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
          "ac_id":               { "type": "string", "pattern": "^AC-[0-9]{3,}$" },
          "requirement_id":      { "type": "string" },
          "title":               { "type": "string" },
          "given":               { "type": "string" },
          "when":                { "type": "string" },
          "then":                { "type": "string" },
          "negative_scenarios":  { "type": "array", "items": { "type": "string" } },
          "testability_rating":  { "type": "string", "enum": ["high", "medium", "low"] },
          "tags":                { "type": "array", "items": { "type": "string" } }
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
      "additionalProperties": { "type": "array", "items": { "type": "string" } }
    },
    "summary": {
      "type": "object",
      "properties": {
        "total_requirements":  { "type": "integer" },
        "total_ac_generated":  { "type": "integer" },
        "untestable_count":    { "type": "integer" },
        "coverage_percentage": { "type": "number", "minimum": 0, "maximum": 100 }
      },
      "required": ["total_requirements", "total_ac_generated", "untestable_count", "coverage_percentage"]
    },
    "metrics":  { "$ref": "#/$defs/metrics" },
    "feedback": { "type": "array", "items": { "$ref": "#/$defs/feedback_entry" } }
  },
  "required": ["acceptance_criteria", "untestable_requirements", "coverage_map", "summary", "metrics", "feedback"]
}
```

---

## §5 — Feedback Routes

| Condition | Feedback Type | Target Skill | Reason |
|---|---|---|---|
| `untestable_requirements` is non-empty | `backpropagate` | `requirement-analyzer` | `untestable_requirement_detected` |
| `untestable_count / total_requirements > 0.25` | `backpropagate` | `requirement-analyzer` | `low_testability_count_exceeds_threshold` |

---

## §6 — Registry Entry

SKL-067 must be added to `skills/registry.json`:
```json
{
  "id": "SKL-067",
  "name": "acceptance-criteria-generator",
  "version": "1.0.0",
  "domain": "requirements",
  "status": "draft",
  "phase": 7,
  "req_id": "N22"
}
```

`scripts/validate-skills.sh` must pass (exit 0) after registration.

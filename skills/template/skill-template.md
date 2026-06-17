# Skill Specification Template

> Every skill in this system MUST conform to this template. Deviations reduce predictability, increase token consumption, and break orchestration.

---

## 1. Skill Header

```yaml
name: <hyphenated-lowercase-name>
version: <semver>
domain: <domain-category>
description: >
  Use when <condition that triggers this skill>. Triggers on: "<exact phrase 1>",
  "<exact phrase 2>", "<exact phrase 3>". [Optional: Do NOT use when <exclusion>.]
author: <system | org-name>
```

> **Auto-trigger rule (STRICTLY ENFORCED):** The `description` field is the ONLY signal
> OpenCode uses to automatically select this skill. Every skill in the system MUST follow
> this exact format — no exceptions, no warnings, no partial compliance:
>
> ```
> Use when <condition>. Triggers on: "<phrase1>", "<phrase2>", "<phrase3>".
> ```
>
> Rules:
> - Start with `"Use when"` — the condition that activates this skill
> - Include `"Triggers on:"` with **at least 3** quoted exact phrases the user will say
> - For narrow/internal skills append `"Do NOT use when <exclusion>"` to prevent false matches
> - Front-load the most discriminating keyword first
> - Maximum 2 sentences total
>
> **Enforcement:**
> - `description` missing → **BLOCK** registration
> - `description` present but wrong format → **BLOCK** registration, return correction instructions
> - `description` correct format → **ALLOW** registration
>
> There is no warn-and-continue. A skill that does not auto-trigger is not a valid skill.

## 2. Purpose

One paragraph. What this skill produces, why it exists, and what problem it solves for the caller.

## 3. Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `input.field` | `string` | Yes/No | Description |
| ... | | | |

**Input Schema** (formal):

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "fieldName": { "type": "string", "description": "..." }
  },
  "required": ["fieldName"]
}
```

## 4. Required Context

Conditions that must hold before execution. What data, state, or prior skills must have run.

## 5. Execution Logic

```
Step 1 — <action>
  Rationale: <why>
  Output: <intermediate artifact>

Step 2 — <action>
  ...
```

Each step must be atomic, testable, and produce an intermediate artifact OR a side effect.

## 6. Outputs

| Field | Type | Description |
|-------|------|-------------|
| `output.field` | `type` | Description |
| `metrics` | `object` | **REQUIRED.** Execution metrics (tokens_in, tokens_out, duration_ms, items_produced, version) |
| `feedback` | `array[object]` | **REQUIRED.** Feedback loop entries for cross-skill communication |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "result": { "type": "object", "description": "..." },
    "metrics": { "$ref": "#/$defs/metrics" },
    "feedback": { "type": "array", "items": { "$ref": "#/$defs/feedback_entry" } }
  },
  "required": ["result", "metrics"],
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

Output MUST be a JSON object. No free-form prose in structured fields.

Every skill MUST include `metrics` and `feedback` in its output. Use `$ref` to reference the shared definitions above.

## 7. Rules & Constraints

- Bullet list of invariants this skill MUST NOT violate.
- Token limits, recursion guards, max iteration counts.

## 8. Security Considerations

- Input sanitization requirements.
- Data isolation rules.
- What the skill must NOT do (e.g., execute code, access network).

## 9. Token Optimization

- Strategies used to minimize prompt/response size.
- Required compression techniques (e.g., truncate context beyond N tokens).
- How intermediate artifacts are pruned before passing to next skill.

## 10. Quality Checklist

- [ ] Input validated against schema
- [ ] No hallucinated field names
- [ ] All required output fields present
- [ ] Output is valid JSON
- [ ] Token budget respected
- [ ] No assumption unchecked

## 11. Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| Missing required input | Return error with missing fields list |
| Ambiguous context | Emit clarification request, halt |
| Output exceeds token limit | Chunk output, flag for aggregation |

---

## 12. Human-in-the-Loop Gates

Define gate points where human review is required before proceeding.

| Gate Point | Trigger | Required Approvers | Timeout |
|------------|---------|-------------------|---------|
| Before downstream skill | Condition or always | Role(s) | Seconds |

Gate behavior:
- `pause`: halt pipeline, emit approval request, wait for response
- `auto_continue`: proceed if no response within timeout (logged as `gate_skipped`)
- `reject`: halt and return partial results

## 13. Skill Composition

Skills may be composed into meta-skills. Composition is declared via:

```yaml
composes:
  - skill: <name>
    version: <range>
    input_map: { "local_field": "<composed_skill_output>.<field>" }
    output_map: { "<composed_skill_output>.<field>": "local_field" }
```

Composition rules:
- A composed skill may wrap 1+ skills in any combination.
- `input_map` maps the meta-skill's input fields to composed skill input fields.
- `output_map` maps composed skill output fields to the meta-skill's output fields.
- The meta-skill's execution logic orchestrates the composed skills in order.
- Composition MUST NOT create circular dependencies.

**Example composition:**
```yaml
name: full-audit
composes:
  - skill: clean-code-review
    input_map: { "code": "code", "language": "language" }
    output_map: { "issues": "code_issues" }
  - skill: security-review
    input_map: { "architecture": "architecture", "code_snippets": "code_snippets" }
    output_map: { "vulnerabilities": "security_issues" }
```

---

*End of template. All skills MUST follow this structure without omission.*

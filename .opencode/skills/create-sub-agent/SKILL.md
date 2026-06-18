---
name: create-sub-agent
version: 1.0.0
domain: meta
description: 'Use when asked to create, define, design, or generate a new sub-agent or atomic execution worker. Triggers on: "create sub-agent", "generate sub-agent", "build sub-agent", "define sub-agent", "new sub-agent skill", "I need a sub-agent that".'
author: system
---

## Purpose

This skill acts as a **compiler**: it converts a capability requirement into a fully-specified sub-agent module. It enforces single-responsibility, context isolation, deterministic I/O, and orchestrator-control constraints on every generated sub-agent. The output is a ready-to-deploy sub-agent spec including metadata, input/output contracts, tool permissions, failure handling, and a pre-deployment validation checklist.

---

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `capability_name` | `string` | Yes | Hyphenated lowercase name (e.g., `code-reviewer`) |
| `responsibility` | `string` | Yes | Exactly one sentence describing the sub-agent's single job |
| `input_fields` | `array[object]` | Yes | Input field definitions: `{name, type, required, description}` |
| `output_fields` | `array[object]` | Yes | Output field definitions: `{name, type, description}` |
| `allowed_tools` | `array[string]` | No | Whitelisted tools. Default: `[]` |
| `forbidden_tools` | `array[string]` | No | Explicitly blacklisted tools |
| `depends_on` | `array[string]` | No | Other skill names this sub-agent depends on |
| `tags` | `array[string]` | No | Classification tags |
| `version` | `string` | No | Semver string. Default: `1.0.0` |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "capability_name": { "type": "string", "pattern": "^[a-z][a-z0-9-]*$" },
    "responsibility": { "type": "string", "maxLength": 200 },
    "input_fields": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": { "type": "string" },
          "type": { "type": "string" },
          "required": { "type": "boolean" },
          "description": { "type": "string" }
        },
        "required": ["name", "type", "required"]
      },
      "minItems": 1
    },
    "output_fields": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": { "type": "string" },
          "type": { "type": "string" },
          "description": { "type": "string" }
        },
        "required": ["name", "type"]
      },
      "minItems": 1
    },
    "allowed_tools": { "type": "array", "items": { "type": "string" } },
    "forbidden_tools": { "type": "array", "items": { "type": "string" } },
    "depends_on": { "type": "array", "items": { "type": "string" } },
    "tags": { "type": "array", "items": { "type": "string" } },
    "version": { "type": "string", "pattern": "^\\d+\\.\\d+\\.\\d+$" }
  },
  "required": ["capability_name", "responsibility", "input_fields", "output_fields"]
}
```

**Input Rejection Rules:**

| Condition | Action |
|-----------|--------|
| `capability_name` does not match `^[a-z][a-z0-9-]*$` | Reject with schema error |
| `responsibility` describes multiple jobs | Reject with scope violation |
| `input_fields` or `output_fields` is empty | Reject with missing contract error |
| Same tool in both `allowed_tools` and `forbidden_tools` | Reject with conflict error |
| Missing any required field | Reject with missing field error |

---

## Required Context

- Orchestrator must supply all required input fields.
- No prior skill execution required.
- No external system state needed.

---

## Execution Logic

```
Step 1 — Validate input against schema
  Reject immediately on any schema violation.
  Output: validation_result { valid: bool, errors: [] }

Step 2 — Scope analysis
  Assert responsibility describes exactly ONE job.
  Flag multi-responsibility indicators: "and also", "as well as", "in addition to".
  Output: scope_check { single_responsibility: bool, violations: [] }

Step 3 — Build sub-agent metadata block
  Construct: id, name, short_description, execution_mode=sub-agent,
  scope_type=atomic, reference_path, tags, version, depends_on,
  related_skills, mastery_level, use_when, do_not_use_when.
  MANDATORY — also construct `description` for OpenCode auto-triggering:
    Format: "Use when <condition>. Triggers on: \"<phrase1>\", \"<phrase2>\", \"<phrase3>\"."
    Rules:
      - Start with "Use when" followed by the activation condition
      - Include "Triggers on:" with 3+ exact phrases the caller will say
      - Add "Do NOT use when <exclusion>" for narrow or internal sub-agents
      - Maximum 2 sentences total
    Enforcement:
      - Missing → BLOCK output immediately, return MISSING_DESCRIPTION error
      - Does not start with "Use when" → BLOCK, return INVALID_DESCRIPTION_FORMAT error with correction
      - Missing "Triggers on:" or fewer than 3 phrases → BLOCK, return INVALID_DESCRIPTION_FORMAT error with correction
      - There is no warn-and-continue. Every generated sub-agent MUST auto-trigger.
  Output: metadata_block (YAML)

Step 4 — Build input contract
  Map input_fields → formal JSON Schema with required/optional split.
  Append rejection rules for each required field.
  Output: input_contract (JSON Schema)

Step 5 — Build output contract
  Map output_fields → formal JSON Schema.
  Append mandatory envelope fields: status, errors.
  Output: output_contract (JSON Schema)

Step 6 — Build tool permission block
  allowed = allowed_tools (whitelist only)
  forbidden = forbidden_tools + all cross-agent communication tools
  Output: tool_permissions { allowed: [], forbidden: [] }

Step 7 — Build orchestration rules
  Assert: sub-agent is always under orchestrator control.
  Assert: no routing decisions, no workflow initiation.
  Assert: returns { output, status } only.
  Output: orchestration_rules (text block)

Step 8 — Build failure handling strategy
  Define structured error responses for:
    input_failure, execution_failure, scope_violation
  Output: failure_handling (structured object)

Step 9 — Run validation checklist
  Verify all 10 checklist items against generated spec.
  Output: validation_checklist { items: [], all_passed: bool }

Step 10 — Assemble and emit full sub-agent spec
  Combine all blocks into mandatory output structure.
  Emit: structured JSON spec + SKILL.md content string.
  Output: sub_agent_spec (complete)
```

---

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `metadata` | `object` | Standard sub-agent metadata block |
| `input_contract` | `object` | JSON Schema for inputs with rejection rules |
| `output_contract` | `object` | JSON Schema for outputs with envelope fields |
| `execution_workflow` | `array[object]` | Ordered, atomic execution steps |
| `tool_permissions` | `object` | `{ allowed: [], forbidden: [] }` |
| `orchestration_rules` | `object` | Control flow constraints |
| `failure_handling` | `object` | Structured error responses per failure mode |
| `dependency_map` | `object` | Declared dependencies and related skills |
| `validation_checklist` | `object` | Pre-deployment checklist with pass/fail per item |
| `activation_tests` | `object` | Positive, negative, edge case test scenarios |
| `skill_md_content` | `string` | Ready-to-write SKILL.md content |
| `status` | `string` | `success` \| `rejected` \| `partial` |
| `errors` | `array[string]` | Empty on success; populated on rejection |
| `metrics` | `object` | Execution metrics (tokens_in, tokens_out, duration_ms, items_produced, version) |
| `feedback` | `array[object]` | Feedback loop entries for orchestrator |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "metadata": {
      "type": "object",
      "properties": {
        "id": { "type": "string" },
        "name": { "type": "string" },
        "short_description": { "type": "string" },
        "execution_mode": { "type": "string", "enum": ["sub-agent"] },
        "scope_type": { "type": "string", "enum": ["atomic"] },
        "reference_path": { "type": "string" },
        "tags": { "type": "array", "items": { "type": "string" } },
        "version": { "type": "string" },
        "depends_on": { "type": "array", "items": { "type": "string" } },
        "related_skills": { "type": "array", "items": { "type": "string" } },
        "mastery_level": { "type": "string" },
        "use_when": { "type": "string" },
        "do_not_use_when": { "type": "string" }
      },
      "required": ["id", "name", "execution_mode", "scope_type", "version"]
    },
    "input_contract": { "type": "object" },
    "output_contract": { "type": "object" },
    "execution_workflow": { "type": "array" },
    "tool_permissions": {
      "type": "object",
      "properties": {
        "allowed": { "type": "array" },
        "forbidden": { "type": "array" }
      },
      "required": ["allowed", "forbidden"]
    },
    "orchestration_rules": { "type": "object" },
    "failure_handling": { "type": "object" },
    "dependency_map": { "type": "object" },
    "validation_checklist": { "type": "object" },
    "activation_tests": { "type": "object" },
    "skill_md_content": { "type": "string" },
    "status": { "type": "string", "enum": ["success", "rejected", "partial"] },
    "errors": { "type": "array", "items": { "type": "string" } },
    "metrics": { "$ref": "#/$defs/metrics" },
    "feedback": { "type": "array", "items": { "$ref": "#/$defs/feedback_entry" } }
  },
  "required": ["metadata", "input_contract", "output_contract", "status", "errors", "skill_md_content", "metrics"],
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

---

## Rules & Constraints

- This skill generates ONLY sub-agent specs. It does not execute, deploy, or register them.
- Generated sub-agent MUST have `execution_mode = sub-agent` and `scope_type = atomic`.
- A generated sub-agent must have exactly one job. Multi-responsibility specs are rejected.
- Tool permissions in generated sub-agents are whitelist-only — no dynamic escalation.
- Generated sub-agents MUST NOT contain orchestration logic, routing decisions, or memory persistence.
- This skill itself is stateless — no context is retained between invocations.
- Maximum `responsibility` length: 200 characters.
- No circular dependencies allowed in `depends_on`.

---

## Security Considerations

- All input fields are validated against schema before execution begins.
- No code execution occurs — this skill produces specifications only.
- `skill_md_content` output must not contain executable code blocks.
- Input sanitization: strip control characters from all string fields.
- Generated sub-agent specs must not reference external URLs or network resources.

---

## Token Optimization

- Reject invalid inputs before any generation work begins (fail-fast at Step 1).
- Metadata block uses compact YAML, not verbose JSON.
- `skill_md_content` is generated last after all contracts are finalized.
- Intermediate artifacts (Steps 1–9) are pruned from context before final assembly.
- Maximum output size: 4000 tokens for `skill_md_content`.

---

## Quality Checklist

- [ ] Input validated against schema
- [ ] Single responsibility confirmed
- [ ] `execution_mode = sub-agent` present
- [ ] `scope_type = atomic` present
- [ ] Input and output contracts complete
- [ ] Tool whitelist defined (may be empty)
- [ ] Failure handling covers all three modes
- [ ] Validation checklist all items evaluated
- [ ] Output is valid JSON
- [ ] `metrics` and `feedback` fields present
- [ ] `description` frontmatter is present (BLOCK if missing)
- [ ] `description` frontmatter starts with "Use when" (BLOCK if not)
- [ ] `description` frontmatter contains "Triggers on:" with 3+ quoted phrases (BLOCK if not)
- [ ] SKILL.md output placed under `.opencode/skills/<name>/SKILL.md`

---

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| Missing required input field | Return `{ status: "rejected", errors: ["Missing required field: <name>"] }` |
| `capability_name` invalid format | Return `{ status: "rejected", errors: ["Invalid capability_name format"] }` |
| Multiple responsibilities detected | Return `{ status: "rejected", errors: ["Scope violation: multiple responsibilities"] }` |
| Tool in both allowed and forbidden | Return `{ status: "rejected", errors: ["Tool conflict: <tool>"] }` |
| Assembly failure (partial) | Return `{ status: "partial", errors: ["<reason>"], ...available_output }` |
| Out-of-scope request | Return `{ status: "rejected", errors: ["Scope violation: this skill generates sub-agent specs only"] }` |
| `description` field missing from generated SKILL.md | BLOCK output; return `{ status: "rejected", errors: ["MISSING_DESCRIPTION: add description following format: Use when <condition>. Triggers on: \"<phrase1>\", \"<phrase2>\", \"<phrase3>\"."] }` |
| `description` present but does not start with "Use when" | BLOCK output; return `{ status: "rejected", errors: ["INVALID_DESCRIPTION_FORMAT: must start with 'Use when'"] }` with corrected example |
| `description` missing "Triggers on:" or fewer than 3 phrases | BLOCK output; return `{ status: "rejected", errors: ["INVALID_DESCRIPTION_FORMAT: must include 'Triggers on:' with 3+ quoted phrases"] }` with corrected example |

---

## Human-in-the-Loop Gates

| Gate Point | Trigger | Required Approvers | Timeout |
|------------|---------|-------------------|---------|
| Before writing SKILL.md to disk | Always — orchestrator decision | Human or primary agent | 60s |

Gate behavior:
- `pause`: halt after emitting spec, await orchestrator approval before file write
- `auto_continue`: orchestrator may proceed if no response within 60s (logged as `gate_skipped`)
- `reject`: return spec without writing if explicitly rejected

---

## Skill Composition

This skill is composable as a sub-skill within meta-skill pipelines:

```yaml
composes:
  - skill: create-sub-agent
    version: ">=1.0.0"
    input_map:
      capability_name: "pipeline.agent_name"
      responsibility: "pipeline.agent_responsibility"
      input_fields: "pipeline.agent_inputs"
      output_fields: "pipeline.agent_outputs"
    output_map:
      skill_md_content: "pipeline.generated_skill_content"
      status: "pipeline.generation_status"
```

Composition rules:
- This skill may be composed within `build-agent-pipeline` or `scaffold-workflow` meta-skills.
- It MUST NOT compose other skills internally.
- No circular composition allowed.

---

## Sub-Agent Lifecycle (Enforced in Generated Output)

Every sub-agent generated by this skill follows this lifecycle:

```
1. Receive task from orchestrator
2. Validate input schema
3. Confirm task is within scope
4. Load required instructions/skills only
5. Execute bounded logic
6. Validate output
7. Return structured result
8. Terminate (no persistence)
```

---

## Activation Test Cases

**Positive:**
- Valid `capability_name`, single-sentence `responsibility`, well-formed fields → `status: success`, full spec
- Minimal input (required fields only) → `status: success` with version defaulting to `1.0.0`

**Negative:**
- `capability_name: "Code Reviewer"` → `status: rejected`, schema error
- `responsibility: "reviews code and also deploys builds"` → `status: rejected`, scope violation
- Tool in both lists → `status: rejected`, conflict error
- Empty `input_fields` → `status: rejected`, missing contract error

**Edge Cases:**
- Very broad single-responsibility (e.g., "processes data") → `status: success` with warning in feedback
- `allowed_tools: []` → valid; generated sub-agent has no tool access
- `depends_on` references unknown skill → `status: success` with info feedback entry

---

*End of skill. Conforms to Skill Specification Template v1.0.0.*

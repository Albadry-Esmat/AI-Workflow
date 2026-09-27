---
name: clean-code-review
version: 1.1.0
domain: review
description: 'Use when asked to review code quality, check SOLID principles, find anti-patterns, detect duplication, or produce refactoring suggestions. Triggers on: "review this code", "code review", "refactor", "is this clean code", "SOLID", "anti-patterns", "code quality".'
author: system
---

## Purpose

Perform automated static analysis of source code for maintainability, readability, and adherence to clean code principles. The skill validates code against SOLID, DRY, KISS, and clean architecture rules, then produces a prioritized issues list with actionable refactoring suggestions and improved code versions where feasible.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `code` | `string` | Yes | Source code to analyze |
| `language` | `string` | Yes | Programming language (e.g., "python", "go", "typescript") |
| `context` | `object` | No | Module name, architecture layer, related files |
| `strictness` | `string` | No | `"low"`, `"medium"`, `"high"` (default: `"medium"`) |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "code": { "type": "string", "minLength": 1 },
    "language": { "type": "string", "minLength": 1 },
    "context": {
      "type": "object",
      "properties": {
        "module": { "type": "string" },
        "layer": { "type": "string", "enum": ["presentation", "application", "domain", "infrastructure"] },
        "related_files": { "type": "array", "items": { "type": "string" } }
      }
    },
    "strictness": { "type": "string", "enum": ["low", "medium", "high"], "default": "medium" }
  },
  "required": ["code", "language"]
}
```

## Required Context

- If `context.layer` is provided, the skill validates layer-specific rules (e.g., domain layer must not reference infrastructure).
- If module information is available, cross-reference against architecture modules.

## Execution Logic

```
Step 1 — Parse structure
  Identify functions, types, classes, interfaces, imports, and module structure.
  Output: structural map of the code

Step 2 — Validate against SOLID principles
  - Single Responsibility: Does each class/function have one reason to change?
  - Open/Closed: Are extensions preferred over modifications?
  - Liskov Substitution: Do subtypes honor their base contracts?
  - Interface Segregation: Are interfaces focused?
  - Dependency Inversion: Do high-level modules avoid depending on low-level details?
  Output: SOLID violations with evidence

Step 3 — Detect duplication
  Identify repeated code blocks, magic numbers, duplicated logic paths.
  Output: duplication map with location and suggested abstraction

Step 4 — Measure complexity
  Calculate cyclomatic complexity per function/method.
  Flag functions exceeding threshold (default: 10 for medium strictness).
  Output: complexity report with hotspots

Step 5 — Detect anti-patterns
  Identify: God classes, long methods, feature envy, shotgun surgery, primitive obsession, inappropriate intimacy.
  Output: anti-pattern list with severity

Step 6 — Check naming and readability
  Validate naming conventions per language (camelCase, snake_case, PascalCase).
  Flag unclear names, excessive abbreviations, misleading names.
  Output: naming issues and suggestions

Step 7 — Generate improved version (if applicable)
  For issues with severity "critical" or "high", produce refactored code.
  Limit to top 3 issues by impact to respect token budget.
  Output: improved code blocks with explanations

Step 8 — Assemble review report
  Combine all findings into structured output.
  Output: complete code review report
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `issues` | `array[object]` | Issues found (id, type, severity, location, description, principle_violated) |
| `complexity_report` | `object` | Complexity metrics (functions, average_complexity, hotspots) |
| `improvements` | `array[object]` | Refactoring suggestions (issue_id, suggestion, improved_code) |
| `summary` | `object` | Score (1-10), critical count, total issues |
| `metrics` | `object` | Execution metrics (tokens_in, tokens_out, duration_ms, items_produced, version) |
| `feedback` | `array[object]` | Feedback loop entries for cross-skill communication |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "issues": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": { "type": "string", "pattern": "^ISS-\\d{3}$" },
          "type": { "type": "string", "enum": ["SOLID", "duplication", "complexity", "anti-pattern", "naming", "architecture"] },
          "severity": { "type": "string", "enum": ["critical", "high", "medium", "low", "info"] },
          "location": { "type": "string" },
          "description": { "type": "string" },
          "principle_violated": { "type": "string" }
        },
        "required": ["id", "type", "severity", "location", "description"]
      }
    },
    "complexity_report": {
      "type": "object",
      "properties": {
        "total_functions": { "type": "integer" },
        "average_complexity": { "type": "number" },
        "hotspots": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "function": { "type": "string" },
              "complexity": { "type": "integer" },
              "recommendation": { "type": "string" }
            },
            "required": ["function", "complexity"]
          }
        }
      },
      "required": ["total_functions", "average_complexity", "hotspots"]
    },
    "improvements": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "issue_id": { "type": "string" },
          "suggestion": { "type": "string" },
          "improved_code": { "type": "string" }
        },
        "required": ["issue_id", "suggestion", "improved_code"]
      }
    },
    "summary": {
      "type": "object",
      "properties": {
        "score": { "type": "integer", "minimum": 1, "maximum": 10 },
        "critical_count": { "type": "integer" },
        "total_issues": { "type": "integer" }
      },
      "required": ["score", "critical_count", "total_issues"]
    },
    "metrics": { "$ref": "#/$defs/metrics" },
    "feedback": { "type": "array", "items": { "$ref": "#/$defs/feedback_entry" } }
  },
  "required": ["issues", "complexity_report", "improvements", "summary", "metrics", "feedback"],
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

- Maximum 30 issues per review. After 30, emit `"truncated": true` in summary.
- `improvements` MUST only reference issues from the `issues` array.
- Complexity threshold per strictness: low=15, medium=10, high=7.
- Score formula: 10 - (critical * 1.5 + high * 0.8 + medium * 0.3 + low * 0.1). Floor at 1.
- Do NOT change business logic in `improved_code`. Only structural/readability refactoring.

## Security Considerations

- Do not evaluate code for security vulnerabilities. Security review is a separate skill.
- Strip any inline secrets or tokens from `code` before analysis.
- The `improved_code` field MUST NOT introduce new imports or dependencies without flagging them.

## Token Optimization

- If `code` exceeds 3000 tokens, analyze only top-level signatures and the first 200 lines of each function body.
- Compress `improvements` to issue_id + suggestion only if token budget is tight (omit improved_code for medium/low severity).
- Use abbreviated severity labels: `CR`, `HI`, `ME`, `LO`, `IN`.
- Omit `complexity_report` `hotspots` array if no function exceeds threshold.

## Quality Checklist

- [ ] Every issue has a unique ID
- [ ] `improvements` never exceed 3 entries (token budget)
- [ ] Score is computed within valid range (1-10)
- [ ] No false positives flagged (verify top 3 issues are genuine)
- [ ] All `improvements` reference valid `issue_id`
- [ ] Language-specific rules respected (e.g., no snake_case in TypeScript)

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| Empty `code` | Return error: `{"error": "NO_CODE", "message": "code field is required and must be non-empty"}` |
| Unsupported `language` | Return error with supported languages list |
| Code minified or single-line | Return `{"error": "UNPARSEABLE", "message": "Code appears minified; expand before review"}` |
| Token budget exhausted mid-analysis | Return partial results with `"partial": true` flag in summary |

## 12. Human-in-the-Loop Gates

`clean-code-review` does not define HITL gates — it is an iterative utility invoked per file. The orchestrator may configure a gate after a full review cycle if `summary.critical_count > 0`.

## 13. Skill Composition

`clean-code-review` may be composed with `security-review` in a `full-audit` meta-skill:

```yaml
name: full-audit
composes:
  - skill: clean-code-review
    version: "^1.1.0"
    input_map: { "code": "source_code", "language": "language" }
    output_map: { "issues": "code_issues", "summary": "code_summary" }
  - skill: security-review
    version: "^1.0.0"
    input_map: { "architecture": "architecture", "code_snippets": "code_snippets" }
    output_map: { "vulnerabilities": "security_findings" }
```

---
name: documentation-generator
version: 1.0.0
domain: documentation
description: Use when asked to generate documentation from scratch — API docs, ADRs, READMEs, or onboarding guides — based on requirements, architecture, or code. Triggers on: "generate docs", "write a README", "create API docs", "write an ADR", "onboarding guide", "document this".
author: system
---

## Purpose

Transform structured data from the pipeline into human-readable documentation. The skill eliminates documentation rot by generating artifacts directly from source-of-truth data. It supports multiple output formats and is designed for asynchronous execution (non-blocking to the pipeline).

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `requirements` | `array[object]` | No | Output from requirement-analyzer |
| `architecture` | `object` | No | Output from architecture-design |
| `code_review` | `object` | No | Output from clean-code-review |
| `format` | `string` | No | Output format: `"markdown"`, `"openapi"`, `"adr"`, `"all"` (default: `"all"`) |
| `options` | `object` | No | Generation options (include_diagrams, include_examples, style_guide) |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "requirements": { "type": "array" },
    "architecture": { "type": "object" },
    "code_review": { "type": "object" },
    "format": { "type": "string", "enum": ["markdown", "openapi", "adr", "all"], "default": "all" },
    "options": {
      "type": "object",
      "properties": {
        "include_diagrams": { "type": "boolean", "default": true },
        "include_examples": { "type": "boolean", "default": true },
        "style_guide": { "type": "string" }
      }
    }
  },
  "required": []
}
```

## Required Context

- At least one upstream artifact (requirements, architecture, or code_review). Empty input produces no output.

## Execution Logic

```
Step 1 — Analyze available data
  Determine which artifacts are present: requirements, architecture, code_review.
  For each present artifact, identify which document types can be generated.
  Output: generation plan

Step 2 — Generate API documentation (if architecture present)
  From modules and integration_points:
  - Generate endpoint descriptions, request/response schemas, authentication requirements.
  - Format: OpenAPI 3.0 (JSON) or Markdown table.
  Output: API docs

Step 3 — Generate Architecture Decision Records (if architecture present)
  From technical_decisions:
  - For each decision: title, context, decision, consequences, status.
  - Format: ADR markdown (Michael Nygard style).
  Output: ADR documents

Step 4 — Generate README (if requirements present)
  From requirements summary:
  - Project description, architecture overview, getting started, tech stack, links to ADRs.
  Output: README markdown

Step 5 — Generate onboarding guide (if all present)
  Combine requirements summary + architecture overview + code standards from review:
  - Local setup, dev workflow, coding conventions, testing guidelines, deployment process.
  Output: onboarding guide

Step 6 — Assemble output
  Package generated documents with metadata.
  Output: documentation bundle
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `documents` | `array[object]` | Generated documents (name, format, content, description) |
| `metrics` | `object` | Generation metrics (documents_count, total_chars, formats) |
| `feedback` | `array[object]` | Feedback for missing upstream data |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "documents": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": { "type": "string" },
          "format": { "type": "string", "enum": ["markdown", "openapi", "adr"] },
          "content": { "type": "string" },
          "description": { "type": "string" }
        },
        "required": ["name", "format", "content"]
      }
    },
    "metrics": {
      "type": "object",
      "properties": {
        "documents_count": { "type": "integer" },
        "total_chars": { "type": "integer" },
        "formats": { "type": "array", "items": { "type": "string" } }
      },
      "required": ["documents_count"]
    },
    "feedback": {
      "type": "array",
      "items": { "$ref": "#/$defs/feedback_entry" }
    }
  },
  "required": ["documents", "metrics", "feedback"],
  "$defs": {
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

- Do NOT duplicate content across documents. Use cross-references.
- ADRs MUST follow the standard template: Title, Status, Context, Decision, Consequences.
- API docs MUST NOT include internal IPs, ports, or credentials.
- Documents must be standalone (no references to internal skills or pipeline concepts).

## Token Optimization

- Generate documents in priority order: API docs > ADRs > README > onboarding. Stop if token budget exhausted.
- Use the Mermaid diagram from architecture-design directly — do not regenerate.
- Compress long code examples to snippets.

## Quality Checklist

- [ ] Documents are self-contained and readable by humans
- [ ] No pipeline-internal jargon in generated docs
- [ ] ADRs include status (Proposed, Accepted, Deprecated, Superseded)
- [ ] API docs include all integration points from architecture
- [ ] Generated content does not exceed 50K chars total

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| No input artifacts provided | Return error: `{"error": "NO_INPUT", "message": "Provide at least one upstream artifact"}` |
| Format unsupported | Default to markdown |
| Content exceeds 50K chars | Split into multiple documents, flag pagination |
| Architecture has no integration points | Generate README-only, skip API docs |

## 8. Security Considerations

- Generated documents MUST NOT include internal file paths, credentials, IPs, or pipeline configuration.
- API docs MUST use placeholder values for authentication examples — never real tokens.
- ADRs MUST NOT describe exact vulnerability details — reference to the security skill output only.

## 12. Human-in-the-Loop Gates

`documentation-generator` runs asynchronously and non-blocking. It does not define HITL gates. If generated output requires review, the primary agent may inspect `documents` output before committing to `/docs`.

## 13. Skill Composition

`documentation-generator` receives artifacts from three upstream skills:

```yaml
composes:
  - skill: requirement-analyzer
    version: "^1.1.0"
    input_map: {}
    output_map: { "requirements": "requirements" }
  - skill: architecture-design
    version: "^1.1.0"
    input_map: {}
    output_map: { "modules": "architecture.modules", "integration_points": "architecture.integration_points" }
  - skill: clean-code-review
    version: "^1.1.0"
    input_map: {}
    output_map: { "summary": "code_review" }
```

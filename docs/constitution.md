# Constitution Schema

> **Reference doc for FEATURE-006 — Project Constitution.**
> This document describes the structure, field semantics, and processing rules for
> `CONSTITUTION.md`.

## Overview

`CONSTITUTION.md` is a Markdown file at the project root that captures persistent
project context. It is read by the pipeline at startup and injected into every skill
invocation as the `project_context` variable.

## File Location

```
<project-root>/CONSTITUTION.md
```

The pipeline checks for this file before executing Step 0 of `requirement-analyzer`.
If the file does not exist, the pipeline logs a `WARN` and continues without it.

## Required Sections

| Section | Heading | Token Budget | Required |
|---------|---------|-------------|----------|
| 1 | Project Overview | ≤ 200 tokens | Yes |
| 2 | Tech Stack Decisions | ≤ 400 tokens | Yes |
| 3 | Architectural Constraints | ≤ 400 tokens | Yes |
| 4 | Non-Goals | ≤ 200 tokens | Yes |
| 5 | Team Conventions | ≤ 300 tokens | Yes |
| 6 | Open Questions | ≤ 200 tokens | No |
| 7 | Amendment Log | ≤ 200 tokens | No |

**Total target:** ≤ 2 000 tokens. If exceeded, the pipeline truncates from §7 downward
and emits a `WARN: constitution_truncated` signal.

## `project_context` Object

When read, `CONSTITUTION.md` is parsed into the following `project_context` object
passed to every skill:

```json
{
  "project_name": "string",
  "project_purpose": "string",
  "tech_stack": [
    { "layer": "string", "decision": "string", "rationale": "string" }
  ],
  "architectural_constraints": ["string"],
  "non_goals": ["string"],
  "team_conventions": {
    "indentation": "string",
    "test_framework": "string",
    "commit_format": "string"
  },
  "open_questions": ["string"],
  "constitution_token_count": 1234,
  "constitution_truncated": false
}
```

## Parsing Rules

1. **Sections are identified by `## N.` headings** (e.g., `## 2. Tech Stack Decisions`).
2. **Tables** are parsed as arrays of objects keyed by the first column.
3. **Bullet lists** under each section become string arrays.
4. **HTML comments** (`<!-- ... -->`) are stripped before parsing.
5. If any required section is missing, the pipeline emits `WARN: constitution_missing_section:<name>`
   and uses an empty value for that field.
6. `project_context` is passed as a read-only input to every skill. Skills MUST NOT
   modify `project_context` — it is injected fresh from the file on each run.

## Precedence Rules

The constitution provides *defaults and constraints*. A user's per-run input always takes
precedence for requirements, but the architectural constraints section is **enforced** —
any architecture output that violates a constraint must be flagged by the architect skill.

| Input source | Precedence |
|-------------|-----------|
| Per-run `initial_payload` | Highest (always wins for requirements) |
| `CONSTITUTION.md` architectural constraints | Enforced (violations flagged) |
| `CONSTITUTION.md` tech stack | Default (can be overridden with explicit justification) |
| `CONSTITUTION.md` team conventions | Default (silently applied) |

## Validate Skills Check (CHECK-11)

`scripts/validate-skills.sh` CHECK-11 warns if `CONSTITUTION.md` is absent:

```
WARN [CHECK-11] CONSTITUTION.md not found at project root.
  Pipeline will run without persistent project context.
  Create CONSTITUTION.md from the template: cp docs/examples/CONSTITUTION-example.md CONSTITUTION.md
```

## See Also

- Template: `CONSTITUTION.md` (project root)
- Example: `docs/examples/CONSTITUTION-example.md`
- FEATURE-006: `work-items/features/FEATURE-006-project-constitution/`

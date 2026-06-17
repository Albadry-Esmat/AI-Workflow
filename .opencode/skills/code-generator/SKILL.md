---
name: code-generator
version: 1.0.0
domain: implementation
description: Use when generating new code artifacts from architecture modules, feature plans, or interface contracts. Triggers on: "generate code", "implement this module", "scaffold this feature", "write the implementation", "generate from spec", "create boilerplate".
author: system
---

## Purpose

Transform architecture modules, feature plans, and interface contracts into working code artifacts. The code-generator produces implementation files, scaffolding, boilerplate, and interface stubs that strictly conform to the system's architectural contracts. It never invents structure — it materializes exactly what the architecture and planning skills specified. Output is always passed to `clean-code-review` and `test-generator` before being written to state.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `generation_target` | `string` | Yes | What to generate: `module`, `interface`, `test_stub`, `scaffold`, or `migration` |
| `spec` | `object` | Yes | The specification to generate from (architecture module, feature plan, or interface contract) |
| `language` | `string` | Yes | Target language: `typescript`, `python`, `go`, `rust`, `java`, `sql` |
| `style_guide` | `object` | No | Project-specific naming, formatting, and structure conventions |
| `existing_code_map` | `object` | No | Current code map — used to avoid regenerating existing files and to resolve imports |
| `architecture` | `object` | No | Full architecture output from architecture-design — used for cross-module import resolution |
| `dry_run` | `boolean` | No | If true, return generated code without writing to state (default: false) |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "generation_target": { "type": "string", "enum": ["module", "interface", "test_stub", "scaffold", "migration"] },
    "spec": { "type": "object" },
    "language": { "type": "string", "enum": ["typescript", "python", "go", "rust", "java", "sql"] },
    "style_guide": { "type": "object" },
    "existing_code_map": { "type": "object" },
    "architecture": { "type": "object" },
    "dry_run": { "type": "boolean" }
  },
  "required": ["generation_target", "spec", "language"]
}
```

## Required Context

- Architecture from `architecture-design` output (system state `architecture` scope).
- Feature plan from `feature-planning` output (system state `feature_plan` scope).
- Code map from system state `code_map` scope (for import resolution and conflict detection).

## Execution Logic

```
Step 1 — Validate spec completeness
  For module:    Require spec.module_name, spec.public_api, spec.dependencies.
  For interface: Require spec.interface_name, spec.methods.
  For test_stub: Require spec.target_module, spec.test_cases.
  For scaffold:  Require spec.project_name, spec.modules list.
  For migration: Require spec.from_schema, spec.to_schema.
  Reject if required spec fields are missing.
  Output: validated_spec

Step 2 — Resolve imports and dependencies
  For each dependency in spec.dependencies: locate owning module in architecture.
  Generate import statements using project-relative paths.
  Flag any dependency that does not exist in code_map or architecture as "unresolved".
  Output: resolved_imports, unresolved_warnings

Step 3 — Generate code artifacts
  Apply language-specific templates for the generation_target.
  Inject spec values (names, types, method signatures, field definitions) into templates.
  Apply style_guide overrides (naming convention, indentation, file extension).
  For each generated file: check existing_code_map for conflicts.
    Conflict (file exists): generate as *.new.ext and emit conflict warning.
    No conflict: generate directly.
  Output: generated_files list { path, content, language, target_type }

Step 4 — Generate documentation stubs
  For each public interface or exported function: generate JSDoc / docstring stub.
  Mark all stubs with `// TODO: fill in description` for doc-maintainer to complete.
  Output: documented_files (generated_files with doc stubs injected)

Step 5 — Validate generated code structure
  Parse generated code: check for syntax errors (language-specific parser).
  Check that all declared exports match spec.public_api.
  Check that all imports resolve (no dangling references).
  Output: validation_result { valid: boolean, errors: [] }

Step 6 — Assemble output
  If dry_run: return generated_files without writing to state.
  If !dry_run and validation passes: write generated_files to state via state-manager.
  Return artifacts, validation_result, unresolved_warnings, metrics, feedback.
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `artifacts` | `array[object]` | Generated files: `{ path, content, language, target_type, is_conflict }` |
| `validation_result` | `object` | `{ valid: boolean, errors: [{ file, line, message }] }` |
| `unresolved_imports` | `array[string]` | Import paths that could not be resolved |
| `conflict_files` | `array[string]` | Files that would overwrite existing code (generated as *.new.*) |
| `metrics` | `object` | Execution metrics |
| `feedback` | `array[object]` | Feedback entries |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "artifacts": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "path": { "type": "string" },
          "content": { "type": "string" },
          "language": { "type": "string" },
          "target_type": { "type": "string" },
          "is_conflict": { "type": "boolean" }
        },
        "required": ["path", "content", "language", "target_type", "is_conflict"]
      }
    },
    "validation_result": {
      "type": "object",
      "properties": {
        "valid": { "type": "boolean" },
        "errors": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "file": { "type": "string" },
              "line": { "type": "integer" },
              "message": { "type": "string" }
            },
            "required": ["file", "message"]
          }
        }
      },
      "required": ["valid", "errors"]
    },
    "unresolved_imports": { "type": "array", "items": { "type": "string" } },
    "conflict_files": { "type": "array", "items": { "type": "string" } },
    "metrics": { "$ref": "#/$defs/metrics" },
    "feedback": { "type": "array", "items": { "$ref": "#/$defs/feedback_entry" } }
  },
  "required": ["artifacts", "validation_result", "unresolved_imports", "conflict_files", "metrics", "feedback"],
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

- Generated code MUST NOT be written to state if `validation_result.valid === false`.
- Generated code is always routed through `clean-code-review` before finalization (via event `code.changed`).
- The generator NEVER deletes existing files — conflicts produce `*.new.*` variants only.
- `dry_run` mode does not write to state and does not emit `code.changed` events.
- Maximum artifacts per invocation: 20 files. Larger scaffolds must be batched.
- No hard-coded credentials, tokens, or environment-specific values in generated code — use placeholder constants only.

## Security Considerations

- Generated code must not contain `eval`, `exec`, `__import__`, dynamic SQL construction without parameterization, or shell injection patterns. These are flagged as generation errors.
- If `spec` contains credential-like fields, strip them and emit a security warning.

## Token Optimization

- Pass `spec` as a compact object — strip narrative descriptions, keep only type/name/contract fields.
- For `scaffold` operations, generate one module at a time and batch-write to state.
- Return `content` for files <= 200 lines. For larger files, return `path` + `summary` and write content directly to state.

## Quality Checklist

- [ ] All required spec fields validated before generation
- [ ] Import resolution attempted for every declared dependency
- [ ] Conflict detection runs against existing_code_map
- [ ] Syntax validation runs on all generated files
- [ ] No credentials or environment-specific values in output

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| spec missing required fields | Reject: `{"error": "INCOMPLETE_SPEC", "missing": [...]}` |
| Syntax validation fails | Return invalid artifacts with errors, do NOT write to state |
| >20 files requested | Reject with `{"error": "BATCH_TOO_LARGE", "max": 20}` |
| Architecture unavailable for import resolution | Generate with placeholder imports, emit warning per unresolved |

## 12. Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Behavior |
|------|---------|---------|----------|
| Conflict files detected | `conflict_files.length > 0` | 3600s | Pause, present conflicts for human merge decision |
| Security pattern detected in spec | Credential-like fields in spec | 3600s | Pause, require human to confirm stripping before generation |

## 13. Skill Composition

`code-generator` is invoked by the orchestrator after feature-planning completes:

```yaml
composes:
  - skill: code-generator
    version: "^1.0.0"
    input_map:
      generation_target: "module"
      spec: "feature_plan.modules[*]"
      language: "session.language"
    output_map:
      artifacts: "state.generated_files"
```

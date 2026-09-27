---
name: semantic-diff-analyzer
version: 1.0.0
domain: architecture
description: >
  Use when comparing two versions of code to identify behavioral changes, contract differences,
  and security-relevant logic shifts that line-level diffs cannot detect. Triggers on: "semantic
  diff", "what behavior changed", "analyze code changes", "behavioral impact of this change",
  "compare before and after code". Do NOT use when only file-level impact counts are needed —
  use change-impact-analyzer instead.
author: system
---

## Purpose

After `change-impact-analyzer` identifies *which* files changed, `semantic-diff-analyzer` identifies *how* the behavior changed. It parses both versions of each changed function or module, extracts control flow deltas, detects security-relevant pattern shifts (auth checks, null guards, data access patterns, crypto operations), computes contract diffs (parameter types, return types, thrown exceptions, preconditions), and infers which existing test assertions are now invalid. The output replaces imprecise line-count deltas with structured behavioral signals that give `security-review` and `test-generator` the precise context they need to act correctly.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `before_code` | `string` | Yes | Original code snippet or full file content before the change |
| `after_code` | `string` | Yes | Modified code snippet or full file content after the change |
| `language` | `string` | Yes | Programming language: `typescript`, `python`, `java`, `go`, `rust`, `csharp`, `kotlin`, `swift` |
| `context` | `object` | No | Architecture context: `module_name` (string), `domain` (string), `security_boundary` (bool, default false) |
| `analysis_depth` | `string` | No | `"quick"` \| `"standard"` \| `"deep"`. Default: `"standard"`. Quick skips Steps 3, 5, 6 |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "before_code": { "type": "string", "minLength": 1 },
    "after_code":  { "type": "string", "minLength": 1 },
    "language": {
      "type": "string",
      "enum": ["typescript", "python", "java", "go", "rust", "csharp", "kotlin", "swift"]
    },
    "context": {
      "type": "object",
      "properties": {
        "module_name":       { "type": "string" },
        "domain":            { "type": "string" },
        "security_boundary": { "type": "boolean", "default": false }
      }
    },
    "analysis_depth": {
      "type": "string",
      "enum": ["quick", "standard", "deep"],
      "default": "standard"
    }
  },
  "required": ["before_code", "after_code", "language"]
}
```

## Required Context

- Prior `change-impact-analyzer` output for the same file (optional — provides `module_name` and `security_boundary` for `context` if not passed directly).
- If `context.security_boundary = true`, `security-review` is force-added to the orchestrator's downstream skill queue regardless of `security_signals` content.
- No code execution environment required — this skill performs purely static analysis on code text.

## Execution Logic

```
Step 1 — Parse both versions syntactically
  Apply language-specific pattern matching to before_code and after_code.
  Identify top-level units: functions, methods, classes, exported constants, arrow functions.
  Build symbol tables: name → { start_line, end_line, signature_hash, body_hash }.
  Diff symbol tables: classify each unit as added | removed | modified | unchanged.
  Output: symbol_diff { added[], removed[], modified[] }

Step 2 — Identify structural changes
  For each symbol in symbol_diff.modified:
    Compare signatures: parameter names/types, return type, access modifiers, decorators/annotations.
    Flag signature changes as contract_change candidates.
    Flag body-only changes (same signature_hash, different body_hash) as logic_change candidates.
  For each symbol in symbol_diff.removed:
    Emit contract_change entry with severity: critical.
  Output: structural_changes[]

Step 3 — Extract control flow changes  [SKIPPED when analysis_depth = "quick"]
  For each modified function body:
    Identify conditional branches: if/else, switch/case, ternary, try/catch, guard clauses, early returns.
    Compare before vs. after branch conditions and outcomes.
    Flag: new branches added, branches removed, condition logic inverted, error path changed.
  Output: control_flow_diff[] per modified function

Step 4 — Detect security-relevant pattern changes
  Scan both versions for security-sensitive patterns in four categories:
    auth_check:  isAuthenticated, hasRole, authorize, @RequiresAuth, jwt.verify,
                 session guards, permission middleware, @PreAuthorize, checkPermission
    null_guard:  null/undefined checks before object access, Optional.get(), non-null assertions
    data_access: raw SQL string concatenation, ORM query builders, fs.read/write/unlink,
                 subprocess.run, exec, eval, __import__, Dynamic import
    crypto:      bcrypt/argon2/pbkdf2 calls, AES/RSA encrypt/decrypt, random token generation,
                 crypto.createHash, ssl/tls configuration

  For each detected pattern: compare before and after; determine: added | removed | weakened | strengthened.
    weakened:     reduced scope of check (e.g., role list narrowed, null check removed from one branch)
    removed:      pattern present in before_code, absent in after_code
  Emit security_signal entry for any removed or weakened detection.
  If context.security_boundary = true: always emit at least one security_signal entry (info level).
  Output: security_signals[]

Step 5 — Build contract diff  [SKIPPED when analysis_depth = "quick"]
  For each function with contract_change or logic_change in structural_changes:
    Before/after parameter list: count, names, types, optional/required status.
    Before/after return type and set of possible return values (union types, nullable).
    Before/after declared thrown exceptions or error types.
    Before/after documented preconditions (from JSDoc @param, Python docstrings, Java @throws).
  Output: contract_diff { parameters, return_type, thrown_exceptions, preconditions }

Step 6 — Identify test invalidation reasons  [SKIPPED when analysis_depth = "quick"]
  For each behavioral change in semantic_changes (built from Steps 2–5):
    return type changed       → "Return type changed from {old} to {new}: assertions on {old} are invalid"
    branch removed            → "Branch removed: tests covering {condition} no longer exercise live code"
    exception type changed    → "Exception type changed from {old} to {new}: expect({old}) assertions will fail"
    null guard removed        → "Null guard removed at {location}: tests passing null may now throw unexpected errors"
    auth check removed        → "Auth check removed at {location}: rejection tests may now pass incorrectly"
    parameter type changed    → "Parameter type changed from {old} to {new}: type-based test fixtures are invalid"
  Output: test_invalidation_reasons[]

Step 7 — Assemble output and emit feedback
  Combine all intermediate outputs into semantic_changes[]:
    change_type drawn from symbol_diff + structural_changes + security_signals
    severity assignment:
      security_boundary_change  → critical
      contract_change (removal) → critical
      contract_change (modify)  → warning
      data_access_change        → warning (critical if auth-adjacent)
      logic_change              → warning (info for additive-only new branch)
      null_safety_change        → warning
      error_handling_change     → info

  Compose summary: 2–3 sentences describing net behavioral impact referencing specific
  function names and change types.

  Emit feedback:
    IF security_signals contains removed|weakened entries OR context.security_boundary = true:
      → { type: "backpropagate", from_skill: "semantic-diff-analyzer",
          target_skill: "security-review", reason: "security_boundary_changed",
          evidence: { security_signals_count: N } }
    IF contract_diff shows parameter or return_type changes:
      → { type: "backpropagate", from_skill: "semantic-diff-analyzer",
          target_skill: "test-generator", reason: "contract_changed",
          evidence: { test_invalidation_reasons: [...] } }
  Output: full skill output
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `semantic_changes` | `array[object]` | Detected behavioral changes: `change_type`, `description`, `severity`, `location` |
| `contract_diff` | `object` | Before/after diff of parameters, return type, thrown exceptions, preconditions |
| `security_signals` | `array[object]` | Security pattern changes: `pattern_type`, `change`, `location`, `severity` |
| `test_invalidation_reasons` | `array[string]` | Human-readable reasons why existing test assertions may be invalid |
| `summary` | `string` | 2–3 sentence behavioral impact summary referencing specific changed functions |
| `metrics` | `object` | **REQUIRED.** Execution metrics |
| `feedback` | `array[object]` | **REQUIRED.** Backpropagation entries for `security-review` and `test-generator` |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "semantic_changes": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "change_type": {
            "type": "string",
            "enum": ["logic_change", "contract_change", "security_boundary_change",
                     "null_safety_change", "error_handling_change", "data_access_change"]
          },
          "description": { "type": "string" },
          "severity":    { "type": "string", "enum": ["info", "warning", "critical"] },
          "location":    { "type": "string" }
        },
        "required": ["change_type", "description", "severity", "location"]
      }
    },
    "contract_diff": {
      "type": "object",
      "properties": {
        "parameters": {
          "type": "object",
          "properties": {
            "before": { "type": "array", "items": { "type": "object" } },
            "after":  { "type": "array", "items": { "type": "object" } }
          },
          "required": ["before", "after"]
        },
        "return_type": {
          "type": "object",
          "properties": {
            "before": { "type": "string" },
            "after":  { "type": "string" }
          },
          "required": ["before", "after"]
        },
        "thrown_exceptions": {
          "type": "object",
          "properties": {
            "before": { "type": "array", "items": { "type": "string" } },
            "after":  { "type": "array", "items": { "type": "string" } }
          },
          "required": ["before", "after"]
        },
        "preconditions": {
          "type": "object",
          "properties": {
            "before": { "type": "array", "items": { "type": "string" } },
            "after":  { "type": "array", "items": { "type": "string" } }
          },
          "required": ["before", "after"]
        }
      },
      "required": ["parameters", "return_type", "thrown_exceptions", "preconditions"]
    },
    "security_signals": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "pattern_type": { "type": "string", "enum": ["auth_check", "null_guard", "data_access", "crypto"] },
          "change":       { "type": "string", "enum": ["added", "removed", "weakened", "strengthened"] },
          "location":     { "type": "string" },
          "severity":     { "type": "string", "enum": ["info", "warning", "critical"] }
        },
        "required": ["pattern_type", "change", "location", "severity"]
      }
    },
    "test_invalidation_reasons": {
      "type": "array",
      "items": { "type": "string" }
    },
    "summary": { "type": "string", "minLength": 1 },
    "metrics":  { "$ref": "#/$defs/metrics" },
    "feedback": { "type": "array", "items": { "$ref": "#/$defs/feedback_entry" } }
  },
  "required": ["semantic_changes", "contract_diff", "security_signals",
               "test_invalidation_reasons", "summary", "metrics", "feedback"],
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

- This skill is **read-only** — it never modifies code, state files, or any artifact.
- `security-review` MUST be added to the orchestrator's downstream skill queue whenever `security_signals` contains any `removed` or `weakened` entry, regardless of `analysis_depth`.
- `test-generator` MUST receive a `backpropagate` feedback entry whenever `contract_diff` shows parameter or return type changes.
- When `analysis_depth = "quick"`: Steps 3, 5, and 6 are unconditionally skipped; `contract_diff` is returned as an empty object with empty before/after arrays; `test_invalidation_reasons` is returned as an empty array.
- **Exception**: when `analysis_depth = "quick"` AND `context.security_boundary = true`, Step 4 (security pattern detection) still runs.
- Maximum code input: 2000 lines total (before + after combined). Larger diffs must be chunked by function or class by the caller.
- The skill MUST NOT attempt to execute, compile, or eval any portion of the code under analysis.
- If `context.security_boundary = true`, a `backpropagate` to `security-review` is always emitted, even if `security_signals` is empty.
- `severity` for a `contract_change` involving a **removed** public symbol is always `critical`, never downgraded.

## Security Considerations

- Code passed as `before_code` and `after_code` is treated as untrusted text — it is never executed, eval'd, or passed to a shell or subprocess.
- Strip credential-like strings (tokens, API keys, passwords, secrets matching common patterns) from `security_signals.location` values before including in output.
- Do not echo raw `before_code` or `after_code` in output fields — emit only symbol names and line ranges in all output fields.
- The `context.security_boundary` flag must be validated as a strict boolean; reject string `"true"` or `1` as invalid to prevent bypass.
- Log only symbol names and line numbers to behavioral telemetry — never log raw code content.

## Token Optimization

- Pass only the changed functions/methods as `before_code`/`after_code` when `change-impact-analyzer` has already isolated the changed symbols — not full files.
- For `analysis_depth = "quick"`: Steps 3, 5, and 6 are skipped, reducing token consumption by ~40%.
- Return `summary` as the primary signal to downstream skills; pass full `semantic_changes` array only when the orchestrator explicitly requests deep context.
- Do not re-emit `before_code` or `after_code` in any output field — inputs are consumed and referenced by location only.
- Omit `contract_diff` fields with identical `before` and `after` values from the output to reduce noise.

## Quality Checklist

- [ ] `before_code` and `after_code` validated as non-empty strings before execution begins
- [ ] `language` validated against allowed enum before symbol parsing
- [ ] `symbol_diff` correctly classifies all symbols as `added | removed | modified | unchanged`
- [ ] Security patterns scanned using language-appropriate identifier sets for all four categories
- [ ] `contract_diff` covers all four sub-fields: `parameters`, `return_type`, `thrown_exceptions`, `preconditions`
- [ ] `feedback` emitted to `security-review` when `security_signals` has `removed`/`weakened` entries
- [ ] `feedback` emitted to `test-generator` when `contract_diff` shows type changes
- [ ] `summary` references at least one specific function name and change type
- [ ] `analysis_depth = "quick"` correctly skips Steps 3, 5, 6 and still runs Step 4

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| `before_code` or `after_code` is missing | Reject: `{"error": "MISSING_CODE_INPUT", "missing": ["before_code"]}` |
| `language` not in allowed enum | Reject: `{"error": "UNSUPPORTED_LANGUAGE", "provided": "<value>", "supported": [...]}` |
| Combined code exceeds 2000 lines | Reject: `{"error": "INPUT_TOO_LARGE", "max_lines": 2000, "guidance": "chunk by function"}` |
| No parseable symbols found in either version | Return empty `semantic_changes: []`, emit `info` feedback: "No parseable symbols detected" |
| `analysis_depth = "quick"` + `security_boundary = true` | Run Step 4 regardless; skip Steps 3, 5, 6 only |
| `context` field present but `security_boundary` is non-boolean | Reject: `{"error": "INVALID_SECURITY_BOUNDARY", "expected": "boolean"}` |

## 12. Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Behavior |
|------|---------|---------|----------|
| Critical security signal detected | Any `security_signals` entry has `severity: "critical"` | 3600s | Pause pipeline; present full security signal list for human review before `security-review` executes |
| Breaking contract change on public API | `contract_diff` shows return type or parameter removal on a symbol in `symbol_diff.removed` | 3600s | Pause; present contract diff and list of downstream consumers for approval before `test-generator` re-runs |

Gate behavior: `pause` — pipeline halts, approval request emitted, execution resumes only on explicit approval. No auto-continue on timeout.

## 13. Skill Composition

`semantic-diff-analyzer` is invoked by the orchestrator after `change-impact-analyzer` on `code.changed` events, when `analysis_depth != "quick"`:

```yaml
composes:
  - skill: semantic-diff-analyzer
    version: "^1.0.0"
    input_map:
      before_code:    "event.before_content"
      after_code:     "event.after_content"
      language:       "session.language"
      context:
        module_name:       "change_impact.module_impact[0].module"
        security_boundary: "change_impact.security_impact.boundaries_crossed[0]"
      analysis_depth: "session.analysis_depth"
    output_map:
      semantic_changes:          "state.semantic_diff.changes"
      security_signals:          "state.semantic_diff.security_signals"
      contract_diff:             "state.semantic_diff.contract_diff"
      test_invalidation_reasons: "state.semantic_diff.test_invalidation_reasons"
```

Downstream consumption:

```yaml
  - skill: security-review
    version: "^1.0.0"
    condition: "state.semantic_diff.security_signals.length > 0"
    input_map:
      semantic_signals: "state.semantic_diff.security_signals"

  - skill: test-generator
    version: "^1.0.0"
    condition: "feedback[?reason=='contract_changed']"
    input_map:
      invalidation_reasons: "state.semantic_diff.test_invalidation_reasons"
      contract_diff:        "state.semantic_diff.contract_diff"
```

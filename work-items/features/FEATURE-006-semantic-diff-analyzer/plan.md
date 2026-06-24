# FEATURE-006 — Implementation Plan: Semantic Diff Analyzer

## Target Skills / Artifacts

| Skill / Artifact | Action | Notes |
|---|---|---|
| `semantic-diff-analyzer/SKILL.md` (SKL-066) | Create | New skill — behavior-level code diff analysis |
| `skills/registry.json` | Update | Register SKL-066 with `status: draft` |
| `skills/index.yaml` | Update | Add index entry for SKL-066 |

---

## §1 — Skill Purpose and Pipeline Position

`semantic-diff-analyzer` sits between `change-impact-analyzer` and the downstream quality skills in the ASE-OS pipeline. It enriches the file/module-level impact data from `change-impact-analyzer` with behavioral-level context — what logic changed, what contracts changed, and what security patterns changed.

Pipeline position:

```
code.changed event
  → change-impact-analyzer     (file/module level: what files changed)
  → semantic-diff-analyzer     (behavior level: how behavior changed)  ← THIS SKILL
  → security-review            (when security_signals contains removed|weakened)
  → test-generator             (when contract_diff shows type changes)
  → clean-code-review          (always, with semantic context enrichment)
```

The skill is **skipped** by the orchestrator when `analysis_depth = "quick"` — this flag is set for non-behavioral changes such as formatting, comment updates, or documentation edits.

---

## §2 — Input Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "before_code": {
      "type": "string",
      "minLength": 1,
      "description": "Original code snippet or full file content before the change"
    },
    "after_code": {
      "type": "string",
      "minLength": 1,
      "description": "Modified code snippet or full file content after the change"
    },
    "language": {
      "type": "string",
      "enum": ["typescript", "python", "java", "go", "rust", "csharp", "kotlin", "swift"],
      "description": "Programming language of the code under analysis"
    },
    "context": {
      "type": "object",
      "properties": {
        "module_name": { "type": "string" },
        "domain": { "type": "string" },
        "security_boundary": { "type": "boolean", "default": false }
      }
    },
    "analysis_depth": {
      "type": "string",
      "enum": ["quick", "standard", "deep"],
      "default": "standard",
      "description": "quick: steps 1-2+4+7 only. standard: all steps. deep: all steps with expanded pattern library"
    }
  },
  "required": ["before_code", "after_code", "language"]
}
```

---

## §3 — Execution Steps Specification

### Step 1 — Parse Both Versions Syntactically

Apply language-specific pattern matching to `before_code` and `after_code`:
- Identify top-level units: functions, methods, classes, exported constants, arrow functions
- Build symbol tables: `name → { start_line, end_line, signature_hash, body_hash }`
- Diff symbol tables: classify each unit as `added | removed | modified | unchanged`

Output: `symbol_diff { added[], removed[], modified[] }`

### Step 2 — Identify Structural Changes

For each symbol in `symbol_diff.modified`:
- Compare function signatures: parameter names, types, return type, access modifiers, decorators
- Flag signature changes as `contract_change` candidates
- Flag body-only changes (same `signature_hash`, different `body_hash`) as `logic_change` candidates
- Flag removals as `contract_change` entries with `severity: critical`

Output: `structural_changes[]`

### Step 3 — Extract Control Flow Changes *(skipped when `analysis_depth = "quick"`)*

For each modified function body:
- Identify conditional branches: `if/else`, `switch/case`, ternary expressions, `try/catch`, guard clauses
- Compare before vs. after branch conditions and outcomes
- Flag: new branches added, branches removed, condition logic inverted, error path changed, loop bounds changed

Output: `control_flow_diff[]` per modified function

### Step 4 — Detect Security-Relevant Pattern Changes

Scan both versions for security-sensitive patterns across all four categories:
- **Auth checks**: `isAuthenticated`, `hasRole`, `authorize`, `@RequiresAuth`, `jwt.verify`, session guard patterns, permission middleware
- **Null/undefined guards**: null checks before object access, optional chaining removal, non-null assertions added
- **Data access**: raw SQL string concatenation, ORM query builders, file system access (`fs.read`, `open`), `exec`, `eval`, `subprocess`
- **Crypto**: hashing calls (`bcrypt`, `sha256`), encryption/decryption, key derivation (`pbkdf2`, `argon2`), token generation

For each pattern: determine if `added | removed | weakened | strengthened`.
Emit a `security_signal` entry for any `removed` or `weakened` detection.

Output: `security_signals[]`

### Step 5 — Build Contract Diff *(skipped when `analysis_depth = "quick"`)*

For each function with `contract_change` or `logic_change`:
- Before/after: parameter count, types, optional vs. required status
- Before/after: return type and set of possible return values
- Before/after: declared thrown exceptions / error types
- Before/after: documented preconditions (from JSDoc `@param`, Python docstrings, Java `@throws`)

Output: `contract_diff { parameters, return_type, thrown_exceptions, preconditions }`

### Step 6 — Identify Test Invalidation Reasons *(skipped when `analysis_depth = "quick"`)*

For each behavioral change detected in prior steps, construct a human-readable invalidation reason:
- Return type changed → `"Return type changed: tests asserting on {old_type} are now invalid"`
- Branch removed → `"Branch removed: tests covering {condition} no longer exercise live code"`
- Exception type changed → `"Exception type changed: tests expecting {old_exception} will fail"`
- Null guard removed → `"Null guard removed: tests passing null may now throw unexpected errors"`
- Auth check removed → `"Auth check removed: security tests asserting on rejection may now pass incorrectly"`

Output: `test_invalidation_reasons[]`

### Step 7 — Assemble Output and Emit Feedback

Combine all intermediate outputs into the final `semantic_changes[]` array.
Assign severity per `change_type`:
- `security_boundary_change` → `critical`
- `contract_change`, `data_access_change` → `warning`
- `logic_change`, `null_safety_change` → `warning` (or `info` for additive-only changes)
- `error_handling_change` → `info`

Compose `summary`: 2–3 sentences describing the net behavioral impact.

Emit feedback:
- IF `security_signals` contains `removed` or `weakened`: `backpropagate` → `security-review`
- IF `contract_diff` shows parameter or return type changes: `backpropagate` → `test-generator`

Output: full skill output

---

## §4 — Output Schema

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
          "severity": { "type": "string", "enum": ["info", "warning", "critical"] },
          "location": { "type": "string" }
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
          }
        },
        "return_type": {
          "type": "object",
          "properties": {
            "before": { "type": "string" },
            "after":  { "type": "string" }
          }
        },
        "thrown_exceptions": {
          "type": "object",
          "properties": {
            "before": { "type": "array", "items": { "type": "string" } },
            "after":  { "type": "array", "items": { "type": "string" } }
          }
        },
        "preconditions": {
          "type": "object",
          "properties": {
            "before": { "type": "array", "items": { "type": "string" } },
            "after":  { "type": "array", "items": { "type": "string" } }
          }
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
          "severity":     { "type": "string", "enum": ["warning", "critical"] }
        },
        "required": ["pattern_type", "change", "location", "severity"]
      }
    },
    "test_invalidation_reasons": {
      "type": "array",
      "items": { "type": "string" }
    },
    "summary":  { "type": "string", "minLength": 1 },
    "metrics":  { "$ref": "#/$defs/metrics" },
    "feedback": { "type": "array", "items": { "$ref": "#/$defs/feedback_entry" } }
  },
  "required": ["semantic_changes", "contract_diff", "security_signals", "test_invalidation_reasons", "summary", "metrics", "feedback"]
}
```

---

## §5 — Feedback Routes

| Condition | Feedback Type | Target Skill | Reason |
|---|---|---|---|
| `security_signals` contains any `removed` or `weakened` entry | `backpropagate` | `security-review` | `security_boundary_changed` |
| `contract_diff` shows parameter or return type changes | `backpropagate` | `test-generator` | `contract_changed` |

---

## §6 — Registry Entry

SKL-066 must be added to `skills/registry.json`:
```json
{
  "id": "SKL-066",
  "name": "semantic-diff-analyzer",
  "version": "1.0.0",
  "domain": "architecture",
  "status": "draft",
  "phase": 7,
  "req_id": "N21"
}
```

`scripts/validate-skills.sh` must pass (exit 0) after registration.

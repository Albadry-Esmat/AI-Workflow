---
name: drift-detector
version: 1.0.0
domain: quality
description: 'Use to detect drift between the living spec artifact (artifacts/spec-latest.md from FEATURE-007) and the current working tree. Identifies additions (code with no spec), gaps (spec with no implementation), and changed module signatures. Produces a drift score (0–100) and writes artifacts/drift-report-<timestamp>.md. Fails if drift score < 70 (configurable). Can run inline at pipeline end or as a scheduled CI check. Triggers on: "detect drift", "spec vs code drift", "is the code in sync with the spec", "living spec check", "drift report".'
author: system
---

## Purpose

Detect structural divergence between the living spec artifact produced by FEATURE-007 (`artifacts/spec-latest.md`) and the current working tree. Over time, implementations evolve — new modules are added that have no corresponding requirement, or requirements decay into code-orphaned specs with no matching implementation. This skill makes drift visible and measurable.

The drift report classifies findings into three categories:

| Category | Description |
|----------|-------------|
| **Additions** | Code entities (modules, exported functions, files) that have no corresponding requirement or spec module entry. Code exists but spec does not mention it. |
| **Gaps** | Spec module entries or requirements that have no matching code entity in the working tree. Spec exists but code does not. |
| **Signature changes** | Spec entries whose declared interface (function signature, API contract) differs from what is found in the code. |

The drift score (0–100, higher is better) measures how closely the implementation matches the spec. A score below the configured threshold (default 70) fails CI.

This skill was introduced in FEATURE-015 (Living Spec / Drift Detection) as SKL-115. It requires FEATURE-007 (spec-latest.md) to be present.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `spec_artifact_path` | `string` | No | Path to spec artifact. Defaults to `artifacts/spec-latest.md`. Must exist. |
| `working_tree_map` | `object` | No | Pre-built working tree map from `state-manager` (SKL-021). If absent, the skill reads the working tree directly. |
| `drift_threshold` | `integer` | No | Minimum drift score to pass. Default: 70. Range: [0, 100]. |
| `session_id` | `string` | Yes | UUID v4 of the active pipeline session. |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["session_id"],
  "properties": {
    "spec_artifact_path": { "type": "string", "default": "artifacts/spec-latest.md" },
    "working_tree_map": { "type": "object" },
    "drift_threshold": { "type": "integer", "minimum": 0, "maximum": 100, "default": 70 },
    "session_id": { "type": "string", "format": "uuid" }
  }
}
```

## Required Context

- `artifacts/spec-latest.md` (or the path specified in `spec_artifact_path`). This file is written by the orchestrator in FEATURE-007. If absent, the skill returns a hard error.
- Working tree map from `state-manager` (SKL-021) for module names, exported functions, and file paths. If `working_tree_map` is not provided, the skill derives a structural summary from the spec artifact itself and produces a partial drift report (spec-vs-spec-schema comparison only). A `WARN: no_working_tree_map` is emitted.
- `session_id` from orchestrator session context.

## Execution Logic

```
Step 1 — Load spec artifact
  Read spec_artifact_path (default: artifacts/spec-latest.md).
  If file does not exist:
    Return hard error: { "error": "SPEC_ARTIFACT_NOT_FOUND",
      "hint": "Run the full pipeline first to generate artifacts/spec-latest.md (FEATURE-007)" }
  Parse spec artifact sections:
    - ## Modules section: extract module_names[], module_responsibilities[]
    - ## Requirements section: extract req_ids[], req_statements[]
    - ## Architecture section: extract adr_ids[], technology_decisions[]
    - ## Interface Contracts section (if present): extract function_signatures{}
  spec_modules   = extracted module names list
  spec_functions = extracted function signatures (may be empty if section absent)
  spec_req_ids   = extracted requirement IDs

Step 2 — Load working tree map
  If working_tree_map provided:
    tree_modules   = working_tree_map.modules[] (names)
    tree_functions = working_tree_map.exports{} (module → exported function signatures)
    tree_files     = working_tree_map.files[] (relative paths)
  Else:
    emit WARN: no_working_tree_map
    tree_modules   = [] (empty — only spec-level checks possible)
    tree_functions = {}
    tree_files     = []

Step 3 — Compute additions (code with no spec)
  additions[] = tree_modules items NOT in spec_modules
                + tree_functions items where function module NOT in spec_modules
  For each addition:
    { type: "addition", entity: <name>, entity_type: "module" | "function",
      message: "<entity> exists in code but is not mentioned in the spec",
      severity: "warning" }

Step 4 — Compute gaps (spec with no code)
  gaps[] = spec_modules items NOT in tree_modules (when working_tree_map available)
  For each gap:
    { type: "gap", entity: <module_name>, entity_type: "module",
      message: "Module '<module_name>' is specified but not found in the working tree",
      severity: "error" }
  req_gaps[] = spec_req_ids where no task or test covers the req_id AND
               req_id has no corresponding code module
  For each req_gap:
    { type: "gap", entity: <req_id>, entity_type: "requirement",
      message: "Requirement <req_id> is in the spec but has no implementation evidence",
      severity: "warning" }

Step 5 — Compute signature changes (when function signatures available)
  signature_changes[] = spec_functions entries where the corresponding tree_functions entry
    exists but the signatures differ (parameter count, return type token, or function name)
  For each change:
    { type: "signature_change", entity: <function_name>, entity_type: "function",
      spec_signature: <string>, code_signature: <string>,
      message: "Function '<function_name>' signature differs between spec and implementation",
      severity: "error" }

Step 6 — Compute drift score
  all_spec_entities = spec_modules.length + spec_req_ids.length
  If all_spec_entities == 0:
    drift_score = 100  (nothing to drift from)
    emit INFO: no_spec_entities_found
  Else:
    error_count   = count of findings where severity == "error"
    warning_count = count of findings where severity == "warning"
    total_findings = error_count + warning_count
    penalty = min(100, (error_count * 5) + (warning_count * 2))
    drift_score = max(0, 100 - penalty)
  drift_score clamped to [0, 100].

  drift_status:
    If drift_score >= drift_threshold: "pass"
    Else:                              "fail"

Step 7 — Write artifacts
  Timestamp: ISO 8601 with colons as hyphens.
  If artifacts/ does not exist: create silently.

  Write artifacts/drift-report-<timestamp>.md:
    # Drift Report — <session_id>
    **Generated by:** drift-detector v1.0.0
    **Timestamp:** <ISO8601>
    **Drift score:** <drift_score>/100 (<drift_status>)
    **Threshold:** <drift_threshold>

    ## Summary
    | Category          | Count |
    |-------------------|-------|
    | Additions         | <N>   |
    | Gaps              | <N>   |
    | Signature Changes | <N>   |

    ## Additions (code with no spec entry)
    (bulleted list: entity_type — entity — message)
    (If none: "No unspecified code entities found.")

    ## Gaps (spec with no implementation)
    (bulleted list: entity_type — entity — message)
    (If none: "All spec entities have implementation evidence.")

    ## Signature Changes
    (table: Function | Spec Signature | Code Signature)
    (If none: "No signature changes detected.")

  Write artifacts/drift-report-<timestamp>.json:
    { run_id, skill, skill_version, timestamp, drift_score, drift_status, drift_threshold,
      additions[], gaps[], signature_changes[] }
  Update symlink artifacts/drift-report-latest.json → artifacts/drift-report-<timestamp>.json.
  Output: md_artifact_path, json_artifact_path

Step 8 — Emit telemetry and return
  Emit based on drift_status:
    "pass" → INFO: drift_check_passed { drift_score, drift_threshold }
    "fail" → WARN: drift_check_failed { drift_score, drift_threshold, additions_count,
               gaps_count, signature_changes_count }
  Return complete output object.
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `drift_score` | `integer` | 0–100. Higher = more aligned with spec. |
| `drift_status` | `string` | `"pass"` or `"fail"`. Fail when `drift_score < drift_threshold`. |
| `additions` | `array[object]` | Code entities with no spec entry. Fields: `type`, `entity`, `entity_type`, `message`, `severity`. |
| `gaps` | `array[object]` | Spec entries with no code evidence. Fields: `type`, `entity`, `entity_type`, `message`, `severity`. |
| `signature_changes` | `array[object]` | Interface signature mismatches. Fields: `type`, `entity`, `spec_signature`, `code_signature`, `message`, `severity`. |
| `md_artifact_path` | `string` | Relative path to written Markdown drift report. |
| `json_artifact_path` | `string` | Relative path to written JSON drift report. |
| `metrics` | `object` | `tokens_in`, `tokens_out`, `duration_ms`, `items_produced`, `version`. |

## Rules & Constraints

1. **Spec artifact is mandatory.** If `artifacts/spec-latest.md` (or the configured path) does not exist, the skill MUST return a hard error. It cannot run without a spec to compare against.
2. **drift_threshold default is 70.** This means up to 14 warning-class findings (2 points each) or 6 error-class findings (5 points each) are tolerated before CI fails.
3. **Partial report when no working_tree_map.** When `working_tree_map` is not provided, the skill produces a spec-only report (checking spec internal consistency) with all addition findings empty and `WARN: no_working_tree_map`. The drift score is calculated from gaps only.
4. **Severity model.** `gap` with entity_type `module` = severity `error`. `addition` = severity `warning`. `signature_change` = severity `error`. `gap` with entity_type `requirement` = severity `warning`.
5. **Score penalty cap.** The maximum penalty per finding category is 100. The formula never produces a score below 0.
6. **Artifact path is configurable but directory is not.** The `spec_artifact_path` input may point to any path but MUST be inside the project root. Paths outside the project root are rejected with `WARN: unsafe_spec_path` and the default path is used instead.
7. **Read-only.** This skill MUST NOT modify `spec-latest.md`, the working tree, or any upstream artifact.

## Security Considerations

- **No code execution.** The skill inspects source code structurally (module names, exported symbol names, function signatures). It MUST NOT execute, import, or evaluate any code found in the working tree.
- **Path traversal prevention.** `spec_artifact_path` MUST be validated against path traversal patterns (`../`, absolute paths outside project root). Reject and use default on violation.
- **PII stripping.** Requirement statements included in gap entries are truncated to 100 characters and PII-stripped before writing to artifacts.

## Token Optimization

- **Parse spec sections lazily.** Only parse the `## Modules` section for working tree comparison. Load `## Requirements` only for req_gap computation. Skip other sections unless explicitly needed.
- **Limit working_tree_map scope.** When a working_tree_map is provided, use only `modules[]` and `exports{}` — ignore raw file content.
- **Truncate long signature strings.** In `signature_changes[]`, truncate spec_signature and code_signature to 200 characters each.

## Quality Checklist

- [ ] Spec artifact loaded without error
- [ ] `drift_score` is in range [0, 100]
- [ ] `drift_status` is `"pass"` when `drift_score >= drift_threshold`
- [ ] `drift_status` is `"fail"` when `drift_score < drift_threshold`
- [ ] All additions have `severity: "warning"`
- [ ] Module gaps have `severity: "error"`
- [ ] Signature changes have `severity: "error"`
- [ ] JSON artifact parses without error
- [ ] `artifacts/drift-report-latest.json` symlink updated
- [ ] Markdown artifact contains all four sections (Summary, Additions, Gaps, Signature Changes)
- [ ] `WARN: no_working_tree_map` emitted when working_tree_map absent

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| `spec_artifact_path` does not exist | Hard error: `{"error": "SPEC_ARTIFACT_NOT_FOUND"}`. Halt. |
| `working_tree_map` absent | Partial report (spec-only). Emit `WARN: no_working_tree_map`. Continue. |
| Spec artifact is empty or unparseable | Emit `WARN: spec_parse_failed`. Return `drift_score: 0`, `drift_status: "fail"`. Write minimal report. |
| `drift_threshold` out of range [0, 100] | Clamp to range. Emit `WARN: threshold_clamped`. |
| JSON serialization failure | Retry once. Write Markdown only if retry fails. |
| Unsafe `spec_artifact_path` (path traversal) | Reject. Use default `artifacts/spec-latest.md`. Emit `WARN: unsafe_spec_path`. |

## Human-in-the-Loop Gates

This skill has no HITL gate. The drift report is advisory. The CI failure behavior (when `drift_status: "fail"`) is enforced by the CI job configuration, not by a pipeline gate.

For inline full-pipeline use, a `drift_status: "fail"` emits `WARN` but does NOT block the pipeline — the team is informed but execution continues. For strict enforcement, configure the CI template to fail on `drift_score < threshold`.

| Gate | Trigger | Timeout | Behavior |
|------|---------|---------|----------|
| None | — | — | Fully automated. `drift_status: "fail"` emits warn only; does not block. |

## Skill Composition

`drift-detector` v1.0.0 runs at the end of the full pipeline (after `phase-8b-audit`) and optionally as a scheduled CI check independent of the pipeline.

```yaml
composes:
  - skill: drift-detector
    version: "^1.0.0"
    triggered_by: implementation-completeness-auditor
    input_map:
      spec_artifact_path: "artifacts/spec-latest.md"
      working_tree_map:   "system_state.code_map"
      drift_threshold:    "pipeline_config.drift_threshold"
      session_id:         "session.id"
    output_map:
      drift_score:         "drift_score"
      drift_status:        "drift_status"
      json_artifact_path:  "drift_report_artifact_path"

ci_job_template:
  name: "Drift Detection (scheduled)"
  schedule: "0 0 * * *"   # daily at midnight
  steps:
    - run: "invoke drift-detector with spec_artifact_path=artifacts/spec-latest.md drift_threshold=70"
    - fail_if: "drift_status === 'fail'"

downstream:
  - None (terminal skill in main pipeline)

upstream:
  - orchestrator  # provides spec-latest.md (FEATURE-007)
  - state-manager # provides working_tree_map (optional)
```

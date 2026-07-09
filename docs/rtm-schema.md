# RTM Artifact Schema — Requirements Traceability Matrix

**Version:** 1.0.0 | **Last updated:** 2026-07-09 | **Produced by:** `traceability-matrix` (SKL-111)

The `traceability-matrix` skill writes two durable artifacts to the `artifacts/` directory after every full-pipeline run:

| File | Purpose |
|------|---------|
| `artifacts/rtm-<ISO-timestamp>.md` | Human-readable matrix report |
| `artifacts/rtm-<ISO-timestamp>.json` | Machine-readable JSON consumed by `implementation-completeness-auditor` |
| `artifacts/rtm-latest.json` | Stable symlink → most recent JSON artifact (always updated) |

---

## ID Formats

All IDs in RTM artifacts use strict format patterns. Non-conforming IDs are excluded from linkage
and a `WARN: id_format_violation` event is emitted.

| ID Type | Pattern | Example |
|---------|---------|---------|
| Requirement | `^REQ-[A-Z]+-\d{3}$` | `REQ-USR-001` |
| ADR | `^ADR-\d{3}$` | `ADR-001` |
| Test Case | `^TEST-\d{3}$` | `TEST-042` |
| Task | `^TASK-\d{4}$` | `TASK-0023` |

---

## JSON Artifact Schema

The JSON artifact (`artifacts/rtm-<timestamp>.json`) is the canonical machine-readable RTM. It is the
primary input to `implementation-completeness-auditor` via `rtm_artifact_path`.

### Top-level fields

```json
{
  "run_id":          "<UUID v4 — pipeline session_id>",
  "skill":           "traceability-matrix",
  "skill_version":   "1.0.0",
  "timestamp":       "<ISO 8601 datetime, e.g. 2026-07-09T10:00:00Z>",
  "coverage_scores": { ... },
  "rtm":             [ ... ],
  "uncovered_reqs":  [ "<req_id>", ... ],
  "unimplemented_reqs": [ "<req_id>", ... ]
}
```

### `coverage_scores` object

| Field | Type | Range | Formula |
|-------|------|-------|---------|
| `test_coverage_pct` | number | [0, 100] | `(covered_reqs / total_reqs) × 100` |
| `task_coverage_pct` | number | [0, 100] | `(implemented_reqs / total_reqs) × 100` |
| `adr_coverage_pct` | number | [0, 100] | `(reqs_with_adr / total_reqs) × 100` |
| `overall_rtm_score` | number | [0, 100] | `(test × 0.5) + (task × 0.4) + (adr × 0.1)` |

All values rounded to 2 decimal places. `overall_rtm_score` clamped to [0, 100].

**Threshold:** `overall_rtm_score < 60` triggers `WARN: low_rtm_coverage` and a `backpropagate`
feedback entry to `test-generator`.

### `rtm` array — row schema

Each element of `rtm[]` represents one requirement. Rows are sorted by severity tier (worst first):

| Tier | coverage_status | implementation_status |
|------|-----------------|----------------------|
| 1 (highest severity) | UNCOVERED | UNIMPLEMENTED |
| 2 | UNCOVERED | IMPLEMENTED |
| 3 | COVERED | UNIMPLEMENTED |
| 4 (lowest severity) | COVERED | IMPLEMENTED |

Within each tier, rows are sorted by `req_priority` (critical → high → medium → low) then `req_id`
lexicographically.

```json
{
  "req_id":               "REQ-USR-001",
  "req_type":             "F",
  "req_priority":         "high",
  "req_statement":        "The system shall allow users to register with an email address.",
  "linked_adrs":          ["ADR-001"],
  "linked_tests":         ["TEST-003", "TEST-007"],
  "linked_tasks":         ["TASK-0012"],
  "coverage_status":      "COVERED",
  "implementation_status": "IMPLEMENTED"
}
```

| Field | Type | Values | Description |
|-------|------|--------|-------------|
| `req_id` | string | `REQ-XXX-NNN` | Requirement ID |
| `req_type` | string | `F`, `NF`, `C` | Functional / Non-Functional / Constraint |
| `req_priority` | string | `critical`, `high`, `medium`, `low` | Requirement priority |
| `req_statement` | string | — | PII-stripped requirement statement |
| `linked_adrs` | array[string] | `ADR-NNN` | ADR IDs addressing this requirement |
| `linked_tests` | array[string] | `TEST-NNN` | Test IDs covering this requirement |
| `linked_tasks` | array[string] | `TASK-NNNN` | Task IDs implementing this requirement |
| `coverage_status` | string | `COVERED`, `UNCOVERED` | Has at least one linked test? |
| `implementation_status` | string | `IMPLEMENTED`, `UNIMPLEMENTED` | Has at least one linked task? |

### `uncovered_reqs` and `unimplemented_reqs`

Flat arrays of REQ IDs. Used by `implementation-completeness-auditor` for gap reporting.

```json
"uncovered_reqs":     ["REQ-AUTH-003", "REQ-NOTIF-001"],
"unimplemented_reqs": ["REQ-NOTIF-001"]
```

---

## Markdown Artifact Structure

The Markdown artifact (`artifacts/rtm-<timestamp>.md`) contains four sections:

```
# Requirements Traceability Matrix — <session_id>
...header metadata...

## Coverage Summary
| Metric | Count | Percentage |
...

## Traceability Matrix
| REQ ID | Type | Priority | Statement | ADRs | Tests | Tasks | Test Coverage | Impl Status |
...

## Uncovered Requirements (no test case)
...bullet list of UNCOVERED req_ids with statements...

## Unimplemented Requirements (no task)
...bullet list of UNIMPLEMENTED req_ids with statements...
```

UNCOVERED requirements have a `WARNING:` prefix on the REQ ID cell. UNIMPLEMENTED requirements have
a `WARNING:` prefix on the Impl Status cell.

---

## Linkage Rules

| Dimension | Primary source | Fallback |
|-----------|---------------|---------|
| REQ → ADR | `adr.linked_reqs[]` (explicit) | Token scan of `adr.rationale` and `adr.decision` for exact REQ-XXX-NNN string |
| REQ → TEST | `test_case.coverage_target` (exact REQ ID) | None — no fallback for test linkage |
| REQ → TASK | `task.req_ids[]` (explicit) | Token scan of `task.description` for exact REQ-XXX-NNN string (semantic fallback, clearly marked) |

---

## Backpropagation Rules

The skill emits `feedback[]` entries of type `backpropagate` when coverage thresholds are breached.
The orchestrator uses these to re-invoke upstream skills.

| Rule | Condition | Target skill | Reason |
|------|-----------|-------------|--------|
| A | `uncovered_reqs.length / total_reqs > 0.20` | `test-generator` | > 20% requirements have no test |
| B | `unimplemented_reqs.length / total_reqs > 0.20` | `feature-planning` | > 20% requirements have no task |
| C | `overall_rtm_score < 60` | `test-generator` | Overall RTM score below threshold |

---

## Pagination (large inputs)

For `requirements.length > 500`, the RTM is split into paged artifacts:

```
artifacts/rtm-<timestamp>-page-1.json   ← rtm-latest.json symlink points here
artifacts/rtm-<timestamp>-page-2.json
...
```

Each page includes a `pagination` field:
```json
"pagination": { "page": 1, "total_pages": 3, "total_reqs": 1200 }
```

---

## Integration with `implementation-completeness-auditor`

Pass the JSON artifact path via the optional `rtm_artifact_path` input field:

```json
{
  "requirements":     [ ... ],
  "code_map":         { ... },
  "test_state":       { ... },
  "rtm_artifact_path": "artifacts/rtm-latest.json"
}
```

When `rtm_artifact_path` is provided, the auditor uses the pre-computed `coverage_scores` and
`uncovered_reqs` / `unimplemented_reqs` arrays from the RTM instead of re-deriving them from raw
inputs. This increases accuracy and reduces token cost.

**Canonical resolution order:**
1. `rtm_artifact_path` as supplied (exact path)
2. `artifacts/rtm-latest.json` symlink (if `rtm_artifact_path` not supplied)
3. Re-compute from raw inputs (fallback when neither artifact exists)

---

## Failure Modes

| Condition | Behavior |
|-----------|----------|
| `requirements[]` empty | Hard error — halt, no artifacts written |
| `test_cases[]` empty | All UNCOVERED — write artifacts with 0% test coverage |
| `tasks[]` empty | All UNIMPLEMENTED — write artifacts with 0% task coverage |
| `architecture.adrs[]` absent | `adr_coverage_pct = 0`, continue |
| `requirements.length > 500` | Paginated artifacts, symlink → page 1 |
| Duplicate `req_id` in input | Deduplicate (first wins), emit `WARN: duplicate_req_id` |
| JSON serialization failure | Retry once; write Markdown only if retry fails |

---

## Security Notes

- **PII stripping**: RFC 5322 emails, E.164 phone numbers, and `FirstName LastName` patterns in quoted
  strings are replaced with `[REDACTED]` before any artifact write.
- **Credential detection**: Values matching API key, JWT, or PEM header patterns trigger
  `WARN: credential_in_input` and are redacted in all artifact output.
- **Path safety**: Artifact paths are hardcoded as `artifacts/rtm-<ISO-timestamp>.*`. User-supplied
  inputs (including `session_id`) MUST NOT influence the output directory.

---

## Full JSON Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["run_id", "skill", "skill_version", "timestamp",
               "coverage_scores", "rtm", "uncovered_reqs", "unimplemented_reqs"],
  "properties": {
    "run_id":        { "type": "string", "format": "uuid" },
    "skill":         { "type": "string", "const": "traceability-matrix" },
    "skill_version": { "type": "string" },
    "timestamp":     { "type": "string", "format": "date-time" },
    "coverage_scores": {
      "type": "object",
      "required": ["test_coverage_pct", "task_coverage_pct", "adr_coverage_pct", "overall_rtm_score"],
      "properties": {
        "test_coverage_pct":  { "type": "number", "minimum": 0, "maximum": 100 },
        "task_coverage_pct":  { "type": "number", "minimum": 0, "maximum": 100 },
        "adr_coverage_pct":   { "type": "number", "minimum": 0, "maximum": 100 },
        "overall_rtm_score":  { "type": "number", "minimum": 0, "maximum": 100 }
      }
    },
    "rtm": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["req_id", "req_type", "req_priority", "req_statement",
                     "linked_adrs", "linked_tests", "linked_tasks",
                     "coverage_status", "implementation_status"],
        "properties": {
          "req_id":               { "type": "string", "pattern": "^REQ-[A-Z]+-\\d{3}$" },
          "req_type":             { "type": "string", "enum": ["F", "NF", "C"] },
          "req_priority":         { "type": "string", "enum": ["critical", "high", "medium", "low"] },
          "req_statement":        { "type": "string" },
          "linked_adrs":          { "type": "array", "items": { "type": "string" } },
          "linked_tests":         { "type": "array", "items": { "type": "string" } },
          "linked_tasks":         { "type": "array", "items": { "type": "string" } },
          "coverage_status":      { "type": "string", "enum": ["COVERED", "UNCOVERED"] },
          "implementation_status":{ "type": "string", "enum": ["IMPLEMENTED", "UNIMPLEMENTED"] }
        }
      }
    },
    "uncovered_reqs":     { "type": "array", "items": { "type": "string" } },
    "unimplemented_reqs": { "type": "array", "items": { "type": "string" } },
    "pagination": {
      "type": "object",
      "description": "Present only when requirements.length > 500",
      "properties": {
        "page":        { "type": "integer", "minimum": 1 },
        "total_pages": { "type": "integer", "minimum": 1 },
        "total_reqs":  { "type": "integer", "minimum": 1 }
      }
    }
  }
}
```

---

**See also:**
- `.opencode/skills/traceability-matrix/SKILL.md` — full execution spec (SKL-111)
- `docs/spec-artifact.md` — spec artifact schema (written by orchestrator)
- `docs/skills-registry.md` — SKL-111 registry entry

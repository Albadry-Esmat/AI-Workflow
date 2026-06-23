---
name: work-item-exporter
version: 1.0.0
domain: integration
description: 'Use when work items need to be exported to an external platform or file. Triggers on: "export tasks", "export work items", "sync to Jira", "export to Jira", "generate Jira import", "export project plan", "export bugs". One-way outbound export only — no status read-back from external platforms.'
author: system
---

## Purpose

Transform all tracked work items from the internal `work-items/` store into export-ready formats for external work management platforms. The primary output is a **Jira Bulk Import JSON** file that can be imported directly into any Jira project without additional transformation. Secondary outputs are JSON Lines (universal machine-readable fallback) and a Markdown summary table (human-readable). Export is one-way (outbound only) and non-blocking — it runs as an async final step at pipeline completion or on demand. The exported files are written to the `exports/` directory with a timestamp and session suffix.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `export_formats` | `array[string]` | No | Formats to generate. Default: `["jira", "jsonl", "markdown"]` |
| `jira_project_key` | `string` | No | Jira project key for the export (e.g. `PROJ`). Included in manifest; not required for file generation. |
| `filter` | `object` | No | Filtering options. Default: export all items. |
| `filter.types` | `array[string]` | No | Work item types to include. Default: all types. |
| `filter.statuses` | `array[string]` | No | Lifecycle statuses to include. Default: all statuses. |
| `filter.exclude_cancelled` | `boolean` | No | Exclude `cancelled` items from export. Default: `true`. |
| `filter.date_from` | `string` | No | ISO date — only export items created on or after this date. |
| `strip_internal_fields` | `boolean` | No | Remove internal system fields (metrics, feedback refs) from export payload. Default: `true`. |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "export_formats": {
      "type": "array",
      "items": { "type": "string", "enum": ["jira", "jsonl", "markdown"] },
      "default": ["jira", "jsonl", "markdown"]
    },
    "jira_project_key": { "type": "string", "pattern": "^[A-Z]{2,10}$" },
    "filter": {
      "type": "object",
      "properties": {
        "types":              { "type": "array", "items": { "type": "string" } },
        "statuses":           { "type": "array", "items": { "type": "string" } },
        "exclude_cancelled":  { "type": "boolean", "default": true },
        "date_from":          { "type": "string", "format": "date" }
      }
    },
    "strip_internal_fields": { "type": "boolean", "default": true }
  }
}
```

## Required Context

- `work_items` scope from state-manager: compressed index to enumerate all items and their `file_path` references.
- `work-items/{TYPE}-{NNNN}.md` files: full detail for each item (read per item as needed).
- `session_id` from state: included in export file naming and manifest.
- Foundation schema from `docs/work-item-foundation.md` §2: Jira field mapping table used for format transformation.

## Execution Logic

```
Step 1 — Load and filter work item index
  Read work_items.items[] from state (compressed index).
  Apply filter:
    - Remove items with lifecycle_state=cancelled if filter.exclude_cancelled=true (default)
    - Filter by types[] if provided
    - Filter by statuses[] if provided
    - Filter by date_from if provided (compare created_at)
  Output: filtered_items[] (compressed refs only)

Step 2 — Load full details for each filtered item
  For each item in filtered_items[]:
    Read work-items/{item.file_path} Markdown file.
    Parse front matter (YAML) and body sections.
    Build full_item object with all fields.
  Output: full_items[]

Step 3 — PII scrubbing
  For each full_item:
    Scan title, description, steps_to_reproduce, acceptance_criteria, audit_trail entries for:
      - Email addresses → replace with [EMAIL_REDACTED]
      - API keys / tokens (patterns: 20+ alphanumeric chars, Bearer tokens, sk-*, ghp_*, etc.) → [TOKEN_REDACTED]
      - Passwords in prose → [PASSWORD_REDACTED]
    If any redaction occurred: emit `warning` feedback entry with item_id and field name.
  Output: scrubbed_items[]

Step 4 — Build Jira Bulk Import JSON (if "jira" in export_formats)
  For each scrubbed_item:
    Map fields per docs/work-item-foundation.md Jira Field Mapping table:
      summary ← title
      issuetype ← jira_issue_type (from front matter)
      priority ← jira_priority (from front matter)
      description ← body description section (markdown)
      labels ← jira_labels[] (from front matter)
      components ← jira_components[] (from front matter)
      externalId ← id (for deduplication on re-import)
      parent ← parent_id (if non-null)
      issuelinks ← linked_items[] mapped to Jira link type names
    Build Jira Bulk Import envelope:
      {
        "projects": [{
          "key": jira_project_key (or "IMPORT" if not provided),
          "issues": [ { mapped issue objects } ]
        }]
      }
  Write to: exports/{date}_{session_prefix}_jira.json
  Output: jira_export_path, jira_item_count

Step 5 — Build JSON Lines (if "jsonl" in export_formats)
  For each scrubbed_item:
    Serialize to single-line JSON.
    If strip_internal_fields=true: remove keys: created_by_skill, last_updated_by_skill, file_path.
  Write each line to: exports/{date}_{session_prefix}_full.jsonl
  Output: jsonl_export_path, jsonl_item_count

Step 6 — Build Markdown summary (if "markdown" in export_formats)
  Generate Markdown table:
    Columns: ID | Type | Title | Status | Priority | Linked Items Count | Created At
    One row per item, sorted by type then ID.
    Add summary row at bottom: total items, type breakdown counts.
  Write to: exports/{date}_{session_prefix}_summary.md
  Output: markdown_export_path

Step 7 — Write export manifest
  Build manifest:
    {
      "export_id": "{date}_{session_prefix}",
      "exported_at": ISO timestamp,
      "pipeline_session_id": state.session_id,
      "format_version": "1.0.0",
      "items_exported": total count,
      "type_breakdown": { "TASK": N, "BUG": N, ... },
      "filters_applied": input filter object,
      "export_formats": input export_formats,
      "jira_project_key": input jira_project_key or null,
      "files_produced": { "jira": path, "jsonl": path, "markdown": path }
    }
  Write to: exports/{date}_{session_prefix}_manifest.json
  Output: manifest

Step 8 — Assemble output
  Emit event: file.written (for each export file produced)
  Return output.
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `export_id` | `string` | Export identifier (e.g. `2026-06-22_abc123`) |
| `files_produced` | `object` | Paths of all export files: `{ jira, jsonl, markdown, manifest }` |
| `items_exported` | `integer` | Total work items included in the export |
| `type_breakdown` | `object` | Count per work item type |
| `manifest` | `object` | Full export manifest object |
| `metrics` | `object` | Execution metrics |
| `feedback` | `array[object]` | Feedback loop entries (warnings for PII redactions, empty work item store, etc.) |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["export_id", "files_produced", "items_exported", "type_breakdown", "manifest", "metrics", "feedback"],
  "properties": {
    "export_id": { "type": "string" },
    "files_produced": {
      "type": "object",
      "properties": {
        "jira":     { "type": ["string", "null"] },
        "jsonl":    { "type": ["string", "null"] },
        "markdown": { "type": ["string", "null"] },
        "manifest": { "type": "string" }
      },
      "required": ["manifest"]
    },
    "items_exported": { "type": "integer", "minimum": 0 },
    "type_breakdown": { "type": "object", "additionalProperties": { "type": "integer" } },
    "manifest": { "type": "object" },
    "metrics": {
      "type": "object",
      "required": ["tokens_in", "tokens_out", "duration_ms", "items_produced", "version"],
      "properties": {
        "tokens_in":      { "type": "integer" },
        "tokens_out":     { "type": "integer" },
        "duration_ms":    { "type": "integer" },
        "items_produced": { "type": "integer" },
        "version":        { "type": "string" }
      }
    },
    "feedback": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["type", "from_skill", "reason"],
        "properties": {
          "type":         { "type": "string", "enum": ["backpropagate", "info", "warning"] },
          "from_skill":   { "type": "string" },
          "target_skill": { "type": "string" },
          "reason":       { "type": "string" },
          "evidence":     { "type": "object" }
        }
      }
    }
  }
}
```

## Rules & Constraints

- Export is **one-way (outbound) only**. work-item-exporter MUST NOT read status back from Jira or any external platform. There is no sync path.
- Export is **non-blocking and async**. It runs at pipeline completion (parallel with doc-maintainer) and MUST NOT gate any preceding pipeline phase.
- PII scrubbing (Step 3) is **mandatory** and MUST run before any export file is written. No raw personal data may appear in exported files.
- `exports/` directory is created if absent.
- Export files are **idempotent**: re-exporting the same state produces the same file content (modulo timestamps in the manifest).
- The Jira export MUST conform to the Jira Bulk Import JSON format. The `externalId` field enables deduplication — reimporting the same file into Jira should not create duplicate issues.
- If `work_items.items[]` is empty, emit an `info` feedback entry and write only the manifest (with `items_exported: 0`). Do not write empty Jira/JSONL/Markdown files.
- The `strip_internal_fields=true` default ensures internal fields (`created_by_skill`, `file_path`, `last_updated_by_skill`) do not appear in exported payloads.
- Session prefix in export file naming: first 8 characters of `session_id` (UUID).

## Security Considerations

- PII scrubbing is non-negotiable. All description, title, and body text must be scanned before writing.
- Jira export files may be uploaded to external systems. Never include: API credentials, internal service URLs, session tokens, or infrastructure details.
- The `exports/` directory is a project artifact visible in git. Sensitive defect descriptions (security vulnerabilities) should be flagged for human review before export commit.
- If a work item was tagged with `jira_labels: ["security"]` (from security-review defects), emit a `warning` feedback entry: "Security defect {id} is included in export — verify disclosure appropriateness before uploading to Jira."

## Token Optimization

- Read only `work_items.items[]` (compressed refs) from state in Step 1. Do NOT load full `.md` file content during filtering.
- In Step 2, read each `.md` file only for items that pass the filter. Skip files for filtered-out items entirely.
- Parse only the YAML front matter in Step 2 for Jira/JSONL export — body sections (Description, Acceptance Criteria) are only needed for the Jira `description` field.
- Batch file writes (buffer all lines, single write per output file) rather than appending line-by-line.

## Quality Checklist

- [ ] PII scrubbing ran before any file write
- [ ] Jira export conforms to Bulk Import JSON envelope format (`projects[].issues[]`)
- [ ] All items have `externalId` set to their work item ID
- [ ] Parent-child relationships preserved in Jira export (`parent` field for sub-tasks)
- [ ] `strip_internal_fields=true` removes `created_by_skill`, `file_path`, `last_updated_by_skill`
- [ ] Manifest written with correct item count and type breakdown
- [ ] `exports/` directory created if absent
- [ ] Empty item store handled gracefully (manifest only, no empty files)
- [ ] Security-sourced items flagged in feedback if present

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| `work_items` scope absent from state | Emit `info` feedback: "No work items found in state". Write manifest with items_exported=0. Return early. |
| `work-items/` file missing for a referenced item | Emit `warning`, skip the item in export, record it in manifest as `skipped_items`. |
| PII pattern found in content | Redact in-memory (do not modify source `.md` file), emit `warning` feedback, write export with redacted content. |
| `exports/` directory missing | Create directory, continue. |
| Jira format version incompatibility | Fall back to JSONL-only export, emit `warning` with note to update Jira field mapping. |

## 12. Human-in-the-Loop Gates

No HITL gates. work-item-exporter is fully automated and non-blocking.

Exception: if a security-sourced defect (`jira_labels` includes `"security"`) is included in the export, emit a `warning` feedback entry requesting human review before the export file is shared externally. This is advisory, not a blocking gate.

## 13. Skill Composition

```yaml
composes:
  - skill: state-manager
    version: "^1.1.0"
    role: state_read
    scopes: ["work_items", "session_id"]
    note: "Read-only. work-item-exporter never writes to state."

pipeline_entry:
  - pipeline: full-pipeline
    phase: phase-14-export (async, parallel with doc-maintainer)
  - pipeline: defect-lifecycle
    phase: final-export (async)
  - pipeline: change-request
    phase: final-export (async)
  - direct_invocation: true (can be called standalone via routing table)

event_emissions:
  - event: file.written
    on: each export file produced
    payload: { path, type: "export" }
```

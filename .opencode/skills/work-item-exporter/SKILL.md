---
name: work-item-exporter
version: 2.1.0
domain: integration
description: 'Use when work items need to be exported to an external platform or file, or when syncing Jira status back to local work items, or when a Jira/GitHub/Linear webhook event needs to trigger an automated sync. Triggers on: "export tasks", "export work items", "sync to Jira", "export to Jira", "generate Jira import", "export project plan", "export bugs", "sync from Jira", "pull Jira status", "bidirectional sync", "webhook trigger", "Jira webhook", "auto-sync on status change". Supports three modes: export (one-way outbound, default), sync (bidirectional — reads Jira status back and proposes local updates via HITL gate), and webhook (event-driven — validates incoming webhook payload, maps event to a sync or export operation, and dispatches automatically). FEATURE work items are mapped to Jira Epics automatically.'
author: system
---

## Purpose

Transform all tracked work items from the internal `work-items/` store into export-ready formats for external work management platforms, and optionally pull status updates back from Jira into local work item files. The skill operates in two modes:

- **`export` mode (default):** One-way outbound. Produces a Jira Bulk Import JSON file, JSON Lines, and Markdown summary. Async and non-blocking.
- **`sync` mode:** Bidirectional. After export, fetches the current status of each exported issue from the Jira REST API, diffs against local `lifecycle_state`, and proposes state updates for human approval via HITL gate. No local file is modified without explicit human approval.
- **`webhook` mode:** Event-driven. Receives a raw webhook payload from Jira, GitHub, or Linear; validates the HMAC signature; maps the event type to an export or sync operation; and dispatches automatically. Deletion events are HITL-gated (no auto-delete).

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `mode` | `string` | No | Operation mode: `"export"` (default), `"sync"`, or `"webhook"`. Sync mode requires `jira_base_url` and `jira_api_token_env`. Webhook mode requires `webhook_config` and `payload`. |
| `export_formats` | `array[string]` | No | Formats to generate. Default: `["jira", "jsonl", "markdown"]` |
| `jira_project_key` | `string` | No (required in sync mode) | Jira project key for the export (e.g. `PROJ`). Included in manifest; required for sync API calls. |
| `jira_base_url` | `string` | Sync only | Base URL of the Jira instance (e.g. `https://myorg.atlassian.net`). Required when `mode=sync`. |
| `jira_api_token_env` | `string` | Sync only | Name of the environment variable holding the Jira API token (e.g. `JIRA_API_TOKEN`). The token value is NEVER inlined in input — only the env var name is passed. |
| `jira_user_email` | `string` | Sync only | Email of the Jira user whose API token is used for authentication. |
| `filter` | `object` | No | Filtering options. Default: export all items. |
| `filter.types` | `array[string]` | No | Work item types to include. Default: all types. |
| `filter.statuses` | `array[string]` | No | Lifecycle statuses to include. Default: all statuses. |
| `filter.exclude_cancelled` | `boolean` | No | Exclude `cancelled` items from export. Default: `true`. |
| `filter.date_from` | `string` | No | ISO date — only export items created on or after this date. |
| `strip_internal_fields` | `boolean` | No | Remove internal system fields (metrics, feedback refs) from export payload. Default: `true`. |
| `webhook_config` | `object` | Webhook only | Webhook configuration. Required when `mode=webhook`. |
| `webhook_config.source` | `string` | Webhook only | Webhook source platform: `"jira"`, `"github"`, or `"linear"`. |
| `webhook_config.event_filter` | `array[string]` | Webhook only | Event types to act on. E.g. `["issue_status_changed", "issue_created", "issue_deleted"]`. Events not in this list are silently ignored. |
| `webhook_config.secret_env_var` | `string` | Webhook only | Name of the environment variable holding the HMAC webhook secret (e.g. `JIRA_WEBHOOK_SECRET`). The secret value is NEVER inlined — only the env var name is passed. |
| `payload` | `object` | Webhook only | Raw webhook event payload received from the external platform. |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "mode": {
      "type": "string",
      "enum": ["export", "sync", "webhook"],
      "default": "export"
    },
    "export_formats": {
      "type": "array",
      "items": { "type": "string", "enum": ["jira", "jsonl", "markdown"] },
      "default": ["jira", "jsonl", "markdown"]
    },
    "jira_project_key": { "type": "string", "pattern": "^[A-Z]{2,10}$" },
    "jira_base_url": { "type": "string", "format": "uri" },
    "jira_api_token_env": { "type": "string", "description": "Env var NAME only — not the token value" },
    "jira_user_email": { "type": "string", "format": "email" },
    "filter": {
      "type": "object",
      "properties": {
        "types":              { "type": "array", "items": { "type": "string" } },
        "statuses":           { "type": "array", "items": { "type": "string" } },
        "exclude_cancelled":  { "type": "boolean", "default": true },
        "date_from":          { "type": "string", "format": "date" }
      }
    },
    "strip_internal_fields": { "type": "boolean", "default": true },
    "webhook_config": {
      "type": "object",
      "description": "Required when mode=webhook",
      "properties": {
        "source":         { "type": "string", "enum": ["jira", "github", "linear"] },
        "event_filter":   { "type": "array", "items": { "type": "string" } },
        "secret_env_var": { "type": "string", "description": "Env var NAME only — never the secret value" }
      },
      "required": ["source", "event_filter", "secret_env_var"]
    },
    "payload": {
      "type": "object",
      "description": "Raw webhook event payload. Required when mode=webhook."
    }
  },
  "if": { "properties": { "mode": { "const": "sync" } }, "required": ["mode"] },
  "then": { "required": ["jira_base_url", "jira_api_token_env", "jira_user_email", "jira_project_key"] },
  "allOf": [
    {
      "if": { "properties": { "mode": { "const": "webhook" } }, "required": ["mode"] },
      "then": { "required": ["webhook_config", "payload"] }
    }
  ]
}
```

## Required Context

- `work_items` scope from state-manager: compressed index to enumerate all items and their `file_path` references.
- `work-items/{TYPE}-{NNNN}.md` files: full detail for each item (read per item as needed).
- `session_id` from state: included in export file naming and manifest.
- Foundation schema from `docs/work-item-foundation.md` §2: Jira field mapping table used for format transformation.
- *(sync mode only)* Jira REST API access: base URL + credentials from environment variable named by `jira_api_token_env`. Credentials are read from the environment at runtime and are NEVER written to state, logs, or export files.

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
    Determine Jira issue type:
      IF work_item_type == "FEATURE":
        issuetype ← "Epic"
        epic_name ← title (truncated to 255 chars)
        customfield_10011 ← epic_name   (Epic Name field — Jira Cloud classic)
        parent field MUST be omitted (Epics cannot be sub-tasks in Jira)
        IF parent_id is set on the FEATURE item:
          Emit `warning` feedback: "FEATURE {id} has parent_id set but Epics cannot have parents in Jira — parent field omitted"
      ELSE:
        Map fields per docs/work-item-foundation.md Jira Field Mapping table:
          issuetype ← jira_issue_type (from front matter)
          parent    ← parent_id (if non-null; links TASK/BUG to its FEATURE Epic by externalId)

    Common field mapping (all types):
      summary   ← title
      priority  ← jira_priority (from front matter)
      description ← body description section (markdown)
      labels    ← jira_labels[] (from front matter)
      components ← jira_components[] (from front matter)
      externalId ← id (for deduplication on re-import)
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

Step 8 — Assemble output (export mode)
  Emit event: file.written (for each export file produced)
  Return output.

Step 9 — Fetch Jira issue statuses (sync mode only; skip entirely if mode=export)
  Validate sync inputs: jira_base_url, jira_api_token_env, jira_user_email, jira_project_key all present.
  Read API token: token = os.environ[jira_api_token_env]
    IF env var is absent or empty: emit `warning` feedback, set sync_report.status="credential_error", return early.
  For each item in filtered_items[]:
    Call: GET {jira_base_url}/rest/api/3/issue/{jira_project_key}-{item.id}?fields=status,resolution,assignee
    On HTTP 200: store { jira_key, jira_status: response.fields.status.name, jira_resolution: response.fields.resolution?.name }
    On HTTP 404: mark item as jira_status="NOT_FOUND" (not yet imported)
    On HTTP 401/403: emit `warning` feedback "Jira auth failed", abort sync, return partial output.
    On other errors: emit `warning`, skip item, continue.
  NEVER log or persist the API token value.
  Output: jira_statuses[] (map of item_id → jira_status)

Step 10 — Diff Jira statuses vs local lifecycle_state (sync mode only)
  Define Jira→local status mapping:
    "To Do"       → "open"
    "In Progress" → "in_progress"
    "Done"        → "done"
    "Closed"      → "done"
    "Won't Do"    → "cancelled"
    (unmapped)    → null (no proposal made)
  For each item with a known jira_status:
    mapped_local = jira_to_local_map[jira_status]
    IF mapped_local is null: skip (no proposal)
    IF mapped_local == item.lifecycle_state: no change needed
    IF mapped_local != item.lifecycle_state:
      Add to proposed_updates[]: { item_id, file_path, current_state: item.lifecycle_state, proposed_state: mapped_local, jira_status, jira_key }
  Output: proposed_updates[]

Step 11 — HITL gate: present proposed updates for human approval (sync mode only)
  IF proposed_updates[] is empty:
    Set sync_report.status = "in_sync" — no changes needed. Skip gate. Return.
  Present to human:
    - Total proposed updates count
    - Table: Item ID | Current local state | Jira status | Proposed local state
    - Warning: "These changes will modify local work-item .md files."
  Human choices:
    "approve all" → apply all proposed_updates
    "approve subset" → human selects item IDs to apply
    "reject all" → skip all updates, set sync_report.status="rejected"
  Gate timeout: 600s. On timeout: skip all updates, emit `warning` feedback.

Step 12 — Apply approved updates (sync mode only)
  For each approved item in proposed_updates[]:
    Read work-items/{file_path}
    Update front matter: lifecycle_state ← proposed_state
    Append audit_trail entry: { timestamp, action: "sync_from_jira", previous_state: current_state, new_state: proposed_state, jira_key }
    Write file back.
    Emit event: file.written (for each updated file)
  Build sync_report:
    { status: "applied", proposed: N, approved: N, applied: N, skipped: N, items: proposed_updates[] with applied flag }
  Output: sync_report

Step 13 — Validate webhook signature (webhook mode only; skip if mode≠webhook)
  Read HMAC secret: secret = os.environ[webhook_config.secret_env_var]
    IF env var absent or empty: reject with {"error": "WEBHOOK_SECRET_NOT_CONFIGURED"}.
  Verify X-Hub-Signature-256 header against HMAC-SHA256(secret, raw payload bytes).
    IF header absent: reject with {"error": "INVALID_WEBHOOK_SIGNATURE", "reason": "missing_header"}.
    IF signature mismatch: reject with {"error": "INVALID_WEBHOOK_SIGNATURE", "reason": "signature_mismatch"}.
  NEVER log the secret value or include it in any output, feedback, or error message.
  Output: signature_valid=true

Step 14 — Parse webhook event (webhook mode only)
  Extract from payload: event_type, issue_id, from_status, to_status, timestamp.
  Normalize event_type per source platform:
    Jira:   "jira:issue_updated" → "issue_status_changed"; "jira:issue_created" → "issue_created"
            "jira:issue_deleted" → "issue_deleted"
    GitHub: "issues.closed" → "issue_status_changed"; "issues.opened" → "issue_created"
            "issues.deleted" → "issue_deleted"
    Linear: "Issue.update" → "issue_status_changed"; "Issue.create" → "issue_created"
            "Issue.remove" → "issue_deleted"
  Apply event_filter: IF normalized event_type NOT in webhook_config.event_filter:
    Return {"webhook_accepted": true, "sync_triggered": false, "reason": "event_filtered_out"}.
  Rate limit check: enforce max 10 webhook invocations per minute per source.
    IF rate exceeded: queue with backpressure warning; emit `warning` feedback.
  Output: parsed_event { event_type, issue_id, from_status, to_status, timestamp }

Step 15 — Map event to operation (webhook mode only)
  event_type = "issue_status_changed":
    Trigger mode=sync scoped to issue_id. Proceed to Step 16.
  event_type = "issue_created":
    IF a local work item with matching externalId/issue_id exists:
      Trigger mode=export scoped to that item. Proceed to Step 16.
    ELSE:
      Return {"webhook_accepted": true, "sync_triggered": false, "reason": "no_local_item_for_created_event"}.
  event_type = "issue_deleted":
    DO NOT auto-delete the local work item.
    Flag in local state: set work item field `jira_deleted_flag: true` (requires HITL approval to act on).
    Emit `warning` feedback: "Jira issue {issue_id} was deleted. Local work item flagged but NOT deleted — HITL approval required before any local deletion."
    Raise HITL gate: present deletion event to human for explicit approval.
    On approval: human decides whether to delete, archive, or retain the local item.
    On rejection / timeout (600s): retain local item unchanged.
    Return {"webhook_accepted": true, "sync_triggered": false, "deletion_flagged": true}.

Step 16 — Invoke sync/export operation (webhook mode only)
  Dispatch the operation determined in Step 15 as an internal skill invocation
  (same as calling mode=sync or mode=export with scope filter = issue_id).
  Return:
    { "webhook_accepted": true, "sync_triggered": true, "scope": issue_id,
      "operation": "sync" | "export", "dispatch_id": UUID }
  Output: webhook_response
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `export_id` | `string` | Export identifier (e.g. `2026-06-22_abc123`) |
| `files_produced` | `object` | Paths of all export files: `{ jira, jsonl, markdown, manifest }` |
| `items_exported` | `integer` | Total work items included in the export |
| `type_breakdown` | `object` | Count per work item type |
| `manifest` | `object` | Full export manifest object |
| `sync_report` | `object` \| `null` | Sync mode only. `{ status, proposed, approved, applied, skipped, items[] }`. `null` in export/webhook mode. |
| `webhook_response` | `object` \| `null` | Webhook mode only. `{ webhook_accepted, sync_triggered, scope, operation, dispatch_id }`. `null` in export/sync mode. |
| `metrics` | `object` | Execution metrics |
| `feedback` | `array[object]` | Feedback loop entries (warnings for PII redactions, empty work item store, sync errors, etc.) |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["export_id", "files_produced", "items_exported", "type_breakdown", "manifest", "sync_report", "webhook_response", "metrics", "feedback"],
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
    "sync_report": {
      "type": ["object", "null"],
      "description": "null in export/webhook mode; populated in sync mode",
      "properties": {
        "status":   { "type": "string", "enum": ["in_sync", "applied", "rejected", "credential_error", "partial"] },
        "proposed": { "type": "integer" },
        "approved": { "type": "integer" },
        "applied":  { "type": "integer" },
        "skipped":  { "type": "integer" },
        "items":    { "type": "array", "items": { "type": "object" } }
      }
    },
    "webhook_response": {
      "type": ["object", "null"],
      "description": "null in export/sync mode; populated in webhook mode",
      "properties": {
        "webhook_accepted":  { "type": "boolean" },
        "sync_triggered":    { "type": "boolean" },
        "scope":             { "type": ["string", "null"] },
        "operation":         { "type": "string", "enum": ["sync", "export"] },
        "dispatch_id":       { "type": "string" },
        "deletion_flagged":  { "type": "boolean" },
        "reason":            { "type": "string" }
      },
      "required": ["webhook_accepted", "sync_triggered"]
    },
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

- **Export mode** is one-way (outbound only) and **non-blocking and async**. It runs at pipeline completion (parallel with doc-maintainer) and MUST NOT gate any preceding pipeline phase.
- **Sync mode** is bidirectional but **always HITL-gated**. No local `.md` file may be modified without explicit human approval of the proposed update set (Step 11). Sync mode runs on-demand only — it MUST NOT be triggered automatically without user intent.
- **Webhook mode** is event-driven and automated for `issue_status_changed` and `issue_created` events. The `issue_deleted` event MUST NEVER auto-delete a local work item — it raises a HITL gate. Rate limit: max 10 invocations per minute per source platform.
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
- **Sync mode credentials:** The Jira API token is read from the environment variable named by `jira_api_token_env` at runtime. The token value MUST NEVER appear in: skill inputs, state, logs, feedback entries, export files, or audit trail entries. Only the env var name is ever stored or logged.
- **Webhook mode credentials:** The HMAC webhook secret is read from the env var named by `webhook_config.secret_env_var` at runtime. The secret value MUST NEVER appear in any output, log, feedback entry, error message, or state. Only the env var name is stored. Any incoming webhook with a missing or invalid HMAC signature MUST be rejected immediately (Step 13) before any payload processing occurs.
- **Webhook deletion safety:** `issue_deleted` events MUST NOT trigger any local work item deletion — auto-deletion is prohibited. The event only sets a flag and raises a HITL gate. Deletion of local state requires explicit human decision.

## Token Optimization

- Read only `work_items.items[]` (compressed refs) from state in Step 1. Do NOT load full `.md` file content during filtering.
- In Step 2, read each `.md` file only for items that pass the filter. Skip files for filtered-out items entirely.
- Parse only the YAML front matter in Step 2 for Jira/JSONL export — body sections (Description, Acceptance Criteria) are only needed for the Jira `description` field.
- Batch file writes (buffer all lines, single write per output file) rather than appending line-by-line.

## Quality Checklist

- [ ] PII scrubbing ran before any file write
- [ ] Jira export conforms to Bulk Import JSON envelope format (`projects[].issues[]`)
- [ ] All items have `externalId` set to their work item ID
- [ ] **FEATURE items mapped to `issuetype: Epic` with `customfield_10011` (Epic Name) set**
- [ ] **FEATURE items have no `parent` field in Jira export (Epics cannot be sub-tasks)**
- [ ] **TASK/BUG items with `parent_id` pointing to a FEATURE use the FEATURE's `externalId` as `parent`**
- [ ] Parent-child relationships preserved in Jira export (`parent` field for sub-tasks)
- [ ] `strip_internal_fields=true` removes `created_by_skill`, `file_path`, `last_updated_by_skill`
- [ ] Manifest written with correct item count and type breakdown
- [ ] `exports/` directory created if absent
- [ ] Empty item store handled gracefully (manifest only, no empty files)
- [ ] Security-sourced items flagged in feedback if present
- [ ] *(sync mode)* API token read from environment — never from input value, never logged
- [ ] *(sync mode)* No local `.md` file modified without passing HITL gate (Step 11)
- [ ] *(sync mode)* `sync_report` populated with accurate proposed/approved/applied/skipped counts
- [ ] *(sync mode)* Audit trail entry appended to each updated work item file
- [ ] *(webhook mode)* HMAC signature validated before any payload processing (Step 13)
- [ ] *(webhook mode)* Webhook secret read from env var — value never logged or outputted
- [ ] *(webhook mode)* `issue_deleted` event does NOT auto-delete local work item — HITL gate raised
- [ ] *(webhook mode)* Rate limit enforced (max 10/min per source)
- [ ] *(webhook mode)* `webhook_response` populated with accurate `webhook_accepted`, `sync_triggered`, `scope`

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| `work_items` scope absent from state | Emit `info` feedback: "No work items found in state". Write manifest with items_exported=0. Return early. |
| `work-items/` file missing for a referenced item | Emit `warning`, skip the item in export, record it in manifest as `skipped_items`. |
| PII pattern found in content | Redact in-memory (do not modify source `.md` file), emit `warning` feedback, write export with redacted content. |
| `exports/` directory missing | Create directory, continue. |
| Jira format version incompatibility | Fall back to JSONL-only export, emit `warning` with note to update Jira field mapping. |
| `FEATURE` item has `parent_id` set | Omit `parent` field from Jira export, emit `warning` feedback: "FEATURE {id} has parent_id set but Epics cannot have parents in Jira — parent field omitted". |
| `FEATURE` item missing `title` (Epic Name) | Emit `warning`, use `id` as Epic Name fallback, continue export. |
| Sync mode: `jira_api_token_env` env var absent or empty | Set sync_report.status="credential_error", emit `warning`, skip sync steps, return export-only output. |
| Sync mode: Jira HTTP 401/403 | Abort sync, emit `warning` "Jira auth failed — check {jira_api_token_env}", return export-only output. |
| Sync mode: Jira HTTP 404 for an item | Mark item as jira_status="NOT_FOUND" (not yet imported), exclude from proposed_updates. |
| Sync mode: HITL gate timeout (600s) | Skip all updates, set sync_report.status="rejected", emit `warning` "Sync gate timed out — no local files modified". |
| Sync mode: human rejects all proposals | Set sync_report.status="rejected", emit `info` feedback, return without modifying any files. |
| Webhook mode: `secret_env_var` absent or empty | Reject with {"error": "WEBHOOK_SECRET_NOT_CONFIGURED"}. No payload processing occurs. |
| Webhook mode: HMAC signature missing or invalid | Reject with {"error": "INVALID_WEBHOOK_SIGNATURE"}. No payload processing occurs. |
| Webhook mode: event_type not in event_filter | Return {"webhook_accepted": true, "sync_triggered": false, "reason": "event_filtered_out"}. No-op. |
| Webhook mode: rate limit exceeded (>10/min) | Queue event with backpressure warning; emit `warning` feedback. |
| Webhook mode: `issue_deleted` event | Flag local item, raise HITL gate. Do NOT delete. |

## 12. Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Behavior |
|------|---------|---------|----------|
| Sync approval | `mode=sync` AND `proposed_updates[]` is non-empty | 600s | Present diff table (Item ID, current state, Jira status, proposed state). Human approves all, subset, or rejects. No file written without approval. |
| Webhook deletion | `mode=webhook` AND `event_type=issue_deleted` | 600s | Present deletion event details. Human decides: delete, archive, or retain local work item. No local deletion without explicit approval. |

No HITL gates in export mode. work-item-exporter export mode is fully automated and non-blocking.

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
  - webhook_invocation: true (mode=webhook invoked on incoming Jira/GitHub/Linear events)

event_emissions:
  - event: file.written
    on: each export file produced
    payload: { path, type: "export" }
```

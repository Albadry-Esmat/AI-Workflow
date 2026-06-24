# FEATURE-008 — Implementation Plan: Technical Debt Tracker

## Target Skills / Artifacts

| Skill / Artifact | Action | Notes |
|---|---|---|
| `technical-debt-tracker/SKILL.md` (SKL-068) | Create | New skill — persistent technical debt register with scoring and projections |
| `skills/registry.json` | Update | Register SKL-068 with `status: draft` |
| `skills/index.yaml` | Update | Add index entry for SKL-068 |

---

## §1 — Skill Purpose and Pipeline Position

`technical-debt-tracker` provides the ASE-OS pipeline with persistent memory of code quality issues across sessions. It runs after `clean-code-review` on every code-changed pipeline cycle and writes a structured, deduplicating debt register to `state-manager`. Its `report` output feeds `feature-planning` with a prioritized remediation backlog.

Pipeline position:

```
code.changed event
  → clean-code-review
  → technical-debt-tracker (operation: record)    ← THIS SKILL
      → feature-planning   (remediation_backlog as sprint input)

On-demand / session-end:
  → technical-debt-tracker (operation: report)
```

The skill supports four operations: `record`, `query`, `report`, `resolve`. These are distinct invocation modes, not sequential steps within one execution.

---

## §2 — Input Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "operation": {
      "type": "string",
      "enum": ["record", "query", "report", "resolve"],
      "description": "Operation to perform on the debt register"
    },
    "code_review_output": {
      "type": "object",
      "description": "Output from clean-code-review. Required when operation=record"
    },
    "module_filter": {
      "type": "string",
      "description": "Limit query/report results to a specific module name"
    },
    "resolve_ids": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Debt item IDs to mark as resolved. Required when operation=resolve"
    },
    "session_id": {
      "type": "string",
      "description": "Current session identifier for session_count tracking"
    },
    "project_id": {
      "type": "string",
      "description": "Project scope for the debt register. Registers are isolated per project_id"
    }
  },
  "required": ["operation", "session_id", "project_id"]
}
```

Conditional requirements:
- `code_review_output` is **required** when `operation = "record"`
- `resolve_ids` is **required** when `operation = "resolve"` and must be non-empty

---

## §3 — Four Operation Modes

### Operation: `record`

Ingest a new `clean-code-review` output into the persistent debt register.

1. Read existing `debt_register` from `state-manager` (scope: `project_id`)
2. For each issue in `code_review_output.issues`:
   - Compute deduplication key: `module + "|" + issue_type + "|" + location`
   - If key exists in register: increment `session_count`, update `last_seen`
   - If key is new: create new `debt_item` with `status: open`, `first_seen`, `session_count: 1`
3. For each existing open item not present in the new review: keep status as `open` (absence = unverified, not resolved)
4. Recalculate `debt_score` and `debt_trend`
5. Write updated register to `state-manager`
6. Emit `feedback` if thresholds exceeded

### Operation: `query`

Return filtered subset of the active debt register without modifying state.

- Apply `module_filter` if provided
- Return only `status: open` items by default
- No state write

### Operation: `report`

Return full analysis: debt register, score, trend, cost projection, and remediation backlog.

- Apply `module_filter` if provided
- Calculate all output fields
- No state write

### Operation: `resolve`

Mark specific debt items as resolved.

- For each `id` in `resolve_ids`: set `status = "resolved"` in the register
- Items not found in register: emit `warning` feedback with missing IDs
- Recalculate `debt_score` after resolution
- Write updated register to `state-manager`

---

## §4 — Execution Steps Specification (shared across operations)

### Step 1 — Load Debt Register from State
Read `debt_register` from `state-manager` keyed by `project_id`.
If no register exists: initialize empty register.
Output: `existing_register[]`

### Step 2 — Apply Operation Logic (record | query | report | resolve)
Execute the operation-specific logic defined in §3.
Output: `working_register[]`

### Step 3 — Deduplicate and Merge (record only)
Apply deduplication key: `module + "|" + issue_type + "|" + location`.
New items: assign `debt_id = "DEBT-" + zero_padded_sequence`, set `first_seen`, `session_count: 1`.
Existing items: increment `session_count`, update `last_seen`.
Output: `merged_register[]`

### Step 4 — Calculate Debt Score
Apply severity weights: `critical = 10`, `major = 5`, `minor = 1`.
Raw score = `Σ(severity_weight × session_count)` for all open items.
Normalized score = `min(100, (raw_score / max_expected_raw) × 100)` where `max_expected_raw = 500`.
Lower score = less debt.
Output: `debt_score` (0–100)

### Step 5 — Determine Debt Trend
Read prior 3 session `debt_score` values from `state-manager` for this `project_id`.
Trend:
- `"improving"` if current score < all 3 prior scores
- `"degrading"` if current score > all 3 prior scores
- `"stable"` otherwise (or fewer than 3 prior sessions)
Output: `debt_trend`

### Step 6 — Project Maintenance Cost
Sum `estimated_fix_hours` across all open items.
Apply compound interest model at 15% per month:
- `fix_now_hours = current_total_hours`
- `deferred_30_days_hours = current_total_hours × 1.15`
- `deferred_90_days_hours = current_total_hours × 1.15^3`
Output: `maintenance_cost_projection`

### Step 7 — Rank Remediation Backlog
For each open debt item, compute ROI score: `estimated_fix_hours / (severity_weight × session_count)`.
Lower ratio = higher priority (quick wins first).
Sort ascending by ROI score.
Return top 10 items.
Output: `remediation_backlog[]` (max 10)

### Step 8 — Write State and Emit Feedback
Write updated `debt_register` and current `debt_score` to `state-manager` (append session score to history).
Emit feedback:
- IF `debt_score > 80`: `backpropagate` to `clean-code-review`, reason: `debt_score_critical`
- IF `debt_trend = "degrading"`: `warning` to orchestrator

---

## §5 — Output Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "debt_register": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "debt_id":            { "type": "string", "pattern": "^DEBT-[0-9]{3,}$" },
          "module":             { "type": "string" },
          "issue_type":         { "type": "string" },
          "severity":           { "type": "string", "enum": ["critical", "major", "minor"] },
          "first_seen":         { "type": "string", "format": "date-time" },
          "last_seen":          { "type": "string", "format": "date-time" },
          "session_count":      { "type": "integer", "minimum": 1 },
          "estimated_fix_hours":{ "type": "number", "minimum": 0 },
          "status":             { "type": "string", "enum": ["open", "resolved"] }
        },
        "required": ["debt_id", "module", "issue_type", "severity", "first_seen", "last_seen", "session_count", "status"]
      }
    },
    "debt_score": { "type": "number", "minimum": 0, "maximum": 100 },
    "debt_trend":  { "type": "string", "enum": ["improving", "stable", "degrading"] },
    "maintenance_cost_projection": {
      "type": "object",
      "properties": {
        "fix_now_hours":          { "type": "number" },
        "deferred_30_days_hours": { "type": "number" },
        "deferred_90_days_hours": { "type": "number" }
      },
      "required": ["fix_now_hours", "deferred_30_days_hours", "deferred_90_days_hours"]
    },
    "remediation_backlog": {
      "type": "array",
      "maxItems": 10,
      "items": {
        "type": "object",
        "properties": {
          "debt_id":             { "type": "string" },
          "module":              { "type": "string" },
          "issue_type":          { "type": "string" },
          "severity":            { "type": "string" },
          "estimated_fix_hours": { "type": "number" },
          "roi_score":           { "type": "number" }
        },
        "required": ["debt_id", "module", "issue_type", "severity", "roi_score"]
      }
    },
    "metrics":  { "$ref": "#/$defs/metrics" },
    "feedback": { "type": "array", "items": { "$ref": "#/$defs/feedback_entry" } }
  },
  "required": ["debt_register", "debt_score", "debt_trend", "maintenance_cost_projection",
               "remediation_backlog", "metrics", "feedback"]
}
```

---

## §6 — Feedback Routes

| Condition | Feedback Type | Target Skill | Reason |
|---|---|---|---|
| `debt_score > 80` | `backpropagate` | `clean-code-review` | `debt_score_critical` |
| `debt_trend = "degrading"` | `warning` | orchestrator | `debt_trend_degrading` |

---

## §7 — Registry Entry

SKL-068 must be added to `skills/registry.json`:
```json
{
  "id": "SKL-068",
  "name": "technical-debt-tracker",
  "version": "1.0.0",
  "domain": "quality",
  "status": "draft",
  "phase": 7,
  "req_id": "N23"
}
```

`scripts/validate-skills.sh` must pass (exit 0) after registration.

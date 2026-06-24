---
name: technical-debt-tracker
version: 1.0.0
domain: quality
description: >
  Use when recording, querying, or reporting on accumulated technical debt across pipeline
  sessions, or when projecting remediation costs and prioritizing a fix backlog. Triggers on:
  "track technical debt", "show debt score", "debt register", "what is our debt trend",
  "remediation backlog". Do NOT use for single-run code quality review — use clean-code-review
  instead.
author: system
---

## Purpose

`technical-debt-tracker` provides the ASE-OS pipeline with persistent, cross-session memory of code quality issues. Where `clean-code-review` surfaces issues in the current run only, this skill maintains a deduplicating debt register across all pipeline sessions for a given project. Each session of `clean-code-review` contributes issues; this skill consolidates them, computes a weighted debt score (0–100, lower is better), calculates a compound-interest maintenance cost projection, determines the debt trend over the most recent three sessions, and produces a ROI-ranked remediation backlog. Output feeds `feature-planning` so sprint planning can account for remediation capacity alongside new feature work.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `operation` | `string` | Yes | `"record"` \| `"query"` \| `"report"` \| `"resolve"` |
| `code_review_output` | `object` | Conditional | Output from `clean-code-review`. Required when `operation = "record"` |
| `module_filter` | `string` | No | Limit query/report results to a specific module name |
| `resolve_ids` | `array[string]` | Conditional | Debt item IDs to mark resolved. Required when `operation = "resolve"` |
| `session_id` | `string` | Yes | Current session identifier — used for session_count tracking |
| `project_id` | `string` | Yes | Project scope for the debt register. Registers are isolated per `project_id` |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "operation": {
      "type": "string",
      "enum": ["record", "query", "report", "resolve"]
    },
    "code_review_output": {
      "type": "object",
      "description": "Output from clean-code-review. Required when operation=record"
    },
    "module_filter": {
      "type": "string",
      "description": "Filter results to a specific module name"
    },
    "resolve_ids": {
      "type": "array",
      "items": { "type": "string" },
      "minItems": 1,
      "description": "Debt item IDs to mark resolved. Required when operation=resolve"
    },
    "session_id":  { "type": "string", "minLength": 1 },
    "project_id":  { "type": "string", "minLength": 1 }
  },
  "required": ["operation", "session_id", "project_id"],
  "if":   { "properties": { "operation": { "const": "record" } } },
  "then": { "required": ["code_review_output"] },
  "else": {
    "if":   { "properties": { "operation": { "const": "resolve" } } },
    "then": { "required": ["resolve_ids"] }
  }
}
```

## Required Context

- `state-manager@^1.1.0` must be available to read and write the persistent debt register (keyed by `project_id`).
- Prior `clean-code-review` output is required for `operation = "record"`. The `issues` array from that output must contain items with at least `module`, `issue_type`, `severity`, and `location` fields.
- At least 3 prior session debt scores must be stored in state to produce a meaningful `debt_trend`; fewer than 3 sessions returns `"stable"`.

## Execution Logic

```
Step 1 — Load debt register from state
  Read debt_register from state-manager keyed by project_id.
  If no register exists: initialize empty debt_register = [].
  Read session_score_history[] from state for this project_id.
  Apply module_filter to working_register if provided.
  Output: existing_register[], session_score_history[]

Step 2 — Apply operation-specific logic

  operation = "record":
    Proceed to Steps 3–8.

  operation = "query":
    Filter existing_register by status: "open" (default).
    Apply module_filter if provided.
    Return filtered debt_register.
    NO state write. Skip Steps 3–8.

  operation = "report":
    Compute debt_score, debt_trend, maintenance_cost_projection, remediation_backlog
    from existing_register without modification.
    Apply module_filter if provided.
    Return full report output.
    NO state write. Skip Steps 3, 4 write logic.

  operation = "resolve":
    For each id in resolve_ids:
      Find matching item in existing_register by debt_id.
      If found: set status = "resolved", set resolved_at = now().
      If not found: emit warning feedback with unmatched ID.
    Recalculate debt_score after resolution.
    Write updated register to state-manager.
    Return updated debt_register and new debt_score.
    Skip Steps 3–6.

Step 3 — Deduplicate and merge new issues (record only)
  For each issue in code_review_output.issues:
    Compute dedup_key = module + "|" + issue_type + "|" + location
    MATCH: dedup_key exists in existing_register AND status = "open":
      Increment session_count.
      Update last_seen = now().
    NEW: dedup_key not found OR status = "resolved":
      Assign debt_id = "DEBT-" + zero_padded_sequence (e.g., DEBT-001).
      Set: first_seen = now(), last_seen = now(), session_count = 1, status = "open".
      Estimate estimated_fix_hours from severity:
        critical = 4.0h, major = 2.0h, minor = 0.5h (defaults; overridden if code_review_output provides estimates)
  Existing open items absent from new review: keep status = "open" (absence ≠ resolved).
  Output: merged_register[]

Step 4 — Calculate debt score
  severity_weights: { critical: 10, major: 5, minor: 1 }
  raw_score = Σ(severity_weight[item.severity] × item.session_count)
              for all items WHERE item.status = "open"
  max_expected_raw = 500  (normalization ceiling)
  debt_score = min(100, round((raw_score / max_expected_raw) × 100, 1))
  Lower score = healthier codebase.
  Output: debt_score (0.0–100.0)

Step 5 — Determine debt trend
  Read prior 3 session debt scores from session_score_history[].
  IF fewer than 3 prior sessions: debt_trend = "stable"
  ELSE:
    prior_3 = last 3 scores in session_score_history (chronological order)
    "improving" if debt_score < min(prior_3)
    "degrading" if debt_score > max(prior_3)
    "stable"    otherwise
  Append current debt_score to session_score_history.
  Output: debt_trend

Step 6 — Project maintenance cost
  total_fix_hours = Σ(item.estimated_fix_hours) for all open items
  interest_rate_per_month = 0.15
  fix_now_hours          = total_fix_hours
  deferred_30_days_hours = round(total_fix_hours × 1.15, 1)
  deferred_90_days_hours = round(total_fix_hours × (1.15 ^ 3), 1)
  Output: maintenance_cost_projection { fix_now_hours, deferred_30_days_hours, deferred_90_days_hours }

Step 7 — Rank remediation backlog
  For each open debt item: roi_score = estimated_fix_hours / (severity_weight × session_count)
    Lower roi_score = higher priority (cheapest fix relative to debt weight = quick win)
  Sort open items ascending by roi_score.
  Return top 10 items as remediation_backlog[].
  Output: remediation_backlog[] (max 10 items)

Step 8 — Write state and emit feedback
  Write merged_register to state-manager (project_id scope).
  Write updated session_score_history to state-manager.
  Emit feedback:
    IF debt_score > 80:
      → { type: "backpropagate", from_skill: "technical-debt-tracker",
          target_skill: "clean-code-review", reason: "debt_score_critical",
          evidence: { debt_score: N, open_items: M } }
    IF debt_trend = "degrading":
      → { type: "warning", from_skill: "technical-debt-tracker",
          target_skill: "orchestrator", reason: "debt_trend_degrading",
          evidence: { debt_trend: "degrading", debt_score: N } }
  Output: finalized feedback[]
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `debt_register` | `array[object]` | All active debt items: `debt_id`, `module`, `issue_type`, `severity`, `first_seen`, `last_seen`, `session_count`, `estimated_fix_hours`, `status` |
| `debt_score` | `number` | Weighted score 0–100. Lower = less debt |
| `debt_trend` | `string` | `"improving"` \| `"stable"` \| `"degrading"` vs. prior 3 sessions |
| `maintenance_cost_projection` | `object` | `fix_now_hours`, `deferred_30_days_hours`, `deferred_90_days_hours` |
| `remediation_backlog` | `array[object]` | Top 10 debt items ranked by ROI (quick wins first) |
| `metrics` | `object` | **REQUIRED.** Execution metrics |
| `feedback` | `array[object]` | **REQUIRED.** Backpropagation entries for `clean-code-review` and orchestrator |

**Output Schema:**

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
          "debt_id":             { "type": "string", "pattern": "^DEBT-[0-9]{3,}$" },
          "module":              { "type": "string" },
          "issue_type":          { "type": "string" },
          "severity":            { "type": "string", "enum": ["critical", "major", "minor"] },
          "first_seen":          { "type": "string", "format": "date-time" },
          "last_seen":           { "type": "string", "format": "date-time" },
          "session_count":       { "type": "integer", "minimum": 1 },
          "estimated_fix_hours": { "type": "number",  "minimum": 0 },
          "status":              { "type": "string",  "enum": ["open", "resolved"] }
        },
        "required": ["debt_id", "module", "issue_type", "severity",
                     "first_seen", "last_seen", "session_count", "status"]
      }
    },
    "debt_score":  { "type": "number",  "minimum": 0, "maximum": 100 },
    "debt_trend":  { "type": "string",  "enum": ["improving", "stable", "degrading"] },
    "maintenance_cost_projection": {
      "type": "object",
      "properties": {
        "fix_now_hours":          { "type": "number", "minimum": 0 },
        "deferred_30_days_hours": { "type": "number", "minimum": 0 },
        "deferred_90_days_hours": { "type": "number", "minimum": 0 }
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
          "session_count":       { "type": "integer" },
          "roi_score":           { "type": "number" }
        },
        "required": ["debt_id", "module", "issue_type", "severity", "roi_score"]
      }
    },
    "metrics":  { "$ref": "#/$defs/metrics" },
    "feedback": { "type": "array", "items": { "$ref": "#/$defs/feedback_entry" } }
  },
  "required": ["debt_register", "debt_score", "debt_trend",
               "maintenance_cost_projection", "remediation_backlog", "metrics", "feedback"],
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

- `code_review_output` is **mandatory** when `operation = "record"`. Reject if absent.
- `resolve_ids` is **mandatory** when `operation = "resolve"`. Reject if absent or empty.
- `operation = "query"` and `operation = "report"` are **read-only** — they MUST NOT write to state.
- Deduplication key is computed as `module + "|" + issue_type + "|" + location`. Items are never duplicated on this key for `status: open` items.
- Absence of an issue from a new review does NOT automatically mark it resolved — only explicit `operation = "resolve"` with `resolve_ids` marks items as resolved.
- `debt_score` formula: `min(100, round((Σ(weight × session_count) / 500) × 100, 1))`. Ceiling is 100. Floor is 0.
- Severity weights are fixed: `critical = 10`, `major = 5`, `minor = 1`. These are not configurable per invocation.
- `maintenance_cost_projection` uses a **compound** interest model: `hours × (1.15 ^ months)`. Do not use simple interest.
- `remediation_backlog` contains at most 10 items. When fewer than 10 open items exist, return all open items.
- The skill MUST NOT auto-resolve debt items based on absence — only on explicit `resolve_ids`.
- Cross-project debt registers are strictly isolated by `project_id`. A `project_id` MUST NOT read another project's register.

## Security Considerations

- `project_id` and `session_id` values are used as state storage keys — validate that they contain only alphanumeric characters, hyphens, and underscores to prevent path traversal in state-manager.
- `code_review_output` is treated as structured input — never execute, eval, or shell-expand any field from it.
- `debt_register` stored in `state-manager` should be scoped to the project and not accessible cross-project. Enforce via `project_id` namespace prefix in state keys: `debt_register:{project_id}`.
- `estimated_fix_hours` defaults are system-assigned by severity — do not accept caller-supplied hour estimates without bounds checking (max 40h per item).

## Token Optimization

- Load only the `debt_register` slice for the requested `project_id` — do not load all project registers.
- For `operation = "query"`: apply `module_filter` before returning results, not after. Avoids loading full register when only a subset is needed.
- For `operation = "report"`: return `remediation_backlog` as the primary signal to `feature-planning`. Pass full `debt_register` only when explicitly requested.
- Prune `resolved` items from the working register before sending to downstream skills — resolved items are stored in state but not included in report outputs by default.
- Session score history: store only the last 10 session scores per project to cap state growth.

## Quality Checklist

- [ ] `operation` validated against allowed enum before any processing
- [ ] Conditional requirements validated: `code_review_output` present for `record`, `resolve_ids` present for `resolve`
- [ ] Deduplication key correctly computed as `module + "|" + issue_type + "|" + location`
- [ ] `debt_score` formula applies correct weights and normalization ceiling
- [ ] `debt_trend` computed from prior 3 session scores only (not all history)
- [ ] `maintenance_cost_projection` uses compound not simple interest at 15% per month
- [ ] `remediation_backlog` sorted ascending by `roi_score` (lower = higher priority)
- [ ] Feedback emitted to `clean-code-review` when `debt_score > 80`
- [ ] Feedback emitted to orchestrator when `debt_trend = "degrading"`
- [ ] State write occurs only for `record` and `resolve` operations

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| `operation = "record"` but `code_review_output` missing | Reject: `{"error": "MISSING_CODE_REVIEW_OUTPUT"}` |
| `operation = "resolve"` but `resolve_ids` missing or empty | Reject: `{"error": "MISSING_RESOLVE_IDS"}` |
| `state-manager` unavailable | Return `{"error": "STATE_UNAVAILABLE"}`; do not produce partial output |
| `resolve_ids` contains IDs not found in register | Emit `warning` feedback with `unmatched_ids`; process remaining valid IDs |
| `debt_score > 80` on first session (no history) | Set `debt_trend = "stable"` (insufficient history); still emit `debt_score_critical` feedback |
| `code_review_output.issues` is empty | Record no new items; recalculate score from existing register only |

## 12. Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Behavior |
|------|---------|---------|----------|
| Critical debt score spike | `debt_score > 80` AND `debt_trend = "degrading"` in same session | 3600s | Pause pipeline; present full remediation backlog and cost projection to tech lead for prioritization decision before feature-planning proceeds |

Gate behavior: `pause` — pipeline halts, tech lead is notified with debt score, trend, and top 10 backlog items. Execution resumes on explicit acknowledgment. Auto-continues after timeout with `gate_skipped` log entry.

## 13. Skill Composition

`technical-debt-tracker` runs automatically after `clean-code-review` on every code-changed cycle:

```yaml
composes:
  - skill: technical-debt-tracker
    version: "^1.0.0"
    input_map:
      operation:           "record"
      code_review_output:  "clean_code_review.output"
      session_id:          "session.id"
      project_id:          "session.project_id"
    output_map:
      debt_score:           "state.debt.score"
      debt_trend:           "state.debt.trend"
      remediation_backlog:  "state.debt.backlog"

  - skill: feature-planning
    version: "^2.0.0"
    condition: "state.debt.backlog.length > 0"
    input_map:
      debt_backlog: "state.debt.backlog"
      debt_score:   "state.debt.score"
```

On-demand report invocation:

```yaml
  - skill: technical-debt-tracker
    version: "^1.0.0"
    input_map:
      operation:  "report"
      project_id: "session.project_id"
      session_id: "session.id"
```

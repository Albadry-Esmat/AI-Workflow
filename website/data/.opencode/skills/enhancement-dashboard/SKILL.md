---
name: enhancement-dashboard
version: 1.1.0
domain: system
description: 'Use when rendering a human-readable performance dashboard from session insights. Triggers on: "show dashboard", "performance dashboard", "skill performance report", "session insights report", "what are the insights". Read-only — never modifies system state. Requires session-insights (SKL-048) to have produced a session_summary first.'
author: ASE-OS
---

# Enhancement Dashboard

**Version:** 1.0.0 | **Last updated:** 2026-06-20

Renders the `session_summary` produced by `session-insights` (SKL-048) as a structured Markdown + JSON report. Provides a human-readable view of per-skill performance, HITL patterns, anomaly flags, and session-level health. Strictly read-only — no system state is modified.

---

## 1. Skill Header

```yaml
name: enhancement-dashboard
version: 1.0.0
domain: system
description: >
  Read-only dashboard renderer. Converts session_insights summary into a
  structured Markdown report. Never modifies system state.
author: ASE-OS
```

---

## 2. Purpose

`enhancement-dashboard` is the final, user-facing layer of the lightweight observability pipeline:

```
behavioral-telemetry-collector (SKL-047)
              ↓  events
session-insights (SKL-048)
              ↓  session_summary
enhancement-dashboard (SKL-049)   ← this skill
              ↓  Markdown + JSON report
             User
```

It produces two representations of the same data:

1. **Structured Markdown** — a human-readable table-based dashboard with sections for per-skill performance, HITL patterns, anomalies, and a session health verdict.
2. **Raw JSON** — the `session_summary` object verbatim, suitable for programmatic consumption or archiving.

**No suggestions, no registry mutations, no pipeline modifications.** The dashboard is purely observational.

---

## 3. Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `session_summary` | `object` | Yes | The `behavioral_telemetry.session_summary` from state-manager (produced by SKL-048) |
| `session_id` | `string` | Yes | UUID v4 — displayed in report header for traceability |
| `pipeline_template` | `string` | No | Pipeline template name — displayed in report header |
| `render_format` | `string` | No | `markdown` (default) or `json_only` |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["session_summary", "session_id"],
  "additionalProperties": false,
  "properties": {
    "session_summary": {
      "type": "object",
      "description": "behavioral_telemetry.session_summary from state-manager."
    },
    "session_id":       { "type": "string", "format": "uuid" },
    "pipeline_template": { "type": "string" },
    "render_format": {
      "type": "string",
      "enum": ["markdown", "json_only"],
      "default": "markdown"
    }
  }
}
```

---

## 4. Required Context

- `session_summary` must be read from `state-manager.read(scope: "behavioral_telemetry").session_summary` before invocation.
- If `session_summary` is absent or `session_insights` was skipped (opt-out), return a minimal dashboard indicating no telemetry available.
- This skill reads no other state-manager keys.

---

## 5. Execution Logic

```
Step 1 — Check for available summary
  IF session_summary is null or empty:
    Return: {
      markdown_report: "## Enhancement Dashboard\n\nNo telemetry available for this session.\n",
      json_report: null,
      sections_rendered: 0
    }
  Output: valid_summary = true

Step 2 — Render header section
  Build:
    ## Enhancement Dashboard
    **Session:** <session_id>
    **Pipeline:** <pipeline_template or "unknown">
    **Generated:** <session_summary.generated_at>
    **Pipeline Success:** ✅ or ❌ or — (if null)

Step 3 — Render session overview table
  Build Markdown table:
    | Metric | Value |
    |--------|-------|
    | Total Skills Invoked   | <total_skills_invoked> |
    | HITL Gates Encountered | <total_hitl_gates> |
    | HITL Approval Rate     | <hitl_approval_rate as % or "N/A"> |
    | Feedback Loops         | <feedback_loop_count> |
    | Anomalies Detected     | <anomaly_count> |

Step 4 — Render per-skill performance table
  IF skill_performance is empty:
    Render: "> No skill execution data available."
  ELSE:
    Build Markdown table with columns:
      | Skill | Invocations | Success Rate | Failure Rate | p95 Latency (ms) | HITL Rejection % | Flags |
    For each skill in skill_performance (sorted by invocation_count DESC):
      success_rate_pct     = (success_rate * 100).toFixed(1) + "%"
      failure_rate_pct     = (failure_rate * 100).toFixed(1) + "%" or "—"
      p95_display          = p95_duration_ms or "—"
      hitl_rejection_pct   = (hitl_rejection_ratio * 100).toFixed(1) + "%" or "—"
      flags                = "⚠️ high failure" if high_failure_rate
                           + " ⚠️ high rejection" if high_rejection_ratio
                           + "✅" if no flags
      Append row to table.

Step 5 — Render anomalies section (if any)
  IF anomalies is empty or anomaly_count == 0:
    Render: "> ✅ No anomalies detected in this session."
  ELSE:
    ### Anomalies
    For each anomaly:
      - **<skill_name>**: <flag> — observed value: <value * 100>%
    Note: Anomalies are informational only. No automatic action is taken.

Step 5a — Render Token Efficiency tab (TASK-0066)
  IF session_summary.token_efficiency is null or absent:
    Render: "> No token consumption data available for this session."
  ELSE:
    ### Token Efficiency
    **Total Tokens Consumed:** <total_tokens_consumed>
    **Cache Hit Rate:** <cache_hit_rate as %> | **Compression Events:** <compression_events>
    IF vs_baseline is not null:
      **vs. Pre-Phase-4 Baseline:** <vs_baseline * 100>% (<positive = regression, negative = improvement>)
    ELSE:
      **vs. Baseline:** — (no baseline recorded yet)

    Build Markdown bar chart (ASCII) — tokens per skill, descending:
      | Skill | Tokens | % of Total | Outlier |
      |-------|--------|------------|---------|
      For each entry in by_skill (sorted DESC by tokens):
        outlier_flag = "⚠️ p90 outlier" if skill is in outlier_skills ELSE "✅"
        Append row.

    IF outlier_skills is non-empty:
      Render note: "⚠️ Skills above p90 token usage — consider model downgrade or output pruning.
      See adaptive-proposal-generator for actionable suggestions."

Step 6 — Render session health verdict
  ### Session Health
  IF pipeline_success == true AND anomaly_count == 0:
    Verdict: "✅ Healthy — pipeline succeeded with no anomalies."
  ELSE IF pipeline_success == true AND anomaly_count > 0:
    Verdict: "⚠️ Degraded — pipeline succeeded but <N> anomalies detected."
  ELSE IF pipeline_success == false:
    Verdict: "❌ Failed — pipeline did not complete successfully."
  ELSE:
    Verdict: "— Pipeline outcome unknown."

Step 7 — Assemble and return output
  markdown_report = concatenate all rendered sections (Steps 2–5a, 6)
  json_report     = session_summary (verbatim, JSON formatted)
  IF render_format == "json_only":
    Return: { markdown_report: null, json_report, sections_rendered: 0 }
  ELSE:
    Return: { markdown_report, json_report, sections_rendered: 6 }
```

---

## 6. Outputs

| Field | Type | Description |
|-------|------|-------------|
| `markdown_report` | `string\|null` | Fully rendered Markdown dashboard (null if `render_format: json_only`) |
| `json_report` | `object\|null` | Raw `session_summary` JSON (null if no telemetry available) |
| `sections_rendered` | `integer` | Number of Markdown sections rendered (0 if no telemetry or json_only) |
| `metrics` | `object` | This skill's own execution metrics (REQUIRED standard field) |
| `feedback` | `array[object]` | Feedback to orchestrator (empty for this read-only skill) |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["markdown_report", "json_report", "sections_rendered", "metrics", "feedback"],
  "properties": {
    "markdown_report":  { "type": ["string", "null"] },
    "json_report":      { "type": ["object", "null"] },
    "sections_rendered": { "type": "integer", "minimum": 0 },
    "metrics":  { "$ref": "#/$defs/metrics" },
    "feedback": { "type": "array", "items": { "$ref": "#/$defs/feedback_entry" } }
  },
  "$defs": {
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
    "feedback_entry": {
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
```

---

## 7. Rules & Constraints

- **Read-only** — this skill NEVER writes to system state.
- **No suggestions, no routing changes, no registry mutations.** The dashboard is purely informational.
- Anomaly flags are displayed as informational labels only — they do not block pipeline continuation.
- If `session_summary` is absent, a minimal "no telemetry" report is returned — not an error.
- Markdown output must not reproduce any raw event data — only aggregated statistics.
- `render_format: json_only` suppresses Markdown output entirely (returns `null`).
- Per-skill table is sorted by `invocation_count` descending to surface most-used skills first.
- This skill does not trigger any HITL gate, feedback loop, or downstream skill.

---

## 8. Security Considerations

- Reads only `session_summary` — does not have access to raw telemetry events.
- `session_summary` contains only aggregated statistics (rates, counts, latencies) — no user content reproduced.
- `markdown_report` output does not reproduce any string field from user inputs.
- Read-only state access — `state-manager` scope: `behavioral_telemetry` (read only, no write).

---

## 9. Token Optimization

- Dashboard Markdown is compact: ~50–200 tokens for typical session (10–20 skills).
- `json_report` is the `session_summary` verbatim — already compact from SKL-048.
- No state writes — no write-back overhead.
- `render_format: json_only` further reduces output when Markdown is not needed.

---

## 10. Quality Checklist

- [ ] Returns minimal report when `session_summary` is absent — not an error
- [ ] Per-skill table sorted by invocation_count DESC
- [ ] Anomaly flags rendered as informational only (no pipeline action)
- [ ] No raw event data reproduced in output
- [ ] `render_format: json_only` suppresses Markdown output correctly
- [ ] Health verdict correctly maps pipeline_success + anomaly_count to verdict string
- [ ] `sections_rendered` reflects actual Markdown sections built
- [ ] Metrics standard fields all present
- [ ] `feedback` array present and empty (this skill has no feedback routes)
- [ ] Output is valid JSON matching output schema

---

## 11. Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| `session_summary` absent or null | Return minimal "no telemetry" Markdown report; `sections_rendered: 0` |
| `skill_performance` array empty | Render "No skill execution data available" in per-skill section |
| `anomalies` array empty | Render "No anomalies detected" in anomalies section |
| `pipeline_success` is null | Render "—" in health verdict; no error |
| `render_format` not recognized | Default to `markdown` |

---

## 12. Human-in-the-Loop Gates

This skill does **not** trigger HITL gates. It is a read-only renderer.

| Gate | Trigger | Behavior |
|------|---------|----------|
| None | N/A | No user interaction required |

The orchestrator MAY surface the `markdown_report` to the user at any time — this is orchestrator behavior, not a gate defined by this skill.

---

## 13. Skill Composition

`enhancement-dashboard` is invoked on-demand by the orchestrator (or directly by the user) after `session-insights` has run. It does not block any pipeline gate.

```yaml
# Invocation pattern (conceptual)
name: enhancement-dashboard-invocation
trigger: on-demand OR after session-insights completes
async: true
input_map:
  session_summary:    "state_manager.read(behavioral_telemetry).session_summary"
  session_id:         "session_context.session_id"
  pipeline_template:  "session_context.pipeline_template"
  render_format:      "markdown"  # default

consumes_from:
  - session-insights (SKL-048)   # must have written session_summary first

produces_for: []  # read-only — no downstream skill
```

### Dashboard Output Example

```markdown
## Enhancement Dashboard
**Session:** a1b2c3d4-0000-4000-8000-000000000001
**Pipeline:** full-pipeline
**Generated:** 2026-06-20T14:32:00Z
**Pipeline Success:** ✅

### Session Overview
| Metric | Value |
|--------|-------|
| Total Skills Invoked   | 12 |
| HITL Gates Encountered | 4 |
| HITL Approval Rate     | 100.0% |
| Feedback Loops         | 1 |
| Anomalies Detected     | 0 |

### Per-Skill Performance
| Skill | Invocations | Success Rate | p95 Latency (ms) | HITL Rejection % | Flags |
|-------|-------------|--------------|------------------|------------------|-------|
| architecture-design | 2 | 100.0% | 18,200 | — | ✅ |
| requirement-analyzer | 1 | 100.0% | 9,400 | — | ✅ |
| security-review | 1 | 100.0% | 14,800 | 0.0% | ✅ |

### Anomalies
> ✅ No anomalies detected in this session.

### Session Health
✅ Healthy — pipeline succeeded with no anomalies.
```

### Changelog

| Version | Date | Change |
|---------|------|--------|
| 1.0.0 | 2026-06-20 | Initial version — Markdown + JSON dashboard renderer; per-skill table, session overview, anomaly section, health verdict; read-only |

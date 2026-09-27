---
name: cost-estimator
version: 1.0.0
domain: utility
description: 'Use at pipeline entry to compute a pre-run token cost estimate, present it to the user for approval, and write a post-run cost report comparing actuals to the estimate. Maintains a rolling cost history in artifacts/cost-history.json (capped at 100 runs) to improve estimate accuracy over time. Triggers on: "cost estimate", "token estimate", "how much will this cost", "cost check", "token budget", "pre-run estimate", "estimate pipeline cost".'
author: system
---

## Purpose

Estimate the token cost of a planned pipeline run before execution begins. Present the
estimate to the user with a cost band classification (low / medium / high) and request
approval. If the user rejects the estimate, abort cleanly before any skill executes.

After the pipeline completes, write a post-run cost report comparing actual token usage
to the pre-run estimate. Maintain a rolling history in `artifacts/cost-history.json`
(capped at 100 entries) to improve estimate accuracy over time using a rolling average
multiplier.

This skill runs as the first step in `full-pipeline.json` (phase-0-cost-estimate).
It may be skipped in CI mode (`skip_cost_check: true`).

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `pipeline_id` | `string` | Yes | ID of the pipeline template being run (e.g. `"full-pipeline"`, `"quick-review"`). |
| `pipeline_phases` | `array[object]` | Yes | Phases from the pipeline config. Used to count skills and estimate per-phase token cost. |
| `user_input_text` | `string` | Yes | The raw user prompt or feature request text. Used to estimate input token length. |
| `skip_cost_check` | `boolean` | No | When `true`, skip the HITL approval gate and proceed immediately. For CI / non-interactive environments. Default: `false`. |
| `cost_band_thresholds` | `object` | No | Override cost band boundaries. Default: `{ low: 50000, medium: 200000 }` (tokens). High = anything above medium. |
| `mode` | `string` | No | `"pre_run"` (estimate + HITL) or `"post_run"` (write report + update history). Default: `"pre_run"`. |
| `actual_tokens` | `object` | No | Required when `mode="post_run"`. `{ total_in, total_out }` from completed pipeline run. |
| `run_id` | `string` | No | Pipeline run identifier. Used in cost report filename and history entry. |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["pipeline_id", "pipeline_phases", "user_input_text"],
  "properties": {
    "pipeline_id":      { "type": "string" },
    "pipeline_phases":  { "type": "array", "items": { "type": "object" } },
    "user_input_text":  { "type": "string" },
    "skip_cost_check":  { "type": "boolean", "default": false },
    "cost_band_thresholds": {
      "type": "object",
      "properties": {
        "low":    { "type": "integer", "minimum": 1 },
        "medium": { "type": "integer", "minimum": 1 }
      }
    },
    "mode":    { "type": "string", "enum": ["pre_run", "post_run"], "default": "pre_run" },
    "actual_tokens": {
      "type": "object",
      "properties": {
        "total_in":  { "type": "integer", "minimum": 0 },
        "total_out": { "type": "integer", "minimum": 0 }
      }
    },
    "run_id": { "type": "string" }
  }
}
```

## Required Context

- `pipeline_phases` from `pipeline_config.phases` — used to count skills per phase and compute the skill_count multiplier.
- `artifacts/cost-history.json` (if it exists) — loaded to compute the rolling average multiplier from past runs.

## Execution Logic

```
Step 1 — Load historical multiplier (pre_run mode only)
  IF artifacts/cost-history.json exists AND has >= 5 entries:
    Load last 20 entries from cost-history.json.
    For each entry: compute actual_ratio = entry.actual_total / entry.estimated_total
    rolling_avg_multiplier = mean(actual_ratio[] for last 20 entries)
    confidence = "medium" if 5 <= entry count < 20, else "high"
  ELSE:
    rolling_avg_multiplier = 1.4  (conservative default for first runs)
    confidence = "low"
  Output: rolling_avg_multiplier, confidence

Step 2 — Estimate input tokens (pre_run mode only)
  input_char_count = len(user_input_text)
  estimated_input_tokens = ceil(input_char_count / 4)  (4 chars ≈ 1 token heuristic)
  Output: estimated_input_tokens

Step 3 — Count skills and estimate per-skill tokens (pre_run mode only)
  skill_count = sum(len(phase.skills) for phase in pipeline_phases)
  conditional_phases = count of phases with a non-null "condition" field
  effective_skill_count = skill_count - floor(conditional_phases * 0.4)
    (Conditional phases execute ~60% of the time on average — discount 40%)

  per_skill_base_tokens = 8000  (empirical average: 4K in + 4K out per skill invocation)
  base_total = estimated_input_tokens + (effective_skill_count * per_skill_base_tokens)

  estimated_total = ceil(base_total * rolling_avg_multiplier)
  Output: estimated_total, skill_count, effective_skill_count

Step 4 — Classify cost band (pre_run mode only)
  thresholds = cost_band_thresholds or { low: 50000, medium: 200000 }
  IF estimated_total <= thresholds.low:
    band = "low"
    band_description = "Minimal cost — well within typical budget."
  ELSE IF estimated_total <= thresholds.medium:
    band = "medium"
    band_description = "Moderate cost — review estimate before proceeding."
  ELSE:
    band = "high"
    band_description = "High cost — consider reducing pipeline scope or confirm budget."
  Output: band, band_description

Step 5 — HITL gate: present estimate and request approval (pre_run mode only)
  IF skip_cost_check = true:
    Log INFO: "Cost check skipped (skip_cost_check=true)". Proceed.
    Set approval_status = "skipped"
  ELSE:
    Present to user:
      """
      ## Pipeline Cost Estimate

      Pipeline:    {pipeline_id}
      Skills:      {skill_count} total, ~{effective_skill_count} expected to run
      Estimated:   ~{estimated_total:,} tokens  [{band.upper()} COST]
      Confidence:  {confidence} ({X} historical runs used)

      {band_description}

      Reply YES to proceed, NO to abort, or REDUCE to proceed with only required phases.
      """
    Wait for response (timeout: 120s).
    On timeout: treat as YES (proceed). Log INFO "Cost gate auto-advanced on timeout."
    On "NO" (case-insensitive): emit info feedback, set approval_status="rejected", return early.
    On "REDUCE": emit info, set approval_status="reduced", record note for orchestrator.
    On "YES" or timeout: set approval_status="approved"
  Output: approval_status

Step 6 — Return pre-run output (pre_run mode only)
  Return:
    estimated_total, band, confidence, skill_count, approval_status
  End of pre_run mode.

Step 7 — Post-run: compute actuals and accuracy (post_run mode only)
  actual_total = actual_tokens.total_in + actual_tokens.total_out
  accuracy_pct = min(100, (min(estimated_total_from_history, actual_total) /
                           max(estimated_total_from_history, actual_total)) * 100)
    where estimated_total_from_history = last pre_run entry for this run_id
  over_under = "over" if actual_total > estimated_total_from_history else "under"
  delta_pct = abs(actual_total - estimated_total_from_history) / estimated_total_from_history * 100
  Output: actual_total, accuracy_pct, delta_pct, over_under

Step 8 — Write post-run cost report (post_run mode only)
  Write to artifacts/cost-report-{run_id}-{timestamp}.md:
  ---
  # Pipeline Cost Report — {run_id}

  | Field | Value |
  |-------|-------|
  | Pipeline | {pipeline_id} |
  | Run ID | {run_id} |
  | Generated | {timestamp} |
  | Estimated Tokens | {estimated_total:,} ({band}) |
  | Actual Tokens | {actual_total:,} |
  | Accuracy | {accuracy_pct:.1f}% ({delta_pct:.1f}% {over_under}) |
  | Confidence at Estimate | {confidence} |

  ## Breakdown
  | Category | Tokens |
  |----------|--------|
  | Input (actual) | {actual_tokens.total_in:,} |
  | Output (actual) | {actual_tokens.total_out:,} |
  | Total (actual) | {actual_total:,} |
  ---
  Output: report_path

Step 9 — Update cost history (post_run mode only)
  Load artifacts/cost-history.json (or initialize as []).
  Append entry:
    {
      "run_id": run_id,
      "pipeline_id": pipeline_id,
      "timestamp": ISO timestamp,
      "estimated_total": estimated_total_from_history,
      "actual_total": actual_total,
      "actual_ratio": actual_total / estimated_total_from_history,
      "band": band,
      "confidence_at_estimate": confidence,
      "skill_count": skill_count
    }
  If len(history) > 100: remove oldest entries until len = 100.
  Write back to artifacts/cost-history.json (atomic write).
  Output: history_entry_count (after append)

Step 10 — Emit telemetry and return
  Return output.
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `estimated_total` | `integer` | Estimated total token count for the pipeline run. |
| `band` | `string` | Cost band: `"low"`, `"medium"`, or `"high"`. |
| `confidence` | `string` | Estimate confidence: `"low"` (< 5 history entries), `"medium"` (5–19), `"high"` (20+). |
| `skill_count` | `integer` | Total number of skills in the pipeline. |
| `approval_status` | `string` | `"approved"`, `"skipped"`, `"rejected"`, or `"reduced"`. |
| `report_path` | `string` \| `null` | Path to post-run cost report. `null` in `pre_run` mode. |
| `history_entry_count` | `integer` \| `null` | Number of entries in cost-history.json after update. `null` in `pre_run` mode. |
| `metrics` | `object` | `tokens_in`, `tokens_out`, `duration_ms`, `items_produced`, `version`. |
| `feedback` | `array[object]` | Feedback loop entries. |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["estimated_total", "band", "confidence", "skill_count", "approval_status", "report_path", "history_entry_count", "metrics", "feedback"],
  "properties": {
    "estimated_total":      { "type": "integer", "minimum": 0 },
    "band":                 { "type": "string", "enum": ["low", "medium", "high"] },
    "confidence":           { "type": "string", "enum": ["low", "medium", "high"] },
    "skill_count":          { "type": "integer", "minimum": 0 },
    "approval_status":      { "type": "string", "enum": ["approved", "skipped", "rejected", "reduced"] },
    "report_path":          { "type": ["string", "null"] },
    "history_entry_count":  { "type": ["integer", "null"], "minimum": 0 },
    "metrics":              { "type": "object" },
    "feedback":             { "type": "array", "items": { "type": "object" } }
  }
}
```

## Rules & Constraints

- `approval_status: "rejected"` MUST cause the orchestrator to abort the pipeline immediately with a clean exit. No skill after cost-estimator executes.
- `approval_status: "skipped"` is valid and must not be treated as an error.
- `cost-history.json` is capped at 100 entries — oldest entries pruned on overflow.
- The estimate algorithm (input_tokens × skill_count × rolling_avg_multiplier) intentionally errs conservative (overestimates). This is by design — surprises should be positive.
- Confidence labels: `"low"` means the estimate has high uncertainty (warn user), `"high"` means the rolling average is well-calibrated.
- `post_run` mode MUST look up the pre-run estimate for the same `run_id` from `cost-history.json`. If no matching entry is found, skip accuracy computation and write report with "estimate not found" note.
- `artifacts/cost-history.json` must be written atomically (write to temp file, then rename) to prevent corruption on crash.

## Security Considerations

- `cost-history.json` contains metadata about past pipeline runs (pipeline IDs, token counts, timestamps). This is non-sensitive operational data, but it should not include prompt content, requirements text, or user identifiers.
- `user_input_text` is used only for token counting (character count divided by 4). The full text MUST NOT be written to `cost-history.json` or `cost-report-*.md`.
- Cost reports are written to `artifacts/` which is gitignored (except README). No cost data enters the git history.

## Token Optimization

- Token estimation uses a simple character-count heuristic (char_count / 4) — no LLM inference needed for estimation.
- `cost-history.json` is loaded lazily — only read when needed (pre_run mode), and only the last 20 entries are processed for the rolling average.
- The HITL gate is a single-message presentation — no multi-turn conversation needed.
- `post_run` mode is async and non-blocking: it writes the report after the pipeline completes and does not affect pipeline execution.

## Quality Checklist

- [ ] `rolling_avg_multiplier` loaded from history when >= 5 entries available
- [ ] `confidence` label set correctly: low (< 5), medium (5–19), high (20+)
- [ ] `effective_skill_count` discounts conditional phases by 40%
- [ ] `band` classification matches `cost_band_thresholds` (default: 50K/200K)
- [ ] HITL gate shows: pipeline_id, skill_count, estimated_total, band, confidence
- [ ] `approval_status: "rejected"` causes clean abort with no downstream skill execution
- [ ] Post-run report written to `artifacts/cost-report-{run_id}-{timestamp}.md`
- [ ] `cost-history.json` capped at 100 entries (oldest pruned)
- [ ] Atomic write used for `cost-history.json`
- [ ] `user_input_text` NOT written to history or report

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| `cost-history.json` read fails (file corrupt/permission denied) | Use default multiplier (1.4), confidence="low". Emit `warning`. Continue. |
| `cost-history.json` write fails | Emit `warning`. Pipeline continues — history update failure is non-fatal. |
| HITL gate timeout (120s) | Auto-advance as YES. Log INFO. |
| `mode="post_run"` with no matching `run_id` in history | Write report with `estimated_total: null` and accuracy: "estimate not found". Continue. |
| `actual_tokens` missing in `post_run` mode | Emit `warning`, skip post-run steps. |

## Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Behavior on Timeout |
|------|---------|---------|---------------------|
| Cost approval | `mode="pre_run"` AND `skip_cost_check=false` | 120s | Auto-advance as YES. Log INFO "Cost gate auto-advanced." |

## Skill Composition

`cost-estimator` v1.0.0 runs as `phase-0-cost-estimate` in `full-pipeline.json` — the first phase before any other skill executes.

```yaml
composes:
  - skill: cost-estimator
    version: "^1.0.0"
    input_map:
      pipeline_id:     "pipeline_config.id"
      pipeline_phases: "pipeline_config.phases"
      user_input_text: "session_context.raw_user_input"
      skip_cost_check: "pipeline_config.ci_mode"
    output_map:
      approval_status: "cost_approval_status"
      estimated_total: "estimated_pipeline_tokens"
      band:            "cost_band"

pipeline_position: phase-0-cost-estimate in full-pipeline.json
  Runs BEFORE prompt-normalizer (phase-0) — cost estimate is the very first step.
  If approval_status="rejected", pipeline halts with exit_reason="cost_rejected".

post_run_hook:
  Invoked by orchestrator after all phases complete (including doc-maintainer).
  Input: mode="post_run", actual_tokens from session_context.token_totals, run_id from session_id
```

# Token Cost Estimator

**Version:** 1.0.0 | **Skill:** SKL-118 `cost-estimator` | **Last updated:** 2026-07-09

---

## Overview

The **Token Cost Estimator** (`cost-estimator`) runs as the very first step of every
`full-pipeline.json` execution — before `prompt-normalizer`, before `requirement-analyzer`,
before any skill executes. It computes a pre-run estimate of how many tokens the pipeline
will consume, presents it to the user with a cost-band classification, and waits for
explicit approval before the pipeline proceeds.

After the pipeline completes, the estimator runs again in `post_run` mode to compare
actual token usage against the estimate, write a cost report to `artifacts/`, and update
a rolling history that makes future estimates progressively more accurate.

**Why it's useful:**

- Prevents surprise token bills on large pipelines (full-pipeline can use 150K–400K+ tokens).
- Gives users control: approve, reduce scope (REDUCE), or abort (NO) before any cost is incurred.
- Builds a self-improving accuracy model — early estimates use a conservative 1.4× multiplier;
  after 20+ runs the rolling average calibrates to your actual usage patterns.

**Where it runs:**

```
[User request]
      ↓
phase-0-cost-estimate  ← cost-estimator runs HERE
      ↓
phase-0  prompt-normalizer
      ↓
phase-1  requirement-analyzer
      ↓
  ... rest of pipeline ...
```

---

## Cost Bands

| Band | Token Range (default) | What it means |
|------|-----------------------|---------------|
| `low` | 0 – 50,000 tokens | Minimal cost — well within typical budget. Quick reviews, small features. |
| `medium` | 50,001 – 200,000 tokens | Moderate cost — review estimate before proceeding. Standard feature pipelines. |
| `high` | 200,001+ tokens | High cost — consider reducing pipeline scope or confirm budget. Full end-to-end builds. |

Thresholds can be overridden per invocation via the `cost_band_thresholds` input field
(see [Configuration Options](#configuration-options)).

---

## How Estimates Are Computed

The estimator uses a lightweight, LLM-free formula — no extra inference cost to produce
the estimate itself.

**Formula:**

```
estimated_total = ceil(
  (estimated_input_tokens + effective_skill_count × 8,000)
  × rolling_avg_multiplier
)
```

Where:

| Term | How it's calculated |
|------|---------------------|
| `estimated_input_tokens` | `ceil(len(user_input_text) / 4)` — 4 characters ≈ 1 token |
| `effective_skill_count` | Total skills in pipeline, minus 40% discount for conditional phases (which run ~60% of the time) |
| `8,000` | Empirical per-skill base: ~4K input + ~4K output tokens per skill invocation |
| `rolling_avg_multiplier` | Mean of `(actual_total / estimated_total)` over last 20 runs from history. Defaults to **1.4** (conservative) when < 5 runs exist. |

The multiplier **intentionally overestimates** — a positive surprise (spent less than expected)
is always better than a negative one.

---

## Confidence Levels

Confidence reflects how well-calibrated the rolling average multiplier is:

| Confidence | History Entries Used | Meaning |
|------------|----------------------|---------|
| `low` | < 5 runs | Default 1.4× multiplier in use. Estimate may be significantly off. |
| `medium` | 5 – 19 runs | Rolling average based on limited history. Estimate is directionally accurate. |
| `high` | 20+ runs | Rolling average is well-calibrated to your usage patterns. Estimate is reliable. |

The confidence level is always shown in the HITL approval message so users can factor
uncertainty into their decision.

---

## Approving or Rejecting an Estimate

When `mode="pre_run"` and `skip_cost_check=false` (the default), the estimator pauses
the pipeline and presents this message:

```
## Pipeline Cost Estimate

Pipeline:    full-pipeline
Skills:      18 total, ~14 expected to run
Estimated:   ~112,000 tokens  [MEDIUM COST]
Confidence:  low (2 historical runs used)

Moderate cost — review estimate before proceeding.

Reply YES to proceed, NO to abort, or REDUCE to proceed with only required phases.
```

**Response options:**

| Reply | Effect |
|-------|--------|
| `YES` | Pipeline proceeds normally. `approval_status = "approved"`. |
| `NO` | Pipeline aborts immediately with `exit_reason="cost_rejected"`. No skills execute. |
| `REDUCE` | Pipeline proceeds with reduced scope (orchestrator skips optional phases). `approval_status = "reduced"`. |
| *(timeout after 120s)* | Treated as `YES`. Pipeline auto-advances. Logged as INFO. |

> **Note:** Replying `NO` is a clean abort — no partial execution, no partial artifacts.
> It is the recommended action when the estimate exceeds your session token budget.

---

## CI Mode (Skip Cost Check)

In non-interactive environments (CI pipelines, automated tests, scripts), the HITL gate
can be bypassed by setting:

```json
{ "skip_cost_check": true }
```

Or via the pipeline config's `ci_mode` flag:

```json
{
  "id": "full-pipeline",
  "ci_mode": true,
  "phases": [ ... ]
}
```

When `skip_cost_check=true`:

- The cost estimate is still **computed** and included in the output.
- The HITL gate is **skipped** entirely.
- `approval_status` is set to `"skipped"` (not an error).
- The pipeline proceeds immediately.

**When to use CI mode:**

- Automated PR validation pipelines.
- Scheduled nightly runs with a known token budget.
- Integration tests that shouldn't block on human input.

> Do not enable CI mode in interactive developer workflows — the estimate gate exists
> precisely to prevent accidental high-cost runs.

---

## Post-Run Reports

After the pipeline completes, the orchestrator invokes `cost-estimator` in `post_run`
mode. This writes a cost report comparing actual usage to the pre-run estimate.

**Report location:**

```
artifacts/cost-report-{run_id}-{timestamp}.md
```

Example: `artifacts/cost-report-sess-abc123-20260709T143022Z.md`

**Report contents:**

```markdown
# Pipeline Cost Report — sess-abc123

| Field | Value |
|-------|-------|
| Pipeline | full-pipeline |
| Run ID | sess-abc123 |
| Generated | 2026-07-09T14:30:22Z |
| Estimated Tokens | 112,000 (medium) |
| Actual Tokens | 97,430 |
| Accuracy | 86.8% (13.2% under) |
| Confidence at Estimate | low |

## Breakdown
| Category | Tokens |
|----------|--------|
| Input (actual) | 52,100 |
| Output (actual) | 45,330 |
| Total (actual) | 97,430 |
```

> **Privacy note:** The `user_input_text` (raw prompt) is **never** written to the report.
> Only aggregate token counts are stored.

---

## Cost History

`artifacts/cost-history.json` is the estimator's persistent memory. It records a summary
of every pipeline run and is what makes estimates improve over time.

**Location:** `artifacts/cost-history.json`

**Structure (each entry):**

```json
{
  "run_id": "sess-abc123",
  "pipeline_id": "full-pipeline",
  "timestamp": "2026-07-09T14:30:22Z",
  "estimated_total": 112000,
  "actual_total": 97430,
  "actual_ratio": 0.870,
  "band": "medium",
  "confidence_at_estimate": "low",
  "skill_count": 18
}
```

**Cap:** History is capped at **100 entries**. When the 101st entry is added, the oldest
entry is pruned. This keeps the file small and ensures the rolling average always reflects
recent usage patterns rather than stale historical data.

**Writes are atomic:** The file is written to a temp path and renamed — a crash during
write cannot corrupt the history.

**To reset history** (start fresh calibration):

```bash
rm artifacts/cost-history.json
```

After reset, the estimator falls back to the 1.4× conservative default multiplier with
`confidence="low"` until 5+ new runs accumulate.

**Git status:** `artifacts/` is gitignored (except `artifacts/README.md`). Cost history
never enters the git repository.

---

## Improving Estimate Accuracy

As you accumulate runs in `cost-history.json`, accuracy improves automatically through
the rolling average multiplier. Here's how to interpret the post-run report's accuracy
percentage:

| Accuracy % | Interpretation |
|------------|----------------|
| 90–100% | Excellent — multiplier is well-calibrated for this pipeline type. |
| 75–89% | Good — minor calibration needed; confidence will improve with more runs. |
| 50–74% | Fair — pipeline structure may have changed, or `confidence="low"`. |
| < 50% | Poor — investigate whether the pipeline phases changed significantly. Consider resetting history if the pipeline structure was substantially refactored. |

**What the rolling average does:**

Each post-run entry records `actual_ratio = actual_total / estimated_total`. On the next
pre-run estimate, the mean of the last 20 `actual_ratio` values becomes the new multiplier.

- If past pipelines consistently used **less** than estimated (`actual_ratio < 1.0`), the
  multiplier decreases — future estimates become tighter.
- If past pipelines consistently used **more** than estimated (`actual_ratio > 1.0`), the
  multiplier increases — future estimates become more conservative.

The system always converges toward accurate estimates given enough runs.

---

## Configuration Options

All fields below are inputs to the `cost-estimator` skill. Required fields must always
be supplied by the orchestrator; optional fields fall back to their defaults.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `pipeline_id` | `string` | — **(required)** | ID of the pipeline template (e.g. `"full-pipeline"`). |
| `pipeline_phases` | `array[object]` | — **(required)** | Phase list from the pipeline config. Used to count skills. |
| `user_input_text` | `string` | — **(required)** | Raw user prompt. Used for input-token estimation only. Never stored. |
| `skip_cost_check` | `boolean` | `false` | Skip the HITL approval gate. Set `true` in CI mode. |
| `cost_band_thresholds` | `object` | `{ low: 50000, medium: 200000 }` | Override band boundaries (in tokens). |
| `mode` | `string` | `"pre_run"` | `"pre_run"` (estimate + HITL) or `"post_run"` (report + history update). |
| `actual_tokens` | `object` | `null` | Required for `post_run` mode: `{ total_in, total_out }` from completed run. |
| `run_id` | `string` | `null` | Pipeline run identifier. Used in report filename and history entry. |

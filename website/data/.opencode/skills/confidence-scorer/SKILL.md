---
name: confidence-scorer
version: 1.0.0
domain: planning
description: >
  Use when computing deterministic per-section confidence scores from ReviewFinding arrays
  produced by specialized reviewer skills. Triggers on: "compute confidence scores", "section
  confidence", "plan confidence". Invoked exclusively by phase-4d-confidence-scoring after
  phase-4c-reviewer-dispatch completes. Pure computation — no LLM call.
author: system
---

# Confidence Scorer

**Type:** Deterministic computation skill (no LLM call)  
**Phase:** `phase-4d-confidence-scoring`  
**Inputs from:** `phase-4c-reviewer-dispatch` (all 4 reviewer outputs)

---

## Purpose

Compute a deterministic confidence score for each plan section and a plan-level confidence
score, based solely on the severity distribution of `ReviewFinding` objects from all reviewers.
Output feeds the conditional debate trigger (`phase-4e`) and the validation checklist engine
(`phase-4h` HC-07 and SC-IQ-03).

---

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `findings` | `ReviewFinding[]` | Yes | All findings from phase-4c-reviewer-dispatch (merged from all 4 reviewers) |
| `plan_sections` | `string[]` | Yes | List of all section_ids in the plan under review |
| `confidence_floor` | `float` | No | Sections below this value are excluded from plan_confidence min calculation (outlier exclusion). Default: 0.3. Range: 0.0–0.5. |
| `session_id` | `string` | Yes | UUID v4 |

---

## Penalty Table (immutable)

| Severity | Penalty |
|----------|---------|
| `critical` | 0.30 |
| `high` | 0.15 |
| `medium` | 0.05 |
| `low` | 0.02 |
| `info` | 0.00 |

---

## Algorithm

```
FOR EACH section_id IN plan_sections:
  section_findings = findings WHERE finding.section_id == section_id
  penalty_sum = SUM(penalty_table[f.severity] FOR f IN section_findings)
  raw_confidence = 1.0 - penalty_sum
  section_confidence = max(0.0, raw_confidence)
  section_status =
    IF section_confidence >= 0.7: "healthy"
    ELIF section_confidence >= 0.5: "needs_attention"
    ELSE: "critical_risk"

eligible_sections = [s FOR s IN sections WHERE s.confidence >= confidence_floor]
plan_confidence =
  IF eligible_sections is empty: 0.0
  ELSE: min(s.confidence FOR s IN eligible_sections)

outlier_sections = [s FOR s IN sections WHERE s.confidence < confidence_floor]

debate_trigger_sections = [s FOR s IN sections WHERE s.confidence < 0.5]
validation_block_sections = [s FOR s IN sections WHERE s.confidence < 0.3]
```

---

## Outputs

Produces `confidence_report` artifact conforming to `skills/schema/confidence-report.schema.json`.

| Field | Description |
|-------|-------------|
| `sections` | Array of `{section_id, confidence, status, finding_count, penalty_breakdown}` |
| `plan_confidence` | `min(eligible section confidences)` — weakest non-outlier section |
| `debate_trigger_sections` | Section IDs with `confidence < 0.5` |
| `validation_block_sections` | Section IDs with `confidence < 0.3` |
| `outlier_sections` | Section IDs excluded from plan_confidence (below `confidence_floor`) |
| `confidence_floor_used` | The floor value applied |
| `computed_at` | ISO 8601 timestamp |
| `total_findings_processed` | Integer count |

---

## Rules

- **No LLM call.** This skill is pure arithmetic over structured data.
- **Deterministic.** Same input MUST produce identical output — no random elements.
- **All sections scored.** Every section_id in `plan_sections` gets a score, even if it has zero findings (confidence = 1.0).
- **Floor exclusion is advisory.** Outlier sections below `confidence_floor` are still reported — they are excluded only from the `plan_confidence` minimum calculation.
- **Does not modify findings.** Read-only with respect to the FindingArray input.

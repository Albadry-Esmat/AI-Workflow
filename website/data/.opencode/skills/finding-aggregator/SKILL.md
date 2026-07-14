---
name: finding-aggregator
version: 1.0.0
domain: planning
description: >
  Use when merging, deduplicating, and enriching ReviewFinding arrays from multiple parallel
  reviewer skills into a single canonical review_report. Triggers on: "aggregate findings",
  "merge review findings", "deduplicate findings". Invoked exclusively by
  phase-4f-finding-aggregation after phase-4d-confidence-scoring completes.
  Pure computation — no LLM call.
author: system
---

# Finding Aggregator

**Type:** Deterministic aggregation skill (no LLM call)  
**Phase:** `phase-4f-finding-aggregation`  
**Inputs from:** `phase-4c-reviewer-dispatch` (all 4 reviewer raw outputs)

---

## Purpose

Merge `ReviewFinding[]` arrays from all 4 specialized reviewers into a single deduplicated,
validated, sorted `review_report` artifact. Enforces the guardrail (strip `proposed_plan`
fields), computes `issue_fingerprint` where absent, deduplicates by fingerprint, detects
contradiction pairs, and sets `requires_debate` flag for phase-4e.

---

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `architecture_findings` | `ReviewFinding[]` | Yes | Output from architecture-reviewer |
| `security_findings` | `ReviewFinding[]` | Yes | Output from security-reviewer |
| `performance_findings` | `ReviewFinding[]` | Yes | Output from performance-reviewer |
| `maintainability_findings` | `ReviewFinding[]` | Yes | Output from maintainability-reviewer |
| `confidence_report` | object | Yes | Output from confidence-scorer (phase-4d) |
| `session_id` | `string` | Yes | UUID v4 |

---

## Algorithm

```
Step 1 — Guardrail enforcement
  FOR EACH finding IN all_findings:
    IF finding contains field "proposed_plan" OR "plan_revision" OR "revised_tasks":
      Strip the offending field.
      Log: { event: "guardrail_violation", skill: "finding-aggregator",
             finding_id: finding.finding_id, stripped_field: <field_name>,
             session_id, timestamp }

Step 2 — Schema validation
  FOR EACH finding IN all_findings:
    Validate against skills/schema/review-finding.schema.json.
    IF validation fails:
      Emit meta-finding:
        { severity: "high", reviewer_type: finding.reviewer_type,
          section_id: finding.section_id, category: "other",
          title: "Finding failed schema validation",
          description: "finding_id: {id} — {validation_error}",
          recommendation: "Reviewer must correct output format.",
          evidence: { source_ref: "schema: review-finding.schema.json" },
          created_at: now }

Step 3 — Compute missing issue_fingerprints
  FOR EACH finding WHERE finding.issue_fingerprint IS NULL:
    finding.issue_fingerprint =
      sha256(finding.title + "|" + finding.section_id + "|" + finding.reviewer_type)[0:16]

Step 4 — Deduplication
  Group all findings by issue_fingerprint.
  FOR EACH group WITH length > 1:
    severity_rank = { critical: 5, high: 4, medium: 3, low: 2, info: 1 }
    winner = finding with max severity_rank (tie: keep first by created_at ASC)
    Merge evidence: winner.evidence supplemented with unique evidence from duplicates.
    Discard duplicate findings.
    Log: { event: "findings_deduplicated", fingerprint, kept: winner.finding_id,
           merged_from: [list of duplicate ids] }

Step 5 — Contradiction detection
  FOR EACH pair (finding_A, finding_B) WHERE:
    finding_A.issue_fingerprint == finding_B.issue_fingerprint AND
    finding_A.reviewer_type != finding_B.reviewer_type AND
    severity_group(finding_A.severity) != severity_group(finding_B.severity):
      (severity_group: "high_group"=[critical,high], "low_group"=[low,info,medium])
    SET finding_A.requires_debate = true
    SET finding_A.contradiction_pair_fingerprint = finding_B.issue_fingerprint
    SET finding_B.requires_debate = true
    SET finding_B.contradiction_pair_fingerprint = finding_A.issue_fingerprint

Step 6 — Sort
  Sort final findings: severity_rank DESC, then reviewer_type ASC, then created_at ASC.

Step 7 — Build review_report
  review_report = {
    total_findings: count,
    findings_by_severity: { critical: N, high: N, medium: N, low: N, info: N },
    findings_by_reviewer: { architecture: N, security: N, performance: N, maintainability: N },
    sections_with_findings: [distinct section_ids],
    open_critical_count: count(findings WHERE severity == "critical"),
    requires_debate_count: count(findings WHERE requires_debate == true),
    guardrail_violations_count: count(logged violations),
    findings: [sorted_deduped_findings],
    generated_at: now
  }
```

---

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `review_report` | object | Full aggregated report (see algorithm Step 7) |
| `guardrail_violations` | array | Log of all guardrail violations in this aggregation pass |
| `deduplication_log` | array | Log of all deduplication events |

---

## Rules

- **No LLM call.** Pure data manipulation.
- **Guardrail always runs first** — before any other processing.
- **Dedup key is the fingerprint** — `sha256(title + "|" + section_id + "|" + reviewer_type)[0:16]`. The separator character `|` is always used — never `::` or other variants.
- **Schema failures produce meta-findings** — they do not halt the aggregation.
- **Contradiction detection uses severity groups** — not exact severity equality. Avoids false positives from two reviewers both rating something "high".

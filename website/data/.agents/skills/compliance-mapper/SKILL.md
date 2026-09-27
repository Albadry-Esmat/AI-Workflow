---
name: compliance-mapper
version: 1.0.0
domain: governance
description: 'Use when mapping system requirements and architecture against regulatory frameworks to produce a compliance traceability matrix and gap report. Triggers on: "compliance mapping", "regulatory compliance check", "GDPR compliance", "HIPAA compliance", "PCI-DSS requirements", "SOC 2 traceability", "ISO 27001 gap analysis", "compliance gap report", "audit readiness". Do NOT use when only performing security vulnerability scanning — use security-review for that.'
author: system
---

## Purpose

Map a system's requirements and architecture against specific regulatory frameworks (GDPR, HIPAA, PCI-DSS, SOC 2 Type II, ISO 27001) to produce a compliance traceability matrix, a gap report, and an audit-ready evidence checklist. The skill identifies which requirements satisfy which regulatory clauses, which clauses have no implementing feature (gaps), and which features introduce new regulatory obligations not covered by existing requirements. It enables teams building regulated systems to understand their compliance posture at design time — before an audit reveals it.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `requirements` | `array[object]` | Yes | Structured requirements from `requirement-analyzer` — each with `req_id`, `description`, `domain`, and `data_types` fields |
| `architecture` | `object` | Yes | Architecture output from `architecture-design` — must include `modules`, `data_flows`, and `integration_points` |
| `frameworks` | `array[string]` | Yes | Regulatory frameworks to check: subset of `["GDPR","HIPAA","PCI-DSS","SOC2","ISO27001"]` — at least one required |
| `data_classification` | `object` | No | Map of data type labels to sensitivity tiers: e.g. `{"user_email": "PII", "ssn": "PII", "card_number": "PCI", "diagnosis": "PHI"}` |
| `existing_controls` | `array[string]` | No | Control IDs already implemented (e.g. `["GDPR-Art-32", "PCI-DSS-Req-3"]`) — these clauses are marked satisfied |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "requirements": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "req_id":      { "type": "string" },
          "description": { "type": "string" },
          "domain":      { "type": "string" },
          "data_types":  { "type": "array", "items": { "type": "string" } }
        },
        "required": ["req_id", "description"]
      },
      "minItems": 1
    },
    "architecture": {
      "type": "object",
      "properties": {
        "modules":            { "type": "array" },
        "data_flows":         { "type": "array" },
        "integration_points": { "type": "array" }
      },
      "required": ["modules"]
    },
    "frameworks": {
      "type": "array",
      "items": { "type": "string", "enum": ["GDPR","HIPAA","PCI-DSS","SOC2","ISO27001"] },
      "minItems": 1
    },
    "data_classification": { "type": "object" },
    "existing_controls":   { "type": "array", "items": { "type": "string" } }
  },
  "required": ["requirements", "architecture", "frameworks"]
}
```

## Required Context

- Structured requirements output from `requirement-analyzer@^1.2.0` — required to perform clause-to-requirement mapping.
- Architecture output from `architecture-design@^1.3.0` — required to identify implementing features and data flows.
- `security-review@^1.0.0` output recommended (but not required) — provides additional data classification signal.
- At least one framework must be specified; frameworks not relevant to the system's data types are automatically filtered to their applicable clause subsets.

## Execution Logic

```
Step 1 — Classify architecture data flows
  For each module in architecture.modules:
    Identify data types it stores, processes, or transmits
    Cross-reference with data_classification map (or infer from field names: "email" → PII, "card" → PCI, etc.)
    Mark module with sensitivity tiers: [PII, PHI, PCI, financial, health, biometric, other]
  For each data_flow in architecture.data_flows:
    Identify source and destination module
    Determine data types in transit
  Output: classified_modules, classified_data_flows

Step 2 — Filter applicable clauses per framework
  For each framework in frameworks:
    Load framework clause database (built-in reference)
    Filter to clauses applicable to the system's classified data types:
      GDPR: apply if any PII or PHI detected
      HIPAA: apply if PHI detected
      PCI-DSS: apply if PCI (payment card) data detected
      SOC2: apply always (operational controls are universal)
      ISO27001: apply always (information security management)
    Remove clauses where data_type_trigger is not present in classified data types
  Output: applicable_clauses per framework

Step 3 — Mark pre-satisfied clauses from existing_controls
  For each clause_id in existing_controls:
    Find matching clause in applicable_clauses
    Set status = "satisfied", evidence_notes = "Satisfied by existing control"
  Output: pre_satisfied_clause_ids

Step 4 — Map requirements to clauses
  For each clause not in pre_satisfied_clause_ids:
    For each requirement in requirements:
      Score match on:
        keyword_match: clause.keywords intersect with requirement.description words
        domain_match: clause.domain == requirement.domain
        data_type_match: clause.data_types_triggered intersect with requirement.data_types
      If score > threshold (0.4): add requirement to clause.mapped_requirements
  Output: requirement_clause_map

Step 5 — Map implementing features to clauses
  For each clause with mapped_requirements:
    Find architecture modules that implement those requirements
    (Module implements requirement if module.name or module.description references the requirement domain)
    Add to clause.implementing_features
  Output: feature_clause_map

Step 6 — Determine clause status
  For each applicable clause:
    If clause_id in pre_satisfied_clause_ids → status = "satisfied"
    Else if len(mapped_requirements) > 0 AND len(implementing_features) > 0 → status = "satisfied"
    Else if len(mapped_requirements) > 0 OR len(implementing_features) > 0 → status = "partial"
    Else → status = "gap"
  Output: traceability_matrix rows

Step 7 — Identify gaps
  gaps = [clause for clause in traceability_matrix if clause.status == "gap"]
  For each gap:
    severity = clause.severity_if_missing (blocking | major | minor)
    recommended_action = prescriptive text: "Add requirement: [description]. Implement control in: [suggested module]."
  Output: gaps list

Step 8 — Detect new obligations
  For each classified_module that handles PII, PHI, or PCI:
    For each applicable clause whose data_types_triggered includes that sensitivity tier:
      Check if the clause has mapped_requirements covering that module
      If no requirement explicitly covers the regulatory control for that data → new_obligation detected:
        {
          "feature": module.name,
          "data_type": sensitivity_tier,
          "clause_id": clause.clause_id,
          "framework": clause.framework,
          "description": "Module processes {data_type} data without a requirement covering {clause_description}",
          "recommended_action": "Add requirement to cover {clause_description} for {module.name}"
        }
  Emit feedback: new_regulatory_obligation_detected for each new obligation
  Output: new_obligations list

Step 9 — Calculate compliance scores
  For each framework:
    total_clauses = count(applicable_clauses for framework)
    satisfied     = count(status == "satisfied")
    partial       = count(status == "partial")
    gap_count     = count(status == "gap")
    score_pct     = round((satisfied + 0.5 * partial) / total_clauses * 100, 1)
  Output: compliance_score object

Step 10 — Generate evidence checklist
  For each framework:
    For each applicable clause:
      For each evidence_artifact in clause.evidence_artifacts:
        Create checklist item:
          framework, clause_id, artifact_type, artifact_name, status (required|recommended),
          notes (what the artifact must demonstrate to satisfy an auditor)
  Output: evidence_checklist list

Step 11 — Emit critical gap feedback
  If any gap has severity == "blocking":
    Emit feedback backpropagate to requirement-analyzer:
      reason: "Blocking compliance gap detected — add requirement for clause {clause_id}"
      evidence: { clause_id, framework, description, recommended_action }
  Output: feedback entries
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `traceability_matrix` | `array[object]` | One row per applicable regulatory clause: `clause_id`, `framework`, `clause_description`, `mapped_requirements`, `implementing_features`, `status`, `evidence_notes` |
| `gaps` | `array[object]` | Clauses with `status == "gap"`: `clause_id`, `framework`, `description`, `severity`, `recommended_action` |
| `new_obligations` | `array[object]` | Features introducing untracked regulatory obligations: `feature`, `data_type`, `clause_id`, `framework`, `description`, `recommended_action` |
| `compliance_score` | `array[object]` | Per-framework score: `framework`, `total_clauses`, `satisfied`, `partial`, `gaps`, `score_pct` |
| `evidence_checklist` | `array[object]` | Audit-ready checklist items: `framework`, `clause_id`, `artifact_type`, `artifact_name`, `status`, `notes` |
| `metrics` | `object` | **REQUIRED.** Execution metrics |
| `feedback` | `array[object]` | **REQUIRED.** Feedback loop entries |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "traceability_matrix": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "clause_id":             { "type": "string" },
          "framework":             { "type": "string" },
          "clause_description":    { "type": "string" },
          "mapped_requirements":   { "type": "array", "items": { "type": "string" } },
          "implementing_features": { "type": "array", "items": { "type": "string" } },
          "status":                { "type": "string", "enum": ["satisfied", "partial", "gap"] },
          "evidence_notes":        { "type": "string" }
        },
        "required": ["clause_id", "framework", "status"]
      }
    },
    "gaps": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "clause_id":          { "type": "string" },
          "framework":          { "type": "string" },
          "description":        { "type": "string" },
          "severity":           { "type": "string", "enum": ["blocking", "major", "minor"] },
          "recommended_action": { "type": "string" }
        },
        "required": ["clause_id", "framework", "severity", "recommended_action"]
      }
    },
    "new_obligations": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "feature":            { "type": "string" },
          "data_type":          { "type": "string" },
          "clause_id":          { "type": "string" },
          "framework":          { "type": "string" },
          "description":        { "type": "string" },
          "recommended_action": { "type": "string" }
        },
        "required": ["feature", "data_type", "clause_id", "framework"]
      }
    },
    "compliance_score": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "framework":      { "type": "string" },
          "total_clauses":  { "type": "integer" },
          "satisfied":      { "type": "integer" },
          "partial":        { "type": "integer" },
          "gaps":           { "type": "integer" },
          "score_pct":      { "type": "number", "minimum": 0, "maximum": 100 }
        },
        "required": ["framework", "total_clauses", "satisfied", "partial", "gaps", "score_pct"]
      }
    },
    "evidence_checklist": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "framework":     { "type": "string" },
          "clause_id":     { "type": "string" },
          "artifact_type": { "type": "string" },
          "artifact_name": { "type": "string" },
          "status":        { "type": "string", "enum": ["required", "recommended"] },
          "notes":         { "type": "string" }
        },
        "required": ["framework", "clause_id", "artifact_type", "artifact_name", "status"]
      }
    },
    "metrics": {
      "type": "object",
      "properties": {
        "tokens_in":       { "type": "integer" },
        "tokens_out":      { "type": "integer" },
        "duration_ms":     { "type": "integer" },
        "items_produced":  { "type": "integer" },
        "version":         { "type": "string" },
        "frameworks_run":  { "type": "integer" },
        "total_clauses":   { "type": "integer" },
        "blocking_gaps":   { "type": "integer" },
        "new_obligations": { "type": "integer" }
      },
      "required": ["tokens_in", "tokens_out", "duration_ms", "items_produced", "version"]
    },
    "feedback": {
      "type": "array",
      "items": { "$ref": "#/$defs/feedback_entry" }
    }
  },
  "required": ["traceability_matrix", "gaps", "new_obligations", "compliance_score", "evidence_checklist", "metrics", "feedback"],
  "$defs": {
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

- `frameworks` must contain at least one valid framework — reject with `EMPTY_FRAMEWORKS` if empty.
- The skill MUST NOT emit legal or certification opinions — output is advisory; compliance posture language must be qualified with "based on static analysis."
- Every gap with `severity == "blocking"` MUST trigger a `backpropagate` feedback entry to `requirement-analyzer`.
- Every new obligation detected MUST trigger an `info` feedback entry to the orchestrator.
- Clause matching uses static keyword and domain analysis only — no external API calls or internet access.
- `compliance_score.score_pct` formula is fixed: `round((satisfied + 0.5 * partial) / total_clauses * 100, 1)`. Do NOT deviate.
- If `frameworks` contains a framework not applicable to the system's data types (e.g., HIPAA when no PHI detected), include it in output with `total_clauses: 0` and note: "Not applicable — no PHI data detected."
- Maximum traceability_matrix rows: 200. If applicable clauses exceed 200 after filtering, prioritise blocking-severity clauses.

## Security Considerations

- `data_classification` input may contain sensitive field names — do NOT log or echo raw field values in output.
- `traceability_matrix` and `gaps` output may reveal security posture weaknesses — distribute only to authorised stakeholders.
- The skill MUST NOT attempt to access external regulatory databases, URLs, or APIs.
- Input `requirements` and `architecture` must not be passed unfiltered to downstream skills — extract only the fields needed for clause matching.

## Token Optimization

- Compress `requirements` input to `req_id` + `description` only — strip acceptance criteria and implementation notes before clause matching.
- Compress `architecture` input to `module.name` + `module.domain` + `data_flow.source/destination` — strip component diagrams, tech decisions, and extended metadata.
- Process one framework at a time in execution logic to limit working set size.
- Limit `evidence_checklist` to 5 items per clause (top 5 most important audit artifacts).
- Return `traceability_matrix` rows only for `status != "satisfied"` plus a `satisfied_count` summary counter when total rows > 50.

## Quality Checklist

- [ ] Input schema validated — `requirements`, `architecture`, `frameworks` all present
- [ ] At least one framework successfully processed
- [ ] Data classification performed before clause mapping
- [ ] All `gap` clauses have a `recommended_action`
- [ ] `compliance_score.score_pct` formula applied correctly
- [ ] Blocking gaps trigger `backpropagate` feedback
- [ ] New obligations trigger `info` feedback
- [ ] No external API calls made
- [ ] Output is valid JSON conforming to output schema

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| `frameworks` is empty | Return error: `{"error": "EMPTY_FRAMEWORKS", "message": "At least one framework is required"}` |
| `requirements` is empty array | Return error: `{"error": "EMPTY_REQUIREMENTS", "message": "At least one requirement is required for mapping"}` |
| `architecture.modules` is empty | Return traceability_matrix with all clauses as `gap`, emit warning |
| Unknown framework value in list | Skip that framework, log warning in feedback, continue with valid frameworks |
| `traceability_matrix` exceeds 200 rows | Truncate to 200 rows (blocking severity first), set `metrics.truncated: true` |
| No data types detected in architecture | Default to treating all SOC2 and ISO27001 clauses as applicable |

## 12. Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Behavior |
|------|---------|---------|----------|
| Blocking compliance gap | `gaps` contains any entry with `severity == "blocking"` | 3600s | Pause pipeline; present full gap list and `compliance_score` to human approver; require explicit acknowledge before downstream skills proceed |
| New regulatory obligation | `new_obligations` length > 0 | 3600s | Surface obligation summary to human; confirm whether to add requirements before continuing |

Gate behavior:
- `pause`: halt pipeline, emit approval request to orchestrator, wait for human response
- On approval: continue pipeline, route gaps to `requirement-analyzer` via feedback
- On rejection: halt feature planning for affected modules

## 13. Skill Composition

`compliance-mapper` runs after `security-review` and feeds into `security-guard` and `documentation-generator`:

```yaml
composes:
  - skill: compliance-mapper
    version: "^1.0.0"
    input_map:
      requirements:       "requirement_analyzer.requirements"
      architecture:       "architecture_design.architecture"
      frameworks:         "session.compliance_frameworks"
      data_classification: "session.data_classification"
      existing_controls:  "security_review.existing_controls"
    output_map:
      compliance_score:   "state.compliance_score"
      gaps:               "state.compliance_gaps"
      evidence_checklist: "state.audit_evidence_checklist"
```

Orchestration position: phase-7c-compliance, after `security-review`, before `security-guard` and `documentation-generator`. Non-blocking unless `blocking_gaps > 0`.

Consumes from: `requirement-analyzer@^1.2.0`, `architecture-design@^1.3.0`, `security-review@^1.0.0`
Produces for: `security-guard@^1.0.0`, `documentation-generator@^1.0.0`

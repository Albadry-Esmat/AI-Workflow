---
name: research-artifact
version: 1.0.0
domain: requirements
description: 'Use before architecture-design when requirements involve novel technologies, unfamiliar domains, or significant build-vs-buy decisions. Generates a structured research artifact capturing alternatives considered, pros/cons matrix, reference links, and final selection rationale. The artifact is written to artifacts/research-<timestamp>.md and artifacts/research-<timestamp>.json. The architect ingests it as additional context. Triggers on: "research this technology", "compare alternatives", "build vs buy", "technology evaluation", "generate research artifact".'
author: system
---

## Purpose

Generate a structured technology research artifact before architecture decisions are made. When requirements involve new technologies, unfamiliar domains, or material build-vs-buy choices, the pipeline makes technology selections silently with no auditable rationale. This skill corrects that by running a structured evaluation pass and producing a durable `research-<timestamp>.md` and `research-<timestamp>.json` artifact.

The architect consumes the research artifact as context when present. The artifact is the authoritative record of: which alternatives were considered, the pros/cons matrix for each, external references consulted, and the final selection rationale. It is optional — it runs only when `pipeline_config.research_enabled === true` or when the requirement-analyzer emits `technology_research_needed: true`.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `requirements` | `array[object]` | Yes | Validated requirements from `requirement-analyzer` / `clarify`. Used to identify research targets. |
| `technology_questions` | `array[string]` | No | Explicit questions to answer (e.g. "Which message broker to use?"). If absent, the skill derives them from requirements. |
| `project_context` | `object` | No | Constitution-derived context (team size, stack constraints, compliance requirements). Filters out non-viable alternatives. |
| `session_id` | `string` | Yes | UUID v4 of the active pipeline session. |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["requirements", "session_id"],
  "properties": {
    "requirements": {
      "type": "array", "minItems": 1,
      "items": { "type": "object", "required": ["id", "statement"] }
    },
    "technology_questions": { "type": "array", "items": { "type": "string" } },
    "project_context": { "type": "object" },
    "session_id": { "type": "string", "format": "uuid" }
  }
}
```

## Required Context

- Validated requirements from `requirement-analyzer` — requirement statements are scanned to identify technology-bearing nouns and open choices.
- `project_context` from orchestrator Step -1 (CONSTITUTION.md) — stack preferences, compliance constraints, and team expertise are used to pre-filter alternatives.
- `session_id` from orchestrator session context.

## Execution Logic

```
Step 1 — Identify research targets
  Scan requirements[].statement for technology-bearing signals:
    - Explicit technology references: cloud provider, database type, messaging system,
      authentication protocol, programming language, ML framework
    - Open-ended phrases: "using a suitable", "an appropriate", "TBD", "to be decided"
    - Build-vs-buy indicators: "integrate with third-party", "self-hosted", "managed service"
  Merge with technology_questions[] if provided.
  Deduplicate and produce research_targets[]: array of { topic, context_quote, req_ids[] }
  If research_targets is empty:
    emit INFO: no_research_targets_found
    Return output with research_targets: [], alternatives: [], decision_rationale: "No technology decisions identified."
    Write minimal artifact and return.

Step 2 — Generate alternatives matrix
  For each research_target:
    Generate alternatives[]: 2–4 options per target (minimum 2, maximum 4)
    For each alternative:
      name:        string
      type:        "open-source" | "commercial" | "managed-service" | "self-built"
      pros[]:      array[string] (2–5 items)
      cons[]:      array[string] (2–5 items)
      fit_score:   integer 1–10 (fit to stated requirements and project_context constraints)
      references[]: array of { title, url } (0–3 items; no hallucinated URLs — omit if uncertain)
    Apply project_context constraints to filter:
      If project_context.compliance includes "HIPAA", exclude non-compliant options (flag if none remain)
      If project_context.stack_constraints excludes a platform, mark fit_score = 0 and add con: "Excluded by project constitution"
    Select recommended_option: the alternative with the highest fit_score that survives filtering
    decision_rationale: 2–4 sentence explanation citing pros vs cons, fit to requirements, constraint adherence

Step 3 — Assemble output
  research_results[]: one entry per research_target:
    { topic, req_ids[], alternatives[], recommended_option, decision_rationale, references_summary[] }
  overall_summary: 1–3 sentence description of key technology decisions made
  research_targets_count: research_targets.length
  alternatives_evaluated: sum of alternatives.length across all targets

Step 4 — Write artifacts
  Timestamp: ISO 8601, colons replaced with hyphens for filenames.
  If artifacts/ does not exist: create silently.

  Write artifacts/research-<timestamp>.md:
    # Technology Research Artifact — <session_id>
    **Generated by:** research-artifact v1.0.0
    **Timestamp:** <ISO8601>
    **Requirements analyzed:** <count>

    ## Research Summary
    <overall_summary>

    ## Research Results
    For each research_target:
      ### <topic>
      **Linked requirements:** <req_ids comma-separated>
      **Recommended:** <recommended_option.name> (<recommended_option.type>)
      **Rationale:** <decision_rationale>

      | Alternative | Type | Fit Score | Pros | Cons |
      |-------------|------|-----------|------|------|
      (one row per alternative)

      **References:**
      (bulleted list of title + URL for items with non-empty references[])

  Write artifacts/research-<timestamp>.json:
    {
      "run_id":     <session_id>,
      "skill":      "research-artifact",
      "skill_version": "1.0.0",
      "timestamp":  <ISO8601>,
      "research_results": [ ... ],
      "overall_summary": <string>,
      "research_targets_count": <integer>,
      "alternatives_evaluated": <integer>
    }
  Update symlink artifacts/research-latest.json → artifacts/research-<timestamp>.json.
  Output: md_artifact_path, json_artifact_path

Step 5 — Emit telemetry and return
  Emit INFO: research_artifact_written {
    research_targets_count, alternatives_evaluated, md_artifact_path, json_artifact_path
  }
  Return complete output object.
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `research_results` | `array[object]` | One entry per research target. Fields: `topic`, `req_ids[]`, `alternatives[]` (each with `name`, `type`, `pros[]`, `cons[]`, `fit_score`, `references[]`), `recommended_option`, `decision_rationale`. |
| `overall_summary` | `string` | 1–3 sentence summary of key technology decisions. |
| `research_targets_count` | `integer` | Number of technology topics evaluated. |
| `alternatives_evaluated` | `integer` | Total number of alternatives assessed across all topics. |
| `md_artifact_path` | `string` | Relative path to written Markdown artifact. |
| `json_artifact_path` | `string` | Relative path to written JSON artifact. |
| `metrics` | `object` | `tokens_in`, `tokens_out`, `duration_ms`, `items_produced`, `version`. |
| `feedback` | `array[object]` | Feedback loop entries for cross-skill communication. |

**Output Schema (abbreviated):**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
"required": ["research_results", "overall_summary", "research_targets_count",
             "alternatives_evaluated", "md_artifact_path", "json_artifact_path", "metrics", "feedback"],
  "properties": {
    "research_results": { "type": "array" },
    "overall_summary":  { "type": "string" },
    "research_targets_count":  { "type": "integer", "minimum": 0 },
    "alternatives_evaluated":  { "type": "integer", "minimum": 0 },
    "md_artifact_path":  { "type": "string" },
    "json_artifact_path":{ "type": "string" },
    "metrics": { "type": "object" },
    "feedback": { "type": "array", "items": { "type": "object" } }
  }
}
```

## Rules & Constraints

1. **2–4 alternatives per target.** Every research topic MUST have at least 2 and at most 4 alternatives. A single-option "comparison" is not permitted — surface the next best alternative even if clearly inferior, so the decision is auditable.
2. **No hallucinated URLs.** References must be real, known resources. If uncertain about a URL, omit the `url` field and include only `title`. Never invent or guess URLs.
3. **fit_score justification.** The `decision_rationale` MUST cite at least one specific pro or con from the selected alternative's matrix.
4. **Constraint application is mandatory.** If `project_context` contains `stack_constraints`, those constraints MUST be applied to filter alternatives before scoring. Constitution-excluded technologies MUST be marked with `fit_score: 0`.
5. **Minimal artifact on no targets.** If `research_targets` is empty, the skill MUST still write a minimal artifact with a note explaining no technology decisions were identified. It does NOT halt or error.
6. **Maximum 10 research targets per run.** If more than 10 targets are identified, prioritize by requirement priority (critical > high > medium > low). Emit `WARN: research_targets_capped { total_identified, evaluated }` for the remainder.
7. **Read-only.** This skill MUST NOT modify any upstream skill output. It reads requirements and context; the only side effects are artifact files.
8. **Architect context injection.** The `json_artifact_path` MUST be passed to architecture-design as `research_artifact_path` in the pipeline input map.

## Security Considerations

- **No live web requests.** This skill operates entirely from its training knowledge. It MUST NOT attempt to fetch URLs, query APIs, or access the network.
- **PII stripping.** Requirement statements written to artifact files MUST have PII tokens (email addresses, phone numbers, proper names in quoted contexts) replaced with `[REDACTED]`.
- **Credential detection.** If any input field contains a credential pattern (API key, JWT, PEM header), emit `WARN: credential_in_input`, redact, and continue.
- **Path safety.** Artifact path is always `artifacts/research-<ISO-timestamp>.*`. User inputs MUST NOT influence the directory.

## Token Optimization

- **Project requirements before scanning.** Retain only `id`, `statement` from requirements during Step 1 target identification. Load full requirement objects only if needed in Step 3.
- **Cap alternatives matrix context.** For each alternative, include at most 5 pros and 5 cons. Do not enumerate exhaustive feature lists.
- **Skip research step context for low-novelty requirements.** If all requirements reference established, well-documented technologies (CRUD over relational DB, REST JSON API), the skill may return a minimal artifact with `research_targets_count: 0` and a note.
- **Batch targeting.** If `requirements.length > 50`, scan only the first 50 sorted by priority. Emit `WARN: requirements_truncated_for_research`.

## Quality Checklist

- [ ] Every research target has 2–4 alternatives
- [ ] Every alternative has at least 2 pros and 2 cons
- [ ] `fit_score` is in range [1, 10] for non-excluded alternatives
- [ ] Constitution-excluded alternatives have `fit_score: 0` and a cons entry noting exclusion
- [ ] `decision_rationale` cites at least one specific pro/con from the selected option
- [ ] No URLs are hallucinated — all reference URLs are from known, real domains
- [ ] JSON artifact parses without error
- [ ] `artifacts/research-latest.json` symlink updated
- [ ] Markdown artifact contains Research Summary + one section per target

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| `requirements[]` empty or absent | Hard error: `{"error": "EMPTY_REQUIREMENTS"}`. Halt. No artifacts written. |
| No technology decisions found | Write minimal artifact. Return `research_targets_count: 0`. Do not error. |
| `project_context` absent | Proceed without constraint filtering. All alternatives scored without exclusion. Emit `INFO: no_project_context`. |
| Constitution excludes ALL alternatives for a topic | Include all with `fit_score: 0`. Set `recommended_option: null`. Note in `decision_rationale`: "All alternatives are excluded by project constitution constraints." |
| `research_targets > 10` | Evaluate top 10 by priority. Emit `WARN: research_targets_capped`. |
| JSON serialization failure | Retry once. Write Markdown only if retry fails. |

## Human-in-the-Loop Gates

This skill has one optional HITL gate:

| Gate | Trigger | Timeout | Behavior on timeout |
|------|---------|---------|---------------------|
| Research review | Always — architect should not make technology choices blind | 1800s | Auto-advance if no input within timeout; log `INFO: research_gate_timeout_advance` |

The gate presents the research_results summary and asks: "Do you agree with the technology recommendations? Reply YES to proceed or provide corrections." Corrections are merged into the artifact before it is passed to the architect.

In CI mode (`pipeline_config.ci_mode: true`), the gate is skipped and the skill auto-advances.

## Skill Composition

`research-artifact` v1.0.0 runs after `clarify` (and optionally after `debate-synthesizer`) and before `architecture-design` in the full pipeline. It is only invoked when `pipeline_config.research_enabled === true` or when `requirement-analyzer` emits `technology_research_needed: true`.

```yaml
composes:
  - skill: clarify
    version: "^1.0.0"
    output_map:
      updated_requirements: "requirements"

  - skill: research-artifact
    version: "^1.0.0"
    triggered_by: clarify
    condition: "pipeline_config.research_enabled === true || state.technology_research_needed === true"
    input_map:
      requirements:      "validated_requirements"
      project_context:   "project_context"
      session_id:        "session.id"
    output_map:
      json_artifact_path: "research_artifact_path"
      research_results:   "research_results"

  - skill: architecture-design
    version: "^1.3.0"
    triggered_by: research-artifact
    input_map:
      requirements:          "validated_requirements"
      research_artifact_path: "research_artifact_path"

downstream:
  - architecture-design@^1.3.0  # consumes research_artifact_path for technology context

upstream:
  - requirement-analyzer   # provides requirements[]
  - clarify                # provides updated_requirements
```

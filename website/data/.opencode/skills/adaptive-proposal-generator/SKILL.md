---
name: adaptive-proposal-generator
version: 1.0.0
domain: system
description: 'Use when analyzing session telemetry to generate ranked improvement proposals for skills, pipelines, or agents. Triggers on: "suggest improvements", "analyze usage patterns", "adaptive proposals", "what should we improve", "session analysis", "self-improvement suggestions". Requires session-insights (SKL-048) to have produced a session_summary. ALL proposals require HITL approval — nothing is applied automatically.'
author: ASE-OS
---

# Adaptive Proposal Generator

**Version:** 1.0.0 | **Last updated:** 2026-06-20

Reads `session_summary` from `session-insights` (SKL-048) and any available historical session summaries to detect usage patterns, failure hotspots, and capability gaps. Generates ranked `AdaptationProposal[]` objects covering new skills, skill modifications, new pipeline templates, and agent configuration changes. Every proposal is gated by mandatory HITL approval — **nothing is written to the system automatically**.

---

## 1. Skill Header

```yaml
name: adaptive-proposal-generator
version: 1.0.0
domain: system
description: >
  Analyzes session telemetry summaries (from session-insights) to produce
  ranked AdaptationProposal objects. Suggestion-only — all proposals require
  explicit HITL approval before adaptation-applicator may apply any change.
author: ASE-OS
```

---

## 2. Purpose

`adaptive-proposal-generator` is the intelligence layer of the Phase 3 Assisted Adaptation system. It closes the loop between the observability pipeline and the skill registry by turning raw performance signals into actionable, human-reviewable proposals.

```
session-insights (SKL-048)
         ↓  session_summary
adaptive-proposal-generator (SKL-050)   ← this skill
         ↓  AdaptationProposal[]
    ⚠️  HITL Gate — human review & approval
         ↓  approved_proposal
adaptation-applicator (SKL-051)
```

**Five proposal types:**

| Type | Triggers When | Example |
|------|--------------|---------|
| `new_skill` | A recurring unhandled pattern or gap is detected across sessions | "No skill handles localization — propose `localization-architect`" |
| `modify_skill` | A skill's failure rate or HITL rejection ratio exceeds threshold | "architecture-design rejected 35% of the time → propose step refinement" |
| `retire_skill` | A skill is never invoked across N sessions and has a replacement | "context-memory not invoked in 10 sessions — propose deprecation" |
| `new_pipeline` | A group of 3+ skills are always invoked together with no pipeline template | "skills A→B→C→D always run together — propose a named pipeline template" |
| `new_agent` | A new skill is approved that has no assigned agent | "behavioral-telemetry-collector has no dedicated agent — propose assignment" |

**Core constraint:** This skill is **suggestion-only**. It never writes to system state, registry, or pipeline files. Its sole output is a list of proposals for the human to review.

---

## 3. Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `session_summary` | `object` | Yes | Current session's `behavioral_telemetry.session_summary` from SKL-048 |
| `historical_summaries` | `array[object]` | No | Up to 10 prior session summaries for trend analysis |
| `registry_snapshot` | `object` | No | Current `skills/registry.json` contents for gap analysis |
| `session_id` | `string` | Yes | UUID v4 of the current session |
| `proposal_types` | `array[string]` | No | Restrict to specific proposal types (default: all five) |
| `max_proposals` | `integer` | No | Max proposals to return (default: 5, max: 10) |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["session_summary", "session_id"],
  "additionalProperties": false,
  "properties": {
    "session_summary":       { "type": "object" },
    "historical_summaries":  { "type": "array", "items": { "type": "object" }, "maxItems": 10 },
    "registry_snapshot":     { "type": "object" },
    "session_id":            { "type": "string", "format": "uuid" },
    "proposal_types": {
      "type": "array",
      "items": {
        "type": "string",
        "enum": ["new_skill", "modify_skill", "retire_skill", "new_pipeline", "new_agent"]
      }
    },
    "max_proposals": { "type": "integer", "minimum": 1, "maximum": 10, "default": 5 }
  }
}
```

---

## 4. Required Context

- `session_summary` must be present and non-empty. If absent, return empty proposals with `analysis_skipped: true`.
- Load `historical_summaries` from `state-manager.read(scope: "behavioral_telemetry").historical_summaries` if not passed directly. Gracefully skip trend analysis if none available (single-session mode).
- Load `registry_snapshot` from `skills/registry.json` if not passed directly. Required for capability gap detection.
- This skill reads no user content, code, or requirement text — only aggregated statistics from SKL-048.

---

## 5. Execution Logic

```
Step 1 — Validate inputs
  IF session_summary is null or empty:
    Return: { proposals: [], analysis_skipped: true, reason: "no_session_summary" }
  SET analysis_mode = historical_summaries.length > 0 ? "multi_session" : "single_session"
  SET effective_max = max_proposals ?? 5

Step 2 — Failure Pattern Analysis (skill-level)
  FOR each skill_metric in session_summary.skill_performance:
    IF skill_metric.failure_rate > 0.30:
      ADD candidate: {
        type: "modify_skill",
        target: skill_metric.skill_name,
        signal: "high_failure_rate",
        value: skill_metric.failure_rate,
        sessions_observed: 1
      }
  IF analysis_mode == "multi_session":
    FOR each skill across historical_summaries:
      Compute rolling_failure_rate = avg(failure_rate) across N sessions
      IF rolling_failure_rate > 0.25:
        UPSERT candidate (increase confidence weight)

Step 3 — HITL Rejection Analysis
  FOR each skill_metric with hitl_rejection_ratio >= 0.30:
    ADD candidate: {
      type: "modify_skill",
      target: skill_metric.skill_name,
      signal: "high_hitl_rejection",
      value: skill_metric.hitl_rejection_ratio,
      sessions_observed: 1
    }
  NOTE: High HITL rejection means the skill's output consistently fails human review →
        suggests the skill's execution logic, output schema, or examples need improvement.

Step 4 — Feedback Loop Analysis (capability gap detection)
  FOR each feedback_loop in session_summary.feedback_loops (if available):
    IF same (from_skill, target_skill) pair appears in 2+ sessions:
      ADD candidate: {
        type: "new_skill",
        signal: "recurring_feedback_loop",
        from_skill: loop.from_skill,
        to_skill: loop.target_skill,
        reason: "Recurring feedback suggests a missing intermediary skill or transformation step"
      }

Step 5 — Pipeline Routing Analysis (new pipeline detection)
  IF session_summary.skills_invoked_sequence is available:
    Identify sub-sequences of 3+ skills that appear together in 3+ sessions.
    IF no existing pipeline_template covers this sequence:
      ADD candidate: {
        type: "new_pipeline",
        signal: "repeated_skill_sequence",
        skills_in_sequence: [...],
        observed_sessions: N
      }

Step 6 — Inactivity Analysis (retire candidates)
  IF historical_summaries.length >= 5:
    FOR each registered_skill in registry_snapshot.skills:
      IF skill NOT present in any of last 5 session_summaries.skill_performance:
        IF skill has a documented replacement skill in registry:
          ADD candidate: {
            type: "retire_skill",
            target: skill.name,
            signal: "zero_invocations_over_N_sessions",
            replacement: skill.replacement ?? null,
            sessions_checked: 5
          }

Step 7 — Score and rank proposals
  FOR each candidate:
    impact_score  = compute_impact(candidate):
      - modify_skill: failure_rate or rejection_ratio (0.0–1.0)
      - new_skill:    number of sessions with feedback loop (0.0–1.0 normalized)
      - retire_skill: 0.3 (low urgency)
      - new_pipeline: observed_sessions / 10 (capped at 1.0)
      - new_agent:    0.5 (medium urgency)
    confidence    = single_session ? 0.6 : min(1.0, sessions_observed / 5)
    priority_score = impact_score * confidence
    SET candidate.priority_score = priority_score
    SET candidate.confidence = confidence
  SORT candidates DESC by priority_score
  TAKE top effective_max candidates

Step 8 — Build AdaptationProposal objects
  FOR each scored candidate:
    proposal = {
      id:                   "PROP-" + uuid_short(),
      type:                 candidate.type,
      title:                build_title(candidate),
      rationale:            build_rationale(candidate),
      change_description:   build_change_description(candidate),
      expected_improvement: build_expected_improvement(candidate),
      effort_estimate:      estimate_effort(candidate),
      confidence:           candidate.confidence,
      priority_score:       candidate.priority_score,
      evidence: {
        signal:            candidate.signal,
        observed_value:    candidate.value,
        sessions_observed: candidate.sessions_observed,
        target_skill:      candidate.target ?? null
      },
      hitl_status:          "pending"   ← never pre-approved
    }

Step 9 — Validate proposals (no registry mutations)
  ASSERT all proposals have hitl_status == "pending"
  ASSERT no proposal modifies system state
  ASSERT proposals array has no entries that bypass HITL gate

Step 10 — Return
  Return: {
    proposals:       ranked proposals array,
    analysis_mode:   "single_session" | "multi_session",
    sessions_analyzed: 1 + historical_summaries.length,
    total_candidates_found: pre-truncation candidate count,
    metrics:         standard execution metrics,
    feedback:        []
  }
```

**Title / Rationale builders (reference):**

| Candidate Type | `title` Template | `change_description` Template |
|---------------|-----------------|-------------------------------|
| `modify_skill` + `high_failure_rate` | "Reduce failure rate of `<skill>` (currently <N>%)" | "Review execution steps and output schema of `<skill>`. Consider adding examples and tightening the quality checklist." |
| `modify_skill` + `high_hitl_rejection` | "Improve human acceptance of `<skill>` output (rejection <N>%)" | "Review the HITL gate criteria and output format of `<skill>`. Add more worked examples to the knowledge file." |
| `new_skill` | "Add new skill to handle `<from>→<to>` transformation gap" | "Create a new SKILL.md for a skill that bridges `<from_skill>` output to `<to_skill>` input. Invoke skill-authoring (SKL-012)." |
| `retire_skill` | "Deprecate `<skill>` — zero invocations across <N> sessions" | "Set `status: deprecated` in registry. Add deprecation notice to SKILL.md. Redirect consumers to `<replacement>`." |
| `new_pipeline` | "Create `<derived-name>` pipeline template for common skill sequence" | "Generate a pipeline JSON for the sequence `<A→B→C→D>`. Add to skills/pipelines/." |
| `new_agent` | "Assign agent for `<skill>`" | "Add agent entry in opencode.json and create .opencode/agent/<name>.md instruction file." |

---

## 6. Outputs

| Field | Type | Description |
|-------|------|-------------|
| `proposals` | `array[AdaptationProposal]` | Ranked list of HITL-pending proposals (empty if no patterns detected) |
| `analysis_mode` | `string` | `single_session` or `multi_session` |
| `sessions_analyzed` | `integer` | Total sessions used in analysis |
| `total_candidates_found` | `integer` | Candidates before top-N truncation |
| `analysis_skipped` | `boolean` | True if session_summary was absent |
| `metrics` | `object` | Standard execution metrics |
| `feedback` | `array[object]` | Feedback to orchestrator |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["proposals", "analysis_mode", "sessions_analyzed", "total_candidates_found", "metrics", "feedback"],
  "additionalProperties": false,
  "properties": {
    "proposals": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "type", "title", "rationale", "change_description", "expected_improvement", "effort_estimate", "confidence", "priority_score", "evidence", "hitl_status"],
        "additionalProperties": false,
        "properties": {
          "id":                   { "type": "string" },
          "type":                 { "type": "string", "enum": ["new_skill", "modify_skill", "retire_skill", "new_pipeline", "new_agent"] },
          "title":                { "type": "string" },
          "rationale":            { "type": "string" },
          "change_description":   { "type": "string" },
          "expected_improvement": { "type": "string" },
          "effort_estimate":      { "type": "string", "enum": ["low", "medium", "high"] },
          "confidence":           { "type": "number", "minimum": 0, "maximum": 1 },
          "priority_score":       { "type": "number", "minimum": 0, "maximum": 1 },
          "evidence":             { "type": "object" },
          "hitl_status":          { "type": "string", "enum": ["pending"] }
        }
      }
    },
    "analysis_mode":          { "type": "string", "enum": ["single_session", "multi_session"] },
    "sessions_analyzed":      { "type": "integer", "minimum": 1 },
    "total_candidates_found": { "type": "integer", "minimum": 0 },
    "analysis_skipped":       { "type": "boolean" },
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
        "feedback":       { "type": "array" },
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

- **Suggestion-only** — this skill NEVER writes to registry, pipeline configs, SKILL.md files, or any system state other than writing `proposals` to session output.
- All returned proposals MUST have `hitl_status: "pending"` — pre-approved proposals are a contract violation.
- Failure threshold for `modify_skill` proposals: `failure_rate > 0.30` OR `hitl_rejection_ratio >= 0.30`.
- Trend confidence requires ≥ 3 sessions; single-session analysis caps confidence at 0.60.
- Maximum 10 proposals per invocation (default 5) — prevents overwhelming the human reviewer.
- `retire_skill` proposals MUST include a `replacement` field if one exists in the registry; otherwise include `replacement: null` with rationale.
- `new_pipeline` proposals require ≥ 3 sequential skills appearing together in ≥ 3 sessions.
- This skill does not trigger HITL gates itself — the orchestrator presents `proposals` to the user and routes approved proposals to adaptation-applicator (SKL-051).
- Proposal IDs must be deterministic within a session (UUID derived from session_id + candidate hash) to prevent duplicate proposals across re-runs.

---

## 8. Security Considerations

- Reads only aggregated statistics from `session_summary` — no user content, code snippets, requirement text, or credentials ever processed.
- `evidence` objects contain only numeric metrics and skill names (no user data).
- All `change_description` fields are templated — no user input is interpolated into proposal text.
- Output proposals are informational only; they have no execution authority.
- The `hitl_status: "pending"` invariant is enforced in output schema via `enum: ["pending"]` — a single allowed value. This prevents a misconfigured orchestrator from auto-routing proposals to adaptation-applicator without human review.

---

## 9. Token Optimization

- Operates entirely on aggregated statistics from `session_summary` — compact JSON, ~200–500 tokens per session.
- `historical_summaries` capped at 10 sessions — prevents unbounded context growth.
- Proposal generation uses template strings, not free-form LLM generation — minimal output token cost.
- `max_proposals: 5` default bounds output size to ~1,000–2,000 tokens.
- No state writes — no write-back overhead.

---

## 10. Quality Checklist

- [ ] Returns `analysis_skipped: true` gracefully when `session_summary` absent
- [ ] All proposals have `hitl_status: "pending"` — never pre-approved
- [ ] Failure rate threshold correctly applied (> 0.30 not ≥ 0.30)
- [ ] Trend analysis only used when ≥ 3 historical sessions available
- [ ] `retire_skill` proposals only generated when skill has ≥ 5 sessions of zero invocations
- [ ] `new_pipeline` proposals only generated when ≥ 3 skills appear in sequence ≥ 3 times
- [ ] Proposals ranked by `priority_score` descending
- [ ] Max proposals capped at `effective_max` (default 5)
- [ ] No user content in proposal text (no interpolation of req text, code, etc.)
- [ ] Standard `metrics` and `feedback` fields present in all outputs
- [ ] Output valid JSON matching output schema

---

## 11. Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| `session_summary` absent or null | Return `{ proposals: [], analysis_skipped: true }` — not an error |
| No patterns detected above thresholds | Return empty `proposals[]` with `total_candidates_found: 0` |
| `historical_summaries` missing | Fall back to single-session analysis; cap confidence at 0.60 |
| `registry_snapshot` missing | Skip `retire_skill` and `new_pipeline` analysis; proceed with failure-rate analysis only |
| `max_proposals` exceeds 10 | Clamp to 10; emit `info` feedback to orchestrator |
| Invalid `proposal_types` filter value | Ignore unknown types; proceed with valid types only |

---

## 12. Human-in-the-Loop Gates

This skill **submits proposals** to a HITL gate. It does not itself enforce a gate — the orchestrator presents the proposals.

| Gate | Trigger | Behavior |
|------|---------|----------|
| `adaptation_review` | `proposals.length > 0` | Orchestrator presents ranked proposals to user. User selects 0..N proposals to approve. Approved proposals have `hitl_status` changed to `"approved"` by orchestrator before routing to SKL-051. |

**Gate contract:**
- The orchestrator MUST NOT route any proposal to adaptation-applicator (SKL-051) with `hitl_status != "approved"`.
- The user may approve, modify, or reject any proposal.
- Approving zero proposals is valid — no change is made to the system.
- The orchestrator records the gate decision in `session_context.gates_decided`.

---

## 13. Skill Composition

`adaptive-proposal-generator` is invoked at session end after `session-insights` (SKL-048) and optionally after `enhancement-dashboard` (SKL-049).

```yaml
# Invocation pattern (conceptual)
name: adaptive-proposal-generator-invocation
trigger: after session-insights completes AND user requests improvement suggestions
async: false  # blocks until HITL gate is resolved
input_map:
  session_summary:       "state_manager.read(behavioral_telemetry).session_summary"
  historical_summaries:  "state_manager.read(behavioral_telemetry).historical_summaries"
  registry_snapshot:     "fs.read(skills/registry.json)"
  session_id:            "session_context.session_id"
  max_proposals:         5

consumes_from:
  - session-insights (SKL-048)   # must have written session_summary first
  - enhancement-dashboard (SKL-049)  # co-occurs — dashboard rendered first

produces_for:
  - adaptation-applicator (SKL-051)  # receives approved proposals after HITL gate
```

### Example Proposal Output

```json
{
  "proposals": [
    {
      "id": "PROP-a1b2c3",
      "type": "modify_skill",
      "title": "Reduce failure rate of architecture-design (currently 38%)",
      "rationale": "architecture-design failed in 3 of 8 invocations this session (38%). Across 4 historical sessions, rolling failure rate is 31%. This exceeds the 30% threshold.",
      "change_description": "Review execution steps 3–5 of architecture-design SKILL.md. Add 2 worked examples to knowledge file. Tighten quality checklist items 4 and 7.",
      "expected_improvement": "Reduce failure rate from 38% to < 15% within 5 sessions.",
      "effort_estimate": "medium",
      "confidence": 0.85,
      "priority_score": 0.83,
      "evidence": {
        "signal": "high_failure_rate",
        "observed_value": 0.38,
        "sessions_observed": 4,
        "target_skill": "architecture-design"
      },
      "hitl_status": "pending"
    }
  ],
  "analysis_mode": "multi_session",
  "sessions_analyzed": 5,
  "total_candidates_found": 3
}
```

### Changelog

| Version | Date | Change |
|---------|------|--------|
| 1.0.0 | 2026-06-20 | Initial version — failure pattern analysis, HITL rejection analysis, feedback loop gap detection, pipeline routing analysis, inactivity retire detection; HITL-gated proposals only |

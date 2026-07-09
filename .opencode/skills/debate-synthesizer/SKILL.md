---
name: debate-synthesizer
version: 1.0.0
domain: requirements
description: 'Use when adversarial validation of requirements is needed before architecture begins. Triggered when pipeline_config.debate_requirements: true. Runs two independent requirement-analyzer passes (advocate + skeptic) and synthesizes a debate-hardened unified requirements set. Triggers on: "debate requirements", "validate requirements adversarially", "multi-agent requirements debate".'
author: system
---

## Purpose

Receive two independent requirement analyses — one from an "advocate" pass (expands requirements, finds opportunities and value) and one from a "skeptic" pass (challenges assumptions, finds gaps and risks) — and synthesize them into a single unified, debate-hardened requirements set. Identify conflicts between the two passes and either resolve them automatically (when the resolution is unambiguous, based on relative priority and confidence) or flag them for a HITL gate. The unified requirements set produced by this skill replaces the original requirement-analyzer output for all downstream pipeline phases. This skill is the adversarial counterpart to a single-pass requirement analysis and is only active when `pipeline_config.debate_requirements === true`.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `advocate_output` | `object` | Yes | Output from the advocate instance of `requirement-analyzer`. Same schema as requirement-analyzer output: `requirements[]`, `open_questions[]`, `assumptions[]`, `risks[]`. The advocate pass was primed with the prefix: "Analyze as an advocate: find opportunities and value in these requirements." |
| `skeptic_output` | `object` | Yes | Output from the skeptic instance of `requirement-analyzer`. Same schema as advocate_output. The skeptic pass was primed with the prefix: "Analyze as a skeptic: challenge assumptions, find gaps, and identify risks." |
| `original_requirements` | `array[object]` | No | Raw requirements from the first (non-debate) requirement-analyzer pass, used as a baseline for REQ ID preservation and semantic comparison. Each item follows the same schema as `requirements[]` in requirement-analyzer output: `{ id, type, statement, priority }`. |
| `session_id` | `string` | Yes | UUID v4 of the active pipeline session. Used for artifact naming and HITL gate correlation. |
| `auto_resolve_threshold` | `float` | No | When one side's priority level is at or above this threshold distance from the other's on a conflict, resolve automatically in favor of the stronger side. Priority distance is computed on the ordinal scale: critical=4, high=3, medium=2, low=1. A threshold of 0.7 means a normalized distance >= 0.7 (approximately one full priority tier) triggers auto-resolution. Default: `0.7`. |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "advocate_output": {
      "type": "object",
      "properties": {
        "requirements": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "id":        { "type": "string", "pattern": "^REQ-[A-Z]{3}-\\d{3}$" },
              "type":      { "type": "string", "enum": ["F", "NF", "C"] },
              "statement": { "type": "string" },
              "priority":  { "type": "string", "enum": ["critical", "high", "medium", "low"] }
            },
            "required": ["id", "type", "statement", "priority"]
          }
        },
        "open_questions": { "type": "array", "items": { "type": "string" } },
        "assumptions": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "statement":  { "type": "string" },
              "confidence": { "type": "string", "enum": ["high", "medium", "low"] }
            },
            "required": ["statement", "confidence"]
          }
        },
        "risks": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "description": { "type": "string" },
              "severity":    { "type": "string", "enum": ["critical", "high", "medium", "low"] },
              "impact":      { "type": "string" }
            },
            "required": ["description", "severity", "impact"]
          }
        }
      },
      "required": ["requirements", "open_questions", "assumptions", "risks"]
    },
    "skeptic_output": {
      "type": "object",
      "properties": {
        "requirements": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "id":        { "type": "string", "pattern": "^REQ-[A-Z]{3}-\\d{3}$" },
              "type":      { "type": "string", "enum": ["F", "NF", "C"] },
              "statement": { "type": "string" },
              "priority":  { "type": "string", "enum": ["critical", "high", "medium", "low"] }
            },
            "required": ["id", "type", "statement", "priority"]
          }
        },
        "open_questions": { "type": "array", "items": { "type": "string" } },
        "assumptions": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "statement":  { "type": "string" },
              "confidence": { "type": "string", "enum": ["high", "medium", "low"] }
            },
            "required": ["statement", "confidence"]
          }
        },
        "risks": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "description": { "type": "string" },
              "severity":    { "type": "string", "enum": ["critical", "high", "medium", "low"] },
              "impact":      { "type": "string" }
            },
            "required": ["description", "severity", "impact"]
          }
        }
      },
      "required": ["requirements", "open_questions", "assumptions", "risks"]
    },
    "original_requirements": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id":        { "type": "string", "pattern": "^REQ-[A-Z]{3}-\\d{3}$" },
          "type":      { "type": "string", "enum": ["F", "NF", "C"] },
          "statement": { "type": "string" },
          "priority":  { "type": "string", "enum": ["critical", "high", "medium", "low"] }
        },
        "required": ["id", "type", "statement", "priority"]
      }
    },
    "session_id": {
      "type": "string",
      "format": "uuid",
      "description": "UUID v4 of the active pipeline session."
    },
    "auto_resolve_threshold": {
      "type": "number",
      "minimum": 0.0,
      "maximum": 1.0,
      "default": 0.7,
      "description": "Normalized priority-distance threshold above which conflicts are auto-resolved."
    }
  },
  "required": ["advocate_output", "skeptic_output", "session_id"]
}
```

## Required Context

- Both `advocate_output` and `skeptic_output` MUST have been produced by `requirement-analyzer` in the same pipeline run, with the advocate and skeptic system prompts prepended respectively. Passing outputs from unrelated runs will produce invalid conflict detection.
- `original_requirements` is strongly recommended. When absent, REQ IDs from `advocate_output.requirements` are used as the canonical baseline for ID assignment.
- The orchestrator is responsible for running both requirement-analyzer instances in parallel before invoking this skill. This skill does not invoke requirement-analyzer itself.
- `pipeline_config.debate_requirements` MUST be `true` in the session state for this skill to be reached. The orchestrator enforces this gate; this skill does not re-check it.
- If `graphify-out/graph.json` exists, run `graphify query "existing requirement IDs and domain entities"` before Step 1 to obtain the current set of REQ IDs in the codebase. Use the result to avoid ID collisions when minting new requirement IDs in Step 6.

## Execution Logic

```
Step 1 — Merge requirement lists
  Collect all requirements from advocate_output.requirements and skeptic_output.requirements
  into a single candidate pool.

  Deduplication rule:
    Two requirements are considered the same if their statement vectors have cosine similarity
    >= 0.90 (semantic duplicate) OR if they share the same REQ ID from original_requirements.
    When duplicates are found:
      - Keep the version with the higher priority ("critical" > "high" > "medium" > "low").
      - If priority is equal, prefer the advocate version (advocate bias for inclusion).

  Tag each surviving requirement with its provenance:
    source: "advocate_only"  — present only in advocate_output
    source: "skeptic_only"   — present only in skeptic_output
    source: "both"           — present (as semantic match or shared ID) in both passes

  Output: candidate_requirements[]
    Each item: { id, type, statement, priority, source }

  Guard: if advocate_output.requirements is empty AND skeptic_output.requirements is empty,
  halt and return error EMPTY_DEBATE_INPUTS immediately.

Step 2 — Detect conflicts
  A conflict exists when ANY of the following conditions is true for a given requirement
  (matched by REQ ID or semantic similarity >= 0.90):

    CONFLICT_TYPE_PRIORITY:
      The same requirement has different priority levels between the two passes.
      (e.g., advocate says "high", skeptic says "low".)

    CONFLICT_TYPE_SCOPE:
      The advocate includes a requirement as a functional item (type: "F") while the skeptic
      has classified the equivalent statement as an assumption or flagged it as out-of-scope
      in skeptic_output.assumptions or skeptic_output.risks.

    CONFLICT_TYPE_EXISTENCE:
      The advocate includes a requirement (source: "advocate_only") with priority "critical"
      or "high", AND the skeptic explicitly surfaces the same topic as a risk with severity
      "critical" or "high" — meaning the two passes disagree on whether to include or reject
      the item.

  For each conflict detected, record:
    {
      conflict_id:          "CONFLICT-<NNN>" (sequential, zero-padded to 3 digits),
      req_id:               REQ ID of the conflicted requirement (from candidate_requirements),
      advocate_position:    prose description of the advocate's stance on this requirement,
      skeptic_position:     prose description of the skeptic's stance on this requirement,
      conflict_type:        "priority" | "scope" | "existence",
      advocate_priority:    priority value from advocate pass (or null if absent),
      skeptic_priority:     priority value from skeptic pass (or null if absent)
    }

  Output: conflicts[]

Step 3 — Collect unique insights
  Scan candidate_requirements[] for items where source == "advocate_only" OR source == "skeptic_only"
  AND priority is "critical" or "high".
  These are requirements that one pass surfaced with high confidence while the other pass
  missed entirely. They represent unique analytical value from each perspective.

  Do NOT include requirements that are already tracked in conflicts[] (unique insights are
  non-conflicting additions, not disputed items).

  Output: unique_insights[]
    Each item: { req_id, source ("advocate_only" | "skeptic_only"), statement, priority, rationale }
    rationale: brief one-sentence explanation of why this insight adds value to the final set.

Step 4 — Auto-resolve low-ambiguity conflicts
  For each conflict in conflicts[]:

    Compute priority_distance:
      Map priority to ordinal: critical=4, high=3, medium=2, low=1, absent=0.
      distance = abs(advocate_ordinal - skeptic_ordinal) / 4.0   (normalized to [0.0, 1.0])

    If distance >= auto_resolve_threshold:
      Determine winner:
        If advocate_ordinal > skeptic_ordinal: winner = "advocate"
        If skeptic_ordinal > advocate_ordinal: winner = "skeptic"
        If one side is absent (ordinal=0): the present side wins.
      Produce auto-resolution record:
        {
          conflict_id:  <from conflicts[]>,
          resolution:   "auto",
          winner:       "advocate" | "skeptic",
          rationale:    "Priority distance <distance> >= threshold <auto_resolve_threshold>.
                         <winner> assigned priority <winning_priority> which prevails."
        }
      Move conflict from pending to auto_resolved[].

    If distance < auto_resolve_threshold:
      Leave conflict in pending_conflicts[].

  Cap pending_conflicts[] at 5 items (HITL question cap):
    If pending_conflicts.length > 5:
      Sort remaining pending conflicts by priority_distance ascending (least clear first).
      For conflicts beyond position 5: auto-resolve conservatively (skeptic wins).
      Emit WARN: debate_hitl_cap_exceeded — "<N> conflicts beyond HITL cap auto-resolved
      conservatively (skeptic wins)."

  Output: auto_resolved[], pending_conflicts[]

Step 5 — HITL gate for unresolved conflicts (only if pending_conflicts is non-empty)
  If pending_conflicts[] is empty: skip this step entirely.

  Present the following prompt to the user (one block per conflict, in sequence):

    "SPEC DEBATE -- UNRESOLVED CONFLICTS (<N> items)
     Two independent analyses of your requirements produced conflicting interpretations.
     Please choose the preferred position for each conflict below.
     -----------------------------------------------------------------------
     [<conflict_id>]  (re: <req_id>)
     Type: <conflict_type>

     Advocate: <advocate_position>
     Skeptic:  <skeptic_position>

     Your choice: [ADVOCATE] / [SKEPTIC] / [MERGE BOTH]
     -----------------------------------------------------------------------"

  Repeat the block for each item in pending_conflicts[].

  Accepted user responses (case-insensitive):
    "ADVOCATE"   — resolve in favor of advocate position
    "SKEPTIC"    — resolve in favor of skeptic position
    "MERGE BOTH" — include both perspectives; requirement statement is broadened to
                   acknowledge both the opportunity (advocate) and the risk (skeptic)
                   as a compound constraint.

  For each user choice, produce user-resolution record:
    {
      conflict_id:  <from pending_conflicts[]>,
      resolution:   "user",
      winner:       "advocate" | "skeptic" | "merged",
      rationale:    "User selected <choice> at HITL gate."
    }

  Timeout behavior (3600s elapsed with no user response):
    Resolve ALL remaining pending_conflicts[] in favor of skeptic (conservative choice).
    Produce resolution records with resolution: "timeout", winner: "skeptic".
    Emit WARN: debate_gate_timed_out — "HITL gate timed out after 3600s.
    <N> conflicts resolved conservatively in favor of skeptic."

  Output: user_resolved[]  (includes both user-chosen and timeout-resolved items)

Step 6 — Assemble unified requirements
  Begin with candidate_requirements[] as the working set.

  Apply auto_resolved[] decisions:
    For each auto-resolved conflict:
      If winner == "advocate": retain advocate's version of the requirement (priority, statement).
      If winner == "skeptic":  apply skeptic's priority or remove the requirement if the
                               skeptic flagged it as out-of-scope (conflict_type == "existence").

  Apply user_resolved[] decisions:
    For each user-resolved conflict:
      "advocate": retain advocate's version.
      "skeptic":  apply skeptic's version or remove if out-of-scope.
      "merged":   produce a new requirement statement that reads:
                  "The system SHALL <advocate_action> [subject to: <skeptic_constraint>]."
                  Assign priority: max(advocate_priority, skeptic_priority).

  Incorporate unique_insights[]:
    For each unique insight not already present in the working set and not overridden
    by a conflict resolution above: add it to the unified set.
    These are additive — they do not displace existing requirements.

  Assign final REQ IDs:
    Preserve original REQ IDs from original_requirements[] where available.
    For requirements that existed in neither original pass: assign new IDs continuing
    the numeric sequence from the highest existing original ID in the same domain prefix.
    Format: REQ-<DOM>-<NNN> — never reuse a retired or conflicted-away ID.

  Tag each unified requirement:
    debate_source:   "advocate" | "skeptic" | "both" | "merged"
    debate_hardened: true   (MUST be set on every item without exception)

  Output: unified_requirements[]
    Each item: { id, type, statement, priority, debate_source, debate_hardened: true }

Step 7 — Synthesize debate summary
  Compose a prose paragraph of exactly 3 to 5 sentences covering:
    Sentence 1: Total counts — how many requirements the advocate identified vs. the skeptic,
                and how many survived into the unified set.
    Sentence 2: The top conflict(s) (up to 3) and how they were resolved
                (auto vs. user vs. conservative timeout).
    Sentence 3: The most significant risk(s) the skeptic surfaced that the advocate had missed,
                and whether they were incorporated into the final set.
    Sentence 4 (if applicable): Net new requirements added from unique insights that were
                absent from both original passes before the debate.
    Sentence 5 (if applicable): Any notable merges or compound constraints produced by
                "MERGE BOTH" user resolutions.

  Do not use bullet points. This is a narrative paragraph for human readers and audit logs.

  Output: debate_summary (string, 3–5 sentences, no markdown formatting)

Step 8 — Write debate transcript artifact and assemble output
  Determine artifact path:
    artifacts/debate-<ISO8601-timestamp-UTC>.md
    Example: artifacts/debate-2026-07-09T14:32:00Z.md
    ISO8601 format: YYYY-MM-DDTHH:MM:SSZ (no fractional seconds, no timezone offset — always UTC Z).

  Write the artifact file with this exact structure:

    # Spec Debate Transcript -- <session_id>
    **Timestamp:** <ISO8601>
    **Advocate requirements:** <count of advocate_output.requirements>
    **Skeptic requirements:** <count of skeptic_output.requirements>
    **Conflicts detected:** <count of conflicts[]>
    **Auto-resolved:** <count of auto_resolved[]>
    **User-resolved:** <count of user_resolved[] excluding timeout-resolved items>
    **Timeout-resolved:** <count of timeout-resolved items in user_resolved[]>
    **Final unified requirements:** <count of unified_requirements[]>

    ## Debate Summary
    <debate_summary>

    ## Conflicts and Resolutions
    | ID | Req | Conflict Type | Advocate Position | Skeptic Position | Resolution | Winner |
    |----|-----|---------------|-------------------|------------------|------------|--------|
    (one row per entry in conflicts[], showing the final resolution and winner)

    ## Unique Insights Added
    | Req ID | Source | Priority | Statement |
    |--------|--------|----------|-----------|
    (one row per entry in unique_insights[] that was incorporated into unified_requirements[])

    ## Unified Requirements
    | ID | Type | Priority | Debate Source | Statement |
    |----|------|----------|---------------|-----------|
    (one row per entry in unified_requirements[])

  Security check before writing:
    Scan all statement fields and position fields for PII patterns
    (email addresses, phone numbers, full names, government IDs).
    Replace any PII match with "[REDACTED]" before writing to disk.
    Never write credentials, API keys, tokens, or passwords to the artifact.

  Assemble and return the complete output object (see Outputs section).
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `unified_requirements` | `array[object]` | Debate-hardened requirements. Same schema as `requirement-analyzer`'s `requirements[]`, extended with `debate_source` and `debate_hardened` fields. Every item has `debate_hardened: true`. |
| `conflicts` | `array[object]` | All conflicts detected across both passes. Each entry contains: `conflict_id`, `req_id`, `advocate_position`, `skeptic_position`, `conflict_type`, `resolution`, `winner`. |
| `unresolved_conflicts` | `array[object]` | Conflicts that could not be resolved. Populated only when the HITL gate timed out on one or more items and the timeout resolution itself produced an ambiguous outcome. Empty array in the nominal case. |
| `debate_summary` | `string` | Prose narrative (3–5 sentences) summarizing the debate outcome, conflict resolutions, and net additions. |
| `artifact_path` | `string` | Relative path to the written debate transcript artifact (e.g., `artifacts/debate-2026-07-09T14:32:00Z.md`). |
| `metrics` | `object` | Execution telemetry: `tokens_in`, `tokens_out`, `duration_ms`, `items_produced`, `version`. |
| `feedback` | `array[object]` | Feedback loop entries. A `backpropagate` entry targeting `requirement-analyzer` is emitted when more than 5 requirements changed between the input passes and the unified output. |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "unified_requirements": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id":              { "type": "string", "pattern": "^REQ-[A-Z]{3}-\\d{3}$" },
          "type":            { "type": "string", "enum": ["F", "NF", "C"] },
          "statement":       { "type": "string" },
          "priority":        { "type": "string", "enum": ["critical", "high", "medium", "low"] },
          "debate_source":   { "type": "string", "enum": ["advocate", "skeptic", "both", "merged"] },
          "debate_hardened": { "type": "boolean", "enum": [true] }
        },
        "required": ["id", "type", "statement", "priority", "debate_source", "debate_hardened"]
      }
    },
    "conflicts": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "conflict_id":        { "type": "string", "pattern": "^CONFLICT-\\d{3}$" },
          "req_id":             { "type": "string", "pattern": "^REQ-[A-Z]{3}-\\d{3}$" },
          "advocate_position":  { "type": "string" },
          "skeptic_position":   { "type": "string" },
          "conflict_type":      { "type": "string", "enum": ["priority", "scope", "existence"] },
          "resolution":         { "type": "string", "enum": ["auto", "user", "timeout"] },
          "winner":             { "type": "string", "enum": ["advocate", "skeptic", "merged"] }
        },
        "required": [
          "conflict_id", "req_id", "advocate_position", "skeptic_position",
          "conflict_type", "resolution", "winner"
        ]
      }
    },
    "unresolved_conflicts": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "conflict_id":       { "type": "string", "pattern": "^CONFLICT-\\d{3}$" },
          "req_id":            { "type": "string" },
          "advocate_position": { "type": "string" },
          "skeptic_position":  { "type": "string" },
          "reason":            { "type": "string" }
        },
        "required": ["conflict_id", "req_id", "advocate_position", "skeptic_position", "reason"]
      }
    },
    "debate_summary": {
      "type": "string",
      "minLength": 50,
      "description": "Prose narrative of 3 to 5 sentences summarizing the debate outcome."
    },
    "artifact_path": {
      "type": "string",
      "pattern": "^artifacts/debate-\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}Z\\.md$",
      "description": "Relative path to the written debate transcript markdown file."
    },
    "metrics": { "$ref": "#/$defs/metrics" },
    "feedback": {
      "type": "array",
      "items": { "$ref": "#/$defs/feedback_entry" }
    }
  },
  "required": [
    "unified_requirements",
    "conflicts",
    "unresolved_conflicts",
    "debate_summary",
    "artifact_path",
    "metrics",
    "feedback"
  ],
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

- `debate_hardened: true` MUST be set on every item in `unified_requirements[]` without exception. A `unified_requirements` entry missing this field is a schema violation and MUST be rejected before output is returned.
- `unified_requirements` MUST use REQ IDs from `original_requirements[]` wherever a semantic or ID match exists. New REQ IDs are assigned only for requirements that did not exist in any original pass. Reuse of retired or conflicted-away IDs is forbidden.
- This skill MUST NOT be invoked more than once per pipeline run. The orchestrator enforces this; if a second invocation is detected within the same `session_id`, return error `DUPLICATE_INVOCATION`.
- Maximum 5 HITL questions per debate run. If `pending_conflicts[]` contains more than 5 items after Step 4, the excess items beyond position 5 are auto-resolved conservatively (skeptic wins) before the HITL gate is presented. The `WARN: debate_hitl_cap_exceeded` event is emitted to the feedback channel.
- If `advocate_output` and `skeptic_output` have >= 95% requirement overlap (measured as the fraction of advocate requirements that are semantic duplicates of skeptic requirements), emit `INFO: debate_near_identical` and return `original_requirements[]` (or `advocate_output.requirements[]` if original is absent) unchanged as `unified_requirements[]`. No HITL gate is triggered in this fast-path. All items in the returned set are still tagged `debate_hardened: true` and `debate_source: "both"`.
- Token budget: the combined token count of `advocate_output` and `skeptic_output` MUST NOT exceed 8000 tokens before processing. If exceeded, compress each input by retaining only `requirements[]`, `open_questions[]`, and `risks[]` and dropping `metadata{}`, `metrics{}`, and `feedback[]` from both objects. Emit `INFO: debate_inputs_compressed` after trimming.
- `unified_requirements[]` must not contain duplicate REQ IDs. Uniqueness is enforced after Step 6; if a duplicate ID collision is detected, append a suffix `-B`, `-C`, etc. to the later-assigned ID and emit `WARN: req_id_collision`.
- `open_questions[]` from both passes are merged (deduplicated by semantic similarity >= 0.85) and carried through to downstream phases via `unified_requirements` metadata. They are not part of the unified_requirements array itself but SHOULD be noted in the artifact.

## Security Considerations

- Strip PII from all requirement statement fields, position descriptions, and rationale strings before writing the artifact. PII patterns to match: email addresses (`\S+@\S+\.\S+`), phone numbers (common North American and international formats), full personal names when accompanied by a role or title, and government ID formats (SSN, passport number patterns).
- Replace any matched PII with the literal string `[REDACTED]` before writing to disk. The in-memory `unified_requirements[]` returned in the output object is also PII-scrubbed.
- No credentials, API keys, secrets, tokens, or connection strings may appear in any output field or in the artifact. If a requirement statement contains what appears to be a credential (token-like string of >= 20 random characters, or a pattern matching `-----BEGIN`, `sk-`, `ghp_`, `xoxb-`, etc.), redact it and emit `WARN: credential_pattern_detected` in feedback.
- The artifact file is written to the `artifacts/` directory within the project. Do not write outside this directory. Do not follow symbolic links when resolving the artifact path.
- This skill does not read from or write to environment variables, dotenv files, or secret stores.

## Token Optimization

- Project both `advocate_output` and `skeptic_output` at input ingestion time (before Step 1). Retain only `requirements[]`, `open_questions[]`, and `risks[]` from each. Drop `metadata{}`, `metrics{}`, `feedback[]`, and any fields not in the input schema.
- During conflict detection (Step 2), represent each requirement as a compact tuple `(id, priority_ordinal, type)` for comparison. Do not carry full statement text through the conflict-detection loop; resolve statement text only when assembling `advocate_position` and `skeptic_position` prose.
- Limit `advocate_position` and `skeptic_position` strings in `conflicts[]` to 200 characters each. Truncate with `...` if longer.
- For the HITL gate presentation (Step 5), render only the conflict-relevant fields: `conflict_id`, `req_id`, `conflict_type`, `advocate_position`, `skeptic_position`. Do not include full requirement lists in the HITL prompt.
- `debate_summary` is a flat string (no nested objects). Keep it under 500 characters.

## Quality Checklist

- [ ] All items in `unified_requirements[]` have unique REQ IDs
- [ ] All items in `unified_requirements[]` have `debate_hardened: true` set
- [ ] All items in `unified_requirements[]` have a valid `debate_source` value
- [ ] All entries in `conflicts[]` have both a `resolution` and a `winner` recorded
- [ ] `unresolved_conflicts[]` is populated only if HITL timeout left items genuinely unresolvable (nominal value is empty array `[]`)
- [ ] Artifact file is written to `artifacts/debate-<ISO8601>.md` when processing completes
- [ ] Artifact contains all four sections: Debate Summary, Conflicts and Resolutions, Unique Insights Added, Unified Requirements
- [ ] `debate_summary` is 3 to 5 sentences and contains no markdown formatting characters
- [ ] No PII or credential patterns present in artifact or output fields
- [ ] `feedback[]` contains a `backpropagate` entry targeting `requirement-analyzer` when more than 5 requirements changed

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| `advocate_output.requirements` and `skeptic_output.requirements` are both empty | Halt immediately. Return `{"error": "EMPTY_DEBATE_INPUTS", "message": "Both advocate and skeptic requirement lists are empty. Cannot proceed with debate synthesis."}` |
| `advocate_output` and `skeptic_output` have >= 95% semantic overlap | Fast-path return: emit `INFO: debate_near_identical`, return `original_requirements[]` (or `advocate_output.requirements[]` if original absent) as `unified_requirements[]` with `debate_hardened: true` and `debate_source: "both"` on each item. No HITL gate is triggered. |
| HITL gate times out (3600s with no user response) | Resolve all remaining `pending_conflicts[]` in favor of skeptic. Set `resolution: "timeout"`, `winner: "skeptic"` on each. Emit `WARN: debate_gate_timed_out`. Continue to Step 6 with timeout resolutions applied. Do not block the pipeline. |
| Combined input token count exceeds 8000 tokens | Compress inputs (drop `metadata{}`, `metrics{}`, `feedback[]`). If still over budget after compression, truncate `requirements[]` in each pass to the top 40 items by priority ordinal (critical first). Emit `WARN: debate_inputs_truncated`. |
| `session_id` matches a session that already ran this skill | Return `{"error": "DUPLICATE_INVOCATION", "message": "debate-synthesizer has already run for session <session_id>. This skill must not be invoked more than once per pipeline run."}` |
| REQ ID collision detected after Step 6 | Append suffix `-B`, `-C`, etc. to the later-assigned duplicate ID. Emit `WARN: req_id_collision` with the affected IDs listed in evidence. Continue; do not fail. |
| Artifact directory `artifacts/` does not exist | Create the directory before writing. If creation fails due to permissions, emit `WARN: artifact_write_failed` and continue. Return `artifact_path: null` in output. |

## 12. Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Behavior |
|------|---------|---------|----------|
| Spec Debate Conflict Review | `pending_conflicts.length > 0` after Step 4 auto-resolution (capped at 5 items) | 3600s | Pause pipeline. Present each pending conflict with advocate and skeptic positions. Wait for user to choose ADVOCATE, SKEPTIC, or MERGE BOTH for each item. On timeout: resolve all remaining items in favor of skeptic. Emit `WARN: debate_gate_timed_out`. Resume pipeline. |

- The HITL gate is presented as a single batched prompt (all pending conflicts in one message) rather than sequential individual prompts, to minimize round-trips.
- If the user responds to only a subset of the presented conflicts (partial response), apply user choices to the answered items and resolve the unanswered items via timeout (skeptic wins). Emit `WARN: debate_gate_partial_response` with the list of unanswered conflict IDs.
- If `pending_conflicts[]` is empty after Step 4, the HITL gate is skipped entirely and the pipeline proceeds without interruption.
- The HITL gate result (user choices or timeout) is recorded in the artifact under the Conflicts and Resolutions table so the decision is auditable.

## 13. Skill Composition

`debate-synthesizer` is invoked by the orchestrator after two parallel `requirement-analyzer` instances complete, and before `architecture-design` begins. It is only active in the full pipeline when `pipeline_config.debate_requirements === true`.

```yaml
# Full pipeline composition with debate enabled
composes:
  - skill: requirement-analyzer
    instance: advocate
    version: "^1.2.0"
    system_prompt_prefix: "Analyze as an advocate: find opportunities and value in these requirements."
    input_map:
      raw_input: "session.raw_requirements"
    output_map:
      output: "state.advocate_output"

  - skill: requirement-analyzer
    instance: skeptic
    version: "^1.2.0"
    system_prompt_prefix: "Analyze as a skeptic: challenge assumptions, find gaps, and identify risks."
    input_map:
      raw_input: "session.raw_requirements"
    output_map:
      output: "state.skeptic_output"

  - skill: debate-synthesizer
    version: "^1.0.0"
    depends_on: [advocate, skeptic]
    condition: "pipeline_config.debate_requirements === true"
    input_map:
      advocate_output:          "state.advocate_output"
      skeptic_output:           "state.skeptic_output"
      original_requirements:    "state.original_requirements"
      session_id:               "session.id"
      auto_resolve_threshold:   "pipeline_config.auto_resolve_threshold ?? 0.7"
    output_map:
      unified_requirements:     "state.requirements"
      conflicts:                "state.debate_conflicts"
      debate_summary:           "state.debate_summary"
      artifact_path:            "state.debate_artifact_path"
```

Pipeline position: `phase-1-requirements` (or `phase-1b-clarify` if clarification is enabled) -> `debate-synthesizer` -> `phase-2-architecture`.

`debate-synthesizer` is a terminal node in the requirements phase. Its `unified_requirements[]` output is the authoritative requirements set for all subsequent pipeline phases. Downstream skills (`architecture-design`, `feature-planning`, `database-architect`, etc.) consume `state.requirements` as set by this skill's `output_map`, not the raw requirement-analyzer output.
```

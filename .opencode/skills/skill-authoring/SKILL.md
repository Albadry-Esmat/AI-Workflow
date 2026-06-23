---
name: skill-authoring
version: 1.1.0
domain: meta
description: 'Use ONLY when creating, refactoring, splitting, validating, or evolving a skill in the skill system. Triggers on: "create a new skill", "add a skill", "refactor this skill", "split this skill", "validate this skill", "evolve the skill", "skill authoring". Do NOT use for general code tasks.'
author: system
---

## Purpose

Convert raw intent or domain knowledge into a complete, validated, registered skill artifact. This skill is the entry point for all skill creation, refactoring, splitting, and evolution. It enforces schema compliance, graph integrity, semantic correctness, and quality standards before any skill is added to the system.

Every skill in the system was produced (or should be producible) by running this skill against its source intent.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `intent` | `string` | Yes | Raw description of the needed capability — what should the skill do? |
| `domain` | `string` | Yes | Domain category (e.g., `requirements`, `review`, `meta`) |
| `operation` | `string` | Yes | `new`, `refactor`, `split`, `validate`, `evolve`, or `gap_seed` |
| `source_material` | `string` | No | Raw knowledge: book chapters, documentation, domain rules |
| `existing_skill_id` | `string` | No | `SKL-NNN` — required for `refactor`, `split`, `validate`, `evolve` |
| `dependency_hints` | `array[string]` | No | Suspected related skill IDs from existing index |
| `target_mastery_level` | `string` | No | `beginner`, `intermediate`, or `advanced` |
| `validation_mode` | `string` | No | `structural`, `semantic`, `graph`, `activation`, or `full` (default: `full`) |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "intent": { "type": "string", "minLength": 10 },
    "domain": { "type": "string", "minLength": 1 },
    "operation": { "type": "string", "enum": ["new", "refactor", "split", "validate", "evolve", "gap_seed"] },
    "source_material": { "type": "string" },
    "existing_skill_id": { "type": "string", "pattern": "^SKL-\\d{3}$" },
    "dependency_hints": { "type": "array", "items": { "type": "string", "pattern": "^SKL-\\d{3}$" } },
    "target_mastery_level": { "type": "string", "enum": ["beginner", "intermediate", "advanced"] },
    "validation_mode": { "type": "string", "enum": ["structural", "semantic", "graph", "activation", "full"], "default": "full" }
  },
  "required": ["intent", "domain", "operation"]
}
```

## Required Context

- `skills/index.yaml` — must be loaded to check for overlap, assign next ID, and validate depends_on references.
- `skills/graph/skill-graph.yaml` — must be loaded for cycle detection before graph update.
- `skills/template/skill-template.md` — mandatory template for SKILL.md generation.
- `skills/template/skill-knowledge.md` — mandatory template for knowledge file generation.
- `skills/schema/skill-schema.yaml` — schema for validating the generated metadata entry.

## Execution Logic

```
Step 0 — Deduplication guard (FEATURE-002 — create and gap_seed operations only)
  SKIP this step for: refactor, split, validate, evolve.

  INPUT: proposed_triggers (from intent or gap_context seed), proposed_description, proposed_domain

  1. Load skills/registry.json — all active + draft skills
  2. Filter: keep skills whose domain matches proposed_domain
     (if proposed_domain == "unknown", check all skills)
  3. For each candidate skill C:
       token_overlap = |proposed_triggers ∩ C.triggers| / |proposed_triggers ∪ C.triggers|
       desc_overlap  = jaccard(tokenize(proposed_description), tokenize(C.description))
       similarity    = (0.6 × token_overlap) + (0.4 × desc_overlap)
  4. Sort candidates by similarity DESC; take top 3
  5. IF max(similarity) ≥ 0.75 → DEDUP_HIT
       Present to user:
         "⚠️  Potential duplicate detected before scaffold generation:
          • <skill_id> \"<name>\"  (similarity: <score>)
            Overlapping triggers: [...]
          Options:
            [A] Extend <skill_id> instead (redirect to refactor mode)
            [B] Proceed anyway (dedup override recorded in origin_metadata)
            [C] Cancel"
       Wait for explicit choice — no default, no timeout auto-selection.
       Option A → Halt; redirect user to skill-authoring in `refactor` mode.
       Option B → Set dedup_override = true; record override_reason; proceed to Step 1.
       Option C → Halt; no state written.
     ELSE (max similarity < 0.75) → DEDUP_CLEAR; proceed to Step 1.

  Output: dedup_result { status: "DEDUP_CLEAR"|"DEDUP_HIT", override_approved, override_reason }

Step 1 — Analyze requirement and determine operation
  Parse intent for: capability, domain, caller contexts, and expected output type.
  If existing_skill_id provided: load that skill's metadata from index.yaml.
  Confirm operation type (or infer from intent if not provided):
    new:      capability does not exist in any form in the index
    refactor: capability exists but current skill is poorly structured
    split:    one skill covers multiple responsibilities → split into N atomic skills
    validate: check correctness of an existing skill without modification
    evolve:   capability exists but needs new functionality or version bump
    gap_seed: inputs are pre-populated from gap_context seed; author confirms or overrides each field
              (Step 0 still runs against pre-populated triggers; Steps 1–4 use seed values as defaults)
  Output: parsed capability spec + confirmed operation type

Step 2 — Extract reusable patterns
  Strip non-skill concerns from intent: business rules, data specifics, implementation details.
  Identify the single atomic, reusable capability at the core.
  Test reusability: can this capability be invoked from ≥ 2 different calling contexts?
    If no: it may be too specific — reconsider whether a skill is warranted.
  For split operations: decompose current skill into N responsibility statements (one per output skill).
  Output: capability spec statement — "Given X, produce Y through Z"

Step 3 — Define skill boundaries and check for overlap
  Apply Single Responsibility Rule: one skill = one deliverable type.
  Load index.yaml. Search for skills with overlapping tags, use_when, or domain.
  If overlap found:
    Option A — Extend: new skill is a specialization of an existing one (add extension edge in graph)
    Option B — Merge: new capability belongs inside an existing skill (evolve operation instead)
    Option C — Differentiate: skills are genuinely distinct — document the distinction clearly
  Define explicit out-of-scope statements (what this skill does NOT cover).
  Output: boundary definition with in-scope + out-of-scope

Step 4 — Assign schema fields (metadata entry)
  id:               assign next available SKL-NNN from current index
  name:             title-cased, max 50 chars
  short_description: active verb, max 120 chars, one sentence, no period
  description:      MANDATORY auto-trigger field for OpenCode. MUST follow this format exactly:
                      "Use when <condition>. Triggers on: \"<phrase1>\", \"<phrase2>\", \"<phrase3>\"."
                    Rules:
                      - Start with "Use when" — the condition that activates this skill
                      - Include "Triggers on:" with 3+ exact phrases the user will say
                      - Add "Do NOT use when <exclusion>" for narrow or internal skills
                      - Front-load the most discriminating keyword first
                      - Maximum 2 sentences total
                    Enforcement:
                      - Missing → BLOCK registration immediately
                      - Wrong format → BLOCK registration, return format correction instructions
                      - Correct format → proceed
                    There is no warn-and-continue. A skill that cannot auto-trigger is invalid.
  tags:             3–7 lowercase hyphenated keywords
  version:          1.0.0 for new skills; increment per semver rules for others
  mastery_level:    beginner (≤ 1 hard dependency, simple I/O) | intermediate | advanced
  use_when:         1–2 sentences — context, caller state, trigger condition
  do_not_use_when:  1–2 sentences — contra-indications, adjacent wrong uses
  depends_on:       hard requirements — IDs must exist in current index
  related_skills:   soft associations — IDs from same domain or frequent co-occurrence
  reference_path:   skills/knowledge/<kebab-name>.md
  executable_skill: skills/<domain>/<kebab-name>.md
  Output: complete metadata entry (index.yaml format)

Step 5 — Build dependency graph entry (with cycle detection)
  Add new node: { id, name, domain, mastery_level, version, status: "active" }
  Add dependency edges: from this skill to each depends_on target
  Add co-occurrence edges: to each related_skill
  Add extension edge: if this skill is a specialization of an existing one
  Run cycle detection: trace all transitive dependency paths from this node.
    If any path returns to this node: ABORT — report cycle path, do not proceed.
  Verify: all depends_on IDs exist in current index — fail if any are missing.
  Output: graph_delta { nodes: [...], edges: [...] }

Step 6 — Generate SKILL.md (Layer 2 — execution core)
  Follow skills/template/skill-template.md exactly — all 13 sections required.
  Layer 2 rule: SKILL.md must be minimal and deterministic. No examples, deep explanations,
    or source citations. Those belong in the knowledge file.
  Frontmatter MUST include:
    - name: matching the folder name under .opencode/skills/
    - description: MUST follow auto-trigger format — "Use when <condition>. Triggers on: ..."
      This field is the ONLY signal OpenCode uses to auto-select the skill.
      A skill without a correctly formatted description will NEVER be auto-triggered.
  Execution steps: 6–10 atomic steps, each producing a named output.
  Output schema: MUST include $defs.metrics and $defs.feedback_entry.
  HITL gates: define if the skill output requires human approval before downstream use.
  Skill composition: define if this skill can be composed into meta-skills.
  Output: skill_md_content (full markdown string, ready to write to disk)

Step 7 — Generate reference documentation (Layer 3 — knowledge layer)
  Follow skills/template/skill-knowledge.md — all 8 sections required.
  Minimum: 3 principles with source chapter citations.
  Minimum: 3 practices in table format.
  Minimum: 3 anti-patterns (What / Why harmful / How to fix).
  Minimum: 2 correct (✅) and 2 incorrect (❌) examples with code or data.
  All related skills must appear in the Related Skills table with IDs.
  Source references must cite exact chapter/section for every principle.
  Output: knowledge_file_content (full markdown string, ready to write to disk)

Step 8 — Multi-layer validation
  Structural validation:
    - All required metadata fields present and non-empty
    - short_description ≤ 120 chars, does not end with period
    - reference_path matches pattern skills/knowledge/*.md
    - executable_skill path matches pattern skills/<domain>/*.md
    - depends_on: all IDs exist in current index
    - tags: all lowercase, hyphenated, no spaces
  Semantic validation:
    - short_description is specific (reject: "does things", "handles stuff")
    - use_when and do_not_use_when are distinct and non-overlapping
    - No two index entries have the same short_description
    - SKILL.md all 13 sections populated (not just headers)
    - knowledge file all 8 sections populated
  Graph validation:
    - No circular dependency introduced (step 5 already caught this — confirm)
    - Dependency direction is valid: no inner-layer skill depending on outer-layer
  Output: validation_report { structural: [...], semantic: [...], graph: [...], passed: bool }

Step 9 — Register in skill index
  If validation_report.passed is true:
    Construct origin_metadata (FEATURE-003):
      source             = "gap-triggered" if gap_context present in session state, else "human"
      created_by_session = current session_id (or null if not available)
      approval_tier      = "expedited" if invoked from gap-to-skill pipeline, else "standard"
      dedup_override     = true if Step 0 returned DEDUP_HIT and user chose Option B, else false
      dedup_override_reason = user justification string if dedup_override == true, else null
      created_at         = current UTC timestamp (ISO-8601)
    Append skill_metadata_entry (with origin_metadata) to skills/index.yaml (in dependency order)
    Append skill entry (with origin_metadata) to skills/registry.json
    Apply graph_delta to skills/graph/skill-graph.yaml
    Bump index meta.version (MINOR for new skill, PATCH for validate/evolve)
    Trigger doc-maintainer (SKL-011) to update docs/skills-registry.md
  If validation_report.passed is false:
    Do NOT register. Return validation_report for resolution.
    Set registration_status: "blocked"
  Output: registration_status ("registered" | "blocked") + index version

Step 10 — Generate activation tests
  Positive triggers (3+): contexts where this skill SHOULD be selected.
    Each includes: scenario description, caller context, expected_activation: true
  Negative triggers (3+): contexts where this skill SHOULD NOT be selected.
    Each includes: scenario description, why a different skill is correct, expected_activation: false
  Edge cases (1+): boundary scenarios where activation is ambiguous.
    Each includes: resolution rule and which skill takes precedence.
  Output: activation_tests array
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `skill_metadata_entry` | `object` | Complete index.yaml entry for the new/updated skill |
| `skill_md_content` | `string` | Full SKILL.md markdown (execution spec, 13 sections) |
| `knowledge_file_content` | `string` | Full knowledge file markdown (8 sections with source citations) |
| `graph_delta` | `object` | New nodes and edges to apply to `skills/graph/skill-graph.yaml` |
| `validation_report` | `object` | Per-layer validation results (structural, semantic, graph) |
| `registration_status` | `string` | `registered` or `blocked` (blocked = validation errors present) |
| `version_assignment` | `string` | Semver string assigned to the skill |
| `activation_tests` | `array[object]` | Positive, negative, and edge-case activation scenarios |
| `quality_score` | `object` | 7-dimension score (clarity, completeness, reusability, etc.) |
| `origin_metadata` | `object` | Provenance and approval metadata populated at Step 9 (FEATURE-003) |
| `metrics` | `object` | Standard execution metrics (tokens_in, tokens_out, duration_ms, items_produced, version) |
| `feedback` | `array[object]` | Backpropagation entries if upstream changes needed |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "skill_metadata_entry": { "type": "object" },
    "skill_md_content": { "type": "string" },
    "knowledge_file_content": { "type": "string" },
    "graph_delta": {
      "type": "object",
      "properties": {
        "nodes": { "type": "array" },
        "edges": { "type": "array" }
      },
      "required": ["nodes", "edges"]
    },
    "validation_report": {
      "type": "object",
      "properties": {
        "structural": { "type": "array" },
        "semantic": { "type": "array" },
        "graph": { "type": "array" },
        "passed": { "type": "boolean" },
        "error_count": { "type": "integer" },
        "warning_count": { "type": "integer" }
      },
      "required": ["passed", "error_count"]
    },
    "registration_status": { "type": "string", "enum": ["registered", "blocked"] },
    "version_assignment": { "type": "string", "pattern": "^\\d+\\.\\d+\\.\\d+$" },
    "activation_tests": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "scenario": { "type": "string" },
          "context": { "type": "string" },
          "expected_activation": { "type": "boolean" },
          "reason": { "type": "string" },
          "type": { "type": "string", "enum": ["positive", "negative", "edge_case"] }
        },
        "required": ["scenario", "expected_activation", "reason", "type"]
      },
      "minItems": 7
    },
    "quality_score": {
      "type": "object",
      "properties": {
        "dimensions": { "type": "object" },
        "total": { "type": "integer", "minimum": 0, "maximum": 100 },
        "grade": { "type": "string", "enum": ["excellent", "good", "acceptable", "poor", "failing"] },
        "recommendations": { "type": "array", "items": { "type": "string" } }
      },
      "required": ["dimensions", "total", "grade"]
    },
    "origin_metadata": {
      "type": "object",
      "description": "Provenance and approval metadata written at Step 9 (FEATURE-003).",
      "properties": {
        "source":                { "type": "string", "enum": ["human", "gap-triggered", "migrated", "unknown"] },
        "created_by_session":    { "type": ["string", "null"] },
        "approval_tier":         { "type": "string", "enum": ["standard", "expedited", "legacy"] },
        "dedup_override":        { "type": "boolean" },
        "dedup_override_reason": { "type": ["string", "null"] },
        "created_at":            { "type": "string", "format": "date-time" }
      },
      "required": ["source", "approval_tier", "created_at"]
    },
    "metrics": { "$ref": "#/$defs/metrics" },
    "feedback": { "type": "array", "items": { "$ref": "#/$defs/feedback_entry" } }
  },
  "required": [
    "skill_metadata_entry", "skill_md_content", "knowledge_file_content",
    "graph_delta", "validation_report", "registration_status",
    "version_assignment", "activation_tests", "quality_score", "origin_metadata", "metrics"
  ],
  "$defs": {
    "metrics": {
      "type": "object",
      "properties": {
        "tokens_in": { "type": "integer" },
        "tokens_out": { "type": "integer" },
        "duration_ms": { "type": "integer" },
        "items_produced": { "type": "integer" },
        "version": { "type": "string" }
      },
      "required": ["tokens_in", "tokens_out", "duration_ms", "items_produced", "version"]
    },
    "feedback_entry": {
      "type": "object",
      "properties": {
        "type": { "type": "string", "enum": ["backpropagate", "info", "warning"] },
        "from_skill": { "type": "string" },
        "target_skill": { "type": "string" },
        "reason": { "type": "string" },
        "evidence": { "type": "object" }
      },
      "required": ["type", "from_skill", "reason"]
    }
  }
}
```

## Rules & Constraints

- A skill may NOT be registered if `validation_report.passed` is false. No exceptions.
- A skill MUST NOT introduce a circular dependency. Cycle detection in step 5 is non-negotiable.
- `short_description` MUST be distinct from all existing entries — no two skills may describe the same behavior.
- For `split` operations: all child skills must collectively cover 100% of the parent skill's scope with no overlap.
- For `evolve` operations: MAJOR version bump required if any output field is removed or renamed.
- Skill IDs (SKL-NNN) are permanent and immutable once assigned — they are never reused or reassigned.
- `skill_md_content` must pass the same schema validation as any other skill's SKILL.md output.
- Maximum depth of depends_on chain: 5 levels. Deeper chains must be flattened.
- Every skill must have at least 3 positive and 3 negative activation tests.

## Security Considerations

- Do NOT include implementation business logic in SKILL.md — skills define behavior, not implementation.
- Do NOT embed credentials, keys, or environment-specific values in any generated artifact.
- Validate all `existing_skill_id` inputs against the live index — never accept unverified IDs.
- Generated activation tests must use synthetic, non-sensitive scenario data.

## Token Optimization

- Load only the `id`, `name`, `short_description`, and `tags` fields from `index.yaml` when scanning for overlaps — omit all other fields.
- Run structural validation before semantic validation — fail fast on structural errors to avoid wasting tokens on deep analysis.
- Compress `source_material` to key concept sentences before processing; discard raw verbatim content.
- Omit `knowledge_file_content` from output if `validation_mode` is `structural` — only generate it for `semantic` and `full` modes.
- `activation_tests` use 1-sentence descriptions — no verbose explanations.

## Quality Checklist

- [ ] operation is confirmed and matches the actual change being made
- [ ] No circular dependency introduced (cycle detection passed)
- [ ] All depends_on IDs exist in the current index
- [ ] short_description is unique across all existing skills
- [ ] use_when and do_not_use_when are mutually exclusive (no logical overlap)
- [ ] SKILL.md contains all 13 sections with substantive content
- [ ] Knowledge file contains all 8 sections with at least the minimums
- [ ] At least 3 positive and 3 negative activation tests generated
- [ ] quality_score.total >= 60 before registration
- [ ] validation_report.passed is true before registration
- [ ] SKILL.md frontmatter `description` is present (BLOCK if missing)
- [ ] SKILL.md frontmatter `description` starts with "Use when" (BLOCK if not)
- [ ] SKILL.md frontmatter `description` contains "Triggers on:" with 3+ quoted phrases (BLOCK if not)
- [ ] SKILL.md is placed under `.opencode/skills/<name>/SKILL.md`

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| Circular dependency detected | Abort step 5, return error with full cycle path, set `registration_status: "blocked"` |
| `existing_skill_id` not found in index | Return error: `{"error": "SKILL_NOT_FOUND", "id": "..."}` |
| Overlap detected with existing skill | Present overlap analysis; request operator to choose: extend / merge / differentiate |
| `intent` too vague to extract boundary | Return clarification request with specific questions about scope, inputs, and outputs |
| `validation_report.error_count > 0` | Return blocked status with full error list; do not register |
| quality_score.total < 60 | Return score with recommendations; prompt to improve before re-running |
| `split` produces skills with overlapping scope | Abort, return overlap analysis, request re-decomposition |
| `description` field missing from SKILL.md frontmatter | BLOCK registration; return: `{"error": "MISSING_DESCRIPTION", "fix": "Add description following format: Use when <condition>. Triggers on: \"<phrase1>\", \"<phrase2>\", \"<phrase3>\"."}` |
| `description` present but does not start with "Use when" | BLOCK registration; return format correction instructions with example |
| `description` present but missing "Triggers on:" or fewer than 3 phrases | BLOCK registration; return format correction instructions with example |

## 12. Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Behavior |
|------|---------|---------|----------|
| New domain introduced | `operation` is `new` AND domain does not exist in current index | 300s | Pause after step 3; present boundary analysis for approval before generating artifacts |
| Overlap detected | An existing skill partially covers the same scope | 300s | Present overlap report, request decision: extend / merge / differentiate |
| Split operation | `split` would produce > 3 child skills | 300s | Present decomposition plan for approval before generating each child |

## 13. Skill Composition

`skill-authoring` is the root composer — it creates all other skills. It is itself composed into an evolution workflow:

```yaml
name: skill-evolution-pipeline
composes:
  - skill: skill-authoring
    version: "^1.0.0"
    input_map:
      intent: "improvement_description"
      operation: "evolve"
      existing_skill_id: "target_skill_id"
    output_map:
      skill_md_content: "updated_skill_md"
      validation_report: "evolution_validation"
  - skill: doc-maintainer
    version: "^1.1.0"
    input_map:
      change_type: "skill"
      change_event: "skill_metadata_entry"
    output_map:
      files_affected: "updated_docs"
```

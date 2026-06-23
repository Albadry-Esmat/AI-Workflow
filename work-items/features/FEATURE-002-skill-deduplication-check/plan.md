# FEATURE-002 — Implementation Plan: Skill Deduplication Check

## Target Skills / Artifacts

| Skill / Artifact | Action | Notes |
|---|---|---|
| `skill-authoring/SKILL.md` | Update | Insert deduplication guard as Step 0 |
| `skills/schema/dedup-check-result.schema.json` | Create | New schema for structured dedup result |

---

## §1 — Deduplication Guard: Step 0 in skill-authoring

Insert as the first step in the `create` and `gap_seed` workflow, before any scaffold is generated.

### Algorithm (v1 — trigger token overlap)

```
INPUT: proposed_triggers (list<string>), proposed_description (string), proposed_domain (string)

1. Load skills/registry.json → all active + draft skills
2. Filter: keep skills whose domain matches proposed_domain
   (if proposed_domain == "unknown", check all skills)
3. For each candidate skill C:
     token_overlap = |proposed_triggers ∩ C.triggers| / |proposed_triggers ∪ C.triggers|
     desc_overlap  = jaccard(tokenize(proposed_description), tokenize(C.description))
     similarity    = (0.6 × token_overlap) + (0.4 × desc_overlap)
4. Sort candidates by similarity DESC; take top 3
5. If max(similarity) ≥ 0.75 → return DEDUP_HIT with top matches
   Else                       → return DEDUP_CLEAR; proceed to Step 1
```

### HITL Gate at DEDUP_HIT

Present to user:
```
⚠️  Potential duplicate detected before scaffold generation:

  • SKL-042 "deployment-strategy"   (similarity: 0.82)
    Overlapping triggers: ["deploy", "CI/CD", "rollback"]
  • SKL-031 "ci-pipeline-generator" (similarity: 0.76)
    Overlapping triggers: ["generate pipeline", "CI config"]

Options:
  [A] Extend SKL-042 instead of creating a new skill
  [B] Proceed with new skill (dedup override will be recorded in origin_metadata)
  [C] Cancel
```

User MUST choose A, B, or C explicitly. No default. No timeout auto-selection.

- **Option A:** Halt. Redirect user to `skill-authoring` in `refactor` mode targeting the suggested skill.
- **Option B:** Set `dedup_override = true` in dedup result; proceed to Step 1 (scaffold generation).
- **Option C:** Halt. No state written. Session continues normally.

---

## §2 — Schema: dedup-check-result.schema.json

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "DedupCheckResult",
  "type": "object",
  "required": ["status", "timestamp"],
  "properties": {
    "status": {
      "type": "string",
      "enum": ["DEDUP_CLEAR", "DEDUP_HIT"]
    },
    "timestamp": {
      "type": "string",
      "format": "date-time"
    },
    "matches": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["skill_id", "similarity_score", "overlapping_triggers"],
        "properties": {
          "skill_id":             { "type": "string" },
          "similarity_score":     { "type": "number", "minimum": 0, "maximum": 1 },
          "overlapping_triggers": { "type": "array", "items": { "type": "string" } }
        }
      }
    },
    "override_approved":  { "type": "boolean", "default": false },
    "override_reason":    { "type": ["string", "null"] }
  }
}
```

---

## §3 — Updated skill-authoring Workflow (step numbering)

| Step | Name | Applies to modes |
|---|---|---|
| **0** | **Deduplication guard** (NEW) | `create`, `gap_seed` only |
| 1 | Parse author input | all create/gap_seed |
| 2 | Generate SKILL.md scaffold | all create/gap_seed |
| 3 | Validate against schema | all |
| 4 | Quality scoring | all |
| 5 | Register in registry.json + index.yaml | all |
| 6 | Run validate-skills.sh | all |

Step 0 is automatically **skipped** when `skill-authoring` is invoked in `refactor`, `split`, or `validate` mode.

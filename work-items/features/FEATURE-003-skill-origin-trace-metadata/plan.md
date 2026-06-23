# FEATURE-003 — Implementation Plan: Skill Origin Trace + Approval Tier Metadata

## Target Skills / Artifacts

| Skill / Artifact | Action | Notes |
|---|---|---|
| `skills/schema/registry-entry.schema.json` | Update | Add `origin_metadata` object |
| `skill-authoring/SKILL.md` | Update | Populate `origin_metadata` at Step 5 |
| `docs/governance.md` | Update | Add §5.1 approval tier definitions |

---

## §1 — Registry Entry Schema: origin_metadata

Add to `skills/schema/registry-entry.schema.json`. The field is **required for v5.1.0+ registrations** but `required: false` at the registry-root level to preserve backward compatibility with pre-v5.1.0 skill records.

```json
"origin_metadata": {
  "type": "object",
  "description": "Provenance and approval metadata. Required for all skills registered after v5.1.0.",
  "required": ["source", "approval_tier", "created_at"],
  "properties": {
    "source": {
      "type": "string",
      "enum": ["human", "gap-triggered", "migrated", "unknown"],
      "description": "How the skill was created"
    },
    "created_by_session": {
      "type": ["string", "null"],
      "description": "Session ID at time of creation, or null if not captured"
    },
    "approval_tier": {
      "type": "string",
      "enum": ["standard", "expedited", "legacy"],
      "description": "Governance tier under which this skill was approved"
    },
    "dedup_override": {
      "type": "boolean",
      "default": false,
      "description": "True if a deduplication check returned DEDUP_HIT and the author chose to proceed"
    },
    "dedup_override_reason": {
      "type": ["string", "null"],
      "default": null,
      "description": "Author's justification for proceeding despite a dedup hit"
    },
    "created_at": {
      "type": "string",
      "format": "date-time",
      "description": "UTC timestamp of skill registration"
    }
  }
}
```

**Validation rule for `validate-skills.sh`:**
- If a skill record lacks `origin_metadata` → emit `WARN: missing origin_metadata (pre-v5.1.0 skill, exempted)` — exit 0
- If a skill record has `origin_metadata` with an invalid shape → emit `ERROR` — exit 1

---

## §2 — skill-authoring: Populate origin_metadata at Step 5

At the registration step (Step 5 in the `create` / `gap_seed` workflow), `skill-authoring` MUST construct and write `origin_metadata` as follows:

| Field | Value |
|---|---|
| `source` | `"human"` (default for direct invocations); `"gap-triggered"` if `gap_context` is present in session state |
| `created_by_session` | Current `session_id` from session state (or `null` if not available) |
| `approval_tier` | `"standard"` for direct authoring; `"expedited"` if invoked from gap-to-skill pipeline (FEATURE-004); `"legacy"` never set by this step |
| `dedup_override` | `true` only if FEATURE-002 Step 0 returned `DEDUP_HIT` and user chose Option B |
| `dedup_override_reason` | The user's stated justification (free text from Option B prompt), or `null` |
| `created_at` | Current UTC timestamp in ISO-8601 |

---

## §3 — Governance §5.1: Skill Approval Tiers

Add to `docs/governance.md` under §5 (Adaptive Intelligence), as a new sub-section §5.1:

---

**§5.1 — Skill Approval Tiers**

All skills in the registry carry an `approval_tier` value that governs the minimum review process required at registration:

| Tier | When assigned | Minimum review requirements |
|---|---|---|
| `standard` | Human-authored skill created in a design session | Full quality-scoring (≥ 70/100) + explicit HITL sign-off |
| `expedited` | Gap-triggered skill produced by the gap-to-skill pipeline | quality-scoring auto-run (any pass score) + HITL sign-off (non-bypassable) |
| `legacy` | Any skill created before v5.1.0 (pre-FEATURE-003) | No retroactive review required; treated as approved |

All tiers require `scripts/validate-skills.sh` to exit 0.
HITL sign-off is **mandatory** for `standard` and `expedited` — it cannot be bypassed by any automation, pipeline, or configuration flag.

---

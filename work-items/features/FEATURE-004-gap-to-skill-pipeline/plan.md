# FEATURE-004 — Implementation Plan: Gap-to-Skill Reactive Pipeline

## Prerequisites (must be satisfied within this feature's DoD)

| Prerequisite | Source | Status |
|---|---|---|
| `gap_context` session state schema | FEATURE-001 §2 | must be complete |
| Deduplication guard (Step 0) in skill-authoring | FEATURE-002 | must be complete |
| `origin_metadata` population at Step 5 | FEATURE-003 | must be complete |
| `gap_seed` input mode in skill-authoring | **This feature — F004-T1** | implement here |

---

## Target Skills / Artifacts

| Skill / Artifact | Action | Notes |
|---|---|---|
| `skills/gap-to-skill-pipeline/SKILL.md` (SKL-065) | Create | New pipeline skill |
| `skill-authoring/SKILL.md` | Update | Add `gap_seed` operation |
| `skills/registry.json` | Update | Register SKL-065 with `status: draft` |
| `skills/pipelines/gap-to-skill.json` | Create | New pipeline template |

---

## §1 — gap-to-skill Pipeline: Full Workflow

```
TRIGGER: User invokes gap-to-skill pipeline
         (surfaced by orchestrator after gap detection, or user-initiated)

─── PRE-CHECKS ───────────────────────────────────────────────────────────────

IF session_state["gap_to_skill_active"] == true:
  → ERROR: "A gap-to-skill pipeline is already active in this session.
            Complete or cancel it first."
  → HALT

IF session_state["gap_context"] is null OR expired:
  → ERROR: "No active capability gap found in session state.
            Make a request the system cannot handle to log one."
  → HALT

SET session_state["gap_to_skill_active"] = true

─── STEP 1 — Restore Context ─────────────────────────────────────────────────

Load from gap_context:  gap_id, raw_prompt, detected_domain, timestamp
Display:
  "Restoring gap context:
   Domain:           <detected_domain>
   Original request: '<raw_prompt>'
   Gap ID:           <gap_id>"

─── STEP 2 — Generate Scaffold Seed ──────────────────────────────────────────

Derive scaffold seed from gap_context:
  suggested_name        = slugify(detected_domain) + "-handler"
  suggested_triggers    = top-5 keywords extracted from raw_prompt
  description_template  = "Handles requests in the <detected_domain> domain.
                           Triggered by: <suggested_triggers>"
  source                = "gap-triggered"

─── STEP 3 — Invoke skill-authoring (gap_seed mode) ──────────────────────────

Call skill-authoring with:
  operation  = gap_seed
  seed_input = { name, triggers, description, domain, source }

skill-authoring runs:
  Step 0 (dedup check against pre-populated triggers)
  Steps 1–4 with seed values pre-filled; user confirms or overrides each field

─── STEP 4 — Quality Scoring ─────────────────────────────────────────────────

Invoke quality-scoring on the draft SKILL.md output.
  score < 70  → surface feedback; allow up to 2 revision cycles (user edits + re-score)
  score ≥ 70  → proceed to HITL gate

─── STEP 5 — HITL Approval Gate (NON-BYPASSABLE) ─────────────────────────────

Present:
  "New skill ready for registration:
   Name:           <name>
   Domain:         <domain>
   Triggers:       <triggers>
   Quality Score:  <score>/100

   [APPROVE]  [REJECT]  [REVISE]"

User MUST choose one explicitly. No default. No timeout auto-approval.

─── STEP 6 — Registration (on APPROVE) ───────────────────────────────────────

Register skill in skills/registry.json:
  status                              = draft
  origin_metadata.source              = "gap-triggered"
  origin_metadata.approval_tier       = "expedited"
  origin_metadata.created_by_session  = current session_id

Run scripts/validate-skills.sh → must exit 0; if non-zero: surface error, HALT

Clear session_state["gap_context"]
Clear session_state["gap_to_skill_active"]

Write retry_context to session state (TTL: 3600 s):
  { retry_id, gap_id, raw_prompt, registered_skill_id, timestamp }

─── STEP 7 — Retry Prompt ────────────────────────────────────────────────────

Display:
  "Skill <ID> registered. You can retry your original request:
   '<raw_prompt>'"
(FEATURE-005 handles the actual retry execution)

─── ON REJECT ────────────────────────────────────────────────────────────────

Clear session_state["gap_to_skill_active"]
Keep session_state["gap_context"] (user may retry pipeline later)
Display: "Registration cancelled. Gap context preserved for future attempts."

─── ON ANY ERROR ─────────────────────────────────────────────────────────────

Clear session_state["gap_to_skill_active"]
Log error event to SKL-047 (behavioral-telemetry-collector)
Surface error message to user
```

---

## §2 — skill-authoring: gap_seed Invocation Mode

Add `gap_seed` to `skill-authoring/SKILL.md` as a fifth operation:

| Operation | Description |
|---|---|
| `create` | Author supplies all inputs from scratch |
| `refactor` | Modify an existing skill |
| `split` | Split one skill into two |
| `validate` | Validate without modifying |
| `gap_seed` **(NEW)** | Inputs are pre-populated from gap_context seed; author confirms or overrides each field |

In `gap_seed` operation:
- Steps 1–2 are pre-filled with seed values (name, triggers, description, domain)
- Author is shown each pre-filled value individually and asked "Confirm or edit:"
- Step 0 (dedup check) runs against the pre-populated triggers
- Steps 3–6 proceed identically to `create` mode

---

## §3 — Pipeline Template: gap-to-skill.json

```json
{
  "pipeline_id": "gap-to-skill",
  "version": "1.0.0",
  "description": "Reactive pipeline: converts a logged capability gap into a registered draft skill, with mandatory HITL approval.",
  "entry_skill": "gap-to-skill-pipeline",
  "skills": [
    { "id": "gap-to-skill-pipeline", "skill": "SKL-065", "required": true },
    { "id": "skill-authoring",       "skill": "SKL-005", "required": true },
    { "id": "quality-scoring",       "skill": "SKL-032", "required": true }
  ],
  "gates": [
    {
      "after_skill":  "quality-scoring",
      "type":         "HITL",
      "label":        "Skill Registration Approval",
      "options":      ["APPROVE", "REJECT", "REVISE"],
      "required":     true,
      "bypassable":   false
    }
  ],
  "recursion_guard": {
    "session_state_key":        "gap_to_skill_active",
    "max_concurrent_instances": 1
  }
}
```

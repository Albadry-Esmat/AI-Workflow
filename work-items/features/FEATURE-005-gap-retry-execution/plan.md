# FEATURE-005 — Implementation Plan: Gap Retry Execution

## Target Skills / Artifacts

| Skill / Artifact | Action | Notes |
|---|---|---|
| `orchestrator/SKILL.md` | Update | Add retry execution block |
| `skills/schema/system-state-schema.json` | Update | Add `retry_context` optional object |

---

## §1 — Orchestrator: Retry Execution Block

Add to `orchestrator/SKILL.md` immediately after the standard request routing section.

```
─── RETRY CHECK ──────────────────────────────────────────────────────────────
(Runs at the start of every user interaction when retry_context is present)

IF session_state["retry_context"] is present AND not expired:

  Display:
    "A retry is available for your previous request.
     Original request:   '<raw_prompt>'
     Skill registered:   <registered_skill_id>
     Retry now?          [YES]  [NO]  [LATER]"

  ── YES ───────────────────────────────────────────────────────────────────
  SET session_state["retry_in_progress"] = true

  Re-route raw_prompt through the standard orchestrator routing table.

  IF match found (confidence ≥ 0.5):
    Execute matched skill pipeline normally.
    Clear session_state["retry_context"]
    Clear session_state["retry_in_progress"]
    (Normal skill output displayed to user)

  ELSE (no match):
    Display:
      "The new skill (<registered_skill_id>) did not match this request.
       Consider refining its trigger patterns via skill-authoring (refactor mode)."
    DO NOT emit a capability_gap event
      ← recursion guard: retry_in_progress == true blocks gap emission
    Clear session_state["retry_context"]
    Clear session_state["retry_in_progress"]

  ── NO ────────────────────────────────────────────────────────────────────
  Clear session_state["retry_context"]
  Continue processing current user request normally.

  ── LATER ─────────────────────────────────────────────────────────────────
  Do NOT modify retry_context (TTL continues unchanged).
  Continue processing current user request normally.
```

### Recursion Guard

The orchestrator's gap detection block (FEATURE-001) MUST check `session_state["retry_in_progress"]` before emitting any `capability_gap` event. If `retry_in_progress == true`, gap emission is suppressed. This prevents the sequence:

```
retry → no match → capability_gap → gap-to-skill → retry → no match → ...
```

---

## §2 — System-State Schema: retry_context

Add to `skills/schema/system-state-schema.json` under `session_context.optional_fields`:

```json
"retry_context": {
  "type": "object",
  "required": false,
  "ttl_seconds": 3600,
  "properties": {
    "retry_id": {
      "type": "string",
      "format": "uuid"
    },
    "gap_id": {
      "type": "string",
      "format": "uuid",
      "description": "The original gap_id that triggered the skill creation"
    },
    "raw_prompt": {
      "type": "string",
      "maxLength": 1000
    },
    "registered_skill_id": {
      "type": "string",
      "description": "The ID of the skill just registered to address this gap"
    },
    "timestamp": {
      "type": "string",
      "format": "date-time"
    }
  }
}
```

---

## §3 — End-to-End Reactive Loop

With FEATURE-001 + FEATURE-004 + FEATURE-005, the full closed loop is:

```
User request
    │
    ▼
Orchestrator routing ── no match ──► capability_gap logged          [F001]
                                          │
                                          ▼
                                   gap-to-skill pipeline             [F004]
                                          │
                                    HITL approval
                                          │
                                   skill registered
                                          │
                                   retry_context written
                                          │
                                          ▼
                                   Retry prompt shown                [F005]
                                          │
                                       YES
                                          │
                                          ▼
                               Orchestrator re-routes raw_prompt
                                          │
                               new skill matches ──► pipeline runs ✓
```

**Two recursion guards** close every potential infinite loop:
1. `gap_to_skill_active` (FEATURE-004) — prevents nested gap-to-skill invocations
2. `retry_in_progress` (FEATURE-005) — prevents a failed retry from emitting another gap event

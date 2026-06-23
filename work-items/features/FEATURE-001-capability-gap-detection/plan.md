# FEATURE-001 — Implementation Plan: Capability Gap Detection + Telemetry

## Target Skills / Artifacts

| Skill / Artifact | Action | Notes |
|---|---|---|
| `orchestrator/SKILL.md` | Update | Add gap detection block after routing dead-end |
| `behavioral-telemetry-collector/SKILL.md` (SKL-047) | Extend | Extend existing skill — add `capability_gap` event type |
| `session-insights/SKILL.md` (SKL-048) | Extend | Extend existing skill — add gap metrics output |
| `skills/schema/system-state-schema.json` | Update | Add `gap_context` optional object |
| `skills/registry.json` | Update | Register SKL-047 and SKL-048 |

---

## §1 — Orchestrator: Gap Detection Block

After the routing table fails to produce a match above the confidence threshold (< 0.5), the orchestrator MUST:

1. **Classify** the failure as a `capability_gap` event (not a generic routing error)
2. **Extract** intent domain from the raw prompt (free-text classification: one of `testing`, `security`, `deployment`, `architecture`, `data`, `frontend`, `mobile`, `embedded`, `skill-management`, `unknown`)
3. **Emit** a `capability_gap` event to SKL-047 (behavioral-telemetry-collector) with payload:
   ```json
   {
     "event_type": "capability_gap",
     "timestamp": "<ISO-8601>",
     "session_id": "<session_id>",
     "raw_prompt": "<truncated to 200 chars>",
     "detected_domain": "<domain>",
     "confidence_score": 0.0,
     "matched_triggers": []
   }
   ```
4. **Write** `gap_context` to session state (TTL: 3600 seconds):
   ```json
   {
     "gap_id": "<uuid>",
     "raw_prompt": "<original prompt>",
     "detected_domain": "<domain>",
     "timestamp": "<ISO-8601>"
   }
   ```
5. **Return** user message:
   > "No skill is available for this request. The capability gap has been logged (domain: `<domain>`). You can create a new skill to handle it using the gap-to-skill workflow."

### Recursion Guard

The orchestrator MUST NOT emit a `capability_gap` event if `session_state["gap_to_skill_active"] == true`.
Check this key before emitting. If the guard fires, surface:
> "Cannot log a gap from within the gap-to-skill pipeline."

---

## §2 — System-State Schema: `gap_context`

Add to `skills/schema/system-state-schema.json` under `session_context.optional_fields`:

```json
"gap_context": {
  "type": "object",
  "required": false,
  "ttl_seconds": 3600,
  "properties": {
    "gap_id":          { "type": "string", "format": "uuid" },
    "raw_prompt":      { "type": "string", "maxLength": 1000 },
    "detected_domain": { "type": "string" },
    "timestamp":       { "type": "string", "format": "date-time" }
  }
}
```

---

## §3 — SKL-047: behavioral-telemetry-collector

**Purpose:** Collect and persist structured telemetry events emitted by the orchestrator and skills.

**Input schema:**
```json
{
  "event_type": "string (enum: capability_gap | skill_error | pipeline_timeout | ...)",
  "session_id": "string",
  "timestamp":  "string (ISO-8601)",
  "payload":    "object"
}
```

**Output:** Append event to `telemetry/events.jsonl` (one JSON object per line). Create file if absent.

**Deduplication:** Events with identical `(session_id, event_type, timestamp)` are silently dropped.

---

## §4 — SKL-048: session-insights

**Purpose:** Produce end-of-session summary including gap metrics.

**Triggered by:** Orchestrator at session close, or on-demand ("show session summary").

**Output includes:**
- Total capability gaps in session
- Top 3 domains by gap count
- List of `gap_id` values (for re-execution once a skill is created)
- Skill execution success/failure breakdown

**Source:** Reads current session events from `telemetry/events.jsonl` filtered by `session_id`.

---

## §5 — Registry Entries

SKL-047 and SKL-048 registry entries must be updated in `skills/registry.json` to add:
- `phase: 6`
- `req_id: N16`

(Both skills already exist in the registry; no new registration is required.)

`scripts/validate-skills.sh` must pass (exit 0) after the update.

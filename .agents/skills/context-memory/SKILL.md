---
name: context-memory
version: 2.0.0
domain: system
description: 'Use when managing session state, persisting context between turns, or preventing state bleed across executions in multi-turn skill orchestration. Triggers on: "remember this", "persist context", "restore session", "state management", "multi-turn", "cross-session memory", "archival memory", "project memory".'
author: system
---

## Purpose

The Context Memory skill manages the full lifecycle of pipeline execution state across three
memory tiers. It serializes, preserves, and restores context across skill invocations —
enabling multi-turn orchestration, resumable pipelines, and cross-session memory for
iterative development.

**v2.0.0** introduces three-tier memory (Working / Session / Archival), inspired by the
Letta (MemGPT) tiered memory architecture. Archival memory is cross-session and
project-scoped — enabling iterative pipeline runs to skip phases whose outputs are already
approved and stored.

### Memory Tiers

```
Tier 1: Working Memory      (in-flight, session-scoped, not persisted)
  ├─ Pipeline artifacts currently in flight
  ├─ Current HITL gate state
  └─ Active skill invocation context

Tier 2: Session Memory      (session-scoped, persisted until explicit clear)
  ├─ Architecture decisions
  ├─ ADR index
  ├─ Dependency graph (module-level)
  └─ req_task_map from last feature-planning run

Tier 3: Archival Memory     (cross-session, project-scoped, persistent)
  ├─ Approved architecture decisions (post architecture HITL gate)
  ├─ Accepted ADRs
  ├─ Module boundaries + responsibility map
  └─ Approved task graph (milestones, phases)
```

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `operation` | `string` | Yes | Memory operation: `"read"`, `"write"`, `"inherit"`, or `"clear_tier"`. |
| `tier` | `string` | Yes | Memory tier to operate on: `"working"`, `"session"`, or `"archival"`. |
| `project_id` | `string` | Yes | Project scope identifier (e.g. `"proj-001"`). Archival memory is strictly scoped to this ID. |
| `session_id` | `string` | Yes for read/write/inherit | Session identifier. Used to locate the session file at `.opencode/state/sessions/<session_id>.json`. |
| `memory_blocks` | `object` | Yes for `write` | Key-value map of memory blocks to persist. Values must be JSON-serializable. |
| `block_keys` | `array[string]` | No | For `read` operations: specific block keys to load. Default: all blocks in the requested tier. |
| `inherit_from` | `string` | Yes for `inherit` | Session ID to inherit Tier 3 archival blocks from. Must resolve to the same `project_id`. |
| `clear_tier_scope` | `string` | Yes for `clear_tier` | Scope to clear: `"session"` (Tier 2 only) or `"archival"` (Tier 3 only). Tier 1 (working) is always ephemeral and cannot be explicitly cleared. |
| `content_hash_check` | `boolean` | No | Default `true`. If `true`, validate each Tier 3 block's `content_hash` against current artifacts before returning. Invalidate and exclude stale blocks. |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["operation", "tier", "project_id"],
  "properties": {
    "operation": {
      "type": "string",
      "enum": ["read", "write", "inherit", "clear_tier"]
    },
    "tier": {
      "type": "string",
      "enum": ["working", "session", "archival"]
    },
    "project_id": { "type": "string" },
    "session_id": { "type": "string" },
    "memory_blocks": {
      "type": "object",
      "description": "Key-value map of blocks to write. Required for operation=write."
    },
    "block_keys": {
      "type": "array",
      "items": { "type": "string" }
    },
    "inherit_from": {
      "type": "string",
      "description": "Session ID to inherit Tier 3 blocks from. Required for operation=inherit."
    },
    "clear_tier_scope": {
      "type": "string",
      "enum": ["session", "archival"],
      "description": "Required for operation=clear_tier."
    },
    "content_hash_check": { "type": "boolean", "default": true }
  },
  "allOf": [
    {
      "if": { "properties": { "operation": { "const": "write" } }, "required": ["operation"] },
      "then": { "required": ["session_id", "memory_blocks"] }
    },
    {
      "if": { "properties": { "operation": { "const": "read" } }, "required": ["operation"] },
      "then": { "required": ["session_id"] }
    },
    {
      "if": { "properties": { "operation": { "const": "inherit" } }, "required": ["operation"] },
      "then": { "required": ["session_id", "inherit_from"] }
    },
    {
      "if": { "properties": { "operation": { "const": "clear_tier" } }, "required": ["operation"] },
      "then": { "required": ["clear_tier_scope"] }
    }
  ]
}
```

## Required Context

- `.opencode/state/sessions/<session_id>.json` — session file for read/write/inherit operations.
- `.opencode/state/archival/<project_id>/` — archival memory directory for Tier 3 operations.
- `last_session.txt` — used to resolve session_id when not explicitly provided.

## Execution Logic

```
Step 1 — Validate inputs
  Verify operation, tier, project_id are present.
  Verify required fields per operation (see Input Schema allOf conditionals).
  If tier=working AND operation=clear_tier: reject — Tier 1 is ephemeral, cannot be cleared.
  If tier=working AND operation=inherit: reject — inheritance applies to Tier 3 only.
  Output: validated inputs

Step 2 — Resolve storage paths
  Tier 1 (working): in-memory only; no file path.
  Tier 2 (session):
    path = .opencode/state/sessions/<session_id>.json
    key namespace: session_memory.<block_key>
  Tier 3 (archival):
    base_path = .opencode/state/archival/<project_id>/
    known archival blocks:
      architecture.json     ← approved architecture output + content_hash
      adr_index.json        ← accepted ADRs
      module_map.json       ← module boundaries + responsibility map
      task_graph.json       ← approved task graph (milestones, phases)
  Create directories if absent.
  Output: resolved paths

Step 3 — Execute operation

  ── read ─────────────────────────────────────────────────────────────────────
  Tier 1: Read from session_context.working_memory in orchestrator memory.
  Tier 2: Load session file; extract session_memory keys from block_keys (or all if not specified).
  Tier 3: For each requested archival block file:
    Read JSON file.
    IF content_hash_check=true:
      Compute SHA-256 of current artifact payload.
      Compare against stored block.content_hash.
      IF mismatch: mark block as stale=true; exclude from returned blocks; emit `info` feedback.
    Return non-stale blocks.
  Output: memory_blocks (loaded), stale_blocks[] (invalidated)

  ── write ─────────────────────────────────────────────────────────────────────
  Tier 1: Write to session_context.working_memory (in-memory only; not persisted).
  Tier 2: Load session file; merge memory_blocks into session_memory; write file back.
  Tier 3: For each key in memory_blocks:
    Compute content_hash = SHA-256(JSON.stringify(memory_blocks[key].payload))
    Write to archival/<project_id>/<key>.json:
      { "block_key": key, "project_id": project_id, "written_at": ISO8601,
        "content_hash": content_hash, "payload": memory_blocks[key] }
    If file already exists and content_hash is identical: skip (idempotent).
  Output: blocks_written[], blocks_skipped[]

  ── inherit ───────────────────────────────────────────────────────────────────
  Resolve inherit_from session file.
  Load Tier 3 blocks from archival/<project_id>/ (not from session file — archival is
  project-scoped, not session-scoped).
  Validate project_id isolation: confirm all archival blocks belong to the same project_id.
    IF mismatch: reject with {"error": "PROJECT_ID_MISMATCH"}.
  Apply content_hash_check if enabled (same logic as read).
  Copy valid archival blocks into current session_context.session_memory.
  Output: inherited_blocks[], stale_blocks[]

  ── clear_tier ────────────────────────────────────────────────────────────────
  clear_tier_scope=session:
    Load session file; delete all keys under session_memory namespace; write file back.
    Emit `info` feedback: "Session memory cleared for session <session_id>."
  clear_tier_scope=archival:
    Delete all files under archival/<project_id>/.
    Emit `warning` feedback: "Archival memory cleared for project <project_id>. All cached
    phase skips will be invalidated on next pipeline run."
  Output: cleared_tier, items_cleared count

Step 4 — Update last_session.txt
  On any write or inherit operation that modifies session state: update last_session.txt.
  Output: updated

Step 5 — Assemble output
  Build output per output schema.
  Output: context_memory_result
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `operation` | `string` | Echo of the operation performed |
| `tier` | `string` | Echo of the tier operated on |
| `memory_blocks` | `object` \| `null` | Loaded blocks (read/inherit operations). `null` for write/clear_tier. |
| `stale_blocks` | `array[string]` | Block keys that failed content_hash validation (excluded from result) |
| `blocks_written` | `array[string]` \| `null` | Block keys written (write operation). `null` for other operations. |
| `blocks_skipped` | `array[string]` \| `null` | Block keys skipped (idempotent write — hash identical). `null` for non-write. |
| `cleared_tier` | `string` \| `null` | Tier cleared (clear_tier operation). `null` for other operations. |
| `items_cleared` | `integer` \| `null` | Count of items removed (clear_tier). `null` for other operations. |
| `metrics` | `object` | Execution metrics |
| `feedback` | `array[object]` | Info/warning feedback entries |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["operation", "tier", "memory_blocks", "stale_blocks", "blocks_written", "blocks_skipped", "cleared_tier", "items_cleared", "metrics", "feedback"],
  "properties": {
    "operation":      { "type": "string" },
    "tier":           { "type": "string" },
    "memory_blocks":  { "type": ["object", "null"] },
    "stale_blocks":   { "type": "array", "items": { "type": "string" } },
    "blocks_written": { "type": ["array", "null"], "items": { "type": "string" } },
    "blocks_skipped": { "type": ["array", "null"], "items": { "type": "string" } },
    "cleared_tier":   { "type": ["string", "null"] },
    "items_cleared":  { "type": ["integer", "null"] },
    "metrics": {
      "type": "object",
      "required": ["tokens_in", "tokens_out", "duration_ms", "version"],
      "properties": {
        "tokens_in":   { "type": "integer" },
        "tokens_out":  { "type": "integer" },
        "duration_ms": { "type": "integer" },
        "version":     { "type": "string" }
      }
    },
    "feedback": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["type", "from_skill", "reason"],
        "properties": {
          "type":       { "type": "string", "enum": ["info", "warning"] },
          "from_skill": { "type": "string" },
          "reason":     { "type": "string" }
        }
      }
    }
  }
}
```

## Human-in-the-Loop Gates

No HITL gates. context-memory is a system-level utility skill that runs automatically as
part of pipeline execution. All destructive operations (clear_tier=archival) should be
triggered only by the orchestrator under known pipeline conditions.

## Rules & Constraints

- **Project isolation:** Archival memory MUST be strictly scoped to `project_id`. Cross-project
  reads are not permitted. The skill MUST reject any `inherit_from` that resolves to a different
  `project_id` with `{"error": "PROJECT_ID_MISMATCH"}`.
- **Tier 1 immutability:** Working memory (Tier 1) is ephemeral and in-memory only. It CANNOT be
  persisted, cleared via `clear_tier`, or inherited.
- **Content hash validation:** All Tier 3 reads default to `content_hash_check=true`. Stale blocks
  (hash mismatch) are excluded from output and flagged in `stale_blocks[]`. The orchestrator
  re-runs the producing phase when stale blocks are detected.
- **Credentials exclusion:** No credentials, tokens, secrets, or PII may appear in any memory block
  at any tier. The skill MUST strip known secret patterns before writing.
- **Idempotent writes:** Tier 3 writes where `content_hash` is identical to the stored hash are
  skipped (no file write). This prevents unnecessary I/O and timestamp churn.
- **Max archival blocks per project:** 50 blocks. LRU eviction on the 51st write. Emit warning.
- **v1.0.0 backward compatibility:** `operation=write, tier=working` with flat `memory_blocks`
  maps to Tier 1 write — identical to v1.0.0 behavior. All existing callers work without modification.
- **Orchestrator is sole writer:** Only the orchestrator invokes context-memory write/clear
  operations. Skills MUST NOT write directly to any memory tier.

## Security Considerations

- Archival memory files are stored at `.opencode/state/archival/<project_id>/` — these files may
  contain architectural decisions and module maps. They MUST NOT contain API keys, credentials,
  personal data, or infrastructure access details.
- The skill MUST scan `memory_blocks` values for known secret patterns before writing (regex match
  against Bearer token, `sk-*`, `ghp_*`, API key patterns). If found: reject with
  `{"error": "SECRET_DETECTED_IN_MEMORY_BLOCK"}`.
- Session files older than 30 days SHOULD be archived or deleted. Archival blocks have no TTL
  (they persist until explicitly cleared) — but they MUST be re-validated via `content_hash_check`
  on each read.
- `.opencode/state/` directory SHOULD be gitignored to prevent accidental commit of session state.

## Token Optimization

- For `operation=read`, use `block_keys[]` to load only the blocks needed by the consuming skill.
  Avoid loading all archival blocks when only `architecture` is needed.
- Tier 3 blocks are stored as separate files — load individual files, not the entire archival
  directory.
- On pipeline start, the orchestrator loads archival blocks once and caches them in
  `session_context` — subsequent skill reads use the in-memory cache, not disk.

## Quality Checklist

- [ ] `project_id` isolation enforced for all Tier 3 operations
- [ ] `content_hash` computed and stored on every Tier 3 write
- [ ] Stale blocks excluded from read output and listed in `stale_blocks[]`
- [ ] Tier 1 clear_tier rejected with clear error
- [ ] Cross-project `inherit_from` rejected with `PROJECT_ID_MISMATCH`
- [ ] Secret patterns scanned before write; rejected if found
- [ ] Idempotent Tier 3 write (identical hash → skip, not error)
- [ ] v1.0.0 shim: `operation=write, tier=working` works without modification
- [ ] `last_session.txt` updated on write/inherit
- [ ] No credentials in any memory block at any tier

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| Session file not found | Return empty `memory_blocks: {}`, emit `info` feedback: "Session file not found — starting fresh". |
| Archival block file not found | Skip block, list in `stale_blocks[]`, emit `info` feedback. |
| `content_hash` mismatch (stale block) | Exclude block, list in `stale_blocks[]`, emit `info` feedback. Orchestrator re-runs producing phase. |
| `inherit_from` resolves to different `project_id` | Reject with `{"error": "PROJECT_ID_MISMATCH"}`. No inheritance occurs. |
| Secret pattern detected in `memory_blocks` | Reject with `{"error": "SECRET_DETECTED_IN_MEMORY_BLOCK", "field": "<key>"}`. No write occurs. |
| `.opencode/state/` directory absent | Create directory and subdirectories before first write. |
| Archival block limit exceeded (>50 blocks) | LRU-evict oldest block, emit `warning` feedback, write new block. |
| `operation=clear_tier, clear_tier_scope=archival` | Irreversible. Emit `warning` feedback with confirmation message. No undo available. |

## 13. Skill Composition

```yaml
composes:
  - skill: state-manager
    version: "^1.1.0"
    role: state_read_write
    scopes: ["sessions", "archival", "last_session"]
    note: "context-memory uses state-manager for session file I/O."

pipeline_entry:
  - invoked_by: orchestrator
    on: pipeline_start (load archival blocks if project_id provided)
  - invoked_by: orchestrator
    on: architecture HITL gate approved (write Tier 3 architecture block)
  - invoked_by: orchestrator
    on: feature-planning HITL gate approved (write Tier 3 task_graph block)
  - direct_invocation: true (can be called standalone for state management)
```

## Session Context Schema (Protocol Reference)

> This section documents the full `session_context` schema used by the orchestrator and
> context-memory for compatibility reference. The source of truth is `docs/context-engineering.md`.

### Compression Rules

| Artifact Type | Retention Policy |
|--------------|------------------|
| Skill full output | Keep last 3; older compress to ID + status + metrics |
| Raw input | Discard after first skill completes |
| Intermediate artifacts | Discard after downstream consumer completes |
| Feedback entries | Keep all (low volume, critical for traceability) |
| Execution log | Keep last 20 entries; summarize older entries |
| Gate decisions | Keep all (audit trail) |

### Cross-Skill Context Passing

Skills receive context through two channels:

1. **Explicit inputs** (declared in the skill's input schema) — primary channel.
2. **Session context** (available via `session_context.artifacts`) — read-only reference.

Skills MUST NOT write directly to `session_context`. Only the orchestrator mutates it.

### Token Budget Per Session

| `token_budget.tier` | Session Type | Max Total Tokens (in + out) |
|--------------------|--------------|---------------------------|
| `quick` | 1–2 skills, single feedback loop | 32K |
| `partial_pipeline` | 3–5 skills | 64K |
| `deep` | 6+ skills, multiple feedback loops | 128K |
| `full_pipeline` | All pipeline phases, multi-team feedback | 256K |

> **Note:** The `standard` tier does not exist in the schema. Any session using `standard`
> MUST be migrated to `partial_pipeline`.

# Phase 6 — v2.3.0: Persistent State & External Integration

**Version target:** v2.3.0
**Story points:** 31
**Tasks:** TASK-0059 – TASK-0062
**Category:** Cross-session memory + external trigger integration + pipeline durability
**Depends on:** Phase 5 complete (v2.2.0)

---

## Goals

Phase 6 delivers the four capabilities that make the pipeline *persistent* and *externally
connected*: cross-session memory so iterative development reuses prior work, a standardized
artifact envelope that makes inter-skill data transfers measurable and prunable, a webhook
trigger so Jira events can automatically initiate sync pipelines, and named snapshots that
serve as safe restore points at every HITL boundary.

These four capabilities are the prerequisite infrastructure that Phase 7's advanced features
(durable jobs, warm-start from snapshot, token observability) are built on.

**Expected outcome:** Iterative pipeline runs on an existing codebase consume 50–70% fewer
tokens (prior phases reloaded from memory). Jira workflow changes auto-trigger sync without
manual invocation.

---

## Tasks

| ID | Title | SP | Status |
|----|-------|----|--------|
| TASK-0060 | Standardize inter-skill artifact envelope schema | 5 | pending |
| TASK-0062 | Pipeline snapshot API — named snapshots at HITL gate boundaries | 5 | pending |
| TASK-0061 | `work-item-exporter` v2.1.0 — webhook trigger mode | 8 | pending |
| TASK-0059 | `context-memory` v2.0.0 — cross-session archival memory blocks | 13 | pending |

---

## Task Details

### TASK-0060 — Standardize inter-skill artifact envelope schema (5 SP)

**Problem:** Skills currently pass raw JSON objects to each other with no metadata wrapper.
This makes it impossible to:
- Count tokens per artifact at transfer time (token observability — Phase 7 TASK-0066 needs this)
- Apply selective pruning rules based on artifact type
- Build an audit trail of which skill produced which data and when

**Inspired by:** AgentScope's `Msg` schema — a lightweight typed envelope.

**Proposed `Artifact` envelope:**
```json
{
  "artifact_id":    "art-0042",
  "source_skill":   "architecture-design",
  "target_skill":   "feature-planning",
  "content_type":   "architecture_output",
  "payload":        { ... },
  "created_at":     "2026-07-02T10:30:00Z",
  "token_count":    1840,
  "compressed":     false,
  "schema_version": "1.0.0"
}
```

**Change to `orchestrator` SKILL.md:**
- All inter-skill data transfers use `Artifact` wrapper (payload contains the pruned output
  from Phase 4's TASK-0051)
- Orchestrator writes `token_count` before dispatch (measured, not estimated)
- Session `event_log` records every artifact dispatch with `artifact_id`, source, target,
  `token_count` — enabling exact token-per-transfer accounting

**Change to `context-engineering.md`:**
- Add "Artifact Envelope" section documenting schema and lifecycle

**Files:** `.opencode/skills/orchestrator/SKILL.md`, `docs/context-engineering.md`
**Validation:** Full pipeline run; verify each inter-skill transfer has `artifact_id` in event_log

---

### TASK-0062 — Pipeline snapshot API (5 SP)

**Problem:** Phase 5's TASK-0056 adds `resume_from_phase` — but resuming requires that the
state from prior phases is still in memory. If the session restarts (new conversation turn,
process restart), the prior state is lost. A named snapshot API persists state to a durable
location keyed by (session_id, phase_id) so resume can work across conversation boundaries.

**Change to `orchestrator` SKILL.md:**

Add "Take snapshot" step — executed automatically after each HITL gate passes:
```json
{
  "snapshot_id":    "snap-phase-4-planning-approved",
  "session_id":     "sess-001",
  "phase_id":       "phase-4-planning",
  "gate_decision":  "approve",
  "taken_at":       "2026-07-02T10:30:00Z",
  "state_keys":     ["requirements", "architecture", "dependency_graph", "task_graph"],
  "artifact_ids":   ["art-0001", "art-0002", "art-0003", "art-0004"]
}
```

Snapshots are stored in `session_context.snapshots[]` (already in the schema from
`context-engineering.md`) with the full artifact payloads — not just references.

**Add `restore_from_snapshot` to orchestrator inputs:**
```json
{ "restore_from_snapshot": "snap-phase-4-planning-approved" }
```
Restores all state keys and artifacts from the snapshot, then continues from the phase
immediately after the snapshot's `phase_id`.

**Relationship to TASK-0056:** TASK-0056 resumes from in-memory state; TASK-0062 persists
state to snapshots so resume works across session boundaries. Phase 7's TASK-0065 is the
user-facing "warm-start from snapshot" capability that unifies both.

**Files:** `.opencode/skills/orchestrator/SKILL.md`, `docs/context-engineering.md`
**Validation:** Take snapshot after phase-4-planning → start new session → restore → continue from phase-5-impact; verify prior phase outputs are present

---

### TASK-0061 — `work-item-exporter` v2.1.0 — webhook trigger mode (8 SP)

**Problem:** The `mode=sync` capability from Phase 3 (TASK-0047) must currently be manually
invoked. A Jira workflow change (issue moved from "In Progress" to "Done") should
automatically trigger a sync pipeline to update local work-item state — without requiring
the user to remember to run the sync.

**Inspired by:** n8n Jira webhook node integration.

**New `mode=webhook` for `work-item-exporter`:**

```
Inputs (additional for webhook mode):
  mode:             "webhook"
  webhook_config:   {
    source:         "jira" | "github" | "linear",
    event_filter:   ["issue_status_changed", "issue_created", "issue_deleted"],
    secret_env_var: "JIRA_WEBHOOK_SECRET"   ← env var name, never the value
  }
  payload:          (raw webhook event payload from Jira)
```

**Execution Logic additions (Steps 13–16):**
```
Step 13 — Validate webhook signature
  Read HMAC secret from env_var declared in webhook_config.secret_env_var.
  Verify X-Hub-Signature-256 header against payload.
  Reject unsigned or invalid requests with {"error": "INVALID_WEBHOOK_SIGNATURE"}.

Step 14 — Parse event
  Extract: event_type, issue_id, from_status, to_status, timestamp.
  Apply event_filter: ignore events not in webhook_config.event_filter.

Step 15 — Map to sync operation
  event_type=issue_status_changed → trigger mode=sync for the affected issue_id.
  event_type=issue_created        → trigger mode=export if local work item exists.
  event_type=issue_deleted        → flag in local state; do NOT auto-delete local item.
                                    Emit warning; require HITL approval for deletion.

Step 16 — Invoke sync pipeline
  Dispatch internal mode=sync invocation with issue_id as scope filter.
  Return: {webhook_accepted: true, sync_triggered: true, scope: issue_id}
```

**Security rules:**
- Webhook secret MUST be an env var reference — never a literal value in payload or config
- Deletion events MUST NOT auto-delete local work items — HITL gate required
- Rate limit: max 10 webhook invocations per minute; excess → queue with backpressure warning

**Version bump:** `work-item-exporter` `2.0.0 → 2.1.0` (MINOR: new optional `mode=webhook`)
**Files:** `.opencode/skills/work-item-exporter/SKILL.md`, `skills/index.yaml`
**Validation:** POST mock Jira webhook payload → verify sync triggered; invalid signature → verify rejection

---

### TASK-0059 — `context-memory` v2.0.0 — cross-session archival memory (13 SP)

**Problem:** `context-memory` v1.0.0 is session-scoped only. When a new pipeline run starts
for the same project (e.g., adding a feature to an existing system), the orchestrator starts
fresh — re-running requirement-analysis, architecture-design, and dependency-graph phases
even though their outputs haven't changed. This is the single largest token waste in iterative
development workflows.

**Inspired by:** Letta (MemGPT) tiered memory architecture.

**New memory model for `context-memory` v2.0.0:**

Three memory tiers:
```
Tier 1: Working Memory (current, session-scoped — unchanged from v1.0.0)
  → Pipeline artifacts in flight
  → Current HITL gate state
  → Active skill invocation context

Tier 2: Session Memory (session-scoped, persisted until explicit clear)
  → Architecture decisions
  → ADR index
  → Dependency graph (module-level, not code-level)
  → req_task_map from last feature-planning run

Tier 3: Archival Memory (cross-session, project-scoped, persistent)
  → Approved architecture decisions (post-HITL gate: "Sign off architecture")
  → Accepted ADRs
  → Module boundaries + responsibility map
  → Approved task graph (milestones, phases)
```

**New inputs for `context-memory` v2.0.0:**
```json
{
  "operation":         "read" | "write" | "inherit" | "clear_tier",
  "tier":              "working" | "session" | "archival",
  "project_id":        "proj-001",            ← scope isolation
  "memory_blocks":     { ... },               ← for write
  "inherit_from":      "sess-001",            ← for inherit operation
  "clear_tier_scope":  "session" | "archival" ← for clear_tier
}
```

**Orchestrator integration:**
- On pipeline start: if `archival_memory` exists for `project_id`, load Tier 3 blocks and
  pre-populate session state with them — skipping phases whose outputs are already in archival
- On architecture HITL gate approval: write architecture output to Tier 3 archival memory
- On feature-planning HITL gate approval: write approved task_graph to Tier 3

**Expected token savings:**
- First run: all phases execute normally (no savings)
- Second run (new feature, same architecture): phases 1-4 skipped via archival → save ~40,000 tokens
- Third+ runs: savings compound as more archival blocks accumulate

**Isolation guarantee:**
- Archival memory MUST be scoped to `project_id`
- Cross-project reads are not permitted — the skill rejects any `inherit_from` that resolves
  to a different `project_id`

**Version bump:** `context-memory` `1.0.0 → 2.0.0` (MAJOR: new tier model, new input schema)
**Files:** `.opencode/skills/context-memory/SKILL.md`, `docs/context-engineering.md`
**Validation:** Run pipeline on project A → approve architecture → start new pipeline on same project → verify architecture phase is skipped

---

## Dependency Graph

```
Phase 5 (v2.2.0) must be complete before Phase 6 begins.

TASK-0060 ──────────────────► Phase 7: TASK-0066 (token observability uses artifact token_count)
(artifact envelope)

TASK-0062 ──────────────────► Phase 7: TASK-0065 (warm-start from snapshot)
(snapshot API)

TASK-0058 (Phase 5) ─────────► TASK-0062 (async tasks should be snapshotted too)

TASK-0059  (standalone in Phase 6 — context-memory only)
TASK-0061  (standalone in Phase 6 — work-item-exporter only)

Intra-phase order:
  1. TASK-0060 (artifact envelope — TASK-0059 writes Artifacts to archival memory)
  2. TASK-0062 (snapshot API — uses Artifact envelope for artifact_ids[])
  3. TASK-0061 (webhook — independent; can ship in parallel with 0059/0062)
  4. TASK-0059 (largest — start early; parallel with TASK-0061)
```

---

## Risks

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Cross-session memory loads stale architecture after codebase diverges | High | Archival blocks carry `content_hash` of the source artifacts; orchestrator invalidates if hash changes |
| Webhook mode `issue_deleted` auto-deletes local work items via side-effect | Critical | Step 15 explicitly prohibits auto-deletion; deletion events flag-only; HITL gate mandatory before any local delete |
| Webhook secret stored in state or logs accidentally | Critical | `secret_env_var` field stores the env var NAME only; the actual value is never read into the skill's context |
| `context-memory` v2.0.0 MAJOR bump breaks callers using v1.0.0 API | Medium | Add backward-compat shim: `operation=write, tier=working` is equivalent to v1.0.0 behavior; all existing callers work without modification |
| Snapshot storage grows unbounded across many sessions | Low | Keep max 10 snapshots per project; LRU eviction on the 11th; emit warning when eviction occurs |

---

## Delivery Checklist

- [ ] `scripts/validate-skills.sh` passes (0 failures)
- [ ] `context-memory` SKILL.md version `2.0.0`, `skills/index.yaml` synced
- [ ] `work-item-exporter` SKILL.md version `2.1.0`, `skills/index.yaml` synced
- [ ] `orchestrator` SKILL.md version `1.6.0` with artifact envelope + snapshot steps
- [ ] `docs/context-engineering.md` updated: Artifact Envelope + cross-session memory sections
- [ ] Webhook secret NEVER appears in any SKILL.md example or test fixture
- [ ] Integration test: cross-session archival memory skips architecture phase on second run
- [ ] Integration test: webhook with valid signature triggers sync; invalid signature rejected
- [ ] Integration test: snapshot taken at HITL gate → new session → restore → continue
- [ ] `docs/changelog.md` updated with v2.3.0 entry

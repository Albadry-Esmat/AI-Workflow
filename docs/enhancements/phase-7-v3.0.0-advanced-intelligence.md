# Phase 7 — v3.0.0: Advanced Intelligence & Durability

**Version target:** v3.0.0
**Story points:** 42
**Tasks:** TASK-0063 – TASK-0066
**Category:** Multi-agent patterns + durable execution + token observability
**Depends on:** Phase 6 complete (v2.3.0)

---

## Goals

Phase 7 completes the roadmap with four high-investment, high-value capabilities:
adversarial architecture validation through multi-agent debate, durable background job
execution for async skills, true warm-start from any HITL gate snapshot, and a full
token efficiency observability loop that closes the feedback cycle from "measure" to
"propose improvement" to "apply with HITL approval."

Together, these four capabilities represent the shift from a *deterministic pipeline* to
an *intelligent, self-optimizing workflow* — one that produces higher quality outputs
(debate), runs reliably regardless of session interruptions (durable jobs), never repeats
work unnecessarily (warm-start), and continuously improves its own token efficiency
(observability → adaptive proposals).

**Expected outcome:** v3.0.0 marks the system's maturity milestone — a fully self-observable,
resumable, debate-validated pipeline with reliable async execution.

---

## Tasks

| ID | Title | SP | Status |
|----|-------|----|--------|
| TASK-0066 | Token efficiency observability — per-skill telemetry, trends, adaptive proposals | 8 | complete |
| TASK-0065 | Pipeline warm-start from HITL gate snapshot (cross-session resume) | 8 | complete |
| TASK-0063 | New skill: `multi-agent-debate` — architect + reviewer debate loop | 13 | complete |
| TASK-0064 | Durable async skill execution — job queue with retry, status, callbacks | 13 | complete |

---

## Task Details

### TASK-0066 — Token efficiency observability (8 SP)

**Problem:** Phases 4–6 reduce token consumption but there is no measurement layer.
Without observability, we cannot:
- Confirm the –40% token reduction from Phase 4 actually occurred
- Detect regressions when a new skill version bloats output size
- Generate data-driven improvement proposals ("skill X is consuming 3× more tokens than
  its peers — consider model downgrade or output pruning")

**Extends:** `behavioral-telemetry-collector` (SKL-047), `session-insights` (SKL-048),
`enhancement-dashboard` (SKL-049), `adaptive-proposal-generator` (SKL-050)

**Change to `behavioral-telemetry-collector` (v1.1.0 → v1.2.0):**

Add token consumption events to the event schema:
```json
{
  "event_type":    "skill.tokens_consumed",
  "skill":         "architecture-design",
  "phase_id":      "phase-2-architecture",
  "tokens_in":     1240,
  "tokens_out":    3800,
  "tokens_total":  5040,
  "model":         "claude-sonnet-4.6",
  "cache_hit":     false,
  "artifact_ids":  ["art-0003"]
}
```
These events use the `Artifact` envelope's `token_count` from TASK-0060 for `tokens_out`.
`tokens_in` = sum of token counts of all input artifacts for the invocation.

**Change to `session-insights` (v1.1.0 → v1.2.0):**

Add `token_efficiency` section to session summary output:
```json
"token_efficiency": {
  "total_tokens_consumed":  42000,
  "by_skill": [
    { "skill": "code-generator", "tokens": 12000, "pct_of_total": 28.6 },
    { "skill": "architecture-design", "tokens": 5040, "pct_of_total": 12.0 }
  ],
  "cache_hit_rate":          0.15,
  "compression_events":      3,
  "vs_baseline":             -0.38   ← –38% vs. pre-Phase-4 baseline
}
```

**Change to `enhancement-dashboard` (SKL-049):**

Add "Token Efficiency" tab:
- Bar chart: tokens per skill, descending
- Trend line: total tokens per session over last 10 sessions
- Highlight: any skill where `tokens_out > p90` (statistical outlier detection)

**Change to `adaptive-proposal-generator` (SKL-050):**

Add new proposal templates:
- `model_tier_downgrade`: "Skill X consumed avg 8,000 tokens/run over 5 sessions using
  sonnet; haiku achieves comparable output — downgrade candidate"
- `output_pruning_candidate`: "Skill Y output has 8 fields; downstream skill consumes
  only 2 — add projection rule"
- `compression_policy_tighten`: "Phase Z pipeline state at 90% ceiling before auto-compress
  triggers — reduce trigger_at_percent from 85% to 70%"

**Files:** `behavioral-telemetry-collector`, `session-insights`, `enhancement-dashboard`,
`adaptive-proposal-generator` SKILL.md files
**Version bumps:** All four skills: minor bump (e.g., `1.1.0 → 1.2.0`)
**Validation:** Run full pipeline → check `session_summary.token_efficiency` present;
run 5 sessions → check `enhancement-dashboard` shows trend; verify adaptive proposals generated

---

### TASK-0065 — Pipeline warm-start from HITL gate snapshot (8 SP)

**Problem:** Phase 5's TASK-0056 enables `resume_from_phase` from in-memory session state.
Phase 6's TASK-0062 persists snapshots at HITL boundaries. But these two capabilities are
not unified — a user who wants to re-run the pipeline from a prior gate decision must
manually specify both the `resume_from_phase` and a snapshot to restore.

TASK-0065 unifies them into a single "warm-start" UX that works across session boundaries.

**Change to `orchestrator` SKILL.md:**

Add `warm_start` input option:
```json
{
  "warm_start": {
    "snapshot_id":  "snap-phase-4-planning-approved",
    "intent":       "re_run_from_snapshot" | "modify_and_continue" | "branch"
  }
}
```

**Warm-start intents:**

| Intent | Behavior |
|--------|----------|
| `re_run_from_snapshot` | Restore state from snapshot; re-run all phases from snapshot's phase_id onward |
| `modify_and_continue` | Restore state; apply user-provided diff to the snapshot artifact; re-run from that phase |
| `branch` | Restore state into a new session; run new pipeline variant without affecting original session |

**Gate snapshot list exposed in pipeline output:**
After any HITL gate pause, the orchestrator surfaces available snapshots:
```
Available warm-start points:
  snap-phase-1-requirements   (after: requirement-analyzer)
  snap-phase-2-architecture   (after: architecture-design) ← last approved
  snap-phase-4-planning       (pending approval)
```
This gives users a clear "resume menu" without requiring them to track snapshot IDs manually.

**Files:** `.opencode/skills/orchestrator/SKILL.md` (bump `1.6.0 → 2.0.0`)
**Validation:** Full pipeline → approve phase-2 → start new session → warm-start from
`snap-phase-2-architecture` → verify phases 1-2 outputs pre-populated, phase-3+ execute

---

### TASK-0063 — New skill: `multi-agent-debate` (13 SP)

**Problem:** Architecture decisions are currently made by a single `architect` agent in
one pass. The `clean-code-review` skill provides post-hoc critique but there is no
mechanism for the architecture itself to be adversarially validated before planning begins.
Low-quality architecture decisions propagate through all downstream phases.

**Inspired by:** Microsoft AutoGen's `ConversableAgent` debate pattern.

**New skill: `multi-agent-debate`**

```
Purpose:
  Run an adversarial debate loop between an Architect agent (proposes) and a Reviewer
  agent (critiques) until consensus is reached or max_rounds is exceeded.
  Produces a higher-quality, critique-hardened architecture artifact.

When to invoke:
  After phase-2-architecture and before phase-2b-design (UX + DB).
  Only for full-pipeline and architecture-only pipelines.
  Controlled by pipeline config flag: "debate_architecture": true

Inputs:
  architecture_proposal:  architecture-design output
  critique_criteria:      array of criteria the Reviewer evaluates against
  max_rounds:             integer (default: 5, max: 10)
  consensus_threshold:    float (default: 0.80 — 80% of criteria must be "pass")

Execution Logic:
  Round 1:
    Architect presents architecture_proposal.
    Reviewer evaluates each criterion → verdict: pass | concern | reject.
    Reviewer generates concerns[] with evidence and remediation suggestions.

  Round N (if consensus not reached):
    Architect receives concerns[] from Round N-1.
    Architect produces revised_proposal addressing each concern.
    Reviewer re-evaluates. Criteria that were "pass" in prior round stay "pass".
    New consensus_score = passing_criteria / total_criteria.

  Termination:
    CONVERGED:  consensus_score >= consensus_threshold → return final_architecture
    STALEMATE:  same concerns repeat in 2 consecutive rounds → escalate to HITL gate
    MAX_ROUNDS: max_rounds exceeded → escalate to HITL gate with debate transcript

HITL gate (if STALEMATE or MAX_ROUNDS):
  Present: debate transcript, current consensus_score, unresolved concerns
  Human decides: override (accept current proposal) | re-scope (modify criteria) | reject

Outputs:
  final_architecture:   critique-hardened architecture (or best-effort if escalated)
  debate_transcript:    [{round, architect_response, reviewer_concerns, consensus_score}]
  consensus_reached:    boolean
  rounds_taken:         integer
  unresolved_concerns:  array (concerns never resolved — surfaced to planning as risks)
```

**Pipeline integration:**
Add to `full-pipeline.json` as an optional phase between `phase-2-architecture` and `phase-2b-design`:
```json
{
  "id": "phase-2a-debate",
  "label": "Architecture Debate (optional)",
  "condition": "pipeline_config.debate_architecture === true",
  "skills": [
    { "name": "multi-agent-debate", "version": "^1.0.0", "max_retries": 1 }
  ]
}
```

**New files to create:**
- `.opencode/skills/multi-agent-debate/SKILL.md`
- `skills/registry.json` entry (requires HITL approval before registry write)
- `skills/index.yaml` entry (requires HITL approval)

**Version bumps:** New skill at `1.0.0`; `full-pipeline.json` → `3.2.0`
**Validation:** Run debate with a deliberately flawed architecture; verify Reviewer raises
concerns; verify Architect revises; verify consensus score converges

---

### TASK-0064 — Durable async skill execution (13 SP)

**Problem:** The four async skills (`documentation-generator`, `doc-maintainer`,
`adr-generator`, `work-item-exporter`) are fire-and-forget. If the session ends before
they complete, they are silently abandoned. There is no retry, no failure reporting, and
no way to query their status after the pipeline completes.

**Inspired by:** Trigger.dev job queue pattern; Temporal workflow Signal/Query API.

**Durable job model added to `orchestrator` SKILL.md:**

A "durable job" is an async skill invocation that:
1. Is persisted to a job registry on dispatch (not just in-memory state)
2. Has explicit retry policies independent of the main pipeline retry
3. Can be queried for status at any time via the orchestrator's `query_async_job` input
4. Emits a completion callback that the orchestrator can optionally wait for

**Job registry schema (extends TASK-0058's `async_task_registry`):**
```json
{
  "job_id":           "job-doc-001",
  "skill":            "documentation-generator",
  "session_id":       "sess-001",
  "dispatched_at":    "2026-07-02T10:30:00Z",
  "status":           "pending" | "running" | "completed" | "failed" | "retrying",
  "retry_count":      0,
  "max_retries":      3,
  "retry_policy":     { "backoff": "exponential", "initial_delay_ms": 5000 },
  "last_error":       null,
  "completed_at":     null,
  "result_ref":       null,
  "completion_event": "documentation.completed"
}
```

**Orchestrator steps added:**

```
On async skill dispatch:
  1. Write job entry to job_registry with status=pending
  2. Dispatch skill invocation (non-blocking)
  3. Update status=running

On skill completion callback:
  4. Update status=completed, result_ref, completed_at
  5. Emit completion_event to event_log
  6. If downstream skill was waiting: dispatch it with result_ref payload

On skill failure:
  7. If retry_count < max_retries: update status=retrying, increment retry_count,
     schedule retry with backoff
  8. If retry_count >= max_retries: update status=failed, emit failure event
  9. Surface all failed jobs in pipeline summary with error details

Query API (new orchestrator input):
  { "query_async_jobs": { "session_id": "sess-001", "status_filter": "all" } }
  Returns: current job_registry filtered by session and status
```

**Adapter pattern — no external infrastructure required in base mode:**
- Base mode: jobs are tracked in session state (same as TASK-0058 but with retry logic)
- Advanced mode (Phase 7+ extension): an external job queue adapter (Trigger.dev, SQS, etc.)
  can be plugged in by implementing the dispatch/callback contract

This keeps Phase 7 self-contained (no new infrastructure dependency) while leaving the door
open for external queue integration as a future configuration option.

**Files:** `.opencode/skills/orchestrator/SKILL.md` (included in `1.6.0 → 2.0.0` bump),
`docs/context-engineering.md`
**Validation:** Dispatch 3 async skills → kill session mid-run → start new session with
same session_id → verify jobs resume from last known state; verify failed jobs surface in summary

---

## Dependency Graph

```
Phase 6 (v2.3.0) must be complete before Phase 7 begins.

TASK-0060 (Phase 6) ─────────► TASK-0066 (token observability uses Artifact.token_count)
TASK-0062 (Phase 6) ─────────► TASK-0065 (warm-start from snapshot)
TASK-0056 (Phase 5) ─────────► TASK-0065 (warm-start builds on resume_from_phase)
TASK-0058 (Phase 5) ─────────► TASK-0064 (durable jobs extends async_task_registry)

TASK-0063 (multi-agent-debate): standalone — no intra-Phase 7 dependencies
TASK-0064 (durable jobs):       standalone — extends prior phases but no Phase 7 deps
TASK-0065 (warm-start):         depends on TASK-0062 (snapshot API from Phase 6) ✅ done
TASK-0066 (token observability): depends on TASK-0060 (artifact envelope from Phase 6) ✅ done

Intra-phase execution order:
  TASK-0066 (8 SP) + TASK-0065 (8 SP) can run in parallel — both modify different skill files
  TASK-0063 (13 SP) can run in parallel — new skill, no conflicts with 0065/0066
  TASK-0064 (13 SP) should start after TASK-0066 so token tracking is ready for durable jobs
```

---

## Risks

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Multi-agent debate loop cycles indefinitely (Architect + Reviewer disagree forever) | High | STALEMATE detection (same concerns repeat 2× → HITL escalation); hard `max_rounds` cap |
| Debate produces lower quality than single-pass architecture (Reviewer introduces incorrect critiques) | Medium | `critique_criteria` are user-defined and approved at pipeline config time; Reviewer must cite evidence from the architecture spec for every concern |
| Durable job retry causes duplicate `doc-maintainer` documentation writes | High | Jobs carry `job_id` (idempotency key); `doc-maintainer` checks for existing job_id before writing |
| Warm-start from stale snapshot applies to diverged codebase (snapshot is from 3 months ago) | Medium | Snapshot `content_hash` validated against current session inputs; hash mismatch → warn + require explicit `force_warm_start: true` override |
| Token observability events add overhead to every skill invocation | Low | Events are fire-and-forget to `behavioral-telemetry-collector`; no synchronous wait; overhead < 50ms per event |
| `multi-agent-debate` registration in `registry.json` bypasses quality gate | Critical | Registration requires HITL approval per governance §5.1 `standard` tier; quality-scoring must score ≥ 70/100 |

---

## Version Summary

| Component | v2.3.0 (incoming) | v3.0.0 (this phase) |
|-----------|-------------------|---------------------|
| `orchestrator` | 1.6.0 | **2.0.0** (MAJOR — durable jobs, warm-start) |
| `multi-agent-debate` | (new) | **1.0.0** |
| `behavioral-telemetry-collector` | 1.1.0 | **1.2.0** |
| `session-insights` | 1.1.0 | **1.2.0** |
| `enhancement-dashboard` | 1.x.x | **+1 MINOR** |
| `adaptive-proposal-generator` | 1.x.x | **+1 MINOR** |
| `full-pipeline.json` | 3.1.0 | **3.2.0** (optional debate phase) |

---

## Delivery Checklist

- [ ] `scripts/validate-skills.sh` passes (0 failures)
- [ ] `multi-agent-debate` SKILL.md authored, quality-scored ≥ 70/100, HITL-approved for registry
- [ ] `multi-agent-debate` in `skills/registry.json` and `skills/index.yaml`
- [ ] Orchestrator SKILL.md version `2.0.0` with durable job registry + warm-start steps
- [ ] `skills/index.yaml` synced for orchestrator `2.0.0`
- [ ] Token efficiency events schema documented in `docs/context-engineering.md`
- [ ] `enhancement-dashboard` renders Token Efficiency tab
- [ ] Adaptive proposals include `model_tier_downgrade`, `output_pruning_candidate` templates
- [ ] Integration test: debate loop converges within 5 rounds on a sample architecture
- [ ] Integration test: durable job resumes after session kill; no duplicate writes
- [ ] Integration test: warm-start from snapshot populates prior-phase outputs correctly
- [ ] Integration test: `session_summary.token_efficiency.vs_baseline` shows negative delta vs. pre-Phase-4
- [ ] `docs/changelog.md` updated with v3.0.0 entry
- [ ] `docs/enhancements/master-roadmap-v2.1.0-to-v3.0.0.md` marked as COMPLETE

# Phase 5 — v2.2.0: Parallel Execution & Performance

**Version target:** v2.2.0
**Story points:** 28
**Tasks:** TASK-0054 – TASK-0058
**Category:** Pipeline performance + execution efficiency
**Depends on:** Phase 4 complete (v2.1.0)

---

## Goals

Reduce wall-clock execution time and eliminate redundant computation through five
complementary strategies: additional parallelism, lazy skill loading, feedback-loop
memoization, warm-start resume capability, and async skill observability.

Phase 4 reduced token *spend* per run. Phase 5 reduces the *number of times* expensive
operations run and the *time* the user waits between HITL gates.

**Expected outcome:** –20 to –30% wall-clock time on a full-pipeline run; –100% token cost
on cached skill invocations in feedback loops; –50 to –80% rework tokens after HITL rejection.

---

## Tasks

| ID | Title | SP | Status |
|----|-------|----|--------|
| TASK-0054 | Parallelize `dependency-analyzer` + `design-system-generator` | 2 | pending |
| TASK-0055 | Orchestrator lazy SKILL.md section loading | 5 | pending |
| TASK-0058 | Async skill completion tracking (`async_task_registry` in orchestrator state) | 5 | pending |
| TASK-0056 | Add `resume_from_phase` capability to orchestrator + pipeline templates | 8 | pending |
| TASK-0057 | Skill invocation memoization — within-session cache by `(skill, input_hash)` | 8 | pending |

---

## Task Details

### TASK-0054 — Parallelize `dependency-analyzer` + `design-system-generator` (2 SP)

**Problem:** In `full-pipeline.json`, phases 3 and 2c run sequentially:
```
phase-2c-design-system (design-system-generator)
        ↓ (sequential)
phase-3-graph (dependency-analyzer)
```
These two skills have no data dependency on each other:
- `design-system-generator` needs: UX architecture output (ready after phase-2b)
- `dependency-analyzer` needs: architecture modules (ready after phase-2-architecture)

Running them sequentially wastes one full skill-invocation of wall time.

**Change to `full-pipeline.json`:**
Merge phases 2c and 3 into a new parallel phase:
```json
{
  "id": "phase-2c-design-and-graph",
  "label": "Design System + Dependency Graph",
  "parallel": true,
  "skills": [
    { "name": "design-system-generator", "version": "^2.0.0", "max_retries": 2 },
    { "name": "dependency-analyzer",     "version": "^1.0.0", "max_retries": 2 }
  ]
}
```
Update `parallel_groups` array accordingly.

**Files:** `skills/pipelines/full-pipeline.json`
**Version bump:** `full-pipeline.json` `3.0.0 → 3.1.0`

---

### TASK-0055 — Lazy SKILL.md section loading (5 SP)

**Problem:** When the orchestrator invokes a skill, the full SKILL.md is loaded as context.
A typical SKILL.md has 13 sections (200–300 lines). Many sections are only needed at
specific invocation points:

| Section | When Needed |
|---------|-------------|
| Purpose | Always |
| Inputs / Input Schema | Always |
| Required Context | Always |
| Execution Logic | Always |
| Outputs / Output Schema | Always |
| Rules & Constraints | First-time invocation only |
| Security Considerations | First-time + when security flag set |
| Token Optimization | First-time only |
| Quality Checklist | Post-execution validation only |
| Failure Scenarios | Only when a retry is triggered |
| HITL Gates | Only when HITL conditions are met |
| Skill Composition | Not needed at runtime |

**Change to `orchestrator` SKILL.md:**

Add section-loading spec to the "Invoke skill" step:
```
Default sections loaded per invocation (mandatory core):
  - Purpose, Inputs, Input Schema, Required Context, Execution Logic,
    Outputs, Output Schema, Rules & Constraints

Conditionally loaded sections:
  - Security Considerations  → if skill has security_sensitive: true
  - Failure Scenarios        → if retry_count > 0
  - HITL Gates               → if HITL conditions are evaluated
  - Quality Checklist        → only during post-execution validation pass
  - Token Optimization       → only on first invocation of a skill in a session
  - Skill Composition        → never loaded at runtime (design-time only)
```

**Expected savings:** A 250-line SKILL.md loaded in full = ~800 tokens.
Core sections only = ~500 tokens (–37% per skill load).
Over 15 skills in a full pipeline = ~4,500 tokens saved per run.

**Files:** `.opencode/skills/orchestrator/SKILL.md` (bump `1.4.0 → 1.5.0`)
**Validation:** All 15 full-pipeline skills produce correct output with section-restricted loading

---

### TASK-0058 — Async skill completion tracking (5 SP)

**Problem:** `full-pipeline.json` marks four skills as `async: true`:
`documentation-generator`, `doc-maintainer`, `adr-generator`, `work-item-exporter`.
These are fire-and-forget — the orchestrator advances without waiting for them,
but there is no `async_task_registry` in the session state. The operator cannot
query whether async skills completed, failed, or are still running.

**Change to `orchestrator` SKILL.md:**

Add `async_task_registry` to session state schema:
```json
"async_task_registry": [
  {
    "task_id":     "async-task-001",
    "skill":       "doc-maintainer",
    "started_at":  "2026-07-02T10:30:00Z",
    "status":      "running" | "completed" | "failed",
    "result_ref":  "session_state.doc_maintainer_output",
    "error":       null
  }
]
```

Add orchestrator step: "Register async invocation" — when any skill with `async: true`
is dispatched, write an entry to `async_task_registry` with `status: "running"`.
Add orchestrator step: "Reconcile async tasks" — at pipeline completion, update each
`async_task_registry` entry with final status. Surface any `failed` entries in the
pipeline summary output.

**Files:** `.opencode/skills/orchestrator/SKILL.md`, `docs/context-engineering.md`

---

### TASK-0056 — `resume_from_phase` capability (8 SP)

**Problem:** When a HITL gate is rejected (user responds `reject` or `modify`), the
orchestrator returns `{"status": "halted"}` and the user must reinvoke the full pipeline
from phase 1. This re-runs requirement-analysis, architecture-design, design-system
generation, and planning — phases whose outputs haven't changed.

A full pipeline re-run after a single HITL modification costs 60–80% of the original
token budget (only the modified phase and downstream phases need to re-execute).

**Change to `orchestrator` SKILL.md + pipeline templates:**

1. On HITL gate `reject` or `modify`: persist `session_context` with current phase index
   and all completed-phase outputs.

2. Add `resume_from_phase` to orchestrator inputs:
   ```json
   { "resume_from_phase": "phase-4-planning" }
   ```

3. When `resume_from_phase` is set:
   - Load persisted `session_context`
   - Skip all phases prior to `resume_from_phase` (use their cached outputs from state)
   - Re-execute from `resume_from_phase` onward with the modified artifact as new input

4. Add `resumable: true` to all pipeline templates to opt-in to this behavior.

**Example flow:**
```
User submits pipeline → phases 1-4 complete → HITL gate at phase-4-planning
User responds "modify: scope reduced to 3 modules"
Orchestrator persists state.
User re-invokes: resume_from_phase = "phase-4-planning", new_scope = "3 modules"
Orchestrator skips phases 1-3 (uses cached outputs) → re-runs phase-4 onward
```

**Token saving:** phases 1-3 in full-pipeline = ~35,000 tokens avoided per resume.

**Files:** `.opencode/skills/orchestrator/SKILL.md`, all pipeline JSONs (add `"resumable": true`)
**Validation:** Integration test: run full pipeline → HITL reject → resume → verify phases 1-3 not re-executed

---

### TASK-0057 — Skill invocation memoization (8 SP)

**Problem:** Feedback loops in the pipeline (when a skill's output triggers a backpropagate
event to an upstream skill) cause upstream skills to be re-invoked. If the upstream skill's
inputs haven't changed, the re-invocation is identical and wastes tokens.

Example: `code-generator` generates code → `clean-code-review` finds issues →
feedback loop back to `code-generator` with the same architecture input → identical output.

**Change to `orchestrator` SKILL.md:**

Add `invocation_cache` to session state:
```json
"invocation_cache": {
  "<skill_name>:<input_hash>": {
    "output":       { ... },
    "invoked_at":   "2026-07-02T10:30:00Z",
    "hit_count":    0
  }
}
```

Add orchestrator step: "Check memoization cache" — before invoking any skill:
1. Compute `input_hash = SHA-256(canonicalized input payload)`
2. Look up `invocation_cache[skill_name:input_hash]`
3. If hit: return cached output, increment `hit_count`, log `CACHE_HIT`
4. If miss: invoke skill, store result in cache, log `CACHE_MISS`

**Cache invalidation rules:**
- Cache entry is invalidated if any field in `session_context` that the skill's
  `Required Context` section declares as a dependency has changed.
- Cache is never persisted across sessions (within-session only in Phase 5;
  cross-session cache is a Phase 6/7 concern).
- Maximum cache size: 50 entries. LRU eviction.

**Expected savings:** –100% tokens on cache hits in feedback loops.
Typical feedback loops trigger 1–3 upstream re-invocations; memoization eliminates all of them
when inputs are unchanged.

**Files:** `.opencode/skills/orchestrator/SKILL.md` (included in `1.4.0 → 1.5.0` bump)
**Validation:** Run a pipeline that triggers a feedback loop; verify `CACHE_HIT` log events appear on second invocation

---

## Dependency Graph

```
Phase 4 (v2.1.0) must be complete before Phase 5 begins.

TASK-0054  (standalone in Phase 5 — pipeline JSON only)

TASK-0058 ──────────────────► Phase 6: TASK-0062 (snapshot API)
(async tracking)               Phase 7: TASK-0064 (durable jobs)

TASK-0056 ──────────────────► Phase 7: TASK-0065 (warm-start from snapshot)
(resume_from_phase)

TASK-0049 (Phase 4) ─────────► TASK-0055 (lazy load depends on token_policy being active)

TASK-0051 (Phase 4) ─────────► TASK-0057 (pruned input hash is smaller, cache more precise)

All Phase 5 tasks can ship independently; no intra-phase blocking dependencies.
```

**Execution order within Phase 5:**
1. TASK-0054 (2 SP, quick win — pipeline JSON change)
2. TASK-0058 (5 SP, adds state fields — no breaking changes)
3. TASK-0055 (5 SP, orchestrator update — section loading spec)
4. TASK-0056 + TASK-0057 (8 SP each — can run in parallel, both modify orchestrator SKILL.md)

---

## Risks

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Parallel design-system + dependency-analyzer causes state write conflict | High | Both skills write to distinct state keys (`design_system_output` vs `dependency_graph`); orchestrator merges at phase boundary |
| Memoization returns stale result after upstream architecture was modified post-HITL | High | Cache invalidation rule: any `session_context` field in skill's `Required Context` that changes clears that skill's cache entry |
| `resume_from_phase` loads stale state from a prior session by mistake | High | `session_id` + `phase_checkpoint_id` must both match before state is loaded for resume |
| Lazy section loading causes orchestrator to miss a rule in `Rules & Constraints` | Medium | Run a full-section validation pass before first invocation of each skill in a session; use lazy loading for subsequent invocations only |
| `async_task_registry` grows unbounded in very long sessions | Low | Cap at 100 entries; drop oldest completed/failed entries when cap reached |

---

## Delivery Checklist

- [ ] `scripts/validate-skills.sh` passes (0 failures)
- [ ] `full-pipeline.json` version bumped to `3.1.0`
- [ ] `dependency-analyzer` and `design-system-generator` in same parallel group
- [ ] Orchestrator SKILL.md version bumped to `1.5.0`
- [ ] `skills/index.yaml` synced for orchestrator `1.5.0`
- [ ] `async_task_registry` schema documented in `docs/context-engineering.md`
- [ ] Integration test: resume_from_phase skips upstream phases
- [ ] Integration test: memoization cache hits on repeated invocations with identical input
- [ ] `docs/changelog.md` updated with v2.2.0 entry

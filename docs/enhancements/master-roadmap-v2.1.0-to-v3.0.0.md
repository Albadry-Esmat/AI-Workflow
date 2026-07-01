# Master Enhancement Roadmap — v2.1.0 → v3.0.0

**Created:** 2026-07-02
**Author:** Primary orchestrator
**Tasks:** TASK-0049 – TASK-0066
**Total story points:** 121
**Phases:** 4 (phases 4 – 7)

---

## Strategic Goals

This roadmap has three interlocking objectives, in priority order:

| # | Objective | Metric |
|---|-----------|--------|
| 1 | **Reduce token consumption** — cut LLM token spend per full-pipeline run | Target: –40 % per run vs. current baseline |
| 2 | **Improve execution performance** — reduce wall-clock time for sequential phases | Target: –30 % via parallelism + warm-start |
| 3 | **Deliver high-value features** — close the most impactful gaps from the GitHub repo analysis | 4 new capabilities by v3.0.0 |

---

## Baseline Audit (as of v2.0.0)

| Gap | Category | Impact |
|-----|----------|--------|
| No `token_policy` block in any pipeline template — auto-compression cannot fire | Token | Critical |
| `work-item-exporter` pinned at `^1.0.0` in `full-pipeline.json` despite v2.0.0 shipping | Correctness | Critical |
| Orchestrator passes full skill outputs between skills (no field pruning) | Token | High |
| All agents use `claude-sonnet-4.6` — no haiku tier for low-complexity tasks | Token | High |
| `dependency-analyzer` runs sequentially after `design-system-generator` (no dependency) | Performance | Medium |
| No `resume_from_phase` — HITL rejection forces full pipeline restart | Performance | High |
| No within-session skill result cache — feedback loops re-run identical invocations | Performance | Medium |
| Async skills fire-and-forget — no completion tracking in orchestrator state | Performance | Low |
| `context-memory` is session-scoped only — no cross-session artifact reuse | Feature | High |
| No standardized inter-skill artifact envelope — pruning/auditing is ad-hoc | Feature | Medium |
| No external trigger integration — pipelines start only via manual invocation | Feature | Medium |
| No token efficiency observability — can't measure what we want to optimize | Feature | Medium |

---

## Phase Summary

| Phase | Version | Title | SP | Tasks | Primary Gain |
|-------|---------|-------|----|-------|--------------|
| 4 | v2.1.0 | Token Efficiency & Pipeline Correctness | 20 | TASK-0049 – TASK-0053 | –30% tokens/run |
| 5 | v2.2.0 | Parallel Execution & Performance | 28 | TASK-0054 – TASK-0058 | –25% wall-clock time |
| 6 | v2.3.0 | Persistent State & External Integration | 31 | TASK-0059 – TASK-0062 | Cross-session reuse, webhooks |
| 7 | v3.0.0 | Advanced Intelligence & Durability | 42 | TASK-0063 – TASK-0066 | Multi-agent debate, durable jobs |
| **Total** | | | **121** | **17 tasks** | |

---

## Full Task Inventory

### Phase 4 — v2.1.0 (20 SP)

| ID | Title | SP | Category | Skills / Files Touched |
|----|-------|----|----------|------------------------|
| TASK-0049 | Add `token_policy` block to all 21 pipeline templates | 3 | Token | `skills/pipelines/*.json` |
| TASK-0050 | Fix `work-item-exporter` pin in `full-pipeline.json` (`^1.0.0` → `^2.0.0`) | 1 | Correctness | `skills/pipelines/full-pipeline.json` |
| TASK-0051 | Orchestrator output-field pruning — pass only required input fields to each skill | 8 | Token | `orchestrator` SKILL.md |
| TASK-0052 | Model tier right-sizing — assign `claude-haiku-4.5` to eligible low-complexity agents | 3 | Token | `opencode.json`, `docs/agents.md` |
| TASK-0053 | Orchestrator `compress_after_handoff` — compress completed skill state after downstream consumption | 5 | Token | `orchestrator` SKILL.md, `context-engineering.md` |

### Phase 5 — v2.2.0 (28 SP)

| ID | Title | SP | Category | Skills / Files Touched |
|----|-------|----|----------|------------------------|
| TASK-0054 | Parallelize `dependency-analyzer` with `design-system-generator` in `full-pipeline.json` | 2 | Performance | `skills/pipelines/full-pipeline.json` |
| TASK-0055 | Orchestrator lazy SKILL.md section loading — load only required sections per invocation type | 5 | Performance / Token | `orchestrator` SKILL.md |
| TASK-0056 | Add `resume_from_phase` to orchestrator and all pipeline templates | 8 | Performance | `orchestrator` SKILL.md, all pipeline JSONs |
| TASK-0057 | Skill invocation memoization — within-session cache keyed by `(skill, input_hash)` | 8 | Performance | `orchestrator` SKILL.md |
| TASK-0058 | Async skill completion tracking — `async_task_registry` in orchestrator state | 5 | Performance | `orchestrator` SKILL.md, `context-engineering.md` |

### Phase 6 — v2.3.0 (31 SP)

| ID | Title | SP | Category | Skills / Files Touched |
|----|-------|----|----------|------------------------|
| TASK-0059 | `context-memory` v2.0.0 — cross-session archival memory blocks (Letta-inspired) | 13 | Feature | `context-memory` SKILL.md, `context-engineering.md` |
| TASK-0060 | Standardize inter-skill artifact envelope schema — `Artifact` wrapper with token_count | 5 | Feature / Token | `orchestrator` SKILL.md, `context-engineering.md` |
| TASK-0061 | `work-item-exporter` v2.1.0 — webhook trigger mode (Jira → pipeline auto-invocation) | 8 | Feature | `work-item-exporter` SKILL.md, `skills/index.yaml` |
| TASK-0062 | Pipeline snapshot API — named snapshots at HITL gate boundaries | 5 | Feature / Performance | `orchestrator` SKILL.md, `context-engineering.md` |

### Phase 7 — v3.0.0 (42 SP)

| ID | Title | SP | Category | Skills / Files Touched |
|----|-------|----|----------|------------------------|
| TASK-0063 | New skill: `multi-agent-debate` — architect + reviewer debate loop for architecture validation | 13 | Feature | New SKILL.md, `full-pipeline.json`, `registry.json`, `index.yaml` |
| TASK-0064 | Durable async skill execution — job queue with retry, status, and completion callbacks | 13 | Feature / Performance | `orchestrator` SKILL.md, `context-engineering.md` |
| TASK-0065 | Pipeline warm-start from HITL gate snapshot (restore + continue) | 8 | Performance | `orchestrator` SKILL.md, all pipeline JSONs |
| TASK-0066 | Token efficiency observability — per-skill token telemetry, trends, and adaptive proposals | 8 | Token / Feature | `behavioral-telemetry-collector`, `session-insights`, `enhancement-dashboard` SKILL.md files |

---

## Dependency Graph

```
TASK-0049 ──────────────────────► TASK-0053 ──► TASK-0057
(token_policy)                    (compress)     (memoize)
     │
     └──────────────────────────► TASK-0055
                                  (lazy load)

TASK-0050  (standalone — no deps, no blocks)

TASK-0051 ──► TASK-0060 ──► TASK-0059
(pruning)     (artifact env)  (cross-session)

TASK-0054  (standalone — parallelism config only)

TASK-0056 ──► TASK-0065
(resume)      (warm-start)

TASK-0058 ──► TASK-0062 ──► TASK-0064
(async track)  (snapshots)   (durable jobs)

TASK-0052  (standalone — opencode.json model edits only)

TASK-0063  (standalone — new skill, no upstream dep)

TASK-0066 ──► (feeds adaptive-proposal-generator with token data)
```

**Critical path:** `TASK-0049 → TASK-0053 → TASK-0057 → TASK-0064`

---

## Expected Impact Per Phase

### Phase 4 — Token Efficiency

| Improvement | Mechanism | Estimated Savings |
|-------------|-----------|------------------|
| `token_policy` activation | Enables auto-compression at 85% ceiling | Up to –35% on large pipelines |
| Output-field pruning | Only required fields pass between skills | –40 to –60% per inter-skill handoff |
| Model tier right-sizing | Haiku for doc-maintainer, schema-validator, etc. | –60 to –80% cost on eligible agents |
| History compression | Completed skill state compressed after consumption | –15 to –25% on pipeline state size |
| **Combined Phase 4 estimate** | | **–30 to –40% total tokens/run** |

### Phase 5 — Performance

| Improvement | Mechanism | Estimated Gain |
|-------------|-----------|----------------|
| Parallelism (TASK-0054) | `dependency-analyzer` ∥ `design-system-generator` | –1 sequential phase |
| Resume-from-phase (TASK-0056) | HITL rejections don't restart from phase 1 | –50 to –80% rework tokens |
| Memoization (TASK-0057) | Cached results for identical feedback-loop re-runs | –100% tokens on cache hits |
| Lazy SKILL.md loading (TASK-0055) | Only load Purpose + Logic + Schema sections by default | –30 to –40% skill load tokens |
| **Combined Phase 5 estimate** | | **–20 to –30% wall-clock time** |

### Phase 6 — Feature Value

| Feature | Benefit |
|---------|---------|
| Cross-session memory | Reuse prior architecture/planning artifacts — saves 3-4 phases on evolved codebases |
| Artifact envelope | Enables precise token counting, pruning, and audit per inter-skill transfer |
| Webhook trigger | Eliminates manual `mode=sync` invocation — Jira events auto-trigger pipeline |
| Pipeline snapshots | Named restore points — support rollback and partial re-run at any HITL boundary |

### Phase 7 — Advanced Intelligence

| Feature | Benefit |
|---------|---------|
| Multi-agent debate | Higher quality architecture decisions through adversarial validation |
| Durable async jobs | Async skills are reliable, observable, and retriable — no more fire-and-forget |
| Token observability | Measure token spend per skill, identify regressions, drive adaptive proposals |
| Warm-start from snapshot | True resume: restore post-HITL state and continue without re-running any phase |

---

## Risk Register

| Risk | Phases | Impact | Mitigation |
|------|--------|--------|-----------|
| Output-field pruning breaks downstream skill (required field accidentally pruned) | Phase 4 | High | Field projection verified against each skill's input schema `required[]` before shipping |
| Model tier downgrade degrades output quality on haiku-assigned agents | Phase 4 | Medium | Haiku assigned only to structural/validation tasks (schema-validator, doc-maintainer); never to architect, reviewer, or planner |
| Parallelism causes race condition in pipeline state writes | Phase 5 | High | Parallel phases use isolated state slices; orchestrator merges on completion (same pattern as existing phase-2b parallel) |
| Memoization returns stale result after upstream artifact changes | Phase 5 | High | Cache keys include full input hash; any upstream state change invalidates downstream cache entries |
| Cross-session memory exposes prior project data to new session | Phase 6 | Critical | Memory blocks scoped per `project_id`; cross-session reads require explicit `inherit_from_session_id` opt-in |
| Webhook trigger creates unauthorized pipeline invocations | Phase 6 | Critical | Webhook endpoint validates HMAC signature; `work-item-exporter` rejects unsigned requests |
| Multi-agent debate loop doesn't converge (infinite cycling) | Phase 7 | High | `max_rounds` cap (default 5); if consensus not reached, escalate to HITL gate |
| Durable job queue introduces external infrastructure dependency | Phase 7 | Medium | Adapter pattern: durable queue is optional; fallback is existing async fire-and-forget behavior |

---

## Versioning Plan

| Phase | Components Bumped | Version |
|-------|------------------|---------|
| 4 | `orchestrator` | `1.3.0 → 1.4.0` |
| 4 | `context-memory` (token_policy propagation) | `1.0.0 → 1.1.0` |
| 4 | All pipeline templates (token_policy block) | schema-only, no version bump on pipelines |
| 4 | `opencode.json` (model tier changes) | config file, no version |
| 5 | `orchestrator` | `1.4.0 → 1.5.0` |
| 5 | `full-pipeline.json` | `3.0.0 → 3.1.0` |
| 6 | `context-memory` | `1.1.0 → 2.0.0` (MAJOR — new archival memory API) |
| 6 | `work-item-exporter` | `2.0.0 → 2.1.0` (MINOR — new webhook mode) |
| 6 | `orchestrator` | `1.5.0 → 1.6.0` |
| 7 | `multi-agent-debate` | `1.0.0` (new skill) |
| 7 | `orchestrator` | `1.6.0 → 2.0.0` (MAJOR — durable jobs, warm-start) |
| 7 | `behavioral-telemetry-collector` | `1.1.0 → 1.2.0` |
| 7 | `session-insights` | `1.1.0 → 1.2.0` |
| 7 | `enhancement-dashboard` | bump to include token trend view |

---

## Cross-References

| This Roadmap | Prior Art |
|--------------|-----------|
| TASK-0061 (webhook trigger) | n8n Jira node integration (GitHub repo analysis) |
| TASK-0059 (cross-session memory) | `letta-ai/letta` memory block architecture |
| TASK-0064 (durable jobs) | `triggerdotdev/trigger.dev` job queue pattern |
| TASK-0065 (warm-start) | `temporalio/temporal` workflow resume via Signal |
| TASK-0063 (multi-agent debate) | `microsoft/autogen` ConversableAgent + GroupChat |
| TASK-0060 (artifact envelope) | `agentscope-ai/agentscope` `Msg` schema |

See `docs/enhancements/` for individual phase files:
- `phase-4-v2.1.0-token-efficiency.md`
- `phase-5-v2.2.0-parallel-execution.md`
- `phase-6-v2.3.0-persistent-state.md`
- `phase-7-v3.0.0-advanced-intelligence.md`

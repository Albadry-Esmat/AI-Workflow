# Phase 4 — v2.1.0: Token Efficiency & Pipeline Correctness

**Version target:** v2.1.0
**Story points:** 20
**Tasks:** TASK-0049 – TASK-0053
**Category:** Token reduction + correctness fixes
**Depends on:** Phases 1–3 complete ✅

---

## Goals

Close the two critical correctness gaps that have been live since v2.0.0 shipped, then
deliver the highest-ROI token-reduction changes that don't require architectural changes.
Phase 4 is the foundation all later phases depend on: the `token_policy` block (TASK-0049)
must exist before auto-compression (TASK-0053) and durable job budgets (Phase 7) can fire.

**Expected outcome:** –30 to –40% LLM tokens per full-pipeline run with zero functional changes to any skill's output.

---

## Tasks

| ID | Title | SP | Status |
|----|-------|----|--------|
| TASK-0050 | Fix `work-item-exporter` pin in `full-pipeline.json` (`^1.0.0` → `^2.0.0`) | 1 | pending |
| TASK-0049 | Add `token_policy` block to all 21 pipeline templates | 3 | pending |
| TASK-0052 | Model tier right-sizing — assign `claude-haiku-4.5` to eligible agents | 3 | pending |
| TASK-0053 | Orchestrator `compress_after_handoff` — compress completed skill state after downstream consumption | 5 | pending |
| TASK-0051 | Orchestrator output-field pruning — pass only required input fields to each skill | 8 | pending |

---

## Task Details

### TASK-0050 — Fix `work-item-exporter` version pin (1 SP)

**Problem:** `full-pipeline.json` phase-10b-export references `work-item-exporter` at `"version": "^1.0.0"`.
v2.0.0 shipped in Phase 3 with a new bidirectional sync schema. Any pipeline invocation that
resolves this constraint will run v1.x behavior and miss the `mode=sync` capability.

**Change:**
```json
// full-pipeline.json line 141
// Before:
{ "name": "work-item-exporter", "version": "^1.0.0", "max_retries": 1 }
// After:
{ "name": "work-item-exporter", "version": "^2.0.0", "max_retries": 1 }
```

**Files:** `skills/pipelines/full-pipeline.json`
**Validation:** `scripts/validate-skills.sh` must exit 0

---

### TASK-0049 — Add `token_policy` to all pipeline templates (3 SP)

**Problem:** `governance.md §7` mandates a `token_policy` block in every pipeline template.
Without it, `context-compressor` rejects `auto_compress: true` calls with
`AUTO_COMPRESS_NOT_PERMITTED`. None of the 21 pipeline templates currently declare this block.

**Standard block to add to every pipeline JSON:**
```json
"token_policy": {
  "auto_compress": true,
  "trigger_at_percent": 85,
  "budget_tiers": [
    { "name": "standard", "ceiling": 16000, "cascade_mode": "single_pass" },
    { "name": "large",    "ceiling": 32000, "cascade_mode": "cascade" },
    { "name": "xl",       "ceiling": 48000, "cascade_mode": "cascade" }
  ]
}
```

**Exceptions (override standard ceiling):**
- `full-pipeline.json` — uses `large` tier (32K) as default due to 15+ phase artifact accumulation
- `quick-review.json` — uses `standard` tier (16K); single-skill invocations
- `pre-deploy.json` — uses `standard` tier (16K)

**Files:** All 21 files under `skills/pipelines/*.json`
**Validation:** `scripts/validate-skills.sh` + new CI lint step checking `token_policy` presence

---

### TASK-0052 — Model tier right-sizing (3 SP)

**Problem:** All agents in `opencode.json` default to `claude-sonnet-4.6`. For structural,
validation, and documentation-only tasks, this is 4–8× more expensive than necessary.
`test-generator` and `doc-maintainer` already use `claude-haiku-4.5` — this task extends
that pattern to additional agents.

**Haiku candidates (all read-only / structured-output agents):**

| Agent | Current Model | Proposed | Rationale |
|-------|--------------|----------|-----------|
| `doc-maintainer` | haiku-4.5 | ✅ already haiku | — |
| `test-generator` | haiku-4.5 | ✅ already haiku | — |
| `analyzer` | sonnet-4.6 | **haiku-4.5** | Structured extraction, no creative reasoning |
| `impact-analyzer` | sonnet-4.6 | **haiku-4.5** | Dependency graph traversal, deterministic |
| `deployer` | sonnet-4.6 | **haiku-4.5** | Template-based strategy output, low creativity |

**Do NOT downgrade:**
- `reviewer` — security-sensitive judgement calls require sonnet
- `architect` — complex reasoning required for module boundary decisions
- `builder` — code generation quality is critical
- `security-specialist`, `recovery` — safety-critical; governance.md prohibits downgrade without documented rationale

**Files:** `opencode.json`, `docs/agents.md`
**Validation:** Run a quick-review pipeline end-to-end to verify output quality unchanged

---

### TASK-0053 — Orchestrator `compress_after_handoff` (5 SP)

**Problem:** `context-engineering.md` states "Keep last 3 [skill outputs]; older compress to
ID + status + metrics" but the orchestrator SKILL.md has no step that enforces this.
Completed skill outputs accumulate in session state at full size — a 15-phase full pipeline
carries ~14 full skill output payloads in state by the time it reaches deployment.

**Change to `orchestrator` SKILL.md:**

Add a new sub-step to the "Advance to next skill" transition:
```
After skill N output is consumed by skill N+1 (input mapped):
  If skill N output is older than 3 completed skills ago:
    Invoke context-compressor(
      content        = serialized skill N output,
      content_type   = "skill_output",
      max_tokens     = 500,
      compression_goal = "lossless_index",
      cascade_mode   = "single_pass"
    )
    Replace state[skill_N].output with compressed_content
    Record state[skill_N].compressed = true, compression_ratio
```

**Benefits:** Keeps pipeline state under control throughout execution — prevents the late-phase
state bloat that currently triggers aggressive auto-compression on every token check.

**Files:** `.opencode/skills/orchestrator/SKILL.md` (bump `1.3.0 → 1.4.0`), `docs/context-engineering.md`
**Validation:** Full pipeline run; verify state size does not grow linearly with phase count

---

### TASK-0051 — Orchestrator output-field pruning (8 SP)

**Problem:** The orchestrator currently maps the full output object of skill N as the input
to skill N+1. Skills output many fields (metrics, feedback, intermediate arrays, debug data)
that the next skill never reads. `context-engineering.md` documents "Output pruning: Only
pass fields the next skill's input schema requires — 40–60% reduction per handoff" as a
strategy, but it is not implemented in the orchestrator.

**Change to `orchestrator` SKILL.md:**

Add Step "Project outputs before handoff":
```
Before passing skill N output to skill N+1:
  1. Load skill N+1 input schema (required + optional fields only)
  2. Project skill N output to include only fields present in skill N+1 input schema
  3. Always include: id fields, status fields, error fields (for error propagation)
  4. Always exclude: metrics, feedback (these go to session telemetry, not next skill)
  5. Pass the projected payload as skill N+1 input
```

**Example (architecture-design → feature-planning):**
- architecture-design full output: ~12 fields (~4,000 tokens when serialized)
- feature-planning required inputs: `requirements`, `modules`, `integration_points` (~3 fields)
- After pruning: ~1,600 tokens (–60%)

**files:** `.opencode/skills/orchestrator/SKILL.md` (included in `1.3.0 → 1.4.0` bump from TASK-0053)
**Validation:** Schema check — every projected field exists in target skill's input schema

---

## Dependency Graph

```
TASK-0050  (standalone — do this first, unblocks everything)
     │
     ▼
TASK-0049 ─────────────────► TASK-0053 ──► Phase 5: TASK-0057 (memoization)
(token_policy)                (compress)
     │
     └──────────────────────► Phase 5: TASK-0055 (lazy load)

TASK-0052  (standalone — opencode.json only)

TASK-0051 ──────────────────► Phase 6: TASK-0060 (artifact envelope)
(field pruning)
```

**Execution order within phase:**
1. TASK-0050 (1 SP, 30 min) — ship immediately, unblocks nothing but closes correctness gap
2. TASK-0049 (3 SP) — must ship before TASK-0053 can be implemented
3. TASK-0052 (3 SP) — independent, can run in parallel with TASK-0049
4. TASK-0053 (5 SP) — requires TASK-0049 to be complete
5. TASK-0051 (8 SP) — largest item; can start in parallel with TASK-0053

---

## Risks

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Field pruning accidentally drops a field a downstream skill silently depends on | High | Validate against `required[]` arrays in each skill's input schema; add integration test that runs full pipeline and checks all required fields reach each skill |
| Model downgrade (TASK-0052) degrades `analyzer` output quality | Medium | A/B test: run 3 requirement-analysis scenarios with haiku vs. sonnet; compare `open_questions` count and `ambiguity_flags` depth |
| `compress_after_handoff` compresses a field that a later skill needs via `session_context` direct access | Medium | Do not compress fields listed in `preserve_keys` from the pipeline config; add a `preserve_in_state[]` annotation to pipeline skill entries |
| `token_policy` block causes existing pipeline JSON files to fail schema validation if pipeline schema doesn't allow it | Low | Update `skills/schema/pipeline-schema.json` to declare `token_policy` as an optional root-level property before adding it to templates |

---

## Delivery Checklist

- [ ] `scripts/validate-skills.sh` passes (0 failures, 0 warnings)
- [ ] All 21 pipeline templates have `token_policy` block
- [ ] `full-pipeline.json` `work-item-exporter` pin is `^2.0.0`
- [ ] `opencode.json` model tier changes documented in `docs/agents.md`
- [ ] Orchestrator SKILL.md version bumped to `1.4.0`
- [ ] `skills/index.yaml` version synced for orchestrator
- [ ] `docs/changelog.md` updated with v2.1.0 entry
- [ ] Integration test confirms –30% token delta on a sample full-pipeline run

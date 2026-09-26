# Remediation Plan — Routing Authority, Spec Traceability, Token Consolidation

Status: design + SAFE-only implementation. Frozen window `g0-window-2026-09-26-v1` stays OPEN.
No change to: thresholds, classifier, detector, promotion gates, flags, model-resolution, `primary.md` triggers.

## Area 1 — Routing authority

1. **Current authority:** first-match intent table in `.opencode/agent/primary.md:28-47` (10 rows + fallback ask-user). Declared sole execution authority by `config/adaptive-flags.json:49`, `scripts/log-shadow-observation.js:18,74`, `artifacts/shadow-observations/window-manifest.json:20`.
2. **Target authority:** `primary.md` stays the single human-editable source. All other representations become generated projections or explicitly subordinate:
   - `AGENTS.md` routing table → generated projection of `primary.md` (extended rows only after G0 close + governance approval).
   - `scripts/log-shadow-observation.js legacyRoute()` → generated mirror (byte-identical trigger sets) or imports a shared `config/routing-table.json`.
   - `config/task-router.yaml` → subordinate second-stage router: input = pipeline template chosen by `primary.md`; output = WHAT executes (pipeline/agent/stage) + model-requirement reference. Never re-decides intent. Documented, not retired (retirement would change `aiw-run`/`orchestrate-workers` launch path).
   - `task-intelligence-wrapper.js` / `safety-detector.js` → remain observe-only signal producers; never route.
3. **Files to modify (BLOCKED until G0 close / P2 auth):** `.opencode/agent/primary.md` (triggers), `AGENTS.md` (table), `scripts/log-shadow-observation.js` (legacyRoute), `config/task-router.yaml` + `scripts/task-router.js` (precedence wiring), any shared `config/routing-table.json` creation + codegen wiring.
4. **Files to retire / convert:** none retired now. Target: `AGENTS.md` table + `legacyRoute()` converted to generated projections; `task-router.yaml` header converted to subordinate-router declaration (doc-only change, still BLOCKED because even comment edits to bound router files risk window-stale disputes — done via `docs/routing-authority.md` instead).
5. **Migration steps (post-G0):** (a) extract canonical `config/routing-table.json` from `primary.md`; (b) add `scripts/sync-routing-table.js --check/--write` (same pattern as `sync-opencode-models.js`); (c) regenerate `AGENTS.md` section + `legacyRoute()` from it; (d) add subordinate header to `task-router.yaml`; (e) CI gate `--check`; (f) close old window, open new bound window (router hash changes).
6. **Tests required:** `scripts/check-routing-consistency.js` (report-only now) → promoted to fail-closed `--check` post-G0; `tests/test-routing-authority.sh` (SAFE now); future: sync-idempotence test, trigger-parity test, bypass-attempt test (keyword-avoidance, substring, ordering).
7. **Governance boundary:** SAFE now = new files only (`docs/routing-authority.md`, `scripts/check-routing-consistency.js`, `tests/test-routing-authority.sh`). BLOCKED now = any edit to the 7 router files, any new enforcement, `FLAG_FLOOR_ENFORCE` / `FLAG_ADAPTIVE_ROUTER` stay `false`.
8. **Rollback:** delete new files only. No existing file touched → nothing to roll back in runtime.
9. **Token/complexity reduction:** no runtime reduction now. Post-G0 single table eliminates 4-way manual sync (≈200 lines of duplicated trigger lists) and one class of divergence bugs.
10. **Now vs blocked:** NOW = authority doc + consistency reporter + regression test. BLOCKED = canonical JSON, codegen, enforcement design activation, non-bypassable floor layer.

Future non-bypassable layer (designed, NOT activated): detector floor (`GOVERNED`) + `policy-gateway` + `workflow-state` entry guard force the stronger pipeline even when keywords are avoided — requires `FLAG_FLOOR_ENFORCE=true` + `FLAG_ADAPTIVE_ROUTER=true` + new window + promotion gates. Documented in `docs/routing-authority.md`.

## Area 2 — Spec-driven physical traceability

1. **Current authority:** in-memory `req_task_map` from `feature-planning` Step 7c + draft `work-items/features/FEATURE-*/{request,plan,tasks,status}.md` (gitignored content) + schemas in `docs/spec-artifact.md`, `docs/rtm-schema.md`, `docs/work-item-foundation.md`. No `specs/` dir. `artifacts/spec-*.md`, `rtm-*.json`, `exports/*`, `cases/*` all absent/empty.
2. **Target authority:** `specs/FEATURE-NNN-slug/` 8-file layout is the authoritative execution history. `work-items/` = intake/backlog queue. `artifacts/` = immutable generated evidence (snapshots, RTMs, reports). One direction only: intake → specs → artifacts. This separation fits: `feature-planning` already creates feature folders; `case-store` already writes immutable case chains; `work-item-exporter` already treats `exports/` as derived output. No component assumes `work-items/` is authoritative history.
3. **Files to modify (BLOCKED until G0 close or explicit scope approval):** `.opencode/skills/feature-planning/SKILL.md` (write `specs/` instead of/also `work-items/`), `work-items/README.md` (responsibility rewrite), `.gitignore` (track `specs/`, keep `work-items/` ignored), `docs/work-item-foundation.md` (FSM scope note), any backfill migration script.
4. **Files to retire / convert:** none retired. `work-items/features/*/` stays as intake; `FEATURE-TEMPLATE/` stays until migration. `status.md` checkbox pattern superseded by `progress.md` append-only log (template-level, future).
5. **Migration steps (post-approval):** (a) freeze `FEATURE-TEMPLATE`; (b) add `specs/` writer to `feature-planning` Step 7c (dual-write, then cutover); (c) backfill script `scripts/backfill-specs.js` (FEATURE-001…019 → `specs/`, preserving IDs, marking unverifiable fields `unknown`); (d) RTM generator writes `specs/<slug>/verification.md` slice; (e) `work-item-lifecycle-guard` extended to specs transitions; (f) CI: `specs/` schema check.
6. **Tests required:** `tests/test-specs-structure.sh` (SAFE now — template + README presence); future: schema test (8 files, REQ IDs stable, `req_ids` column), RTM-link test, reconstructability test (new agent answers 9 questions from `specs/` alone).
7. **Governance boundary:** SAFE now = new `specs/README.md` + `specs/TEMPLATE/` 8 files (proposal, unwired, no consumer reads them). BLOCKED now = writer changes, backfill, `.gitignore` changes, FSM changes.
8. **Rollback:** delete `specs/` dir. No existing file touched.
9. **Token/complexity reduction:** none now. Post-migration: single `tasks.md` (stop duplicating tasks table in `plan.md`), refs+hashes instead of pasted payloads, `req_task_map` on disk instead of re-derived per session.
10. **Now vs blocked:** NOW = template + README + structure test. BLOCKED = writer, backfill, enforcement, gitignore policy.

## Area 3 — Token optimization consolidation

1. **Current authority:** none — 5 conflicting tier tables (`system-state-schema.json`, `context-memory`, `pipeline-schema.json` + `full-pipeline.json`, `knowledge/context-compressor.md`, `docs/context-engineering.md`) + executable `.opencode/skills/context-compressor/SKILL.md` vs reference `skills/knowledge/context-compressor.md` + stale `skills/memory/context-protocol.md` pointer.
2. **Target authority:** `config/token-budget.json` (single canonical budget model: tiers, trigger percent, externalize threshold, per-step budgets, cache policy) → generated projections into `pipeline-schema.json` / pipeline JSONs / docs tables. Executable `context-compressor/SKILL.md` stays the only executor; knowledge doc becomes pointer. Configuration over hard-coded tables.
3. **Files to modify (BLOCKED):** `skills/schema/pipeline-schema.json`, all `skills/pipelines/*.json` token blocks, `.opencode/skills/orchestrator/SKILL.md` (Steps 3b/3b2/3b6/3i/3k: project_context injection, CONSTITUTION double-read, snapshot payloads), `docs/context-engineering.md` (tier tables), `context-memory/SKILL.md`, `session-insights` baseline seeding.
4. **Files to retire / convert:** `skills/knowledge/context-compressor.md` tier table → pointer to canonical config; stale `context-protocol.md` reference removed; `cost-estimator` renamed or disambiguated vs `infrastructure-cost-estimator` (registry description change, BLOCKED as skill metadata change — do via plan only now).
5. **Migration steps (post-G0):** (a) ratify `config/token-budget.json` values (start from current `pipeline-schema.json` tiers as v1 to avoid behavior change); (b) codegen `scripts/sync-token-budget.js --check/--write`; (c) orchestrator: inject `project_context` once + stub refs, single CONSTITUTION reader, snapshot refs+hashes; (d) seed `baseline_tokens_per_session` writer; (e) CI gates.
6. **Tests required:** future: budget-presence test, tier-parity test, snapshot-size test, no-double-read test, baseline-seeded test. None added now except structure presence (token-budget.json exists, unwired — asserted by plan, not by test, to avoid locking values prematurely).
7. **Governance boundary:** SAFE now = new `config/token-budget.json` proposal file, consumed by nothing, wired to nothing. BLOCKED now = any edit to tier tables, orchestrator steps, schema, docs tables.
8. **Rollback:** delete `config/token-budget.json`. No consumer → zero blast radius.
9. **Token/complexity reduction (expected, post-migration):** project_context once (≈2–4K × N skills saved per run); single CONSTITUTION parse; snapshot refs (≈10× smaller snapshots); stub refs for >8K payloads already partially live — canonical config removes drift risk, not new savings by itself.
10. **Now vs blocked:** NOW = canonical proposal file. BLOCKED = everything wired.

## Cross-cutting rule

**One authority → generated projections/adapters → consumers.** No new manually-maintained copy of any rule is introduced by this plan. All three areas add proposal/observer files only; codegen + enforcement are post-G0.

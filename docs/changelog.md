# Changelog

All notable changes to this project will be documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

_Add upcoming changes here before they ship._

---

## [3.1.0] — 2026-07-03

### Added

- **TASK-0067** — `orchestrator` v2.0.0→v2.4.0: Anthropic prompt-cache breakpoint injection (Step 3b4) — marks static SKILL.md prefix with `cache_control: {type: "ephemeral", ttl: "1h"}` per invocation; 90% read-hit cost reduction. New inputs: `cache_control_strategy`, `budget_forcing_enabled`. New outputs: `prompt_cache_stats`, `externalized_artifacts`, `active_batches`, `pending_batches`.
- **TASK-0067** — `behavioral-telemetry-collector` v1.2.0→v1.3.0: `api.cache_hit` event type (9th) with `cache_creation_tokens` + `cache_read_tokens` fields; `batch.submitted` event type (10th) with `batch_id`, `batch_custom_id`, `estimated_saving_pct` fields.
- **TASK-0067** — `session-insights` v1.2.0→v1.3.0: `prompt_cache_efficiency` sub-block in `token_efficiency` — `total_cache_hits`, `total_cache_misses`, `cache_creation_tokens`, `cache_read_tokens`, `estimated_savings_pct` derived from `api.cache_hit` events.
- **TASK-0068** — `orchestrator` Step 3b5: Token budget forcing — prepends `[TOKEN BUDGET: ...]` instruction before each skill invocation (exempt: code-generator, design-system-generator, test-generator, mutation-test-generator, documentation-generator, adr-generator). `max_output_tokens` field added to orchestrator, btc, and session-insights in `index.yaml`.
- **TASK-0069** — `orchestrator` Steps 3b6–3b7: Artifact externalization — payloads > 8 000 tokens with eligible `content_type` are written to `.opencode/state/artifacts/<id>.json` and replaced in-context with a `ExternalizedPayloadStub`; estimated 60–80% context reduction for large code/doc artifacts.
- **TASK-0070** — `orchestrator` Step 3k + Step 7 batch reconciliation: Anthropic Batch API routing for 5 eligible non-blocking skills; 50% cost reduction; gate-conflict guard enforces `sync_override` when a batch-eligible skill is in a gate dependency chain.
- **TASK-0070** — `full-pipeline.json` v3.2.0→v3.3.0: `batch_policy` block (disabled by default) + `externalize_threshold: 8000` in `token_policy`.

### Changed

- `skills/graph/skill-graph.yaml` + website mirror: SKL-010 v1.2.0→v2.4.0, SKL-047 v1.1.0→v1.3.0, SKL-048 v1.1.0→v1.3.0.
- `skills/index.yaml`: orchestrator→2.4.0, behavioral-telemetry-collector→1.3.0, session-insights→1.3.0.

---

## [3.0.0] — 2026-07-02

### Added

- **TASK-0063** — New skill: `multi-agent-debate` v1.0.0 — adversarial Architect vs. Reviewer
  debate loop. Runs up to `max_rounds` critique cycles; produces a `final_architecture` artifact
  hardened by consensus, a full `debate_transcript`, and `unresolved_concerns[]` passed as
  `architecture_risks[]` to feature-planning. Enabled by `pipeline_config.debate_architecture: true`.
  Quality-scored 87/100; registered as SKL-108 in `skills/index.yaml`.
- **TASK-0064** — Durable async job registry in `orchestrator` v2.0.0 (Step 3j): every async
  skill dispatch creates a `job_registry[]` entry with idempotency key, retry policy (max 3,
  exponential backoff), and completion callbacks. Step 7 durable job reconciliation added.
  New inputs: `query_async_jobs`. New output: `job_registry[]`.
- **TASK-0065** — Pipeline warm-start from HITL gate snapshot: `orchestrator` v2.0.0 adds
  `warm_start` input with three intents (`re_run_from_snapshot`, `modify_and_continue`, `branch`).
  Content-hash guard prevents restoring a stale snapshot when inputs have changed. Snapshot
  selection menu presented at every HITL gate. New output: `warm_start_result`.
- **TASK-0066** — Token efficiency observability loop across four skills:
  `behavioral-telemetry-collector` v1.2.0 adds `skill.tokens_consumed` event type;
  `session-insights` v1.2.0 adds `token_efficiency` block to session summary;
  `enhancement-dashboard` v1.1.0 adds Token Efficiency tab (6th section);
  `adaptive-proposal-generator` v1.1.0 adds 3 new token-efficiency proposal types
  (`model_tier_downgrade`, `output_pruning_candidate`, `compression_policy_tighten`).
  `orchestrator` fires `skill.tokens_consumed` event fire-and-forget after every skill invocation.
- `full-pipeline.json` v3.1.0 → v3.2.0: optional `phase-2a-debate` phase added with conditional
  HITL gate; enabled by `pipeline_config.debate_architecture: true`.
- `docs/context-engineering.md` v3.0.0: Token Efficiency Events, Durable Job Registry, and
  Warm-Start sections added.

### Changed

- `orchestrator` SKILL.md v1.6.0 → v2.0.0: warm-start intents (Step 2), durable job registry
  (Step 3j), token event hook (Step 3c3), job reconciliation (Step 7).
- `skills/index.yaml`: `orchestrator` → 2.0.0; `behavioral-telemetry-collector` → 1.2.0;
  `session-insights` → 1.2.0; `enhancement-dashboard` → 1.1.0;
  `adaptive-proposal-generator` → 1.1.0; `multi-agent-debate` SKL-108 added.
- `skills/registry.json`: `multi-agent-debate` entry added; `realtime-system-architect` name
  field restored; `adaptive-proposal-generator` version synced to 1.1.0.

---

## [2.3.0] — 2026-07-02

### Added

- **TASK-0060** — Artifact envelope: all inter-skill data transfers now wrapped in a typed
  `Artifact` envelope (`artifact_id`, `source_skill`, `target_skill`, `content_type`,
  `payload`, `token_count`, `compressed`, `schema_version`). Enables exact per-transfer token
  accounting — foundation for Phase 7 TASK-0066 token observability.
- **TASK-0062** — Pipeline snapshot API: named snapshots automatically taken after every
  approved HITL gate. Snapshots are durable (persisted to session files) and enable
  `restore_from_snapshot` across session boundaries. Max 10 snapshots per project with LRU
  eviction. Foundation for Phase 7 TASK-0065 warm-start.
- **TASK-0061** — `work-item-exporter` v2.1.0: new `mode=webhook` for event-driven
  Jira/GitHub/Linear integration. Validates HMAC signatures (Step 13), parses events (Step 14),
  maps to sync/export operations (Step 15), dispatches automatically (Step 16). Rate limit:
  10/min. `issue_deleted` events are HITL-gated — no auto-deletion of local work items.
- **TASK-0059** — `context-memory` v2.0.0: three-tier memory model (Working / Session /
  Archival) inspired by Letta (MemGPT). Archival memory is cross-session and project-scoped.
  New inputs: `operation`, `tier`, `project_id`, `memory_blocks`, `inherit_from`,
  `clear_tier_scope`. Expected savings: ~40,000 tokens on second pipeline run for same
  project (architecture phase skipped via archival). v1.0.0 backward-compat shim included.
- `docs/context-engineering.md` v2.3.0: new sections — Artifact Envelope, Pipeline Snapshot
  API, Cross-Session Memory (Archival).

### Changed

- `orchestrator` SKILL.md v1.5.0 → v1.6.0: artifact envelope wrapping (Step 3b3), snapshot
  write after HITL approval (Step 5), `restore_from_snapshot` input, `snapshots[]` and
  `artifact_log[]` added to outputs.
- `skills/index.yaml`: `orchestrator` → 1.6.0; `context-memory` → 2.0.0;
  `work-item-exporter` → 2.1.0.

---

## [2.2.0] — 2026-06-30

### Added

- **TASK-0054** — `full-pipeline.json` v3.0.0 → v3.1.0: `design-system-generator` and
  `dependency-analyzer` merged into a single `phase-2c-design-and-graph` parallel group.
- **TASK-0055** — `orchestrator` v1.4.0 → v1.5.0: lazy SKILL.md section loading (Step 3b2)
  — only mandatory sections loaded per invocation; conditional sections loaded on demand.
- **TASK-0056** — `orchestrator`: `resume_from_phase` input + phase checkpoints written after
  each approved HITL gate.
- **TASK-0057** — `orchestrator`: invocation memoization cache (Step 3c) — SHA-256 input hash,
  50-entry LRU, Required Context invalidation.
- **TASK-0058** — `orchestrator`: `async_task_registry` — async skill dispatch registration
  and Step 7 reconciliation.
- `skills/index.yaml`: `orchestrator` → 1.5.0.

---

## [2.1.0] — 2026-06-28

### Added

- **TASK-0049** — `token_policy` block added to all 21 pipeline templates; `resumable` and
  `token_policy` properties added to `pipeline-schema.json`.
- **TASK-0050** — `work-item-exporter` pin in `full-pipeline.json` corrected: `^1.0.0` → `^2.0.0`.
- **TASK-0051+0053** — `orchestrator` v1.3.0 → v1.4.0: output-field pruning (Step 3b/b2) and
  `compress_after_handoff` (Step 3i). Expected 40–60% reduction per inter-skill handoff.
- **TASK-0052** — `opencode.json`: `analyzer`, `impact-analyzer`, `deployer` agents changed to
  `claude-haiku-4.5` for cost optimisation. Safety-critical agents (reviewer, security-specialist,
  recovery) remain on sonnet.
- `skills/index.yaml`: `orchestrator` → 1.4.0.

---

## [1.1.0] — 2026-06-28

### Added

- `feature-planning` v2.1.0: always-on Step 7c — materializes `work-items/features/FEATURE-{NNN}-{slug}/`
  folders (`request.md`, `plan.md`, `tasks.md`, `status.md`) for every requirement; rebuilds
  `work-items/indexes/features.md`; populates `work_items.items[]` in state with FEATURE entries.
- `feature_folders[]` and `feature_count` fields added to `feature-planning` output schema (required).
- Enhancement roadmap documented in `docs/enhancements/` — 3-phase plan (v1.1.0 → v2.0.0).

### Changed

- `opencode.json`: `planner` agent `edit` permission changed `deny` → `ask` to allow Step 7c file writes.
- `full-pipeline.json`: `feature-planning` minimum version pinned from `^2.0.0` → `^2.1.0`.
- `skills/index.yaml`: `feature-planning` version updated to `2.1.0`.

### Fixed

- Step 7c `file_path` in state entry corrected: now points to `request.md` (was directory path),
  preventing spurious "file missing" warnings in `work-item-exporter`.
- Step 7c `features.md` rebuild rewritten as idempotent read→merge→write: existing index rows are
  preserved and merged with new rows on every re-run; no rows are ever dropped.
- `full-pipeline.json` version pin updated so deployments always use Step 7c-capable skill.

---

## [1.0.0] — 2026-06-27

### Added

- Initial public release of the AI Workflow framework
- 101 production-ready skills across 19 domains
- 21 pipeline templates (full pipeline, pre-deploy, quick-review, and more)
- 19 specialized agents with complete instruction sets
- Complete documentation suite: architecture, governance, how-to-use, models, MCP, security, and more
- `scripts/validate-skills.sh` — validates all SKILL.md files and pipeline schemas
- GitHub Actions CI workflow for automated skill validation
- Next.js documentation website with live skill browser, pipeline viewer, and agent explorer
- `work-items/` structure for tracking features, bugs, and tasks
- `graphify` integration for codebase knowledge graph

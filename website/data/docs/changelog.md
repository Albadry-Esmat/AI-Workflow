# Changelog

All notable changes to this project will be documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

### Added

- **`aiw uninstall <path>`** — removes AI Workflow from a project (reverses `aiw init`). Supports `--force`, `--backup`, `--dry-run`, `--clean-graph` flags. Never deletes `.env`.
- **Delegate skill (SKL-120)** — formal protocol for intra-pipeline task delegation with scoped context, success criteria, turn limits, and audit trail. Prevents ad-hoc agent-to-agent handoff sprawl.

---

## [4.0.0] — 2026-07-14

### Breaking Changes

- **Pipeline mode switch** — `full-pipeline.json` now supports `pipeline_config.pipeline_mode: "specialized_review"` (new default path) and `"legacy_dual_planner"` (v3.9.x behaviour). Set `legacy_dual_planner` to preserve previous behaviour.
- **HITL gates reduced from 18 to 4 mandatory** — `hitl_preset: "full"` restores all 18 legacy gates.

### Added

- **Phase 9 review pipeline optimization (TASK-0071–TASK-0080)** — complete overhaul of the planning-to-implementation path:
  - **TASK-0071** — 4 specialized parallel reviewers (`architecture-reviewer`, `security-reviewer`, `performance-reviewer`, `maintainability-reviewer`) replace dual-planner consensus. Reviewers run in parallel after planning; each produces typed `ReviewFinding[]` objects. Guardrail: reviewers cannot emit a replacement plan — orchestrator strips `proposed_plan` fields and logs violations.
  - **TASK-0072** — `ReviewFinding` schema (`skills/schema/review-finding.schema.json`): typed findings with `finding_id` (pattern `RVW-{REVIEWER}-{NNNN}`), `issue_fingerprint` (sha256 dedup key), severity, category, typed evidence, confidence score. `proposed_plan` field is schema-forbidden.
  - **TASK-0073** — Deterministic validation checklist engine replaces consensus scoring: 7 hard checks (fail = REJECTED) + 6 soft checks (fail = CONDITIONALLY_APPROVED). Max 3 revision cycles before HITL escalation (GATE-ESC-001).
  - **TASK-0074** — Conditional scoped debate: debate is only triggered per section when `confidence < 0.5`, ≥2 reviewers have contradictory findings, or unresolved critical findings exist. All other sessions emit `debate_skipped` event — eliminating unnecessary debate overhead.
  - **TASK-0075** — Research moved before reviewer dispatch: `phase-4b-research` triggers on planner uncertainty markers (`TBD`, `UNVERIFIED`, `ASSUMPTION`, etc.) and new external dependencies. Research appendix injected into all reviewer contexts.
  - **TASK-0076** — Implementation contract freeze (`phase-4i-contract-freeze`): generates an immutable `ImplementationContract` (UUID, SHA-256 hashes using RFC 8785 canonical form, per-section content hashes, 72h expiry, implementation rules derived from findings). Stored at `artifacts/contracts/contract-{uuid}.json`.
  - **TASK-0077** — Change request workflow (`change-request-handler`): implementation agents can submit a `ChangeRequest` against a frozen contract. Only affected streams are paused. Targeted reviewer dispatch runs for affected sections only. Approved CRs increment the contract version. Maximum 3 CRs per contract.
  - **TASK-0078** — HITL gate rationalization: 18 gates reduced to 4 mandatory + conditional set: GATE-001 (cost estimate), GATE-002 (architecture/validation, conditional on critical findings or hard check failures), GATE-003 (release readiness), GATE-004 (production deployment, non-bypassable). `hitl_preset: "full"` restores legacy 18-gate config.
  - **TASK-0079** — Section-level confidence reporting: `confidence = 1.0 - sum(penalties)` per section. Penalties: critical=0.30, high=0.15, medium=0.05, low=0.02. `plan_confidence = min(non-outlier section confidences)`. Sections < 0.7 flagged `needs_attention`; sections < 0.3 flagged as blocking.
  - **TASK-0080** — Decision log schema (`skills/schema/decision-entry.schema.json`): planner records `DecisionEntry` objects for all technology, architecture, data store, protocol, security, and deployment choices. Append-only. Entries include ≥2 options with pros/cons, rationale, evidence, and `supersedes` chain.
- **New schemas**: `review-finding.schema.json`, `decision-entry.schema.json`, `implementation-contract.schema.json`, `change-request.schema.json`, `confidence-report.schema.json`, `validation-result.schema.json`, `feature-planning-output.schema.json`, `research-appendix.schema.json`, `debate-skipped-event.schema.json`
- **New SKILL.md files**: `confidence-scorer`, `finding-aggregator`, `validation-checklist-engine`, `contract-freezer` (all deterministic, no LLM call)

### Changed

- `full-pipeline.json` bumped to **v4.0.0** with 8 new phases: `phase-4b-research`, `phase-4c-reviewer-dispatch`, `phase-4d-confidence-scoring`, `phase-4e-conditional-debate`, `phase-4f-finding-aggregation`, `phase-4g-change-requests`, `phase-4h-validation`, `phase-4i-contract-freeze`
- `phase-8-repair` and `phase-8d-defect-management` conditions fixed (`OR` → `||`)
- `review-finding.schema.json`: `reviewer_type` enum now correctly includes `architecture` and `maintainability` (was: `ux` and `clean_code`); `finding_id` pattern widened to `[A-Z]{3,6}` (was `[A-Z]{3}`)
- `implementation-contract.schema.json`: added `status`, `version`, `sections`, `expiry`, `approved_at`, `supersedes_contract_id`, `change_requests`, `implementation_rules` fields; language enum expanded to include `javascript`, `kotlin`, `swift`, `dart`, `csharp`, `cpp`

---

## [3.9.0] — 2026-07-14

### Added

- **Plan → Review → Implement enforcement** — `full-pipeline.json` now has a mandatory `human_approval` gate after `phase-5-impact` (impact analysis) and before `phase-6-execution` (code generation). Gate is `bypass_on_timeout: false` (fail-closed). CI bypass requires both `ci_mode: true` AND a valid `pre_approved_plan_ref` (sha256 signed, run-scoped, TTL 72h).
- **Dual-model planning debate** (`pipeline_config.debate_plan: true`) — two `feature-planning` instances run in parallel (Model A: Strategic Planner, Model B: Pragmatist Planner) with context isolation enforced by `orchestrator_context_isolation`. After both complete, `plan-debate` skill runs symmetric cross-review across 10 planning criteria, max 3 rounds, consensus threshold 0.80. Research escalation on per-criterion stalemate (one call per unique stale criterion). HITL gate fires when consensus not reached.
- **`plan-debate` SKILL.md** — 461-line specification with full execution logic, pass-sticky rule, early-exit on consensus, per-round 120s timeout, research queue abandonment, MERGE option (human-authored with re-entry into scoring), and CI bypass contract.
- **`phase-4-planning-b`** — second independent planning phase with Pragmatist persona and context isolation audit log.
- **`phase-4b-plan-debate`** — plan consensus phase producing `consensus_plan` artifact.

### Changed

- `full-pipeline.json` bumped to **v3.9.0**
- `parallel_groups` updated: added `["phase-4-planning", "phase-4-planning-b"]` and `["architecture-reviewer", "security-reviewer", "performance-reviewer", "maintainability-reviewer"]`



### Added

- **`aiw` CLI** — branded entry point with 18 commands (`start`, `run`, `doctor`, `validate`, `lint`, `status`, `init`, `backup`, `reset`, `sync`, `graph`, `logs`, `version`, `help`, and more). Replaces raw `make` commands with a discoverable CLI.
- **`aiw start <path>`** — run the AI Workflow while targeting a different project directory. Agents and skills load from the AI-Workflow folder; file reads/writes go to the target project.
- **`aiw init <path>`** — copy the full AI Workflow config (`opencode.json`, `.opencode/`, `.env`) into any project, making it self-contained.
- **`.nvmrc`** — pins Node.js 20 LTS for all contributors and CI.
- **`package-lock.json`** — root lockfile with 0 vulnerabilities.
- **`.github/dependabot.yml`** — weekly automated dependency updates for `github-actions` and `npm`.
- **`Production-Readiness-Checklist.md`** — 139-item, 14-category audit checklist.
- **`Production-Readiness-Action-Plan.md`** — step-by-step remediation plan for all audit findings.

### Fixed

- **`scripts/validate-skills.sh`** — syntax error on line 417 (`"else` on same line as string literal).
- **`AGENTS.md`** — all 22 pipelines now have routing entries (was 6/22 reachable).
- **`skills/schema/system-state-schema.json`** — added 10 missing pipeline names to the `pipeline_name` enum.
- **`scripts/reset.sh`** — removed `.env` deletion; tokens are always preserved on reset.
- **`docs/README.md`** — escaped placeholder link example to prevent broken-link CI failure.
- **`docs/versioning.md`** — fixed dead link to `skills/governance/versioning.md` → correct `.opencode/skills/versioning/SKILL.md` path.
- **`.github/workflows/validate-skills.yml`** — added `permissions: contents: read` and pinned all action versions.
- **README, CONTRIBUTING, docs/how-to-use.md** — replaced `your-org` placeholder git URLs with `Albadry-Esmat/AI-Workflow`; updated commands to use `aiw`.
- **`.env.example`** — updated token instructions: classic PAT, no expiration.
- **`docs/github-export.md`** — removed 90-day expiry recommendation; classic PAT with no expiration is now the documented default.

---

## [3.3.1] — 2026-07-09

### Fixed

- **`opencode.json`**: Disabled `fetch` MCP server (`enabled: false`). `@modelcontextprotocol/server-fetch` does not exist on npm (404). The only similarly-named package on npm (`mcp-server-fetch@0.0.2`) is an explicitly labelled security-research canary / npx-confusion attack — must not be used. The entry is kept as a placeholder for when the official Node.js fetch server is published.

---

## [3.3.0] — 2026-07-05

### Fixed (Production-Readiness Pass — Second Round)

- **`skills/graph/skill-graph.yaml`**: Corrected 5 stale version entries — `feature-planning` 2.0.0→2.2.0, `skill-authoring` 1.1.0→1.2.0, `context-memory` 1.0.0→2.0.0, `enhancement-dashboard` 1.0.0→1.1.0, `work-item-exporter` 1.0.0→2.1.0.
- **`skills/graph/skill-graph.yaml`**: Promoted 43 skills (SKL-065 through SKL-107) from `status: draft` → `status: active`. All have complete, validated SKILL.md files and 27 are directly assigned to production agents in `opencode.json`.
- **`skills/graph/skill-graph.yaml`**: Fixed two wrong edge IDs — `SKL-029→SKL-069` corrected to `SKL-027→SKL-069` (adr-generator, not code-repair); `SKL-027→SKL-073` corrected to `SKL-026→SKL-073` (code-generator, not adr-generator). Also fixed the reverse `SKL-069→SKL-029` composition edge to `SKL-069→SKL-027`.
- **`skills/registry.json`**: Removed spurious `phase: 8` and `req_id: "N62"` fields from `realtime-system-architect` entry (not part of the registry schema).
- **`skills/registry.json`**: Fixed broken version constraint `code-generator@^1.4.0` → `code-generator@^1.1.0` (code-generator is at v1.1.0; ^1.4.0 would never resolve).
- **`skills/index.yaml`**: Fixed SKL-069 `depends_on` — replaced `SKL-029` (code-repair) with `SKL-027` (adr-generator). Fixed SKL-073 `depends_on` — replaced `SKL-027` (adr-generator) with `SKL-026` (code-generator).
- **`scripts/lib/common.sh`**: `warn()` now writes to stderr (`>&2`) — warnings no longer pollute stdout pipelines.
- **`scripts/lib/common.sh`**: `load_env()` allexport leak fixed — added `|| true` to `source` call so that `set +o allexport` is always reached even when source fails under `set -e`.
- **`scripts/health-check.sh`**: Added missing `-e` flag — changed `set -uo pipefail` to `set -euo pipefail` so errors in health check functions abort the script.
- **`scripts/setup.sh`**: Added `mkdir -p "$HOOKS_DIR"` before writing the pre-commit hook — prevents failure on repositories where `.git/hooks/` doesn't yet exist.
- **`rebuild.sh`**: Added `trap 'kill "$SERVER_PID" 2>/dev/null; exit' INT TERM` — server process is now killed on Ctrl+C or SIGTERM instead of leaking on the port.
- **`.github/workflows/validate-skills.yml`**: Check 4 `find` now includes `2>/dev/null` to suppress permission errors. Check 6 `GRAPH_NODES` extraction now includes `2>/dev/null || echo 0` fallback and a guard `GRAPH_NODES="${GRAPH_NODES:-0}"` to prevent unbound variable failures if `skill-graph.yaml` is missing.
- **`scripts/validate-skills.sh`**: Added YAML parse check 0/10 matching CI check 0/10 — local validation now runs all 10 checks (0–9) instead of 9 (1–9).
- **`scripts/cleanup-sessions.sh`**: Fixed word-splitting in display loop — changed `echo "$EXPIRED_FILES" | while read -r f` to `while IFS= read -r f; do ... done <<< "$EXPIRED_FILES"` for consistent handling of filenames with special characters.
- **`docs/models.md`**: Corrected 3 wrong agent model assignments — `analyzer` and `impact-analyzer` changed from `claude-sonnet-4.6` to `claude-haiku-4.5`; `deployer` changed from `claude-sonnet-4.6` to `claude-haiku-4.5` (matching actual `opencode.json` values).
- **`docs/skills-registry.md`**: Updated skill count from 101 to 102 in the index layer table. Fixed 11 stale `skills/<domain>/<name>.md` path references to use the correct `.opencode/skills/<name>/SKILL.md` format. Updated 5 version numbers to match current skill versions. Converted two broken ADR hyperlinks (`ADR-0001`, `ADR-0002`) to plain text placeholders to prevent CI broken-link failures.
- **`docs/security.md`**: Updated Agent Permissions table — `Subagents` row split into read-only and write-enabled groups reflecting actual `opencode.json` permissions. Fixed stale skill path reference. Bumped version 1.0.0 → 1.2.0.
- **`docs/architecture.md`**: Bumped stale version header from 2.2.0 to 5.3.0; updated date to 2026-07-05.
- **`AGENTS.md`**: Added Pipeline Routing Table — maps trigger keywords to pipeline template files and entry agents. This table was previously only documented in the system prompt, leaving it undocumented at the project level.
- **`package.json`**: Added `"graph": "graphify update ."` npm script — provides `npm run graph` alias consistent with `make graph`.

---

## [3.2.0] — 2026-07-03

### Added

- **Infrastructure** — `.env.example`: Complete environment variable template with inline documentation for every variable. Resolves the critical onboarding gap where `cp .env.example .env` was documented but the file did not exist.
- **Infrastructure** — `Makefile`: Primary developer CLI entry point. Provides `make setup`, `make health`, `make validate`, `make sync`, `make graph`, `make clean`, `make reset`, `make update`, `make website`, `make sessions`, `make sessions-delete`, and `make help`.
- **Infrastructure** — `scripts/setup.sh`: Single-command project setup. Checks prerequisites, installs `ajv-cli`, installs `.opencode/` npm packages (skips if already done), creates `.env` from template, creates required runtime directories, and runs health check.
- **Infrastructure** — `scripts/health-check.sh`: Environment validation script. Checks required tools, optional tools, `.env` existence, `GITHUB_TOKEN` (masked), optional env vars, `.opencode/node_modules`, skill count sanity, and `opencode.json` path integrity. Outputs PASS/WARN/FAIL with actionable guidance per item.
- **Infrastructure** — `scripts/sync-website-data.sh`: Automates the `website/data/` data sync. Copies `skills/`, `docs/changelog.md`, `opencode.json`, and all SKILL.md files to their `website/data/` mirror. Supports `--dry-run` and `--check` (CI mode) flags.
- **Infrastructure** — `scripts/clean.sh`: Removes build artifacts and cache files safely (website/.next/, graphify-out/cache/, dated graphify snapshots).
- **Infrastructure** — `scripts/reset.sh`: Resets workspace to clean state with confirmation prompt. Removes `.env`, session state, exports, and build artifacts. Accepts `--yes` to skip confirmation.
- **Infrastructure** — `scripts/lib/common.sh`: Shared bash utilities library. Provides color output (auto-disabled in CI/non-TTY), `ok/fail/warn/info/header/banner/step` helpers, `check_tool`, `require_tool`, `require_file`, `require_env`, `check_env`, and `load_env` functions. Sourced by all scripts.
- **Agents** — `.opencode/agent/data-engineer.md`, `api-designer.md`, `distributed-systems.md`, `cloud-platform.md`, `security-specialist.md`, `sre.md`: Created the 6 missing agent instruction files. All 19 agents now have `.opencode/agent/<name>.md` files, consistent with the convention documented in `docs/agents.md`.

### Changed

- **`package.json`**: Added `scripts` block with `npm run` aliases for all Makefile targets (`setup`, `health`, `validate`, `clean`, `reset`, `sync`, `website`, `sessions`, `sessions:delete`, `update`).
- **`rebuild.sh`**: Shebang changed from `zsh` to `bash` for cross-platform consistency. Port now reads `WEBSITE_PORT` env var (falls back to 3000). Added guard that exits with a clear message if `website/package.json` is missing. Added 30-second server readiness timeout.
- **`scripts/cleanup-sessions.sh`**: Now reads `SESSION_RETENTION_DAYS` env var as default retention window (overridable via `--days`). Sources `scripts/lib/common.sh` for consistent output. Updated header/help text.
- **`scripts/validate-skills.sh`**: Sources `scripts/lib/common.sh`. Added section numbering (`1/9` through `9/9`). Added actionable `Fix:` hint after every failure. Standardized SKIP output. Uses `find` instead of `ls` for portable directory counting.
- **`.github/workflows/validate-skills.yml`**: Added trigger on `scripts/**` path changes. Added checks 7/9 (registry.json↔skill-graph.yaml version consistency) and 8/9 (origin_metadata shape validation) — CI now runs all 9 checks matching the local validation script. Added third CI job `website-sync-check` that verifies key `website/data/` files are in sync with source. Docs link check now also covers `examples/` directory.
- **`docs/agents.md`**: Fixed stale model assignments in the JSON code block — `analyzer`, `impact-analyzer`, and `deployer` now correctly show `claude-haiku-4.5` (matching `opencode.json`). Added note that all 19 agents now have instruction files. Bumped version to 1.5.0.
- **`docs/how-to-use.md`**: Updated setup section to use `make setup`. Added Commands table. Updated debug table with new failure modes. Added env var configuration section. Bumped version to 2.3.0.
- **`README.md`**: Full rewrite. Updated skill count from 101 to 102 (SKL-001→SKL-108). Added Quick Start using `make setup`. Added Commands table. Added Configuration table. Added Troubleshooting section. Added Prerequisites table.
- **`CONTRIBUTING.md`**: Full rewrite. Setup section now uses `make setup`. Added complete step-by-step for adding skills (including registry.json, skill-graph.yaml, and sync steps). Fixed broken `.env.example` reference. Updated validation to use `make validate`. Fixed model tier documentation.

### Removed

- **`.opencode/opencode.json`**: Deleted stale duplicate of the root `opencode.json`. The opencode runtime reads from the project root. Eliminates the risk of the two copies diverging.

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

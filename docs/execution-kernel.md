# Execution Kernel (Phase 1 — P1 Baseline)

## Purpose
Durable, observable, enforced execution for one excellent adapter (OpenCode-local).
Declarative skills remain the contract; this kernel is the runtime that enforces them.

## Modules
- **M1 RuntimeAdapter** (`scripts/runtime-adapter.js`): `detect/start/send/interrupt/resume/evidence`. OpenCode-local hardened. Codex CLI stubbed for Phase 2.
- **M2 Checkpointer** (`scripts/checkpointer.js`): append-only JSONL under `.opencode/state/<thread>/checkpoint.jsonl`. `task()` idempotency via sha256 keys. Survives restart.
- **M3 Policy Gateway** (`scripts/policy-gateway.js` + `config/policy-gateway.yaml`): deny-by-default. `read/grep/glob/plan` on allowlisted paths only. `write/shell/git/deploy/network/secrets` require scoped approval (denied in P1 baseline). Parse errors fail closed.
- **M4 Trace Envelope** (`scripts/trace-envelope.js` + `config/trace-envelope-schema.json`): `{trace_id, thread_id, model/model_id/model_resolution, tool_calls, guardrail, handoff, ts}` → `trace.jsonl`. `model_id` is authoritative (precedence-resolved exact ID: agent/task override → global → runtime/session, verified against the live catalog); tiers are metadata only. OpenAI-evals compatible (traces first, datasets later).
- **M5 Task Router** (`scripts/task-router.js` + `config/task-router.yaml`): static `quick-fix→quick-review`, `feature-delivery→full-pipeline`, `release-review→pre-deploy` (each route references its `tasks.*` requirement; the model resolves via precedence in `config/model-requirements.yml`; `model_tier` is metadata only).
- **M6 Retrieval MVP**: `graphify query` passthrough, fallback `rg --files`. No embeddings (field evidence).
- **M7 Det Suite**: `tests/test-execution-kernel.sh` (12 checks, no network) + existing 20/20 quick-review suite in CI.

## Usage
```bash
aiw run --template quick-fix --path docs/a.md "fix typo"
aiw run --template feature-delivery --path skills/ "add retry"
aiw run --template release-review --path . "pre-deploy check"
aiw kernel-test
aiw plan "anything" --json   # fixed via js-yaml dep
```

Privileged example (denied in P1 without approval):
```bash
aiw run --template quick-fix --tool shell --path docs/a.md "run ls"
# -> denied: privileged tool requires scoped approval
```

## Evidence
Per thread under `.opencode/state/<thread>/`: `checkpoint.jsonl` + `trace.jsonl`. Adapter evidence level: `launch-only + file-checkpoints/traces (P1)`.

## CLI matrix (all popular CLIs)
| Adapter | Executable | Status | `aiw run --adapter` | Notes |
|---|---|---|---|---|
| OpenCode | `opencode` | hardened default | `opencode` | 75+ providers/BYOM, `serve :4096` |
| Codex CLI | `codex` | candidate | `codex` | OpenAI-only, `CODEX_HOME` isolation |
| Claude Code | `claude` | candidate | `claude-code` | `/login`, trust prompts honored |
| Copilot CLI | `copilot` | candidate | `copilot-cli` | `-p` non-interactive hook, org policies inherited |
| Antigravity | `agy` | candidate | `antigravity` | Google's current agent (replaces Gemini CLI); `AGENTS.md` respected |
| Cursor | `agent` | candidate | `cursor` | `-p`, `--mode`, `--sandbox`; version string recorded honestly (binary name collides) |
| Gemini CLI | `gemini` | legacy candidate | `gemini-cli` | kept for existing installs; prefer Antigravity |
| Aider | `aider` | candidate | `aider` | repo-scoped via gateway |
| Generic | user-defined | pass-through | n/a | no safety/evidence claims by design |

All adapters enforce gateway + checkpoint + trace. First-class status requires per-runtime fixtures (O0/O2 validators updated to the nine-adapter set).

## Phase 2 — Benchmark + second adapter (done)
- `evals/execution-kernel/cases/v1.json` (8 cases: normal/broken/security/PR) + `scripts/evaluate-execution-kernel.js` (`aiw benchmark --mode det` 8/8; `--mode live --adapter <id>` runs only against an authenticated runtime with its own auth, else `no-authenticated-runtime`). AIW holds zero model credentials — live executes through the runtime, never around it.
- `scripts/codex-adapter.js` (`aiw run --adapter codex`, CODEX_HOME isolation, launch-level evidence).
- Full policy v1.1 + `scripts/policy-approval.js` scoped single-use expiring approvals (`approve` → `check` consumes).
- `scripts/retrieve.js` `--retrieval deterministic|vector-trial` (trial recorded, deterministic returned).

## Phase 3 — Scale (done)
- `scripts/store.js` cross-thread KV (`aiw` via workers), `scripts/orchestrate-workers.js` (`aiw workers --parent … "t1" "t2"`), `scripts/serve-supervise.sh` (`aiw serve-supervise` probes :4096).

## Phase 4 — Release (done)
- `scripts/release-review.js` (`aiw release-review --yes` requires frontier mapping + green benchmark, fail-closed otherwise; attestation in store).
- `scripts/cost-dashboard.js` (`aiw cost-dashboard`: traces per tier + benchmark pass + det zero-token note; live usage comes from runtime-reported output only).
- **Auth model:** the runtime owns authentication, models, and billing. `scripts/runtime-auth.js` probes installed+authenticated state read-only. AIW never stores model credentials and never calls provider APIs.
- Kernel suite 21/21 (`aiw kernel-test`); repo suites preserved (194 + evals definitions).

## Rollback
Revert kernel commits + `rm -rf .opencode/state/thread-* .opencode/state/test-*`. Configs are additive; `aiw start` behavior unchanged unless `--template` is passed.

## Phase A — Canonical execution identity (attribution, not authorization)
- `scripts/execution-identity.js`: canonical envelope `{identity_version: 1, agent, principal {type, id, authenticated, source}, role, execution_id, parent_execution_id, worker, source}`. Principal shape reuses gate-decisions; role taxonomy is an explicit map (unmapped → null, never fabricated).
- Launcher assigns → downstream consumes: `aiw-run` builds launcher identity; `orchestrate-workers` runs the parent as `orchestrator` and mints distinct per-worker identities (`<parent>-w<i>`) with parent lineage. Adapters record `agent_identity` at start/send without rewriting; `live-dispatch` forwards it; `trace-envelope` strictly validates v1 envelopes and still accepts legacy `{agent}`-only records (classified via `describeIdentity`: canonical/legacy/unknown — legacy is never authorized).
- `policy-approval.approve()` requires a principal; humans are recorded exactly as claimed (`authenticated: false`, `source` preserved) — no authentication is performed or implied. No SoD/authorization rules are introduced in this phase.

## Phase B — Gate-decision authorization (high-stakes actions)
- `scripts/require-gate-decision.js`: single consumption path (resolve → kind/class/authority → single-use consumption log beside the registry). Registry logic itself is never duplicated.
- `release-review` requires `--yes` (intent only) + `--decision-id gd_...` (gate_id `release`, class `release`, `approve`, subject = derived repo HEAD, bound thread execution, authenticated-human principal, unexpired, unconsumed). Authorization runs AFTER the benchmark so red builds never burn single-use decisions. Attestation records decision/gate/subject/execution bindings + both principals + consumption timestamp.
- Classification: release attestation = HIGH-STAKES; ordinary privileged-tool approvals = NORMAL (scoped single-use tokens); live benchmark = READ-ONLY exempt (fixed read-only prompts, gateway-wrapped, no governed advancement; its report feeds release-review hash-bound); override acceptance via helper (class match + consumption), raw `resolveOverride` stays the read-only audit API.
- No production minter for authenticated-human decisions exists yet by design: high-stakes paths fail closed with guidance until an authorized minting mechanism arrives. Tests mint into isolated `AIW_GATE_REGISTRY` files (fixture-only).
- Policy approval (scoped tool use) vs gate decision (governance advancement) remain distinct mechanisms; an approval token never authorizes release.

## Phase C — Separation of duties (machine-enforced)
- `scripts/separation-of-duties.js`: single policy evaluator (`evaluate`, `validateReviewEvidence`). Independence is principal-based (`type:id`); role/execution/worker relabeling never confers independence. Stable reason codes (`SOD_PRODUCER_EQUALS_REVIEWER`, `SOD_PRODUCER_EQUALS_GATEKEEPER`, `SOD_REVIEWER_EQUALS_GATEKEEPER`, `SOD_UNKNOWN_REVIEWER_ROLE`, `SOD_UNKNOWN_GATE_ROLE`, subject/evidence codes).
- Roles: `REVIEWER_ROLES={reviewer}`, `GATEKEEPER_ROLES={gatekeeper}`; orchestrator in neither (coordinates only); unmapped → null → fail closed. Mapped: primary/orchestrator, reviewer+github-reviewer/reviewer, gatekeeper+merge-gatekeeper/gatekeeper, builder+test-generator/developer, analyzer/planner.
- Worker lineage: same-agent siblings (shared parent) are one actor → blocked; distinct-agent siblings (orchestrator-delegated) are independent; lineage reported for audit. No SoD override exists — remedy is a new independent review/gate.
- `requireGateDecision(..., sod?)` validates SoD BEFORE single-use consumption (failed checks never burn decisions). Release-review does not yet pass producer evidence (no trustworthy in-system source for HEAD producers yet) — wired in Phase D; the helper contract is proven by tests.
- Consumption log scoped per registry file (`<registry>.consumptions.jsonl`); sibling registries never share marks.

## Phase D — Fresh evidence, retry bounds, promotion enforcement
- Producer evidence (`scripts/producer-evidence.js`): launcher-recorded at dispatch completion (launcher-owned identity + derived HEAD; denied turns skipped). Subject-keyed append-only stores; deterministic principal sets; only `developer` role recorded (analysis/planning must not widen the producer set). Trust: system-generated only — no git-author/CLI/branch/prompt derivation.
- Review evidence (`scripts/review-evidence.js`): explicit records (claimed principals honest `authenticated:false`); never auto-recorded; latest approval per subject loadable.
- Freshness (`scripts/evidence-freshness.js`): central codes (`EVIDENCE_SUBJECT_MISMATCH`, `EVIDENCE_STALE`, `EVIDENCE_EXPIRED`, `EVIDENCE_UNATTRIBUTED`, `EVIDENCE_MALFORMED`, `EVIDENCE_MISSING`, `EVIDENCE_NOT_APPROVING`, `EVIDENCE_EXECUTION_MISMATCH`, `EVIDENCE_OK`). Approvals honor scope/expiry/single-use; benchmarks bind `repo_head_sha`; attestations immutable, non-reusable across subjects.
- Retry model: attempt = one execution try; retry = repeat of same objective (bounded by `MAX_FIX_CYCLES=3`, enforced in workflow-state; exhaustion must ESCALATE); recovery = resume same execution id (budgets preserved — no reset path exists); new execution = new id (subject-bound evidence persists). No automated retry loops exist around dispatch (locked by test).
- Release-review: subject → producer set → latest approval → freshness → gate → SoD → authority → consume → attest with full evidence graph. Missing/stale evidence fails closed pre-consumption. Enforcement boundary = attestation creation (repo performs no merge itself); case transitions remain transition-validated with atomic writes + optional evidence carriage.
- Retry terms: attempt/retry/recovery/new-execution defined above; budgets live in case state and survive recovery.

## Phase E — Findings lifecycle, waivers, freeze audit
- Findings (`scripts/finding-evidence.js`): single canonical format. Fingerprint = sha256(rule_id, target, checker) — stable across rewording/line shifts/retries; distinct problems never merge. Severity informational only; `blocking` boolean is the policy effect. Lifecycle OPEN/RESOLVED/WAIVED/SUPPRESSED via append-only per-fingerprint history (never rewritten); no auto-carry across subjects (rediscovery preserves lineage).
- Waivers: validated (not consumed) gate decisions, class security|completeness|governance-change, authenticated principal, fingerprint+subject+expiry scope, re-validated per advancement; waiving principal must be independent of producers/reviewer (self-waiver refused). Suppression is presentation-only (blocking findings stay blocking).
- Blocking computation (`blockingState`): `FINDINGS_CLEAR` or structured `FINDING_*` codes. Release-review evaluates all HEAD findings pre-consumption; structured findings override optimistic review outcomes.
- Registry hardening: `resolve()` fails closed on unreadable/corrupt state; `record()` refuses past corruption (`REGISTRY_CORRUPT`); consumption log unreadable → `replay-unverifiable` block.
- CLI audit: no `--ignore/--force/--skip/--override/--no-check/--allow` bypass flags; `--yes` is intent-only; `--audit-only` output has no advancement consumer (locked by test).
- `test-cli-security.sh` is portable (node permission check, no GNU stat).

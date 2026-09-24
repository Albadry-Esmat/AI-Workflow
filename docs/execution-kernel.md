# Execution Kernel (Phase 1 — P1 Baseline)

## Purpose
Durable, observable, enforced execution for one excellent adapter (OpenCode-local).
Declarative skills remain the contract; this kernel is the runtime that enforces them.

## Modules
- **M1 RuntimeAdapter** (`scripts/runtime-adapter.js`): `detect/start/send/interrupt/resume/evidence`. OpenCode-local hardened. Codex CLI stubbed for Phase 2.
- **M2 Checkpointer** (`scripts/checkpointer.js`): append-only JSONL under `.opencode/state/<thread>/checkpoint.jsonl`. `task()` idempotency via sha256 keys. Survives restart.
- **M3 Policy Gateway** (`scripts/policy-gateway.js` + `config/policy-gateway.yaml`): deny-by-default. `read/grep/glob/plan` on allowlisted paths only. `write/shell/git/deploy/network/secrets` require scoped approval (denied in P1 baseline). Parse errors fail closed.
- **M4 Trace Envelope** (`scripts/trace-envelope.js` + `config/trace-envelope-schema.json`): `{trace_id, thread_id, model, tool_calls, guardrail, handoff, ts}` → `trace.jsonl`. OpenAI-evals compatible (traces first, datasets later).
- **M5 Task Router** (`scripts/task-router.js` + `config/task-router.yaml`): static `quick-fix→cheap/quick-review`, `feature-delivery→balanced/full-pipeline`, `release-review→frontier/pre-deploy`.
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

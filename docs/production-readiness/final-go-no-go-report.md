# AI Workflow Final Go/No-Go Report

**Decision:** **NO-GO for general production; conditional GO for repository-side pilot preparation.**

**Release branch:** `release/production-hardening`  
**Release checkpoint:** `75492e9` — `docs: finalize multi-runtime certification status`
**Working tree:** clean at final verification  
**Date:** 2026-08-24

## Executive decision

The approved expert production plan, enhancement roadmap, and multi-runtime compatibility foundation have been implemented as far as repository-side controls can be completed without operator-owned credentials or real agent runtimes. The project now has a repeatable constrained-pilot preparation path, runtime MCP capability and approval guards, live budget accounting, formal event-schema validation, circuit-breaker behavior, sanitized checkpoints, deterministic website-publication idempotency and reconciliation, canary-only write planning, pilot-evidence validation, artifact quality scoring, disposable rollback rehearsal, compatibility-aware golden artifact contracts, a runtime-neutral adapter boundary, nine adapter projections, deterministic runtime projections, and a compatibility-matrix CI job.

The project must **not** be described as general-production-ready yet. The sandbox cannot honestly provide evidence for the actual OpenCode executable, real credentials, MCP startup, live model execution, non-sensitive pilot completion, independent security review, or operator recovery in the real environment. Those remain release gates rather than simulated test results.

## Completed repository controls

| Control area | Evidence |
|---|---|
| Governance and release process | Release governance record, feature-freeze guidance, risk classification, branch-protection exception, runbook, checklist, and status report. |
| MCP safety | `mcp-permission-policy.json`, `aiw validate-mcp`, and runtime capability guards; pilot profile allows GitHub, Brave Search, memory, and Context7 while disabling Playwright, Slack, and Vercel. Write/deployment capabilities require a profile and explicit approval. |
| Pilot preparation | `aiw pilot-preflight` checks `.env`, OpenCode version reporting, MCP policy, and creates a checksum-backed disposable backup plus a sanitized correlation manifest. It never invokes OpenCode or MCP. |
| Observability | Redacted, bounded JSONL lifecycle events with correlation ID, pipeline, phase, skill, status, retry, error category, schema version, formal validation, summaries, locked append, support-bundle counts, and `--prune-days` retention deletion. |
| External-write safety | Deterministic idempotency keys and atomic claim records guard local website publication retries; duplicate claims stop for operator inspection. |
| Capacity and cost | `execution-budget.json`, `aiw validate-budget`, and runtime `BudgetTracker` enforce pilot limits for retries, duration, estimated tokens, and external API calls; violations stop before continued work. |
| Recovery | `aiw rollback-rehearsal` injects disposable corruption, verifies a backup, restores it, checks checksums, and writes a sanitized report; the harness also writes sanitized resumable checkpoints and uses a circuit breaker for repeated failures. |
| Compatibility and quality | `aiw validate-golden` checks structured-only versioned contracts; `aiw score-artifact` routes incomplete outputs to human review and rejects prohibited fields. |
| Multi-runtime support | `.ai-workflow/` canonical config, adapter registry, capability matrix, six normalized schemas, supervised terminal adapters for Claude Code/Codex/Gemini/Aider, host projections for Cursor/Copilot/Cline-Roo/Windsurf, deterministic projections, and fixture certification. External adapters remain experimental until real evidence. |
| Publication and documentation | Website mirror synchronized and checked; local publication retains explicit confirmation, deterministic idempotency, ambiguous-outcome reconciliation, and canary write planning; CI publication remains reviewable. |

## Final validation evidence

| Check | Result |
|---|---:|
| Jest conformance | **PASS — 33 tests** |
| Structural and semantic validation | **PASS — 187 structural checks and 22 pipeline validations** |
| MCP policy validation | **PASS** |
| Execution-budget validation | **PASS** |
| Golden-artifact compatibility validation | **PASS** |
| Execution-event schema validation | **PASS** |
| Pilot-evidence contract validation | **PASS** |
| Artifact-quality scoring | **PASS** |
| Canary write-plan behavior | **PASS** |
| Runtime permission/budget guards, checkpoints, and circuit breaker | **PASS** |
| Multi-runtime adapter descriptors and dry-run certification | **PASS — 9 target adapters** |
| Deterministic runtime projection generation | **PASS** |
| Adapter compatibility CI workflow YAML | **PASS** |
| Full reachable-history security scan | **PASS — 126 reachable commits** |
| High-severity dependency audit | **PASS — 0 vulnerabilities** |
| Website mirror check | **PASS — 140 files current** |
| Shell syntax and `git diff --check` | **PASS** |
| Final working-tree state | **PASS — clean** |
| Strict preflight | **BLOCKED — expected in sandbox** |

The strict preflight reported exactly two environment blockers: the OpenCode executable is missing or cannot report its version, and `.env` is missing. All repository-side checks invoked by preflight passed.

## Remaining release gates

| Priority | Required operator action | Status |
|---:|---|---|
| P0 | Install the supported OpenCode CLI and verify `opencode --version` against `compatibility.json`. | Blocked outside this sandbox. |
| P0 | Create a mode-600 `.env` with a dedicated, least-privilege, expiring GitHub credential and reviewed optional MCP credentials. | Blocked outside this sandbox. |
| P0 | Start and verify the selected real MCP servers without unexpected write capability. | Not run; operator-owned. |
| P0 | Execute the constrained live smoke sequence in `docs/operations/live-smoke-test.md` on a disposable non-sensitive project. | Not run; operator-owned. |
| P1 | Complete one or two controlled non-sensitive pilots, including a recovery scenario and sanitized evidence record. | Not run; operator-owned. |
| P1 | Obtain independent security and rollback sign-off and assign release/runtime/publication owners. | Pending operator assignment. |
| P1 | Enable remote branch protection if the GitHub plan permits it, or maintain the documented compensating review control. | Exception documented; prior private-repository API response was HTTP 403. |
| P1 | Certify at least one non-OpenCode runtime with real preflight, smoke-test, recovery, and controlled-pilot evidence before advertising cross-runtime production support. | Not run; operator-owned. |
| P1 | Certify remaining adapters individually; do not infer support from fixture certification or MCP compatibility alone. | Not run; operator-owned. |

## Operator handoff

Run `aiw pilot-preflight --project-id <disposable-id> --pipeline <pipeline>` only after configuring the real environment. If it passes, follow the complete sequence in `docs/operations/live-smoke-test.md`. Do not record raw prompts, MCP payloads, tokens, authorization headers, personal data, or full session JSON. A passing repository test or temporary fake executable is not live-runtime evidence.

No changes were pushed to GitHub by this task. The multi-runtime compatibility foundation is implemented locally on `release/production-hardening` at `75492e9`; it provides experimental adapter projections and certification scaffolding, not an unconditional claim that every target runtime is production-certified.

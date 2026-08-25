# AI Workflow Final Go/No-Go Report

**Decision:** **NO-GO for general production; conditional GO for repository-side pilot preparation.**

**Release branch:** `release/production-hardening`  
**Release checkpoint:** Current verified repository-side compatibility evidence commit on `release/production-hardening`
**Working tree:** clean at final verification  
**Date:** 2026-08-25

## Executive decision

The approved expert production plan, enhancement roadmap, and detailed multi-runtime compatibility plan have been implemented as far as repository-side controls can be completed without operator-owned credentials or real agent runtimes. The project now has a repeatable constrained-pilot preparation path, runtime MCP capability and approval guards, live budget accounting, formal event-schema validation, circuit-breaker behavior, sanitized checkpoints, deterministic website-publication idempotency and reconciliation, canary-only write planning, pilot-evidence validation, artifact quality scoring, disposable rollback rehearsal, compatibility-aware golden artifact contracts, a runtime-neutral adapter boundary, nine adapter projections, deterministic runtime projections, an explicit projection installer, aggregate adapter certification, and a compatibility-matrix CI job.

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
| Multi-runtime support | `.ai-workflow/` canonical config, adapter registry, capability matrix, seven normalized schemas including runtime-certification evidence, supervised terminal adapters for Claude Code/Codex/Gemini/Aider, host projections for Cursor/Copilot/Cline-Roo/Windsurf, deterministic projections, sanitized evidence validation, and fixture certification. External adapters remain experimental until real evidence. |
| Publication and documentation | Website mirror synchronized and checked; local publication retains explicit confirmation, deterministic idempotency, ambiguous-outcome reconciliation, and canary write planning; CI publication remains reviewable. |

## Final validation evidence

| Check | Result |
|---|---:|
| Jest conformance | **PASS — 41 tests** |
| Structural and semantic validation | **PASS — 187 structural checks and 22 pipeline validations** |
| MCP policy validation | **PASS** |
| Execution-budget validation | **PASS** |
| Golden-artifact compatibility validation | **PASS** |
| Execution-event schema validation | **PASS** |
| Pilot-evidence contract validation | **PASS** |
| Runtime-certification evidence validation | **PASS — fixture-only record correctly remains blocked for live promotion** |
| Runtime version watch | **PASS — informational, no sessions started; live terminal/host verification remains operator-owned** |
| Artifact-quality scoring | **PASS** |
| Canary write-plan behavior | **PASS** |
| Runtime permission/budget guards, checkpoints, and circuit breaker | **PASS** |
| Multi-runtime adapter descriptors and dry-run certification | **PASS — 9 target adapters** |
| Phase 8 maintenance documentation | **PASS — version watch, matrix review, retention, incident, deprecation, release communication, and security review procedures documented** |
| Projection installation safety | **PASS — dry-run, conflict blocking, explicit overwrite backup** |
| Real runtime probes | **BLOCKED — OpenCode, Claude Code, Codex CLI, Gemini CLI, and Aider unavailable; host integrations unavailable** |
| Deterministic runtime projection generation | **PASS** |
| Adapter compatibility CI workflow YAML | **PASS** |
| Full reachable-history security scan | **PASS — full reachable history scanned** |
| High-severity dependency audit | **PASS — 0 vulnerabilities** |
| Website mirror check | **PASS — 140 files current** |
| Release-status handoff report | **PASS when repository-side checks are green; live gates remain operator-owned** |
| Release-approval contract | **PASS — fixture no-go record validates; live conditional-go/go decisions remain operator-owned** |
| Shell syntax and `git diff --check` | **PASS** |
| Final working-tree state | **PASS — clean** |
| Strict preflight | **BLOCKED — expected in sandbox** |

The strict preflight remains expected to report environment blockers when the OpenCode executable or `.env` is absent. All repository-side checks invoked by preflight, including runtime-certification evidence validation, pass without live runtime execution.

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

Run `aiw release-status --json` first to produce the sanitized repository/live-gate handoff and assign its blockers. Validate the private decision record with `aiw validate-release-approval <private-release-approval.json>` before sign-off. Then run `aiw pilot-preflight --project-id <disposable-id> --pipeline <pipeline>` only after configuring the real environment. If it passes, follow the complete sequence in `docs/operations/live-smoke-test.md`, create the private sanitized runtime-certification record, and validate it with `aiw validate-runtime-certification <private-runtime-certification.json>`. Do not record raw prompts, MCP payloads, tokens, authorization headers, personal data, or full session JSON. A passing repository test or temporary fake executable is not live-runtime evidence.

The multi-runtime compatibility work is maintained on `release/production-hardening`; it provides experimental adapter projections, evidence-validation scaffolding, and Phase 8 maintenance controls, not an unconditional claim that every target runtime is production-certified.

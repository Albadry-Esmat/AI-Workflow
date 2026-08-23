# AI Workflow Final Go/No-Go Report

**Decision:** **NO-GO for general production; conditional GO for repository-side pilot preparation.**

**Release branch:** `release/production-hardening`  
**Release checkpoint:** `2f825d7` — `feat: add pilot operations and runtime safety controls`  
**Working tree:** clean at final verification  
**Date:** 2026-08-24

## Executive decision

The approved expert production plan has been implemented as far as repository-side controls can be completed without operator-owned credentials or a real OpenCode runtime. The project now has a repeatable constrained-pilot preparation path, explicit MCP permission policy, sanitized structured observability, retention pruning, static capacity and cost limits, deterministic website-publication idempotency protection, disposable rollback rehearsal, compatibility-aware golden artifact contracts, release documentation, and synchronized website data.

The project must **not** be described as general-production-ready yet. The sandbox cannot honestly provide evidence for the actual OpenCode executable, real credentials, MCP startup, live model execution, non-sensitive pilot completion, independent security review, or operator recovery in the real environment. Those remain release gates rather than simulated test results.

## Completed repository controls

| Control area | Evidence |
|---|---|
| Governance and release process | Release governance record, feature-freeze guidance, risk classification, branch-protection exception, runbook, checklist, and status report. |
| MCP safety | `mcp-permission-policy.json` and `aiw validate-mcp`; pilot profile allows GitHub, Brave Search, memory, and Context7 while disabling Playwright, Slack, and Vercel. |
| Pilot preparation | `aiw pilot-preflight` checks `.env`, OpenCode version reporting, MCP policy, and creates a checksum-backed disposable backup plus a sanitized correlation manifest. It never invokes OpenCode or MCP. |
| Observability | Redacted, bounded JSONL lifecycle events with correlation ID, pipeline, phase, skill, status, retry, error category, schema version, summaries, locked append, and `--prune-days` retention deletion. |
| External-write safety | Deterministic idempotency keys and atomic claim records guard local website publication retries; duplicate claims stop for operator inspection. |
| Capacity and cost | `execution-budget.json` and `aiw validate-budget` define pilot limits for sessions, queue depth, retries, duration, estimated tokens, and external API calls. |
| Recovery | `aiw rollback-rehearsal` injects disposable corruption, verifies a backup, restores it, checks checksums, and writes a sanitized report. |
| Compatibility | `aiw validate-golden` checks structured-only versioned contracts for requirements, ADRs, task DAGs, RTM, guard verdicts, and deployment plans. |
| Publication and documentation | Website mirror synchronized and checked; local publication retains explicit confirmation and idempotency protection; CI publication remains reviewable. |

## Final validation evidence

| Check | Result |
|---|---:|
| Jest conformance | **PASS — 25 tests** |
| Structural and semantic validation | **PASS — 187 structural checks and 22 pipeline validations** |
| MCP policy validation | **PASS** |
| Execution-budget validation | **PASS** |
| Golden-artifact compatibility validation | **PASS** |
| Full reachable-history security scan | **PASS — 122 reachable commits** |
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

## Operator handoff

Run `aiw pilot-preflight --project-id <disposable-id> --pipeline <pipeline>` only after configuring the real environment. If it passes, follow the complete sequence in `docs/operations/live-smoke-test.md`. Do not record raw prompts, MCP payloads, tokens, authorization headers, personal data, or full session JSON. A passing repository test or temporary fake executable is not live-runtime evidence.

No changes were pushed to GitHub by this task. The implementation is committed locally at `2f825d7` and is ready for operator-owned real-environment validation, not for an unconditional general-production release.

# Next Production-Release Gate Status

**Date:** 2026-08-25
**Branch:** `release/production-hardening`
**Commit:** See the sanitized `aiw release-status --json` report for the exact verified commit.

## Current result

The repository-side release checkpoint, compatibility maintenance controls, and sanitized release-status handoff are present. The current sandbox cannot complete the operator-environment gate because the real `opencode` executable is not installed and the project `.env` file is absent. No production credential was inspected, created, or simulated.

| Gate | Result | Evidence or required action |
|---|---|---|
| Release branch | PASS | `release/production-hardening`; confirm exact commit with `aiw release-status --json`. |
| Working tree | PASS when clean | `aiw release-status` reports `clean` only after all source, documentation, changelog, and website data changes are committed. |
| Repository-side checks | PASS when green | `aiw release-status` runs documentation, website, runtime-certification, release-approval, adapter, and runtime-watch checks. |
| Release-approval fixture | PASS | `aiw validate-release-approval tests/fixtures/release-approval.json` validates a repository-side no-go record; it cannot authorize live release. |
| OpenCode executable | BLOCKED | `opencode` is not available in this environment; install and verify the supported version against `compatibility.json`. |
| Environment file | BLOCKED | `.env` is absent; create it from `.env.example`, use a reviewed least-privilege credential, and verify mode `600`. |
| Pilot MCP profile | PASS | `node scripts/validate-mcp-policy.js` passes; Playwright, Slack, and Vercel are disabled. |
| Live MCP startup | NOT RUN | Requires the operator-owned OpenCode installation and reviewed credentials. |
| Live smoke test | NOT RUN | Requires a disposable non-sensitive project and the operator-owned runtime. |

## Required next action

The operator must first run `aiw release-status --json` and validate the repository fixture with `aiw validate-release-approval tests/fixtures/release-approval.json`, then install the supported OpenCode CLI, create and protect `.env`, run `aiw runtime-watch --runtime opencode --strict`, and rerun the commands in `next-production-release-plan.md`. The absence of those prerequisites is a release blocker, not a test failure to be bypassed. Temporary fake binaries may validate CLI pass paths only and must never be recorded as live evidence.

# AI Workflow Next Production-Release Plan

## Goal

Move the AI Workflow from a repository-side **NO-GO for general production** to an evidence-backed release decision by validating the real OpenCode environment, completing a constrained smoke test, running a controlled pilot, and obtaining independent operational approval. The plan preserves the local-first architecture and does not treat sandbox fixtures or temporary fake binaries as live evidence.

## Current baseline

The repository-side enhancement work is complete on `release/production-hardening` at commit `32b8d15`, with a clean working tree. The current automated baseline includes 32 passing Jest tests, successful structural and semantic validation, MCP policy validation, execution-budget validation, event-schema validation, pilot-evidence validation, artifact-quality checks, security-history scanning, dependency auditing, mirror verification, rollback rehearsal, and shell/diff hygiene. Strict preflight remains blocked only by the absence of a real OpenCode executable and `.env`/`GITHUB_TOKEN` in the sandbox.

## Phase 1 — Prepare the operator environment

The operator installs the supported OpenCode version and verifies it against `compatibility.json`. The operator creates `.env` from `.env.example`, uses a dedicated least-privilege and preferably expiring credential, verifies mode `600`, and keeps all secrets out of tracked files, evidence records, and support bundles. The operator reviews `opencode.json` and confirms that the `pilot-read-only` profile is active: GitHub, memory, Context7, and Brave Search may be enabled according to credential availability, while Playwright, Slack, and Vercel remain disabled.

Entry criteria are a clean checkout of the release branch, a non-sensitive disposable project, an assigned operator, and an assigned independent reviewer. The phase stops immediately if OpenCode reports an incompatible version, the environment file is absent or overly permissive, or a side-effect MCP server is unexpectedly enabled.

## Phase 2 — Run repository and environment preflight

From the clean release branch, run `npm ci`, `aiw health`, `aiw self-test`, `aiw validate`, `node scripts/security-check.js --history`, `aiw sync --check`, `aiw version --json`, `aiw validate-mcp`, `aiw validate-budget`, `aiw validate-golden`, `aiw validate-events`, `aiw validate-pilot-evidence`, `aiw rollback-rehearsal`, and `aiw preflight`. Then run `aiw pilot-preflight --project-id disposable-smoke-001 --pipeline requirements-only`.

The expected result is a fully passing strict preflight and a sanitized pilot manifest containing a correlation ID, verified backup reference, selected pipeline, MCP profile, and budget policy. The command must not execute OpenCode or MCP itself. Any failure is recorded as a blocker and corrected before continuing.

## Phase 3 — Verify real MCP startup without side effects

Start only the approved read-only MCP services and verify that each expected server starts, responds within the configured budget, and exposes no unapproved write or deployment capability. Record only server names, versions, status, duration, error categories, and correlation IDs. Do not record tokens, headers, prompts, raw MCP payloads, personal data, or full session JSON.

The stop conditions are unexpected server enablement, capability mismatch, credential leakage, unbounded startup time, repeated failures that trip the circuit breaker, or any remote write. A side effect requires incident preservation and operator review before any retry.

## Phase 4 — Execute the constrained live smoke test

Follow `docs/operations/live-smoke-test.md` against the disposable non-sensitive project. Exercise routing, schema validation, one safe retry failure, HITL rejection and explicit resume, asynchronous artifact readiness, backup and recovery, unauthorized-capability denial, budget hard-stop behavior, circuit-breaker behavior, and artifact-quality routing. Keep all external writes, deployment, messaging, browser interaction, payment, account changes, and autonomous adaptation disabled.

The smoke test passes only if all expected artifacts are schema-valid, no downstream task consumes unavailable output, all gates preserve their decisions, the budget and circuit controls stop unsafe continuation, checkpoints contain metadata but no raw artifact content, and sanitized event validation passes. Save the private evidence record and validate it with `aiw validate-pilot-evidence <private-record.json>`.

## Phase 5 — Run the controlled pilot

Run one or two non-critical pilots with non-sensitive inputs. Start with read-only behavior and no publication. Review requirements, architecture, task, traceability, guard-verdict, and deployment-plan artifacts using `aiw score-artifact`. Any `needs_human_review` or `reject` result blocks promotion. Perform a separate disposable rollback rehearsal and verify that state, checksums, event summaries, and checkpoint metadata remain recoverable.

The independent reviewer checks the evidence, confirms that no P0/P1 issue remains, reviews the event summaries and support bundle, verifies credential and MCP boundaries, and signs the pilot record. The pilot is stopped if the operator bypasses a gate, exceeds budget without approved escalation, retries an ambiguous external operation, or encounters unexplained state corruption.

## Phase 6 — Make the production decision

A release owner compares the complete evidence package with the release checklist. General production may be approved only when real OpenCode and MCP evidence passes, the controlled pilot passes, rollback and recovery are independently reviewed, ownership is assigned, and the branch-protection exception is either resolved or formally accepted as a compensating-control risk.

If any P0/P1 condition is unresolved, retain the **NO-GO** decision and document the blocker, owner, remediation, and next review date. If all gates pass, create a release tag from the verified commit, publish release notes, and keep external publication disabled until a separate canary approval is recorded.

## Phase 7 — Post-launch controls

For the initial release window, monitor sanitized event summaries, budget consumption, circuit-breaker trips, artifact-quality review outcomes, idempotency ledger states, and rollback readiness. Prune events according to the documented seven-day retention policy. Review incidents within one business day, rotate credentials after any suspected exposure, and require a new compatibility and pilot review for changes to MCP profiles, write-capable integrations, budgets, schemas, or publication behavior.

## Evidence package

| Evidence | Required content | Prohibited content |
|---|---|---|
| Environment report | OpenCode version, branch, commit, command status, MCP server names and statuses | Tokens, headers, personal data |
| Pilot manifest | Correlation ID, project classification, pipeline, profile, budget, backup verification | Raw prompts, payloads, session JSON |
| Event report | Validated sanitized JSONL summary, counts, failure categories, retention result | Raw model or MCP content |
| Artifact review | Artifact names, schema results, quality scores, reviewer decision | Prompt text or secret-bearing fields |
| Recovery report | Backup checksum result, restore result, circuit/checkpoint behavior | Unredacted state contents |
| Sign-off record | Operator, independent reviewer, release owner, decision, timestamp | Secret values or unsupported claims |

## Assumptions and open risks

This plan assumes the operator can install and run a supported OpenCode CLI and can provide credentials through the local `.env` file without sharing them. It also assumes access to a disposable non-sensitive repository or project. The sandbox cannot perform these user-owned actions or provide live-runtime evidence. GitHub branch protection may remain unavailable under the current private-repository plan; if so, the documented review-and-CI compensating control must be explicitly accepted by the release owner. No general-production approval should be inferred from repository tests alone.

## Completion criteria

The plan is complete when the final decision is recorded as either **GO** with attached independent pilot evidence and a release tag, or **NO-GO** with all unresolved blockers assigned. In both cases, the repository remains clean, the evidence is sanitized, and no unsupported live or production claim is made.

# AI Workflow Production Hardening — Release Candidate Status

**Status:** Production-hardening implementation complete on local release branch  
**Branch:** `release/production-hardening`  
**Initial hardening commit:** `836676d7e189882580e0483d54e7175ed1322a44` (`chore: harden production readiness`)  
**Implementation commit:** `c482a77` (`feat: complete production hardening controls`)  
**Latest compatibility commit:** `15ed80d` (`feat: add multi-runtime adapter compatibility foundation`)
**Date:** 2026-08-23

## Executive Summary

The approved production-readiness plan, enhancement roadmap, and detailed multi-runtime compatibility plan have been implemented as a local, traceable release-candidate change set. The project now has a clean-clone setup path, secure template-only initialization, manifest-driven website synchronization, semantic pipeline and condition validation, a deterministic black-box conformance harness, atomic state and lock primitives, checksum-backed backup/restore, sanitized support bundles and event logs, machine-readable version output, full-history secret scanning, immutable CI action references, explicit MCP capability and approval guards, runtime budget enforcement, circuit breakers, sanitized checkpoints, deterministic publication idempotency and reconciliation, canary write planning, pilot-evidence validation, artifact quality scoring, golden compatibility contracts, a runtime-neutral adapter boundary, nine experimental adapters, deterministic runtime projections, strict preflight, reviewed website PR publication, and operational release documentation.

The branch is **ready for constrained pilot preparation after the operator supplies real production prerequisites**. It is not yet a general-production release from this sandbox because the real OpenCode CLI and a configured GitHub token were intentionally not installed or supplied here, and no live model/MCP pipeline was executed.

## Implemented Changes

| Area | Implementation |
|---|---|
| Clean-clone setup | Removed the broken `.opencode/package.json` installation assumption. `setup.sh` now runs `npm ci` from the root lockfile, checks the dependency-free graphify plugin layout, creates mode-600 `.env`, and remains idempotent. |
| Secure initialization | `aiw init` copies `.env.example`, never copies populated source credentials implicitly, and applies mode 600 to the target environment file. |
| Website synchronization | Added `scripts/website-data-manifest.json` and its reader. Sync now uses one manifest, removes stale generated files within the mirror scope, preserves non-mutating `--check`/`--dry-run`, and requires `--confirm-website` for local external publication. CI reuses the same sync check instead of duplicating source lists. |
| Pipeline safety | Made ADR generation synchronous in all affected gated pipeline templates. Added semantic validation for skill paths, duplicate phases, gate targets, async declarations, deployment approval gates, and parallel groups. Corrected the compliance pipeline’s final sign-off gate to be indefinite and non-bypassable. |
| State recovery | Added `scripts/lib/state-store.js` for atomic JSON writes, previous-file backups, corruption recovery, and single-writer locks. Added checksum-manifested `aiw backup`, `aiw restore <backup>`, and verification support. |
| Conformance | Added a deterministic black-box harness plus Jest tests without live credentials or paid model calls. Coverage includes routing, retries, HITL approval/rejection, async reconciliation, artifact readiness, redaction, persistence, retention, semantic validation, manifest integrity, atomic recovery, locking, backup/restore, version output, support bundles, secure initialization, runtime capability denial, budget hard stops, checkpoints, circuit breakers, write reconciliation, canary plans, pilot evidence, and artifact quality routing. |
| Security and supply chain | Removed the unused unpinned fetch MCP entry, verified all retained MCP versions, pinned GitHub Actions to immutable SHAs, added current-tree and full-history secret-like file/token checks, added high-severity npm audit checks, and replaced broad token guidance with fine-grained repository-scoped guidance. |
| Release operations | Added `compatibility.json`, `aiw self-test`, `aiw preflight`, `aiw pilot-preflight`, `aiw version --json`, `aiw security-history`, `aiw support-bundle`, sanitized event reporting and formal event-schema validation, execution-budget validation and runtime accounting, MCP capability guards, circuit breakers, checkpoints, idempotency reconciliation, canary write plans, pilot-evidence validation, artifact quality scoring, rollback rehearsal, golden artifact compatibility checks, the `.ai-workflow/` canonical config boundary, adapter registry, capability matrix, versioned runtime schemas, adapter certification harness, deterministic projections, compatibility CI, a machine-readable branch-protection policy, `docs/operations/production-runbook.md`, `docs/operations/live-smoke-test.md`, `docs/operations/multi-runtime-compatibility.md`, `docs/operations/release-checklist.md`, GitHub repository settings guidance, and this status report. |
| Documentation | Updated README, developer guide, security, governance, MCP, navigation, changelog, live smoke procedure, and website-generated content to match the implementation. |

## Verification Evidence

| Check | Result | Evidence |
|---|---:|---|
| Root `npm ci` | PASS | Lockfile install completed successfully. |
| Jest conformance | PASS | 34 tests passed in one suite after the detailed multi-runtime compatibility and projection-installation additions. |
| `aiw self-test` | PASS | Compatibility, manifest, semantic, state recovery, locking, and secure init checks passed. |
| `aiw validate` | PASS | 187 structural checks passed; semantic validator passed all 22 pipeline templates. |
| Security check | PASS | MCP pins, immutable action SHAs, tracked-file scan, current-tree token-pattern scan, and full-history scan across 125 reachable commits passed. |
| `npm audit --audit-level=high --omit=optional` | PASS | 0 vulnerabilities reported. |
| `aiw sync --check` | PASS | All 140 mirrored files current; check mode did not mutate the tree. Local publication now validates target branch cleanliness and fast-forward safety; CI opens a target pull request instead of pushing directly to `main`. |
| Shell syntax | PASS | Tracked shell scripts passed `bash -n`. |
| Git diff hygiene | PASS | `git diff --check` passed. |
| Clean-clone setup | PASS | First setup and second idempotent setup both returned 0; no `.opencode` ENOENT; `.env` mode 600. |
| Backup/restore round trip | PASS | Disposable state backup, checksum verification, restore, and previous-state retention succeeded. |
| Pilot-preflight preparation | PASS (repository path) | Disposable fixture created a sanitized blocked/ready manifest, validated MCP permissions, and created a checksum-backed backup; no live runtime was invoked. |
| Structured event log | PASS | Event redaction, locking, bounded reads, summaries, and conformance integration passed. |
| Capacity and cost policy | PASS | Static pilot budget policy and negative fixture validation passed. |
| Idempotency guard | PASS | Deterministic operation claims reject duplicates and record completion; website publication path is guarded without live publication. |
| Rollback rehearsal | PASS | Disposable corruption and verified restore produced a sanitized report with matching checksums. |
| Golden artifact compatibility | PASS | Versioned structured-only artifact contracts and negative drift fixture passed. |
| Execution event schema | PASS | Formal schema validator, redaction checks, support-bundle summaries, and retention pruning passed. |
| Runtime guards | PASS | MCP permission/approval guards, budget hard stops, checkpoint safety, and circuit-breaker transitions passed. |
| Canary and evidence controls | PASS | Canary-only dry-run write plans, pilot-evidence validation, and artifact-quality review routing passed. |
| Multi-runtime adapter foundation | PASS | Registry/matrix validation, nine descriptor dry-run certifications, deterministic projection generation, safe projection installation tests, aggregate certification, and compatibility CI YAML validation passed. |
| Real runtime certification | BLOCKED / NOT RUN | OpenCode, Claude Code, Codex CLI, Gemini CLI, and Aider are unavailable in the sandbox; host/editor integrations are unavailable. Each runtime requires operator-owned preflight and a separate non-sensitive pilot; fixture certification is not live evidence. |
| Strict preflight with real prerequisites | BLOCKED IN SANDBOX | Correctly fails because real OpenCode and `.env`/`GITHUB_TOKEN` are absent. The pass path was separately verified with temporary test-only prerequisites. |
| Strict preflight pass path | PASS | Passed with a temporary fake OpenCode executable and test-only token; no production secret was used. |
| Live OpenCode/MCP pipeline | NOT RUN | Requires user-owned OpenCode installation, credentials, and a non-critical pilot repository. |

## Required Operator Actions Before Pilot

The remaining items are environment and governance prerequisites rather than unimplemented repository controls.

| Priority | Action |
|---|---|
| P0 | Install the supported OpenCode CLI and confirm `opencode --version` succeeds. |
| P0 | Create `.env` from `.env.example`, set a least-privilege `GITHUB_TOKEN`, and keep the file mode at 600. Do not place the token in tracked files. |
| P0 | Review the MCP servers enabled in `opencode.json`, their permissions, and their credentials. Keep optional write-capable integrations disabled until explicitly needed. |
| P1 | Enable the committed branch-protection policy when the repository plan permits it; the current private-repository plan returned HTTP 403 because branch protection requires GitHub Pro or a public repository. |
| P1 | Confirm the website publication credential is separate from local credentials and decide whether direct push or pull-request publication is the desired policy. |
| P1 | Run the constrained and full pilot described in `docs/operations/production-runbook.md` using non-sensitive data. |
| P1 | Obtain independent security and rollback sign-off before creating a public release tag. |

## Pilot Command Sequence

After installing OpenCode and configuring credentials, run:

```bash
npm ci --ignore-scripts --no-audit --no-fund
aiw health
aiw self-test
aiw validate
node scripts/security-check.js --history
aiw sync --check
aiw version --json
aiw preflight
aiw validate-events
aiw validate-pilot-evidence
aiw pilot-preflight --project-id disposable-smoke-001 --pipeline requirements-only
aiw backup
aiw rollback-rehearsal
```

Then follow `docs/operations/live-smoke-test.md` for the constrained pipeline, review all human gates and generated artifacts, and only afterward run one full pipeline with non-sensitive input. Do not enable autonomous adaptation or direct external publication during the pilot. Run `aiw rollback-rehearsal` before any publication-policy change.

## Release Decision

**Decision:** Conditional approval for internal pilot; not yet approved for general production.

The code-level and repository-level release controls now pass. General production remains gated on real-environment preflight, live OpenCode/MCP smoke testing, pilot evidence, independent review, and repository branch-protection configuration. No changes were pushed to GitHub from this task; all implementation work is committed locally on `release/production-hardening`.

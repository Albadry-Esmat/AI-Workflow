# AI Workflow Production Hardening — Release Candidate Status

**Status:** Production-hardening implementation complete on local release branch  
**Branch:** `release/production-hardening`  
**Commit:** `836676d7e189882580e0483d54e7175ed1322a44`  
**Commit message:** `chore: harden production readiness`  
**Date:** 2026-08-23

## Executive Summary

The approved production-readiness plan has been implemented as a local, traceable release-candidate change set. The project now has a clean-clone setup path, secure template-only initialization, manifest-driven website synchronization, semantic pipeline validation, atomic state and lock primitives, checksum-backed backup/restore, credential-free conformance tests, immutable CI action references, MCP package pinning checks, a compatibility manifest, strict preflight, and operational release documentation.

The branch is **ready for a controlled internal pilot after the operator supplies real production prerequisites**. It is not yet a general-production release from this sandbox because the real OpenCode CLI and a configured GitHub token were intentionally not installed or supplied here, and no live model/MCP pipeline was executed.

## Implemented Changes

| Area | Implementation |
|---|---|
| Clean-clone setup | Removed the broken `.opencode/package.json` installation assumption. `setup.sh` now runs `npm ci` from the root lockfile, checks the dependency-free graphify plugin layout, creates mode-600 `.env`, and remains idempotent. |
| Secure initialization | `aiw init` copies `.env.example`, never copies populated source credentials implicitly, and applies mode 600 to the target environment file. |
| Website synchronization | Added `scripts/website-data-manifest.json` and its reader. Sync now uses one manifest, removes stale generated files within the mirror scope, preserves non-mutating `--check`/`--dry-run`, and requires `--confirm-website` for local external publication. CI reuses the same sync check instead of duplicating source lists. |
| Pipeline safety | Made ADR generation synchronous in all affected gated pipeline templates. Added semantic validation for skill paths, duplicate phases, gate targets, async declarations, deployment approval gates, and parallel groups. Corrected the compliance pipeline’s final sign-off gate to be indefinite and non-bypassable. |
| State recovery | Added `scripts/lib/state-store.js` for atomic JSON writes, previous-file backups, corruption recovery, and single-writer locks. Added checksum-manifested `aiw backup`, `aiw restore <backup>`, and verification support. |
| Conformance | Added Jest tests without live credentials or paid model calls. Coverage includes semantic validation, manifest integrity, atomic recovery, lock contention, backup/restore, and secure initialization. |
| Security and supply chain | Removed the unused unpinned fetch MCP entry, verified all retained MCP versions, pinned GitHub Actions to immutable SHAs, added secret-like file/token checks, and added high-severity npm audit checks. |
| Release operations | Added `compatibility.json`, `aiw self-test`, `aiw preflight`, `docs/operations/production-runbook.md`, `docs/operations/release-checklist.md`, and this status report. |
| Documentation | Updated README, developer guide, security, governance, MCP, navigation, changelog, and website-generated content to match the implementation. |

## Verification Evidence

| Check | Result | Evidence |
|---|---:|---|
| Root `npm ci` | PASS | Lockfile install completed successfully. |
| Jest conformance | PASS | 6 tests passed in one suite. |
| `aiw self-test` | PASS | Compatibility, manifest, semantic, state recovery, locking, and secure init checks passed. |
| `aiw validate` | PASS | 187 structural checks passed; semantic validator passed all 22 pipeline templates. |
| Security check | PASS | MCP pins, immutable action SHAs, tracked-file scan, and token-pattern scan passed. |
| `npm audit --audit-level=high --omit=optional` | PASS | 0 vulnerabilities reported. |
| `aiw sync --check` | PASS | All 140 mirrored files current; check mode did not mutate the tree. |
| Shell syntax | PASS | Tracked shell scripts passed `bash -n`. |
| Git diff hygiene | PASS | `git diff --check` passed. |
| Clean-clone setup | PASS | First setup and second idempotent setup both returned 0; no `.opencode` ENOENT; `.env` mode 600. |
| Backup/restore round trip | PASS | Disposable state backup, checksum verification, restore, and previous-state retention succeeded. |
| Strict preflight with real prerequisites | BLOCKED IN SANDBOX | Correctly fails because real OpenCode and `.env`/`GITHUB_TOKEN` are absent. |
| Strict preflight pass path | PASS | Passed with a temporary fake OpenCode executable and test-only token; no production secret was used. |
| Live OpenCode/MCP pipeline | NOT RUN | Requires user-owned OpenCode installation, credentials, and a non-critical pilot repository. |

## Required Operator Actions Before Pilot

The remaining items are environment and governance prerequisites rather than unimplemented repository controls.

| Priority | Action |
|---|---|
| P0 | Install the supported OpenCode CLI and confirm `opencode --version` succeeds. |
| P0 | Create `.env` from `.env.example`, set a least-privilege `GITHUB_TOKEN`, and keep the file mode at 600. Do not place the token in tracked files. |
| P0 | Review the MCP servers enabled in `opencode.json`, their permissions, and their credentials. Keep optional write-capable integrations disabled until explicitly needed. |
| P1 | Configure branch protection and required CI checks on the GitHub repository. |
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
node scripts/security-check.js
aiw sync --check
aiw preflight
aiw backup
```

Then run a constrained pipeline against a non-critical project, review all human gates and generated artifacts, and only afterward run one full pipeline with non-sensitive input. Do not enable autonomous adaptation or direct external publication during the pilot.

## Release Decision

**Decision:** Conditional approval for internal pilot; not yet approved for general production.

The code-level and repository-level release controls now pass. General production remains gated on real-environment preflight, live OpenCode/MCP smoke testing, pilot evidence, independent review, and repository branch-protection configuration. No changes were pushed to GitHub from this task; the implementation is committed locally on `release/production-hardening`.

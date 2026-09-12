# Onboarding Batch O5 Completion Report

**Batch:** Onboarding O5 — Digest-Bound Local Runtime Artifact Execution
**Status:** Complete and gated
**Date:** 2026-08-18
**Author:** Manus AI
**Branches:** `Dev` only; `main` was not modified

## Executive summary

Onboarding Batch O5 adds a narrowly bounded execution path for an **already-present local artifact**. It strengthens O4 with exact artifact identity, SHA-256 and size binding, staging-root ownership, platform matching, explicit approval, bounded argv execution, redacted evidence, and recovery that does not delete user-provided staged artifacts.

O5 is not a general installer runner. It does not download artifacts, execute vendor network installers, run shell pipelines or PowerShell expressions, elevate privileges, mutate package-manager or Docker state, automate authentication, initialize target projects, or launch runtimes. The only execution-capable record is an intentionally controlled AI-Workflow fixture so that the execution path can be tested without installing or modifying a vendor runtime.

## Research and scope basis

GitHub documents that release assets expose immutable SHA-256 digests generated at upload time and retrievable through the release UI, APIs, and `gh` CLI [1]. npm documents `package-lock.json` integrity values as Standard Subresource Integrity values for package resources, with registry, Git, and tarball semantics [2]. These mechanisms establish useful artifact identity, but neither a checksum nor a lockfile proves that an installer’s behavior, privilege, authentication, network access, or rollback behavior is safe.

O5 therefore combines artifact integrity with exact path, size, platform, approval, argv, environment, timeout, staging-root, and target-mutation constraints. A digest match is a necessary precondition, not a substitute for policy review.

## Scope delivered

| Area | Delivered result |
|---|---|
| Artifact catalog | Added `config/runtime-installer-o5-catalog.json` with one approved controlled fixture and no vendor/network installer records. |
| Artifact schema | Added a catalog schema for exact local path, artifact kind, SHA-256, size, provenance, approval, argv, environment, timeout, platform, verification, and rollback ownership. |
| State and policy | Added atomic, redacted O5 state and fail-closed policy schemas. State/evidence are owned under `.aiw/onboarding-o5/`. |
| Planning | Added `aiw onboarding execute-plan` to expose exact records, artifact identity, provenance, approval, argv, and blocked reasons without hashing or executing. |
| Hashing | Added `aiw onboarding artifact-hash` with SHA-256, byte-size, staging-root, filename, path traversal, symlink, and missing-artifact checks. |
| Execution | Added `aiw onboarding execute` requiring exact record, exact staged path, exact digest/size match, platform match, approved record, approval reason, and explicit `--yes`. |
| Process boundary | Execution is one bounded command maximum, `shell=False`, absolute argv executable, closed stdin, empty environment, O5 staging cwd, no stdout/stderr capture, and zero target-project mutation. |
| Evidence | Added redacted JSONL evidence with preflight, execution start/finish, exit code, timeout, hash status, and mutation counts; stdout/stderr are never captured. |
| Recovery | Added `aiw onboarding recover --o5 [--reset-state]`; reset deletes only O5 state/evidence and preserves the staged artifact. |
| Developer controls | Added O5 fixtures, a **30-check** master validator, Makefile integration, CLI routing, and inclusion in `make validate`. |
| Documentation | Added `docs/digest-bound-local-execution.md`, research notes, changelog entry, and this completion report. |
| Website | Mirrored O5 contract, policy, state schema, catalog, and catalog schema through the source-owned sync script. Added typed website loaders and a Getting Started panel. |
| Release integrity | Generated and published the O5 ReleaseManifest with passing source, website, build, data-hash, and compatibility gates. |

## Safety decisions

The approved controlled fixture is `O5-FIXTURE-SAFE-RUNTIME-PROBE`. Its artifact is `safe-runtime-probe.py`, with expected SHA-256 `sha256:784fb44f85c150ee86e39e3d6eea0c9905f922f4f34c47a69994d453c6b38cd3` and expected size **127 bytes**. Its execution argv is `/usr/bin/python3 -I {artifact}`. It writes no files, does not receive secrets, and runs only to prove that the O5 evidence and execution boundaries work.

The execution path is separately gated from O4’s vendor installer catalog. Current O4 records remain manual-only, while O5’s controlled fixture is approved only as a local test record. This prevents a verified local-fixture path from being interpreted as permission to execute OpenCode, Claude Code, Codex, package-manager, shell-script, Docker, or elevated installers.

The O5 preflight rejects a missing or mismatched digest, wrong byte size, symlink, path traversal, wrong filename, outside-staging path, platform mismatch, unapproved record, missing reason, missing explicit consent, unsafe argv, shell expansion, network flag, elevation, environment injection, or non-staging working-directory policy before the subprocess is created.

Authentication remains runtime-owned. O5 does not accept, store, print, or copy API keys, provider credentials, browser tokens, or login output. Target initialization, target mutation, and neutral runtime launch remain deferred. Rollback remains guidance-only unless the source explicitly supports it; O5 can reset only its own state and evidence.

## Validation evidence

| Gate | Result |
|---|---|
| O5 master validator | Passed: **30/30 checks**. |
| Controlled fixture execution | Passed: exact SHA-256 and size, one command, exit code 0, zero host mutations, zero target mutations. |
| Digest mismatch | Passed: tampered artifact blocked before command execution. |
| Path safety | Passed: outside-staging paths, symlinks, and filename mismatch fail closed. |
| Consent and approval | Passed: missing `--yes` or approval reason blocks with zero commands. |
| Evidence privacy | Passed: stdout/stderr are not captured; raw-secret value count remains zero. |
| Recovery | Passed: O5 state/evidence reset preserves the staged artifact and leaves runtime/target changes at zero. |
| Full source validation | Passed: `make validate` completed all prior controls plus O5; the existing skill suite reported **188 passed, 0 failed**. |
| Source mirror freshness | Passed: `bash scripts/sync-website-data.sh --check`; all **157 generated files** were up to date. |
| Website lint | Passed: `npm run lint`. |
| Website tests | Passed: **39/39 tests**. |
| Website build | Passed: **129 static pages** generated. |
| npm audit | Passed: **0 vulnerabilities** at the high threshold. |
| ReleaseManifest | Passed: schema validation and compatibility returned `compatible` with zero violations. Data hash: `sha256:c870162d0ba445e584ad3045eff4542c9a4783d10172b1f40695ccebf0658ddb`. |
| Branch and worktree integrity | Passed: both repositories were on `Dev`, remote tips matched local tips, `main` was untouched, the website mirror matched source data except for its self-referential manifest, and the four intentionally untracked root planning artifacts remained uncommitted. |

## Dev commits

| Repository | Commit | Role |
|---|---|---|
| `Albadry-Esmat/AI-Workflow` | `e548c8f9caf00b8ec6527f2629a2ca64541e5af8` | O5 implementation, schemas, policy, contract, controlled fixture, catalog, validator, CLI, Makefile, synchronization mappings, documentation, changelog, and generated source mirror. |
| `Albadry-Esmat/ASE-OS-Website` | `7ee1ef087c0a20036ee40b4ee56a8e90bf77c210` | O5 generated-data mirror, typed loaders, and Getting Started representation; used as ReleaseManifest sync-base. |
| `Albadry-Esmat/ASE-OS-Website` | `4a5945e1b8963f0429c7f722fe93e07e66a45192` | O5 ReleaseManifest publication; final website Dev tip. |

The ReleaseManifest binds source commit `e548c8f9caf00b8ec6527f2629a2ca64541e5af8` to website sync-base commit `7ee1ef087c0a20036ee40b4ee56a8e90bf77c210`. The later O5 completion-report commit is documentation-only and remains compatible under the project’s ancestor-aware release gate.

## Known limitations and explicit non-goals

O5 does not automatically install OpenCode, Claude Code, Codex, or any other vendor runtime. It does not download artifacts or resolve release metadata at execution time. It does not verify publisher signatures, build provenance, transparency logs, package-manager trust, or the semantic safety of a binary beyond the exact local digest and catalog policy.

The controlled fixture uses a committed test artifact and a local absolute Python executable. It is not evidence that a vendor runtime installer is safe or that a provider can be installed on every host. A future vendor-execution batch would need a separately reviewed record model for release assets, publisher signatures, platform-specific installation semantics, rollback, privilege, and authentication boundaries.

O5 does not accept raw secrets, automate browser or provider login, initialize target projects, modify target files, copy credentials, start services, or launch provider-specific runtimes. The neutral `aiw start` path remains unchanged.

Resetting O5 state preserves staged artifacts by design. Users who want to remove a staged artifact must do so explicitly through a separate, user-controlled filesystem action; O5 does not claim ownership of deletion outside its state/evidence files.

## Rollback procedure

Rollback is Dev-only and should use reversible commits rather than rewriting history. Revert the O5 source implementation first:

```bash
git -C /home/ubuntu/AI-Workflow checkout Dev
git -C /home/ubuntu/AI-Workflow revert e548c8f9caf00b8ec6527f2629a2ca64541e5af8
git -C /home/ubuntu/AI-Workflow push origin Dev
```

Then revert the website manifest and representation:

```bash
git -C /home/ubuntu/ASE-OS-Website checkout Dev
git -C /home/ubuntu/ASE-OS-Website revert 4a5945e1b8963f0429c7f722fe93e07e66a45192
git -C /home/ubuntu/ASE-OS-Website revert 7ee1ef087c0a20036ee40b4ee56a8e90bf77c210
git -C /home/ubuntu/ASE-OS-Website push origin Dev
```

For local O5 state only, run:

```bash
aiw onboarding recover --o5 --reset-state
```

This removes only `.aiw/onboarding-o5/state.json` and `.aiw/onboarding-o5/evidence.jsonl`; it preserves the staged artifact and does not alter runtimes, credentials, package-manager state, Docker state, or target projects. After rollback, rerun source validation, mirror checks, website lint/tests/build, and ReleaseManifest compatibility.

## Decision boundary

O5 is complete. **O6 must not begin automatically.** A future batch may address publisher-signature verification, vendor-specific authenticated installer handoffs, guarded target initialization, or neutral launch dispatch only after explicit user confirmation and a separately defined acceptance boundary.

## References

[1]: https://github.blog/changelog/2025-06-03-releases-now-expose-digests-for-release-assets/ "GitHub Changelog — release asset digests"
[2]: https://docs.npmjs.com/cli/v6/configuring-npm/package-lock-json/ "npm Docs — package-lock.json integrity values"

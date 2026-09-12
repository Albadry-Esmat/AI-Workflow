# Onboarding Batch O4 Completion Report

**Batch:** Onboarding O4 — Verified Agent-Neutral Runtime Installation
**Status:** Complete and gated
**Date:** 2026-08-18
**Author:** Manus AI
**Branches:** `Dev` only; `main` was not modified

## Executive summary

Onboarding Batch O4 adds a provenance-aware runtime installation control plane without coupling AI-Workflow to OpenCode, Claude Code, Codex, or any other named runtime. It converts official installation documentation into source-owned, platform-aware records; exposes safe installation plans; verifies already-installed runtimes using bounded read-only probes; and fails closed when an installer record is not eligible for automatic execution.

O4 deliberately does **not** execute any current installer record. The nine catalog records are source-reviewed and manual-only. Network-fetched shell installers, PowerShell expression installers, elevated commands, package-manager mutations, Docker mutations, and binary downloads remain blocked by policy. Users receive the exact official command, its provenance, platform/shell requirements, verification probes, and rollback ownership, while the workflow avoids making an unsafe generic installation claim.

## Research and scope basis

The official OpenCode documentation lists an install script, npm, Homebrew, Arch packages, Chocolatey, Scoop, Mise, Docker, and release binaries, and separates provider configuration and project initialization from installation [1]. Claude Code’s official setup documentation describes native, Homebrew, WinGet, Linux package-manager, and npm installation, read-only `claude --version` and `claude doctor` checks, binary-integrity sections, update behavior, and separate authentication [2]. OpenAI’s official Codex CLI documentation documents a standalone macOS/Linux installer, Windows/npm/Homebrew channel choices, and a separate first-run sign-in step [3].

These sources establish channel provenance and vendor behavior, but they do not create a single safe, vendor-neutral execution contract. The O4 decision was therefore to implement provenance-bound planning and verification first, with automatic installation disabled until a future batch can establish verified commands, platform matching, command safety, explicit consent, and rollback evidence.

## Scope delivered

| Area | Delivered result |
|---|---|
| Installer catalog | Added `config/runtime-installer-catalog.json` with **nine** source-reviewed records for OpenCode, Claude Code, and Codex across Linux, macOS, and Windows channels. |
| Catalog schema | Added the versioned catalog schema covering installer identity, platform, architecture, shell, channel, command class, requirements, provenance, review, read-only verification, and rollback ownership. |
| Provenance | Every record includes an official URL, source kind, retrieval date, command location, and a `sha256:` source fingerprint. |
| Planning | Added `aiw onboarding install-plan` with JSON/human output, platform/architecture/shell filtering, blocked-reason classification, provenance display, verification guidance, and zero-write/no-network guarantees. |
| Verification | Added `aiw onboarding install-verify` for exact adapter IDs. It performs bounded version probes and optional documented read-only doctor probes against existing executables. |
| Installation gate | Added `aiw onboarding install --installer <id> --yes`. It requires exact record selection and explicit consent, but all current records fail closed as manual-only; zero installer commands execute. |
| Command policy | Blocked shell-piped installers, PowerShell expression installers, network downloads, elevated commands, package-manager mutation, Docker mutation, and target-project mutation. |
| State and recovery | Added atomic redacted O4 state/evidence under `.aiw/onboarding-o4/` and `aiw onboarding recover --o4 [--reset-state]`. |
| Authentication and targets | Login remains runtime-owned; raw secrets are not accepted or stored; target initialization and launch remain deferred. |
| Controls | Added O4 state, policy, catalog, and contract schemas; 12 deterministic fixtures; and the **27-check** O4 master validator. |
| Developer commands | Added `make validate-onboarding-o4`, `make onboarding-install-plan`, `make onboarding-install-verify`, and `make onboarding-install`. O4 is included in `make validate`. |
| Documentation | Added `docs/verified-runtime-installation.md`, official references, changelog entry, and O4 research/boundary artifacts. |
| Website | Mirrored O4 contract, policy, installer catalog, and catalog schema through the source-owned sync script. Added typed website loaders and a Getting Started panel showing the manual-only/no-download boundary. |
| Release integrity | Generated and published the O4 ReleaseManifest with passing source, website, build, data-hash, and compatibility gates. |

## Safety decisions

O4 separates **installation guidance**, **verification**, **installation execution**, **authentication**, **target initialization**, and **launch**. Planning is the default and performs no network resolution, no installer command, and no state outside the O4-owned evidence boundary. Verification is read-only and bounded. Installation requires an exact installer ID and explicit `--yes`, but eligibility is independently evaluated against provenance, review status, platform, shell, and command policy.

Official provenance is necessary but not sufficient for execution. A command copied from an official page remains data until it has a reviewed record, an exact platform/shell match, a safe command class, explicit consent, and an auditable state/evidence path. This is particularly important for the official `curl | shell` and PowerShell expression installers documented by the vendor sources [1] [2] [3].

O4 does not assume that runtime-managed auto-updates, package-manager state, Docker state, or vendor uninstall behavior can be rolled back by AI-Workflow. Each record therefore identifies rollback ownership and uses `record-only-unless-officially-supported` as the policy claim boundary.

## Validation evidence

| Gate | Result |
|---|---|
| O4 master validator | Passed: **27/27 checks**. |
| Catalog schema | Passed: **9 records**, three platforms, official provenance fingerprints, read-only verification fields, and all records manual-only. |
| Cross-platform plans | Passed for Linux/Bash, Windows/PowerShell, and macOS/zsh; all plans were zero-write, no-network, zero-command, and had no eligible automatic records. |
| Consent gate | Passed: install without `--yes` returns `O4-CONSENT-REQUIRED` with zero commands. |
| Eligibility gate | Passed: install with `--yes` against a source-reviewed record returns `O4-INSTALL-NOT-ELIGIBLE` with zero commands and zero host/target mutations. |
| Verification boundary | Passed: safe probe path records read-only, zero external writes, zero secrets, and deferred target/auth state. |
| Full source validation | Passed: `make validate` completed all prior controls plus O4; the existing skill suite reported **188 passed, 0 failed**. |
| Source mirror freshness | Passed: `bash scripts/sync-website-data.sh --check`; all **152 generated files** were up to date. |
| Website lint | Passed: `npm run lint`. |
| Website tests | Passed: **39/39 tests**. |
| Website build | Passed: **129 static pages** generated. |
| npm audit | Passed: **0 vulnerabilities** at the high threshold. |
| ReleaseManifest | Passed: schema validation and compatibility returned `compatible` with zero violations. Data hash: `sha256:14d968de7c7e7398177d6b59b8fcdb0907a9dee6a57c65011a18e0a671b3ce1a`. |
| Branch and worktree integrity | Passed: both repositories were on `Dev`, remote tips matched local tips, `main` was untouched, the website mirror matched the source data except for its self-referential manifest, and the four intentionally untracked root planning artifacts remained uncommitted. |

## Dev commits

| Repository | Commit | Role |
|---|---|---|
| `Albadry-Esmat/AI-Workflow` | `f2473e6a6fa516639b79705c4060a28c2df82bac` | O4 implementation, catalog, schemas, policy, contract, fixtures, validator, CLI, Makefile, synchronization mappings, documentation, changelog, and generated source mirror. |
| `Albadry-Esmat/ASE-OS-Website` | `fe59801a136aee1ca7df1d9ff4e5c72b4b470837` | O4 generated-data mirror, typed loaders, and Getting Started representation; used as ReleaseManifest sync-base. |
| `Albadry-Esmat/ASE-OS-Website` | `f0dfaaa9c561798932549effa2101205cf580fa3` | O4 ReleaseManifest publication; final website Dev tip. |

The ReleaseManifest binds source commit `f2473e6a6fa516639b79705c4060a28c2df82bac` to website sync-base commit `fe59801a136aee1ca7df1d9ff4e5c72b4b470837`. The later O4 completion-report commit will be documentation-only and remains compatible under the project’s ancestor-aware release gate.

## Known limitations and explicit non-goals

O4 does not automatically install any runtime. It does not execute `curl | bash`, `curl | sh`, `irm | iex`, package-manager mutation, elevated commands, Docker pulls, binary downloads, or vendor-specific update commands. The current catalog is therefore a guidance and verification catalog, not a universal installer.

O4 does not validate remote installer content at execution time, download vendor manifests, verify package signatures, or establish a complete binary checksum chain. The source fingerprint binds the reviewed catalog record to the research snapshot; it is not a claim that a remote installer script is immutable. A future execution batch must add a stronger artifact-integrity and trust policy before enabling any record.

O4 does not automate provider or runtime authentication, browser approval, API-key approval, target initialization, target-project mutation, or runtime launch. `aiw start` remains unchanged until a later neutral launch-adapter batch defines verified dispatch, permissions, cancellation, evidence, and rollback.

Rollback is recorded as vendor/package-manager ownership unless an official source explicitly documents a supported reversal. O4 does not uninstall runtimes or claim that a vendor-managed auto-update can be reversed by AI-Workflow.

## Rollback procedure

Rollback is Dev-only and should use reversible commits rather than rewriting history. To revert the O4 source implementation:

```bash
git -C /home/ubuntu/AI-Workflow checkout Dev
git -C /home/ubuntu/AI-Workflow revert f2473e6a6fa516639b79705c4060a28c2df82bac
git -C /home/ubuntu/AI-Workflow push origin Dev
```

To revert the website representation and manifest, revert the manifest commit first, then the O4 representation commit:

```bash
git -C /home/ubuntu/ASE-OS-Website checkout Dev
git -C /home/ubuntu/ASE-OS-Website revert f0dfaaa9c561798932549effa2101205cf580fa3
git -C /home/ubuntu/ASE-OS-Website revert fe59801a136aee1ca7df1d9ff4e5c72b4b470837
git -C /home/ubuntu/ASE-OS-Website push origin Dev
```

For local O4 state only, run:

```bash
aiw onboarding recover --o4 --reset-state
```

This removes only `.aiw/onboarding-o4/`; it does not uninstall runtimes, alter package-manager state, touch credentials, or modify target projects. After rollback, rerun source validation, mirror checks, website lint/tests/build, and ReleaseManifest compatibility.

## Decision boundary

O4 is complete. **O5 must not begin automatically.** The next gated batch may address stronger artifact-integrity verification and user-approved installer execution, authentication handoffs, guarded target initialization, or neutral launch dispatch only after explicit user confirmation and a separately defined acceptance boundary.

## References

[1]: https://opencode.ai/docs/ "OpenCode official documentation — installation channels, provider configuration, and project initialization"
[2]: https://code.claude.com/docs/en/setup "Claude Code official documentation — setup, verification, integrity, updates, and authentication"
[3]: https://learn.chatgpt.com/docs/codex/cli "OpenAI official Codex CLI documentation — installation channels and first-run sign-in"

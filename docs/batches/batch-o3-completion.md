# Onboarding Batch O3 Completion Report

**Batch:** Onboarding O3 — Guided Agent-Neutral Onboarding
**Status:** Complete and gated
**Date:** 2026-08-18
**Author:** Manus AI
**Branches:** `Dev` only; `main` was not modified

## Executive summary

Onboarding Batch O3 adds a guided first-use layer on top of O2. Users can now choose an explicit onboarding lane, review a deterministic no-write plan, apply AI-Workflow-owned core setup only after explicit consent, inspect guided runtime diagnostics, and recover O3-owned state. The design remains agent-neutral and does not invent platform-specific runtime installers or provider authentication behavior.

The recommended sequence is:

```text
aiw onboarding plan --lane native
aiw onboarding apply --yes --lane native --agent auto
aiw onboarding doctor --json
aiw agent detect --json
aiw agent use auto --json
aiw auth status --json
```

The no-write planning path is the default. Runtime installation, provider login, target initialization, and runtime launch remain explicitly deferred. The O3 apply path may reuse the deterministic O1 core setup after `--yes`; it does not install an agent runtime or execute a platform-specific installer.

## Scope delivered

| Area | Delivered result |
|---|---|
| Guided command surface | Added `aiw onboarding plan`, `aiw onboarding apply --yes`, `aiw onboarding doctor`, and `aiw onboarding recover`, plus `make onboarding` and `make validate-onboarding-o3`. |
| Onboarding lanes | Added explicit `native`, `project-local`, and `dev-container` lane plans. Each lane states its host boundary, network ownership, target-mutation guarantee, and runtime handling. |
| Deterministic planning | O3 plan mode is zero-write and disables network resolution for the guided planning layer. It reports preflight, core toolchain, runtime detection, selection, authentication, target initialization, and launch status separately. |
| Explicit apply consent | Apply requires `--yes`. Without explicit consent, O3 fails closed and performs zero mutations. Resume is supported through `--resume`. |
| Runtime diagnostics | O3 consumes the source-owned runtime catalog and performs only safe version probes. It reports official documentation, support level, available installation channels, and `user-controlled-deferred` installation status. |
| Runtime selection | Explicit selection fails closed when an adapter is unavailable. Automatic selection remains deterministic, records the reason, and defers rather than fabricating a runtime when none is detected. Silent fallback is forbidden. |
| Installation boundary | O3 executes zero runtime installer commands. The catalog’s channels are presented as user actions until verified platform-specific commands, provenance, checksums, consent, and rollback controls are available. |
| Authentication and target boundary | O3 stores no raw secrets, does not automate login, does not initialize or modify target projects, and does not launch a provider-specific runtime. |
| State and recovery | Added an atomic, redacted O3 state schema under `.aiw/onboarding-o3/` with lane, consent, step, runtime, auth, target, and owned-path recovery metadata. |
| Controls and fixtures | Added O3 state/policy/contract schemas, 12 deterministic safety fixtures, and the 23-check `validate-onboarding-o3-controls.py` master validator. |
| Documentation | Added `docs/guided-agent-neutral-onboarding.md` and the O3 changelog entry. |
| Website representation | Mirrored O3 contract/policy data and added a Getting Started panel explaining plan-first setup, lane selection, consent, runtime deferral, and recovery. |
| Release integrity | Generated and published the O3 ReleaseManifest with passing source, website, build, and data-hash compatibility gates. |

## Safety and implementation decisions

O3 deliberately separates **planning**, **core setup**, **runtime installation**, **authentication**, **target initialization**, and **launch**. A plan can be reviewed without writing state. Applying core setup is a separate action that requires explicit `--yes`. Runtime installation is not treated as a generic shell command because the catalog currently records channels and documentation but not verified, platform-specific installer procedures.

The runtime adapter catalog remains the authority for safe detection and selection. O3 uses the same short version probes as O2, executes them with a reduced environment, and records no command output or secrets. Explicit selection never falls back. Automatic selection uses deterministic catalog/policy precedence and returns a deferred result when no adapter is available.

Authentication remains delegated. O3 reports `delegated`, `login_started: false`, and `raw_secret_values: 0`; it does not prompt for, copy, store, or print credentials. Target initialization and runtime launch are also deferred, so O3 cannot claim provider-specific sandboxing, approvals, safety, or evidence beyond the catalog’s declared maturity.

## Validation evidence

| Gate | Result |
|---|---|
| O3 master validator | Passed: **23/23 checks**. |
| O3 plan smoke test | Passed for native, project-local, and dev-container lanes; all plans reported zero mutations, disabled planning network, and zero raw secrets. |
| Consent gate | Passed: `apply` without `--yes` returns `O3-CONSENT-REQUIRED` with zero mutations. |
| Runtime selection safety | Passed: explicit missing runtime returns `O3-ADAPTER-MISSING` with fallback disabled; auto selection defers safely when no adapter is detected. |
| Full source validation | Passed: `make validate` completed with all prior controls, O0, O1, O2, O3, evaluation definitions, and regression suites. The existing skill suite reported **188 passed, 0 failed**. |
| Source mirror freshness | Passed: `bash scripts/sync-website-data.sh --check`; all **148 generated files** were up to date. |
| Website lint | Passed: `npm run lint`. |
| Website tests | Passed: **39/39 tests**. |
| Website build | Passed: **129 static pages** generated. |
| npm audit | Passed: **0 vulnerabilities** reported at the high threshold. |
| ReleaseManifest | Passed: schema validation and compatibility returned `compatible` with zero violations. Data hash: `sha256:ae769bc18274837ce6d74bcf1de84a4ff511ed5549211480e519a8ba75a94ba5`. |
| Branch and worktree integrity | Passed before the completion-report commit: both repositories were on `Dev`, source and website commits were pushed, `main` was untouched, and only the four intentionally untracked root planning artifacts remained outside the source commit. |

## Dev commits

| Repository | Commit | Role |
|---|---|---|
| `Albadry-Esmat/AI-Workflow` | `43eea9c6b48206579ae0bc68d4aa892c03ad00a5` | O3 guided onboarding implementation, schemas, policy, contract, fixtures, validator, CLI, documentation, changelog, synchronization mappings, and generated source mirror. |
| `Albadry-Esmat/ASE-OS-Website` | `a32b9b04ae40f617d66b99dbfd2db2eca1c80d60` | O3 generated-data mirror and Getting Started representation; used as the ReleaseManifest sync-base. |
| `Albadry-Esmat/ASE-OS-Website` | `5d74a4f837d139685aafa7477f29bdeb6d6c74fa` | O3 ReleaseManifest publication; final website Dev tip. |

The ReleaseManifest binds source commit `43eea9c6b48206579ae0bc68d4aa892c03ad00a5` to website sync-base commit `a32b9b04ae40f617d66b99dbfd2db2eca1c80d60`. The later completion-report source commit is documentation-only and remains compatible under the ancestor-aware release gate.

## Known limitations and explicit non-goals

O3 does not install OpenCode, Claude Code, Codex CLI, or any other runtime. It does not execute native installers, package-manager runtime installation, container provisioning, binary downloads, checksum verification, or runtime rollback. Those actions require a later adapter-specific batch with verified commands and provenance.

O3 does not automate browser, device, provider, GitHub, or runtime login. It does not accept raw secrets, write `.env` values, or infer authentication from an environment variable. Authentication remains owned by the selected runtime.

O3 does not initialize or mutate a target project and does not replace the legacy OpenCode-specific `aiw start` behavior with a neutral launch dispatcher. Target initialization and launch require a separate guarded batch with backups, target scope validation, adapter-specific consent, launch evidence, cancellation, and rollback.

The automatic selection result is intentionally conservative. When no catalog adapter is detected, O3 reports a deferred selection instead of silently selecting an unavailable runtime. Candidate adapters remain candidate/generic support levels; O3 does not promote first-class safety or evidence claims.

The O3 plan’s network guarantee applies to the guided planning layer. The approved O1 core setup invoked by explicit O3 apply may use the user’s package channels when local dependencies are absent. This distinction is surfaced in the plan and contract.

## Rollback procedure

Rollback is Dev-only and should use reversible commits rather than rewriting history. To revert the O3 source implementation:

```bash
git -C /home/ubuntu/AI-Workflow checkout Dev
git -C /home/ubuntu/AI-Workflow revert 43eea9c6b48206579ae0bc68d4aa892c03ad00a5
git -C /home/ubuntu/AI-Workflow push origin Dev
```

To revert the website representation and release artifact, revert the manifest commit first, then the O3 representation commit:

```bash
git -C /home/ubuntu/ASE-OS-Website checkout Dev
git -C /home/ubuntu/ASE-OS-Website revert 5d74a4f837d139685aafa7477f29bdeb6d6c74fa
git -C /home/ubuntu/ASE-OS-Website revert a32b9b04ae40f617d66b99dbfd2db2eca1c80d60
git -C /home/ubuntu/ASE-OS-Website push origin Dev
```

For local O3 state only, run:

```bash
aiw onboarding recover --reset-state
```

This removes only `.aiw/onboarding-o3/`; it does not remove runtime binaries, credentials, target-project files, or pre-existing user state. After any rollback, rerun source validation, mirror checks, website lint/tests/build, and ReleaseManifest compatibility before treating the branches as synchronized.

## Decision boundary

O3 is complete. **O4 must not begin automatically.** The next gated batch may address verified runtime installer adapters, deeper authentication handoffs, guarded target initialization, or neutral launch dispatch only after explicit user confirmation and a separately defined acceptance boundary.

## Evidence references

The authoritative implementation is defined by the [O3 contract](../../config/onboarding-o3-contract.json), [O3 policy](../../config/onboarding-o3-policy.json), [O3 state schema](../../config/onboarding-o3-state-schema.json), [O3 fixtures](../../evals/onboarding-o3/fixtures.json), [O3 validator](../../scripts/validate-onboarding-o3-controls.py), and [guided onboarding guide](../guided-agent-neutral-onboarding.md). The generated website data is maintained by [the synchronization script](../../scripts/sync-website-data.sh) and rendered in the website [Getting Started page](https://github.com/Albadry-Esmat/ASE-OS-Website/blob/Dev/src/app/getting-started/page.tsx).

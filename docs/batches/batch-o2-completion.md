# Onboarding Batch O2 Completion Report

**Batch:** Onboarding O2 — Resumable Agent-Neutral Onboarding
**Status:** Complete and gated
**Date:** 2026-08-17
**Author:** Manus AI
**Branches:** `Dev` only; `main` was not modified

## Executive summary

Onboarding Batch O2 turns the neutral O0 contract and deterministic O1 toolchain into a usable, resumable onboarding layer. AI-Workflow can now run a structured setup and diagnostics flow, detect candidate runtimes without installing anything, select a runtime explicitly or by deterministic policy, run a no-secret zero-write demo, report delegated authentication status, and recover only its own interrupted state.

The resulting first-use path is:

```text
aiw setup → aiw doctor → aiw agent detect → aiw agent use auto → aiw demo → aiw auth status
```

O2 preserves agent neutrality. OpenCode, Claude Code, Codex CLI, and a generic user-managed command remain catalog entries rather than mandatory dependencies. Runtime installation, provider login, target-project initialization or mutation, runtime launch, and provider-specific safety claims remain outside the O2 boundary and are explicitly deferred.

## Scope delivered

| Area | Delivered result |
|---|---|
| Resumable state contract | Added `config/onboarding-o2-state-schema.json` for redacted, resumable state with atomic writes, step status, retry metadata, runtime selection, delegated auth status, demo evidence, and owned-path recovery boundaries. |
| Fail-closed policy | Added `config/onboarding-o2-policy-schema.json` and `config/onboarding-o2-policy.json`; the policy forbids raw secrets, runtime installation, login automation, target mutation, silent fallback, and network use in the no-secret demo. |
| O2 execution contract | Added `config/onboarding-o2-contract.json` with phases, command status, default/no-secret/resume sequences, deterministic selection rules, authentication boundaries, diagnostics, recovery guarantees, and non-goals. |
| Onboarding engine | Added `scripts/onboarding-o2.py` with `setup`, `doctor`, runtime listing/detection/selection, no-secret demo, delegated auth status, and owned-state recovery. State is stored under `.aiw/onboarding-o2/` and evidence under its redacted JSONL boundary. |
| CLI surface | Added `aiw setup`, `aiw doctor`, `aiw agent list`, `aiw agent detect`, `aiw agent use <adapter-id|auto>`, `aiw demo`, `aiw auth status`, and `aiw recover`. Added `aiw validate-onboarding-o2` and included the O2 gate in `make validate`. |
| Safety fixtures and controls | Added 12 deterministic fixtures in `evals/onboarding-o2/fixtures.json` and the 22-check master validator `scripts/validate-onboarding-o2-controls.py`. |
| Documentation | Added `docs/resumable-agent-neutral-onboarding.md` and the O2 entry in `docs/changelog.md`. |
| Source-owned mirror | Extended `scripts/sync-website-data.sh` to mirror `onboarding-o2.json` and `onboarding-o2-policy.json`; generated data was copied into the companion website without hand-editing the mirror. |
| Website representation | Added an O2 loader and a Getting Started panel showing resumability, deterministic runtime selection, delegated login, no-secret/zero-write demo guarantees, and owned-path recovery. |
| Release integrity | Generated a ReleaseManifest binding the source and website Dev commits, validated data hash, and recorded passing source, website, and build gates. |

## O2 behavior and security boundaries

The O2 setup ledger is written atomically and contains only redacted metadata. It does not store raw credentials, environment values, command output, target-project contents, or provider tokens. Recovery resets or removes only O2-owned state and does not remove runtime binaries, credentials, target files, or pre-existing user state.

Runtime detection is a short, read-only executable probe from the source-owned adapter catalog. It does not install a runtime, start a provider, invoke login, initialize a project, or mutate a target. Explicit selection fails closed when an adapter is missing or incompatible. Automatic selection uses the policy-defined precedence, fails when no adapter is available, and records the reason rather than silently falling back.

The O2 demo is deterministic and no-secret. Its contract requires disabled network access, zero external writes, zero secret values, zero target-project mutations, and deterministic output. Authentication status is delegated and redacted: O2 reports the boundary but does not automate login or claim ownership of provider credentials.

## Validation evidence

| Gate | Result |
|---|---|
| O2 master validator | Passed: **22/22 checks** after correcting the healthy structured `doctor --json` exit expectation and the no-state recovery `runtime_changes` field. |
| Full source validation | Passed: `make validate` completed across the previous batch controls, 188 skill checks, O0, O1, O2, evaluation definitions, and regression suites. |
| O2 evaluation fixtures | Passed: 12 deterministic safety scenarios covering resumability, redaction, selection, authentication, demo, recovery, and CLI behavior. |
| Source mirror freshness | Passed: `bash scripts/sync-website-data.sh --check`; all **146 generated files** were up to date. |
| Website lint | Passed: `npm run lint`. |
| Website tests | Passed: **39/39 tests**. |
| Website build | Passed: **129 static pages** generated by Next.js 16.3.1. |
| npm audit | Passed: **0 vulnerabilities** reported at the high threshold after the prior O1 remediation. |
| ReleaseManifest | Passed: schema validation succeeded; source/website compatibility returned `compatible` with zero violations. Data hash: `sha256:5634b4661845f0e253b819aef566955f707d233131603e6347e9dc8f26ca0d96`. |
| Branch and worktree integrity | Passed: both repositories are on `Dev`, local `HEAD` equals `origin/Dev`, both worktrees are clean except the four intentionally untracked root planning artifacts in AI-Workflow, and `main` was not modified. |
| Mirror parity | Passed: AI-Workflow `website/data/` and ASE-OS-Website `data/` match for all source-owned files; the website-only `release-manifest.json` is the sole expected difference. |

## Dev commits

| Repository | Commit | Role |
|---|---|---|
| `Albadry-Esmat/AI-Workflow` | `40c65c38900617acab46464e39e493facd12f9d8` | Complete O2 implementation, source validation controls, documentation, changelog, and generated source mirror; pushed to `Dev`. |
| `Albadry-Esmat/ASE-OS-Website` | `7beffecbbaa1bd7af431c6513705a5445931f384` | O2 generated-data mirror and Getting Started representation; pushed to `Dev` and used as the ReleaseManifest `sync-base`. |
| `Albadry-Esmat/ASE-OS-Website` | `a59a8f7e310b0c49b5733ede7c41c31c7c7d5fab` | ReleaseManifest publication; pushed to `Dev` as the final website tip. |

The ReleaseManifest records source commit `40c65c38900617acab46464e39e493facd12f9d8` and website sync-base commit `7beffecbbaa1bd7af431c6513705a5445931f384`. The final website manifest commit is a documentation/release-artifact descendant and does not change the source-owned website data represented by the hash.

## Known limitations and explicit non-goals

O2 does not install Python, Node, Git, OpenCode, Claude Code, Codex CLI, or any other agent runtime. Host prerequisites and provider-specific runtime installation remain user-controlled or adapter-owned. Detection reports what is available; it does not make a runtime available.

O2 does not automate browser, device, or provider login and does not accept raw secrets. `aiw auth status` is a delegated, redacted status boundary. A future adapter may add an authentication handoff only after its own consent, redaction, and evidence controls are reviewed.

O2 does not launch an agent runtime, initialize a target project, modify target-project files, provision a Dev Container/Codespace, or make first-class safety/evidence claims for candidate adapters. Those capabilities remain later gated work. The legacy `aiw start` path is not converted into a neutral launch dispatcher by O2.

The current automatic selection behavior is intentionally conservative: when no catalog adapter is detected, `aiw agent use auto` fails closed rather than fabricating a provider or falling back silently. Runtime-specific version compatibility and provider safety mapping remain adapter-level work.

The no-secret demo’s no-network/no-write guarantee applies to the O2 demo and check-only verification. A normal dependency setup may still install project dependencies through the user’s approved package channels when local environments are absent.

## Rollback procedure

Rollback is Dev-only and should use reversible commits rather than rewriting history. To remove the O2 source implementation while preserving the earlier O0/O1 history:

```bash
git -C /home/ubuntu/AI-Workflow checkout Dev
git -C /home/ubuntu/AI-Workflow revert 40c65c38900617acab46464e39e493facd12f9d8
git -C /home/ubuntu/AI-Workflow push origin Dev
```

To roll back the website representation and release artifact, revert the final website commit first and then the O2 representation commit:

```bash
git -C /home/ubuntu/ASE-OS-Website checkout Dev
git -C /home/ubuntu/ASE-OS-Website revert a59a8f7e310b0c49b5733ede7c41c31c7c7d5fab
git -C /home/ubuntu/ASE-OS-Website revert 7beffecbbaa1bd7af431c6513705a5445931f384
git -C /home/ubuntu/ASE-OS-Website push origin Dev
```

For local O2 state only, use `aiw recover --reset-state` or remove `.aiw/onboarding-o2/`. This does not remove runtime installations, credentials, or target-project files. After a Git rollback, rerun source validation, mirror checks, website tests/build, and the ReleaseManifest compatibility gate before treating the branches as synchronized again.

## Decision boundary

O2 is complete. **O3 must not begin automatically.** The next gated batch may address the guided setup wizard, runtime installation and detection/selection implementation, or another explicitly approved onboarding capability only after the user provides confirmation.

## Evidence references

The implementation is defined by the source-owned [O2 contract](../../config/onboarding-o2-contract.json), [O2 policy](../../config/onboarding-o2-policy.json), [state schema](../../config/onboarding-o2-state-schema.json), [O2 fixtures](../../evals/onboarding-o2/fixtures.json), [O2 validator](../../scripts/validate-onboarding-o2-controls.py), and [resumable onboarding guide](../resumable-agent-neutral-onboarding.md). The companion representation is generated by [the synchronization script](../../scripts/sync-website-data.sh) and surfaced in the website [Getting Started page](https://github.com/Albadry-Esmat/ASE-OS-Website/blob/Dev/src/app/getting-started/page.tsx).

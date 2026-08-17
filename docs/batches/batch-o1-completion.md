# Onboarding Batch O1 Completion Report

**Batch:** Onboarding O1 — Deterministic Core and Adapter Toolchain
**Status:** Complete and gated
**Date:** 2026-08-17
**Author:** Manus AI
**Branches:** `Dev` only; `main` was not modified

## Executive summary

Onboarding Batch O1 makes the AI-Workflow core reproducible without binding it to OpenCode, Claude Code, Codex CLI, or any other named agent runtime. It establishes a source-owned toolchain manifest and policy, project-local Python and Node dependency environments, deterministic lockfile behavior, check-only/no-network verification, and a security boundary in which AI-Workflow does not install or authenticate agent runtimes.

The resulting first-use core path is now:

```text
make setup → aiw health → aiw toolchain-check → aiw validate-onboarding-o1
```

`make setup` creates `.venv`, installs exact Python requirements, installs root Node dependencies with `npm ci` from the committed lockfile, and does not mutate system-global Python or npm packages. Runtime installation, provider authentication, runtime selection, target-project preflight, and neutral runtime launch remain explicitly deferred to O2.

## Scope delivered

| Area | Delivered result |
|---|---|
| Toolchain contract | `config/toolchain-manifest.json` and `config/toolchain-manifest-schema.json` define supported Git, Python, Node, and npm ranges, local dependency locations, four agent adapters, runtime ownership, and verification behavior. |
| Toolchain policy | `config/toolchain-policy.json` and `config/toolchain-policy-schema.json` forbid global dependency mutation, require lockfiles and pinned Python requirements, require non-mutating/no-network checks, and require recreatable local environments. |
| Python dependencies | Added exact-pinned `requirements-dev.txt` for `jsonschema==4.23.0` and `PyYAML==6.0.3`; setup installs them only into `.venv`. |
| Node dependencies | Added direct pinned AJV libraries to the root manifest and lockfile; removed the vulnerable `ajv-cli` package and replaced its command surface with `scripts/validate-json-schema.mjs`. |
| Setup and health | Reworked `scripts/setup.sh`, `scripts/health-check.sh`, and `scripts/validate-skills.sh` to use project-local dependencies, treat named runtimes and credentials as optional, and keep the no-secret path usable. |
| Check-only verification | Added `scripts/check-toolchain.py`, which probes versions, validates supported ranges, checks lockfiles and local environments, and performs no installs, mutations, or network resolution in its gated mode. |
| O1 controls | Added `scripts/validate-onboarding-o1-controls.py` and `evals/onboarding-o1/fixtures.json` for manifest, policy, lockfile, global-mutation, version, consent, and recovery invariants. |
| CLI and Makefile | Added `aiw toolchain-check`, `aiw validate-onboarding-o1`, `make toolchain-check`, and `make validate-onboarding-o1`; O1 is included in the full source validation sequence. |
| Documentation | Added `docs/deterministic-toolchain.md`, updated `docs/how-to-use.md`, and recorded the O1 change in `docs/changelog.md`. |
| Website representation | Synced toolchain data to the generated website mirror and added a deterministic-toolchain section to the Getting Started page. The website now states that core dependencies are local and agent runtimes are interchangeable and user-controlled. |

## Security remediation decision

The initial O1 implementation used `ajv-cli` as a project-local validation command. The source npm audit identified two high-severity advisories through `ajv-cli` and its `fast-json-patch` dependency. This was remediated before the completion boundary by removing `ajv-cli`, adding direct pinned `ajv` and `ajv-formats` libraries, and introducing a small project-owned wrapper with the same validation intent.

The final source and website audits both report zero vulnerabilities at the high threshold and zero total vulnerabilities in the refreshed audit summaries. O1 intentionally does not claim that all future agent-runtime installers are vulnerability-free; runtime installation remains outside the core and must be implemented through separately reviewed adapters.

## Validation evidence

| Gate | Result |
|---|---|
| Project-local setup smoke test | Passed: `.venv` created, pinned Python requirements installed, root `npm ci` completed, local schema validator found, and setup completed without failures. |
| Health check | Passed: 13 checks passed; warnings were limited to absent optional agent runtimes, graphify, and credentials. No named runtime was required. |
| Skill validation | Passed: 188 checks, 0 failures. |
| Full source validation | Passed: `make validate` completed across prior batch controls, O0, O1, evaluation definitions, and regression suites. |
| O1 master validator | Passed: all manifest, policy, fixture, setup, lockfile, version, consent, recovery, and check-only assertions passed. |
| O1 toolchain check | Passed in `--check-only --no-network` mode; all required host versions were within policy, local environments and lockfiles were present, and no writes or network resolution were performed. |
| Source mirror freshness | Passed: all 144 generated source mirror files were up to date. |
| Website tests | Passed: 39/39 tests. |
| Website lint | Passed. |
| Website build | Passed: 129 static pages generated. |
| npm audits | Passed: 0 vulnerabilities in both AI-Workflow and ASE-OS-Website after the AJV remediation. |
| ReleaseManifest | Passed: source/website compatibility returned `compatible` with zero violations; data hash matched `sha256:4188b5b34f0d658474e9d5bb358be4ef012e10f0410cbe8e9afe69113bab2149`. |
| Planning-artifact preservation | Passed: the four root `AI-Workflow-*.md` planning artifacts remain intentionally untracked and were not committed. |

## Dev commits

| Repository | Implementation and remediation commits | Final completion-boundary commit |
|---|---|---|
| AI-Workflow | `b2f7da1a90ae1fbd08e84b97c8a1161ffaefb451` — deterministic O1 toolchain; `d71deae8518ed4e55bff13df58fb5ee1a0a7a183` — AJV security remediation and documentation alignment | To be added after this report is committed and pushed |
| ASE-OS-Website | `72da1c83e1491a13a07f396ac408d211d8ca88e4` — O1 Getting Started representation; `05b9cdbf500024719252075ee0f26837727a62f9` — final generated-data and manifest alignment | `05b9cdbf500024719252075ee0f26837727a62f9` |

The current ReleaseManifest binds to source commit `d71deae8518ed4e55bff13df58fb5ee1a0a7a183`; the completion-report commit will be a documentation-only descendant and remains compatible under the existing ancestor-aware release gate.

## Known limitations and explicit non-goals

O1 does not install Python, Node, Git, or an agent runtime for the user. Those host prerequisites must already exist or be installed through the user’s platform-approved method. The manifest declares supported ranges and exact project dependencies; it does not yet provide platform-specific binary archives or a complete checksum lock for host tools.

The no-network behavior applies to check-only verification. A normal `make setup` may still download dependencies through npm and pip when the local environments are absent. An offline installation mode is declared by policy but is not yet a guided, cache-aware installer experience.

O1 does not implement runtime detection and selection, browser/device authentication, provider onboarding, target-project preflight, a resumable setup wizard, transactional installation, Dev Container/Codespace packaging, or neutral launch dispatch. These are intentionally reserved for O2 and later batches.

The `.opencode` directory remains in the repository for compatibility with the existing skill representation. O1 no longer treats OpenCode as a required runtime, but the legacy `aiw start` path is still OpenCode-specific until the O2 adapter-aware launch work is approved.

## Rollback procedure

Rollback must remain Dev-only and use reversible commits rather than rewriting branch history. For the source repository, first revert the remediation commit and then the O1 implementation commit if a complete rollback is required:

```bash
git -C /home/ubuntu/AI-Workflow checkout Dev
git -C /home/ubuntu/AI-Workflow revert d71deae8518ed4e55bff13df58fb5ee1a0a7a183
git -C /home/ubuntu/AI-Workflow revert b2f7da1a90ae1fbd08e84b97c8a1161ffaefb451
git -C /home/ubuntu/AI-Workflow push origin Dev
```

For the website, revert the final generated-data alignment, the O1 UI commit, and the automated source-data synchronization commit in reverse chronological order. The exact commits are `05b9cdbf500024719252075ee0f26837727a62f9`, `72da1c83e1491a13a07f396ac408d211d8ca88e4`, and `60313ac2ed112da6be030d1baf1f0671eed77ea8`:

```bash
git -C /home/ubuntu/ASE-OS-Website checkout Dev
git -C /home/ubuntu/ASE-OS-Website revert 05b9cdbf500024719252075ee0f26837727a62f9
git -C /home/ubuntu/ASE-OS-Website revert 72da1c83e1491a13a07f396ac408d211d8ca88e4
git -C /home/ubuntu/ASE-OS-Website revert 60313ac2ed112da6be030d1baf1f0671eed77ea8
git -C /home/ubuntu/ASE-OS-Website push origin Dev
```

For local dependency rollback only, remove disposable environments and recreate them from the restored manifests:

```bash
rm -rf /home/ubuntu/AI-Workflow/.venv /home/ubuntu/AI-Workflow/node_modules
cd /home/ubuntu/AI-Workflow
make setup
```

## Decision boundary

O1 is complete. **O2 must not begin automatically.** The next gated batch may address the resumable setup wizard, deterministic diagnostics, and agent-neutral runtime detection/selection only after explicit confirmation.

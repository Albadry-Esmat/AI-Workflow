# Onboarding Batch O7 Completion Report

**Batch:** O7 — Vendor-Neutral Verifier Adapters and Optional Evidence Refresh  
**Status:** Complete  
**Date:** 2026-08-18  
**Source branch:** `AI-Workflow/Dev`  
**Website branch:** `ASE-OS-Website/Dev`

## Executive summary

Onboarding Batch O7 is complete on the two `Dev` branches. AI-Workflow now exposes a vendor-neutral verifier-adapter control plane for GitHub CLI artifact attestations, Sigstore Cosign blobs, npm registry provenance, and a deterministic local O6 delegate. The control plane is **offline-first**, claim-strict, fail-closed, and verification-only. Optional network refresh is explicit, HTTPS-only, allowlisted, bounded by timeout and response-byte budgets, candidate-only, evidence-producing, and forbidden from overwriting or activating an active trust root.

The companion website consumes the generated source-owned mirror and represents O7 in its typed data layer and Getting Started page. The source validation suite, O7 controls, website tests, production build, dependency audit, mirror check, ReleaseManifest validation, and compatibility gate all passed. No `main` branch was modified. O8 has not been started.

## Delivered scope

| Area | Delivered behavior | Safety boundary |
|---|---|---|
| Adapter catalog | Four deterministic records for GitHub CLI, Cosign, npm, and the local O6 delegate. | Exact adapter selection; unknown records fail closed. |
| Verification | Offline bundle or key modes where supported; strict artifact subject and provenance claims. | Missing or unknown claims fail closed. |
| Network refresh | Explicit opt-in only, with HTTPS host allowlists, bounded timeout, bounded bytes, one-request budget, redacted evidence, and candidate-only writes. | Network is disabled by default; active roots cannot be overwritten or activated automatically. |
| External tools | Existing-tool plans for `gh`, `cosign`, and `npm`; no automatic installation. | Missing tools fail closed with manual guidance. |
| Authority | Installation, artifact execution, authentication automation, target initialization, target mutation, and launch remain outside O7 authority. | All corresponding authority fields are disabled, deferred, or zero. |
| Recovery | O7-owned state can be reset while candidate evidence and active roots are preserved. | Target projects and runtime installations remain untouched. |
| Website representation | Generated O7 JSON mirror, typed loaders, and an O7 verifier panel in Getting Started. | Website data remains generated from AI-Workflow source files. |

The adapter design follows the documented offline attestation and local verification capabilities of GitHub CLI and Sigstore Cosign, while treating npm provenance as registry-bound and therefore online-only in the current catalog [1] [2] [3]. O7 does not infer that a successful verification grants installation or execution permission.

## User-facing commands

The following commands are now routed through `aiw` and represented in the Makefile:

```bash
aiw onboarding verifier-plan [--adapter <id>] [--json]
aiw onboarding verifier-verify --adapter <id> --artifact <path> [--json]
aiw onboarding verifier-refresh-plan --adapter <id> [--json]
aiw onboarding verifier-refresh --adapter <id> --yes [--json]
aiw onboarding recover --o7 [--reset-state] [--json]
```

The corresponding Make targets are `validate-onboarding-o7`, `onboarding-verifier-plan`, `onboarding-verifier-verify`, `onboarding-verifier-refresh-plan`, and `onboarding-verifier-refresh`. The full `make validate` gate now includes O7 immediately after O6.

## Implementation files

| Repository | Key files |
|---|---|
| AI-Workflow | `scripts/onboarding-o7.py`, `scripts/validate-onboarding-o7-controls.py`, `aiw`, `Makefile` |
| AI-Workflow | `config/onboarding-o7-contract.json`, `config/onboarding-o7-policy.json`, `config/onboarding-o7-policy-schema.json`, `config/onboarding-o7-state-schema.json` |
| AI-Workflow | `config/verifier-adapter-o7-catalog.json`, `config/verifier-adapter-o7-catalog-schema.json`, `evals/onboarding-o7/fixtures.json` |
| AI-Workflow | `scripts/sync-website-data.sh`, `docs/vendor-neutral-verifier-adapters.md`, `docs/changelog.md` |
| Website | `src/lib/data.ts`, `src/app/getting-started/page.tsx`, and the five generated O7 data files under `data/` |

## Validation evidence

| Gate | Result | Evidence |
|---|---:|---|
| O7 master validator | **PASS** | **37/37 checks** passed, including catalog/state/policy schemas, strict claims, offline default, refresh boundaries, local delegate verification, failure fixtures, CLI routing, and recovery. |
| Full source validation | **PASS** | `make validate` completed the existing skill, contract, batch, onboarding O0–O6, O7, and evaluation gates. |
| Skill suite | **PASS** | **188 passed, 0 failed**. |
| Source-to-website mirror | **PASS** | `bash scripts/sync-website-data.sh --check`; all **168 generated files** were up to date. |
| Website lint | **PASS** | `npm run lint`. |
| Website tests | **PASS** | **39/39 tests** passed. |
| Website production build | **PASS** | `npm run build`; **129 static pages** generated. |
| Dependency audit | **PASS** | `npm audit --audit-level=high`; **0 vulnerabilities** found. |
| Data integrity | **PASS** | Source and website generated data compared with no missing, extra, or changed files before the self-referential manifest was added. |
| ReleaseManifest schema | **PASS** | Manifest validated with `scripts/generate-release-manifest.py --validate`. |
| Release compatibility | **PASS** | Verdict `compatible`; zero violations. |
| Branch/worktree integrity | **PASS** | Both repositories are on `Dev` and match their remotes; only the four intentionally untracked root planning artifacts remain in AI-Workflow. |
| `main` isolation | **PASS** | Source and website `main` and `origin/main` remained unchanged at `ddfe3ff852d3b160153f3fec62b39337bdd44acc`. |

The ReleaseManifest records data hash `sha256:849d44fdefe36ece5ede7d997136ba8b4767e88a53220e39bc9e21831a4cf5d6`, source validation `pass`, website validation `pass`, website build `pass`, and compatibility verdict `compatible`.

## Dev commits

| Repository | Commit | Role |
|---|---|---|
| `Albadry-Esmat/AI-Workflow` | `a61c0a62324f3503d3fde2f1126a8fef3f1766e1` | O7 implementation, schemas, policy, contract, adapter catalog, fixtures, validator, CLI, Makefile, synchronization mappings, documentation, changelog, and generated source mirror. |
| `Albadry-Esmat/ASE-OS-Website` | `7a96b34485c1b14702dfd3671e4ce6a52de1c2ce` | O7 generated-data mirror, typed loaders, and Getting Started representation; ReleaseManifest sync base. |
| `Albadry-Esmat/ASE-OS-Website` | `e20fcd3995ba125e1a568a483bd97124b5930448` | O7 ReleaseManifest publication; final website `Dev` tip. |

The ReleaseManifest binds source commit `a61c0a62324f3503d3fde2f1126a8fef3f1766e1` to website sync-base commit `7a96b34485c1b14702dfd3671e4ce6a52de1c2ce`. The later manifest commit is the final website tip and is covered by the compatibility gate.

## Known limitations and explicit non-goals

O7 does not install GitHub CLI, Cosign, npm, or any other verifier. The external adapter records describe safe verification plans and fail closed when the executable is unavailable. The local O6 delegate is the deterministic offline fixture path used by the validator.

O7 does not perform online verification by default. npm provenance remains modeled as an online-registry mode, so it requires an explicitly enabled network path and a suitable pre-existing npm installation. Optional refresh is deliberately not a trust-root activation mechanism: candidates require a later, separately governed review and activation process.

O7 does not automate provider authentication, accept or store raw secrets, initialize or mutate a target project, install or execute a runtime, or launch an agent. These are deferred to later batches and remain outside the current contract. The four root planning artifacts remain intentionally untracked and were not included in either source or website commit.

## Rollback procedure

Rollback is Dev-only and should use reversible commits rather than rewriting history. Revert the O7 source implementation first:

```bash
git -C /home/ubuntu/AI-Workflow checkout Dev
git -C /home/ubuntu/AI-Workflow revert a61c0a62324f3503d3fde2f1126a8fef3f1766e1
git -C /home/ubuntu/AI-Workflow push origin Dev
```

Then revert the website manifest and representation:

```bash
git -C /home/ubuntu/ASE-OS-Website checkout Dev
git -C /home/ubuntu/ASE-OS-Website revert e20fcd3995ba125e1a568a483bd97124b5930448
git -C /home/ubuntu/ASE-OS-Website revert 7a96b34485c1b14702dfd3671e4ce6a52de1c2ce
git -C /home/ubuntu/ASE-OS-Website push origin Dev
```

For local O7 state recovery without code rollback:

```bash
aiw onboarding recover --o7 --reset-state --json
```

This removes only O7-owned state and evidence, preserves candidate evidence and active roots, and leaves artifacts, runtimes, credentials, target projects, and package-manager state untouched. After rollback, rerun `make validate`, `bash scripts/sync-website-data.sh --check`, website lint/tests/build/audit, and ReleaseManifest compatibility.

## Decision boundary

O7 is complete and the implementation is paused here. **No O8 work has started.** Proceeding to Onboarding Batch O8 requires explicit user confirmation.

## References

[1]: https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/verify-attestations-offline "GitHub Docs — Verifying attestations offline"
[2]: https://docs.sigstore.dev/cosign/verifying/verify/ "Sigstore Docs — Verifying Signatures"
[3]: https://docs.npmjs.com/viewing-package-provenance "npm Docs — Viewing package provenance"

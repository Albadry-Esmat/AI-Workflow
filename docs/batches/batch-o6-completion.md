# Onboarding Batch O6 Completion Report

**Batch:** Onboarding O6 — Offline Publisher Signature and Release Attestation Verification
**Status:** Complete and gated
**Date:** 2026-08-18
**Author:** Manus AI
**Branches:** `Dev` only; `main` was not modified

## Executive summary

Onboarding Batch O6 adds a verification-only control plane for locally staged runtime artifacts. It binds an artifact to an exact SHA-256 subject, a repository-local signed attestation bundle, a pinned Ed25519 trust root, and strict provenance expectations covering publisher, builder, source repository, commit, build type, predicate type, and external parameters.

O6 deliberately does **not** turn provenance verification into installation or execution authority. It does not download artifacts, query transparency logs, refresh trust roots, install Cosign, execute artifacts, automate authentication, mutate target projects, or launch provider runtimes. The only O6 record is a controlled fixture used to exercise the verification path deterministically.

## Research basis

GitHub documents artifact attestations as cryptographically signed provenance claims that can link software to a workflow, repository, organization, environment, commit, and triggering event. GitHub also warns that an attestation is not a guarantee that an artifact is secure; the consumer must define policy and evaluate the artifact [1].

Sigstore documents local verification using an on-disk public key or bundle, identity and issuer constraints, claim checks, certificate chains, and trusted roots [2]. SLSA recommends checking trusted builder identity, provenance signature, artifact subject digest, predicate type, build type, and expected external parameters against configured roots of trust [3].

O6 applies these principles as separate evidence dimensions. Signature validity, subject digest binding, trust-root fingerprint, identity claims, builder claims, repository/commit, build type, predicate, external parameters, and local transparency evidence are each reported independently. The overall policy verdict passes only when every required dimension passes.

## Scope delivered

| Area | Delivered result |
|---|---|
| Attestation catalog | Added `config/runtime-attestation-o6-catalog.json` with one `fixture-verified` record linked to the O5 controlled fixture. |
| Trust root | Added a repository-local Ed25519 public-key trust root with identity, source kind, trust level, PEM fingerprint, and disabled network refresh. |
| Bundle evidence | Added a canonical signed payload, base64 Ed25519 signature, local attestation bundle, and no private key. |
| Schemas | Added O6 catalog, trust-root, state, and policy schemas with strict required fields and fail-closed semantics. |
| Policy | Added offline-only verification, pinned-root checks, strict claims, local-evidence-only transparency mode, zero target mutations, and no install/execute authority. |
| Contract | Added plan, verify, and recovery lifecycle contracts, with authentication, target initialization, and launch explicitly deferred. |
| Planning | Added `aiw onboarding attestation-plan` to show exact records, artifact digests, bundle/trust-root paths, claims, and blocked execution boundaries. |
| Verification | Added `aiw onboarding attestation-verify` for exact artifact SHA-256, local bundle, Ed25519 signature, trust-root, subject, identity, builder, repository, commit, build type, predicate, external-parameter, and local-transparency checks. |
| Privacy | Added atomic redacted state and evidence; payload and signature material are not copied into the evidence log, and raw-secret count remains zero. |
| Recovery | Added `aiw onboarding recover --o6 [--reset-state]`; reset removes only O6-owned state/evidence and preserves the staged artifact. |
| Developer controls | Added O6 fixtures, a **34-check** validator, Makefile integration, CLI routing, and inclusion in `make validate`. |
| Documentation | Added `docs/offline-attestation-verification.md`, research notes, changelog entry, and this report. |
| Website | Mirrored O6 contract, policy, state schema, trust-root schema, attestation catalog, and catalog schema through the source-owned sync script. Added typed website loaders and a Getting Started panel. |
| Release integrity | Generated and published the O6 ReleaseManifest with passing source, website, build, data-hash, and compatibility gates. |

## Controlled fixture evidence

The O6 record `O6-CONTROLLED-FIXTURE` links to the O5 artifact `O5-FIXTURE-SAFE-RUNTIME-PROBE` with subject digest `sha256:784fb44f85c150ee86e39e3d6eea0c9905f922f4f34c47a69994d453c6b38cd3`. The signed payload records the controlled fixture publisher, the repository-local builder URI, source repository, source commit `e548c8f9caf00b8ec6527f2629a2ca64541e5af8`, build type, SLSA provenance predicate, and exact external parameters.

The local Ed25519 public-key PEM is bound to trust-root fingerprint `sha256:70bd41368171efd271b43a640be741408086acf7163f5824ed60a93c52a10da7`. The bundle declares local transparency evidence only. No online transparency log or trust-root refresh is performed.

The controlled fixture is a deterministic verification test asset. It is not a vendor release signature, does not establish that any runtime is safe, and does not authorize installation or execution. The O5 execution path remains separate and retains its own exact approval and bounded-command policy.

## Verification and safety decisions

The verifier rejects an unknown attestation ID, missing linked O5 record, artifact outside the O5 staging root, symlink artifact, missing artifact, subject digest mismatch, missing bundle, unreadable bundle, missing trust root, trust-root ID mismatch, trust-root fingerprint mismatch, invalid signature encoding, invalid Ed25519 signature, missing or unexpected claims, mismatched publisher/builder/repository/commit/build type/predicate, external-parameter mismatch, or missing local transparency evidence.

O6 writes only owned state and evidence. It uses no network access, runs no artifact or installer, does not query GitHub or a transparency log, does not invoke provider login, and does not mutate target projects. Even a `pass` verdict sets `installation_authorized` and `execution_authorized` to `false`.

## Validation evidence

| Gate | Result |
|---|---|
| O6 master validator | Passed: **34/34 checks**. |
| Valid signature path | Passed: exact artifact subject, Ed25519 signature, pinned trust root, local transparency evidence, and all provenance claims. |
| Artifact mismatch | Passed: changed artifact digest failed closed. |
| Signature tampering | Passed: modified signature failed closed. |
| Missing bundle | Passed: absent bundle failed closed. |
| Trust-root tampering | Passed: changed PEM fingerprint failed closed. |
| Claim strictness | Passed: publisher, builder, repository, commit, build type, predicate, and external parameters are independently checked. |
| Execution boundary | Passed: plan reported zero commands, zero target mutations, no network, and no install or execute authority. |
| Privacy | Passed: raw-secret count remained zero; payload/signature blobs were not written to evidence. |
| Recovery | Passed: O6-owned state reset preserved the staged artifact and left runtime/target changes at zero. |
| Full source validation | Passed: `make validate` completed all prior controls plus O6; the existing skill suite reported **188 passed, 0 failed**. |
| Source mirror freshness | Passed: `bash scripts/sync-website-data.sh --check`; all **163 generated files** were up to date. |
| Website lint | Passed: `npm run lint`. |
| Website tests | Passed: **39/39 tests**. |
| Website build | Passed: **129 static pages** generated. |
| npm audit | Passed: **0 vulnerabilities** at the high threshold. |
| ReleaseManifest | Passed: schema validation and compatibility returned `compatible` with zero violations. Data hash: `sha256:9a4e672c47d2fe8897f5a56a8ed35c22489933e57a9e93e2386428e0e38ca6bd`. |
| Branch and worktree integrity | Passed: both repositories were on `Dev`, remote tips matched local tips, `main` was untouched, the website mirror matched source data except for its self-referential manifest, and the four intentionally untracked root planning artifacts remained uncommitted. |

## Dev commits

| Repository | Commit | Role |
|---|---|---|
| `Albadry-Esmat/AI-Workflow` | `cc437b2db5edaf958bcc43ee5ea19c1a1d3f9eba` | O6 implementation, signed fixture evidence, schemas, policy, contract, catalog, validator, CLI, Makefile, synchronization mappings, documentation, changelog, and generated source mirror. |
| `Albadry-Esmat/ASE-OS-Website` | `6d03439f575e7002dfe321602f87242f93f3b40c` | O6 generated-data mirror, typed loaders, and Getting Started representation; used as ReleaseManifest sync-base. |
| `Albadry-Esmat/ASE-OS-Website` | `020aa9fa47581c2eb15a058f6eb5049310d9f653` | O6 ReleaseManifest publication; final website Dev tip. |

The ReleaseManifest binds source commit `cc437b2db5edaf958bcc43ee5ea19c1a1d3f9eba` to website sync-base commit `6d03439f575e7002dfe321602f87242f93f3b40c`. The later O6 completion-report commit is documentation-only and remains compatible under the project’s ancestor-aware release gate.

## Known limitations and explicit non-goals

O6 does not provide a general Cosign, Sigstore, GitHub, or SLSA client. It does not install verification tools, fetch public keys, retrieve attestations, query transparency logs, verify certificate chains, verify online log inclusion, or refresh trust roots. The current fixture uses a local Ed25519 key and local evidence to make the controls deterministic.

O6 does not validate the semantic safety of a binary or installer. It confirms cryptographic and declared provenance relationships against configured expectations. GitHub and SLSA both make clear that provenance is not a complete safety guarantee; policy must still evaluate artifact content and intended use [1] [3].

O6 does not install or execute artifacts, automate provider login, accept raw secrets, initialize target projects, copy credentials, modify target files, start services, or launch provider-specific runtimes. Vendor-specific signature and attestation records require a future, separately reviewed batch.

## Rollback procedure

Rollback is Dev-only and should use reversible commits rather than rewriting history. Revert the O6 source implementation first:

```bash
git -C /home/ubuntu/AI-Workflow checkout Dev
git -C /home/ubuntu/AI-Workflow revert cc437b2db5edaf958bcc43ee5ea19c1a1d3f9eba
git -C /home/ubuntu/AI-Workflow push origin Dev
```

Then revert the website manifest and representation:

```bash
git -C /home/ubuntu/ASE-OS-Website checkout Dev
git -C /home/ubuntu/ASE-OS-Website revert 020aa9fa47581c2eb15a058f6eb5049310d9f653
git -C /home/ubuntu/ASE-OS-Website revert 6d03439f575e7002dfe321602f87242f93f3b40c
git -C /home/ubuntu/ASE-OS-Website push origin Dev
```

For local O6 state only, run:

```bash
aiw onboarding recover --o6 --reset-state
```

This removes only `.aiw/onboarding-o6/state.json` and `.aiw/onboarding-o6/evidence.jsonl`; it preserves the staged artifact and does not alter runtimes, trust-root files, credentials, package-manager state, Docker state, or target projects. After rollback, rerun source validation, mirror checks, website lint/tests/build, and ReleaseManifest compatibility.

## Decision boundary

O6 is complete. **O7 must not begin automatically.** A future batch may address vendor-specific signature-tool integration, online trust and transparency refresh, authenticated installer handoffs, guarded target initialization, or neutral launch dispatch only after explicit user confirmation and a separately defined acceptance boundary.

## References

[1]: https://docs.github.com/en/actions/concepts/security/artifact-attestations "GitHub Docs — Artifact attestations"
[2]: https://docs.sigstore.dev/cosign/verifying/verify/ "Sigstore Docs — Verifying signatures"
[3]: https://slsa.dev/spec/v1.0/verifying-artifacts "SLSA v1.0 — Verifying artifacts"

# Offline Publisher Signature and Attestation Verification — O6

Onboarding O6 adds a verification-only control plane for a locally staged artifact and its local publisher-signature or release-attestation evidence. O6 binds the artifact to an exact SHA-256 subject, an exact local bundle, an exact pinned trust root, expected publisher and builder identities, source repository, commit, build type, predicate type, and strict external parameters.

## Verification principle

GitHub describes artifact attestations as cryptographically signed provenance claims that can link an artifact to its workflow, repository, organization, environment, commit, and triggering event. GitHub also warns that an attestation is not a guarantee that an artifact is secure; consumers must define policy, inspect content, and make an informed risk decision [1]. Sigstore documents local bundle and on-disk key verification, identity and issuer constraints, and separate claim checking for signed blobs [2]. SLSA recommends verifying the builder identity, provenance signature, artifact subject digest, predicate type, build type, and expected external parameters against configured roots of trust [3].

O6 follows these principles without turning verification into installation authority. A valid signature proves that the signed payload verifies under the configured local key. A valid subject proves that the payload names the exact artifact digest. A valid claim set proves that the payload matches the record’s expectations. Only the combined policy verdict is reported as `pass`, and even a pass does not authorize installation, artifact execution, authentication, target initialization, or runtime launch.

## Commands

Show the offline verification plan:

```bash
aiw onboarding attestation-plan --agent auto --json
```

The plan displays the exact O6 attestation record, linked O5 installer record, artifact digest, local bundle path, pinned trust root, expected claims, and blocked execution boundaries. Planning performs no network request, transparency-log lookup, artifact execution, installation, authentication, or target mutation.

Verify a local artifact and attestation bundle:

```bash
aiw onboarding attestation-verify \
  --attestation O6-CONTROLLED-FIXTURE \
  --artifact /path/to/.aiw/onboarding-o5/staging/safe-runtime-probe.py \
  --json
```

The verification sequence loads the exact catalog record, hashes the artifact, loads the local attestation bundle and trust root, validates the Ed25519 signature, checks the subject digest, evaluates publisher and builder identity, checks source repository and commit, verifies build type and predicate type, compares external parameters strictly, and records a redacted policy verdict.

Reset only O6-owned state and evidence:

```bash
aiw onboarding recover --o6 --reset-state --json
```

Recovery does not delete the staged artifact and does not modify runtime, authentication, package-manager, Docker, service, or target-project state.

## Trust and claim matrix

| Check | Required O6 evidence | Failure behavior |
|---|---|---|
| Artifact subject | Local artifact SHA-256 equals the catalog and attestation subject digest. | Verification fails before any downstream claim is trusted. |
| Bundle presence | Exact repository-local attestation bundle. | Missing or unreadable bundle fails closed. |
| Signature | Ed25519 signature over the canonical payload. | Invalid encoding, length, key, or signature fails closed. |
| Trust root | Exact local root record and fingerprint of the PEM public-key bytes. | Missing, unknown, or mismatched root fails closed. |
| Publisher identity | Expected publisher string. | Mismatch fails closed. |
| Builder identity | Expected builder URI. | Mismatch fails closed. |
| Source repository | Expected canonical repository URI. | Mismatch fails closed. |
| Commit | Expected 40-character source commit. | Mismatch fails closed. |
| Build type | Expected build-type URI. | Mismatch fails closed. |
| Predicate type | Expected provenance predicate URI. | Mismatch fails closed. |
| External parameters | Exact JSON-object equality with strict unknown-parameter behavior. | Mismatch or unrecognized values fail closed. |
| Transparency evidence | Local evidence status; no network refresh. | Missing required local evidence fails closed. |

## Execution boundary

O6 is **attestation-only**. Its policy sets installation and execution authority to `false`, network to `false`, target mutations to zero, authentication to deferred, and launch to deferred. O6 does not install Cosign, query transparency logs, fetch trust roots, refresh identity metadata, download artifacts, or run the verified artifact.

The current record is a controlled fixture backed by a repository-local Ed25519 key and signed payload. It exists to exercise the verification path deterministically. It is not a vendor release signature, and its successful verification does not imply that OpenCode, Claude Code, Codex, or another runtime is safe to install or launch.

## State and evidence

O6 stores atomic, redacted state under `.aiw/onboarding-o6/`. The state separates artifact subject status, signature status, claim-by-claim results, trust-root status, transparency status, and overall policy verdict. Evidence records contain event type, verdict, signature validity, subject match, network status, and mutation counts; payload and signature material are not copied into the evidence log, and raw secret values remain zero.

## References

[1]: https://docs.github.com/en/actions/concepts/security/artifact-attestations "GitHub Docs — Artifact attestations"
[2]: https://docs.sigstore.dev/cosign/verifying/verify/ "Sigstore Docs — Verifying signatures"
[3]: https://slsa.dev/spec/v1.0/verifying-artifacts "SLSA v1.0 — Verifying artifacts"

# Vendor-Neutral Verifier Adapters — O7

Onboarding O7 adds one neutral command surface for verifying signed release attestations through interchangeable verifier adapters. The catalog currently describes GitHub CLI artifact attestations, Sigstore Cosign blob verification, npm registry provenance, and an internal O6 local-fixture delegate. The adapter record is a policy object, not an instruction to install a vendor tool or to contact a network service.

## Offline-first behavior

O6 remains the default local verification path. GitHub documents an offline workflow in which an online machine downloads an attestation bundle and trusted-root file, then an offline machine imports the artifact, bundle, trusted roots, and GitHub CLI before running `gh attestation verify --bundle ... --custom-trusted-root ...` [1]. GitHub also notes that trusted-root files do not contain built-in expiration and cannot reveal revocation that occurred after the file was generated; O7 therefore records freshness and requires explicit refresh rather than silently updating roots.

Cosign supports local verification with a public key, bundle, certificate chain, or custom CA roots. For blobs, `cosign verify-blob` can consume a local bundle and enforce certificate identity and OIDC issuer. Cosign also documents that disabling claim checks verifies a signature but leaves claims unverified; O7 does not expose a default claim-bypass mode [2].

npm provenance is registry-bound. npm documents `npm audit signatures` for checking registry signatures and provenance attestations, and requires a sufficiently recent npm CLI plus an installed dependency tree [3]. O7 therefore models npm as an online-registry adapter, which fails closed when network verification has not been explicitly enabled.

## Commands

Show all adapter records and their boundaries:

```bash
aiw onboarding verifier-plan --adapter auto --json
```

The plan reports adapter kind, verification modes, offline default, allowed hosts, refresh budgets, candidate-root path, claim requirements, missing-tool behavior, and the fact that installation, execution, authentication, target mutation, and launch remain unauthorized.

Verify an artifact with an exact adapter:

```bash
aiw onboarding verifier-verify \
  --adapter LOCAL-FIXTURE-O6-DELEGATE \
  --artifact /path/to/.aiw/onboarding-o5/staging/safe-runtime-probe.py \
  --json
```

The local delegate exercises O6’s offline bundle and trust-root verifier. Vendor adapters remain command plans with shell disabled, closed stdin, empty external environment, bounded timeout, and no automatic tool installation. Missing GitHub CLI, Cosign, or npm fails closed with manual guidance rather than triggering installation.

Inspect an optional refresh without making a request:

```bash
aiw onboarding verifier-refresh-plan \
  --adapter GITHUB-CLI-ATTESTATION \
  --json
```

A refresh requires an explicit source URL, an allowlisted HTTPS host, `--yes`, a bounded timeout, a response-byte budget, and an owned candidate path. The active trust root cannot be overwritten or activated automatically:

```bash
aiw onboarding verifier-refresh \
  --adapter GITHUB-CLI-ATTESTATION \
  --source-url https://api.github.com/meta \
  --yes \
  --json
```

The command writes candidate evidence only when the bounded request succeeds. It records source URL, source host, response digest, response size, request count, and candidate path without copying response bodies into the evidence log. A failed request or invalid allowlist fails closed.

## Claim and trust matrix

| Concern | O7 requirement | Failure behavior |
|---|---|---|
| Adapter selection | Exact catalog record and deterministic record fingerprint. | Unknown adapter fails closed. |
| Tool availability | Adapter executable must already exist. | No automatic installation; missing tool fails closed. |
| Artifact subject | The verifier must bind its claims to the artifact subject digest. | Subject mismatch or absent subject fails closed. |
| Identity and issuer | Expected signer identity and issuer must be declared when supported. | Missing or unexpected identity data fails closed. |
| Repository and signer | Repository and signer workflow/build are policy claims. | Mismatch fails closed. |
| Predicate and build | Predicate type, workflow/build, and external parameters are strict. | Unknown or mismatched claims fail closed. |
| Network | Disabled by default; allowlisted HTTPS source only for explicit refresh. | No consent, host mismatch, HTTP, timeout, or byte-budget breach fails closed. |
| Trust roots | Refresh writes an owned candidate and records digest; active root remains untouched. | No silent replacement or activation. |
| Evidence | JSON record, source URL, source/response digest, request count, and redaction. | Missing provenance evidence fails closed. |

GitHub’s verifier output distinguishes certificate and verified-timestamp information from workflow-controlled predicate fields. O7 keeps these categories separate and does not treat arbitrary predicate content as trustworthy without declared policy [1].

## Safety boundaries

O7 is verification-only. It cannot download or install OpenCode, Claude Code, Codex, or another runtime. It cannot install GitHub CLI, Cosign, npm, or trust-root tooling. It does not automate provider login, accept raw secrets, initialize a target project, copy credentials, mutate target files, start services, or launch runtimes.

The optional refresh is not a general network client. It uses an explicit allowlist, HTTPS-only URLs, redirect host checks, bounded timeouts, bounded response bytes, one request, candidate-only writes, and atomic O7 state. Its default network request count is zero.

## State, evidence, and recovery

O7 stores state under `.aiw/onboarding-o7/` and uses atomic writes. State records mode, adapter, artifact subject, network request status, verification results, candidate refresh status, evidence digest, policy verdict, authentication status, and target boundary. Evidence is redacted, response bodies and command output are excluded, and raw secret values remain zero.

Recovery resets only O7-owned state and evidence. Candidate evidence is preserved, active roots are untouched, and target projects remain unchanged:

```bash
aiw onboarding recover --o7 --reset-state --json
```

## References

[1]: https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/verify-attestations-offline "GitHub Docs — Verifying attestations offline"
[2]: https://docs.sigstore.dev/cosign/verifying/verify/ "Sigstore Docs — Verifying Signatures"
[3]: https://docs.npmjs.com/viewing-package-provenance "npm Docs — Viewing package provenance"
[4]: https://cli.github.com/manual/gh_attestation_verify "GitHub CLI Manual — gh attestation verify"

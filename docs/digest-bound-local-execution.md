# Digest-Bound Local Runtime Execution — O5

Onboarding O5 strengthens the O4 installation boundary with a narrowly scoped execution path for an **already-present local artifact**. It does not become a general installer runner. The artifact must be represented by an exact source-owned record, staged under an O5-owned directory, bound to an expected SHA-256 digest and byte size, matched to the current platform, and approved for this execution class.

## Why a digest is necessary but not sufficient

GitHub documents that release assets now expose immutable SHA-256 digests generated at upload time and retrievable through the release UI, APIs, and `gh` CLI [1]. npm documents `integrity` values in `package-lock.json` as Standard Subresource Integrity values for package resources, with registry, Git, and tarball semantics [2]. These mechanisms help establish that a local artifact matches a published or locked artifact.

A matching digest does not by itself establish that the artifact’s behavior, privileges, authentication, network access, or rollback behavior are safe. O5 therefore combines the digest with exact path, size, platform, approval, argv, environment, timeout, staging-root, and target-mutation constraints. The checksum is an input to the policy decision, not a substitute for it.

## Commands

Show the local execution plan:

```bash
aiw onboarding execute-plan --agent auto --json
```

The plan exposes the exact O5 installer ID, staged artifact filename, expected digest and size, provenance, approval status, argv, timeout, and blocked reasons. Planning does not hash, execute, download, authenticate, mutate targets, or capture secrets.

Verify the exact local artifact before any execution:

```bash
aiw onboarding artifact-hash \
  --installer O5-FIXTURE-SAFE-RUNTIME-PROBE \
  --path /path/to/.aiw/onboarding-o5/staging/safe-runtime-probe.py \
  --json
```

The hash command rejects missing artifacts, path traversal, symlinks, filename mismatches, digest mismatches, and size mismatches. A mismatch blocks before the execution subprocess is created.

Execute only an approved record with an exact path, matching digest, reason, and explicit consent:

```bash
aiw onboarding execute \
  --installer O5-FIXTURE-SAFE-RUNTIME-PROBE \
  --path /path/to/.aiw/onboarding-o5/staging/safe-runtime-probe.py \
  --reason "approved controlled fixture verification" \
  --yes \
  --json
```

O5 executes at most one command, with `shell=False`, closed standard input, an empty environment, a bounded timeout, no stdout/stderr capture, and an O5-owned staging working directory. The current catalog contains one intentionally controlled fixture so the execution path can be tested without installing or modifying a vendor runtime.

## Execution record model

| Record area | O5 requirement |
|---|---|
| Artifact identity | Exact relative staging filename, artifact kind, expected SHA-256, expected size, and staging-root requirement. |
| Provenance | Publisher, release or fixture URL, asset identity, source kind, and record fingerprint. |
| Approval | `approved` status, review date, reviewer, and mandatory approval reason at execution time. |
| Command | Absolute executable, argv array with exactly one `{artifact}` placeholder, no shell, no network, no elevation, closed stdin, and one-command maximum. |
| Environment | Empty allowlist; no credential variables or environment injection. |
| Preflight | Read-only hash, size, path, symlink, platform, command-policy, and target-mutation checks. |
| Evidence | Redacted state and JSONL events with hash status, approval, timing/result, exit code, and mutation counts; stdout/stderr are never captured. |
| Rollback | Guidance-only ownership record; O5 may reset its state but does not claim vendor runtime uninstall or rollback. |

## What remains blocked

O5 does not download artifacts, execute `curl | shell` or PowerShell expression installers, run elevated commands, mutate package-manager or Docker state, modify global runtime state, accept raw secrets, automate login, initialize target projects, copy credentials, or launch provider-specific runtimes. The target mutation count remains zero.

O5 recovery resets only O5 state and evidence. It deliberately preserves a staged artifact because deleting a user-provided artifact would be an unapproved external mutation:

```bash
aiw onboarding recover --o5 --reset-state --json
```

## References

[1]: https://github.blog/changelog/2025-06-03-releases-now-expose-digests-for-release-assets/ "GitHub Changelog — release asset digests"
[2]: https://docs.npmjs.com/cli/v6/configuring-npm/package-lock-json/ "npm Docs — package-lock.json integrity values"

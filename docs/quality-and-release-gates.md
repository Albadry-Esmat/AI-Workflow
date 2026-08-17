# Quality and Release Gates

**Version:** 1.0.0

**Batch:** 7 — Quality, Traceability, Context Preservation, and Release Compatibility

## Purpose

Batch 7 makes release readiness explicit across five surfaces: weighted quality, mandatory requirement traceability, critical context preservation, synchronized source/website compatibility, and evaluation frequency. The controls are deterministic and fail closed. They complement the existing implementation-completeness guard rather than replacing its score or approval semantics.

> A weighted quality average is a summary signal. It is never permission to release through a critical blocker.

## Quality vector

The machine-readable contract is `config/quality-vector-schema.json`, and the policy is `config/quality-policy.json`. The vector has nine dimensions:

| Dimension | Weight | Minimum | Blocking evidence |
|---|---:|---:|---|
| Structure | 10% | 80 | Invalid required execution contract |
| Behavior | 15% | 80 | Failed expected lifecycle behavior |
| Security | 20% | 90 | Security or contract violation |
| Traceability | 15% | 85 | Critical requirement lacks complete links |
| Budget | 8% | 80 | Unbounded or incorrect budget evidence |
| Retry | 7% | 80 | Retry taxonomy or exhaustion semantics fail |
| Policy | 10% | 90 | Capability or approval policy fails |
| Context | 8% | 85 | Protected context is lost across a supported transition |
| Release compatibility | 7% | 100 | Source commit, data hash, branch, or validation mismatch |

The default minimum weighted score is **85**. The following hard blockers always produce a block verdict: `security_contract_violation`, `execution_contract_invalid`, `critical_requirement_uncovered`, `critical_requirement_unimplemented`, `context_loss`, and `release_incompatible`. A score of 99 cannot override one of these blockers.

## End-to-end traceability

The contract in `config/traceability-contract-schema.json` requires every validated requirement to link through architecture decisions, implementation tasks, code references, test references, and deployment evidence. Critical requirements must have all five link classes. `scripts/validate-traceability.py` verifies a passing complete-link fixture and a blocking critical-uncovered fixture.

The existing `traceability-matrix` skill remains the detailed requirements-to-ADR/task/test ledger. Batch 7 adds the later-stage code and deployment completeness requirement so a requirement cannot appear covered merely because an upstream test or task exists.

## Context preservation

The contract in `config/context-preservation-schema.json` protects five block classes during compression, resume, gate pause/resume, and cross-session inheritance:

| Protected block | Example identifier | Required behavior |
|---|---|---|
| Requirements | `REQ-SEC-001` | Preserve identity and content hash |
| Approvals | `GATE-004` | Preserve the decision and scope |
| Security findings | `FIND-001` | Preserve severity and open/closed state |
| Constraints | `CON-001` | Preserve the enforceable boundary |
| Artifact references | `ART-001` | Preserve the reference and digest, or explicitly reject it as stale |

`evals/context-preservation/cases/` contains five deterministic fixtures. `scripts/test-context-preservation.py` verifies zero loss for supported transitions and explicit `stale-rejected` behavior for an invalidated artifact reference. These tests do not claim to exercise the full OpenCode runtime; they establish the data-integrity invariant that runtime adapters must preserve.

## Evaluation policies

The machine-readable policy is `config/evaluation-policies.json`. Every tier is blocking and permits no external writes.

| Tier | Trigger | Required emphasis |
|---|---|---|
| Commit | Push to any branch | Syntax, contract, Batch 6, and Batch 7 controls |
| Pull request | Open/update/reopen | Commit checks, quick-review evaluation, traceability, context, and quality vector |
| Dev | Push to either `Dev` branch | Pull-request checks, exact website mirror, and ReleaseManifest compatibility |
| Nightly | Scheduled nightly run | Dev checks plus full evaluation and regression suites |
| Release | Release candidate or promotion request | Nightly checks, website gates, compatibility, deployment approval, and no blockers |

The nightly schedule is a policy declaration, not a new background service in this batch. The repository CI workflow is the enforcement location for the checks that are already executable.

## Dev release compatibility

`config/release-compatibility-schema.json` and `scripts/check-release-compatibility.py` compare the current AI-Workflow/Dev source with the generated website ReleaseManifest. Compatibility requires:

1. The source and manifest branches are `Dev`.
2. The manifest source commit equals the current AI-Workflow source commit.
3. The manifest data hash equals the current `website/data` hash.
4. Source validation is `pass`.
5. Release promotion additionally requires website validation and build status to be `pass`.

The existing `website_commit_role: sync-base` remains intentional: the manifest records the website commit used as the synchronization base, not a claim that the manifest can predict the later website commit created by the sync operation.

## Website freshness indicator

The authoritative website representation is still generated through the existing exact mirror and ReleaseManifest flow. A new public freshness indicator in the product UI was **not implemented in Batch 7** because the batch plan marks that presentation change as conditional on explicit website product-owner approval. The compatibility check and manifest remain the machine-readable freshness source. Adding visible UI copy is a documented follow-up and must not be hand-edited into generated data.

## Commands

Run the core Batch 7 controls from the repository root:

```bash
make validate-batch7
make validate-traceability
make test-context-preservation
make eval-quick-review
make eval-quality-vector
make check-release-compatibility MANIFEST=/path/to/data/release-manifest.json
```

The equivalent CLI commands are:

```bash
./aiw validate-batch7
./aiw validate-traceability
./aiw test-context-preservation
./aiw eval-quality-vector
```

## Limitations

The quality vector consumes deterministic local evidence and does not prove semantic review quality, human grader agreement, real-model latency, distributed telemetry, or authorization outside the bounded adapters. The release compatibility checker validates the source commit and mirrored data hash; it does not itself deploy the website or substitute for website lint, tests, build, or explicit deployment approval. Those checks remain separate release requirements.

## Rollback

Batch 7 controls are additive. Revert the Batch 7 implementation commit on `AI-Workflow/Dev` and the corresponding generated-data synchronization commit on `ASE-OS-Website/Dev`. Remove generated local reports with:

```bash
rm -f evals/quality-vector.json
rm -rf evals/**/reports/
```

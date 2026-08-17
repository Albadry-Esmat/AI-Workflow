# Operational Expansion

**Version:** 1.0.0

**Batch:** 8 — Operational Expansion

## Purpose and boundary

Batch 8 generalizes the proven quick-review evidence pattern into two additional pipeline classes, adds operational measurements and containment controls, and makes supply-chain and telemetry privacy requirements executable in local checks and CI. The implementation remains metadata-only and fail-closed. It does not create a production telemetry backend, deploy a monitoring platform, call external model providers, or authorize external writes.

## Generalized evidence path

`scripts/run-operational-evidence.py` consumes the existing pipeline definitions and records contract-valid dry-run evidence for `full-pipeline` and `insights-adaptation-pipeline`. Each bundle contains a versioned run manifest, one step record per declared skill, metadata-only artifact references, read-only policy decisions, and privacy-safe telemetry events.

| Pipeline class | Evidence steps | External writes | Result |
|---|---:|---:|---|
| `full-pipeline` | 39 | 0 | Pass |
| `insights-adaptation-pipeline` | 6 | 0 | Pass |

The shared bundle contract is `config/operational-evidence-bundle-schema.json`. It preserves the Batch 3 execution contracts and Batch 6 budget, policy, redaction, and retention invariants. The recorder is intentionally a dry-run adapter: it proves shape, linkage, and control behavior without executing the tools represented by the declarative pipeline.

## SLOs and error budgets

`config/slo-policy.json` defines availability, correctness, and latency objectives for the quick-review adapter and the two generalized evidence classes. It uses a 30-day window and a `pause_deploys` error-budget policy. The required burn-rate rules are declared for 1-hour, 6-hour, 1-day, and 3-day windows at 14.4×, 6×, 3×, and 1× respectively.

`scripts/measure-slos.py` measures the local quick-review evaluation baseline and both operational evidence bundles. The current fixture result is 100% for every declared SLO, with zero measured budget consumption. These values are evidence-fixture measurements, not production availability claims. Production ingestion, alert delivery, dashboards, and deploy-freeze enforcement remain deployment responsibilities.

## Model/provider compatibility and rollback

`config/model-compatibility-policy.json` requires execution-contract 1.1 evidence, budget evidence, strict privacy redaction, and telemetry event support. The compatibility fixture contains one compatible last-known-good model and two intentionally incompatible fixtures. `scripts/evaluate-model-compatibility.py` blocks incompatible promotion and records rollback to the last-known-good model. It does not call a provider or claim model-quality equivalence.

## Supply-chain controls

The pinned `.github/workflows/supply-chain.yml` checks both repositories’ `package-lock.json` files, generates `artifacts/sbom.cdx.json` in CycloneDX 1.5 format, and runs the offline-safe lockfile and immutable-action scanner. `config/supply-chain-policy.json` requires lockfiles, SBOM generation before release, immutable CI action pins, no moving `latest`/`master`/`main` tags, and blocking treatment for critical and high findings.

The local scanner deliberately reports `advisory_database_available: false` because it does not download or assume a vulnerability advisory database. It therefore verifies lockfile integrity, direct dependency coverage, package versions, and workflow pinning only. An environment with advisory access must run `npm audit` or an equivalent OSV/SCA service before production promotion; this limitation is not silently converted into a clean vulnerability verdict.

## Privacy-safe telemetry and retention

`config/telemetry-event-schema.json` and `config/telemetry-policy.json` constrain events to metadata allowlists. The opt-out check is first and unconditional. Opted-out state writes zero events. All stored events carry `opt_out_checked: true`, `pii_scrubbed: true`, a redaction profile, a retention class, and stable run/session correlation IDs.

The privacy tests cover credential, email, path-traversal, and truncation scrubbing; field allowlists; UUID-shaped identifiers; the 500-event ring-buffer cap; and the zero-write opt-out path. Operational events are classified for 30-day retention and aggregate metrics for 90-day retention. No prompt, response, source code, user input, credential, or raw tool payload is stored in the Batch 8 telemetry contract.

## Incident containment

`scripts/simulate-incident-containment.py` runs four controlled fixtures:

| Scenario | Trigger | Containment | External writes |
|---|---|---|---:|
| Runaway loop | Budget exhausted | Kill switch, quarantine, no external write | 0 |
| Prompt injection | Untrusted instruction | Capability disable, quarantine, no external write | 0 |
| Supply-chain finding | Dependency finding | Quarantine, rollback, no external write | 0 |
| Credential exposure | Secret-pattern detection | Credential revocation, kill switch, quarantine, no external write | 0 |

The schema requires incident identity, severity, containment action, quarantine state, evidence-bundle reference, and recovery status. The simulations do not connect to production credentials, queues, deployment systems, or external notification channels.

## Commands

From the AI-Workflow repository with the adjacent website worktree available:

```bash
make validate-batch8
make operational-evidence
make generate-sbom
make scan-supply-chain
make measure-slos
make evaluate-model-compatibility
make test-telemetry-privacy
make simulate-incident-containment
```

The corresponding `aiw` commands expose the same controls. The primary validation workflow runs evidence, SLO, model compatibility, telemetry privacy, incident containment, and Batch 8 control checks. The Dev synchronization workflow runs these checks before mirroring website data. A dedicated pinned supply-chain workflow checks both repositories’ dependency surfaces.

## Explicit exclusions and follow-ups

Batch 8 does not implement a hosted metrics backend, Prometheus/Datadog dashboards, real alert routing, production credential revocation, an always-on kill-switch service, online vulnerability intelligence, or live provider-quality benchmarking. These require deployment ownership, environment credentials, operational on-call decisions, or a separate approved integration. The current controls are intentionally local, deterministic, metadata-only, and reversible.

## Rollback

Revert the Batch 8 source commit and the corresponding generated website synchronization commit on their `Dev` branches. Disable the Batch 8 workflow files if an emergency rollback is needed. Local generated artifacts can be removed with:

```bash
rm -rf artifacts/operational artifacts/incidents artifacts/telemetry
rm -f artifacts/sbom.cdx.json artifacts/dependency-scan.json artifacts/slo-report.json artifacts/model-compatibility-report.json
```

## References

The implementation is grounded in the repository’s existing contracts and operational specifications:

1. `config/execution-contracts/run-manifest.schema.json` and `config/execution-contracts/step-execution.schema.json`.
2. `config/execution-contracts/artifact-reference.schema.json` and `config/execution-contracts/policy-decision.schema.json`.
3. `.opencode/skills/observability/SKILL.md`, `.opencode/skills/behavioral-telemetry-collector/SKILL.md`, and `.opencode/skills/slo-sla-designer/SKILL.md`.
4. `.opencode/skills/devsecops-pipeline-designer/SKILL.md` and `.opencode/skills/runbook-generator/SKILL.md`.
5. `AI-Workflow-Gated-Batch-Implementation-Plan.md`, Batch 8 section.

# Multi-Agent Compatibility Maintenance

**Version:** 1.0.0
**Audience:** Release owners, operators, reviewers, and adapter maintainers

## Purpose and boundary

Compatibility is a maintained product surface, not a one-time adapter installation. This guide defines the repository-safe maintenance cycle for the runtime registry, capability matrix, adapter projections, certification evidence, release statements, and incident controls. It does not authorize live runtime execution, credential handling, external publication, or automatic vendor upgrades.

> **Promotion rule:** A runtime is promoted only for the capabilities supported by current evidence. A fixture pass, MCP connection, instruction-file projection, or successful edit does not prove safe lifecycle compatibility.

## Maintenance cadence

| Control | Trigger | Required action | Blocking outcome |
|---|---|---|---|
| Runtime version watch | Every preflight and release candidate | Run `aiw runtime-watch`; run strict mode for a named terminal runtime before live use. | Missing, unsupported, or unreviewed versions remain blocked. |
| Capability-matrix review | Quarterly and after a major vendor release | Recheck declared MCP, hooks, ACP, skills, subagents, approvals, checkpoints, CLI, write-guard, and artifact-exchange behavior. Record only verified changes. | Unknown or contradictory capability claims block release communication. |
| Contract regression | Every pull request and release | Run schema, registry, adapter fixture, projection, security, documentation, and conformance checks. | Any drift or malformed evidence blocks merge or release. |
| Evidence retention | Per retention policy and after each pilot | Keep sanitized certification metadata with reviewer ownership; prune raw operational logs and never retain secrets or raw sessions. | Unbounded or sensitive retention blocks closure. |
| Incident response | Failed, ambiguous, unsafe, or incompatible run | Preserve correlation ID, sanitized diagnostics, backup/checksum references, decision state, and recovery action. | Bypass, credential exposure, ambiguous write, or corrupt checkpoint blocks closure. |
| Adapter deprecation | Safety assumption invalidated or vendor behavior changes | Mark the adapter blocked or deprecated, record the successor or limitation, update projections and release notes. | Silent continued use is prohibited. |
| Release communication | Every compatibility release | Publish support tier, verified versions, capability-specific limitations, known blockers, and operator prerequisites. | Unsupported production claims block release. |
| Security review | Each compatibility release and after a security event | Reassess scopes, MCP side effects, hooks, plugins, projections, host trust boundaries, and evidence sanitization. | Unreviewed security-impacting changes block release. |

## Runtime version watch

The version watch is deliberately read-only. It loads the canonical adapter registry, performs only a version-only check for terminal runtimes, and reports host/editor integrations as operator verification requirements. It never starts a session, sends a prompt, invokes MCP, performs a write, or changes user configuration.

```bash
# Informational report for every registered adapter.
aiw runtime-watch

# JSON output for a release record.
aiw runtime-watch --json

# Strict check for one terminal runtime before live certification.
aiw runtime-watch --runtime opencode --strict
```

A terminal runtime with a semver range is reported as `available` only when the version-only response satisfies that range. A runtime whose range is `operator-defined` is reported as `range-unpinned` and requires a reviewed compatibility update before a production statement. A missing executable is `unavailable`. Host/editor targets remain `host-verification-required` until their actual surface, plan, version, lifecycle boundary, and projection are verified by the operator.

## Quarterly capability-matrix review

The reviewer compares each matrix entry with the installed runtime or documented host surface and records the date, runtime version, adapter version, evidence state, observed capability, limitation, and reviewer. The review must not infer capabilities from the product name or from another runtime. When a capability is not observable, use `to-verify`, `wrapper-required`, `surface-dependent`, or `unknown` rather than `supported`.

After a review, update the canonical registry and matrix together, increment the relevant compatibility metadata when required, update the compatibility guide and release status, add a changelog entry, synchronize the website mirror, and run `aiw docs-check`, `aiw website-check`, and `aiw sync --check`.

## Evidence and retention

Keep runtime-certification records outside tracked source files unless a sanitized fixture is intentionally added for validator tests. Each private record must pass:

```bash
aiw validate-pilot-evidence <private-pilot-record.json>
aiw validate-runtime-certification <private-runtime-certification.json>
```

The runtime-certification record is capability-specific and must identify the runtime, adapter, release commit, tested timestamp, execution surface, runtime and adapter versions, project classification, staged check results, capability decisions, evidence state, operator, independent reviewer, and `secret_exposure: none`. It must not contain raw prompts, MCP payloads, tokens, authorization headers, personal data, full session JSON, or unbounded model output.

Sanitized event records follow the existing seven-day operational retention policy. Certification metadata may be retained for release accountability, but raw state, session transcripts, credentials, and unbounded outputs must not be copied into the evidence package. When retention is complete, record the sanitized pruning result without retaining the deleted content.

## Incident and recovery sequence

When a compatibility or runtime incident occurs, stop new writes and preserve the correlation ID. Capture a sanitized support bundle and event summary, verify the latest trusted backup, inspect checkpoint and circuit state, reconcile any ambiguous external outcome, and decide whether the adapter must be blocked or deprecated. Do not retry an unknown external result blindly and do not repair evidence by relabeling a fixture as live.

Close the incident only after the target state is verified, the recovery evidence is reviewed, the affected documentation and changelog are updated, the website mirror is synchronized, and a regression test or explicit operator action exists. If a credential may have been exposed, rotate it outside the repository and record only the sanitized incident category.

## Deprecation and release communication

Deprecation is a safety control. When a vendor changes lifecycle behavior, a host loses a pre-action boundary, a version exits its supported range, or a security review invalidates an assumption, mark the adapter `blocked` or `deprecated` before changing the public support statement. State the affected capabilities, migration path or replacement, evidence state, and effective date. Do not delete historical evidence or claim that a projection is equivalent to a native adapter.

Every compatibility release must state the current support tiers, certified runtime versions and capabilities, degraded operations, unsupported operations, fixture-only status, operator-owned prerequisites, and unresolved blockers. Release communication must be generated from reviewed repository data and must pass the complete documentation and website synchronization gates.

## Phase 8 release gate

Before merging or releasing a compatibility maintenance change, generate the sanitized handoff report and run:

```bash
aiw runtime-watch
aiw release-status
aiw validate-release-approval tests/fixtures/release-approval.json
aiw validate-adapters
aiw certify-adapters
aiw validate-runtime-certification tests/fixtures/runtime-certification.json
aiw docs-check
aiw sync
aiw website-check
aiw sync --check
aiw self-test
npm test -- --runInBand
aiw validate
node scripts/security-check.js --history
```

The handoff report must remain tied to the reviewed commit, and the release-approval record must be validated for scope, owners, blockers, reviews, and non-fixture evidence. Neither artifact may be used as a production approval by itself. A successful repository run does not close the live-runtime gate. The real executable or host integration, credentials, MCP startup, constrained smoke, recovery sequence, private evidence, independent review, and release decision remain operator-owned.

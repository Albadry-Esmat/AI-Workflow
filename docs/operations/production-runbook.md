# AI Workflow Production Runbook

## Purpose and Boundary

This runbook applies to the local-first AI Workflow CLI and its public website-data publication process. It assumes a single operator or explicitly coordinated operators. It does not authorize autonomous production deployment, token sharing, or bypassing mandatory human approval gates.

## Before Every Release Candidate

`./aiw setup` installs a managed pre-commit hook when no custom hook exists. The hook runs documentation-policy, website-synchronization, and structural validation checks before local commits. Local hooks are a convenience; CI and the release commands below remain authoritative.

Run the following from the repository root:

```bash
npm ci --ignore-scripts --no-audit --no-fund
aiw self-test
aiw validate
node scripts/security-check.js --history
aiw sync --check
aiw version --json
aiw preflight
aiw validate-budget
aiw validate-golden
aiw rollback-rehearsal
aiw validate-events
aiw validate-pilot-evidence
aiw validate-runtime-certification tests/fixtures/runtime-certification.json
aiw runtime-watch
aiw release-status
aiw validate-release-approval tests/fixtures/release-approval.json
aiw validate-adapters
aiw validate-adapter-lifecycle
aiw certify-adapters
aiw docs-check
aiw website-check
aiw score-artifact --type requirements --input tests/fixtures/requirements-artifact.json
aiw generate-projections --output /tmp/aiw-projections --profile pilot-read-only
```

`aiw preflight` is intentionally strict. It fails when `.env`, OpenCode, validation dependencies, tests, or the website mirror are unavailable. Never weaken the command to obtain a green result; fix the underlying prerequisite or record an approved exception. `aiw validate-adapters` checks the registry, capability matrix, implementation descriptors, and compatibility versions. `aiw validate-adapter-lifecycle` checks the separate lifecycle manifest against the registry and matrix, requiring assigned review ownership and complete blocked/deprecated metadata. A blocked adapter cannot execute, and a deprecated adapter cannot be selected for a new run. `aiw certify-adapters` proves fixture-only contract behavior for the registered adapters; it does not prove that any external runtime is installed or production-certified. `aiw validate-runtime-certification` validates the sanitized per-runtime evidence contract and prevents fixture records from being promoted as live certification. Before a live smoke test, run `aiw pilot-preflight --project-id <disposable-id> --pipeline <pipeline>`. It creates a sanitized correlation manifest and checksum-backed backup but never invokes OpenCode or MCP; a blocked result is an honest environment finding.

## Runtime Projection Installation

Generate projections into an isolated directory and review the generated diff before installing them into a user project:

```bash
aiw generate-projections --output /tmp/aiw-projections --profile pilot-read-only
aiw install-projections --source /tmp/aiw-projections --target /path/to/project
aiw install-projections --source /tmp/aiw-projections --target /path/to/project --confirm
```

The installer is a dry-run by default. Existing target files require both `--confirm` and `--overwrite`; explicitly overwritten files are backed up under the target’s `.ai-workflow/projection-backups/` directory. Never install a projection into a production project before reviewing its contents and confirming the target path.

## Mandatory Documentation and Website Synchronization

Every implementation, configuration, schema, pipeline, adapter, security, test, operational, website, or workflow change must update all affected documentation and `docs/changelog.md`. Run `aiw docs-check` to enforce the path-aware rule. The policy is defined in [`../documentation-policy.md`](../documentation-policy.md) and `scripts/documentation-policy.json`; CI applies the same check against the pull request or push range.

The website mirror must be synchronized after every authoritative documentation or configuration change. Run `aiw sync`, review the generated diff, then run `aiw website-check` and `aiw sync --check` before committing. CI runs the same guard and rejects a change when `website/data/` is stale. Commit authoritative sources and their generated website data together.

## Compatibility Maintenance

Use [`compatibility-maintenance.md`](compatibility-maintenance.md) for the Phase 8 cadence. Generate [`../production-readiness/release-status-handoff.md`](../production-readiness/release-status-handoff.md) with `aiw release-status --json` before assigning the operator-owned blockers, then validate any private decision record with `aiw validate-release-approval <private-release-approval.json>`. Run `aiw runtime-watch` and `aiw validate-adapter-lifecycle` at every release candidate, review the capability matrix quarterly and after major vendor changes, retain only sanitized evidence, block or deprecate invalidated adapters with a recorded reason and migration path, and update release communication with capability-specific support statements.

## Before Running a Pipeline

Use a non-critical repository for the first run. Confirm the selected pipeline, required MCP integrations, data classification, output directory, estimated token budget, and human approvers. Run a dry-run or review the pipeline configuration before any write-capable step. Keep external publication, merge, payment, account, and deployment actions behind explicit human approval.

Create a state backup before a long or high-value run:

```bash
aiw pilot-preflight --project-id <disposable-id> --pipeline <pipeline>
aiw backup
```

Use the configured pilot budget as the ceiling for retries, duration, estimated tokens, active sessions, queue depth, and external API calls. The runtime budget tracker stops before continued work when a hard limit is exceeded. A threshold pauses for approval; a hard limit stops safely. Runtime MCP guards reject capabilities outside the selected profile and require explicit approval for write or deployment capabilities. Inspect sanitized lifecycle events with `aiw events --json`; validate them with `aiw validate-events`; never expose raw prompts or MCP payloads.

Record the generated backup path with the session identifier. Do not copy the backup into a public repository.

## During Execution

Monitor session status, retry count, gate decisions, artifact availability, budget snapshots, circuit state, and checkpoints. A downstream phase must not consume an artifact while its producer is pending. If a gate is rejected, preserve the rejection reason and resume only after the input or approval context has been updated. Repeated runtime failures trip the circuit breaker and require operator inspection before retry.

Do not delete session files to clear a stuck run. First create a backup, inspect the sanitized state, and determine whether the run is waiting for HITL input, an MCP response, a schema repair, or a process lock. If you need to ask for help, run `aiw support-bundle` and share only the generated sanitized directory; it contains inventory and diagnostics, not raw session contents.

## Common Failures

| Symptom | Response |
|---|---|
| `opencode: command not found` | Install the supported OpenCode CLI, rerun `aiw health`, and do not attempt to bypass agent execution. |
| Schema or semantic validation failure | Run `aiw validate`, inspect the named pipeline/skill, correct the source configuration, then regenerate website data. |
| Stuck HITL gate | Inspect the session status and approver instructions. Do not change timeout or bypass settings in a live run. |
| State lock already held | Confirm the owning process. If it is dead and the lock is stale, use the state-store stale-lock policy; preserve a backup before recovery. |
| Corrupted session JSON | Stop writes, preserve the file, inspect its `.bak`, and use the documented recovery/restore procedure. |
| MCP unavailable | Mark the integration unavailable, use the documented fallback if safe, and do not invent external results. |
| Website mirror drift | Run `aiw sync` locally, review the diff, run `aiw sync --check`, and commit source plus generated data together. |
| Website publication failure | Do not retry blindly. Confirm target branch, credentials, non-fast-forward status, current target diff, and the deterministic idempotency ledger before another publication attempt. A duplicate claim is a stop-and-inspect condition. |
| Budget threshold or hard limit | Pause for explicit approval at a threshold; stop safely at a hard limit. Preserve the correlation ID and sanitized event summary. |
| Rollback required | Run `aiw rollback-rehearsal` in a disposable workspace first, then use only a verified backup for real restore. |
| Unauthorized capability | Stop before invocation, record the typed permission failure, and use a profile with only the minimum approved capability. |
| Circuit open | Inspect the sanitized error category and integration status; do not bypass the cooldown or reset the breaker blindly. |
| Weak artifact | Run `aiw score-artifact`; route `needs_human_review` or `reject` results to manual review and do not promote them automatically. |

## Backup and Restore

Create and verify a backup:

```bash
backup=$(aiw backup | awk '/State backup created:/ {print $4}')
node scripts/state-backup.js verify "$backup"
```

Restore only after confirming the backup is trusted and the current state has been preserved:

```bash
aiw restore "$backup"
```

The restore command validates the manifest before replacement and retains the previous state directory beside the restored directory. Inspect both directories before deleting anything. Never restore a backup from an untrusted or publicly accessible location.

## Website Publication

Local source-to-mirror synchronization is safe to run without external credentials:

```bash
aiw sync
aiw sync --check
```

External publication requires explicit confirmation:

```bash
aiw sync --website --confirm-website
```

For changed website data, publication claims a deterministic operation key based on the source-data digest. If the same key is claimed again, stop and inspect the target repository and `.opencode/state/idempotency.json`; never blindly create a duplicate commit or pull request. For future write-capable operations, first create a canary-only dry-run plan with `aiw write-plan --operation <name> --target <approved-target> --canary`, review it, and execute only through the operation-specific approved path.

The publication workflow validates source data, semantic pipeline invariants, security checks, conformance tests, and mirror cleanliness before pushing. Review the target diff and ensure the publication token is separate from local development credentials.

## Rollback

Rehearse the recovery path before release:

```bash
aiw rollback-rehearsal
```

For a bad local release candidate, switch to the previous known-good tag and restore the last verified state backup. For a bad website publication, revert the generated data commit in ASE-OS-Website and confirm the live site rebuilds from the reverted commit. Do not force-push or rewrite the target branch history.

Record the incident with the source commit, pipeline/session ID, affected artifacts, approval decisions, timestamps, recovery steps, and follow-up regression test. Redact tokens, authorization headers, raw MCP payloads, and personal data.

## Credential Rotation

1. Revoke or rotate the affected token at its issuing provider.
2. Update only the local or CI secret store that owns the credential.
3. Confirm the token’s minimum required scope.
4. Run `aiw health` without printing the token.
5. Run `node scripts/security-check.js --history`, `aiw self-test`, and `aiw version --json`.
6. Record the rotation date and owner without recording the secret value.

Never place secrets in `opencode.json`, pipeline JSON, skill Markdown, generated website data, backups intended for publication, or issue comments.

## Pilot Sign-off

A pilot is complete only when one or two non-critical repositories have completed a constrained pipeline and one full pipeline using non-sensitive data, all required gates were reviewed by a human, artifacts were recoverable, logs were sanitized, pilot evidence passes `aiw validate-pilot-evidence`, weak artifacts were routed through quality review, and no P0/P1 issue remains open.

## Repository hardening and publication controls

AI-Workflow is the source of truth for framework data. Before a release or website publication, run npm run validate:all and the relevant production-hardening checks. The website artifact is an exact SHA-256-verified mirror; destination-only files are deleted rather than retained. Populated source .env files are never copied by aiw init, and external MCP packages must be pinned and explicitly enabled. Deployment approval gates are non-bypassable where required, and generated metadata must use the canonical HTTPS site URL.

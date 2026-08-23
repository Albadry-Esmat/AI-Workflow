# AI Workflow Production Runbook

## Purpose and Boundary

This runbook applies to the local-first AI Workflow CLI and its public website-data publication process. It assumes a single operator or explicitly coordinated operators. It does not authorize autonomous production deployment, token sharing, or bypassing mandatory human approval gates.

## Before Every Release Candidate

Run the following from the repository root:

```bash
npm ci --ignore-scripts --no-audit --no-fund
aiw self-test
aiw validate
node scripts/security-check.js --history
aiw sync --check
aiw version --json
aiw preflight
```

`aiw preflight` is intentionally strict. It fails when `.env`, OpenCode, validation dependencies, tests, or the website mirror are unavailable. Never weaken the command to obtain a green result; fix the underlying prerequisite or record an approved exception.

## Before Running a Pipeline

Use a non-critical repository for the first run. Confirm the selected pipeline, required MCP integrations, data classification, output directory, estimated token budget, and human approvers. Run a dry-run or review the pipeline configuration before any write-capable step. Keep external publication, merge, payment, account, and deployment actions behind explicit human approval.

Create a state backup before a long or high-value run:

```bash
aiw backup
```

Record the generated backup path with the session identifier. Do not copy the backup into a public repository.

## During Execution

Monitor session status, retry count, gate decisions, and artifact availability. A downstream phase must not consume an artifact while its producer is pending. If a gate is rejected, preserve the rejection reason and resume only after the input or approval context has been updated.

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
| Website publication failure | Do not retry blindly. Confirm target branch, credentials, non-fast-forward status, and current target diff before another publication attempt. |

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

The publication workflow validates source data, semantic pipeline invariants, security checks, conformance tests, and mirror cleanliness before pushing. Review the target diff and ensure the publication token is separate from local development credentials.

## Rollback

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

A pilot is complete only when one or two non-critical repositories have completed a constrained pipeline and one full pipeline using non-sensitive data, all required gates were reviewed by a human, artifacts were recoverable, logs were sanitized, and no P0/P1 issue remains open.

# Constrained Live Smoke Test

This procedure is the **operator-owned** final step between repository readiness and a real pilot. It must be run only against a disposable, non-sensitive project with no production credentials, customer data, deployment target, payment flow, direct website publication, or unrestricted browser actions.

> `aiw pilot-preflight` prepares a sanitized manifest and a checksum-backed state backup. It deliberately does **not** invoke OpenCode, a model, or an MCP server. A successful repository-side preparation is not live-runtime evidence.

## Preparation

From the release commit under review, install dependencies with `npm ci --ignore-scripts --no-audit --no-fund`. Configure the operator machine with the supported OpenCode executable and a dedicated least-privilege `.env` file. Keep `.env` owner-only (`600` on Unix-like systems), use a short practical credential lifetime, and never paste credential values into this record.

Run the following without printing secrets:

```bash
aiw health
aiw version --json
aiw security-history
aiw self-test
aiw validate
aiw sync --check
aiw preflight
aiw pilot-preflight --project-id disposable-smoke-001 --pipeline requirements-only
```

If `pilot-preflight` reports a blocking prerequisite, stop. Resolve the environment issue and rerun it. Do not override a missing executable, missing credential, failed MCP policy, failed backup, or failed checksum verification by writing a fake pass record.

## Constrained sequence

Use the correlation ID and manifest path printed by `pilot-preflight`. Record only metadata and sanitized categories.

| Step | Operator action | Required observation | Stop condition |
|---:|---|---|---|
| 1 | Run a requirements-only or quick-review pipeline. | Routing, skill resolution, schema validation, state persistence, and expected artifacts complete. | Any gate bypass, untyped failure, missing artifact, or secret in output. |
| 2 | Introduce one safe validation failure. | Retry count terminates at the configured limit and returns a typed failure. | Infinite retry, duplicate side effect, or unbounded duration. |
| 3 | Pause at a human approval gate and reject once. | Run pauses safely; rejection context is preserved. | Execution continues after rejection or raw sensitive context is logged. |
| 4 | Resume with explicit approval. | The same run resumes and completes with schema-valid artifacts. | Gate bypass, state loss, or artifact mismatch. |
| 5 | Run an architecture-focused pipeline. | ADR and architecture outputs exist before any dependent gate or consumer proceeds. | Downstream work observes an unavailable or stale artifact. |
| 6 | Verify recovery in a disposable copy. | Pre-run backup verifies; restore returns the last verified state and checksums pass. | Only-copy overwrite, checksum mismatch, or unsafe restore. |

Do not perform external writes during this smoke test. The enabled MCP profile must remain `pilot-read-only`; Playwright, Slack, Vercel, deployment tools, direct publication, autonomous adaptation, payment, and account changes remain disabled.

## Evidence record

Create an evidence record outside tracked source files or in an approved private release system. The record must contain the release commit, project identifier, pipeline names, correlation ID, start/end timestamps, runtime versions, phase durations, retry counts, gate decisions, sanitized artifact names and schema results, backup path, final state checksum, failure categories, and recovery action. It must not contain raw prompts, raw MCP payloads, tokens, authorization headers, personal data, or full session JSON.

A minimal record can be copied from this template:

```yaml
record_version: "1.0.0"
release_commit: "<commit>"
project_id: "<disposable-project-id>"
correlation_id: "<pilot-correlation-id>"
pipeline_runs:
  - name: "requirements-only"
    started_at: "<ISO-8601>"
    finished_at: "<ISO-8601>"
    status: "pass|fail"
    phase_durations_ms: {}
    retry_count: 0
    gate_decisions: []
    artifacts:
      - name: "<sanitized-artifact-name>"
        schema_valid: true
backup:
  path: "<private-backup-path>"
  checksum_verified: true
recovery:
  scenario: "rejected-gate|interrupted-process|stale-lock|corrupt-disposable-state"
  result: "pass|fail|not-run"
external_writes: "none"
secret_exposure: "none"
operator: "<name>"
independent_reviewer: "<name>"
decision: "pilot-ready|blocked"
notes: "<sanitized failure categories or limitations>"
```

The final decision remains **blocked** until the actual OpenCode executable, reviewed credentials, MCP startup, and this live sequence have been exercised on the operator machine. Sandbox fixture runs validate CLI logic only and cannot satisfy live acceptance criteria.

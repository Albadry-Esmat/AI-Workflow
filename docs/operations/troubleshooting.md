# Troubleshooting — AI Workflow Operations

**Version:** 1.0.0
**Last updated:** 2026-08-24
**Audience:** Operators and reviewers diagnosing a failed or blocked run

## Safety rule

A failure is a control signal. Do not bypass a gate, delete state, reset a circuit blindly, broaden a token, retry an ambiguous external write, or record a fixture pass as live evidence. Preserve the correlation ID and inspect sanitized diagnostics first.

## First response sequence

Run the following from the repository root:

```bash
aiw events --json --limit 50
aiw support-bundle /tmp/aiw-support-bundle
aiw website-check
aiw version --json
```

If state may be damaged, stop new writes and create a verified backup before recovery:

```bash
backup=$(aiw backup | awk '/State backup created:/ {print $4}')
node scripts/state-backup.js verify "$backup"
aiw rollback-rehearsal
```

Do not share raw state, session JSON, tokens, authorization headers, prompts, or MCP payloads. Share only the sanitized support bundle and event summary.

## Diagnostic table

| Symptom | Likely meaning | Safe response |
|---|---|---|
| `opencode: command not found` or another runtime is unavailable | The selected runtime cannot be certified or invoked. | Install the supported version, rerun discovery/preflight, and do not substitute fixture evidence for live evidence. |
| `.env` missing or permission failure | Real credentials are not configured safely. | Create from `.env.example`, use least privilege, set mode `600`, and never print the value. |
| `MCP_CAPABILITY_DENIED` | The request exceeds the selected profile. | Stop, reduce requested capability, or obtain an explicitly approved profile; never enable a side-effect server merely to make the run pass. |
| Approval is pending, rejected, or expired | A human gate has not authorized the action. | Preserve the decision record and wait for a valid approval or revise the request. |
| Budget hard stop | Retry, duration, token, session, queue, or API-call budget was exhausted. | Stop safely, inspect the budget snapshot, and obtain a reviewed budget change before rerunning. |
| Circuit is open | Repeated failures indicate an unhealthy runtime or integration. | Inspect error categories and MCP status; wait for cooldown and perform a controlled half-open check. |
| Checkpoint cannot resume | Integrity, policy, schema, adapter, or runtime version does not match. | Do not force resume. Validate the checkpoint, recover from the last trusted artifact or backup, and record the incompatibility. |
| Artifact is `needs_human_review` | Structure exists but required content or quality is incomplete. | Route to human review; do not promote or publish automatically. |
| Artifact checksum mismatch | The file changed after capture or came from an untrusted source. | Reject the artifact, preserve both references, and recapture from a trusted run. |
| Duplicate publication or idempotency claim | The operation may already have been attempted. | Inspect the ledger and target repository; reconcile as published, not-published, or unknown. Never blindly retry unknown outcomes. |
| Documentation policy failure | A changed area is missing `docs/changelog.md` or one of its required domain guides. | Read `docs/documentation-policy.md`, update every affected guide, then rerun `aiw docs-check`. |
| Local commit hook is absent or stale | Setup was not rerun, or a custom hook replaced the managed hook. | Run `./aiw setup`; preserve intentional custom hooks, but integrate the versioned `.githooks/pre-commit` checks. CI remains authoritative. |
| Website mirror drift | Source documentation/configuration and generated website data differ. | Run `aiw sync`, review the diff, run `aiw website-check`, then `aiw sync --check`; commit both sides together. |
| Projection conflicts with user files | Generated runtime configuration would overwrite existing content. | Review the diff. Use `--confirm` only for an intentional installation and `--overwrite` only after approving the backup and target path. |
| Adapter fixture passes but live runtime fails | Fixture contract is not proof of vendor runtime behavior. | Record the live result as blocked or failed; update the adapter limitation or version range instead of changing the evidence label. |
| Runtime certification evidence fails | The record is missing a staged check, capability decision, registered target, or required sanitized metadata. | Run `aiw validate-runtime-certification <private-record.json>`, correct the record without adding raw content, and keep the status blocked until real evidence exists. |
| Runtime version watch reports unavailable or unsupported | The terminal executable is missing, outside its declared range, or the range is still operator-defined. | Run `aiw runtime-watch --json`; install and verify the declared runtime version or update the reviewed compatibility matrix. Do not start a live session until the result is resolved. |
| Adapter lifecycle validation fails | The lifecycle manifest is missing an entry, contradicts the registry or matrix, lacks review ownership, or has incomplete blocked/deprecated metadata. | Run `aiw validate-adapter-lifecycle`, correct the state, support claim, reason, effective date, successor or migration limitation, and rerun `aiw release-status --json`. Do not call an unavailable fixture-only runtime deprecated without a reviewed vendor or safety change. |
| An adapter is `blocked` or `deprecated` | The recorded lifecycle state prevents normal selection; deprecated adapters are retained for history but cannot be selected for new runs. | Stop new runs, inspect `block_reason` or `deprecation_reason`, follow `unblock_criteria` or `migration`, and use only a validated successor after its own lifecycle and evidence checks pass. |
| Release-status handoff reports dirty or failed | Uncommitted files, stale website data, missing affected docs, or a failed repository gate remain. | Run `aiw release-status --json`, inspect the named check, update all affected documentation, run `aiw sync`, and re-run the full handoff. Do not treat a dirty or failed report as a release decision. |
| Release-approval validation rejects a decision | Scope, owner, blocker, review, documentation, or non-fixture evidence requirements are inconsistent with `go` or `conditional-go`. | Keep the decision `no-go`, correct the private record, rerun `aiw validate-release-approval`, and do not relabel fixture or fake-runtime evidence. |

## Documentation-policy diagnosis

Run the validator from the repository root:

```bash
aiw docs-check
```

The validator reports every changed file and the required documentation that is missing. Update the affected domain guides and `docs/changelog.md`; do not silence the failure by changing the policy or classifying a substantive change as maintenance. Then synchronize the website mirror and rerun the validator before staging the final diff.

## Recovery decision tree

Use the correlation ID to answer these questions in order:

1. Is the run waiting for human approval? If yes, do not restart it.
2. Is the circuit open or the budget exhausted? If yes, stop and inspect before retrying.
3. Is the external outcome unknown? If yes, reconcile the target and idempotency ledger before any new request.
4. Is the checkpoint compatible and integrity-verified? If no, recover from a trusted artifact or backup.
5. Is the artifact schema-valid and quality-approved? If no, route to repair or human review.
6. Is the website mirror current? If no, synchronize before release or publication.

## Runtime adapter diagnosis

For a runtime-specific diagnosis, start with descriptor, fixture, and evidence checks:

```bash
aiw validate-adapters
aiw validate-adapter-lifecycle
aiw certify-adapters
aiw validate-runtime-certification tests/fixtures/runtime-certification.json
aiw generate-projections --output /tmp/aiw-projections --profile pilot-read-only
```

Then run `aiw runtime-watch --runtime <id> --strict` for the named terminal runtime. Host/editor targets require operator verification rather than an executable version check. Do not pass live prompts or write requests until version, profile, budget, project classification, and approval boundaries are confirmed. If the runtime cannot expose a required operation, classify it as degraded or protocol-only. See [`compatibility-maintenance.md`](compatibility-maintenance.md) for quarterly review, retention, incident, and deprecation procedures, [`../production-readiness/release-status-handoff.md`](../production-readiness/release-status-handoff.md) for sanitized blocker ownership and release handoff semantics, and `aiw validate-release-approval` for scope-specific sign-off validation.

## Incident record minimum

A sanitized incident record should contain the source commit, runtime and adapter versions, correlation ID, pipeline and phase identifiers, selected profile, budget policy version, event summary, failure category, affected artifact names and checksums, approval status, recovery action, reviewer, and follow-up test. It must not contain secrets, raw prompts, raw MCP payloads, session transcripts, personal data, or authorization headers.

## Escalation and closure

Escalate when a control is bypassed, a credential may have been exposed, an external write is ambiguous, a checkpoint is corrupt, or a runtime change invalidates the capability matrix. Close the incident only after the target state is verified, recovery evidence is recorded, the relevant regression test exists, and the website mirror is synchronized.

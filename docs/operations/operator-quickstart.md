# Operator Quickstart — Safe AI Workflow Execution

**Version:** 1.0.0
**Last updated:** 2026-08-24
**Audience:** Operators preparing local development, pilot, or production runs

## Purpose and boundary

This guide is the shortest safe path through AI Workflow. It assumes a local-first repository checkout and an operator who controls the runtime installation, credentials, target repository, and approval decisions. It does not authorize bypassing preflight, MCP permissions, budgets, human approval, artifact-quality review, or recovery controls.

OpenCode is the current reference runtime. Other runtimes have experimental adapters and must not be described as production-certified until their real executable or host integration and controlled-pilot evidence have passed the requirements in the [multi-runtime compatibility guide](multi-runtime-compatibility.md).

## First-time setup

From a clean checkout:

```bash
npm ci --ignore-scripts --no-audit --no-fund
aiw setup
aiw health
```

Create `.env` only from `.env.example`. Use a dedicated least-privilege credential, keep the file mode at `600`, and never paste its value into a ticket, prompt, log, issue, or evidence record. `aiw setup` also installs a managed pre-commit hook when no custom hook exists; it checks documentation policy, website synchronization, and structural validation before local commits. CI remains the authoritative enforcement layer.

## Release-candidate validation

Run the repository-side checks before configuring or using a live runtime:

```bash
aiw self-test
aiw validate
aiw validate-mcp
aiw validate-budget
aiw validate-golden
aiw validate-events
aiw validate-pilot-evidence
aiw validate-runtime-certification tests/fixtures/runtime-certification.json
aiw runtime-watch
aiw validate-adapters
aiw certify-adapters
aiw docs-check
aiw website-check
aiw rollback-rehearsal
node scripts/security-check.js --history
aiw sync --check
```

`aiw certify-adapters` is fixture-only evidence. It validates normalized contracts and dry-run behavior but does not prove that a vendor runtime is installed or safe for live execution.

## Prepare a first pilot

Use a disposable or non-critical repository and non-sensitive input. Run:

```bash
aiw pilot-preflight --project-id disposable-smoke-001 --pipeline requirements-only
```

The command checks the real runtime prerequisites, validates the selected MCP profile, creates a checksum-backed state backup, and writes a sanitized run manifest. It does not invoke the runtime or MCP services. A blocked result is an environment finding, not a reason to weaken the gate.

## Safe execution sequence

Use the following order for a live run:

1. Confirm the runtime version, project classification, selected pipeline, enabled MCP profile, budget, approver, and output directory.
2. Start with the `pilot-read-only` profile. Keep browser, Slack, Vercel, deployment, publication, merge, payment, and account capabilities disabled unless a separate approved procedure enables them.
3. Run the read-only task and inspect sanitized events with `aiw events --json`.
4. Stop before any write or side effect and request explicit approval.
5. For an approved canary, create a dry-run plan with `aiw write-plan --operation <name> --target <approved-target> --canary`.
6. Use the deterministic idempotency key and reconcile ambiguous outcomes by inspection. Never blindly retry an uncertain external write.
7. Validate artifacts with schema, checksum, classification, and quality checks. Weak artifacts go to human review.
8. Preserve the checkpoint and backup until the run has been reviewed and the recovery path is no longer needed.

## Projection safety

Generate runtime projections into an isolated directory:

```bash
aiw generate-projections --output /tmp/aiw-projections --profile pilot-read-only
aiw install-projections --source /tmp/aiw-projections --target /path/to/project
```

The installation command is a dry-run by default. Existing files require both `--confirm` and `--overwrite`; overwritten files are backed up under `.ai-workflow/projection-backups/`. Review the generated diff and target path before any installation.

## Failure response

If the circuit breaker opens, a budget is exceeded, an approval is rejected, an MCP capability is denied, or an external outcome is ambiguous, stop and inspect the sanitized events, checkpoint, support bundle, and idempotency ledger. Use:

```bash
aiw events --json
aiw support-bundle /tmp/aiw-support-bundle
aiw rollback-rehearsal
```

Do not delete state files, bypass a gate, reset a circuit blindly, or rerun an uncertain publication. Restore only from a verified checksum-backed backup.

## Complete documentation rule

After any implementation, configuration, schema, pipeline, adapter, security, test, operational, website, or workflow change, update all affected documentation and `docs/changelog.md`. Run:

```bash
aiw docs-check
```

Read [`../documentation-policy.md`](../documentation-policy.md) for the path-aware mapping and review standard. For runtime promotion, use the sanitized evidence contract at `.ai-workflow/schemas/runtime-certification.schema.json`; fixture evidence cannot certify a live runtime.

## Website synchronization rule

After any authoritative documentation or configuration change:

```bash
aiw sync
aiw website-check
aiw sync --check
```

Review and commit the source files and generated `website/data/` files together. CI applies the same synchronization guard.

## Go/no-go rule

A repository-side green test suite is not a general production approval. General release requires real runtime preflight, live MCP verification, constrained smoke evidence, controlled-pilot evidence, recovery evidence, independent review, and no unresolved P0/P1 issue. See the [production runbook](production-runbook.md), [live smoke-test procedure](live-smoke-test.md), [release checklist](release-checklist.md), and [compatibility maintenance guide](compatibility-maintenance.md).

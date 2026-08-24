# AI Workflow Release Checklist

Use this checklist for every release candidate. A checked box must have evidence in the release report or linked CI run.

## Baseline and Scope

- [ ] Release branch is created from the intended `main` commit.
- [ ] `docs/production-readiness/release-candidate-baseline.md` records the commit, runtime versions, and open findings.
- [ ] Feature freeze is active; any exception has release-owner approval.
- [ ] Changelog, compatibility manifest, and known limitations are updated.

## Installation and Configuration

- [ ] `npm ci --ignore-scripts --no-audit --no-fund` succeeds from the release tag.
- [ ] `aiw setup` succeeds in a disposable clean clone and is idempotent on a second run.
- [ ] `aiw init <target>` creates only template configuration and a mode-600 target `.env`.
- [ ] No source credential is copied into the target project.
- [ ] `aiw health` reports missing optional tools as warnings and required failures as nonzero errors.

## Validation and Runtime Safety

- [ ] `aiw validate` passes structural and semantic checks.
- [ ] `aiw self-test` passes without credentials or paid model calls.
- [ ] `aiw docs-check` passes with all affected documentation and `docs/changelog.md` included.
- [ ] `aiw validate-runtime-certification tests/fixtures/runtime-certification.json` passes; the fixture remains blocked for live promotion.
- [ ] `aiw runtime-watch` passes informationally for the matrix; strict version watch passes for each runtime selected for live certification.
- [ ] `aiw pilot-preflight --project-id <disposable-id> --pipeline <pipeline>` creates a sanitized manifest and verified backup; actual live execution is recorded separately.
- [ ] `npm run validate:budget` passes and the selected run has explicit retry, duration, token, and API-call limits.
- [ ] `npm run validate:golden` passes against the compatibility manifest.
- [ ] All P0/P1 findings have regression coverage or an approved exception.
- [ ] Delayed asynchronous output cannot pass a dependent gate prematurely.
- [ ] Concurrent state access is rejected or serialized safely.
- [ ] Corrupt state is detected and previous valid state is recoverable.
- [ ] Sanitized checkpoints can be saved and resumed without embedding raw artifact content.
- [ ] Circuit-breaker behavior opens after repeated failures, blocks calls safely, and resets only after the cooldown/success path.
- [ ] Backup, checksum verification, restore, and previous-state retention are tested.
- [ ] The deployment approval remains indefinite and non-bypassable in every pipeline that includes deployment strategy.

## Security and Supply Chain

- [ ] `npm run validate:mcp` passes for the approved pilot profile.
- [ ] Runtime capability checks reject undeclared MCP permissions before invocation and require approval for write/deployment capabilities.
- [ ] Runtime budget enforcement is tested for retry, duration, token, and external-call hard stops.
- [ ] Event records validate against `skills/schema/execution-event.schema.json` and retention pruning is tested.
- [ ] `node scripts/security-check.js --history` passes on the full reachable history.
- [ ] `npm audit --audit-level=high --omit=optional` passes.
- [ ] `aiw version --json` matches `compatibility.json` and the intended release tag.
- [ ] GitHub Actions use immutable commit SHAs.
- [ ] All enabled and disabled MCP package references are semver-pinned.
- [ ] Secret scanning passes on the current tree and full history.
- [ ] Logs, support bundles, generated data, and backups contain no credentials or raw sensitive payloads.
- [ ] `aiw events --json` contains only the approved sanitized event schema and retention/deletion behavior has been tested.
- [ ] Retryable publication operations use a deterministic idempotency key and duplicate-claim behavior has been tested.
- [ ] `aiw support-bundle` has been tested and only sanitized diagnostics are shared.
- [ ] Publication credentials are separate from local development credentials.

## Website Data and Publication

- [ ] `aiw sync --check` passes without modifying the working tree.
- [ ] A normal `aiw sync` produces byte-identical source-to-mirror data.
- [ ] Stale mirror files are removed only inside the generated data scope.
- [ ] Target website repository branch and destination path are verified.
- [ ] Publication is performed only with explicit `--confirm-website` approval.
- [ ] A canary-only dry-run write plan is reviewed before any new write-capable operation.
- [ ] Ambiguous external-write outcomes are reconciled before retry; duplicate operation keys are rejected.
- [ ] The target diff is reviewed before push.
- [ ] Website rollback commit is identified.
- [ ] `aiw rollback-rehearsal` passes in a disposable workspace and the report contains no raw state.

## Pilot and Release

- [ ] The operator-owned live smoke sequence in `docs/operations/live-smoke-test.md` completes on a non-critical repository.
- [ ] One constrained pipeline completes on a non-critical repository.
- [ ] One full pipeline completes with non-sensitive data.
- [ ] Human gate decisions and recovery actions are recorded.
- [ ] `aiw validate-pilot-evidence` passes the sanitized evidence record.
- [ ] `aiw validate-runtime-certification <private-runtime-certification.json>` passes and records capability-specific evidence only.
- [ ] `aiw score-artifact` is run for representative artifacts; weak outputs route to human review.
- [ ] No unresolved P0/P1 finding remains.
- [ ] Release tag is created from the passing commit.
- [ ] Release notes include upgrade, rollback, compatibility, and known-limitations guidance.
- [ ] A second person or independent review confirms security and rollback readiness.
- [ ] The capability matrix, version ranges, adapter deprecation status, evidence retention, incident path, and release communication have been reviewed according to [`compatibility-maintenance.md`](compatibility-maintenance.md).

## Sign-off

| Role | Name | Date | Decision |
|---|---|---|---|
| Release owner |  |  |  |
| Security reviewer |  |  |  |
| Pilot operator |  |  |  |
| Independent reviewer |  |  |  |

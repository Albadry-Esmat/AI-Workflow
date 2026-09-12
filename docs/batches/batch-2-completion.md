# Batch 2 Completion Report — Synchronization Integrity and Release Manifest

**Batch status:** Complete; waiting for explicit confirmation before Batch 3
**Date:** 2026-08-16
**Source branch:** `AI-Workflow/Dev`
**Website branch:** `ASE-OS-Website/Dev`

## Scope completed

Batch 2 made the AI-Workflow Dev → ASE-OS-Website Dev synchronization exact, deletion-aware, hash-verifiable, and auditable through a versioned ReleaseManifest. No `main` branch was modified.

## AI-Workflow implementation

- Added `scripts/data-integrity.py` for deterministic tree hashing, exact source/target comparison, and deletion/changed-file self-tests.
- Added `scripts/generate-release-manifest.py` for versioned source/website commit, branch, data hash, registry version, and validation metadata.
- Added `config/release-manifest-schema.json` with strict branch, commit, hash, status, and manifest-version constraints.
- Added `--test-deletion` to `scripts/sync-website-data.sh`. It injects a temporary stale file, verifies `--check` detects it, runs a real exact sync in a temporary mirror, and verifies the stale file is removed.
- Updated local `aiw sync --website` to generate a ReleaseManifest over the exact mirrored data tree.
- Reworked `.github/workflows/sync-website.yml` to validate source data, run the deletion regression test, replace the website data directory exactly, compare the mirror, compute a deterministic hash, generate a ReleaseManifest, and push only to the website `Dev` branch.
- Added Python and AJV validation dependencies to the sync workflow.

## Website implementation

- Added `data/release-manifest.json` to `ASE-OS-Website/Dev`.
- The manifest records source commit `58fc73398d97ae97d8494dd572fdba253c6b8f20`, website synchronization base commit `368de9637ae514946d303ff3dbe8f6995704d2d1`, registry version `5.3.0`, and data hash `sha256:3ac5b16420edbf54561517897d4d20b22827affedd4f062552445f213d44d38c`.
- `website_commit_role: sync-base` explicitly states that the recorded website commit is the checked-out base before the sync commit, avoiding a self-referential manifest.
- Website presentation code was not changed.

## Validation evidence

| Check | Result |
|---|---|
| Shell syntax for sync script | Passed |
| Python compilation for integrity and manifest utilities | Passed |
| Data-integrity self-test | Passed |
| Sync deletion regression test | Passed; stale files detected and removed |
| ReleaseManifest generator validation | Passed |
| ReleaseManifest JSON syntax | Passed |
| AI-Workflow data mirror check | Passed; 140 files up to date |
| Website ESLint | Passed |
| Website tests | **39 passed** |
| Website production build | **129 static pages generated successfully** |
| Data tree hash equality excluding manifest | **Passed** |

## Commits

| Repository | Commit | Purpose |
|---|---|---|
| `AI-Workflow` | `58fc733` | Add deletion-safe mirror, deterministic integrity utilities, ReleaseManifest schema/generator, and CI integration |
| `ASE-OS-Website` | `ebdcb67` | Add the AI-Workflow Dev ReleaseManifest |

Both commits are pushed to their respective `Dev` branches.

## Security and release notes

The synchronization workflow still pushes only to `ASE-OS-Website/Dev`. Production `main` promotion remains a deliberate, separate operation. The ReleaseManifest does not authorize deployment; it supplies compatibility evidence for a later release gate.

The current workflow checks the website out at its Dev base commit, creates the manifest, and then commits the manifest and mirrored data. The manifest therefore records the pre-sync website commit with `website_commit_role: sync-base`, while the containing website commit is the next Git commit. The source commit is the exact AI-Workflow commit whose data was validated and synchronized.

## Rollback

Revert AI-Workflow commit `58fc733` to remove the Batch 2 workflow and utility changes. Revert website commit `ebdcb67` to remove the manifest. The prior data mirror and Batch 1 behavior remain available in the preceding commits.

## Follow-ups for later batches

- Batch 3: add versioned run evidence schemas; do not add runtime instrumentation before the contracts are reviewed.
- Batch 7: use the ReleaseManifest as a coordinated promotion gate.
- Future work may add website build status to the manifest after CI builds the target website; Batch 2 records `not-run` for the workflow-generated manifest and the local validation evidence separately.
- Existing root-level planning artifacts remain uncommitted and are unrelated to Batch 2.

> **Batch 2 complete. Waiting for explicit confirmation before starting Batch 3.**

# Onboarding Contract — Batch O0

## Scope

This contract defines how users install and first-use AI-Workflow without making OpenCode, Claude Code, Codex, or another AI-agent runtime a core dependency. The source-owned machine-readable contract is `config/onboarding-o0-contract.json`; its schema is `config/onboarding-o0-schema.json`.

O0 is a design-and-baseline batch. It does not implement the future `aiw agent`, `aiw auth`, `aiw demo`, or adapter launch commands. It establishes the behavior those commands must eventually provide.

## Required first-run phases

```text
install core
  → diagnose core
  → detect available runtimes
  → select runtime or deterministic auto-selection
  → run credential-free demo
  → authenticate only the requested capability
  → preflight target project
  → choose linked or standalone integration
  → start selected runtime through its adapter
```

The no-secret sequence is deliberately shorter:

```text
aiw setup --check-only
  → aiw doctor
  → aiw agent detect
  → aiw demo
```

The future implementation must not require a provider account, GitHub token, runtime login, or target-project mutation for this sequence.

## Installation lanes

The contract defines native, project-local, and Dev Container/Codespace lanes. Native installation is host-dependent but should use user-local or explicitly selected package-manager paths. Project-local installation is version-pinned. The container lane is image-defined and may offer selectable runtime features. None of the lanes may silently install a named runtime or store raw credentials.

## Authentication boundary

AI-Workflow owns the decision that a capability requires authentication, but it does not own raw runtime/provider secret storage. Runtime-specific browser login, API-key approval, enterprise gateway, or external GitHub CLI login remains delegated to the relevant adapter or provider. Future status commands must report authenticated/unauthenticated state and scope sufficiency without printing secret values.

## Safety invariants

The core must remain runtime-neutral. Explicit runtime selection must not silently fall back. Automatic selection must be deterministic and recorded. Unknown capabilities must remain unknown and fail closed for support claims. Generic command mode must not claim runtime-specific safety or evidence. Target-project initialization must never copy secrets and must establish backup/rollback before mutation. The selected adapter ID must be present in run evidence.

## Baseline metrics

O0 records baseline-only and hard-gate metrics for time-to-demo, setup idempotence, adapter detection, no-secret execution, no-silent-fallback selection, support-claim maturity, authentication boundaries, and rollback. Future batches may add the actual clean-environment timing harness, but no performance claim is made until it is measured.

## Future batch boundaries

| Batch | Boundary |
|---|---|
| O1 | Pinned core/adapter toolchain and check-only setup behavior |
| O2 | Guided setup, agent detection/selection, and structured diagnostics |
| O3 | Provider-neutral authentication and runtime onboarding |
| O4 | Target preflight, linked/standalone modes, backup, rollback, and adapter launch evidence |
| O5 | Multi-adapter Dev Container/Codespace lane |
| O6 | Documentation, cross-platform QA, support matrix, and release packaging |

## Rollback

O0 creates no runtime installation and no target-project mutation. To roll back, revert the O0 source commit on `Dev`, regenerate the website data mirror, and rerun the source validation and ReleaseManifest compatibility checks. Future O4 target changes must be backed up and reversible independently.

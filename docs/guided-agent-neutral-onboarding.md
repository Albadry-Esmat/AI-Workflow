# Guided Agent-Neutral Onboarding — O3

Onboarding O3 adds a guided first-use layer on top of O2. It gives users a deterministic plan before any apply action, makes the installation lane explicit, summarizes runtime availability and catalog installation channels, and records a redacted state ledger when the user explicitly authorizes core setup.

## Recommended flow

Start with a no-write plan:

```bash
aiw onboarding plan --lane native
```

The supported lanes are:

| Lane | Meaning | Runtime handling |
|---|---|---|
| `native` | Use the existing host environment. | The user installs and manages the runtime. AI-Workflow only performs safe detection. |
| `project-local` | Keep project dependencies pinned and scoped. | The core uses project-local dependencies; runtime installation remains user-controlled. |
| `dev-container` | Use a repository or Codespace container. | Container creation and features remain user-controlled; O3 does not provision the container. |

For machine-readable output, add `--json`. The plan performs no writes and disables network resolution for the O3 planning layer. It reports the core toolchain step, safe runtime probes, deterministic selection result, delegated authentication boundary, deferred target initialization, and deferred launch.

After reviewing the plan, apply only the AI-Workflow-owned core setup with explicit consent:

```bash
aiw onboarding apply --yes --lane native --agent auto
```

`--yes` is mandatory. O3 may reuse the existing deterministic O1 core setup, which can install the project’s pinned development dependencies through the approved setup path. O3 does not install an agent runtime, execute a platform-specific installer, start provider login, accept raw credentials, initialize a target project, or launch a runtime.

Resume a previously authorized O3 core setup with:

```bash
aiw onboarding apply --yes --resume --lane native --agent auto
```

Inspect the complete guided diagnostic with:

```bash
aiw onboarding doctor --json
```

## Runtime installation boundary

The runtime catalog declares supported installation channels and official documentation, but O3 does not invent executable installer commands. This is deliberate: an installer command is platform-specific and must be verified with provenance, checksum, rollback, and consent controls before automation. O3 therefore presents installation guidance as a user action and reports `user-controlled-deferred` with zero installer commands executed.

Once a user has installed a runtime through an approved channel, the existing O2 commands remain the source of truth for safe detection and selection:

```bash
aiw agent detect --json
aiw agent use auto --json
# or: aiw agent use opencode --json
```

Automatic selection remains deterministic. Explicit selection fails closed when the adapter is unavailable or incompatible. No selection silently falls back to another runtime.

## Authentication, target, and launch boundaries

Authentication status is delegated and redacted. `aiw auth status` can describe the selected runtime boundary, but `aiw auth login` and `aiw auth logout` remain runtime-owned. O3 does not receive, store, copy, or print raw provider, runtime, GitHub, or API secrets.

Target initialization and launch remain later guarded operations. O3 never modifies a target project, copies `.env` values into a target, or starts a provider-specific command. The legacy `aiw start` path remains unchanged and OpenCode-specific until an explicitly approved launch-adapter batch replaces it with a verified neutral dispatcher.

## State and recovery

O3 stores redacted state under `.aiw/onboarding-o3/` and writes evidence only within that owned root. State writes are atomic. `aiw onboarding recover` resets incomplete O3 steps; `aiw onboarding recover --reset-state` removes only the O3-owned state directory. Neither command removes runtimes, credentials, target-project files, or pre-existing user state.

## Rollback

O3 changes are reversible on `Dev`. Revert the O3 source commit, then rerun source validation, the generated website mirror check, website tests/build, and the ReleaseManifest compatibility gate. Local O3 state can be removed independently with `aiw onboarding recover --reset-state`.

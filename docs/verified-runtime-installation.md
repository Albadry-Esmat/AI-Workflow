# Verified Agent-Neutral Runtime Installation — O4

> **Transitional technical debt:** `config/runtime-installer-catalog.json` predates
> the Declare → Verify → Consume → Execute boundary and is marked
> `transitional-technical-debt` (operator-owned, never executed by workflow code).
> It remains only because O4 planning/verification still reads its records as
> reference data. Delete the catalog once O4 migrates to
> `config/runtime-prerequisites.json` declarations.

Onboarding O4 adds a **provenance-aware installer control plane** without coupling AI-Workflow to a single runtime. It turns official installation documentation into reviewable source-owned records, exposes platform-specific plans, verifies already-installed runtimes through bounded read-only probes, and blocks automatic installation when a record is not eligible under the fail-closed policy.

## Why O4 is intentionally conservative

The official runtime documents expose several different installation channels. OpenCode documents an install script, npm, Homebrew, platform package managers, Docker, and release binaries [1]. Claude Code documents native installers, Homebrew, WinGet, Linux package managers, npm, binary-integrity guidance, and a read-only `claude doctor` diagnostic [2]. Codex documents standalone macOS/Linux and Homebrew/npm channel choices and separates installation from first-run sign-in [3].

These commands have different platform, shell, privilege, network, update, and rollback semantics. In particular, network-fetched shell installers and PowerShell expression installers are not safe to execute through a generic workflow runner merely because their text came from an official page. O4 therefore treats installer commands as **data** until their record satisfies provenance, review, exact-selection, platform, shell, command-policy, and explicit-consent requirements.

The current catalog contains nine official source-reviewed records. All are `manual-only`, and the policy has zero eligible records. That means O4 can provide accurate guidance and verification without making an unsafe claim that it can install every runtime on every host.

## Commands

Start with a machine-readable plan:

```bash
aiw onboarding install-plan --agent auto --json
```

The plan filters by the current platform, architecture, and shell, or accepts explicit `--platform`, `--architecture`, and `--shell` values for review. It shows the exact installer ID, command display text, official URL, source fingerprint, review status, verification probes, rollback owner, and blocked reasons. Planning performs no network resolution, writes no installer state, and executes zero commands.

Verify an already-installed runtime without installing or authenticating it:

```bash
aiw onboarding install-verify --agent opencode --json
aiw onboarding install-verify --agent claude-code --json
aiw onboarding install-verify --agent codex --json
```

Verification resolves the selected adapter’s existing executable, runs its cataloged version probe, and optionally runs a documented read-only doctor command. It records only redacted evidence under `.aiw/onboarding-o4/`; it does not start login, copy credentials, mutate a target project, or launch a runtime.

The install command requires an exact catalog record and explicit consent:

```bash
aiw onboarding install --installer INS-OPENCODE-NATIVE-SCRIPT --yes --json
```

Under the current O4 policy this command fails closed for every record because the records are `source-reviewed` rather than `verified`, and because shell pipelines, network downloads, and package-manager mutations are disabled. A failure with `O4-INSTALL-NOT-ELIGIBLE` is a safety result, not a missing feature: the user receives the official command in the plan and can run it through the vendor’s documented workflow.

## Catalog record model

Each record is keyed by adapter, platform, architecture, shell, and channel. It includes the display command and tokenized arguments, requirements, official provenance, a source fingerprint, review status, read-only verification probes, and rollback ownership.

| Record field | Purpose |
|---|---|
| `installer_id` | Prevents ambiguous or silent channel selection. |
| `platform`, `architecture`, `shell` | Prevents using a command outside its documented host boundary. |
| `channel` and `command` | Makes package-manager, native-script, Docker, and binary channels distinguishable. |
| `provenance` | Binds the record to an official URL, source kind, retrieval date, command location, and `sha256:` fingerprint. |
| `review.status` | Distinguishes source-reviewed research from a future verified record. |
| `verification` | Defines bounded version and optional doctor probes that must be read-only. |
| `rollback` | Records who owns uninstall/rollback guidance and prevents target-project impact claims. |

## Command policy

O4 currently blocks network downloads, shell-piped installers, PowerShell expression installers, elevated commands, global package-manager mutation, Docker mutation, target-project mutation, and automatic authentication. An eligible record would need a future policy change that is separately reviewed and would still require exact record selection and `--yes`.

The command-class policy is intentionally independent from source reputation. An official source can establish provenance, but it does not automatically authorize execution inside AI-Workflow. This separation prevents documentation retrieval from becoming implicit permission to mutate the host.

## Authentication, targets, launch, and recovery

Runtime authentication remains runtime-owned. O4 does not accept, store, print, or copy API keys, browser tokens, provider credentials, or login output. Target initialization and neutral launch remain deferred to later gated batches. Installation verification does not run a session, and installation planning does not inspect target-project secrets.

O4 state is atomic and redacted under `.aiw/onboarding-o4/`. Recover owned state with:

```bash
aiw onboarding recover --o4 --json
aiw onboarding recover --o4 --reset-state --json
```

Recovery removes or resets only O4-owned state. It does not uninstall runtimes, alter package-manager state, touch credentials, or modify target projects.

## References

[1]: https://opencode.ai/docs/ "OpenCode official documentation — Intro and installation channels"
[2]: https://code.claude.com/docs/en/setup "Claude Code official documentation — Advanced setup, verification, integrity, and authentication boundaries"
[3]: https://learn.chatgpt.com/docs/codex/cli "OpenAI official Codex CLI documentation — installation and sign-in quickstart"

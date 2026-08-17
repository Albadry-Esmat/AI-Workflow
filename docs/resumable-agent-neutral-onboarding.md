# Resumable Agent-Neutral Onboarding — O2

Onboarding O2 turns the O0/O1 contracts into a usable, provider-neutral onboarding layer. The core workflow can now diagnose itself, detect candidate agent runtimes safely, record an explicit or deterministic automatic selection, run a no-secret demo, report delegated authentication status, and recover O2-owned state after an interrupted setup.

## User-facing sequence

The intended first-use sequence is:

```text
aiw setup
aiw doctor
aiw agent detect
aiw agent use auto
aiw demo
aiw auth status
```

A clean no-secret path is available with:

```text
aiw setup --check-only
aiw doctor --json
aiw agent detect --json
aiw demo --json
```

The no-secret path performs no provider login, does not require an agent runtime, does not write to a target project, and records zero external writes. A runtime can be selected explicitly with `aiw agent use opencode`, `aiw agent use claude-code`, `aiw agent use codex`, or `aiw agent use generic-command` when the corresponding safe probe is available. Explicit selection fails closed when the adapter is absent or incompatible. `auto` uses the source-owned precedence from `config/onboarding-o2-policy.json` and records the reason.

## Resumable state

O2 stores only redacted onboarding metadata under `.aiw/onboarding-o2/`. The state file is written atomically and contains step statuses, attempts, timestamps, error codes, runtime selection metadata, delegated auth status, demo evidence, and an owned-path recovery boundary. It does not contain raw credentials, environment values, command output, or target-project contents.

`aiw setup --resume` reuses the state ledger and continues from the first incomplete step. `aiw recover` resets failed or interrupted O2 steps to pending without touching runtimes or target projects. `aiw recover --reset-state` removes only the O2 state file.

## Runtime detection and selection

Detection invokes only the catalog-declared executable and version arguments, normally `<runtime> --version`, with a reduced environment and a short timeout. It never installs a runtime and never invokes login, launch, project initialization, or provider operations. Detection output is structured and includes adapter ID, support level, executable presence, version when available, probe status, and a safe reason.

Selection is a separate operation. Automatic selection is deterministic and uses the policy precedence. Explicit selection never falls back. Every successful selection records the adapter ID, mode, version, timestamp, and evidence marker in O2 state and evidence JSONL.

## Authentication boundary

O2 only reports delegated status. It does not start login, receive raw credentials, copy `.env` values, print secrets, or claim that a provider is authenticated based on an environment variable alone. Runtime-specific authentication remains owned by the selected runtime and is deferred to later adapter work.

## Diagnostics

`aiw doctor --json` combines the O1 check-only/no-network toolchain evidence, O2 runtime detection, O2 state presence, delegated authentication status, redacted warnings, and a fail/pass verdict. Required toolchain failures return a non-zero exit code; absent optional runtimes remain warnings. This distinction prevents a healthy core from being blocked merely because no runtime has been installed.

## Explicit non-goals

O2 does not install OpenCode, Claude Code, Codex CLI, or a generic command. It does not automate browser/device login, provider login, target-project initialization, target-project mutation, runtime launch, provider-specific safety mapping, or container provisioning. Those behaviors remain later gated work and require adapter-specific evidence before any first-class support claim.

## Rollback

O2 changes are source-owned and reversible on `Dev`. Local state can be removed with `aiw recover --reset-state` or by deleting `.aiw/onboarding-o2/`. The command removes no runtime binaries, credentials, target-project files, or pre-existing user state. A Git rollback must use `git revert` on the source and website `Dev` branches followed by the normal mirror and ReleaseManifest compatibility gates.

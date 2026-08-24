# Multi-Runtime Compatibility Guide

## Purpose

AI Workflow now uses a runtime-neutral compatibility boundary. The canonical workflow core owns pipeline semantics, artifact contracts, MCP permissions, budgets, approvals, checkpoints, rollback, idempotency, and sanitized evidence. Runtime adapters translate those contracts into the native interface of an agent product.

> **Compatibility does not mean identical vendor behavior.** A runtime is supported only at the tier and capability level demonstrated by its certification evidence.

## Current support statement

OpenCode remains the reference **Tier 1** adapter. Claude Code, OpenAI Codex CLI, Gemini CLI, and Aider have supervised terminal adapter projections and are currently **experimental / repository-fixture-only**. Cursor, GitHub Copilot agent surfaces, Cline/Roo Code, and Windsurf have host/editor projections and are also **experimental / repository-fixture-only**. No external runtime has live smoke-test or controlled-pilot certification yet.

| Tier | Meaning | Current status |
|---|---|---|
| Tier 1 native adapter | AI Workflow can launch the runtime, normalize lifecycle events, enforce approvals and budgets, checkpoint/resume, and validate artifacts. | OpenCode reference; terminal adapters experimental until real evidence exists. |
| Tier 2 host/editor adapter | AI Workflow integrates through a host, extension, hook, ACP bridge, or supervised wrapper. | Cursor, Copilot, Cline/Roo, and Windsurf projections are experimental. |
| Tier 3 protocol-only | The runtime can consume MCP or canonical files but does not expose enough lifecycle control for full orchestration. | Other runtimes are unsupported until explicitly added to the matrix. |

## Commands

From the repository root:

```bash
aiw validate-adapters
aiw certify-opencode
aiw certify-adapters
aiw generate-projections --output /tmp/aiw-projections --profile pilot-read-only
```

To install a reviewed projection set, use a disposable target first. Generation is isolated, and installation is a dry-run unless explicitly confirmed:

```bash
aiw generate-projections --output /tmp/aiw-projections --profile pilot-read-only
aiw install-projections --source /tmp/aiw-projections --target /path/to/project
aiw install-projections --source /tmp/aiw-projections --target /path/to/project --confirm
```

Existing target files are never overwritten unless `--overwrite` is also supplied. When overwriting is explicitly approved, the installer creates a mode-700 backup directory under the target’s `.ai-workflow/projection-backups/` path. Review generated diffs before installation.

To certify a fixture adapter without invoking a live runtime:

```bash
node scripts/adapter-certification.js claude-code
node scripts/adapter-certification.js codex-cli
node scripts/adapter-certification.js gemini-cli
node scripts/adapter-certification.js aider
node scripts/adapter-certification.js cursor
node scripts/adapter-certification.js github-copilot
node scripts/adapter-certification.js cline-roo
node scripts/adapter-certification.js windsurf
```

These commands prove descriptor validity, normalized requests, policy denial, event sanitization, and dry-run behavior only. The aggregate command reports every registered adapter as `fixture-certified` only when those local checks pass. They do not prove that the vendor runtime is installed, authenticated, or capable of safe live execution.

## Installation and projection policy

Canonical configuration lives under `.ai-workflow/`. Runtime projections are generated from canonical sources and written to an explicitly selected output directory. The generator never silently edits a user’s `CLAUDE.md`, `AGENTS.md`, Cursor rules, Gemini guidance, or editor configuration. Review generated diffs before installing them into a project.

The first profile should be `pilot-read-only`. Playwright, Slack, Vercel, deployment tools, direct publication, account changes, payments, and browser side effects remain disabled. Any adapter that cannot enforce central approval, budget, checkpoint, and idempotency rules must remain read-only or artifact-exchange-only.

## Certification path

Each runtime follows four stages. First, its adapter descriptor and capability matrix are validated locally. Second, the adapter passes the credential-free contract harness using dry-run requests and fake or absent runtimes. Third, an operator verifies the real executable or host integration and MCP startup on a disposable non-sensitive project. Fourth, the operator performs the constrained smoke sequence and controlled pilot defined in `docs/operations/live-smoke-test.md`.

A runtime cannot be promoted from experimental to certified solely because it supports MCP, accepts an instruction file, or can edit files. Certification requires evidence for approvals, event normalization, budget stops, checkpoint/resume behavior, artifact schema validation, failure containment, and safe handling of ambiguous external outcomes.

## Runtime-specific limitations

| Runtime family | Current implementation | Main limitation before certification |
|---|---|---|
| OpenCode | Reference adapter with full contract surface. | Real executable, MCP startup, and live pilot remain operator-owned. |
| Terminal agents | Shared supervised adapter for Claude Code, Codex CLI, Gemini CLI, and Aider. | Native flags, event streams, approvals, and resume semantics must be verified per version. |
| Editor agents | Shared host adapter for Cursor, Copilot, Cline/Roo Code, and Windsurf. | Host lifecycle callbacks, pre-action blocking, checkpoints, and cancellation may be surface- or plan-dependent. |
| Other agents | Tier 3 protocol-only consideration. | No support claim until a descriptor, adapter, tests, and evidence exist. |

## Release rules

Every adapter change must update the registry, capability matrix, compatibility evidence, and relevant documentation. CI runs adapter configuration validation, dry-run certification for every target, deterministic projection generation, and the existing conformance suite. New write-capable integrations require a canary plan, explicit human approval, budget enforcement, idempotency, reconciliation, and an independent review.

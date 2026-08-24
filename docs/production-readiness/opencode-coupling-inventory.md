# OpenCode Coupling Inventory and Canonical Boundary

**Status:** Completed as Phase 0 baseline evidence  
**Date:** 2026-08-24  
**Scope:** Identify OpenCode-specific surfaces that must remain behind the runtime adapter boundary.

## Decision

OpenCode remains the reference runtime and its current behavior is preserved. The runtime-neutral core owns pipeline semantics, policy, approvals, budgets, state, checkpoints, rollback, idempotency, artifacts, quality decisions, and sanitized evidence. OpenCode-specific executable calls, configuration paths, skill projections, session paths, and native instructions are adapter or projection concerns.

The first compatibility release remains **read-only by default**. It does not enable new browser, messaging, deployment, publication, payment, account, or other side-effect capabilities. New runtimes cannot inherit OpenCode’s support tier from MCP connectivity or fixture tests.

## Coupling inventory

| Surface | Current examples | Classification | Canonical owner after boundary extraction |
|---|---|---|---|
| Executable invocation | `opencode`, `AIW_OPENCODE_BIN`, version-only preflight, `aiw start` | Runtime-specific invocation | OpenCode adapter; shared subprocess contract |
| Native configuration | `opencode.json`, model/agent assignment, MCP server declarations, skill paths | Runtime projection | `.ai-workflow/config.json` plus generated OpenCode projection |
| Skill layout | `.opencode/skills/<name>/SKILL.md`, skill isolation rules, skill registry path references | Runtime projection and existing source tree | Canonical skill manifest plus per-runtime projection |
| Agent instructions | `.opencode/agent/*.md`, OpenCode-specific agent rules | Runtime projection | Canonical operating rules plus generated runtime instructions |
| Runtime state | `.opencode/state/`, session templates, event log, state locks and backups | Runtime storage implementation | Runtime-neutral state/checkpoint contracts with OpenCode storage adapter |
| Session management | `aiw sessions`, session cleanup, resume and state paths | CLI/runtime integration | Shared lifecycle contract; OpenCode implementation behind adapter |
| MCP startup and permissions | OpenCode MCP declarations and `mcp-permission-policy.json` | Core policy plus runtime projection | Core MCP policy; adapter-specific startup/config bridge |
| Pipeline sources | `skills/pipelines/*.json`, semantic validation, skill references | Runtime-neutral workflow core | Canonical pipeline compiler and validator |
| Artifact contracts | Golden artifacts, event schema, quality scoring, evidence records | Runtime-neutral workflow core | Canonical schemas and artifact store |
| Website synchronization | `scripts/sync-website-data.sh` mirrors `.opencode/skills/` and `opencode.json` | Publication projection | Manifest-driven publication; runtime content is an input projection |
| Documentation | README, CONTRIBUTING, CONSTITUTION, runbooks with OpenCode commands | Documentation | Explicit runtime-specific sections plus canonical compatibility guide |
| Release checks | Strict preflight requiring OpenCode and `.env` | Operator/runtime gate | Adapter discovery and runtime-specific preflight; no fabricated pass |

## Controlled vocabulary

| Term | Meaning |
|---|---|
| `reference` | The runtime whose behavior defines the first adapter contract and current regression baseline. |
| `experimental` | Repository-side adapter or projection exists and passes fixture tests, but real-runtime evidence is absent. |
| `operator-verified` | Real executable or host integration was checked by an operator, but the complete pilot evidence set is not yet complete. |
| `pilot-certified` | Required smoke, recovery, artifact, approval, and controlled-pilot evidence passed with independent review. |
| `degraded` | The runtime can perform only a declared subset, such as read-only work or artifact exchange. |
| `blocked` | Execution must stop because a required capability, version, approval, policy, or runtime prerequisite is absent. |
| `deprecated` | The adapter is retained for historical compatibility but must not be selected for new runs. |
| `fixture-certified` | Only deterministic local contract tests passed; this is never a production-support claim. |

## Required boundary rules

1. Core modules must not import vendor SDKs or parse vendor-specific output directly.
2. Every adapter must declare its supported operations and unsupported or wrapper-required behavior.
3. Every runtime request must carry a correlation ID, pipeline and task identity, MCP profile, project classification, budget, required capabilities, and dry-run/write mode.
4. Every event, checkpoint, artifact envelope, and evidence record must be sanitized and versioned.
5. Generated runtime files must be deterministic, checksummed, reviewable, and written only to an explicit output directory.
6. A missing runtime executable or host integration is a typed blocked result, not a successful fixture result.

## Evidence

The inventory was produced from a repository-wide search for `opencode`, `.opencode`, `OpenCode`, `AIW_OPENCODE`, and `OPENCODE` references. It includes current CLI, configuration, skill, state, documentation, publication, and release-check surfaces. The detailed raw search output remains a local diagnostic artifact; this document is the sanitized source-of-truth record.

# Agent-Neutral Runtime Adapters

## Purpose

AI-Workflow is a workflow control plane, not a plugin for one named AI-agent runtime. The core owns skills, orchestration intent, execution contracts, capability policy, budgets, evaluations, evidence, target-project safety, and lifecycle state. A runtime adapter translates those neutral controls into the interface of a selected agent.

The initial O0 catalog names OpenCode, Claude Code, Codex CLI, and a generic user-managed command. These are **candidate or generic entries**, not claims of completed first-class support. A runtime becomes first-class only after its detection, authentication boundary, launch behavior, safety mapping, evidence behavior, and recovery fixtures pass.

## Adapter contract

Every adapter is defined by `config/agent-runtime-catalog.json`, validated by `config/agent-runtime-adapter-schema.json`, and governed by `config/agent-runtime-policy.json`.

An adapter declares its identity, official documentation, safe executable/version probe, supported installation channels, authentication ownership and status boundary, project-context behavior, launch command, safety mapping, evidence events, recovery claims, and capability matrix. Unknown behavior must remain `unknown`; it must not be promoted to a positive safety or evidence claim by inference.

| Adapter area | O0 rule |
|---|---|
| Installation | AI-Workflow does not install a runtime by default. Installation requires explicit user action and is runtime-specific. |
| Selection | Explicit selection never silently falls back. `auto` selection must be deterministic and recorded. |
| Authentication | Authentication is delegated to the runtime, provider, or approved external CLI. AI-Workflow does not store raw secret values. |
| Project context | The target directory is explicit. Secrets are never copied into a target project. |
| Safety | Plan, approval, sandbox, and write behavior are declared per adapter. Unknown means unknown. |
| Evidence | The selected adapter ID must be included in run evidence. O0 claims only launch-level evidence until fixtures prove more. |
| Generic mode | Generic commands are a convenience path and cannot claim runtime-specific safety or evidence. |

## Initial catalog

| ID | Runtime | O0 status | Support level | Auth owner | Current evidence claim |
|---|---|---|---|---|---|
| `opencode` | OpenCode | Planned | Candidate | Runtime | Launch-only; fixture pending |
| `claude-code` | Claude Code | Planned | Candidate | Runtime | Launch-only; fixture pending |
| `codex` | Codex CLI | Planned | Candidate | Runtime | Launch-only; fixture pending |
| `generic-command` | User-managed command | Planned | Generic | User | None beyond process start/failure |

Official runtime documentation is recorded in the catalog. Current O0 research reviewed [OpenCode](https://opencode.ai/docs/), [Claude Code](https://code.claude.com/docs/en/quickstart), and [Codex CLI](https://github.com/openai/codex). The research establishes installation and authentication patterns only; it does not grant first-class support.

## Proposed neutral CLI surface

The exact CLI implementation is deferred to later onboarding batches. O0 specifies the contract:

```bash
aiw agent list
aiw agent detect
aiw agent use <adapter-id|auto>
aiw agent doctor [--agent <adapter-id>]
aiw auth status [--provider <id>]
aiw auth login [--provider <id>]
aiw auth logout [--provider <id>]
aiw start <target> --agent <adapter-id|auto>
```

The current `aiw` behavior is not silently changed by O0. This batch records the target contract and validates the policy/catalog. O1 and later batches may implement the runtime detection and launch adapters after explicit approval.

## Installation lanes

O0 defines three supported lanes:

| Lane | Role | Runtime handling |
|---|---|---|
| Native | Users managing their own machine | User selects and installs the agent; AI-Workflow verifies it |
| Project-local | Teams and CI requiring reproducible tools | Core and selected adapter dependencies are pinned in project configuration |
| Dev Container/Codespace | Portable and repeatable environment | Core tools are image-defined; adapters are selectable features or explicit user-managed installs |

Every lane must provide a credential-free demo and a diagnostic path. Provider authentication is on demand and is not a prerequisite for validating the core contracts.

## O0 non-goals

O0 does not install OpenCode, Claude Code, Codex, or any other agent. It does not add provider login flows, mutate target projects, replace the current `aiw start` implementation, claim runtime-specific sandbox guarantees, or grant first-class support based only on executable presence. Those are future gated batches.

## Rollback

O0 changes are contract, catalog, documentation, validator, and generated website-data changes. They do not install a runtime or modify a user target project. Rollback is a normal revert of the O0 source commit followed by the source validation, mirror check, and ReleaseManifest compatibility gates. Any future target-project initialization must create a backup manifest before mutation.

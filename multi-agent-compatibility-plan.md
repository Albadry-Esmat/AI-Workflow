# AI Workflow Multi-Agent Compatibility Plan

## Goal and decision

The goal is to make AI Workflow usable with the leading AI coding-agent runtimes without weakening its existing safety, artifact, approval, state, budget, and rollback controls. The correct target is **portable workflow compatibility**, not a promise of identical feature parity across every vendor product.

“Compatible with all” will therefore mean that every supported runtime can execute the same canonical workflow contract through a tested adapter, while runtime-specific features are explicitly declared as supported, emulated, degraded, or unavailable. No runtime will be allowed to bypass the central policy layer merely because it has a different plugin, hook, or prompt format.

The initial compatibility target should cover **OpenCode, Claude Code, OpenAI Codex CLI, Cursor, GitHub Copilot agent surfaces, Gemini CLI/Code Assist, Cline/Roo Code, Windsurf, and Aider**. Current industry comparisons consistently place Cursor, Claude Code, Codex, GitHub Copilot, Gemini CLI, Cline, and Windsurf among the leading agentic coding tools, while Aider and OpenCode remain important terminal/open-source compatibility targets [1] [2]. The ranking is directional rather than an exact market-share claim because vendors expose different adoption metrics and products evolve quickly.

## Research basis and interoperability constraints

The architecture should use **MCP as the tool-connection layer** where a runtime supports it. MCP standardizes tools, resources, and prompts, but it does not standardize the complete agent lifecycle, approval semantics, session persistence, artifact contracts, or safety policy [3]. Claude Code documents MCP, hooks, plugins, skills, and subagents as extension mechanisms [4] [5]. Codex supports MCP and reads layered `AGENTS.md` instructions [6] [7]. Cursor exposes rules, MCP, skills, CLI, and hooks [8] [9]. Gemini CLI supports terminal workflows and MCP/extensions [10]. Cline supports MCP and an SDK/plugin model [11]. These overlaps make a shared adapter contract feasible, but the differences require runtime-specific adapters.

ACP should be evaluated as a second interoperability layer for editor-to-agent communication. ACP is intended to standardize communication between IDEs and coding agents [12]. It may reduce the cost of supporting editor-hosted agents, but it must not replace the AI Workflow canonical contract or be assumed to cover tool permissions and workflow governance.

## Target compatibility tiers

| Tier | Meaning | Initial targets | Release requirement |
|---|---|---|---|
| Tier 1: native adapter | AI Workflow can launch or invoke the runtime, pass a normalized request, receive structured lifecycle events, enforce approvals, persist checkpoints, and validate artifacts. | OpenCode, Claude Code, Codex CLI, Gemini CLI, Aider | Full conformance suite plus real smoke test per runtime. |
| Tier 2: host/editor adapter | AI Workflow integrates through a documented CLI, ACP bridge, extension, hook, or plugin, while the runtime remains the user-facing host. | Cursor, GitHub Copilot agent surfaces, Cline/Roo Code, Windsurf | Adapter contract, capability matrix, deterministic fixture tests, and one real non-sensitive pilot per adapter. |
| Tier 3: protocol-only | The runtime can consume MCP and/or canonical files but cannot provide sufficient lifecycle or approval callbacks for full orchestration. | Other MCP-compatible agents | Read-only artifact exchange and explicit limitations; never claim full production orchestration. |

A runtime may move between tiers only after evidence demonstrates that its lifecycle, permissions, state, and artifact behavior satisfy the corresponding tier. MCP connectivity alone is not sufficient for Tier 1 or Tier 2.

## Canonical architecture

AI Workflow should be split into a **runtime-neutral core** and thin runtime adapters. The core owns policy and evidence; adapters own translation into a runtime’s native invocation and event model.

```text
Canonical workflow core
  ├── pipeline compiler and semantic validator
  ├── artifact schemas and quality gates
  ├── HITL approval service
  ├── MCP capability policy and budget guard
  ├── state, checkpoint, rollback, and idempotency store
  ├── sanitized event/telemetry contract
  └── adapter registry and compatibility matrix
          │
          ├── OpenCode adapter
          ├── Claude Code adapter
          ├── Codex CLI adapter
          ├── Gemini CLI adapter
          ├── Aider adapter
          ├── Cursor/ACP or hook adapter
          ├── Copilot/extension or CLI adapter
          ├── Cline/Roo Code adapter
          └── Windsurf adapter
```

The core must never import vendor-specific SDKs. Each adapter implements a stable interface and communicates with the core only through normalized JSON messages and filesystem/IPC boundaries. This keeps safety controls centralized and prevents a runtime-specific bypass.

## Canonical adapter contract

Create a versioned `runtime-adapter.schema.json` and require every adapter to implement the following operations:

| Operation | Required behavior |
|---|---|
| `discover` | Report runtime name, version, invocation mode, supported capabilities, configuration locations, and whether lifecycle callbacks are available. |
| `preflight` | Verify executable or host integration, version range, required files, authentication presence without exposing values, and safe default permissions. |
| `start_session` | Start a run with correlation ID, pipeline ID, selected MCP profile, budget, project classification, and dry-run/write mode. |
| `send_step` | Submit one normalized phase/task request with only declared inputs and required capabilities. |
| `read_events` | Convert native output, hooks, ACP messages, or CLI results into the canonical sanitized event schema. |
| `request_approval` | Pause before HITL or side-effect operations and return a typed approval request. |
| `checkpoint` | Persist resumable metadata without raw prompts, raw MCP payloads, secrets, or unbounded artifacts. |
| `cancel` | Stop a run safely and return a sanitized cancellation event. |
| `resume` | Resume only from a verified checkpoint with matching compatibility and policy versions. |
| `collect_artifacts` | Return named, schema-validatable artifacts with content-classification metadata. |
| `close_session` | Emit final status, budget summary, circuit state, artifact summary, and error category. |

Every adapter must declare unsupported operations explicitly. Unsupported approval or checkpoint behavior must result in a lower compatibility tier or a hard stop for side-effecting workflows.

## Normalized contracts

The implementation should add versioned schemas for:

| Contract | Purpose |
|---|---|
| `runtime-adapter.schema.json` | Adapter metadata, operations, capabilities, version ranges, and limitations. |
| `runtime-request.schema.json` | Canonical request sent from the workflow core to an adapter. |
| `runtime-event.schema.json` | Canonical lifecycle events, derived from the existing sanitized event schema. |
| `approval-request.schema.json` | Human approval reason, requested capability, target, risk, expiry, and decision. |
| `checkpoint.schema.json` | Session, pipeline, phase, artifact names, budget, circuit, policy versions, and integrity metadata without raw content. |
| `artifact-envelope.schema.json` | Artifact type, schema version, checksum, quality result, classification, and provenance. |
| `runtime-capability-matrix.json` | Per-runtime support for MCP, hooks, ACP, skills, subagents, approvals, checkpoints, CLI, and write controls. |

The existing `mcp-permission-policy.json`, `execution-budget.json`, event schema, golden contracts, idempotency ledger, and rollback controls become core dependencies of every adapter rather than OpenCode-only features.

## Configuration portability

Create a canonical `.ai-workflow/` configuration directory that is independent of any one vendor. It should contain the pipeline manifest, policy files, schemas, adapter configuration, and generated runtime-specific projections. Keep the current OpenCode files as one projection rather than the source of truth.

Use a generated projection model:

| Canonical source | Example runtime projection |
|---|---|
| `AGENTS.md`-compatible operating rules | `AGENTS.md`, Claude `CLAUDE.md`, Cursor Rules, Gemini guidance, or runtime-specific instructions. |
| Canonical skills | OpenCode skills, Claude Code skills/plugins, Codex skills, Cursor skills/rules, Gemini extensions, or adapter prompts. |
| MCP policy | Native MCP JSON/config, generated with only the selected profile’s servers and permissions. |
| Approval policy | Native hooks/permissions where enforceable, otherwise a wrapper that blocks before the runtime call. |
| Event bridge | Native hooks, ACP messages, CLI stdout/stderr parser, or a supervised wrapper. |
| Artifact directory | A common `.ai-workflow/runs/<correlation-id>/` layout with runtime-specific symlinks or export steps. |

Generated projections must be deterministic, checksummed, and validated in CI. The adapter must not silently edit user-owned configuration; it should produce a diff or require explicit installation approval.

## Runtime-specific workstreams

### OpenCode

Keep OpenCode as the reference adapter because the current project already validates its executable, `.opencode/` layout, MCP configuration, skills, and preflight behavior. Refactor those checks behind the canonical adapter interface and use OpenCode as the first full Tier 1 conformance implementation.

### Claude Code

Implement a CLI/plugin adapter that maps canonical skills to Claude Code skills or plugins, maps policy enforcement to hooks and permissions, maps MCP through its native configuration, and converts hook events to canonical events. Validate that hooks can block before side effects and that sessions can be resumed without raw context leakage. Treat plugin marketplace installation as an optional projection, not a required dependency.

### OpenAI Codex CLI

Implement a CLI adapter that uses `AGENTS.md` projection, Codex MCP configuration, and its supported session/event interface. Verify whether approval, structured output, checkpoint, and cancellation semantics are exposed sufficiently for Tier 1; otherwise classify the adapter as Tier 2 and retain the core wrapper as the enforcement boundary.

### Gemini CLI and Code Assist

Implement a terminal-first adapter for Gemini CLI and a separate host adapter for IDE Code Assist where the lifecycle is exposed. Use MCP/extensions only through the canonical policy projection. Do not assume that an IDE chat surface provides enough lifecycle control for full orchestration; require a CLI, ACP, hook, or supervised bridge for Tier 1/2 status.

### Cursor, GitHub Copilot, Cline/Roo Code, and Windsurf

Prioritize these as host/editor adapters. First support canonical file projections, MCP profile generation, artifact import/export, and a supervised wrapper. Add hook or ACP bridges only where they can reliably expose pre-action approval, post-action events, cancellation, and checkpoint boundaries. If an editor cannot expose those controls, document read-only or artifact-exchange compatibility rather than claiming full orchestration.

### Aider and other terminal agents

Implement a lightweight terminal adapter using subprocess supervision, canonical instructions, explicit dry-run mode, stdout/event normalization, and filesystem artifact capture. Keep all external writes behind the core idempotency and approval wrapper. This adapter is likely to be simpler than host/editor integrations but still needs real smoke evidence.

## Security and safety requirements

The adapter layer must preserve the current safety invariants. Every runtime invocation is denied unless the selected adapter, runtime version, MCP profile, requested capabilities, budget, project classification, and approval state are valid. Side-effecting actions require a canary plan, explicit approval, deterministic idempotency key, and post-operation reconciliation. A runtime that cannot enforce these conditions must be limited to read-only or artifact-exchange mode.

The implementation must never copy credentials into generated projections, parse secrets into event records, or store raw prompts and MCP payloads in checkpoints or support bundles. Runtime-specific instruction files are untrusted configuration surfaces and must be generated from reviewed canonical sources.

## Testing and certification strategy

The project should add a runtime adapter certification harness with no paid model dependency. Each adapter is tested first against a fake runtime implementing the adapter protocol, then against a real runtime using a disposable non-sensitive project.

| Test layer | Required checks |
|---|---|
| Schema tests | Validate adapter metadata, requests, events, approvals, checkpoints, artifacts, and capability matrices. |
| Contract tests | Verify every adapter operation, typed failures, cancellation, retries, budget stops, circuit breaker, and resume behavior. |
| Security tests | Attempt undeclared MCP capabilities, write without approval, malformed event injection, secret leakage, path traversal, and configuration overwrite. |
| Golden tests | Compare normalized event/artifact envelopes, not vendor-specific prose or raw model output. |
| Fault tests | Simulate timeout, malformed output, lost process, duplicate publication, ambiguous remote result, corrupt checkpoint, and unavailable MCP. |
| Integration tests | Run each adapter’s version discovery, preflight, MCP startup, event bridge, approval pause, artifact collection, and cleanup. |
| Pilot tests | Execute a constrained smoke sequence and one controlled non-sensitive pilot per Tier 1/2 runtime. |

Certification results should be stored as sanitized evidence with runtime version, adapter version, compatibility tier, test commit, profile, budget policy version, pass/fail/blocked status, and independent reviewer.

## Delivery sequence

| Phase | Deliverable | Exit gate |
|---:|---|---|
| 1 | Canonical schemas, adapter interface, capability matrix, versioned config directory, and projection rules. | Schema and compatibility validators pass; OpenCode behavior remains unchanged. |
| 2 | Refactor OpenCode into the reference adapter and certify it through the new harness. | Existing 32-test baseline plus adapter certification passes. |
| 3 | Build Claude Code and Codex CLI adapters. | Fake-runtime contract tests pass; real preflight and non-sensitive smoke evidence exists for each. |
| 4 | Build Gemini CLI and Aider terminal adapters. | Same certification gates; explicit limitation records for unsupported lifecycle features. |
| 5 | Build Cursor, Copilot, Cline/Roo Code, and Windsurf host/editor adapters using hooks, ACP, plugins, or supervised wrappers. | Each runtime receives a tier classification based on actual lifecycle and approval evidence. |
| 6 | Add CI matrix, generated projections, compatibility reports, adapter version pinning, and release documentation. | CI detects projection drift, unsupported runtime versions, schema drift, and unsafe permission changes. |
| 7 | Run controlled pilots and publish a multi-runtime support statement. | No unresolved P0/P1 issue, independent review, recovery evidence, and explicit per-runtime limitations. |

## Recommended prioritization

Do not attempt all adapters in one release. The recommended implementation order is **OpenCode → Claude Code → Codex CLI → Gemini CLI → Aider → Cline/Roo Code → Cursor → Windsurf → GitHub Copilot host integration**. The first five provide the most controllable CLI-oriented paths for proving the adapter contract. Editor and enterprise-host integrations should follow after the core has real certification evidence.

The first production milestone should support OpenCode plus one external CLI adapter, preferably Claude Code or Codex CLI, with full Tier 1 evidence. The second milestone can expand terminal coverage. Editor/IDE compatibility should be announced as Tier 2 or Tier 3 until hooks or ACP provide enough control for approvals, checkpoints, and normalized events.

## Assumptions and open risks

Popularity is not a stable technical ranking; the compatibility matrix must be reviewed quarterly. Vendor APIs, hooks, MCP behavior, plugin packaging, and permission models may change without preserving backward compatibility. Some products are IDE surfaces rather than independently controllable runtimes. GitHub Copilot may require a specific extension or enterprise integration path, and Cursor/Windsurf lifecycle access may differ by plan or release. ACP can improve editor integration but does not replace the core policy and artifact contracts.

The main risk is creating adapters that appear compatible because they can receive prompts or connect to MCP while failing to enforce approvals, budgets, checkpoints, or idempotent writes. The certification harness and tier model are therefore mandatory, not optional documentation.

## Completion criteria

This plan is complete when the canonical adapter contracts are implemented, the OpenCode reference adapter remains fully certified, at least one additional runtime reaches Tier 1 with real non-sensitive evidence, every targeted runtime has a documented tier and capability matrix, generated projections are deterministic and reviewable, and the release documentation makes unsupported or degraded features explicit.

## References

[1]: https://www.faros.ai/blog/best-ai-coding-agents-2026 "Best AI Coding Agents for 2026: Real-World Developer Comparison"
[2]: https://zapier.com/blog/ai-coding-tools/ "The 9 best AI coding tools in 2026"
[3]: https://modelcontextprotocol.io/specification/2025-06-18 "Model Context Protocol Specification"
[4]: https://docs.anthropic.com/en/docs/claude-code/mcp "Connect Claude Code to tools via MCP"
[5]: https://docs.anthropic.com/en/docs/claude-code/features-overview "Extend Claude Code"
[6]: https://developers.openai.com/codex/mcp "Codex MCP documentation"
[7]: https://developers.openai.com/codex/agent-configuration/agents-md "Codex custom instructions with AGENTS.md"
[8]: https://cursor.com/docs "Cursor Documentation"
[9]: https://cursor.com/docs/hooks "Cursor Hooks"
[10]: https://geminicli.com/docs/ "Gemini CLI Documentation"
[11]: https://docs.cline.bot/mcp/mcp-overview "Cline MCP Overview"
[12]: https://agentclientprotocol.com/get-started/introduction "Agent Client Protocol: Introduction"

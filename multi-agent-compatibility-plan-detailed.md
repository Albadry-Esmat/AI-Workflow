# AI Workflow Multi-Agent Compatibility Plan — Detailed Phases and Tasks

**Author:** Manus AI  
**Plan status:** Approved by the user; repository-controlled implementation completed through the live-runtime gate
**Scope:** Runtime portability, adapter contracts, certification, and safe configuration projections  
**Current baseline:** OpenCode is the only reference runtime with repository-side production controls. The repository has a clean local release branch, deterministic conformance tests, MCP permission profiles, execution budgets, sanitized events, checkpoints, rollback, idempotency, canary planning, pilot evidence validation, artifact-quality gates, versioned runtime contracts, adapter projections, deterministic projection generation, fixture certification, and a sanitized per-runtime certification evidence contract. Real-runtime certification remains operator-owned and blocked in the sandbox.

## 1. Goal and definition of compatibility

The goal is to make AI Workflow usable with the leading AI coding-agent runtimes without weakening its existing safety, approval, artifact, state, budget, rollback, and evidence controls. The target is **portable workflow compatibility**, not identical feature parity across every vendor product.

“Compatible with all” will mean that each supported runtime has an explicit adapter or projection, a declared capability matrix, a tested normalized contract, and a documented support tier. A runtime must never bypass the central policy layer merely because it offers a different prompt file, plugin model, hook system, MCP implementation, or editor surface.

The first compatibility scope covers **OpenCode, Claude Code, OpenAI Codex CLI, Gemini CLI/Code Assist, Aider, Cursor, GitHub Copilot agent surfaces, Cline/Roo Code, and Windsurf**. The list is a practical coverage target based on current industry comparisons and technical relevance, not a permanent market-share ranking [1] [2]. The matrix must be reviewed quarterly because vendor products, plans, APIs, and extension models change quickly.

## 2. Non-goals and safety boundaries

This plan does not convert AI Workflow into a hosted SaaS product, centralize user credentials, or add uncontrolled vendor-specific prompts. It does not claim that MCP support alone provides lifecycle compatibility. It does not enable browser, messaging, deployment, payment, account, or publication side effects for a new runtime without the existing capability guard, budget guard, approval gate, idempotency key, canary plan, reconciliation process, and recovery evidence.

The implementation must preserve these invariants:

1. The runtime-neutral core owns workflow semantics, policy, approvals, budgets, state, artifacts, rollback, idempotency, quality decisions, and evidence.
2. Adapters translate between the core and a runtime. They cannot redefine policy or silently grant capabilities.
3. Generated runtime files are projections from reviewed canonical sources. They must be deterministic, checksummed, diffable, and never silently overwrite user-owned configuration.
4. Unsupported lifecycle features produce an explicit degraded tier or a hard stop. They must not be represented as silently successful operations.
5. Fixture tests prove contract behavior only. Real-runtime support requires real executable or host verification, live smoke evidence, recovery evidence, and controlled-pilot review.
6. No credential, raw prompt, raw MCP payload, authorization header, personal data, or unbounded model output may enter checkpoints, event logs, support bundles, generated projections, or certification records.

## 3. Target support tiers

| Tier | Definition | Initial runtimes | Minimum promotion evidence |
|---|---|---|---|
| **Tier 1 — Native adapter** | AI Workflow can discover and invoke the runtime, pass normalized requests, receive structured lifecycle events, enforce approvals and budgets, persist checkpoints, cancel or resume safely, and validate artifacts. | OpenCode, Claude Code, Codex CLI, Gemini CLI, Aider | Schema and contract tests, real version preflight, MCP verification, constrained smoke test, recovery evidence, and controlled non-sensitive pilot. |
| **Tier 2 — Host/editor adapter** | AI Workflow integrates through a documented CLI, extension, hook, plugin, ACP bridge, or supervised wrapper while the vendor host remains user-facing. | Cursor, GitHub Copilot agent surfaces, Cline/Roo Code, Windsurf | Host-specific contract tests, deterministic projection tests, demonstrated pre-action approval or explicit wrapper boundary, artifact exchange, and one real non-sensitive pilot. |
| **Tier 3 — Protocol or projection compatibility** | The runtime can consume canonical files or MCP configuration but does not expose enough lifecycle or approval control for full orchestration. | Other MCP-compatible or instruction-file-based agents | Read-only or artifact-exchange test, explicit limitations, and no claim of full production orchestration. |

A runtime may move between tiers only after evidence demonstrates the required behavior. MCP connectivity, a successful prompt, or a file edit is not sufficient for Tier 1 or Tier 2.

## 4. Canonical architecture

The repository must be organized around a runtime-neutral core and thin adapters:

```text
Canonical AI Workflow core
  ├── pipeline compiler and semantic validator
  ├── artifact schemas, envelopes, and quality gates
  ├── HITL approval and decision records
  ├── MCP capability profiles and execution-budget guards
  ├── state, checkpoint, rollback, and idempotency stores
  ├── sanitized lifecycle event and evidence contracts
  ├── adapter registry and runtime capability matrix
  └── projection generator and certification harness
          │
          ├── OpenCode reference adapter
          ├── Claude Code terminal adapter
          ├── Codex CLI terminal adapter
          ├── Gemini CLI terminal adapter
          ├── Aider terminal adapter
          ├── Cursor host/editor adapter
          ├── GitHub Copilot host adapter
          ├── Cline/Roo Code host/editor adapter
          └── Windsurf host/editor adapter
```

The core must not import vendor SDKs. Adapters communicate with the core using versioned JSON requests, events, approvals, checkpoints, and artifact envelopes through filesystem, subprocess, IPC, hook, or ACP boundaries. Vendor-specific implementation belongs below the adapter boundary and must not be required to load the core validators.

MCP should be used as the common tool-connection layer where available. MCP standardizes tools, resources, and prompts, but it does not standardize the complete agent lifecycle, approval semantics, session persistence, artifact contracts, or safety policy [3]. ACP should be evaluated for editor-to-agent communication but must remain an optional transport; it does not replace the canonical policy and artifact contracts [12].

## Phase 0 — Baseline inventory and decisions

### Objective

Create a precise inventory of OpenCode coupling and freeze the compatibility decisions before adding adapters.

### Tasks

| ID | Task | Detailed work | Deliverable |
|---|---|---|---|
| 0.1 | Inventory coupling | Search the repository for OpenCode executable calls, `opencode.json`, `.opencode/` paths, OpenCode-specific skill loading, MCP startup assumptions, session commands, output parsing, and version checks. Classify each reference as core logic, adapter logic, projection, documentation, fixture, or release gate. | Coupling inventory with file path, classification, and planned owner. |
| 0.2 | Define canonical ownership | Decide which files are canonical and which are generated projections. Move policy, schemas, registry, matrix, and projection metadata under `.ai-workflow/` without changing current OpenCode behavior. | Canonical ownership map. |
| 0.3 | Define compatibility vocabulary | Establish controlled values for runtime family, tier, lifecycle operation, capability, evidence status, degradation mode, and failure category. | Versioned vocabulary in the adapter registry schema. |
| 0.4 | Establish support policy | Define what “supported,” “experimental,” “fixture-certified,” “operator-verified,” “pilot-certified,” “blocked,” and “deprecated” mean. | Support policy in the compatibility guide. |
| 0.5 | Freeze side-effect scope | Confirm that the first multi-runtime release enables no new side-effect MCP server and uses `pilot-read-only` by default. | Release-governance note and negative test expectations. |

### Exit criteria

The repository contains a reviewed coupling inventory, a canonical ownership decision, a controlled vocabulary, and an explicit statement that no runtime will be advertised as production-certified based on fixture tests alone. Existing OpenCode tests remain green.

## Phase 1 — Canonical schemas and registry

### Objective

Create machine-readable contracts that all adapters must implement or explicitly degrade.

### Tasks

| ID | Task | Detailed work | Acceptance criteria |
|---|---|---|---|
| 1.1 | Adapter descriptor schema | Define adapter ID, display name, runtime family, tier, status, executable or host entrypoint, version range, supported operations, capabilities, limitations, and evidence status. | JSON Schema validation rejects unknown tiers, unsupported operations, malformed IDs, and certified adapters without required evidence. |
| 1.2 | Runtime request schema | Define correlation ID, pipeline, phase, task, mode, project classification, MCP profile, required capabilities, budget, input artifact names, approval ID, and dry-run state. | Requests are bounded, versioned, and reject write modes with inconsistent dry-run values. |
| 1.3 | Runtime event schema | Define sanitized lifecycle events with timestamp, event ID, adapter ID, session, pipeline, phase, skill, status, duration, retries, error code, message, and raw-content exclusion. | Event records validate against the schema and never require raw payloads. |
| 1.4 | Approval schema | Define typed approval requests with risk, target, requested capabilities, expiry, decision, reviewer identity reference, and decision timestamp. | Side-effecting requests cannot proceed with pending, missing, expired, or rejected approval. |
| 1.5 | Checkpoint schema | Define resumable metadata including policy versions, compatibility versions, completed tasks, artifact names, budget snapshot, circuit state, and integrity marker. | Checkpoints explicitly assert `raw_content_included: false` and reject incompatible versions during resume. |
| 1.6 | Artifact envelope schema | Define artifact name/type/schema version/checksum, classification, quality decision, provenance, runtime, adapter, correlation ID, and raw-content exclusion. | Artifacts can be exchanged between runtimes without embedding unbounded model output. |
| 1.7 | Capability matrix | Record per-runtime support for MCP, hooks, ACP, skills, subagents, approvals, checkpoints, CLI, write controls, and artifact exchange. | Unknown or contradictory capability values fail validation. |
| 1.8 | Adapter registry | Register every target runtime and link it to an implementation or projection path. | Registry IDs match matrix IDs, modules, descriptors, and compatibility metadata. |
| 1.9 | Compatibility manifest | Add registry, matrix, schema, projection, and adapter contract versions to `compatibility.json`. | Version drift is release-blocking. |

### Exit criteria

All canonical schemas parse and validate; registry and capability matrix cross-check successfully; compatibility versions agree; OpenCode remains represented as the reference adapter; no new runtime is called certified.

## Phase 2 — Runtime-neutral configuration and projections

### Objective

Generate runtime-specific instructions and MCP configuration from canonical sources without silently modifying user files.

### Tasks

| ID | Task | Detailed work | Deliverable |
|---|---|---|---|
| 2.1 | Canonical configuration directory | Create `.ai-workflow/config.json` with locations for policies, schemas, pipelines, skills, agents, adapters, and projections. | Versioned canonical config manifest. |
| 2.2 | Skill projection rules | Map canonical operating rules and skills to OpenCode skills, `AGENTS.md`, Claude guidance, Cursor rules, Gemini guidance, and host-specific instruction files. | Projection mapping table with unsupported-feature behavior. |
| 2.3 | MCP projection | Generate only the selected profile’s enabled servers and capability metadata. Never copy credentials. | Sanitized MCP projection with profile and checksum. |
| 2.4 | Approval projection | Use native hooks or permissions when enforceable; otherwise emit a wrapper-required status and block writes outside the wrapper. | Per-runtime approval enforcement record. |
| 2.5 | Event projection | Define whether events come from native hooks, ACP, CLI stdout/stderr, process supervision, or operator evidence. | Event-source declaration in each adapter descriptor. |
| 2.6 | Artifact projection | Standardize `.ai-workflow/runs/<correlation-id>/` and artifact import/export behavior. | Artifact directory and projection rules. |
| 2.7 | Deterministic generator | Generate files only to an explicit output directory, include generated headers, sort entries, compute checksums, and delete stale generated output only inside that directory. | `generate-projections` command and deterministic manifest. |
| 2.8 | Installation safety | Add an explicit review/install command or documented manual diff process. Never overwrite user-owned config implicitly. | Installation procedure and negative overwrite test. |

### Exit criteria

Two identical projection runs produce byte-identical manifests; projections contain no credentials or raw payloads; default profile is read-only; generated output is isolated; user-owned files remain unchanged unless explicit installation is performed.

## Phase 3 — Adapter contract harness and OpenCode reference adapter

### Objective

Turn the existing OpenCode path into the reference implementation of the canonical adapter contract.

### Tasks

| ID | Task | Detailed work | Acceptance criteria |
|---|---|---|---|
| 3.1 | Adapter interface | Implement shared helpers for descriptor validation, request creation, event normalization, policy checks, failure classification, correlation IDs, and bounded text. | Core helpers have unit tests and no vendor imports. |
| 3.2 | OpenCode discovery | Report executable, version, config path, runtime family, capabilities, and evidence state without exposing credentials. | Missing executable produces a typed blocked result, not a fabricated pass. |
| 3.3 | OpenCode preflight | Reuse existing strict preflight, MCP profile validation, budget validation, security scan, and environment checks behind the adapter interface. | Existing OpenCode preflight semantics remain unchanged. |
| 3.4 | Session lifecycle | Implement start, step, event read, approval request, checkpoint, cancel, resume, artifact collection, and close operations. | Every operation returns normalized or typed unsupported/error output. |
| 3.5 | Safety integration | Ensure adapter calls pass through MCP capability guards, budget tracker, circuit breaker, checkpoint store, idempotency ledger, and artifact-quality policy. | Unauthorized capabilities, missing approval, exceeded budgets, and open circuits stop execution before side effects. |
| 3.6 | Contract certification harness | Run descriptor, read-only policy, write-denial, event redaction, dry-run, checkpoint, cancellation, and artifact-envelope tests without paid model calls. | Harness produces sanitized pass/fail evidence. |
| 3.7 | OpenCode evidence record | Store repository-fixture certification separately from operator-owned real-runtime evidence. | Evidence status cannot be promoted automatically. |

### Exit criteria

OpenCode passes the full adapter contract harness; existing conformance and production controls remain green; strict preflight still blocks honestly when the real OpenCode executable or environment is absent; no fake live evidence is recorded.

## Phase 4 — Terminal-agent adapters

### Objective

Implement supervised terminal adapters for Claude Code, OpenAI Codex CLI, Gemini CLI, and Aider, while keeping real-runtime claims explicitly pending.

### Common tasks for every terminal adapter

| ID | Task | Detailed work |
|---|---|---|
| 4.1 | Descriptor | Register executable name, version range, native instruction files, MCP model, event source, approval model, checkpoint model, and limitations. |
| 4.2 | Discovery and preflight | Check the executable with a version-only command; verify required configuration presence without printing secrets; classify absent or incompatible installations as blocked. |
| 4.3 | Instruction projection | Generate runtime-native operating rules from canonical sources; do not silently install plugins or modify user files. |
| 4.4 | MCP bridge | Generate or validate native MCP configuration using the selected profile; ensure disabled side-effect servers remain disabled. |
| 4.5 | Subprocess supervision | Enforce working directory, timeout, output bounds, cancellation, exit status, and typed failure categories. |
| 4.6 | Event normalization | Parse only bounded, sanitized output or supported hooks into the canonical event schema. Unknown output becomes a diagnostic event, not a successful lifecycle event. |
| 4.7 | Approval and write guard | Block writes unless the core sends an approved request with the correct capability, budget, canary plan, and idempotency key. |
| 4.8 | Checkpoint and resume | Verify policy, adapter, runtime, and schema versions before resuming. If native resume is unavailable, use wrapper-required or artifact-only mode. |
| 4.9 | Artifact exchange | Collect named artifacts by path and checksum while rejecting prompt, payload, secret, session, and credential-like files. |
| 4.10 | Fault tests | Simulate missing executable, timeout, malformed output, duplicate write, approval rejection, circuit open, corrupt checkpoint, and ambiguous outcome. |
| 4.11 | Real certification | Run version preflight, MCP startup, read-only smoke, approval stop, checkpoint/resume, artifact validation, recovery, and controlled non-sensitive pilot. |

### Runtime-specific tasks

#### Claude Code

Map canonical rules to Claude Code guidance, skills, plugins, MCP configuration, hooks, and subagents where each feature is available. Verify that pre-action hooks can block side effects and that hook events can be normalized. Treat plugin marketplace installation as optional. If a feature is only available through an operator-controlled host or plan, mark it as degraded rather than assuming availability [4] [5].

#### OpenAI Codex CLI

Use `AGENTS.md` projection and the documented MCP configuration. Verify the actual CLI’s structured output, approval, cancellation, and session semantics for the installed version. If approval or checkpoint boundaries are not exposed, classify the adapter as Tier 2 or wrapper-required rather than granting Tier 1 status [6] [7].

#### Gemini CLI and Code Assist

Implement the terminal path separately from IDE Code Assist. Use MCP and extensions only through canonical policy projection. Do not treat an IDE chat surface as a full orchestration runtime unless it exposes reliable lifecycle, approval, cancellation, event, and artifact boundaries [10].

#### Aider

Use subprocess supervision, canonical instructions, explicit dry-run, stdout normalization, Git-aware artifact capture, and the central write wrapper. Expect wrapper-required approval, checkpoint, and write semantics unless the installed version exposes reliable native controls.

### Exit criteria

All four adapters load and pass credential-free contract tests; each has a documented capability matrix and limitation record; real-runtime certification is completed one adapter at a time; no adapter is promoted solely from fixture results.

## Phase 5 — Host/editor adapters

### Objective

Provide controlled compatibility for Cursor, GitHub Copilot agent surfaces, Cline/Roo Code, and Windsurf without pretending that editor chat surfaces expose the same lifecycle as terminal agents.

### Tasks

| ID | Task | Detailed work | Acceptance criteria |
|---|---|---|---|
| 5.1 | Host boundary | Define whether integration uses CLI, extension, hooks, plugin, ACP, filesystem projection, or operator handoff. | Descriptor names the actual control boundary and limitations. |
| 5.2 | Rule projection | Generate host-native rules from canonical instructions and include a generated-file warning. | Projection is deterministic and reviewable. |
| 5.3 | MCP configuration | Generate only read-only or explicitly selected profiles and document where the host stores configuration. | No side-effect server is enabled by projection. |
| 5.4 | Pre-action gate | Determine whether the host can block before tool or file actions. If not, force artifact-only or wrapper-required mode. | Writes cannot bypass the central guard. |
| 5.5 | Event bridge | Use hooks, ACP, extension events, or supervised logs; otherwise record only operator-confirmed evidence. | No unsupported lifecycle operation is reported as successful. |
| 5.6 | Checkpoint boundary | Define safe pause/resume semantics or require a new session from the last verified artifact. | Resume never reuses unverified raw context. |
| 5.7 | Artifact import/export | Provide explicit artifact exchange and checksum validation independent of host chat history. | Host integrations can be used without storing raw session content. |
| 5.8 | Host-specific verification | Test each host with a disposable non-sensitive project, one read-only task, one rejected write, one approved canary, artifact collection, cancellation, and recovery. | Tier is assigned from observed evidence. |

### Runtime-specific considerations

Cursor should be tested for rules, MCP, skills, hooks, CLI, and lifecycle access [8] [9]. GitHub Copilot must be treated as surface- and enterprise-policy-dependent; the adapter must not infer a uniform capability from the product name. Cline and Roo Code should be tested through their MCP, extension, plugin, or SDK boundaries [11]. Windsurf should be treated as a host surface until its version-specific hooks, rules, MCP, and lifecycle controls are verified.

### Exit criteria

Every host/editor target has a projection, descriptor, capability matrix entry, limitation record, and fixture certification. At least one host integration has real non-sensitive pilot evidence before any Tier 2 production statement is made.

## Phase 6 — CI, certification evidence, and release automation

### Objective

Make compatibility drift visible and release-blocking without requiring vendor credentials in CI.

### Tasks

| ID | Task | Detailed work | Deliverable |
|---|---|---|---|
| 6.1 | Adapter validation command | Validate schemas, registry, matrix, descriptors, implementation paths, status alignment, and compatibility versions. | `aiw validate-adapters`. |
| 6.2 | Contract certification command | Run all fixture adapters through discovery, policy, dry-run, event, and failure tests. | `aiw certify-adapters` or equivalent report command. |
| 6.3 | Projection validation | Generate projections twice, compare manifests, validate checksums, scan for credentials, and confirm no source-tree mutation. | CI projection-drift gate. |
| 6.4 | CI matrix | Add a job for adapter registry validation, all fixture certifications, projection determinism, schema validation, and existing conformance tests. | Immutable-pinned workflow job. |
| 6.5 | Sanitized evidence contract | Define evidence metadata: runtime version, adapter version, tier, test commit, profile, budget version, status, failure category, reviewer, and timestamps. | `pilot-evidence` extension for runtime certification. |
| 6.6 | Version pinning | Record supported runtime ranges and adapter versions. Fail preflight on unsupported versions unless an explicit operator override is documented. | Compatibility manifest and release check. |
| 6.7 | Reporting | Add support-tier summary to README, runbook, release checklist, status report, and changelog. | Consistent public/internal support statement. |
| 6.8 | Security regression | Scan projections, generated files, logs, evidence, and adapter code for credentials, raw payload markers, unsafe path writes, and unpinned actions. | Security checks and negative fixtures. |

### Exit criteria

CI detects schema drift, registry/matrix mismatch, projection drift, missing adapter files, unsafe capability changes, and unsupported certification claims. The entire matrix runs without credentials or paid model calls.

## Phase 7 — Staged real-runtime certification

### Objective

Turn experimental adapter projections into evidence-backed support, one runtime at a time.

### Certification sequence

1. **Operator preparation:** Install the exact runtime version, configure credentials locally, verify file permissions, and classify the project as disposable or non-sensitive. Credentials are never sent to the repository or recorded in evidence.
2. **Version preflight:** Run adapter discovery and compare the real version with the compatibility manifest. Record only the version and pass/blocked result.
3. **MCP startup:** Start only the selected read-only MCP profile. Verify enabled servers and confirm disabled side-effect servers remain unavailable.
4. **Read-only smoke:** Execute a bounded requirements or analysis task with a strict budget and no writes.
5. **Approval stop:** Request a write or other side effect and verify the runtime stops before action without approval.
6. **Approved canary:** Use a disposable target, explicit approval, deterministic idempotency key, and canary manifest. Verify the resulting artifact or publication exactly once.
7. **Failure and recovery:** Exercise timeout, rejection, circuit break, checkpoint/resume, rollback, and ambiguous external outcome handling.
8. **Artifact review:** Validate checksums, schemas, classification, quality decision, and absence of raw content.
9. **Evidence and independent review:** Write a sanitized evidence record, have an independent reviewer inspect it, and record limitations.
10. **Promotion decision:** Promote only the runtime’s verified capabilities, not the entire product surface. Unsupported operations remain blocked or degraded.

### Per-runtime evidence requirements

| Evidence item | Tier 1 | Tier 2 | Tier 3 |
|---|---:|---:|---:|
| Descriptor and schema validation | Required | Required | Required |
| Credential-free fixture certification | Required | Required | Required |
| Real version preflight | Required | Required | Optional |
| MCP profile verification | Required where used | Required where used | Optional/read-only |
| Pre-action approval block | Required | Required or wrapper-enforced | Not applicable; writes prohibited |
| Budget stop and circuit breaker | Required | Required or wrapper-enforced | Core-side only |
| Checkpoint/resume | Required | Native or wrapper/artifact resume | Not supported |
| Artifact schema and checksum | Required | Required | Required for exchange |
| Recovery rehearsal | Required | Required | Optional/read-only |
| Non-sensitive pilot | Required | Required | Not applicable |
| Independent review | Required | Required | Required for release documentation |

### Exit criteria
At least OpenCode and one external CLI runtime have full Tier 1 evidence before the first cross-runtime production statement. Host/editor runtimes are separately classified and never inherit certification from a terminal adapter.

### Repository-safe implementation status
The repository now provides `.ai-workflow/schemas/runtime-certification.schema.json`, a sanitized `aiw validate-runtime-certification` validator, a fixture record, compatibility-version registration, strict-preflight coverage, and self-test coverage. These controls validate evidence shape and promotion rules only; they do not create or imply live runtime evidence. The sandbox remains blocked for the real-runtime sequence because the target executables, host integrations, and `.env` are unavailable.

## Phase 8 — Release and post-launch operations


### Objective

Operate compatibility as a maintained product surface instead of a one-time integration.

### Tasks

| ID | Task | Detailed work | Frequency or trigger |
|---|---|---|---|
| 8.1 | Quarterly matrix review | Recheck vendor capabilities, version ranges, MCP behavior, hooks, ACP, extension models, and plan restrictions. | Quarterly and on major vendor release. |
| 8.2 | Runtime version watch | Detect installed versions outside declared ranges and block or require review. | Every preflight. |
| 8.3 | Contract regression | Run schema, fixture, security, projection, and fault suites on every change. | Every pull request and release. |
| 8.4 | Pilot evidence retention | Keep sanitized evidence with retention and reviewer ownership; prune raw operational logs according to policy. | Per evidence policy. |
| 8.5 | Incident response | Use event reports, support bundles, checkpoints, rollback, idempotency reconciliation, and circuit state. | On failed or ambiguous run. |
| 8.6 | Adapter deprecation | Mark runtimes blocked or deprecated when vendor changes invalidate safety assumptions. | On incompatibility or security finding. |
| 8.7 | Release communication | Publish support tiers, certified versions, degraded features, and known limitations. | Every compatibility release. |
| 8.8 | Security review | Reassess token scopes, MCP side effects, generated projections, hooks, plugins, and host trust boundaries. | At least each release and after any security event. |

### Exit criteria

The support statement identifies certified runtime versions and capability-specific limitations; compatibility changes are covered by CI and release governance; operators have a repeatable incident and rollback procedure.

## 5. Testing strategy

### Schema and static tests

Validate every schema, registry entry, capability matrix entry, compatibility version, generated manifest, projection checksum, and evidence record. Negative tests must cover unknown operations, unsupported statuses, capability mismatch, malformed events, raw-content flags, unsafe projection paths, and credential-like values.

### Contract tests

Every adapter must be tested for discovery, preflight behavior, session creation, request validation, read-only execution, dry-run non-execution, event normalization, approval request, checkpoint creation, cancellation, resume gating, artifact collection, and close-session summary. A fixture adapter or fake executable may be used, but the evidence must be labeled fixture-only.

### Safety and fault tests

Simulate unauthorized MCP capability, write without approval, budget exhaustion, timeout, malformed output, lost process, circuit-open state, corrupt checkpoint, duplicate publication, ambiguous external response, stale projection, unsafe path, and unsupported runtime version. The expected behavior is a typed stop, not a best-effort continuation.

### Golden tests

Compare normalized event envelopes, artifact envelopes, checksums, decision records, and evidence summaries. Do not compare full model prose or vendor-specific raw output. Golden fixtures should be stable across model and runtime versions unless the canonical schema changes.

### Real-runtime tests

For each runtime, use a disposable or non-sensitive project and a bounded profile. Capture only sanitized evidence. A live test is required for certification; a successful fixture command or temporary fake binary is not sufficient.

## 6. Delivery order and dependency graph

The recommended order is:

1. Canonical boundary and schemas.
2. Projection generator and registry validation.
3. OpenCode reference adapter.
4. Claude Code and Codex CLI terminal adapters.
5. Gemini CLI and Aider terminal adapters.
6. One host/editor adapter with the strongest available lifecycle controls.
7. Remaining host/editor projections.
8. CI certification matrix and release reporting.
9. Real-runtime pilots and support-tier promotion.

The first meaningful milestone is **OpenCode plus one external CLI adapter with full evidence**. The project should not announce “all agents supported” before that milestone. “All” should mean all named adapters have an explicit tier and limitation record; only individually certified runtimes may be described as production-supported.

## 7. Definition of done

The plan is complete when all of the following are true:

1. The canonical runtime-neutral configuration, schemas, registry, and capability matrix are versioned and validated.
2. OpenCode remains a fully tested reference adapter with unchanged safety semantics.
3. Every target runtime has either an adapter or a projection, an explicit tier, a limitation record, and fixture certification.
4. At least one external runtime reaches Tier 1 through real non-sensitive smoke, recovery, and controlled-pilot evidence.
5. At least one host/editor runtime reaches Tier 2 through real host verification and pilot evidence, or is explicitly retained as Tier 3.
6. Generated projections are deterministic, checksummed, reviewable, credential-free, and never silently installed.
7. CI blocks registry drift, schema drift, unsafe capability changes, projection drift, unsupported version claims, malformed evidence, and invalid runtime-certification promotion states.
8. Release documentation identifies certified versions, degraded operations, unsupported operations, and operator-owned prerequisites.
9. Post-launch review, deprecation, incident, retention, and rollback procedures are documented and tested.
10. No production support claim is made for a runtime whose real lifecycle and safety evidence is absent.

## 8. Assumptions and open risks

Vendor products evolve independently and may expose different behavior by version, plan, region, enterprise policy, extension, or host surface. Product names do not identify a uniform runtime. Some systems can receive instructions or connect to MCP but cannot expose reliable approval, cancellation, checkpoint, event, or artifact boundaries. ACP may improve editor integration but does not replace policy enforcement. MCP standardization reduces tool-connection work but does not remove runtime-specific lifecycle work [3] [12].

The primary risk is false compatibility: an adapter appears to work because it accepts a prompt or edits a file, while bypassing budget, approval, checkpoint, or idempotency controls. The adapter contract, capability matrix, tier model, and real evidence gates are therefore mandatory safety controls.

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

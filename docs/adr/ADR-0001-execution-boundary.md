# ADR-0001: Execution Boundary and Enforcement Model

**Status:** Accepted for Batch 0 planning; implementation details remain subject to validation in later batches  
**Date:** 2026-08-16  
**Owners:** Architecture and Runtime

## Context

AI-Workflow contains declarative skills, pipeline definitions, registry metadata, agent configuration, schemas, and governance instructions. The repository documents orchestration behaviors such as retries, feedback loops, HITL gates, context compression, and telemetry. The repository does not itself expose a complete standalone runtime that can enforce every documented behavior or every MCP/tool permission.

OpenCode agent permissions (`edit` and `bash`) are configured in `opencode.json`, while MCP servers are configured as a separate capability layer. Therefore, denying shell or edit access to a subagent must not be interpreted as denying access to every enabled external tool.

## Decision

AI-Workflow will use a **layered enforcement model**:

1. **Declarative layer:** Skills, pipelines, schemas, registry metadata, and governance documents define intended behavior and contracts.
2. **Runtime layer:** The active OpenCode/runtime integration executes skills and applies permissions that it can enforce.
3. **Policy boundary:** Any authorization that cannot be enforced by the active runtime or MCP layer must not be claimed as enforced by prompt text alone.
4. **Evidence layer:** Later batches will add run manifests, step records, artifact references, policy decisions, and replay/evaluation evidence.
5. **Fail-closed rule:** High-impact actions—delete, push, deploy, publish, credential changes, and permission changes—remain human-approved or disabled until an enforceable policy boundary exists.

The first vertical slice will use the `quick-review` pipeline because it is a lower-risk, parallel review workflow with `clean-code-review` and `security-review`, a conditional critical-vulnerability gate, and bounded retry settings.

## Consequences

This decision prevents the project from overstating what configuration and prompts can guarantee. It also means that a future capability broker or wrapper runtime may be required for complete MCP/tool authorization. That work is explicitly deferred until the execution boundary is measured and the limitation is demonstrated in a fixture.

## Validation required in later batches

- Batch 3 must validate the execution evidence schemas.
- Batch 4 must prove which `quick-review` steps can emit evidence.
- Batch 6 must prove that denied actions fail closed at the actual tool boundary or remain disabled.
- Any capability that cannot be enforced must be recorded as a limitation in release evidence.

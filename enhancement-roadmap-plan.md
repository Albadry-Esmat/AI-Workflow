# AI Workflow Enhancement Roadmap

## Goal

Identify the next enhancements that would materially improve AI Workflow’s production safety, reliability, operator experience, and output quality without expanding the project into a hosted SaaS platform or adding autonomous behavior before the first real pilot.

## Current decision

The repository-side production hardening is substantially complete, but the project is still **not general-production-ready**. The immediate priority is to close the real-environment release gates: supported OpenCode installation, least-privilege credentials, MCP startup verification, constrained live smoke testing, controlled pilot evidence, independent review, and release ownership. New generative skills should remain frozen until those gates produce real evidence.

The enhancement strategy therefore follows this rule:

> **Prove the runtime first; then add controls that address observed failure modes; only afterward add new workflow capabilities.**

## Priority roadmap

| Priority | Enhancement | Why it matters | Recommended timing | Acceptance criterion |
|---:|---|---|---|---|
| P0 | Complete the real constrained pilot | Repository tests cannot prove OpenCode, model, network, credential, and MCP behavior together. | Immediately | A disposable non-sensitive smoke test passes routing, artifacts, retries, HITL rejection/resume, backup, recovery, and sanitization. |
| P0 | Enforce MCP profiles at runtime, not only statically | Current policy validation prevents configuration drift, but the live runtime must reject a skill requesting capability beyond the selected profile before invocation. | After first smoke-test setup, before controlled production | Denied capability produces a typed audit event; write-capable profiles require explicit approval and a distinct credential. |
| P0 | Enforce execution budgets during runs | The current budget file validates policy but does not itself measure live tokens, duration, retries, concurrency, or API calls. | During pilot instrumentation | Thresholds pause for approval; hard limits stop safely; no runaway retries or parallelism occur. |
| P1 | Formalize the event schema and support-bundle integration | The event stream is currently sanitized and useful, but a versioned JSON Schema and automatic bundle summary would improve interoperability and incident diagnosis. | Before controlled-production approval | Events validate against a schema; support bundles include only event counts, error categories, correlation IDs, and retention metadata. |
| P1 | Strengthen publication idempotency and reconciliation | Local website publication now claims deterministic operation keys, but timeout-after-success and remote-state reconciliation should be tested explicitly. | Before enabling any external publication | A retry after remote acceptance detects the existing commit/PR and does not create a duplicate; ambiguous outcomes stop safely. |
| P1 | Add runtime circuit breakers and degraded-mode policy | MCP outages, repeated schema failures, or repeated model errors should stop or degrade predictably instead of producing misleading output. | After observing pilot failure categories | Each integration has a timeout, retry ceiling, failure category, safe fallback, and operator-visible stop reason. |
| P1 | Add resumable checkpoints and operator handoff | State recovery exists, but long pipelines would benefit from explicit checkpoint boundaries and a resumable handoff record. | After the first successful end-to-end pipeline | An interrupted run resumes from the last verified checkpoint without repeating completed external writes or losing gate decisions. |
| P1 | Expand clean-clone and runtime matrix testing | The project supports Node 20–22, but release confidence should include representative runtime/tool versions and the actual OpenCode version used by operators. | Before tagging a general release | Clean-clone setup and core checks pass on each supported runtime family and the documented OpenCode version. |
| P2 | Add canary and dry-run modes for write-capable operations | Operators should see the intended diff and external-write plan before enabling repository or publication writes. | Before enabling repository-write or deployment profiles | Dry-run produces a sanitized planned-action manifest; canary mode limits the operation to one approved target. |
| P2 | Add artifact quality scoring and review queues | Structural validity does not guarantee useful requirements, ADRs, plans, or tests. | After pilot quality review identifies recurring weaknesses | Reviewers can score artifacts against explicit criteria, and low-confidence outputs route to human review rather than silently passing. |
| P2 | Add metrics and trend reports | Per-run evidence is useful, but aggregate trends would reveal retry amplification, duration drift, failure hotspots, and MCP instability. | After several controlled runs | A sanitized report shows trends without prompts, payloads, credentials, or personal data. |
| P2 | Add configuration drift and release-diff reports | Operators need a concise explanation when skills, prompts, schemas, MCP policy, or compatibility versions change. | Before frequent releases | Release checks produce a reviewable compatibility diff and identify affected pipelines. |
| P3 | Add optional operator dashboard | A local dashboard could simplify session status, events, budgets, backups, and approvals, but it is not required for safe first production use. | Only after CLI workflows prove stable | Dashboard is local-only, read-only by default, and cannot bypass CLI permission or approval gates. |

## Recommended implementation order

### Phase A — Finish evidence before expansion

Complete the operator-owned prerequisites and the constrained smoke sequence described in `docs/operations/live-smoke-test.md`. Do not add new autonomous skills, deployment integrations, unrestricted browser actions, payment flows, or hosted-service architecture during this phase.

### Phase B — Convert static controls into runtime enforcement

Implement runtime MCP capability checks, live budget accounting, event-schema validation, timeout and circuit-breaker behavior, and explicit checkpoint/resume semantics. These controls have higher value than new domain skills because they reduce the consequences of real-world failures and make pilot evidence actionable.

### Phase C — Protect external writes and improve release confidence

Add timeout-after-success fault injection for website publication and any future issue or pull-request writes. Add dry-run/canary manifests, remote-state reconciliation, runtime compatibility checks, and configuration-drift reports. Keep all write-capable profiles disabled by default until these controls pass.

### Phase D — Improve output quality based on pilot evidence

Review artifacts from one or two representative non-sensitive repositories. Add quality scoring, review queues, or targeted skill improvements only for demonstrated gaps. Each new skill must include a versioned contract, negative tests, documentation, security review, compatibility impact, and rollback note.

### Phase E — Consider convenience features

Only after controlled-production evidence should the project consider a local operator dashboard, richer trend analytics, or additional domain skills. These should remain local-first and must not weaken the CLI’s approval, permission, backup, or publication controls.

## Features explicitly not recommended now

The following should remain out of scope until the pilot and controlled-production gates pass: autonomous self-modifying workflows, unrestricted browser automation, default deployment access, direct publication without review, broad shared credentials, hosted multi-tenant execution, billing, remote job queues, and large batches of new generative skills.

These features increase the attack surface, operational complexity, and recovery burden before the project has live evidence that its core runtime path is reliable.

## Testing strategy

Every enhancement should include deterministic negative tests and a documented rollback path. Static changes should run structural, semantic, MCP, budget, golden-artifact, security-history, mirror, and shell checks. Runtime-control changes should add credential-free conformance fixtures first, followed by operator-owned live smoke evidence. Any external-write change must include fault injection for timeout-after-success, duplicate detection, interrupted local state, and ambiguous remote outcomes.

A release cannot advance solely because repository tests pass. The release report must distinguish repository evidence from real OpenCode/MCP/pilot evidence and retain the current no-go decision until all P0 gates are closed.

## Assumptions and open risks

This roadmap assumes AI Workflow remains a local-first OpenCode framework with generated documentation data, as documented in the approved production plan. It assumes the first pilot uses the existing `pilot-read-only` MCP profile and no direct external publication. The largest open risks are the unverified real runtime path, unknown behavior under actual MCP/network failures, and the absence of independent security and rollback sign-off. These risks should be resolved with evidence before feature expansion.

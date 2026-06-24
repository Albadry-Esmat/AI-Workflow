# Governance — Approval Gates & Quality Enforcement

**Version:** 2.5.0 | **Last updated:** 2026-06-24

## Governance Model

The system uses a five-layer governance model:

```
Layer 1: Automated Governance (enforced by orchestrator & validator)
  → Schema validation, token budgets, retry limits, dependency checks

Layer 2: Guard Skills (enforced by orchestrator as validation_check gates)
  → Database safety, performance, UI/UX compliance, implementation completeness

Layer 3: HITL Gates (enforced by orchestrator, decided by humans)
  → Architecture approval, security posture, completeness sign-off, deployment go/no-go

Layer 4: Documentation Governance (enforced by process)
  → Doc sync rules, changelog updates, versioning

Layer 5: Adaptive Governance (enforced by observability pipeline)
  → Telemetry opt-out, PII protection, read-only insights, no autonomous adaptation
```

## Automated Governance Rules

### Schema Validation (Layer 1)

| Rule | Enforcement | Consequence |
|------|-------------|-------------|
| Every output must match its schema | schema-validator after each skill | Retry up to 5x, then halt |
| Required fields must be present | Schema `required` array | Validation error |
| Field types must match | Schema `type` constraints | Validation error |
| Unknown properties (strict mode) | Schema `additionalProperties: false` | Validation warning/error |

### Pipeline Integrity (Layer 1)

| Rule | Enforcement | Consequence |
|------|-------------|-------------|
| Dependency graph must be acyclic | Orchestrator at pipeline start | Pipeline rejected |
| All registry references must resolve | Orchestrator at start | Skill not found error |
| Max retries per skill | Orchestrator configuration | Pipeline halted after 5 retries |
| Max feedback loops | Session context tracking | Force-terminated after 3 loops |
| Token budget limits | Session context tracking | Session halted, partial results |
| Missing deployment gate | Orchestrator validation | Pipeline rejected with `MISSING_DEPLOYMENT_GATE` |

### Agent Permissions (Layer 1)

| Rule | Enforcement | Consequence |
|------|-------------|-------------|
| Subagents cannot modify files | Permission config | Action denied |
| Subagents cannot execute arbitrary bash | Permission config | Action denied |
| Primary agent must approve HITL gates | Orchestrator gate logic | Pipeline paused |

## Guard Skills (Layer 2)

Guard skills are enforcement agents that run as `validation_check` gates. A `block` verdict from any guard **halts the pipeline immediately** — the orchestrator cannot advance past a guard that returned `block`.

### Guard Inventory

| Guard | Skill | Blocks When | Depends On |
|-------|-------|-------------|-----------|
| Database Guard | `database-guard` (SKL-034) | Destructive migration without approval, missing FK index, unannotated PII, missing cascade rule | database-architect (SKL-032) |
| Performance Guard | `performance-guard` (SKL-035) | N+1 query patterns, missing indexes on query-critical columns | architecture-design (SKL-002), clean-code-review (SKL-004) |
| UI/UX Compliance Guard | `ui-ux-compliance-guard` (SKL-036) | Hardcoded colors, missing required component states, accessibility violations, prop contract violations | frontend-ux-architect (SKL-031) |
| Implementation Completeness Guard | `implementation-completeness-guard` (SKL-037) | Readiness score < threshold (default: 85), critical requirements marked missing | implementation-completeness-auditor (SKL-033) |
| Security Guard | `security-guard` (SKL-041) | CVSS score ≥ effective threshold, OWASP Top-10 critical findings present, compliance-scope blocking conditions (PCI/HIPAA/SOC2) | security-review (SKL-006) |
| Work Item Lifecycle Guard | `work-item-lifecycle-guard` (SKL-058) | Invalid lifecycle state transition for any work item type (block mode only; initial deployment: warning mode) | docs/work-item-foundation.md (lifecycle state machine) |

**Previously existing guards (covered by existing skills):**

| Guard Function | Skill | Layer |
|----------------|-------|-------|
| Architecture boundary enforcement | `change-impact-analyzer` (SKL-024) | Layer 1 |
| Security enforcement | `security-review` (SKL-006) | Layer 3 |
| Documentation enforcement | `doc-maintainer` (SKL-011) | Layer 4 |
| Dependency cycle detection | `dependency-analyzer` (SKL-023) | Layer 1 |
| Code quality enforcement | `clean-code-review` (SKL-004) | Layer 3 |
| Test coverage enforcement | `testing-strategy` (SKL-005) + `test-generator` (SKL-028) | Layer 3 |
| DevOps enforcement | `deployment-strategy` (SKL-007) | Layer 3 |

### Guard Verdict Contract

All guard skills produce a standardized verdict object:

```json
{
  "verdict": "pass" | "block",
  "violations": [
    {
      "rule": "rule_name",
      "severity": "critical" | "major" | "minor",
      "remediation": "..."
    }
  ]
}
```

The orchestrator reads `verdict` after each guard gate:
- `pass` → pipeline continues
- `block` → pipeline halts, gate decision logged, human review required before continuation

## HITL Gate Rules (Layer 3)

| Gate | After Skill | Required For | Timeout | Auto-Continue? |
|------|-------------|--------------|---------|----------------|
| Validate scope | `requirement-analyzer` | Pipeline continuation | 3600s | No |
| Sign off architecture | `architecture-design` | Feature planning | 3600s | No |
| UX architecture approval | `frontend-ux-architect` | UI implementation | 3600s | No |
| Database schema approval | `database-architect` | DB implementation | 3600s | No |
| Approve roadmap | `feature-planning` | Implementation | 3600s | No |
| Approve security | `security-review` | Deployment | 3600s | No |
| Completeness sign-off | `implementation-completeness-auditor` | Release pipeline | 3600s | No |
| **Deploy approval** | **`deployment-strategy`** | **Production release** | **∞ (no timeout)** | **Never — hardcoded** |
| Defect triage | `defect-manager` (defect-lifecycle pipeline, phase 1) | Chain generation | 3600s | No |
| Fix approval | `clean-code-review` (defect-lifecycle pipeline, phase 6) | Defect closure | 3600s | No |
| CR impact approval | `change-impact-analyzer` (change-request pipeline, phase 2) | CR planning | 7200s | No |
| CR scope delivery | `implementation-completeness-auditor` (change-request pipeline, phase 6) | CR closure | 3600s | No |

### Deployment Gate (Special Rule)

The deployment gate is a system-level invariant:

- `bypass_on_timeout: false` — no timeout overrides allowed
- The `deployment_approval_request` artifact from `deployment-strategy` is presented verbatim to the user
- The pipeline produces a `release_ready` state and stops
- No deployment action occurs until an explicit `approve` response is received
- Any pipeline configuration missing this gate is **rejected before execution** with error `MISSING_DEPLOYMENT_GATE`

### Gate Response Actions

| Response | Orchestrator Action |
|----------|---------------------|
| `approve` | Continue pipeline, log decision |
| `reject` | Halt pipeline, return partial results |
| `modify` | Apply modifications to current artifact, re-validate, continue |
| `timeout` | Log `gate_skipped`, auto-continue (standard gates only — NOT deployment gate) |

## Documentation Governance (Layer 4)

### Sync Rules

| Change | Must Update |
|--------|-------------|
| Skill added/modified | `skills-registry.md`, `changelog.md` |
| Agent added/modified | `agents.md`, `changelog.md` |
| Workflow changed | `workflows.md`, `changelog.md` |
| Architecture changed | `architecture.md`, `changelog.md` |
| Prompt system changed | `prompt-engineering.md`, `changelog.md` |
| Deployment changed | `deployment.md`, `changelog.md` |
| Security changed | `security.md`, `changelog.md` |
| Version bumped | `versioning.md`, `changelog.md` |
| Guard skill added/modified | `governance.md`, `skills-registry.md`, `changelog.md` |

### Change Approval Process

```
1. Identify change type (feat, fix, docs, refactor, etc.)
2. Determine which docs need updating (see sync rules)
3. Make code change + doc change in same branch
4. Run quality checks (lint, test, validate)
5. Submit PR with doc changes included
6. Review: verify docs match code changes
7. Merge → changelog updated → docs synced
```

## Quality Enforcement

### Pre-Merge Checklist

- [ ] All tests pass
- [ ] Lint passes
- [ ] No schema validation errors
- [ ] All affected docs updated
- [ ] Changelog entry added
- [ ] Version bumped if applicable
- [ ] Registry updated if skill changed
- [ ] All guard verdicts are `pass` (or block resolved with human approval)

### Pre-Deploy Checklist

- [ ] All pre-merge checks passed
- [ ] Integration tests pass
- [ ] Security scan clean
- [ ] Coverage targets met
- [ ] All HITL gates approved
- [ ] Rollback plan documented
- [ ] Feature flags configured
- [ ] `implementation-completeness-guard` verdict: `pass`
- [ ] `deployment_approval_request` reviewed and explicitly approved by user

## Governance Change Rules

- Adding a governance rule requires updating this file AND `changelog.md`.
- HITL gate changes require updating the orchestrator AND this file.
- Permission changes require updating agent configuration AND this file.
- Adding a guard skill requires updating the Guard Inventory table AND `skills-registry.md`.
- Model changes to `reviewer`, `security-specialist`, or `recovery` agents require a PR comment with justification. Downgrading these agents to a lightweight model (e.g. `claude-haiku-4.5`) without documented rationale is not permitted. See [`docs/models.md`](models.md) for available model IDs and recommended assignments.

## Agent Resource Limits

This section defines the intended token budgets and timeout constraints that the orchestrator must enforce per agent invocation. These are governance policies — not JSON config values. The orchestrator is responsible for tracking and enforcing them.

### Token Budgets Per Agent Tier

| Agent Tier | Examples | Max Tokens Per Invocation |
|------------|----------|--------------------------|
| Read agents (no file writes) | `analyzer`, `architect`, `planner`, `tester`, `impact-analyzer`, `deployer` | 50,000 |
| Write agents (`edit: ask`) | `builder`, `reviewer`, `test-generator`, `documenter`, `doc-maintainer`, `recovery` | 100,000 |
| Primary orchestrator | `primary` | 200,000 |

### Timeout Policy

| Scope | Limit | Behaviour on Breach |
|-------|-------|---------------------|
| All agents | 300 seconds soft timeout per invocation | Orchestrator logs `invocation.timeout`, marks skill `failed`, triggers retry or halt |

### Enforcement Rules

1. The orchestrator MUST track `consumed_tokens` per invocation and halt the agent if the tier limit is reached.
2. On a soft timeout breach (300 s), the orchestrator logs the event in `event_log` and applies the standard retry/halt policy (max 5 retries for regular skills, 1 retry for guards).
3. Agents that exceed their token budget receive a `token_budget_exceeded` error; partial output is discarded and the skill is retried with a pruned input context.
4. The primary orchestrator's 200,000-token budget is tracked across all sub-invocations it initiates within a single pipeline turn.
5. Budget limits apply per invocation, not per session — session-level tracking is handled separately via `token_budget` in the system state schema.

### Change Policy

Any modification to these limits requires updating this file AND `changelog.md`. Raising a limit above the values defined here requires explicit HITL approval before the change takes effect.

## Adaptive Governance (Layer 5)

Layer 5 governs the observability and assisted adaptation pipeline (v2.7.0–v2.8.0): `behavioral-telemetry-collector` (SKL-047), `session-insights` (SKL-048), `enhancement-dashboard` (SKL-049), `adaptive-proposal-generator` (SKL-050), and `adaptation-applicator` (SKL-051).

### Core Principle: Assisted Adaptation — Human in the Loop at Every Step

The observability and adaptation pipeline **observes, suggests, and applies only with explicit human approval**. No automatic changes are made to the registry, routing table, pipeline configurations, or any governance rule based on telemetry data alone. All adaptation is human-initiated and human-approved.

```
Observability (SKL-047→048→049)    ← read-only; no HITL required
          ↓
Proposal Generation (SKL-050)      ← suggestion-only; no HITL required to generate
          ↓
⚠️  HITL Gate — human approves/rejects each proposal
          ↓
Application (SKL-051)              ← HITL approval mandatory; auto-rollback on failure
```

### Opt-Out Rules

| Rule | Enforcement | Consequence |
|------|-------------|-------------|
| Per-project opt-out flag | Checked as first unconditional step in SKL-047 | No telemetry collected; `collected: false` returned immediately |
| Opt-out scope | Per session state (`behavioral_telemetry.opt_out`) | Entire session excluded from all 5 adaptation-pipeline skills |
| Default behavior | Telemetry enabled by default | Projects must explicitly set `opt_out: true` to disable |

### PII Protection Rules

| Rule | Enforcement | Consequence |
|------|-------------|-------------|
| PII scrubber runs on every event | SKL-047 Step 3, before any state write | Credential patterns, emails, path traversals redacted |
| No user content stored | Event schema limited to enum + numeric fields only | Requirement text, code, prompts never stored |
| `pii_scrubbed: true` flag | Set by SKL-047 after every event write | Signals downstream skills that scrubbing completed |
| Proposals contain no user content | SKL-050 uses only aggregated statistics | Proposal text is template-based; no user input interpolated |

### Telemetry Retention Policy

| Item | Policy |
|------|--------|
| Events storage scope | Current session only — `behavioral_telemetry` in active session state |
| Events ring-buffer cap | 500 events per session (oldest dropped when exceeded) |
| Cross-session persistence | Not retained by default — session state follows existing retention policy |
| `session_summary` | Written to session state by SKL-048; follows same retention policy |
| `historical_summaries` | Up to 10 prior session summaries retained for trend analysis (optional) |

### Adaptation Scope Allowlist

The following actions are **permitted** without HITL approval:

- Viewing `enhancement-dashboard` (SKL-049) output at any time (read-only)
- Invoking `session-insights` (SKL-048) at session end (async, non-blocking)
- Invoking `adaptive-proposal-generator` (SKL-050) to generate proposals (read-only; proposals have `hitl_status: pending`)
- Using `dry_run: true` on `adaptation-applicator` (SKL-051) to preview changes without writing

The following actions require **explicit HITL approval before taking effect**:

- Any change to `skills/registry.json` based on proposal data (via SKL-051)
- Any change to `skills/index.yaml`, `skills/graph/skill-graph.yaml`, or pipeline JSON files (via SKL-051)
- Any change to `opencode.json` agent configuration (via SKL-051)
- Any change to governance rules or guard thresholds
- Any change to HITL gate configuration

### Adaptation Execution Rules

| Rule | Enforcement | Consequence |
|------|-------------|-------------|
| HITL approval check is first and unconditional | SKL-051 Step 1 | Any proposal with `hitl_status != "approved"` halts with `HITL_APPROVAL_REQUIRED` |
| Rollback checkpoint before every write | SKL-051 Step 3 | Rollback checkpoint must exist before any file is modified |
| validate-skills.sh must pass | SKL-051 Step 5 | Auto-rollback on failure; `VALIDATION_FAILED` returned |
| npm run build must pass | SKL-051 Step 6 | Auto-rollback on failure; `BUILD_FAILED` returned |
| doc-maintainer triggered on success | SKL-051 Step 7 | Non-blocking; failure is a warning, not a rollback trigger |
| One proposal per invocation | SKL-051 constraint | Batch application is not supported |

### Layer 5 Invariants

1. The observability pipeline (SKL-047–049) **never halts or blocks** any pipeline gate.
2. `enhancement-dashboard` (SKL-049) **never writes to system state**.
3. `session-insights` (SKL-048) **never modifies `behavioral_telemetry.events`** — read-only on events.
4. `adaptive-proposal-generator` (SKL-050) **never writes to registry, index, graph, or pipeline files** — all output proposals have `hitl_status: pending`.
5. `adaptation-applicator` (SKL-051) **never proceeds without `hitl_status == "approved"`** — this check is Step 1 and unconditional.
6. No skill in the adaptation pipeline can modify governance rules, guard skill configurations, or HITL gate thresholds.
7. Adding or modifying any adaptation pipeline skill requires updating this file AND `changelog.md`.

---

### §5.1 — Skill Approval Tiers (FEATURE-003, v5.1.0+)

All skills in the registry carry an `approval_tier` value in their `origin_metadata` that governs the minimum review process required at registration:

| Tier | When assigned | Minimum review requirements |
|------|---------------|------------------------------|
| `standard` | Human-authored skill created in a design session | Full quality-scoring (≥ 70/100) + explicit HITL sign-off |
| `expedited` | Gap-triggered skill produced by the gap-to-skill pipeline (SKL-065) | quality-scoring auto-run (any pass score) + HITL sign-off (non-bypassable) |
| `legacy` | Any skill created before v5.1.0 (pre-FEATURE-003) | No retroactive review required; treated as approved |

All tiers require `scripts/validate-skills.sh` to exit 0.

HITL sign-off is **mandatory** for `standard` and `expedited` tiers — it cannot be bypassed by any automation, pipeline, or configuration flag.

Skills lacking `origin_metadata` (pre-v5.1.0 registrations) are treated as `approval_tier: legacy`. `validate-skills.sh` emits `WARN: missing origin_metadata (pre-v5.1.0 skill, exempted)` for these entries — exit 0 (not an error).

---

## §6 — MCP Tool Governance (v5.3.0+)

This section governs the use of Model Context Protocol (MCP) servers registered in `opencode.json`. MCP tools are available to all agents regardless of the agent's `bash: deny` permission — MCP is a separate tool layer, not a bash invocation.

### MCP Access Rules

| Rule | Enforcement | Consequence |
|------|-------------|-------------|
| MCP tools bypass `bash: deny` | MCP layer (separate from bash permission) | All agents with MCP access can use registered servers even if bash is denied |
| Credentials must use `${ENV_VAR}` syntax | `opencode.json` convention | Credentials must not be hardcoded in the MCP command or env block |
| Disabled servers (`"enabled": false`) must not be activated without credentials | Convention + PR review | Activating a pre-configured server without setting its credentials causes MCP startup failure |
| MCP writes to external systems (GitHub, Slack, Vercel) require the same HITL approval as any state-writing operation | Governance rule | Agents must not use write-capable MCP tools autonomously without user confirmation |

### MCP Server Registry

| Server | Package | Default State | Credentials Required |
|--------|---------|--------------|---------------------|
| `github` | `@modelcontextprotocol/server-github` | Enabled | `GITHUB_TOKEN` |
| `brave-search` | `@modelcontextprotocol/server-brave-search` | Enabled | `BRAVE_API_KEY` |
| `memory` | `@modelcontextprotocol/server-memory` | Enabled | None |
| `fetch` | `@modelcontextprotocol/server-fetch` | Enabled | None |
| `context7` | `@upstash/context7-mcp@latest` | Enabled | `CONTEXT7_API_KEY` |
| `playwright` | `@playwright/mcp@latest` | Enabled | None |
| `slack` | `@modelcontextprotocol/server-slack` | Disabled | `SLACK_BOT_TOKEN`, `SLACK_TEAM_ID` |
| `vercel` | `vercel-mcp` | Disabled | `VERCEL_TOKEN` |

### MCP Credential Policy

1. All API keys for MCP servers must be stored in `.env` (gitignored) — never in `opencode.json` or any tracked file.
2. New MCP servers must be added to `.env` with a placeholder slot (`KEY=`) at the time of registration.
3. Servers that fail to start due to missing credentials are silently skipped by the runtime — agents must not depend on an MCP server being available without confirming its enabled state.

### Adding a New MCP Server

Any addition of an MCP server to `opencode.json` requires:
1. Adding the server definition under the `mcp` key with `"enabled": true/false`
2. Adding the credential slot to `.env` (if credentials required)
3. Adding an entry to the MCP Server Registry table above
4. Adding a `docs/mcp.md` entry documenting the server's purpose and use cases
5. Updating `changelog.md` with the MCP server addition

## §7 — Token Budget & Context Management (v5.4.0+)

### Hard Token Ceilings

Every pipeline phase and individual skill invocation operates under a **hard token ceiling**. The ceiling is declared in the pipeline template's `token_policy` block. Exceeding the ceiling is not a warning — it is a pipeline violation.

| Budget Tier | Ceiling | Default Mode |
|-------------|---------|--------------|
| `standard` | 16 000 tokens | `single_pass` |
| `large` | 32 000 tokens | `cascade` |
| `xl` | 48 000 tokens | `cascade` |

### Automatic Compression Trigger

When context pressure reaches **85 % of the active ceiling**, the orchestrator automatically invokes `context-compressor@^2.0.0` with `auto_compress: true`. This is the only scenario where `context-compressor` may be called without an explicit skill invocation:

```yaml
token_policy:
  auto_compress: true
  trigger_at_percent: 85
  budget_tiers:
    - name: standard
      ceiling: 16000
      cascade_mode: single_pass
    - name: large
      ceiling: 32000
      cascade_mode: cascade
```

Pipelines that declare `auto_compress: false` (or omit `token_policy`) will receive a `AUTO_COMPRESS_NOT_PERMITTED` rejection if the compressor is triggered automatically — the orchestrator must then pause and surface the context pressure to the user.

### Cascade Compression Rules

When `cascade_mode: cascade` is active, the compressor escalates through three levels:

| Level | Target Reduction | Information Retained |
|-------|-----------------|---------------------|
| `light` | 20–40 % | ~90 % |
| `medium` | 40–65 % | ~70 % |
| `aggressive` | > 65 % | ~50 % |

- Levels are tried in order. The cascade **stops as soon as the payload fits** within `max_tokens`.
- If `aggressive` level still cannot meet the ceiling, the best result is returned with a `warning` feedback entry.
- An `info` feedback is emitted whenever `aggressive` level is reached, so operators are notified that significant context was dropped.

### token_efficiency_score

Every `context-compressor` invocation returns a `token_efficiency_score` (0–100). Scores are recorded in the pipeline execution log. Scores below 40 on the `standard` tier are flagged as a quality issue and surfaced to the primary agent.

### Sensitive Content

`context-compressor` must **never** receive content containing API keys, passwords, JWTs, or other credentials. If credential patterns are detected, the invocation is rejected with `SENSITIVE_CONTENT_DETECTED` and the pipeline is halted until the calling skill removes the sensitive content from the payload.

### Governance Rules for Token Budget

| Rule | Enforcement | Rationale |
|------|-------------|-----------|
| Pipelines must declare a `token_policy` block | Convention + CI lint | Without a policy, auto-compression cannot fire and budget overruns are silent |
| `auto_compress: true` requires explicit pipeline declaration | Enforced by `context-compressor` | Prevents accidental compression of pipelines not designed for it |
| Credential-containing content must not be passed to `context-compressor` | Enforced by compressor | Prevents sensitive data leakage through compression artifacts |
| `aggressive` cascade-level events must appear in the session observability log | Orchestrator responsibility | Ensures operators can review significant context drops |
| `token_efficiency_score < 40` on `standard` tier triggers a feedback alert | Orchestrator responsibility | Low efficiency scores indicate content that should not have been passed to the compressor |

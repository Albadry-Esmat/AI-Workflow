# Security — Security Policies & Rules

**Version:** 1.2.0 | **Last updated:** 2026-07-05

## Security Principles

1. **Least privilege**: Every component gets minimum access required.
2. **Defense in depth**: Multiple security layers — input validation, schema validation, HITL gates.
3. **No secrets in code**: All credentials, tokens, and keys use environment variables or secret managers.
4. **Secure defaults**: Systems ship secure by default; explicit opt-in for relaxed modes.
5. **Audit trail**: All HITL gate decisions and pipeline executions are logged.

## Threat Model

The security review skill (`.opencode/skills/security-review/SKILL.md`) performs STRIDE threat modeling:

| Threat | Description | Mitigation |
|--------|-------------|------------|
| Spoofing | Impersonating a skill or agent | Schema validation on all handoffs |
| Tampering | Modifying pipeline artifacts | Immutable session context; validation after each step |
| Repudiation | Denying actions | Execution log with full trace |
| Info Disclosure | Leaking sensitive data | PII stripping in requirement-analyzer; no secrets in output |
| DoS | Overloading the pipeline | Token budgets per session; max retry limits |
| Elevation | Gaining unauthorized permissions | Agent permission model; subagents are read-only by default |

## Input Sanitization

| Input Field | Sanitization Rule |
|-------------|-------------------|
| `raw_input` (requirement-analyzer) | Strip PII before processing |
| `code` (clean-code-review) | Strip inline secrets before analysis |
| All fields | Reject null/unexpected types per schema |

## Data Protection

| Data Type | Handling Rule |
|-----------|---------------|
| PII | Must be stripped before any skill processing. Never stored in output. |
| Credentials | Never appear in skill output. Use `{env:VAR}` or `{file:path}` references. |
| Pipeline artifacts | Stored according to the configured session/state policy; state backups are checksum-manifested and restoreable. Sensitive content must still be redacted before logging or publication. |
| Execution logs | Retained for 7 days. Archived after. |

## Agent Permissions

| Agent | File Access | Edit Permission | Bash Permission |
|-------|-------------|-----------------|-----------------|
| `primary` | Read all | Ask | Ask |
| Read-only subagents (`analyzer`, `architect`, `tester`, `impact-analyzer`, `deployer`, `data-engineer`, `api-designer`, `distributed-systems`, `cloud-platform`, `security-specialist`, `sre`) | Read assigned skill files only | Deny | Deny |
| Write-enabled subagents (`planner`, `reviewer`, `builder`, `test-generator`, `recovery`, `documenter`, `doc-maintainer`) | Read assigned skill files + write scope | Ask | Deny |

## Production Hardening Controls

The release-hardening path adds executable controls in addition to the agent permission model:

| Control | Enforcement |
|---|---|
| Credential-safe initialization | `aiw init` creates `.env` from `.env.example`, never copies populated source credentials implicitly, and applies mode 600 on POSIX systems. |
| State integrity | `scripts/lib/state-store.js` provides atomic JSON replacement, a previous-file backup, corruption recovery, and single-writer lock primitives. |
| Backup verification | `aiw backup` writes a manifest with byte counts and SHA-256 checksums; `aiw restore` verifies the manifest before replacement and retains the previous state directory. |
| Pipeline invariants | `scripts/validate-pipelines.js` rejects unknown skills, duplicate phases, invalid gate references, unsafe async steps, and missing non-bypassable deployment approvals. |
| Supply-chain checks | CI workflows use immutable action commit SHAs and `scripts/security-check.js` verifies action and MCP pinning. |
| External publication | Website publication requires an explicit `--confirm-website` flag and source-to-mirror validation before external repository mutation. |
| Documentation integrity | `aiw docs-check` requires `docs/changelog.md` and all affected domain guides for every implementation or configuration change; `aiw website-check` verifies generated website data. |
| MCP permission policy | `mcp-permission-policy.json` defines the pilot-read-only profile; `npm run validate:mcp` blocks unapproved side-effect servers and unpinned MCP commands. |
| Structured observability | `scripts/lib/event-log.js` stores only bounded, redacted lifecycle fields; `aiw events --prune-days 7` removes expired records and runtime files are ignored from source control. |
| Capacity and cost | `execution-budget.json` and `aiw validate-budget` define pilot retry, duration, token, session, queue, and external-call ceilings; thresholds pause and hard limits stop safely. |
| External-write idempotency | The website publication path derives a deterministic source-data digest key and rejects duplicate claims before commit/push. |
| Rollback rehearsal | `aiw rollback-rehearsal` injects disposable corruption, verifies a backup, restores it, and emits a sanitized checksum report. |
| Compatibility drift | `aiw validate-golden` checks versioned structured-only artifact contracts against `compatibility.json`, including operational contract versions. |
| Runtime certification evidence | `aiw validate-runtime-certification` validates registered runtime identity, staged checks, capability decisions, sanitization, and prevents repository fixtures from being promoted as live certification. |
| Runtime version drift | `aiw runtime-watch` performs read-only version checks for terminal runtimes, reports host/editor verification requirements, and strict preflight blocks an unsupported OpenCode version. |
| Release-status handoff | `aiw release-status` emits only sanitized statuses, versions, paths, counts, and blocker categories; private output files are owner-only and must not contain credentials or raw sessions. |
| Release approval evidence | `aiw validate-release-approval` requires scope-specific owners, blockers, review states, documentation gates, and non-fixture evidence before any conditional or general-production decision. |
| Runtime capability enforcement | `scripts/lib/runtime-guards.js` rejects undeclared MCP capabilities before invocation and requires explicit approval for write or deployment capabilities. |
| Runtime budget enforcement | `BudgetTracker` stops a run when retry, duration, estimated-token, or external-call limits are exceeded. |
| Event contract | `skills/schema/execution-event.schema.json` and `aiw validate-events` enforce the sanitized event shape; raw prompts and MCP payloads remain excluded. |
| Failure containment | `CircuitBreaker` opens after repeated runtime failures and prevents blind retries until the cooldown and recovery path succeed. |
| Checkpoint safety | Harness checkpoints contain session, phase, artifact-name, gate, budget, and circuit metadata only; raw artifact values are excluded. |
| Write planning | `aiw write-plan` is canary-only and dry-run-only, requiring one target and an explicit profile/approval record before any operation-specific write path. |
| Artifact quality | `aiw score-artifact` routes incomplete structured output to human review and rejects prohibited sensitive fields. |

The first pilot uses the `pilot-read-only` profile. GitHub, memory, Context7, and Brave Search are allowed subject to credential review; Playwright, Slack, and Vercel remain disabled because they can create browser, messaging, or deployment side effects. Any profile change requires security review, negative tests, and a release-record update. Runtime capability requests are checked again at invocation time; static policy validation alone is not sufficient authorization.

Use `aiw self-test` for credential-free conformance checks, `aiw pilot-preflight` before operator-owned live smoke execution, and `aiw preflight` before a release candidate. These repository commands do not invoke paid model calls or simulate live OpenCode/MCP evidence.

## Security Skill

The dedicated security review skill performs:
- STRIDE threat modeling per architecture module
- OWASP Top 10 vulnerability mapping
- CWE classification
- Authentication and authorization flow analysis
- Data protection review
- Dependency vulnerability scanning

See [Skills Registry](skills-registry.md#6-security-review) for details.

## HITL Security Gates

| Gate | Trigger | What's Checked |
|------|---------|----------------|
| Architecture approval | After architecture-design | Attack surface, data flow, auth boundaries |
| Security posture | After security-review | All vulnerabilities, threat model, remediation |
| Deploy approval | Before deployment | No critical vulnerabilities, all gates passed |

## Security Change Rules

- Any change to security policies requires updating this file AND `changelog.md`.
- Any repository change requires all affected documentation and `changelog.md`; run `aiw docs-check` before commit and release.
- Changes to authoritative docs or configuration require `aiw sync`, `aiw website-check`, and `aiw sync --check` before commit.
- Security skill changes require re-running threat modeling.
- New integration points require security review before pipeline inclusion.
- Production publication credentials must be separate from local development credentials and must never be copied by `aiw init`.
- Run `node scripts/security-check.js` after changing MCP definitions or GitHub Actions workflows.
- Runtime-certification records must remain sanitized, capability-specific, independently reviewed, and blocked until real non-fixture evidence exists.
- Compatibility maintenance must review version ranges, host boundaries, MCP side effects, projections, and deprecation status at every release and after major vendor changes.
- Release handoff reports must be sanitized, tied to a reviewed commit, and treated as readiness evidence rather than production approval.
- Release approval records must not promote repository fixtures, fake executables, or unavailable runtimes to conditional or general-production approval.

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
| Pipeline artifacts | Stored only in session context during active session. Not persisted. |
| Execution logs | Retained for 7 days. Archived after. |

## Agent Permissions

| Agent | File Access | Edit Permission | Bash Permission |
|-------|-------------|-----------------|-----------------|
| `primary` | Read all | Ask | Ask |
| Read-only subagents (`analyzer`, `architect`, `tester`, `impact-analyzer`, `deployer`, `data-engineer`, `api-designer`, `distributed-systems`, `cloud-platform`, `security-specialist`, `sre`) | Read assigned skill files only | Deny | Deny |
| Write-enabled subagents (`planner`, `reviewer`, `builder`, `test-generator`, `recovery`, `documenter`, `doc-maintainer`) | Read assigned skill files + write scope | Ask | Deny |

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
- Security skill changes require re-running threat modeling.
- New integration points require security review before pipeline inclusion.

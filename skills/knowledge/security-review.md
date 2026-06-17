# Security Review — Knowledge Reference

**Skill ID:** SKL-006
**Version:** 1.0.0 | **Last updated:** 2026-06-16
**Mastery Level:** advanced
**Executable Skill:** [security-review](../security/security-review.md)
**Primary Source:** *OWASP Top 10 2021* (owasp.org); *STRIDE Threat Modeling* — Microsoft (2009)

---

## Overview

Security review systematically identifies threats, vulnerabilities, and weaknesses in a system's architecture and code before they reach production. It applies structured threat modeling (STRIDE per module) and maps findings to established vulnerability taxonomies (OWASP Top 10, CWE). Security is not a feature to add after the system is built — it is a constraint that must be designed in from the architecture stage.

---

## Purpose

Apply this skill to:

- Identify attack surfaces in the system architecture
- Perform STRIDE threat modeling per module
- Map vulnerabilities to OWASP Top 10 2021 categories and CWE identifiers
- Produce a prioritized remediation plan with effort estimates

---

## Principles

### P1 — Defense in Depth *(OWASP Testing Guide v4.2 — Section 3.1)*

No single security control is sufficient. Layer defenses so that the failure of any one control does not compromise the system.

**Layers:**
1. Input validation — reject malformed data at the boundary
2. Authentication — verify who is making the request
3. Authorization — verify what they are allowed to do
4. Audit logging — record who did what and when
5. Encryption — protect data at rest and in transit

**Rule:** Never rely on a single layer. Assume any one layer will fail.

### P2 — STRIDE Threat Model *(Microsoft STRIDE, 2009)*

For each module or component, evaluate all six threat categories:

| Category | Threat | Mitigation |
|----------|--------|------------|
| **S**poofing | Impersonating another user or system | Strong authentication, signed tokens |
| **T**ampering | Modifying data in transit or at rest | Integrity checks, HMAC, TLS |
| **R**epudiation | Denying an action occurred | Audit logs, non-repudiation tokens |
| **I**nformation Disclosure | Exposing data to unauthorized parties | Encryption, access control, data minimization |
| **D**enial of Service | Disrupting availability | Rate limiting, circuit breakers, health checks |
| **E**levation of Privilege | Gaining more access than authorized | Least privilege, RBAC, input sanitization |

### P3 — OWASP Top 10 2021 *(owasp.org/Top10)*

The ten most critical web application security risk categories to check for:

| Rank | Category | Key Check |
|------|----------|-----------|
| A01 | Broken Access Control | Enforce authorization on every endpoint |
| A02 | Cryptographic Failures | TLS everywhere, strong ciphers, no MD5/SHA1 |
| A03 | Injection | Parameterized queries, input validation |
| A04 | Insecure Design | Threat model in architecture phase |
| A05 | Security Misconfiguration | Disable defaults, minimal exposure |
| A06 | Vulnerable Components | Dependency scanning, patch policy |
| A07 | Authentication Failures | MFA, account lockout, secure sessions |
| A08 | Integrity Failures | Signed artifacts, supply chain verification |
| A09 | Logging Failures | Log all security events, protect log integrity |
| A10 | SSRF | Validate all outbound URLs, allowlist where possible |

---

## Practices

| Practice | Description |
|----------|-------------|
| Threat model at architecture phase | Run STRIDE before implementation — rearchitecting after is exponentially more expensive |
| Mark trust boundaries | Every data flow crossing a trust boundary needs authentication and validation |
| Fail securely | Default behavior on error must be deny, not allow |
| Data minimization | Collect only what is required; retain only as long as required |
| Dependency audit | Every third-party library is an attack surface — scan for known CVEs |

---

## Anti-patterns

### AP1 — Security as Afterthought

**What:** Security review done only before release, or only after a vulnerability is reported.
**Why harmful:** Architecture decisions made without security constraints are expensive to change.
**How to fix:** Run STRIDE during architecture design (SKL-002); re-run during code review (SKL-004).

### AP2 — Client-Side Authorization

**What:** Hiding UI elements from unauthorized users instead of enforcing access control on the server.
**Why harmful:** Any user who can read network traffic or HTML can bypass client-side checks trivially.
**How to fix:** Authorization decisions must be made on the server, every time, for every request.

### AP3 — Secrets in Source Code

**What:** API keys, database passwords, JWT secrets embedded in code or committed to version control.
**Why harmful:** Anyone with repository access has credentials. History persists even after deletion.
**How to fix:** Use environment variables, secret managers (Vault, AWS Secrets Manager), or `{env:VAR}` references.

### AP4 — Broad Exception Handlers

**What:** `catch (Exception e) { return null; }` or generic 500 responses with full stack traces.
**Why harmful:** Information disclosure — stack traces reveal internal paths, library versions, and architecture.
**How to fix:** Log the full error internally; return a generic error response to the client.

---

## Examples

### ✅ Correct — Parameterized Query (Prevents SQL Injection)

```python
# Good: user input never interpolated into query
cursor.execute(
    "SELECT * FROM users WHERE email = %s AND password_hash = %s",
    (email, password_hash)
)
```

### ❌ Incorrect — String Interpolation (SQL Injection Vulnerability)

```python
# Bad: A03:2021 — Injection
query = f"SELECT * FROM users WHERE email = '{email}' AND password = '{password}'"
cursor.execute(query)
```

---

### ✅ Correct — Authorization on Every Endpoint

```python
@app.route("/admin/users")
@require_permission("admin:read")  # enforced server-side
def list_users():
    return UserService.get_all()
```

### ❌ Incorrect — UI-Only Authorization (A01: Broken Access Control)

```javascript
// Bad: hiding the button is not authorization
if (user.role === 'admin') {
    showAdminButton();
}
// The endpoint /admin/users has no server-side auth check
```

---

## Related Skills

| Skill | ID | Relationship |
|-------|----|-------------|
| Architecture Design | SKL-002 | Architecture defines the attack surface; security shapes architecture |
| Clean Code Review | SKL-004 | Code clarity makes vulnerabilities visible; obfuscated code hides them |
| Testing Strategy | SKL-005 | Security tests are a required category (auth, injection, boundary) |
| Deployment Strategy | SKL-007 | Environment isolation and secrets management are deployment concerns |

---

## Source References

| Source | Chapter / Section | Linked Content |
|--------|------------------|----------------|
| OWASP Top 10 2021 — owasp.org | A01–A10 | P3 |
| OWASP Testing Guide v4.2 — owasp.org | Section 3: Testing Concepts | P1 |
| *STRIDE Threat Modeling* — Microsoft | Full model | P2 |
| *The Web Application Hacker's Handbook* — Stuttard & Pinto | Ch 2: Core Defense Mechanisms | AP2, AP3 |
| CWE (Common Weakness Enumeration) — cwe.mitre.org | Full catalog | Anti-pattern classification |

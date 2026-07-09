# SaaS & Enterprise Architect — Knowledge Reference

**Skill ID:** SKL-045  
**Version:** 1.0.0 | **Last updated:** 2026-06-18  
**Mastery Level:** advanced  
**Executable Skill:** [saas-enterprise-architect](../../.opencode/skills/saas-enterprise-architect/SKILL.md)  
**Primary Sources:** *SaaS Architecture Patterns* — Anubhav Sharma (2023); *Multi-Tenant SaaS Architecture* — AWS Well-Architected (2022); SOC 2 Trust Services Criteria (AICPA, 2022); ISO/IEC 27001:2022

---

## Overview

SaaS and enterprise platforms have architectural concerns that do not appear in single-tenant web applications: tenant data isolation, subscription billing complexity, enterprise identity federation, compliance certifications, and white-labeling infrastructure. This knowledge reference provides the canonical patterns and implementation standards for each of these concerns.

---

## Multi-Tenancy Models

### MT1 — Shared Database (Row-Level Isolation)

All tenants share a single database. Every table includes a `tenant_id` column. Row-level security (RLS) enforces that queries can only access rows for the current tenant.

**When to use:** Starter tier; ≤ 500 tenants; cost efficiency is the priority; tenants do not have data residency requirements.

**Implementation rules:**
- Enable **Row-Level Security** at the database level (PostgreSQL `CREATE POLICY`), not only at the application layer. Application-layer-only filtering is a single code bug away from a data breach
- Every query must include a `WHERE tenant_id = current_tenant_id()` predicate — enforce this through a query builder middleware, not by convention
- Use a `set_config('app.current_tenant_id', ?, true)` session variable on every database connection; do not pass `tenant_id` as a parameter to every query manually

```sql
-- PostgreSQL RLS example
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON orders
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
```

**Risks:**
- Noisy-neighbor problem: one tenant's heavy queries degrade performance for all tenants
- Schema migrations affect all tenants simultaneously — requires zero-downtime migration discipline

### MT2 — Schema-Per-Tenant

Each tenant has its own database schema within a shared database server. All tables are identical across schemas; only the active schema changes per request.

**When to use:** 10–1,000 tenants; moderate isolation requirement; some tenants have audit or compliance requirements but not full data residency.

**Implementation rules:**
- Use a connection pool that includes the schema name in the connection context: `SET search_path = tenant_schema_name, public`
- Schema provisioning (creating a new tenant schema + running migrations) must be automated and idempotent
- Cross-tenant reporting queries require a superuser connection with explicit schema qualification — never expose this to application code

**Risks:**
- Schema migrations must be applied to every tenant schema — use a migration runner that iterates tenant schemas
- Schema sprawl: 1,000+ tenant schemas become difficult to manage

### MT3 — Database-Per-Tenant

Each tenant has their own isolated database instance. Maximum data isolation.

**When to use:** Enterprise/regulated tenants with strict data residency requirements (HIPAA, PCI DSS, FedRAMP, GDPR Article 46 SCCs); ≤ 100 tenants (beyond this, operational complexity becomes prohibitive without significant automation).

**Implementation rules:**
- Connection string management must use a secrets manager (AWS Secrets Manager, HashiCorp Vault) — never store per-tenant connection strings in application config
- Database provisioning must be fully automated via IaC (Terraform, Pulumi)
- Backup and restore procedures must be tested per-tenant; a restore test schedule is required for SOC 2 compliance

**Risks:**
- Highest operational cost per tenant
- Database version upgrades must be coordinated across all tenant databases

### MT4 — Hybrid Model

Combine models: shared database for starter/growth tiers; schema or database isolation for enterprise tier.

**When to use:** Multi-tier SaaS products where enterprise customers have different isolation requirements than SMB customers.

**Implementation rules:**
- The tenant routing layer must be aware of which tier a tenant belongs to and route to the correct database/schema accordingly
- Migrating a tenant from one tier to another (shared → schema, schema → database) is a data migration event — must be automated and tested

---

## Enterprise SSO

### SSO1 — SAML 2.0 Integration

**When required:** Virtually all enterprise B2B contracts with ≥ 100 seats require SAML 2.0. It is a hard sales blocker if missing.

**Integration pattern:**
```
User → Your App (SP) → Redirect to IdP (Okta/Azure AD/Ping)
IdP → [authenticate user] → SAML Assertion → Your App
Your App → [validate assertion] → Create session
```

**Implementation rules:**
- Use a battle-tested SAML library: `python3-saml`, `ruby-saml`, `node-saml`, or cloud providers' SAML middleware — never implement SAML assertion validation from scratch
- Store the IdP's signing certificate; validate all assertions against it
- Support SP-initiated and IdP-initiated login flows
- Per-tenant SAML configuration: each enterprise tenant has their own IdP entity ID, SSO URL, and signing certificate. Store per-tenant; never use a global SAML config

### SSO2 — OIDC (OpenID Connect) Integration

**When required:** Modern IdPs (Okta, Azure AD, Google Workspace) prefer OIDC over SAML. Required for self-service SSO setup.

**Integration pattern:** Authorization Code Flow with PKCE for web apps; Client Credentials for machine-to-machine.

**Implementation rules:**
- Validate the `iss`, `aud`, `exp`, `iat`, and `nonce` claims on every ID token
- Use PKCE for all public clients — never use implicit flow
- Store refresh tokens in secure, httpOnly, sameSite=Strict cookies; never in localStorage

### SSO3 — SCIM (System for Cross-domain Identity Management)

**When required:** Enterprise customers need automated user provisioning/deprovisioning from their IdP. Manual user management does not scale for large enterprise accounts.

**Implementation rules:**
- Implement SCIM 2.0 endpoints: `/Users`, `/Groups`, `/ServiceProviderConfig`, `/Schemas`
- Deprovisioning must be immediate and cascade: revoke all active sessions for the deprovisioned user
- SCIM write operations (create, update, delete user) must be idempotent — the IdP may retry on timeout

---

## Compliance Frameworks

### CF1 — SOC 2 Type II

**What it requires:** An independent auditor evaluates your security controls over a 6–12 month period. The five Trust Services Criteria are: Security (mandatory), Availability, Processing Integrity, Confidentiality, Privacy.

**Technical controls required (Security TSC — CC series):**

| Control | Implementation |
|---------|---------------|
| CC6.1 — Logical access | RBAC, MFA enforced for all admin access, Principle of Least Privilege |
| CC6.2 — Authentication | MFA required; password complexity enforced; session timeout |
| CC6.3 — Access removal | Automated deprovisioning within 24h of offboarding (SCIM) |
| CC7.1 — Monitoring | SIEM with alerting on anomalous access patterns |
| CC7.2 — Incident response | Documented IR plan; ≤ 72h breach notification procedure |
| CC8.1 — Change management | Code review required; prod deploys require approval; audit log of all changes |
| CC9.2 — Risk assessment | Annual vendor/third-party risk assessment |

**Audit evidence requirements:** Log retention ≥ 12 months; immutable audit logs; access review evidence quarterly.

### CF2 — GDPR (EU General Data Protection Regulation)

**Key technical requirements:**

| Requirement | Implementation |
|-------------|---------------|
| Right to erasure (Article 17) | Automated data deletion workflow; must cascade to backups within backup rotation period |
| Data portability (Article 20) | Export endpoint: structured, machine-readable format (JSON, CSV) |
| Consent management | Granular consent records with timestamp and version; consent withdrawal must stop processing immediately |
| Data minimization (Article 5c) | Collect only what is strictly necessary; document the legal basis for each data category |
| Cross-border transfers (Article 46) | SCCs or adequacy decisions required for transfers outside EEA; database-per-tenant for tenants requiring in-region storage |
| DPA (Data Processing Agreement) | Required with all third-party processors; must be signed before data is shared |

### CF3 — HIPAA (Health Insurance Portability and Accountability Act)

**When required:** Any SaaS that processes, stores, or transmits Protected Health Information (PHI) on behalf of a covered entity.

**Technical safeguards (§164.312):**

| Safeguard | Implementation |
|-----------|---------------|
| Access control | Unique user IDs; emergency access procedure; automatic logoff after inactivity |
| Audit controls | Log all PHI access with user, timestamp, action, and record ID |
| Integrity | Checksums or digital signatures on PHI records |
| Transmission security | TLS 1.2+ for all PHI in transit; no PHI in email without encryption |
| Encryption at rest | AES-256 for all PHI at rest |

**Business Associate Agreement (BAA):** Must be signed with covered entities before handling PHI. AWS, Google Cloud, and Azure all offer BAA-covered service tiers.

### CF4 — ISO/IEC 27001:2022

**What it requires:** An Information Security Management System (ISMS) — documented policies, procedures, and controls for managing information security risk, audited annually.

**Key technical controls (Annex A):**

| Control | Implementation |
|---------|---------------|
| A.8.2 — Privileged access rights | Privileged accounts reviewed quarterly; JIT (just-in-time) access preferred |
| A.8.5 — Secure authentication | MFA required for all remote access; password manager policy |
| A.8.7 — Protection from malware | Endpoint protection; dependency scanning in CI |
| A.8.24 — Use of cryptography | Cryptographic standards documented; key management policy |
| A.8.32 — Change management | All changes reviewed and approved; emergency change procedure |

---

## Subscription Billing

### SB1 — Stripe Integration Patterns

**Usage-based billing (metered):**
```
1. Report usage events to Stripe in real-time:
   stripe.billing.meterEvents.create({ event_name: "api_calls", payload: { stripe_customer_id, value } })
2. Stripe aggregates usage and bills at period end
3. Never calculate billing totals on your side — Stripe is the source of truth
```

**Subscription lifecycle events to handle (via webhook):**
| Event | Action required |
|-------|----------------|
| `customer.subscription.created` | Activate plan features |
| `customer.subscription.updated` | Update feature entitlements (upgrade/downgrade) |
| `customer.subscription.deleted` | Downgrade to free tier immediately |
| `invoice.payment_succeeded` | Reset usage counters for the new period |
| `invoice.payment_failed` | Enter dunning flow; restrict features after grace period |
| `customer.subscription.trial_will_end` | Send renewal reminder (72h before trial end) |

**Dunning (failed payment recovery):**
- Configure Smart Retries in Stripe (automatically retries failed payments at optimal times)
- Implement a grace period (typically 7–14 days) before restricting access
- Send escalating email reminders at: payment failure, 3 days, 7 days, grace period end

### SB2 — Proration and Plan Changes

When a customer upgrades or downgrades mid-cycle:
- **Upgrade (higher tier):** Charge the prorated difference immediately; new features available immediately
- **Downgrade (lower tier):** Credit the prorated difference to the next invoice; features downgrade at cycle end
- Use `proration_behavior: 'always_invoice'` for immediate billing on upgrades; `'none'` + scheduled job for downgrades

### SB3 — Tax Calculation

SaaS products are subject to digital services tax in 100+ jurisdictions (EU VAT, US sales tax, Australian GST, etc.). Do not implement tax calculation logic — use Stripe Tax or Avalara:
- Stripe Tax: configure `automatic_tax: { enabled: true }` on the subscription; Stripe handles jurisdiction detection and rate application
- Tax documentation must be retained for ≥ 7 years in most jurisdictions

---

## Anti-patterns

| Anti-pattern | Risk | Correct approach |
|-------------|------|-----------------|
| Application-layer tenant filtering only | Single bug = cross-tenant data breach | Database-level RLS as the last line of defense |
| Global SAML config (shared across tenants) | One tenant's IdP misconfiguration affects all | Per-tenant SAML/OIDC configuration stored separately |
| Manually tracking subscription state | Drift between your DB and Stripe = revenue loss or over-charging | Stripe is the source of truth; sync via webhooks |
| Adding compliance controls after launch | SOC 2 / HIPAA controls retroactively applied require expensive redesign | Design compliance controls into the architecture from day one |
| Storing IAP secrets in env files | Secret rotation requires redeployment; secrets in git history | Secrets Manager (AWS/GCP/Azure Vault) |

---

## Related Skills

| Skill | ID | Relationship |
|-------|----|-------------|
| Architecture Design | SKL-002 | SaaS constraints shape the module decomposition |
| Database Architect | SKL-008 | Row-level security and schema isolation are database architecture decisions |
| Security Review | SKL-006 | SAML assertion validation, IAP secrets, RBAC gaps are security findings |
| Deployment Strategy | SKL-009 | Multi-region database routing and tenant migration are deployment concerns |

---

## Source References

| Source | Section | Linked Content |
|--------|---------|----------------|
| AWS Well-Architected: SaaS Lens | Tenant Isolation | MT1–MT4 |
| SOC 2 Trust Services Criteria (AICPA 2022) | CC6, CC7, CC8 | CF1 |
| GDPR (EU) 2016/679 | Articles 5, 17, 20, 46 | CF2 |
| HIPAA Security Rule (45 CFR §164.312) | Technical Safeguards | CF3 |
| ISO/IEC 27001:2022 | Annex A Controls | CF4 |
| Stripe Documentation | Billing, Webhooks, Proration | SB1–SB3 |

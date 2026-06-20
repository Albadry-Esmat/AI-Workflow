---
name: saas-enterprise-architect
version: 1.0.0
domain: domain-specialist
description: 'Use when designing SaaS platforms, B2B enterprise products, or multi-tenant cloud applications. Triggers on: "SaaS", "multi-tenant", "B2B", "enterprise software", "subscription billing", "tenant isolation", "white-labeling", "SSO", "SAML", "enterprise compliance", "SOC 2", "ISO 27001". Do NOT use for single-tenant web apps, internal tools, or consumer apps — only use when multi-tenancy, enterprise sales, or compliance certification is the core system concern.'
author: ASE-OS
---

# SaaS & Enterprise Architect

**Version:** 1.0.0 | **Last updated:** 2026-06-18

Domain specialist that injects SaaS-specific multi-tenancy architecture, subscription billing integration, enterprise identity federation (SSO/SAML/OIDC), compliance framework controls (SOC 2, ISO 27001, HIPAA, GDPR), white-labeling capability, and B2B sales workflow support into the pipeline when a SaaS or enterprise platform is being built. Runs at Layer 2c, in parallel with `architecture-design`, and produces `domain_constraints` consumed by downstream pipeline skills.

---

## 1. Skill Header

```yaml
name: saas-enterprise-architect
version: 1.0.0
domain: domain-specialist
description: >
  Use when designing SaaS platforms, B2B enterprise products, or multi-tenant
  cloud applications. Triggers on: "SaaS", "multi-tenant", "B2B", "enterprise
  software", "subscription billing", "tenant isolation", "white-labeling",
  "SSO", "SAML", "enterprise compliance", "SOC 2", "ISO 27001".
  Do NOT use for single-tenant web apps, internal tools, or consumer apps.
author: ASE-OS
```

---

## 2. Purpose

SaaS and enterprise platforms have fundamentally different architectural concerns compared to standard web applications. A standard pipeline without SaaS domain expertise will miss:

- **Tenant isolation** — data leakage between tenants is a catastrophic failure; isolation must be designed at the database, API, and infrastructure layer, not bolted on
- **Multi-tenancy model selection** — shared database (with row-level tenant_id), schema-per-tenant, and database-per-tenant each have dramatically different cost, isolation, and complexity profiles
- **Subscription billing complexity** — Stripe/Chargebee integration for usage-based billing, prorated upgrades/downgrades, dunning management, tax calculation, invoice generation are enterprise blockers if missing
- **Enterprise SSO** — large B2B customers will not sign without SAML 2.0 and OIDC support; it is a hard sales requirement
- **Role-Based Access Control (RBAC)** — enterprise customers require per-tenant RBAC with custom roles; a flat permission model will not pass enterprise security review
- **Compliance certifications** — SOC 2 Type II, ISO 27001, HIPAA, and GDPR each require specific technical controls that must be architected from day one, not retrofitted
- **White-labeling** — custom domains, brand theming, and email sender domains require infrastructure design that single-tenant apps don't need
- **Audit logging** — enterprise contracts require tamper-evident audit logs of all user actions and data access; this cannot be added post-launch without significant refactoring
- **Usage metering** — usage-based pricing requires event-level metering; log-based approximations are not acceptable for billing disputes
- **SLA and uptime guarantees** — enterprise SLAs of 99.9% or higher require specific redundancy, failover, and incident response designs

`saas-enterprise-architect` enforces the correct multi-tenancy patterns, compliance controls, and enterprise integration standards before a single line of code is written.

---

## 3. Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `requirements` | `array[object]` | Yes | Structured requirements from `requirement-analyzer` |
| `architecture` | `object` | No | Partial or draft architecture from `architecture-design` (if available) |
| `domain_context` | `object` | Yes | Domain classification from `prompt-normalizer` (confirms `domain_primary: "saas"`) |
| `tenancy_model_hint` | `string` | No | `shared_db`, `schema_per_tenant`, `db_per_tenant`, `hybrid`, `unknown` |
| `compliance_frameworks` | `array[string]` | No | Required certifications: `soc2`, `iso27001`, `hipaa`, `gdpr`, `pci_dss`, `fedramp` |
| `pricing_model` | `string` | No | `flat_rate`, `per_seat`, `usage_based`, `tiered`, `hybrid` |
| `white_label_required` | `boolean` | No | Whether white-labeling (custom domains, brand theming) is required |
| `enterprise_sso_required` | `boolean` | No | Whether SAML/OIDC SSO is required. Defaults to `false` |
| `expected_tenant_scale` | `string` | No | `small` (< 100 tenants), `medium` (100–10k), `large` (> 10k) |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["requirements", "domain_context"],
  "properties": {
    "requirements": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "type", "statement", "priority"],
        "properties": {
          "id":        { "type": "string" },
          "type":      { "type": "string", "enum": ["F", "NF", "C"] },
          "statement": { "type": "string" },
          "priority":  { "type": "string" }
        }
      }
    },
    "architecture": { "type": "object" },
    "domain_context": {
      "type": "object",
      "required": ["domain_primary"],
      "properties": {
        "domain_primary": { "type": "string", "enum": ["saas", "enterprise"] }
      }
    },
    "tenancy_model_hint": {
      "type": "string",
      "enum": ["shared_db", "schema_per_tenant", "db_per_tenant", "hybrid", "unknown"],
      "default": "unknown"
    },
    "compliance_frameworks": {
      "type": "array",
      "items": { "type": "string", "enum": ["soc2", "iso27001", "hipaa", "gdpr", "pci_dss", "fedramp"] }
    },
    "pricing_model": {
      "type": "string",
      "enum": ["flat_rate", "per_seat", "usage_based", "tiered", "hybrid", "unknown"],
      "default": "unknown"
    },
    "white_label_required": { "type": "boolean", "default": false },
    "enterprise_sso_required": { "type": "boolean", "default": false },
    "expected_tenant_scale": {
      "type": "string",
      "enum": ["small", "medium", "large"],
      "default": "medium"
    }
  }
}
```

---

## 4. Required Context

- `requirements` from `requirement-analyzer` (SKL-001) is mandatory.
- `domain_context.domain_primary` must be `"saas"` or `"enterprise"`.
- `tenancy_model_hint: "unknown"` triggers inference from requirements (Step 1).
- `compliance_frameworks` must be declared explicitly — never inferred, to avoid missed controls.
- `enterprise_sso_required: true` mandates SAML 2.0 + OIDC in the integration contracts.

---

## 5. Execution Logic

```
Step 1 — Infer and confirm tenancy model
  If tenancy_model_hint == "unknown", infer from requirements:
    db_per_tenant signals:     "strict data isolation", "dedicated database", "regulatory data residency",
                               "HIPAA BAA per tenant", "separate encryption keys per tenant"
    schema_per_tenant signals: "schema isolation", "moderate isolation", medium tenant scale
    shared_db signals:         "large tenant count", "cost efficiency", "simpler ops", "multi-tenant by default"
    hybrid:                    "enterprise tier gets db_per_tenant, standard tier shared_db"

  Tenancy model trade-off table:
    shared_db:
      Pro:  lowest cost, simplest ops, easiest schema migrations
      Con:  tenant_id must be on every table + every query; RLS or ORM guard required; noisy neighbor risk
      When: > 1000 tenants expected, cost is primary constraint
      Required: Row-Level Security (PostgreSQL RLS) or application-level tenant guard in ORM

    schema_per_tenant:
      Pro:  strong logical isolation, simpler queries (no tenant_id filter), independent schema migration
      Con:  schema migration complexity (must run per-tenant), connection pool pressure (per-schema pools)
      When: 10–1000 tenants, moderate isolation requirement, no strict data residency
      Required: Schema migration orchestrator; per-tenant migration state tracking

    db_per_tenant:
      Pro:  strongest isolation, independent backups, encryption keys per tenant, data residency control
      Con:  highest cost, complex ops, connection pool explosion at scale
      When: < 100 enterprise tenants, HIPAA/FedRAMP compliance, per-tenant SLA
      Required: Database provisioning automation; per-tenant connection pool; cross-tenant admin access design

    hybrid:
      Standard tier: shared_db; Enterprise tier: db_per_tenant
      Required: Tenant tier field in control plane; migration workflow to promote shared → dedicated

  Output: tenancy_model, tenancy_constraints

Step 2 — Design RBAC architecture
  Base model: per-tenant roles with permission sets (not global roles)
  Required modules: [PermissionStore, RoleManager, PolicyEngine, TenantAdminPortal]
  Role structure:
    System roles (cross-tenant): super_admin, support_agent, billing_admin — platform operator only
    Tenant roles (per-tenant, customizable): owner, admin, member, viewer — tenant-defined
    Resource-level permissions: CRUD per resource type (e.g., projects:create, invoices:read)
  Permission evaluation: deny-by-default; explicit grant required
  Row-level access: tenant isolation enforced before RBAC permission check
  Audit: every permission check and role change must be logged
  Output: rbac_architecture

Step 3 — Design subscription billing architecture
  Required if pricing_model != "none":
    Billing provider selection:
      Stripe Billing:      best for flat_rate, per_seat, tiered; excellent developer experience
      Stripe + Meteringware (e.g., Lago, Orb): required for usage_based billing with complex aggregation
      Chargebee:           enterprise-grade; handles complex subscription logic
    Required modules: [BillingService, SubscriptionManager, UsageMeter (if usage_based),
                       InvoiceGenerator, DunningManager, TaxCalculator, EntitlementService]
    Key constraints:
      - Entitlement checks happen server-side on every API call (never trust client)
      - Webhook idempotency: billing provider webhooks may deliver multiple times — use event ID deduplication
      - Proration: upgrades are prorated immediately; downgrades apply at period end
      - Dunning: define payment retry schedule (day 1, 3, 7, 14 → suspension) in `domain_constraints`
      - Tax: use provider's tax engine (Stripe Tax, Avalara) — do not implement custom tax logic
      - Metering: usage events must be sent to billing provider within 1-hour window for accuracy
  Output: billing_architecture

Step 4 — Design enterprise identity integration (SSO)
  Required if enterprise_sso_required == true (and recommended regardless for B2B):
    Protocols to support:
      SAML 2.0:   required for enterprise IdPs (Okta, Azure AD, PingIdentity, ADFS)
      OIDC:       required for modern IdPs and Google Workspace
      SCIM 2.0:   required for automated user provisioning/deprovisioning from corporate directories
    Required modules: [SSOProvider, SAMLHandler, OIDCHandler, SCIMEndpoint, SessionManager, JITProv]
    Implementation approach:
      Use WorkOS, Auth0, or Okta as the federation middleware — do not implement SAML parsing natively
    Key constraints:
      - JIT (Just-in-Time) provisioning: create user on first SSO login if not pre-provisioned
      - SCIM provisioning: sync user roles/groups from IdP; deprovisioning suspends access within 1 hour
      - Session management: enterprise SSO sessions must respect IdP session timeout
      - Domain verification: verify customer's email domain before enabling SSO to prevent takeover
    Output: sso_architecture

Step 5 — Apply compliance framework controls
  For each declared compliance_framework:

    soc2:
      Trust Service Criteria (TSC) technical controls required:
        CC6.1: logical access controls (RBAC, MFA for admins)
        CC6.2: new user access provisioning (SCIM or approval workflow)
        CC6.3: access removal (SCIM deprovisioning, offboarding checklist)
        CC7.2: monitoring and anomaly detection (SIEM integration or CloudWatch/Datadog alerts)
        CC8.1: change management (deployment pipeline with approval gates)
        A1.1:  availability monitoring (uptime monitoring, PagerDuty/OpsGenie)
        C1.1:  confidentiality (encryption at rest AES-256, in transit TLS 1.2+)

    iso27001:
      Annex A controls (technical):
        A.9.2:  user access management (provisioning, periodic access review)
        A.9.4:  system access controls (MFA, session timeout)
        A.10.1: cryptography policy (key management documented)
        A.12.4: logging and monitoring (centralized audit logs, 1-year retention)
        A.14.2: security in development (SAST in CI, dependency scanning)

    hipaa:
      Technical safeguards:
        Access controls:    unique user ID, emergency access, automatic logoff, encryption
        Audit controls:     hardware, software, and procedural mechanisms to record PHI access
        Integrity:          electronic mechanisms to corroborate PHI not altered or destroyed
        Transmission:       encrypt PHI in transit (TLS 1.2+ minimum)
        BAA required:       Business Associate Agreement from every subprocessor touching PHI

    gdpr:
      Article 25 (Data Protection by Design): data minimization, purpose limitation
      Article 30: Records of Processing Activities (ROPA) — document all data flows
      Article 17: Right to erasure — implement tenant and user data deletion pipeline
      Article 20: Data portability — export all user data as JSON/CSV on request
      Article 33: Breach notification — 72-hour notification pipeline to supervisory authority
      Privacy by default: opt-in for analytics, minimal default data collection

    pci_dss:
      Never store raw card data — use tokenization (Stripe Elements, Braintree SDK)
      SAQ level determined by transaction volume and integration type
      Network segmentation: cardholder data environment (CDE) must be isolated
      Log all access to cardholder data

    fedramp:
      FedRAMP Moderate or High authorization required for US federal customers
      FIPS 140-2 validated cryptography required
      Must use FedRAMP-authorized cloud services (AWS GovCloud, Azure Government)
      Continuous monitoring (ConMon) reporting required monthly

  Output: compliance_controls (per framework)

Step 6 — Design white-labeling architecture (if white_label_required == true)
  Required capabilities:
    Custom domains:     per-tenant subdomain (tenant.yourapp.com) or custom domain (app.theirs.com)
    SSL certificates:   automated provisioning via Let's Encrypt or Cloudflare for custom domains
    Brand theming:      per-tenant logo, color scheme, font (CSS variables, not compiled CSS)
    Email sender:       per-tenant from address requires SPF/DKIM/DMARC setup per domain
    Terms & Privacy:    per-tenant custom URLs for terms and privacy policy
    Login page:         branded login screen (white-labeled auth flow)
  Required modules: [TenantBrandingStore, DomainProvisioner, CertificateManager, ThemeEngine]
  Key constraints:
    - Wildcard SSL cert for subdomains; ACME challenge automation for custom domains
    - Theme stored as JSON config per tenant; CSS custom properties applied at runtime
    - No tenant-specific CSS compiled into builds — runtime injection only
  Output: white_label_architecture

Step 7 — Design audit logging architecture
  All SaaS platforms require tamper-evident audit logs:
    Scope: all user actions that modify data or access sensitive resources
    Format: { timestamp, tenant_id, actor_id, action, resource_type, resource_id, ip_address, result }
    Storage: append-only log store (e.g., immutable S3 object, Kafka topic, dedicated audit DB table)
    Retention: minimum 1 year (SOC 2); 7 years for financial data (local regulation)
    Query: audit log must be queryable by tenant admin (self-service) and platform admin
    Export: downloadable CSV/JSON for compliance audits
    Tamper evidence: hash chaining or write-once storage prevents post-hoc modification
  Required modules: [AuditLogger, AuditQueryService, AuditExporter]
  Output: audit_logging_architecture

Step 8 — Produce domain_constraints
  Assemble all outputs from steps 1–7 into a structured domain_constraints object
  consumed by architecture-design, testing-strategy, code-generator, database-architect, and security-guard.
  Output: domain_constraints
```

---

## 6. Outputs

| Field | Type | Description |
|-------|------|-------------|
| `domain_constraints` | `object` | **Primary output.** All SaaS/enterprise constraints for downstream pipeline skills |
| `tenancy_model` | `object` | Selected tenancy model, trade-off rationale, and technical constraints |
| `rbac_architecture` | `object` | Role model, permission structure, enforcement strategy |
| `billing_architecture` | `object` | Billing provider, subscription model, metering, dunning, entitlement |
| `sso_architecture` | `object` | SAML/OIDC/SCIM design, provider recommendation, session management (if applicable) |
| `compliance_controls` | `object` | Per-framework technical controls required |
| `white_label_architecture` | `object` | Custom domain, branding, email sender design (if applicable) |
| `audit_logging_architecture` | `object` | Audit log schema, storage, retention, query design |
| `saas_checklist` | `array[string]` | Pre-implementation checklist for the builder agent |
| `metadata` | `object` | Input summary, tenancy model, compliance frameworks, version |
| `metrics` | `object` | REQUIRED. Standard execution metrics |
| `feedback` | `array[object]` | REQUIRED. Feedback loop entries |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["domain_constraints","tenancy_model","rbac_architecture","audit_logging_architecture",
               "saas_checklist","metadata","metrics","feedback"],
  "properties": {
    "domain_constraints": {
      "type": "object",
      "required": ["domain","tenancy_model","rbac_architecture","required_modules",
                   "module_constraints","compliance_controls","audit_requirements"],
      "properties": {
        "domain":               { "type": "string", "enum": ["saas", "enterprise"] },
        "tenancy_model":        { "type": "string", "enum": ["shared_db","schema_per_tenant","db_per_tenant","hybrid"] },
        "rbac_architecture":    { "type": "object" },
        "required_modules":     { "type": "array", "items": { "type": "string" } },
        "module_constraints":   { "type": "array" },
        "compliance_controls":  { "type": "object" },
        "audit_requirements":   { "type": "object" },
        "billing_architecture": { "type": "object" },
        "sso_architecture":     { "type": "object" }
      }
    },
    "tenancy_model":             { "type": "object" },
    "rbac_architecture":         { "type": "object" },
    "billing_architecture":      { "type": "object" },
    "sso_architecture":          { "type": "object" },
    "compliance_controls":       { "type": "object" },
    "white_label_architecture":  { "type": "object" },
    "audit_logging_architecture":{ "type": "object" },
    "saas_checklist":            { "type": "array", "items": { "type": "string" } },
    "metadata": {
      "type": "object",
      "required": ["tenancy_model","compliance_frameworks","pricing_model","version"],
      "properties": {
        "tenancy_model":          { "type": "string" },
        "compliance_frameworks":  { "type": "array" },
        "pricing_model":          { "type": "string" },
        "enterprise_sso":         { "type": "boolean" },
        "white_label":            { "type": "boolean" },
        "expected_tenant_scale":  { "type": "string" },
        "version":                { "type": "string" }
      }
    },
    "metrics":  { "$ref": "#/$defs/metrics" },
    "feedback": { "type": "array", "items": { "$ref": "#/$defs/feedback_entry" } }
  },
  "$defs": {
    "metrics": {
      "type": "object",
      "required": ["tokens_in","tokens_out","duration_ms","items_produced","version"],
      "properties": {
        "tokens_in":      { "type": "integer" },
        "tokens_out":     { "type": "integer" },
        "duration_ms":    { "type": "integer" },
        "items_produced": { "type": "integer" },
        "version":        { "type": "string" }
      }
    },
    "feedback_entry": {
      "type": "object",
      "required": ["type","from_skill","reason"],
      "properties": {
        "type":         { "type": "string", "enum": ["backpropagate","info","warning"] },
        "from_skill":   { "type": "string" },
        "target_skill": { "type": "string" },
        "reason":       { "type": "string" },
        "evidence":     { "type": "object" }
      }
    }
  }
}
```

---

## 7. Rules & Constraints

- `domain_context.domain_primary` MUST be `"saas"` or `"enterprise"` — any other value causes rejection.
- This skill is **advisory only** — it does not write code, architecture, or tests. It produces constraints consumed by skills that do.
- `tenancy_model` MUST be resolved — never left as `"unknown"` in output. Default to `"shared_db"` if ambiguous, with a warning.
- `compliance_frameworks` are **never inferred** from requirements — they must be declared explicitly. Missed compliance controls post-launch are a legal and business risk. Emit a warning if requirements contain compliance signals but no frameworks are declared.
- `enterprise_sso_required: false` does not mean SSO should be skipped entirely — emit a recommendation that SSO should be planned even if not in V1.
- Billing webhook idempotency is a **hard constraint** — code-generator must implement event ID deduplication. Duplicate webhook processing causes double-billing.
- Audit logs must be **append-only** — code-generator is instructed not to implement UPDATE or DELETE on audit log tables.
- Row-Level Security (for shared_db) is enforced at the database layer first and the ORM layer second — both are required.

---

## 8. Security Considerations

- **Tenant isolation failure is a catastrophic breach** — every API endpoint, database query, and background job must enforce tenant context. The `security-guard` (SKL-041) is configured to flag any code path that queries without a tenant scope filter.
- For `compliance_frameworks` including `hipaa`: all subprocessors (database, logging, email, analytics) must have BAAs. Document this in the architecture.
- For `compliance_frameworks` including `pci_dss`: cardholder data must never touch application servers — use tokenization via hosted payment fields (Stripe Elements, Braintree SDK).
- SSO domain verification: before enabling SSO for a tenant's email domain, verify domain ownership via DNS TXT record. Without this, an attacker could claim a domain and gain SSO access.
- Billing portal sessions: Stripe Billing Portal sessions are short-lived (5 min); do not cache or reuse them.
- SCIM deprovisioning: user access must be revoked within 1 hour of SCIM DELETE event. SLO must be measured.

---

## 9. Token Optimization

- Tenancy model trade-offs are pre-templated — inference is signal-matching, not generative.
- RBAC structure follows a fixed model — only the number of permission categories is LLM-inferred from requirements.
- Compliance controls are pre-defined per framework — selection is filtering, not generation.
- Billing architecture is provider-templated — only the pricing model logic requires LLM reasoning.
- Audit log schema is fixed — no LLM generation needed; emit the canonical schema from the template.

---

## 10. Quality Checklist

- [ ] `domain_context.domain_primary` is `"saas"` or `"enterprise"`
- [ ] `tenancy_model` resolved and justified — never `"unknown"` in output
- [ ] RBAC architecture includes both platform roles (cross-tenant) and tenant roles (per-tenant)
- [ ] Billing architecture present if `pricing_model != "none"` — includes entitlement enforcement
- [ ] Webhook idempotency constraint documented for billing provider events
- [ ] If `enterprise_sso_required: true`: SAML + OIDC + SCIM all included
- [ ] If `compliance_frameworks` non-empty: all required technical controls listed per framework
- [ ] Audit logging architecture present — append-only, retention period specified
- [ ] If `white_label_required: true`: custom domain + SSL + theming + email sender all covered
- [ ] Row-Level Security or application-level tenant guard specified for shared_db model
- [ ] `saas_checklist` is non-empty (minimum 15 items)
- [ ] Output is valid JSON

---

## 11. Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| `domain_context.domain_primary` not `"saas"` or `"enterprise"` | Reject with error feedback |
| `tenancy_model_hint: "unknown"` and requirements have no signals | Default to `"shared_db"`; emit warning requesting clarification |
| `compliance_frameworks` not declared but requirements contain compliance signals ("HIPAA", "SOC 2", etc.) | Emit warning: "Compliance signals detected but no frameworks declared — verify scope before proceeding" |
| `pricing_model: "usage_based"` but no metering requirements defined | Backpropagate to requirement-analyzer: "Usage-based billing requires metering event definitions" |
| `enterprise_sso_required: true` but no IdP or customer list defined | Emit info: "SSO required but no specific IdPs mentioned — defaulting to Okta + Azure AD + Google Workspace coverage" |

---

## 12. Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Behavior |
|------|---------|---------|----------|
| Tenancy model confirmation | `tenancy_model` inferred (not explicitly provided) | 3600s | Present trade-off table; confirm tenancy model before database-architect runs |
| Compliance framework declaration | Requirements contain compliance signals but `compliance_frameworks` is empty | 3600s | Force explicit declaration — compliance controls cannot be retroactively applied |
| SSO scope confirmation | `enterprise_sso_required: true` | 3600s | Present SAML + OIDC + SCIM scope; confirm which IdPs and provisioning flows are in V1 |
| Billing architecture sign-off | `pricing_model: "usage_based"` or `"hybrid"` | 3600s | Present metering architecture and billing provider recommendation before planning |

---

## 13. Skill Composition

`saas-enterprise-architect` runs in **phase-2c** (domain specialist layer), in parallel with `architecture-design` completing its second pass. It produces `domain_constraints` fed into downstream skills:

```yaml
name: phase-2c-domain-specialist
composes:
  - skill: saas-enterprise-architect
    version: "^1.0.0"
    condition: "domain_context.domain_primary == 'saas' OR domain_context.domain_primary == 'enterprise'"
    input_map:
      requirements:            "requirement_analyzer_output.requirements"
      architecture:            "architecture_design_output"
      domain_context:          "domain_context"
      tenancy_model_hint:      "session_context.tenancy_model_hint"
      compliance_frameworks:   "session_context.compliance_frameworks"
      pricing_model:           "session_context.pricing_model"
      white_label_required:    "session_context.white_label_required"
      enterprise_sso_required: "session_context.enterprise_sso_required"
      expected_tenant_scale:   "session_context.expected_tenant_scale"
    output_map:
      domain_constraints: "saas_domain_constraints"
```

`domain_constraints` is passed to:
- `architecture-design` (SKL-002) → tenancy model, RBAC, SSO, audit log module design
- `database-architect` (SKL-032) → multi-tenant schema strategy, RLS setup, migration orchestration
- `testing-strategy` (SKL-005) → tenant isolation test patterns, compliance control verification
- `code-generator` (SKL-026) → tenant guard injection, RBAC enforcement, billing webhook idempotency
- `security-guard` (SKL-041) → tenant scope enforcement, compliance control verification

### Implementation Checklist (emitted in `saas_checklist`)

```
SaaS Platform Implementation Checklist:
[ ] Tenant ID enforced on every database query (RLS policy or ORM scope)
[ ] No cross-tenant data access possible in any code path
[ ] RBAC deny-by-default; every permission explicitly granted
[ ] Entitlement check on every API endpoint (server-side, never client trust)
[ ] Billing webhook handler is idempotent (event ID deduplication)
[ ] Subscription upgrade prorated; downgrade at period end
[ ] Dunning schedule defined and implemented (retry day 1, 3, 7, 14 → suspend)
[ ] SAML 2.0 and OIDC SSO tested with Okta and Azure AD test tenants
[ ] SCIM deprovisioning revokes access within 1 hour
[ ] SSO domain verification via DNS TXT record before enablement
[ ] Audit log is append-only (no UPDATE/DELETE on audit table)
[ ] Audit log includes: timestamp, tenant_id, actor_id, action, resource, IP, result
[ ] Audit log retention meets compliance minimum (SOC 2: 1 year; financial: 7 years)
[ ] Data deletion pipeline tested (GDPR right to erasure, tenant offboarding)
[ ] Data export pipeline tested (GDPR portability, enterprise contract requirement)
[ ] Custom domain provisioning automated (Let's Encrypt / Cloudflare API)
[ ] Theme stored as JSON config per tenant; no per-tenant compiled CSS
[ ] Usage metering events sent to billing provider within 1-hour window
[ ] All compliance controls documented and mapped to audit evidence artifacts
[ ] Monitoring and alerting set up for uptime SLA (99.9% = 8.7h downtime/year budget)
```

### Changelog

| Version | Date | Change |
|---------|------|--------|
| 1.0.0 | 2026-06-18 | Initial release — 8-step domain specialist covering multi-tenancy model selection, RBAC, subscription billing, enterprise SSO (SAML/OIDC/SCIM), compliance frameworks (SOC 2, ISO 27001, HIPAA, GDPR, PCI DSS, FedRAMP), white-labeling, and audit logging |

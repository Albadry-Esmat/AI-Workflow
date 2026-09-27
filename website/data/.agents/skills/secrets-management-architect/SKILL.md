---
name: secrets-management-architect
version: 1.0.0
domain: security
description: >
  Use when designing secrets management infrastructure, vault topology, secret rotation policies, PKI lifecycle management, or workload identity patterns. Triggers on: "secrets management", "HashiCorp Vault design", "secret rotation", "dynamic secrets", "SPIFFE/SPIRE", "zero hardcoded credentials", "PKI design", "mTLS workload identity". Do NOT use for general security reviews — use security-review or threat-model-designer for those.
author: system
---

## Purpose

Design comprehensive secrets management and credential governance architectures that enforce the principle of zero hardcoded credentials and zero plaintext secrets at rest or in transit. This skill covers the full secrets management stack: vault platform selection and topology (HashiCorp Vault OSS vs Enterprise, AWS Secrets Manager, GCP Secret Manager, Azure Key Vault, and CyberArk for enterprise on-premises), authentication method design per environment (AppRole, Kubernetes auth, AWS IAM auth, GCP Service Account auth, Azure Managed Identity, JWT/OIDC, LDAP/AD), and secret engine configuration (KV v2 for static secrets with versioning, Transit for encryption-as-a-service, PKI for certificate issuance, Database for dynamic credentials, AWS/GCP/Azure for cloud provider credential generation, SSH for dynamic SSH certificates).

Secret rotation is architecturally complex: the skill designs zero-downtime rotation strategies for each secret type, covering automated rotation (Lambda/Cloud Function orchestrated, Vault agent with template rendering, External Secrets Operator with refresh intervals), semi-automated rotation (rotation triggered by operator with automated propagation), and manual rotation procedures with documented runbooks. Database credential rotation deserves particular focus — the skill designs dual-user rotation patterns (maintaining two active credentials simultaneously during rotation to eliminate downtime), Vault Database secrets engine configuration for PostgreSQL, MySQL, MongoDB, Oracle, and Redis, and connection pool warm-up strategies post-rotation.

For modern cloud-native environments, the skill designs workload identity frameworks that eliminate long-lived static credentials entirely: SPIFFE/SPIRE (SPIFFE Verifiable Identity Document, SVID X.509 certificates, SPIRE server and agent topology, attestation plugins for K8s/AWS/GCP), Istio SPIFFE workload identity integration, and PKI infrastructure design (Root CA and Intermediate CA topology, certificate chain length, CRL/OCSP responder configuration, certificate revocation strategy, automated certificate renewal using cert-manager, ACME protocol for public-facing TLS, internal CA for service-to-service mTLS). Secrets injection patterns are evaluated across environments: Vault Agent sidecar (K8s init container vs sidecar), External Secrets Operator (SecretStore, ClusterSecretStore, ExternalSecret CRDs), CSI secrets store driver (SecretProviderClass), and the risks of environment variable injection (process listing, /proc exposure) vs in-memory file mounting (/dev/shm, tmpfs).

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `secret_inventory` | `array` | Yes | Secrets to manage: type, consumer service, rotation frequency, and current storage method |
| `vault_platform` | `string` | No | Primary vault: `hashicorp`, `aws_sm`, `gcp_sm`, `azure_kv`, or `cyberark`. Defaults to `hashicorp` |
| `rotation_policy` | `string` | No | Rotation approach: `automated`, `manual`, or `semi_automated`. Defaults to `automated` |
| `environment` | `string` | No | Deployment environment: `k8s`, `ecs`, `serverless`, or `vm`. Defaults to `k8s` |
| `compliance_requirements` | `array` | No | Compliance mandates: `pci_dss`, `hipaa`, `sox`, `fips_140_2`, `gdpr`, `fedramp` |
| `context` | `object` | No | Additional context: existing infrastructure, team size, HSM availability, multi-region requirements |

**Input Schema:**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "secret_inventory": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "properties": {
          "secret_name":          { "type": "string" },
          "secret_type":          { "type": "string", "enum": ["database_credential","api_key","tls_certificate","ssh_key","oauth_client_secret","encryption_key","service_account_key","smtp_credential"] },
          "consumer_service":     { "type": "string" },
          "rotation_frequency":   { "type": "string", "enum": ["hourly","daily","weekly","monthly","quarterly","annually","on_breach"] },
          "current_storage":      { "type": "string", "enum": ["env_var","config_file","k8s_secret","vault","aws_sm","gcp_sm","hardcoded","unknown"] },
          "criticality":          { "type": "string", "enum": ["critical","high","medium","low"] }
        },
        "required": ["secret_name","secret_type","consumer_service"]
      }
    },
    "vault_platform": { "type": "string", "enum": ["hashicorp","aws_sm","gcp_sm","azure_kv","cyberark"] },
    "rotation_policy": { "type": "string", "enum": ["automated","manual","semi_automated"] },
    "environment": { "type": "string", "enum": ["k8s","ecs","serverless","vm"] },
    "compliance_requirements": {
      "type": "array",
      "items": { "type": "string", "enum": ["pci_dss","hipaa","sox","fips_140_2","gdpr","fedramp"] }
    },
    "context": {
      "type": "object",
      "properties": {
        "hsm_available":     { "type": "boolean" },
        "multi_region":      { "type": "boolean" },
        "team_size":         { "type": "integer" },
        "existing_pki":      { "type": "boolean" }
      }
    }
  },
  "required": ["secret_inventory"]
}
```

## Required Context

- Secret inventory with type and consumer service (mandatory); current_storage field is critical for identifying hardcoded credentials
- Deployment environment determines injection pattern selection (Vault Agent sidecar for K8s, Task IAM Role for ECS, Lambda environment with SSM for serverless)
- Compliance requirements activate specific controls: FIPS 140-2 requires HSM-backed keys; PCI DSS requires quarterly rotation minimum; FedRAMP requires FIPS-validated cryptographic modules
- `context.hsm_available` enables HSM auto-unseal design (AWS CloudHSM, Azure Dedicated HSM, HashiCorp Vault PKCS#11 seal)
- Existing PKI infrastructure from `context.existing_pki` avoids redundant root CA creation recommendations

## Execution Logic

```
Step 1 — Audit secret inventory and classify risk
  Parse secret_inventory; identify all hardcoded (current_storage: hardcoded) and
  plaintext environment variable secrets (current_storage: env_var) as immediate critical risks.
  Classify each secret by sensitivity: encryption_key > database_credential > oauth_client_secret >
    tls_certificate > api_key > service_account_key > smtp_credential.
  Flag: secrets without defined rotation_frequency as `ROTATION_UNDEFINED`.
  Flag: service_account_key type (avoid long-lived, prefer workload identity).
  Output: classified_inventory[], critical_remediation_items[]

Step 2 — Design vault architecture topology
  Single-cluster (default): Vault cluster with 5-node Raft integrated storage (production);
    auto-unseal: AWS KMS / Azure Key Vault / GCP Cloud KMS seal.
  High-availability: 5-node Raft cluster, 3 voter nodes + 2 non-voters for read scaling.
  Multi-region (if context.multi_region): performance replication (Vault Enterprise) or
    independent regional clusters with cross-region secret sync via External Secrets Operator.
  HSM integration (if context.hsm_available and compliance includes fips_140_2):
    PKCS#11 seal for HashiCorp Vault, CloudHSM for AWS, Azure Dedicated HSM.
  Authentication method per environment:
    k8s:         Vault Kubernetes auth method (service account JWT validation).
    ecs:         AWS IAM auth method (task role ARN binding).
    serverless:  AWS IAM auth (Lambda execution role) or JWT/OIDC (GitHub Actions OIDC for CI).
    vm:          AppRole (machine-identity) or AWS/GCP/Azure metadata auth.
  Namespaces (Vault Enterprise) or separate clusters (OSS) for environment isolation:
    prod namespace, staging namespace, dev namespace, infra namespace.
  Output: vault_architecture { topology, node_count, auth_methods[], seal_type, namespaces[] }

Step 3 — Configure secret engines per secret type
  database_credential:  Vault Database secrets engine; dynamic credentials with TTL (default: 1h).
    Supported: PostgreSQL (pg_temp role), MySQL (CREATE USER), MongoDB (createUser),
               Oracle (CREATE USER), Redis (ACL SETUSER), Elasticsearch (xpack.security.user).
    Dual-user rotation: vault-app-role-a and vault-app-role-b, rotated alternately.
  api_key:              KV v2 engine; versioned storage; lease-based renewal.
  tls_certificate:      Vault PKI engine (see Step 6 for PKI design).
  ssh_key:              Vault SSH secrets engine (CA mode: signed certificates with TTL ≤ 24h).
  oauth_client_secret:  KV v2 with automated rotation via Vault Agent Template + webhook notification.
  encryption_key:       Vault Transit engine (AES-256-GCM96, ChaCha20-Poly1305);
                        never export key material — use Encrypt/Decrypt API endpoints.
  service_account_key:  Flag for replacement with workload identity (Step 5);
                        if unavoidable: KV v2 with 24h max TTL dynamic generation via custom plugin.
  Output: dynamic_secrets_config[], kv_engine_config[]

Step 4 — Design rotation policies
  For each secret type and rotation_policy input:
    automated:      Vault Agent lease renewal (before TTL expiry), External Secrets Operator
                    refresh interval, AWS Secrets Manager rotation Lambda function,
                    GCP Secret Manager rotation notification → Cloud Function.
    semi_automated: Vault CLI rotation script (hint only, not executable), operator-triggered
                    with automated propagation via Vault Agent template re-render.
    manual:         Documented runbook: new secret → propagate → verify → revoke old.
  Zero-downtime database rotation:
    Step A: Create new credential (vault-cred-b) alongside existing (vault-cred-a).
    Step B: Update application configuration via Vault Agent template; rolling restart.
    Step C: Verify application healthy on new credential.
    Step D: Revoke old credential (vault-cred-a) after drain period (default: 5 minutes).
  Rotation schedule enforcement: Vault lease duration acts as enforcement mechanism;
    expired leases force re-authentication and new secret issuance.
  Output: rotation_policies[]

Step 5 — Design workload identity (SPIFFE/SPIRE)
  If environment is k8s and any service_account_key in inventory:
    Replace with SPIFFE/SPIRE workload identity:
    SPIRE Server: Kubernetes StatefulSet (3 replicas), HA datastore (PostgreSQL backend).
    SPIRE Agent: DaemonSet with k8s_sat attestation plugin (Service Account Token projection).
    SVID issuance: X.509 SVID (spiffe://trust-domain/ns/namespace/sa/service-account).
    Rotation: automatic, TTL default 1h, renewed 5 minutes before expiry.
    Istio integration: Citadel → SPIRE delegation via SDS API if service_mesh is enabled.
    AWS IRSA (EKS): IAM Roles for Service Accounts as alternative to SPIRE for AWS API access.
  Output: workload_identity_design { framework, spire_topology?, irsa_config? }

Step 6 — Design PKI infrastructure
  If tls_certificate in secret_inventory or mTLS required:
    Root CA: offline (air-gapped), 4096-bit RSA or P-384 ECDSA, validity 10 years, HSM-backed if available.
    Intermediate CA: Vault PKI engine-managed, online, 2048-bit RSA or P-256 ECDSA, validity 2 years.
    Leaf certificates: issued by Intermediate CA, validity ≤ 90 days (cert-manager ACME for public TLS,
      Vault PKI engine for internal service-to-service mTLS).
    CRL/OCSP: Vault PKI engine CRL distribution point; OCSP responder URL in certificate.
    cert-manager integration: ClusterIssuer with Vault issuer type; Certificate CRD with renewBefore: 24h.
    Public TLS: Let's Encrypt (ACME HTTP-01 for public, DNS-01 for wildcard) via cert-manager.
  Output: pki_design { root_ca, intermediate_ca, leaf_cert_policy, cert_manager_config }

Step 7 — Design injection patterns per environment
  k8s + hashicorp vault:
    Vault Agent Sidecar Injector (annotation-based): vault.hashicorp.com/agent-inject: "true".
      Secrets written to /vault/secrets/<secret-name> as tmpfs; not environment variables.
    External Secrets Operator: SecretStore CRD → K8s Secret sync (refresh: 1h).
    CSI Secrets Store Driver: SecretProviderClass → volume mount at /mnt/secrets-store.
  k8s + aws_sm / gcp_sm / azure_kv:
    External Secrets Operator with provider-specific SecretStore.
  ecs:
    ECS Task definition: secrets referencing SSM Parameter Store SecureString or Secrets Manager ARN.
    IAM Task Role with GetSecretValue / GetParameter permissions (least-privilege resource ARNs).
  serverless:
    Lambda: SSM Parameter Store (GetParameter API call at cold start, cached in-memory).
    GCP Cloud Functions: Secret Manager accessor via SDK, loaded at initialization.
    Azure Functions: Key Vault reference in app settings (@Microsoft.KeyVault(SecretUri=...)).
  vm:
    Vault Agent in auto-auth mode (AppRole or cloud metadata auth); template rendering to files.
    Never: environment variable injection from CI/CD pipeline secrets (process listing risk).
  Risk ratings: tmpfs file mount (low), K8s volume (medium), env var (high), hardcoded (critical).
  Output: injection_patterns[]

Step 8 — Design audit and governance configuration
  Vault audit devices: file audit device (/var/log/vault/audit.log) + syslog forwarding to SIEM.
  Audit log content: all authenticated requests, secret access, rotation events, policy changes.
  AWS Secrets Manager: CloudTrail logging for GetSecretValue, RotateSecret, DeleteSecret.
  GCP Secret Manager: Cloud Audit Logs (Data Access: DATA_READ for AccessSecretVersion).
  Azure Key Vault: Diagnostic settings → Log Analytics workspace (AuditEvent category).
  Immutable audit trail: ship to S3 with Object Lock (Compliance mode, 7-year retention for PCI/SOX).
  Alerting: SIEM rules for: secret access by unknown entity, bulk secret enumeration,
            failed authentication spike (> 10 failures/minute), rotation failure.
  Output: audit_config { devices[], retention_policy, alerting_rules[], immutable_sink }

Step 9 — Identify and prioritize remediation items
  From Step 1 classified_inventory and current_storage analysis:
    P0 (Immediate): hardcoded secrets in source code (grep patterns: password=, api_key=, secret=).
    P0 (Immediate): plaintext secrets committed to Git (detect with git-secrets, truffleHog, gitleaks).
    P1 (High):      long-lived service account keys not replaced with workload identity.
    P1 (High):      secrets stored in Kubernetes Secrets without encryption-at-rest (etcd encryption).
    P2 (Medium):    secrets without defined rotation schedule.
    P3 (Low):       env var injection where file mount pattern is available.
  Output: remediation_items[]
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `vault_architecture` | `object` | Topology, node count, auth methods, seal type, namespaces |
| `rotation_policies` | `array` | Per secret type: policy, automation mechanism, zero-downtime procedure |
| `pki_design` | `object` | Root/Intermediate CA config, leaf cert policy, cert-manager integration |
| `dynamic_secrets_config` | `array` | Vault secret engine configs per secret type with TTL and role definitions |
| `injection_patterns` | `array` | Per service: injection pattern, tool, risk_rating, configuration reference |
| `audit_config` | `object` | Audit devices, retention policy, alerting rules, immutable sink configuration |
| `remediation_items` | `array` | Hardcoded/insecure secrets found with priority, severity, and fix guidance |
| `metrics` | `object` | Execution metrics: tokens_in, tokens_out, duration_ms, items_produced, version |
| `feedback` | `array` | Backpropagation and informational feedback entries |

**Output Schema:**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "vault_architecture": {
      "type": "object",
      "properties": {
        "platform":       { "type": "string" },
        "topology":       { "type": "string", "enum": ["single_cluster","ha_cluster","multi_region","federated"] },
        "node_count":     { "type": "integer" },
        "auth_methods":   { "type": "array" },
        "seal_type":      { "type": "string" },
        "namespaces":     { "type": "array" }
      },
      "required": ["platform","topology","auth_methods"]
    },
    "rotation_policies": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "secret_type":         { "type": "string" },
          "rotation_frequency":  { "type": "string" },
          "automation_mechanism":{ "type": "string" },
          "zero_downtime_steps": { "type": "array", "items": { "type": "string" } },
          "runbook_hint":        { "type": "string" }
        },
        "required": ["secret_type","rotation_frequency","automation_mechanism"]
      }
    },
    "pki_design": {
      "type": "object",
      "properties": {
        "root_ca":            { "type": "object" },
        "intermediate_ca":    { "type": "object" },
        "leaf_cert_policy":   { "type": "object" },
        "cert_manager_config":{ "type": "string" }
      }
    },
    "dynamic_secrets_config": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "secret_type":     { "type": "string" },
          "engine_type":     { "type": "string" },
          "engine_path":     { "type": "string" },
          "ttl_s":           { "type": "integer" },
          "max_ttl_s":       { "type": "integer" },
          "role_definition": { "type": "string" }
        },
        "required": ["secret_type","engine_type","ttl_s"]
      }
    },
    "injection_patterns": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "consumer_service":  { "type": "string" },
          "pattern":           { "type": "string", "enum": ["vault_agent_sidecar","external_secrets_operator","csi_driver","ecs_secrets","ssm_parameter","lambda_sdk","app_settings_keyvault_ref","env_var_vault_agent"] },
          "risk_rating":       { "type": "string", "enum": ["low","medium","high","critical"] },
          "config_reference":  { "type": "string" }
        },
        "required": ["consumer_service","pattern","risk_rating"]
      }
    },
    "audit_config": {
      "type": "object",
      "properties": {
        "devices":         { "type": "array" },
        "retention_policy":{ "type": "object" },
        "alerting_rules":  { "type": "array" },
        "immutable_sink":  { "type": "object" }
      },
      "required": ["devices","alerting_rules"]
    },
    "remediation_items": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "issue":       { "type": "string" },
          "severity":    { "type": "string", "enum": ["critical","high","medium","low"] },
          "priority":    { "type": "string", "enum": ["P0","P1","P2","P3"] },
          "guidance":    { "type": "string" },
          "secret_name": { "type": "string" }
        },
        "required": ["issue","severity","priority","guidance"]
      }
    },
    "metrics": {
      "type": "object",
      "properties": {
        "tokens_in":      { "type": "integer" },
        "tokens_out":     { "type": "integer" },
        "duration_ms":    { "type": "integer" },
        "items_produced": { "type": "integer" },
        "version":        { "type": "string" }
      },
      "required": ["tokens_in","tokens_out","duration_ms","items_produced","version"]
    },
    "feedback": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "type":        { "type": "string", "enum": ["backpropagate","info","warning"] },
          "from_skill":  { "type": "string" },
          "target_skill":{ "type": "string" },
          "reason":      { "type": "string" },
          "evidence":    { "type": "object" }
        },
        "required": ["type","from_skill","reason"]
      }
    }
  },
  "required": ["vault_architecture","rotation_policies","pki_design","dynamic_secrets_config","injection_patterns","audit_config","remediation_items","metrics","feedback"]
}
```

## Rules & Constraints

- Any secret with `current_storage: hardcoded` MUST generate a P0 remediation item; the skill MUST NOT produce a complete output without flagging it.
- Vault Transit engine MUST be recommended for encryption operations — key material MUST NOT be exported for application-side encryption when Vault is available.
- Database credentials MUST use dynamic secrets (Vault Database engine) when `vault_platform: hashicorp`; static long-lived database passwords are flagged as P1 remediation items.
- All injection pattern recommendations MUST rate `env_var` injection as `risk_rating: high` — environment variable injection exposes secrets via process listing and `/proc/PID/environ`.
- `rotation_policies` MUST cover every distinct `secret_type` in the `secret_inventory`; uncovered types are flagged as `ROTATION_UNDEFINED`.
- FIPS 140-2 compliance (`compliance_requirements` includes `fips_140_2`) MUST trigger HSM-backed seal recommendation and FIPS-validated algorithm selection (AES-256, P-384, SHA-384).
- The skill MUST NOT generate actual secret values, keys, or certificates — only design specifications and configuration templates.

## Security Considerations

- The `secret_inventory` input may itself contain sensitive metadata about production secrets; it MUST be treated as confidential and not logged or persisted beyond the execution context.
- Remediation item guidance MUST describe the fix approach without generating ready-to-use exploit scripts for accessing improperly stored secrets.
- Vault AppRole `secret_id` delivery is a sensitive bootstrapping problem; the skill MUST recommend Response Wrapping (one-time-use wrapped secret_id) for AppRole secret_id delivery — never plaintext delivery.
- Audit logs containing secret access events MUST be shipped to an immutable, tamper-evident store (S3 Object Lock, CloudTrail with CloudWatch Logs); mutable audit logs do not satisfy PCI DSS Requirement 10.
- PKI root CA MUST be kept offline (air-gapped) after initial intermediate CA signing; the skill MUST flag any topology where the root CA is network-accessible as a critical security risk.

## Token Optimization

- Compress `secret_inventory` input to `secret_type + consumer_service + current_storage` for vault architecture design; expand full inventory only for remediation_items step.
- `pki_design` cert-manager config: return as compact YAML skeleton (< 30 lines) referencing placeholder values; omit detailed X.509 extension lists.
- `rotation_policies` zero-downtime steps: return as numbered list (max 6 steps); defer full runbook to `documentation-generator`.
- `audit_config` alerting rules: return rule descriptions as strings; omit SIEM query syntax (Splunk SPL, Sigma rules) unless `context.siem_platform` is specified.

## Quality Checklist

- [ ] All hardcoded secrets (current_storage: hardcoded) generate P0 remediation items
- [ ] Dynamic secrets configured for all database_credential types
- [ ] Vault Transit engine recommended for all encryption_key types
- [ ] Rotation policy defined for every distinct secret_type in inventory
- [ ] All env_var injection patterns rated as risk_rating: high
- [ ] FIPS 140-2 triggers HSM-backed seal and validated algorithm selection
- [ ] PKI design includes offline root CA and Vault-managed intermediate CA
- [ ] Audit config includes immutable log sink and minimum 4 alerting rules

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| `secret_inventory` is empty | Reject: `{"error": "EMPTY_INVENTORY", "detail": "At least one secret entry is required"}` |
| All secrets have `current_storage: vault` | Proceed; produce optimization and hardening recommendations; note no P0 remediations required |
| `vault_platform: hashicorp` with no K8s environment | Recommend VM-mode Vault Agent; skip Kubernetes auth method |
| `compliance_requirements` includes `fips_140_2` but `context.hsm_available: false` | Flag HSM as required for FIPS compliance; produce non-HSM design as interim; emit P1 remediation |
| `context.multi_region: true` but `vault_platform` is not `hashicorp` | Use provider-native replication (AWS SM multi-region replication, GCP SM replicated secrets); note limitation |

## 12. Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Behavior |
|------|---------|---------|----------|
| P0 hardcoded secret remediation | Any `remediation_items[].priority == "P0"` | 3600s | Pause; present all P0 items to security lead and service owner; require acknowledgement and remediation timeline commitment |
| Root CA topology approval | PKI design includes online root CA or network-accessible root CA | 3600s | Block PKI design finalization; require security architect sign-off on root CA network exposure justification |
| Compliance gap acknowledgement | FIPS 140-2 required but HSM unavailable | 7200s | Present compliance gap to CISO/compliance officer; require written acknowledgement of interim risk acceptance |

## 13. Skill Composition

`secrets-management-architect` runs after `architecture-design` and feeds into `deployment-strategy` and `container-orchestration-architect`:

```yaml
composes:
  - skill: secrets-management-architect
    version: "^1.0.0"
    input_map:
      secret_inventory: "session.secret_inventory"
      vault_platform: "session.vault_platform"
      environment: "session.deployment_environment"
      compliance_requirements: "session.compliance_frameworks"
      rotation_policy: "session.rotation_strategy"
    output_map:
      vault_architecture: "state.secrets_spec.vault"
      injection_patterns: "state.secrets_spec.injection"
      rotation_policies: "state.secrets_spec.rotation"
      remediation_items: "state.secrets_spec.remediations"
      pki_design: "state.secrets_spec.pki"
```

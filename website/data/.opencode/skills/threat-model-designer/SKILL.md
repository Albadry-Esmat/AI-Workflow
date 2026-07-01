---
name: threat-model-designer
version: 1.0.0
domain: security
description: >
  Use when creating a structured threat model before code is written, mapping threats per component using STRIDE/PASTA/LINDDUN, scoring risks with DREAD, or generating security user stories with acceptance criteria. Triggers on: "threat model", "STRIDE analysis", "DREAD scoring", "security user stories", "MITRE ATT&CK mapping", "trust boundary analysis". Do NOT use for post-implementation vulnerability scanning — use security-review for that.
author: system
---

## Purpose

Produce structured, methodology-driven threat models that identify and quantify security threats for a system before implementation begins. This skill operates at the design phase — it proactively surfaces threats to inform secure-by-design architecture decisions rather than reactively patching discovered vulnerabilities. It supports three complementary methodologies: STRIDE (Microsoft — Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege, ideal for component-by-component analysis), PASTA (Process for Attack Simulation and Threat Analysis — 7-stage risk-centric methodology focused on attack simulation and business impact, ideal for risk-prioritized enterprise threat modelling), and LINDDUN (Linkability, Identifiability, Non-repudiation, Detectability, Disclosure of information, Unawareness, Non-compliance — specialized for privacy threat modelling under GDPR, HIPAA, and CCPA).

For each component and data flow in the architecture, the skill systematically identifies threats, rates them using the DREAD scoring model (Damage potential, Reproducibility, Exploitability, Affected users, Discoverability — each scored 1-10, averaged to a total severity score), and generates actionable countermeasures. All countermeasures are dual-mapped: to MITRE ATT&CK techniques (Tactics, Techniques, Sub-techniques in the Enterprise, Cloud, and ICS matrices) and to NIST SP 800-53 Rev 5 security controls (control family, control identifier, implementation guidance). This dual mapping ensures threat model findings translate directly to compliance evidence and red team playbooks.

The skill generates security user stories with Gherkin-format acceptance criteria for each identified threat, making the output actionable for development teams working in agile sprints. The final threat model document is produced in Markdown format, structured for security review board presentations, and ready for import into threat modelling tools (OWASP Threat Dragon, IriusRisk, Microsoft Threat Modeling Tool). The skill is strictly a design-time tool — it operates on architecture inputs, not on deployed systems or running code.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `architecture` | `object` | Yes | System architecture: components[], data_flows[], trust_boundaries[], external_entities[] |
| `methodology` | `string` | No | Threat modelling methodology: `stride`, `pasta`, `linddun`, or `combined`. Defaults to `stride` |
| `asset_classification` | `array` | No | Assets and their sensitivity: asset name, sensitivity level (public/internal/confidential/restricted) |
| `compliance_frameworks` | `array` | No | Applicable compliance: `pci_dss`, `hipaa`, `gdpr`, `sox`, `iso27001`, `fedramp` |
| `context` | `object` | No | Additional context: business context, attacker profiles, previous incidents |

**Input Schema:**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "architecture": {
      "type": "object",
      "properties": {
        "components": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "name":        { "type": "string" },
              "type":        { "type": "string", "enum": ["service","database","queue","ui","api_gateway","external_system","identity_provider"] },
              "description": { "type": "string" }
            },
            "required": ["name","type"]
          }
        },
        "data_flows": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "from":      { "type": "string" },
              "to":        { "type": "string" },
              "protocol":  { "type": "string" },
              "data_type": { "type": "string" },
              "encrypted": { "type": "boolean" }
            },
            "required": ["from","to","protocol"]
          }
        },
        "trust_boundaries": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "boundary_name": { "type": "string" },
              "components":    { "type": "array", "items": { "type": "string" } }
            },
            "required": ["boundary_name","components"]
          }
        }
      },
      "required": ["components","data_flows"]
    },
    "methodology": { "type": "string", "enum": ["stride","pasta","linddun","combined"], "default": "stride" },
    "asset_classification": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "asset":       { "type": "string" },
          "sensitivity": { "type": "string", "enum": ["public","internal","confidential","restricted"] }
        },
        "required": ["asset","sensitivity"]
      }
    },
    "compliance_frameworks": {
      "type": "array",
      "items": { "type": "string", "enum": ["pci_dss","hipaa","gdpr","sox","iso27001","fedramp"] }
    },
    "context": {
      "type": "object",
      "properties": {
        "business_context":  { "type": "string" },
        "attacker_profiles": { "type": "array", "items": { "type": "string" } },
        "previous_incidents":{ "type": "array" }
      }
    }
  },
  "required": ["architecture"]
}
```

## Required Context

- Architecture with components and data flows (mandatory); trust_boundaries strongly recommended for accurate scope
- Asset classification enables DREAD "Affected users" and "Damage potential" scoring accuracy
- Compliance frameworks focus the countermeasure mapping on relevant NIST SP 800-53 control families and regulatory-specific controls
- Attacker profiles from `context.attacker_profiles` (e.g., "nation-state", "opportunistic_cybercriminal", "malicious_insider") calibrate Exploitability and Discoverability DREAD scores
- Previous incidents from `context.previous_incidents` inform Reproducibility scoring

## Execution Logic

```
Step 1 — Validate architecture input and build DFD
  Parse architecture.components, data_flows, and trust_boundaries.
  Construct Data Flow Diagram (DFD) Level 1 in Mermaid flowchart syntax.
  Verify: all data_flow endpoints reference defined components.
  Flag: unencrypted data flows crossing trust boundaries as automatic high-risk.
  Flag: external entities with no trust boundary defined.
  Output: validated_dfd { mermaid_diagram, unencrypted_cross_boundary_flows[], undefined_boundaries[] }

Step 2 — Identify and classify assets
  For each component and data flow, identify data assets handled.
  Apply asset_classification sensitivity levels if provided; default unclassified to `internal`.
  Map restricted/confidential assets to data flows for targeted threat analysis.
  Output: asset_map { component → assets[], data_flow → asset_sensitivity }

Step 3 — Apply STRIDE methodology (if methodology includes stride)
  For each component, systematically evaluate all 6 STRIDE categories:
    Spoofing:             Can an attacker impersonate this component or its users?
    Tampering:            Can data entering/leaving this component be modified in transit or at rest?
    Repudiation:          Can actions performed through this component be denied without audit evidence?
    Information Disclosure: Can sensitive data be exposed through this component (leakage, inference)?
    Denial of Service:    Can this component be made unavailable, degrading or blocking the system?
    Elevation of Privilege: Can an actor gain permissions beyond what they are authorized for?
  For each identified threat: assign threat_id (THREAT-XXXX), describe the attack scenario.
  Output: stride_threats[]

Step 4 — Apply PASTA methodology (if methodology includes pasta)
  Stage 1: Define business objectives at risk.
  Stage 2: Define the technical scope (components in scope for this threat model iteration).
  Stage 3: Decompose the application (entry points, exit points, trust boundaries, data elements).
  Stage 4: Analyze threats (enumerate threat agents, threat capabilities, threat events).
  Stage 5: Identify vulnerabilities (map to STRIDE findings and known vulnerability patterns).
  Stage 6: Enumerate attacks (attack trees for top-5 highest-impact scenarios).
  Stage 7: Risk/impact analysis (map attack success to business impact scenarios).
  Output: pasta_analysis { attack_trees[], business_impact_map[] }

Step 5 — Apply LINDDUN methodology (if methodology includes linddun or compliance includes gdpr/hipaa)
  For each data flow involving personal data:
    Linkability: Can data from different contexts be linked to identify an individual?
    Identifiability: Can an individual be identified from the data processed?
    Non-repudiation: Can individuals be held accountable for actions against their interest?
    Detectability: Can an attacker determine whether data about an individual exists?
    Disclosure of Information: Can personal data be exposed to unauthorized parties?
    Unawareness: Are individuals unaware of data collection, processing, or sharing?
    Non-compliance: Does the processing violate applicable privacy regulations?
  Output: linddun_threats[]

Step 6 — Score all threats with DREAD model
  For each threat (stride, pasta, linddun combined):
    D — Damage potential (1-10): what is the worst-case business/security impact?
    R — Reproducibility (1-10): how easy is it to reproduce the attack consistently?
    E — Exploitability (1-10): how much skill, tools, or access is required to exploit?
    A — Affected users (1-10): what fraction of users or business functions are impacted?
    D — Discoverability (1-10): how easy is it to discover the vulnerability?
    dread_score = (D+R+E+A+D) / 5. Risk tier: Critical ≥ 8, High ≥ 6, Medium ≥ 4, Low < 4.
  Output: scored_threats[] with dread_score and risk_tier

Step 7 — Map to MITRE ATT&CK and NIST SP 800-53
  For each threat, identify the most relevant ATT&CK technique(s):
    Enterprise matrix for web/cloud services, ICS matrix for embedded/industrial.
    Map to Tactic → Technique → Sub-technique (e.g., TA0001 Initial Access → T1190 Exploit Public-Facing Application).
  Map countermeasures to NIST SP 800-53 Rev 5 controls:
    Spoofing → IA (Identification and Authentication), SC-8 (Transmission Confidentiality).
    Tampering → SI-7 (Software, Firmware, and Information Integrity), SC-28.
    Repudiation → AU (Audit and Accountability) family.
    Info Disclosure → SC (System and Communications Protection), AC-4 (Information Flow Enforcement).
    DoS → SC-5 (Denial of Service Protection), CP (Contingency Planning).
    Privilege Escalation → AC (Access Control), CM-7 (Least Functionality).
  Output: mitre_mappings[], nist_controls[]

Step 8 — Generate countermeasures
  For each threat: propose 1-3 specific, implementable countermeasures.
  Countermeasure types: preventive (stop the threat), detective (detect the threat), corrective (respond).
  Include technology-specific guidance: e.g., "Enforce mTLS using Istio PeerAuthentication STRICT mode",
    "Implement HMAC-SHA256 request signing on all API calls", "Enable CloudTrail with S3 Object Lock".
  Rate countermeasure effort: hours, days, weeks.
  Output: countermeasures[]

Step 9 — Generate security user stories
  For each threat with dread_score >= 4 (Medium and above):
    Story: "As a [threat actor], I want to [exploit scenario] so that I can [achieve goal]."
    Mirror security story: "As a [defender role], I need to [countermeasure] so that [threat] is prevented."
    Acceptance criteria in Gherkin format:
      Given [precondition], When [attack attempt], Then [expected security control behavior].
  Output: security_user_stories[]

Step 10 — Produce trust boundary analysis and attack surface map
  Trust boundary analysis: for each boundary, list crossing data flows, sensitivity, and threats.
  Attack surface map: entry points × protocols × authentication requirements × exposure level.
  Output: trust_boundary_analysis[], attack_surface_map

Step 11 — Produce threat model document
  Assemble full Markdown threat model document:
    Executive summary (scope, methodology, critical finding count, overall risk rating).
    DFD diagram (Mermaid).
    Threat catalog table (threat_id, component, STRIDE category, description, DREAD score, countermeasure).
    MITRE ATT&CK mapping table.
    Compliance control mapping (if compliance_frameworks provided).
    Security user stories (sprint-ready backlog items).
    Recommended next steps.
  Output: threat_model_doc (Markdown string)
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `threat_catalog` | `array` | All threats: threat_id, component, category, description, dread_score, risk_tier, countermeasure |
| `security_user_stories` | `array` | Sprint-ready security stories with Gherkin acceptance criteria |
| `trust_boundary_analysis` | `array` | Per-boundary: crossing flows, sensitivity levels, identified threats |
| `attack_surface_map` | `object` | Entry points, protocols, auth requirements, and exposure level per endpoint |
| `mitre_mappings` | `array` | Threat ID → ATT&CK Tactic, Technique, Sub-technique mappings |
| `risk_matrix` | `object` | 5×5 likelihood × impact grid with threat IDs positioned |
| `threat_model_doc` | `string` | Complete Markdown threat model document ready for review |
| `metrics` | `object` | Execution metrics: tokens_in, tokens_out, duration_ms, items_produced, version |
| `feedback` | `array` | Backpropagation and informational feedback entries |

**Output Schema:**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "threat_catalog": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "threat_id":      { "type": "string", "pattern": "^THREAT-\\d{4}$" },
          "component":      { "type": "string" },
          "category":       { "type": "string", "enum": ["spoofing","tampering","repudiation","info_disclosure","dos","privilege_escalation","linkability","identifiability","non_repudiation","detectability","unawareness","non_compliance"] },
          "description":    { "type": "string" },
          "dread_score":    { "type": "number", "minimum": 1, "maximum": 10 },
          "risk_tier":      { "type": "string", "enum": ["critical","high","medium","low"] },
          "countermeasure": { "type": "string" }
        },
        "required": ["threat_id","component","category","description","dread_score","risk_tier","countermeasure"]
      }
    },
    "security_user_stories": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "threat_id":           { "type": "string" },
          "story":               { "type": "string" },
          "acceptance_criteria": { "type": "array", "items": { "type": "string" } }
        },
        "required": ["threat_id","story","acceptance_criteria"]
      }
    },
    "trust_boundary_analysis": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "boundary":         { "type": "string" },
          "crossing_flows":   { "type": "array" },
          "max_sensitivity":  { "type": "string" },
          "threat_ids":       { "type": "array", "items": { "type": "string" } }
        },
        "required": ["boundary","crossing_flows"]
      }
    },
    "attack_surface_map": {
      "type": "object",
      "properties": {
        "entry_points":  { "type": "array" },
        "total_surface": { "type": "integer" }
      },
      "required": ["entry_points"]
    },
    "mitre_mappings": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "threat_id":       { "type": "string" },
          "tactic":          { "type": "string" },
          "technique_id":    { "type": "string" },
          "technique_name":  { "type": "string" },
          "sub_technique_id":{ "type": "string" }
        },
        "required": ["threat_id","tactic","technique_id","technique_name"]
      }
    },
    "risk_matrix": {
      "type": "object",
      "properties": {
        "critical": { "type": "array", "items": { "type": "string" } },
        "high":     { "type": "array", "items": { "type": "string" } },
        "medium":   { "type": "array", "items": { "type": "string" } },
        "low":      { "type": "array", "items": { "type": "string" } }
      }
    },
    "threat_model_doc": { "type": "string" },
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
  "required": ["threat_catalog","security_user_stories","trust_boundary_analysis","attack_surface_map","mitre_mappings","risk_matrix","threat_model_doc","metrics","feedback"]
}
```

## Rules & Constraints

- Every component in `architecture.components` MUST be analyzed for at least one STRIDE category; components with zero threats assigned are flagged as `ANALYSIS_SKIPPED` in feedback.
- Every threat in the catalog MUST have a non-empty `countermeasure` field; threats without countermeasures are incomplete and block output finalization.
- DREAD scores MUST be calculated from individual sub-scores (D, R, E, A, D each 1-10), not assigned as an aggregate guess.
- MITRE ATT&CK mappings MUST use the current version of the ATT&CK matrix; include the matrix version in `metrics`.
- All unencrypted data flows crossing trust boundaries are automatically assigned a minimum DREAD score of 6 (High) for the Information Disclosure category.
- LINDDUN analysis MUST be triggered automatically when `compliance_frameworks` includes `gdpr` or `hipaa`, regardless of the `methodology` field value.
- The skill MUST NOT execute or attempt to reproduce any described threats — it is an analytical, design-time skill only.

## Security Considerations

- Threat model output contains sensitive security architecture information; it MUST be treated as confidential and routed only to authorized security reviewers and the development team.
- Countermeasure descriptions MUST describe the control technique without exposing the exact exploit steps that would bypass it; threat descriptions should describe threat categories, not weaponized exploit code.
- MITRE ATT&CK technique names in output are for defensive mapping only; they MUST NOT be formatted as attacker playbooks or step-by-step exploitation guides.
- The threat model document MUST NOT include internal IP addresses, authentication credentials, API keys, or infrastructure-specific identifiers extracted from the input.
- When `context.previous_incidents` is provided, incident details MUST be anonymized in the output threat model document.

## Token Optimization

- Limit `threat_catalog` to top 30 threats by DREAD score if total exceeds 30; set `metrics.threats_truncated: true` with full count.
- Generate Mermaid DFD only at Level 1 (component-to-component); omit sub-process decomposition unless `context.detailed_dfd: true`.
- `threat_model_doc` Markdown: use a compact table format for the threat catalog section; omit acceptance criteria repetition (link to security_user_stories array instead).
- MITRE mappings: return primary technique only (not sub-techniques) unless `context.detailed_mitre: true`.

## Quality Checklist

- [ ] All architecture components have at least one STRIDE assessment entry
- [ ] Every threat has a non-empty countermeasure assigned
- [ ] DREAD scores computed from individual sub-scores, not estimated aggregates
- [ ] LINDDUN analysis triggered for GDPR/HIPAA workloads regardless of methodology setting
- [ ] MITRE ATT&CK mappings cover all critical and high DREAD threats
- [ ] Security user stories generated for all Medium+ DREAD threats
- [ ] Threat model doc includes DFD, executive summary, and compliance mapping if frameworks provided
- [ ] No weaponized exploit details, internal IPs, or credentials appear in any output field

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| `architecture.components` is empty | Reject: `{"error": "NO_COMPONENTS", "detail": "Architecture must include at least one component"}` |
| `architecture.data_flows` references undefined component names | Flag undefined endpoints in feedback; proceed with analysis for valid flows |
| `methodology: pasta` but no `context.business_context` | Proceed with STRIDE; emit backpropagate to request business context for PASTA stages 1-2 |
| > 50 components in architecture | Assess top-priority components (external-facing, restricted data handlers) first; set `partial_analysis: true` |
| No trust_boundaries defined | Infer boundaries: external_entity ↔ service = one boundary; service ↔ database = one boundary; emit warning |

## 12. Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Behavior |
|------|---------|---------|----------|
| Critical threat approval | Any `threat_catalog` entry with `risk_tier: critical` | 3600s | Pause; present all critical threats and proposed countermeasures to security lead for sign-off before threat model is finalized |
| Compliance framework review | `compliance_frameworks` includes `pci_dss` or `fedramp` | 7200s | Present compliance control mappings to compliance officer; require acknowledgement that all required controls are addressed |

## 13. Skill Composition

`threat-model-designer` runs after `architecture-design` and before `security-review`:

```yaml
composes:
  - skill: threat-model-designer
    version: "^1.0.0"
    input_map:
      architecture:
        components: "architecture.modules[*].{ name: name, type: workload_type }"
        data_flows: "architecture.data_flow[*]"
        trust_boundaries: "architecture.integration_points[*]"
      methodology: "session.threat_model_methodology"
      compliance_frameworks: "session.compliance_requirements"
    output_map:
      threat_catalog: "state.threat_model.catalog"
      security_user_stories: "state.threat_model.user_stories"
      threat_model_doc: "state.threat_model.document"
```

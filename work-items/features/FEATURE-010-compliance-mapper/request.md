# FEATURE-010 — Request: Compliance Mapper

**Origin:** Identified during ASE-OS enhancement analysis (2026-06-24).

---

## Problem Statement

`security-review` covers OWASP + STRIDE + CVSS vulnerability analysis, and `security-guard` enforces HIPAA/SOC2/PCI compliance gates at deployment time — but no skill exists that produces a **requirements-to-regulation traceability matrix**. Teams building regulated systems (fintech, healthcare, govtech) have no systematic way to determine which features satisfy which regulatory clauses until they fail an audit.

This means:
- Compliance obligations are invisible during design time
- Gaps between implemented features and regulatory requirements are only discovered at audit
- Teams cannot prioritise remediation work by regulatory severity
- New features that introduce regulatory obligations (e.g., storing PII) are not flagged at the point of design
- Audit preparation is a manual, error-prone, last-minute effort

## Requested Behaviour

When the system is building regulated applications, `compliance-mapper` should:

1. Accept structured requirements (from `requirement-analyzer`) and architecture (from `architecture-design`) alongside a list of target frameworks (GDPR, HIPAA, PCI-DSS, SOC 2 Type II, ISO 27001)
2. Produce a **compliance traceability matrix**: for every regulatory clause in each selected framework, state which requirements satisfy it and which features implement those requirements
3. Identify **gaps**: clauses with zero implementing requirements
4. Detect **new obligations**: features that process sensitive data (PII, PHI, PCI) without a corresponding requirement covering the regulatory control
5. Produce a **compliance score** per framework (satisfied / partial / gap counts and percentage)
6. Generate an **evidence checklist** per framework suitable for presenting to an auditor

The output should be actionable: gaps classified as blocking/major/minor with recommended remediation actions, and new obligations flagged for HITL approval before the pipeline continues.

## Scope

- `.opencode/skills/compliance-mapper/SKILL.md` — new skill (SKL-070)
- `skills/registry.json` — register new skill
- `skills/index.yaml` — add index entry

## Out of Scope

- Enforcement of compliance controls (that is `security-guard`'s responsibility)
- Penetration testing or runtime compliance validation
- Integration with external GRC (Governance, Risk, Compliance) tools
- Automatic remediation of identified gaps
- Legal advice or formal certification opinions

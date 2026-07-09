# Skills Registry — All Skills Catalog

**Version:** 5.4.0 | **Last updated:** 2026-07-09

The system uses a two-layer skill architecture. For the full lightweight index, see `skills/index.yaml`. For rich knowledge documentation per skill, see `skills/knowledge/`. This file is the human-readable catalog layer.

## Two-Layer Architecture

| Layer | File(s) | Purpose |
|-------|---------|---------|
| Index | `skills/index.yaml` | Lightweight entries for all 109 skills — IDs, tags, dependencies, mastery levels |
| Knowledge | `skills/knowledge/<skill>.md` | Rich reference: principles, practices, anti-patterns, examples, source citations |
| Execution | `.opencode/skills/<name>/SKILL.md` | 13-section AI-executable specifications |

## Core Pipeline Skills

### 1. Requirement Analyzer

| Property | Value |
|----------|-------|
| Domain | `requirements` |
| File | `.opencode/skills/requirement-analyzer/SKILL.md` |
| Version | 1.2.0 |
| Purpose | Extract, normalize, and validate requirements from raw input |
| Consumes from | None (entry point) |
| Produces for | `architecture-design` |

**Key outputs:** `requirements`, `open_questions`, `assumptions`, `risks`

### 1b. Clarify (SKL-109)

| Property | Value |
|----------|-------|
| Domain | `requirements` |
| File | `.opencode/skills/clarify/SKILL.md` |
| Version | 1.0.0 |
| Purpose | Identify ambiguous requirements and resolve them via HITL before architecture begins |
| Consumes from | `requirement-analyzer` |
| Produces for | `architecture-design` |
| Auto-advance | Yes — if no ambiguities found, pipeline continues without interruption |
| CI bypass | `skip_clarify: true` |

**Key outputs:** `clarifications_needed`, `updated_requirements`, `questions`, `unresolved_items`

### 2. Architecture Design

| Property | Value |
|----------|-------|
| Domain | `architecture` |
| File | `.opencode/skills/architecture-design/SKILL.md` |
| Version | 1.3.0 |
| Purpose | Define modules, data flow, integration points, tech decisions |
| Consumes from | `requirement-analyzer` |
| Produces for | `feature-planning`, `security-review`, `documentation-generator` |

**Key outputs:** `modules`, `data_flow`, `integration_points`, `technical_decisions`

### 3. Feature Planning

| Property | Value |
|----------|-------|
| Domain | `planning` |
| File | `.opencode/skills/feature-planning/SKILL.md` |
| Version | 2.2.0 |
| Purpose | Break requirements into tasks, dependencies, roadmap |
| Consumes from | `architecture-design` |
| Produces for | `clean-code-review`, `testing-strategy` |

**Key outputs:** `tasks`, `dependency_map`, `phases`, `milestones`

### 4. Clean Code Review

| Property | Value |
|----------|-------|
| Domain | `review` |
| File | `.opencode/skills/clean-code-review/SKILL.md` |
| Version | 1.1.0 |
| Purpose | Validate code against SOLID and clean architecture |
| Consumes from | `feature-planning` |
| Produces for | `security-review`, `documentation-generator` |

**Key outputs:** `issues`, `complexity_report`, `improvements`, `summary`

### 5. Testing Strategy

| Property | Value |
|----------|-------|
| Domain | `testing` |
| File | `.opencode/skills/testing-strategy/SKILL.md` |
| Version | 2.0.0 |
| Purpose | Define test plan, edge cases, coverage, quality gates |
| Consumes from | `feature-planning` |
| Produces for | `deployment-strategy` |

**Key outputs:** `test_plan`, `test_cases`, `edge_cases`, `coverage_checklist`

## Domain Skills

### 6. Security Review

| Property | Value |
|----------|-------|
| Domain | `security` |
| File | `.opencode/skills/security-review/SKILL.md` |
| Version | 1.0.0 |
| Purpose | Threat modeling, vulnerability detection, remediation |
| Consumes from | `architecture-design`, `clean-code-review` |
| Produces for | None |

**Key outputs:** `vulnerabilities`, `threat_model`, `remediation`, `risks`

### 7. Deployment Strategy

| Property | Value |
|----------|-------|
| Domain | `deployment` |
| File | `.opencode/skills/deployment-strategy/SKILL.md` |
| Version | 1.1.0 |
| Purpose | Environment model, promotion, rollback, IaC scaffold, deployment approval request |
| Consumes from | `architecture-design`, `testing-strategy` |
| Produces for | None |

**Key outputs:** `environments`, `promotion_rules`, `rollback_criteria`, `feature_flags`, `deployment_approval_request`

> `deployment_approval_request` is a mandatory output. The pipeline halts after this skill and awaits explicit user approval before any deployment action occurs.

### 8. Documentation Generator

| Property | Value |
|----------|-------|
| Domain | `documentation` |
| File | `.opencode/skills/documentation-generator/SKILL.md` |
| Version | 1.0.0 |
| Purpose | Auto-generate API docs, ADRs, READMEs |
| Consumes from | `requirement-analyzer`, `architecture-design`, `clean-code-review` |
| Produces for | None |

**Key outputs:** `documents` (array of name, format, content)

## Meta Skills

### 9. Orchestrator

| Property | Value |
|----------|-------|
| Domain | `system` |
| File | `.opencode/skills/orchestrator/SKILL.md` |
| Version | 2.4.0 |
| Purpose | Execute pipeline, route artifacts, validate, manage HITL |
| Consumes from | Registry |
| Produces for | Pipeline result |

**Key outputs:** `pipeline_result`, `execution_log`, `session_context`, `gate_decisions`

### 10. Schema Validator

| Property | Value |
|----------|-------|
| Domain | `validation` |
| File | `.opencode/skills/schema-validator/SKILL.md` |
| Version | 1.0.0 |
| Purpose | Validate JSON data against JSON Schema |
| Consumes from | None (utility) |
| Produces for | None (utility) |

**Key outputs:** `valid`, `issues`, `metrics`

### 11. Documentation Maintainer

| Property | Value |
|----------|-------|
| Domain | `documentation` |
| File | `.opencode/skills/doc-maintainer/SKILL.md` |
| Version | 1.1.0 |
| Purpose | Autonomous engine that detects system changes and keeps `/docs` in sync |
| Consumes from | Change events (any domain) |
| Produces for | `/docs` files |

**Key outputs:** `decision_summary`, `action_type`, `files_affected`, `consistency_report`

### Orchestration Note

`doc-maintainer` is a **system maintenance skill** — it does not execute in the pipeline. It runs on change detection triggers. When any skill, agent, workflow, or configuration changes, the doc-maintainer inspects the impact and creates/updates the relevant `/docs` files.

## Skill Dependencies Graph

```
requirement-analyzer
        │
        ▼
architecture-design ◄──────────────┐
        │                          │ (feedback)
        ▼                          │
feature-planning                   │
        │                          │
        ├──────► clean-code-review ─┘
        │              │
        │              ├──► security-review
        │              └──► documentation-generator
        │
        └──────► testing-strategy ──► deployment-strategy
```

## Skill Interaction Rules

- Skills emit `feedback` entries to signal issues to upstream skills (see [Architecture](architecture.md#feedback-loops)).
- All skill versions follow semver. See [Versioning](versioning.md).
- Adding/changing a skill requires updating this file AND `changelog.md`.

## New Domain Skills (v2.0.0)

### 31. Frontend UI/UX Architect

| Property | Value |
|----------|-------|
| ID | SKL-031 |
| Domain | `design` |
| File | `.opencode/skills/frontend-ux-architect/SKILL.md` |
| Version | 1.0.0 |
| Purpose | Design screen structure, navigation, component contracts, accessibility, and token rules |
| Consumes from | `requirement-analyzer`, `architecture-design` |
| Produces for | `ui-ux-compliance-guard`, `implementation-completeness-auditor` |

**Key outputs:** `screens`, `navigation_map`, `component_contracts`, `accessibility_report`, `token_requirements`

### 32. Database Architect

| Property | Value |
|----------|-------|
| ID | SKL-032 |
| Domain | `database` |
| File | `.opencode/skills/database-architect/SKILL.md` |
| Version | 1.0.0 |
| Purpose | Design normalized schemas, ERDs, indexing strategies, audit logging, and migration plans |
| Consumes from | `requirement-analyzer`, `architecture-design` |
| Produces for | `database-guard`, `implementation-completeness-auditor` |

**Key outputs:** `entities`, `relationships`, `erd`, `indexes`, `migration_plan`, `security_annotations`, `violations`

### 33. Implementation Completeness Auditor

| Property | Value |
|----------|-------|
| ID | SKL-033 |
| Domain | `quality` |
| File | `.opencode/skills/implementation-completeness-auditor/SKILL.md` |
| Version | 1.0.0 |
| Purpose | Cross-check all requirements against code, tests, UI, DB, and docs; produce readiness score |
| Consumes from | `requirement-analyzer`, `feature-planning`, `code-generator`, `state-manager` |
| Produces for | `implementation-completeness-guard` |

**Key outputs:** `readiness_score` (0–100), `readiness_level`, `gap_summary`, `gaps`, `traceability_matrix`

## Guard Skills (v2.0.0)

Guard skills run as `validation_check` gates. A `block` verdict halts the pipeline immediately. See [Governance](governance.md#guard-skills-layer-2) for full details.

### 34. Database Guard

| Property | Value |
|----------|-------|
| ID | SKL-034 |
| Domain | `governance` |
| File | `.opencode/skills/database-guard/SKILL.md` |
| Version | 1.0.0 |
| Purpose | Block destructive migrations, missing FK indexes, unannotated PII, missing cascade rules |
| Consumes from | `database-architect` |
| Verdict | `pass` / `block` |

### 35. Performance Guard

| Property | Value |
|----------|-------|
| ID | SKL-035 |
| Domain | `governance` |
| File | `.opencode/skills/performance-guard/SKILL.md` |
| Version | 1.0.0 |
| Purpose | Block N+1 query patterns, missing query indexes, bulk operation anti-patterns |
| Consumes from | `architecture-design`, `clean-code-review` (code_map) |
| Verdict | `pass` / `block` |

### 36. UI/UX Compliance Guard

| Property | Value |
|----------|-------|
| ID | SKL-036 |
| Domain | `governance` |
| File | `.opencode/skills/ui-ux-compliance-guard/SKILL.md` |
| Version | 1.0.0 |
| Purpose | Block hardcoded colors, missing component states, prop violations, accessibility issues |
| Consumes from | `frontend-ux-architect` |
| Verdict | `pass` / `block` |

### 37. Implementation Completeness Guard

| Property | Value |
|----------|-------|
| ID | SKL-037 |
| Domain | `governance` |
| File | `.opencode/skills/implementation-completeness-guard/SKILL.md` |
| Version | 1.0.0 |
| Purpose | Block release when readiness score < threshold (default: 85) or critical requirements missing |
| Consumes from | `implementation-completeness-auditor` |
| Verdict | `pass` / `block` |

### 38. Design System Generator

| Property | Value |
|----------|-------|
| ID | SKL-038 |
| Domain | `design` |
| File | `.opencode/skills/design-system-generator/SKILL.md` |
| Version | 1.0.0 |
| Purpose | Generate design token files, component stubs, and Storybook configuration from UX architecture output |
| Consumes from | `frontend-ux-architect` |
| Produces for | `code-generator` |

**Key outputs:** design token files (`tokens.json`, `tailwind.config.js`), component stub files, Storybook config, component usage guide

### 39. SEO Optimizer

| Property | Value |
|----------|-------|
| ID | SKL-039 |
| Domain | `quality` |
| File | `.opencode/skills/seo-optimizer/SKILL.md` |
| Version | 1.0.0 |
| Purpose | Generate sitemap, robots.txt, JSON-LD structured data, Open Graph tags, and Core Web Vitals budget for public-facing web products |
| Consumes from | `architecture-design`, `code-generator` |
| Produces for | `deployment-strategy` |

**Key outputs:** `sitemap.xml`, `robots.txt`, JSON-LD markup, OG/Twitter meta tags, CWV budget spec, SEO compliance report

### 40. Prompt Normalizer

| Property | Value |
|----------|-------|
| ID | SKL-040 |
| Domain | `meta` |
| File | `.opencode/skills/prompt-normalizer/SKILL.md` |
| Version | 1.0.0 |
| Purpose | Extract structured intent from a raw user prompt before pipeline routing; produce a normalized routing-ready prompt or a single targeted clarification question |
| Consumes from | — (step 0, no upstream skill) |
| Produces for | `orchestrator` |

**Key outputs:** `intent_object`, `normalized_prompt`, `routing_decision` (confidence + suggested_pipeline), `clarification_request`, `action` (route_immediately / ask_clarification / request_pipeline_selection)

### 41. Security Guard

| Property | Value |
|----------|-------|
| ID | SKL-041 |
| Domain | `governance` |
| File | `.opencode/skills/security-guard/SKILL.md` |
| Version | 1.0.0 |
| Purpose | Binary pass/block gate that enforces CVSS severity thresholds, compliance framework minimums, and non-bypassable domain rules (prompt injection for AI, hardcoded credentials for IoT) |
| Consumes from | `security-review` |
| Verdict | `pass` / `block` |

**Non-bypassable blocks:** `prompt_injection_open` (ai_agent domain), `hardcoded_credentials` (embedded_iot domain)

### 42. CI Pipeline Generator

| Property | Value |
|----------|-------|
| ID | SKL-042 |
| Domain | `deployment` |
| File | `.opencode/skills/ci-pipeline-generator/SKILL.md` |
| Version | 1.0.0 |
| Purpose | Generate executable CI/CD files (GitHub Actions / GitLab CI YAML, Dockerfile, docker-compose.yml, .env.example, Kubernetes manifests) from deployment-strategy output; includes secret scan before any file write |
| Consumes from | `deployment-strategy`, `architecture-design` |
| Produces for | — (final artifact step) |

**Key outputs:** `artifacts` (array of written files), `detected_stack`, `ci_platform`, `validation_result`

### 43. AI Agent Specialist

| Property | Value |
|----------|-------|
| ID | SKL-043 |
| Domain | `domain-specialist` |
| File | `.opencode/skills/ai-agent-specialist/SKILL.md` |
| Version | 1.0.0 |
| Runs at | Phase 2c (domain specialist layer) |
| Purpose | Inject AI/agent-specific architecture patterns, prompt engineering standards, memory architecture, token budgets, evaluation frameworks, and AI safety controls when building LLM-powered applications, RAG pipelines, or multi-agent systems |
| Activation | `domain_context.domain_primary == "ai_agent"` |
| Consumes from | `requirement-analyzer`, `architecture-design` |
| Produces for | `architecture-design` (second pass), `testing-strategy`, `code-generator`, `security-guard` |

**Key output:** `domain_constraints` (agent_system_type, required_modules, safety_controls, eval_requirements, token_constraints)

### 44. Mobile Platform Specialist

| Property | Value |
|----------|-------|
| ID | SKL-044 |
| Domain | `domain-specialist` |
| File | `.opencode/skills/mobile-platform-specialist/SKILL.md` |
| Version | 1.0.0 |
| Runs at | Phase 2c (domain specialist layer) |
| Purpose | Inject technology stack selection (iOS/Android/RN/Flutter/MAUI), offline-first architecture, push notification design, App Store compliance requirements, mobile security controls, device matrix, and platform-specific UX constraints when building native or cross-platform mobile apps |
| Activation | `domain_context.domain_primary == "mobile"` |
| Consumes from | `requirement-analyzer`, `architecture-design` |
| Produces for | `architecture-design` (second pass), `frontend-ux-architect`, `testing-strategy`, `code-generator`, `security-guard` |
| Pipeline | `skills/pipelines/mobile-app.json` |

**Key output:** `domain_constraints` (technology_stack, offline_architecture, security_controls, app_store_requirements, device_matrix, performance_budgets)

### 45. SaaS & Enterprise Architect

| Property | Value |
|----------|-------|
| ID | SKL-045 |
| Domain | `domain-specialist` |
| File | `.opencode/skills/saas-enterprise-architect/SKILL.md` |
| Version | 1.0.0 |
| Runs at | Phase 2c (domain specialist layer) |
| Purpose | Inject multi-tenancy model selection, RBAC architecture, subscription billing design, enterprise SSO (SAML/OIDC/SCIM), compliance framework controls (SOC 2, ISO 27001, HIPAA, GDPR, PCI DSS, FedRAMP), white-labeling, and audit logging requirements when building a SaaS platform or B2B enterprise product |
| Activation | `domain_context.domain_primary == "saas"` or `"enterprise"` |
| Consumes from | `requirement-analyzer`, `architecture-design` |
| Produces for | `architecture-design` (second pass), `database-architect`, `testing-strategy`, `code-generator`, `security-guard` |
| Pipeline | `skills/pipelines/saas-platform.json` |

**Key output:** `domain_constraints` (tenancy_model, rbac_architecture, compliance_controls, audit_requirements, billing_architecture, sso_architecture)

### 46. Systems Specialist

| Property | Value |
|----------|-------|
| ID | SKL-046 |
| Domain | `domain-specialist` |
| File | `.opencode/skills/systems-specialist/SKILL.md` |
| Version | 1.0.0 |
| Runs at | Phase 2c (domain specialist layer) |
| Purpose | Inject embedded/IoT architecture patterns (bare-metal, RTOS, IoT edge/cloud), memory budget, HAL design, communication protocols (MQTT/CoAP/BLE/LoRaWAN/CAN), OTA firmware update architecture, safety standard controls (IEC 62443, ISO 26262, IEC 61508), and game development architecture (ECS, game loop, netcode) when building embedded systems, IoT platforms, or games |
| Activation | `domain_context.domain_primary == "embedded_iot"` or `"game"` |
| Consumes from | `requirement-analyzer`, `architecture-design` |
| Produces for | `architecture-design` (second pass), `testing-strategy`, `code-generator`, `security-guard` |
| Pipeline | `skills/pipelines/iot-embedded.json` |

**Key output:** `domain_constraints` (system_type, required_modules, memory_constraints, safety_controls, protocol_constraints, ota_requirements, game_constraints)

---

## Observability Pipeline Skills (v2.7.0)

### 47. Behavioral Telemetry Collector

| Property | Value |
|----------|-------|
| ID | SKL-047 |
| Domain | `system` |
| File | `.opencode/skills/behavioral-telemetry-collector/SKILL.md` |
| Version | 1.0.0 |
| Runs at | Async hook — `skill.completed`, `skill.failed`, `gate.passed`, `gate.blocked` events |
| Purpose | Collect anonymized, PII-scrubbed behavioral events from the skill pipeline. Opt-out gate is unconditional first step. Ring-buffer storage (500 events/session). Never collects user text, code, or credentials. |
| Consumes from | `observability` (event hook) |
| Produces for | `session-insights` (via `behavioral_telemetry.events` in state) |

**Key outputs:** `collected` (boolean), `events_written`, `total_events`
**Invariants:** opt-out exits immediately with no write; `pii_scrubbed: true` always set; timestamps generated internally

### 48. Session Insights

| Property | Value |
|----------|-------|
| ID | SKL-048 |
| Domain | `system` |
| File | `.opencode/skills/session-insights/SKILL.md` |
| Version | 1.0.0 |
| Runs at | Async — once at `pipeline.ended` |
| Purpose | Aggregate behavioral telemetry into per-skill performance metrics and session-level summary. Detects anomalies (failure rate > 30%, HITL rejection ratio > 30%). Read-only on events array. |
| Consumes from | `behavioral-telemetry-collector` (via `behavioral_telemetry.events`) |
| Produces for | `enhancement-dashboard` (via `behavioral_telemetry.session_summary`) |

**Key outputs:** `session_summary` (per-skill performance, HITL rates, anomaly flags), `skills_analyzed`, `anomaly_count`
**Invariants:** never modifies `behavioral_telemetry.events`; writes only `session_summary`; anomalies are warnings only — no pipeline halt

### 49. Enhancement Dashboard

| Property | Value |
|----------|-------|
| ID | SKL-049 |
| Domain | `system` |
| File | `.opencode/skills/enhancement-dashboard/SKILL.md` |
| Version | 1.0.0 |
| Runs at | On-demand or async after `session-insights` completes |
| Purpose | Read-only renderer. Converts `session_summary` into a structured Markdown + JSON report with 5 sections: header, session overview, per-skill performance table, anomalies, health verdict. |
| Consumes from | `session-insights` (via `behavioral_telemetry.session_summary`) |
| Produces for | — (user-facing output only) |

**Key outputs:** `markdown_report` (Markdown dashboard), `json_report` (session_summary verbatim), `sections_rendered`
**Invariants:** NEVER writes to system state; supports `render_format: markdown` (default) or `json_only`

---

## Enhanced Skills (v2.6.0)

### architecture-design → v1.3.0

- Added `domain_constraints` input field (from any phase-2c domain specialist)
- Added integration patterns reference table in Step 4 (11 patterns with when-to-use / avoid guidance)
- `domain_constraints.integration_patterns_required` overrides generic defaults

### database-architect → v1.1.0

- Added `domain_constraints` input field (from `saas-enterprise-architect`)
- Added Step 0: multi-tenant schema strategy (shared_db RLS policies, schema_per_tenant migration orchestration, db_per_tenant provisioning, hybrid promotion path)

### frontend-ux-architect → v1.1.0

- Added `domain_constraints` input field (from `mobile-platform-specialist`)
- Added Step 9: mobile-first layout constraints (iOS/Android navigation patterns, touch targets, safe areas, haptics), PWA capability checklist (Service Worker, manifest, install prompt, offline fallback), and browser compatibility matrix (Baseline 2023+)
- Old Step 9 (assemble) renumbered to Step 10

---

## Enhanced Skills (v2.7.0)

### pipeline-schema.json — Security Fixes

- **`if/then` constraint on gate timeout**: when `timeout: 0` is set, `bypass_on_timeout` is now enforced as `const: false` at schema validation time. Prevents a crafted gate from enabling deployment gate bypass while passing schema validation.
- **`minItems: 1` on top-level `gates` array**: an empty `gates: []` declaration is now a schema validation error. Previously a silent no-op.

### system-state-schema.json — Backward-Compatible Extension

- Added optional `behavioral_telemetry` object field (NOT in `required[]`). All 49 existing skill consumers unaffected — absence is valid.
- Added `"insights-pipeline"` to `pipeline_template` enum.
- Added `"insights-adaptation-pipeline"` to `pipeline_template` enum (v2.8.0). Enables sessions running the full SKL-047→SKL-051 chain to have a valid state schema.

---

## New Skills (v2.8.0) — Assisted Adaptation

### SKL-050 — Adaptive Proposal Generator

| Property | Value |
|----------|-------|
| **ID** | SKL-050 |
| **Domain** | system |
| **Version** | 1.0.0 |
| **Mastery** | advanced |
| **Executable** | `.opencode/skills/adaptive-proposal-generator/SKILL.md` |
| **Assigned to** | primary agent (orchestrated at session end) |

Analyzes `session_summary` from `session-insights` (SKL-048) and up to 10 historical session summaries to detect failure patterns, HITL rejection hotspots, capability gaps, and repeated skill sequences. Generates ranked `AdaptationProposal[]` objects (up to 5 by default) with titles, rationales, evidence, effort estimates, and confidence scores. All proposals have `hitl_status: pending` — **nothing is applied without explicit human approval**.

Five proposal types:
- `modify_skill` — skill failure rate > 30% or HITL rejection ratio ≥ 30%
- `new_skill` — recurring feedback loop gap across sessions
- `retire_skill` — zero invocations across ≥ 5 sessions with a documented replacement
- `new_pipeline` — 3+ skills always invoked together, no pipeline template covers the sequence
- `new_agent` — approved new skill with no assigned agent

**Key invariant:** All returned proposals have `hitl_status: "pending"` — enforced by output schema `enum: ["pending"]`.

---

### SKL-051 — Adaptation Applicator

| Property | Value |
|----------|-------|
| **ID** | SKL-051 |
| **Domain** | system |
| **Version** | 1.0.0 |
| **Mastery** | advanced |
| **Executable** | `.opencode/skills/adaptation-applicator/SKILL.md` |
| **Assigned to** | primary agent (after HITL gate) |

Applies a single HITL-approved `AdaptationProposal` to the live system. Enforces `hitl_status == "approved"` as the first and unconditional check. Creates a rollback checkpoint (registry + index + graph + opencode.json) before any write. Runs `validate-skills.sh` and `npm run build` after every change — if either fails, rolls back automatically and returns a failure report with the full output.

Five change handlers:
- `new_skill` — invokes `skill-authoring` (SKL-012) to draft SKILL.md, then registers in registry + index + graph
- `modify_skill` — updates existing SKILL.md, bumps version across registry/index/graph
- `retire_skill` — sets `status: deprecated` in registry, adds deprecation notice to SKILL.md
- `new_pipeline` — generates pipeline JSON, validates against pipeline schema
- `new_agent` — creates `.opencode/agent/<name>.md`, updates `opencode.json`

On success: triggers `doc-maintainer` (SKL-011) with a change event.
On failure: auto-rollback from checkpoint, returns `rollback_executed: true`.

**`dry_run: true`** simulates all changes and returns a diff — always safe to invoke.

---

## New Skills (v4.0.0) — Work Lifecycle Management Layer

### SKL-055 — Defect Manager

| Property | Value |
|----------|-------|
| **ID** | SKL-055 |
| **Domain** | lifecycle |
| **Version** | 1.0.0 |
| **Mastery** | advanced |
| **Executable** | `.opencode/skills/defect-manager/SKILL.md` |
| **Assigned to** | `analyzer` agent |

Receives defect reports from any source (test failure, security finding, code-repair escalation, human report) and manages the full defect lifecycle from intake to closure. For every bug: creates `BUG-NNNN`, generates the full 6-item companion chain (INVESTIGATION + FIX + TEST + REVIEW + VALIDATION + CLOSURE), links all items to originating requirement and implementation task, persists each item as a Markdown file in `work-items/`. For "missings" from implementation-completeness-auditor: generates a shorter 3-item chain (FIX + TEST + VALIDATION). HITL triage gate is mandatory for all bugs.

**Key outputs:** `bug_id`, `bug_record`, `chain_items`, `chain_item_ids`, `traceability_map`

**Events emitted:** `defect.created`, `work_item.state_changed`

**Pipeline:** `skills/pipelines/defect-lifecycle.json`

---

### SKL-056 — Change Request Manager

| Property | Value |
|----------|-------|
| **ID** | SKL-056 |
| **Domain** | lifecycle |
| **Version** | 1.0.0 |
| **Mastery** | advanced |
| **Executable** | `.opencode/skills/change-request-manager/SKILL.md` |
| **Assigned to** | `planner` agent |

Receives change requests (new requirement, modified requirement, scope change) and manages the full CR lifecycle from intake to planning. Runs impact analysis via `change-impact-analyzer`, presents HITL gate for approval, generates a task delta (new/modified/cancelled tasks), and backpropagates the approved delta to `feature-planning` for re-planning. Does NOT modify existing work items directly. HITL impact-approval gate is mandatory.

**Key outputs:** `cr_id`, `cr_record`, `impact_analysis`, `approval_result`, `task_delta`

**Events emitted:** `change_request.created`, `change_request.approved`, `work_item.state_changed`

**Pipeline:** `skills/pipelines/change-request.json`

---

### SKL-057 — Work Item Exporter

| Property | Value |
|----------|-------|
| **ID** | SKL-057 |
| **Domain** | integration |
| **Version** | 1.0.0 |
| **Mastery** | intermediate |
| **Executable** | `.opencode/skills/work-item-exporter/SKILL.md` |
| **Assigned to** | `builder` agent |

Transforms internal work item records from `work-items/` into export-ready formats. Primary output is Jira Bulk Import JSON. Secondary outputs: JSON Lines and Markdown summary table. Export is one-way outbound only (no status read-back). Runs as an async non-blocking final step at pipeline completion. Includes mandatory PII scrubbing before any file write.

**Key outputs:** `export_id`, `files_produced`, `items_exported`, `type_breakdown`, `manifest`

**Supported formats:** Jira Bulk Import JSON, JSON Lines, Markdown

**ADR:** [ADR-0002](adr/ADR-0002-work-item-export-contract.md)

---

### SKL-058 — Work Item Lifecycle Guard

| Property | Value |
|----------|-------|
| **ID** | SKL-058 |
| **Domain** | governance |
| **Version** | 1.0.0 |
| **Mastery** | intermediate |
| **Executable** | `.opencode/skills/work-item-lifecycle-guard/SKILL.md` |
| **Assigned to** | `reviewer` agent |

Enforces the work item lifecycle state machine from `docs/work-item-foundation.md §4`. Validates every proposed state transition before it is written. Returns `allow`, `warn`, or `block`. Terminal states (`closed`, `cancelled`, `rejected`) are always blocked. Initial deployment mode: `warning` (allows pipeline stabilization for first 2 weeks before switching to `block`). Pure rule evaluator — no file I/O or state reads required.

**Key outputs:** `verdict` (`allow`/`warn`/`block`), `reason`, `transition`

**Governance layer:** Layer 2 (Guard Skills)

**ADR:** [ADR-0001](adr/ADR-0001-work-lifecycle-persistence-model.md)

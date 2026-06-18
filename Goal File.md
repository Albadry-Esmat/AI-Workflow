# ASE-OS — AI Software Engineering Operating System
## Final Goal Specification

**Version:** 2.0.0
**Last updated:** 2026-06-17
**Status:** Active — Skill System v2.0.0 Complete (37 skills), Runtime Implementation Pending

---

## Overview

Design and implement a unified AI-driven software engineering operating system that runs inside agentic development environments (OpenCode, Claude Code, Codex, or equivalent). The system acts as an orchestration layer over software development, enabling autonomous yet controlled generation, maintenance, and evolution of full software products.

The system is structured, deterministic, and production-oriented, prioritizing **correctness**, **maintainability**, **security**, and **efficiency** over conversational flexibility.

---

## 1. Core Objective

Build an AI engineering system that:

- Designs software systems from requirements to architecture automatically
- Generates production-ready code incrementally and safely
- Maintains continuous synchronization between code, tests, documentation, and architecture decisions
- Enforces security, testing, and architectural standards by design — not as optional review
- Minimizes token usage through structured context management and reuse strategies
- Supports the full development lifecycle: **build → test → deploy → maintain → evolve**

---

## 2. System Design Philosophy

The system is founded on three non-negotiable principles:

### Principle 1 — Skill-Driven Execution

All operations are executed through reusable, composable **Skills** instead of ad-hoc prompting. Skills are deterministic capability units with defined inputs, outputs, and execution rules. No capability exists outside a skill.

### Principle 2 — Event-Driven Architecture

All changes in the system (code, architecture, tests, documentation) are treated as **events** that trigger controlled downstream updates automatically. Nothing propagates manually.

### Principle 3 — State-Centric Control

A single structured **system state** governs all operations, ensuring traceability, consistency, and recoverability across all agents and tasks at all times.

---

## 3. Core System Components

### 3.1 Orchestrator Engine

The central controller responsible for:

| Responsibility | Description |
|---|---|
| Intent interpretation | Translate user requests into pipeline plans |
| Skill selection | Match intent to the correct skill(s) via routing table |
| Execution scheduling | Sequence and parallelize skills per dependency graph |
| Token budget enforcement | Enforce per-operation token ceilings |
| State consistency | Read and write system state between every skill step |

### 3.2 Skill System (Primary Abstraction)

A **Skill** is a reusable, versioned execution unit that performs one defined engineering function.

**Skill examples:**

- Module creation
- Architecture design
- Code generation
- Refactoring
- Test generation
- Security auditing
- Documentation updates
- Context compression
- Dependency analysis

**Skill requirements:**

| Property | Requirement |
|---|---|
| Input/output schema | Defined and versioned JSON Schema |
| Preconditions | Explicit — skill rejects input that violates preconditions |
| Token budget | Hard ceiling per invocation |
| Dependencies | Declared — orchestrator validates before execution |
| Auto-trigger rules | Defined phrases and conditions for automatic selection |

**Skill behavior rules:**

- Can be manually triggered or automatically invoked via routing
- Can chain into downstream skills via orchestrator
- **Must be stateless** — reads/writes through system state only
- Must produce structured, schema-validated output artifacts

### 3.3 Minimal Multi-Agent Layer

The system uses the smallest viable set of specialized agents. All intelligence is embedded in skills — agents are thin executors.

| Agent | Role |
|---|---|
| **Orchestrator** | Controls execution flow, selects skills, approves HITL gates |
| **Architect** | System design and structural decisions |
| **Builder** | Incremental implementation |
| **Reviewer** | Validation, security, and architecture enforcement |
| **Tester** | Automated test generation and validation |
| **Documenter** | Continuous documentation generation |

> All capabilities beyond routing and delegation are embedded in skills, not agents. Agents do not contain business logic.

### 3.4 System State Model

A persistent, structured state governs the entire system. All agents and skills read and write through controlled diffs — never directly.

**State schema:**

```
system_state/
  project_spec          ← requirements, constraints, domain
  architecture          ← modules, boundaries, data flow, decisions
  dependency_graph      ← module + library dependency DAG
  task_graph            ← current execution plan with status per task
  code_map              ← file tree, module assignments, change history
  skill_registry        ← available skills, versions, statuses
  decision_log          ← Architecture Decision Records (ADRs)
  documentation_state   ← current doc coverage, last sync timestamp
  test_state            ← coverage targets, last run results, failures
  security_state        ← open findings, last audit, remediation status
```

**State access rules:**

- Only the orchestrator may write directly to system state
- Skills receive scoped state slices — not the full state
- Every write produces a diff entry with skill ID, timestamp, and reason
- State is serializable and restorable at any point

### 3.5 Event-Driven Execution Engine

Every change in the system generates a structured event. Events are the only mechanism by which downstream skills are triggered automatically.

**Event types:**

| Event | Triggered By | Auto-Invokes |
|---|---|---|
| `code.changed` | Builder agent writes code | Reviewer, Tester, Doc-updater |
| `architecture.updated` | Architect agent modifies modules | Feature planner, Doc-updater |
| `test.failed` | Test run returns failures | Builder (repair), Reviewer |
| `security.violation` | Security scan finds issue | Reviewer, Architect (if structural) |
| `documentation.drift` | Code changes without doc update | Documenter |

**Event schema:**

```json
{
  "event_id": "uuid",
  "type": "code.changed",
  "source_skill": "builder",
  "affected_artifacts": ["src/auth/service.ts"],
  "timestamp": "ISO8601",
  "diff": { "added": 42, "removed": 8 },
  "downstream_skills": ["clean-code-review", "testing-strategy", "doc-maintainer"]
}
```

### 3.6 Documentation System

Two synchronized documentation layers, both fully autonomous.

**Layer 1 — Developer Documentation:**

| Document | Content |
|---|---|
| Architecture overview | Module structure, boundaries, data flow |
| API references | All public interfaces, auto-generated from code |
| Design decisions | ADRs — generated on every architectural change |
| System workflows | Pipeline flows, skill sequences |
| Skill registry | All registered skills with trigger conditions |

**Layer 2 — End-User Documentation:**

| Document | Content |
|---|---|
| Feature usage guides | Generated from requirements and implementation |
| UI/UX explanations | Generated from component definitions |
| Onboarding flows | Generated from system entry points |
| Help center content | Generated from feature specs |

**Documentation rules:**

- Fully generated from system state and events — never manually maintained
- Always versioned and traceable to the code change that caused the update
- Documentation drift triggers an automatic `documentation.drift` event
- No documentation file may be out of sync with the system state for more than one pipeline cycle

### 3.7 Token Optimization Layer

Every layer of the system is designed to minimize token consumption without sacrificing correctness.

| Strategy | Description |
|---|---|
| Context compression | Semantic summaries replace full code in skill inputs |
| File-scoped loading | Skills receive only the files relevant to their task |
| Diff-based reasoning | Skills reason on diffs rather than full regeneration |
| Skill reuse | Existing validated output is reused before re-invoking a skill |
| Structured memory snapshots | Compressed state slices replace raw conversation history |
| Budget enforcement | Hard per-operation token ceilings — skills halt and compress at limit |

**Token budget tiers:**

| Operation Type | Max Tokens (in + out) |
|---|---|
| Single skill (quick) | 16K |
| Single skill (deep) | 32K |
| Partial pipeline (3–5 skills) | 64K |
| Full pipeline (6+ skills) | 128K |

### 3.8 Security and Quality Enforcement Layer

Security and quality are enforced automatically — they are not review steps, they are system invariants.

**Enforcement mechanisms:**

| Mechanism | Trigger | Skill |
|---|---|---|
| OWASP-based security validation | Every code change touching auth, data, or APIs | `security-review` |
| Input validation enforcement | Every new API endpoint or data handler | `security-review` |
| Role-based access design | Any permission or auth change | `architecture-design` |
| Architecture boundary enforcement | Any cross-module dependency change | `clean-code-review` |
| AI-based code review | Every implementation output | `clean-code-review` |
| Test coverage enforcement | Every code change | `testing-strategy` |
| Dependency safety checks | Every new dependency addition | `security-review` |

**Quality gates (non-bypassable):**

1. Output schema validation — every skill output must pass before passing downstream
2. Test coverage target — code cannot advance to deployment without meeting coverage thresholds
3. Security gate — critical or high vulnerabilities block deployment pipeline
4. Architecture consistency — orphan modules or violated boundaries block planning gate

### 3.9 Change Impact Analysis System

Before any modification is executed, the system automatically computes the full impact surface.

**Impact analysis outputs:**

| Dimension | What Is Computed |
|---|---|
| Affected modules | Which modules will change |
| API changes | Breaking vs. non-breaking interface changes |
| Test impact | Which test cases are invalidated |
| Documentation impact | Which doc sections require update |
| Security impact | Whether the change touches a security boundary |
| Dependency ripple | Downstream modules that consume changed interfaces |

**Execution rule:** Only the required downstream skills are invoked. Skills with no affected artifacts are skipped.

### 3.10 Recovery and Stability System

The system detects failures and recovers without human intervention where possible.

| Failure Type | Detection | Recovery |
|---|---|---|
| Build failure | Compilation error in Builder output | Auto-rollback to last stable state, diff-based repair suggestion |
| Test failure | Test run returns failures | Targeted repair pass on failed test's module |
| Security violation | Critical finding in security scan | Block pipeline, emit violation event, re-route to architect |
| Schema validation error | Skill output fails schema check | Retry skill up to 5x with corrected input |
| State inconsistency | Diff produces invalid state | State repair skill, consistency correction |

**Rollback protocol:**
1. Detect failure condition
2. Serialize current state with `status: "failed"`
3. Restore last `status: "stable"` state snapshot
4. Replay execution chain from failure point with repair input
5. If replay fails 3 times — halt and surface to human operator

---

## 4. Execution Lifecycle

Every request follows a strict, non-skippable lifecycle:

```
1. Intent Interpretation      → Orchestrator maps input to pipeline template
2. Planning                   → Task decomposition + dependency graph
3. Architecture Validation    → Verify request is consistent with existing architecture
4. Impact Analysis            → Compute affected modules, tests, docs, security
5. Skill Execution            → Builder + supporting skills execute per plan
6. Testing and Validation     → Tester agent validates all acceptance criteria
7. Security Enforcement       → Security review gates run automatically
8. Documentation Update       → Doc-maintainer syncs all affected documentation
9. State Persistence          → Orchestrator writes final state diff
10. Optimization              → Token cleanup, context compression, state pruning
```

No step may be skipped. Steps 6–8 are non-bypassable quality gates.

---

## 5. Product System Separation

The system enforces strict separation between three layers:

```
┌─────────────────────────────────────────────────────┐
│  PRODUCT LAYER                                      │
│  End-user applications, UI, APIs                   │
│  No direct dependency on AI engine internals       │
├─────────────────────────────────────────────────────┤
│  DEVELOPER LAYER                                    │
│  CLI, debugging tools, architecture visualization  │
│  Consumes skill outputs and state artifacts        │
├─────────────────────────────────────────────────────┤
│  CORE AI ENGINE                                     │
│  Skills + Orchestration + System State             │
│  Pure engineering logic, no product coupling       │
└─────────────────────────────────────────────────────┘
```

**Rules:**
- No product-layer code may import or reference AI engine internals
- Developer tools consume skill output artifacts — they do not invoke skills directly
- The AI engine has no awareness of the product's domain beyond what is in system state

---

## 6. Relationship to Current Skill System

The ASE-OS is built on top of the existing skill infrastructure in this repository. The current skill pipeline maps to ASE-OS components as follows:

| Current Skill | ASE-OS Component |
|---|---|
| `requirement-analyzer` (SKL-001) | Intent interpretation + Planning |
| `architecture-design` (SKL-002) | Architect agent backing skill |
| `feature-planning` (SKL-003) | Task graph construction |
| `clean-code-review` (SKL-004) | Quality enforcement layer |
| `testing-strategy` (SKL-005) | Test state management |
| `security-review` (SKL-006) | Security enforcement layer |
| `deployment-strategy` (SKL-007) | Lifecycle: deploy phase |
| `documentation-generator` (SKL-008) | Documentation system (Layer 1) |
| `schema-validator` (SKL-009) | State and output validation |
| `orchestrator` (SKL-010) | Orchestrator engine |
| `doc-maintainer` (SKL-011) | Documentation system (event-driven sync) |
| `context-memory` (SKL-013) | State-centric control layer |
| `observability` (SKL-014) | Monitoring and metrics |

**New skills required to complete ASE-OS** (not yet in registry):

> All previously listed required skills (SKL-021–030) have been implemented and are active.

**New skills required to complete ASE-OS — next phase** (implementation runtime):

| Skill / Component Needed | ASE-OS Component |
|---|---|
| Runtime executor | Orchestrator Engine — actual execution, not specification |
| State persistence | System State Model — populate `.opencode/state/sessions/` |
| Event bus | Event-Driven Execution Engine (§3.5) — wire event_router to actual triggers |
| CI/CD pipeline | `.github/workflows/` — automated skill validation and schema checks |

---

## 7. Final System Vision

ASE-OS is a **self-maintaining AI software engineering operating system** where:

- Software is generated, validated, tested, and documented **automatically**
- Development is **skill-driven** — not prompt-driven
- Architecture is **enforced continuously** — not reviewed afterward
- Documentation **evolves automatically** with every code change
- Token usage is **minimized** through structured intelligence layers
- The system behaves as a **controlled, event-driven engineering factory** — not a conversational assistant

> The measure of success is not how much the AI can do — it is how little drift, inconsistency, and manual intervention the system requires over the full lifecycle of a software product.

# Architecture — System Architecture

**Version:** 2.0.0 | **Last updated:** 2026-06-17

## Component Model

```
┌──────────────────────────────────────────────────────┐
│                    Registry                           │
│  (skills/registry.json — single source of discovery)  │
└─────────────────┬────────────────────────────────────┘
                  │ resolves
                  ▼
┌──────────────────────────────────────────────────────┐
│                   Orchestrator                        │
│  Skills/orchestrator/orchestrator.md                  │
│  - Pipeline execution                                 │
│  - Artifact routing                                   │
│  - Schema validation (via schema-validator)           │
│  - Retry management                                   │
│  - HITL gate enforcement                              │
│  - Feedback loop handling                             │
└────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┘
     │      │      │      │      │      │      │
     ▼      ▼      ▼      ▼      ▼      ▼      ▼
   ┌──┐  ┌──┐  ┌──┐  ┌──┐  ┌──┐  ┌──┐  ┌──┐
   │S1│  │S2│  │S3│  │S4│  │S5│  │S6│  │S7│ ...
   └──┘  └──┘  └──┘  └──┘  └──┘  └──┘  └──┘
     │      │      │      │      │      │      │
     └──────┴──────┴──────┴──────┴──────┴──────┘
                  │
                  ▼
         ┌────────────────┐
         │ Session Context │
         │ (memory/       │
         │  context-      │
         │  protocol.md)  │
         └────────────────┘
```

## Core Components

### 1. Registry (`skills/registry.json`)

Central catalog of all skills. Each entry includes:

- `name` — Hyphenated lowercase identifier
- `version` — Semver
- `domain` — Functional domain (requirements, architecture, security, etc.)
- `path` — Relative path to skill markdown file
- `inputs`/`outputs` — Named fields for dependency resolution
- `consumes_from`/`produces_for` — Dependency graph
- `orchestration` — Execution order notes

### 2. Orchestrator (`skills/orchestrator/orchestrator.md`)

The meta-skill that drives execution. It:

- Resolves pipeline config against the registry
- Loads/hydrates session context for multi-turn runs
- Invokes skills in order (sequential, parallel, or hybrid mode)
- Runs schema validation after every skill step
- Checks HITL gates at configured points
- Handles feedback loop backpropagation (max 3 iterations)
- Manages retries on validation failure (max 5 retries)
- Assembles final pipeline result with execution log

### 3. Skills

Each skill is a markdown file conforming to the [Skill Template](../skills/template/skill-template.md). Skills are:

- **Stateless** — all context comes from inputs
- **Self-contained** — no reliance on global state
- **Schema-enforced** — input and output have JSON Schema validations
- **Observable** — every output includes a `metrics` object

### 4. Context Memory (`skills/memory/context-protocol.md`)

Session state is serialized into a `session_context` object:

- Retains last 3 skill outputs; older entries compress to ID + metrics
- Supports pipeline resumption after HITL pauses or token exhaustion
- Compression rules minimize token consumption across turns
- Session token budgets: 32K (quick), 64K (standard), 128K (deep)

### 5. Schema Validator (`skills/validation/schema-validator.md`)

Utility invoked by the orchestrator after each skill step. Validates:

- Required fields present
- Field types match schema
- Constraints satisfied (pattern, enum, min/max)
- Allowed vs unknown properties (strict vs permissive mode)

## Data Flow

All inter-component communication is structured JSON:

```
[Raw Input] → Orchestrator → [Compressed Input → Skill → Validated Output]
                                               ↑                    │
                                               └── retry (max 5) ──┘
```

The orchestrator compresses the input before passing it to each skill (pruning non-essential fields per the skill's Token Optimization section).

## Feedback Loops

Skills emit `feedback` entries that trigger backpropagation:

```json
{
  "type": "backpropagate",
  "from_skill": "clean-code-review",
  "target_skill": "architecture-design",
  "reason": "Module boundary violation detected",
  "evidence": { "issue_id": "ISS-003" }
}
```

The orchestrator invalidates downstream artifacts and re-invokes the target skill.

## HITL Gates

Human-in-the-loop gates pause the pipeline at:

1. After requirement analysis — validate scope
2. After architecture design — sign off on design
3. After frontend-ux-architect — UX architecture approval
4. After database-architect — database schema approval
5. After feature planning — approve roadmap
6. After security review — approve security posture
7. After implementation-completeness-auditor — completeness sign-off
8. **Before deployment — mandatory non-bypassable deployment gate (no timeout)**

See [Governance](governance.md) for gate rules, guard skill details, and the deployment gate policy.

## UI/UX and Database Architecture Layers

As of v2.0.0, the system has two additional design-phase skill layers that run in parallel after `architecture-design`:

```
architecture-design (SKL-002)
         │
    ┌────┴────┐
    │         │
    ▼         ▼
frontend-   database-
ux-architect architect
(SKL-031)   (SKL-032)
    │         │
    ▼         ▼
ui-ux-     database-
compliance  guard
guard       (SKL-034)
(SKL-036)
```

### Frontend UI/UX Architect (SKL-031)

Produces the UI/UX architecture specification: screen inventory, navigation map, component contracts, interaction patterns, accessibility report, and token requirements. Consumed by the `ui-ux-compliance-guard` (SKL-036).

### Database Architect (SKL-032)

Produces the data model: entity definitions, ERD, relationships, indexes, migration plan, and security annotations. Consumed by the `database-guard` (SKL-034).

## Guard Layer

As of v2.0.0, four guard skills run as `validation_check` gates in the pipeline. See [Governance](governance.md#guard-skills-layer-2) for the full guard inventory and verdict contract.

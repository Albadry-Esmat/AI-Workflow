# Architecture — System Architecture

**Version:** 2.2.0 | **Last updated:** 2026-06-23

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

## Lightweight Observability Pipeline (v2.7.0)

As of v2.7.0, a three-skill observability pipeline collects anonymized behavioral telemetry and renders a session performance dashboard. It runs **asynchronously and non-blocking** — it does not affect pipeline execution or any existing gate.

### Module Topology

```
┌──────────────────────────────────────────────────────────────────────┐
│                      Orchestrator (SKL-010)                          │
│  At skill.completed, skill.failed, gate.passed, gate.blocked events  │
│  (async fire-and-forget — does not block pipeline)                   │
└────────────────────────┬─────────────────────────────────────────────┘
                         │ async event
                         ▼
┌──────────────────────────────────────────────────────────────────────┐
│          behavioral-telemetry-collector (SKL-047)                    │
│  1. Opt-out gate (first, unconditional)                              │
│  2. PII scrubber                                                     │
│  3. Append anonymized event to behavioral_telemetry.events           │
└────────────────────────┬─────────────────────────────────────────────┘
                         │ writes events
                         ▼
              ┌──────────────────────┐
              │  state-manager       │
              │  behavioral_telemetry│
              │  .events[]           │
              └──────────┬───────────┘
                         │ reads events (at pipeline.ended)
                         ▼
┌──────────────────────────────────────────────────────────────────────┐
│              session-insights (SKL-048)                              │
│  Per-skill: invocation count, success rate, failure rate, p95 ms,   │
│  HITL rejection ratio. Session: total gates, approval rate, anomaly  │
│  flags (>30% failure or rejection). Writes session_summary.          │
└────────────────────────┬─────────────────────────────────────────────┘
                         │ writes session_summary
                         ▼
              ┌──────────────────────┐
              │  state-manager       │
              │  behavioral_telemetry│
              │  .session_summary    │
              └──────────┬───────────┘
                         │ reads summary (on-demand)
                         ▼
┌──────────────────────────────────────────────────────────────────────┐
│              enhancement-dashboard (SKL-049)                         │
│  Read-only. Renders Markdown + JSON report. No state writes.         │
└──────────────────────────────────────────────────────────────────────┘
```

### Event Flow

All data flows are **unidirectional** — no cycles exist in the observability pipeline. This satisfies the cycle-free constraint confirmed by the change-impact-analyzer during planning.

```
Orchestrator (producer)
    → behavioral-telemetry-collector (consumer / state writer)
        → behavioral_telemetry.events (state)
            → session-insights (reader / summary writer)
                → behavioral_telemetry.session_summary (state)
                    → enhancement-dashboard (reader only)
                        → User (final consumer)
```

No skill in this pipeline feeds back into the orchestrator or modifies registry, routing, or pipeline configuration.

### Governance

- **Opt-out is unconditional.** If `behavioral_telemetry.opt_out === true`, SKL-047 exits immediately.
- **PII scrubber** runs on every event before storage — events contain only enum-bound and numeric fields.
- **Read-only invariant** — SKL-049 never writes to state; SKL-048 only writes `session_summary`.
- **No autonomous adaptation** — all pipeline configuration changes require explicit HITL approval.

See [Governance — Layer 5](governance.md#adaptive-governance-layer-5) for full adaptive governance rules.

---

## Work Lifecycle Management Layer (v4.0.0)

As of v4.0.0, the system includes a Work Lifecycle Management Layer that tracks, persists, and exports all work items produced during pipeline execution. This layer adds cross-session persistence for bugs, change requests, implementation tasks, and their companion items.

### Component Topology

```
┌──────────────────────────────────────────────────────────────────────┐
│                         Pipeline Execution                           │
│   (feature-planning, code-repair, implementation-completeness-       │
│    auditor, security-review → may trigger lifecycle skills)          │
└─────────────────────────────┬────────────────────────────────────────┘
                              │ emits events / produces work items
           ┌──────────────────┼──────────────────┐
           ▼                  ▼                  ▼
┌──────────────────┐ ┌──────────────────┐  ┌──────────────────────────┐
│ defect-manager   │ │ change-request-  │  │ feature-planning v2.0.0  │
│ (SKL-055)        │ │ manager (SKL-056) │  │ companion generation     │
│ BUG + chain      │ │ CR + task delta   │  │ REVIEW/TEST/VALIDATION   │
└────────┬─────────┘ └────────┬─────────┘  └────────────┬─────────────┘
         │                    │                          │
         └──────────────┬─────┘                         │
                        ▼                               ▼
           ┌────────────────────────┐    ┌──────────────────────────────┐
           │  work-items/ directory │    │  state work_items scope      │
           │  (ADR-0001 — Markdown  │◄───│  (compressed index; 512KB    │
           │   file-based store)    │    │   budget; ~104KB max)        │
           └────────────┬───────────┘    └──────────────────────────────┘
                        │                              ▲
                        │ reads full items             │ guard validates
                        ▼                              │ transitions
           ┌────────────────────────┐    ┌─────────────┴────────────────┐
           │ work-item-exporter     │    │ work-item-lifecycle-guard    │
           │ (SKL-057)              │    │ (SKL-058)                    │
           │ Jira / JSONL / Markdown│    │ enforcement: warning → block │
           └────────────────────────┘    └──────────────────────────────┘
```

### Work Item Persistence (ADR-0001)

- Each work item is a Markdown file at `work-items/{TYPE}-{NNNN}.md` with YAML front matter
- The state `work_items` scope holds only the compressed index (ID + type + status + file_path)
- Full detail is always in the `.md` file — state is a lookup index, not the source of truth
- ID patterns: `BUG-NNNN`, `FIX-NNNN`, `INVESTIGATION-NNNN`, `TASK-NNNN`, `REVIEW-NNNN`, `TEST-NNNN`, `VALIDATION-NNNN`, `CR-NNNN`, `CLOSURE-NNNN`

### Export Contract (ADR-0002)

Export is **one-way (outbound only)**. No status read-back from external platforms. Supported formats:
- **Primary**: Jira Bulk Import JSON (compatible with Jira's native bulk create endpoint)
- JSON Lines (`.jsonl`) — universal machine-readable fallback
- Markdown summary table — human-readable

### Lifecycle State Machine

All work item types have a defined state machine enforced by `work-item-lifecycle-guard` (SKL-058). Terminal states (`closed`, `cancelled`, `rejected`) are permanently blocked. HITL-gated transitions (e.g., `BUG: reported → triaged`) require orchestrator confirmation. See `docs/work-item-foundation.md §4` for the full state machine.

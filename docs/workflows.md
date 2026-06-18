# Workflows — End-to-End Lifecycle

**Version:** 2.2.0 | **Last updated:** 2026-06-18

## Full Pipeline Flow (Idea → Production)

```
[Idea / Raw Input]
        │
        ▼
┌────────────────────────────────────────────────────┐
│ PHASE 1: REQUIREMENTS                              │
│  skill: requirement-analyzer                       │
└──────────────────────┬─────────────────────────────┘
                       │
        ◆ HITL [amber]: Validate requirements scope with stakeholder
                       │
                       ▼
┌────────────────────────────────────────────────────┐
│ PHASE 2: ARCHITECTURE                              │
│  skills: architecture-design                       │
│          adr-generator (async)                     │
└──────────────────────┬─────────────────────────────┘
                       │
        ◆ HITL [amber]: Sign off on architecture before design layer
                       │
                       ▼
┌────────────────────────────────────────────────────────┐
│ PHASE 2b: UI/UX + DATABASE DESIGN  [parallel]          │
│  ┌───────────────────────┐  ┌───────────────────────┐  │
│  │ frontend-ux-architect │  │  database-architect   │  │
│  └───────────────────────┘  └───────────────────────┘  │
└──────────────────────┬─────────────────────────────────┘
                       │
        ◆ HITL [amber]: Approve UX architecture and database schema
                       │
                       ▼
┌────────────────────────────────────────────────────┐
│ PHASE 3: DEPENDENCY GRAPH                          │
│  skill: dependency-analyzer                        │
└──────────────────────┬─────────────────────────────┘
                       │
                       ▼
┌────────────────────────────────────────────────────┐
│ PHASE 4: PLANNING                                  │
│  skill: feature-planning                           │
└──────────────────────┬─────────────────────────────┘
                       │
        ◆ HITL [amber]: Approve roadmap and impact surface before implementation
                       │
                       ▼
┌────────────────────────────────────────────────────┐
│ PHASE 5: IMPACT ANALYSIS                           │
│  skill: change-impact-analyzer                     │
└──────────────────────┬─────────────────────────────┘
                       │
        ◇ COND [cyan]: Block if impact_severity = critical
                       │
                       ▼
┌────────────────────────────────────────────────────┐
│ PHASE 6: CODE GENERATION                           │
│  skill: code-generator                             │
└──────────────────────┬─────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ PHASE 7: QUALITY + TESTING  [parallel]                                       │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────────┐   │
│  │ clean-code-      │  │ testing-strategy  │  │     security-review      │   │
│  │ review           │  │                   │  │                          │   │
│  └──────────────────┘  └──────────────────┘  └──────────────────────────┘   │
│  ┌──────────────────┐                                                        │
│  │  test-generator  │                                                        │
│  └──────────────────┘                                                        │
└──────────────────────┬───────────────────────────────────────────────────────┘
                       │
        ◆ HITL [amber]: Approve security posture and coverage before audit
                       │
                       ▼
┌──────────────────────────────────────────────────────────┐
│ PHASE 7b: GUARD LAYER  [parallel]                        │
│  ┌─────────────────┐  ┌──────────────────┐               │
│  │ database-guard  │  │ performance-guard│               │
│  └─────────────────┘  └──────────────────┘               │
│  ┌─────────────────────────┐                             │
│  │ ui-ux-compliance-guard  │                             │
│  └─────────────────────────┘                             │
└──────────────────────┬───────────────────────────────────┘
                       │
        ◇ COND [cyan]: Block if any guard verdict = 'block'
                       │
                       ▼
┌────────────────────────────────────────────────────┐
│ PHASE 8: REPAIR  [conditional]                     │
│  skill: code-repair                                │
│  condition: test.failed OR build.broken            │
└──────────────────────┬─────────────────────────────┘
                       │
                       ▼
┌────────────────────────────────────────────────────┐
│ PHASE 8b: COMPLETENESS AUDIT                       │
│  skill: implementation-completeness-auditor        │
└──────────────────────┬─────────────────────────────┘
                       │
                       ▼
┌────────────────────────────────────────────────────┐
│ PHASE 8c: RELEASE GATE                             │
│  skill: implementation-completeness-guard          │
└──────────────────────┬─────────────────────────────┘
                       │
        ◇ COND [cyan]: Block if completeness guard verdict = 'block'
                       │
                       ▼
┌────────────────────────────────────────────────────┐
│ PHASE 9: DEPLOYMENT                                │
│  skill: deployment-strategy                        │
└──────────────────────┬─────────────────────────────┘
                       │
        ◆ HITL [amber] ★ MANDATORY DEPLOY APPROVAL — non-bypassable, no timeout
                       │
                       ▼
┌────────────────────────────────────────────────────┐
│ PHASE 10: DOCUMENTATION  [async]                   │
│  skills: documentation-generator                  │
│          doc-maintainer                            │
└────────────────────────────────────────────────────┘
```

## Parallel Execution Mode

Skills marked as parallel-friendly can execute concurrently:

```
Sequential:  phase-1 → phase-2 → phase-3 → phase-4 → phase-5 → phase-6
Parallel:    phase-2b  [frontend-ux-architect + database-architect]
Parallel:    phase-7   [clean-code-review + testing-strategy + security-review + test-generator]
Parallel:    phase-7b  [database-guard + performance-guard + ui-ux-compliance-guard]
Conditional: phase-8   [code-repair]  — only if test.failed OR build.broken
Sequential:  phase-8b → phase-8c → phase-9
Async:       phase-10  [documentation-generator + doc-maintainer]
Also async:  adr-generator  — runs alongside phase-2 without blocking
```

## Gate Legend

```
◆ HITL [amber]  — human_approval gate; pipeline pauses, human decision required
◇ COND [cyan]   — condition gate; evaluates expression, blocks if condition is false
★               — non-bypassable gate; bypass_on_timeout: false, no timeout override
```

## Feedback Loop Flow

When a skill detects issues requiring upstream changes:

```
Code Review ──► Architecture Design (re-invoke)
Testing ──► Requirements (re-invoke)
Security ──► Architecture Design (re-invoke)
```

The orchestrator:
1. Pauses downstream execution
2. Invalidates affected artifacts in session context
3. Re-invokes the target skill with augmented input
4. Re-runs downstream skills that consumed the invalidated artifacts
5. Tracks iteration count — halts at 3 loops if unresolved

## Partial Pipeline Flows

Not all executions require the full pipeline:

| Use Case | Phases / Skills to Run |
|----------|------------------------|
| Quick architecture review | `architecture-design` only |
| Code quality check | `clean-code-review` only |
| Security audit | `security-review` only |
| Requirements-only | Phase 1 only |
| Dependency check | Phase 3 only |
| Impact assessment | Phase 5 only |
| Pre-deployment check | Phase 7 → Phase 7b → Phase 8b → Phase 8c → Phase 9 |
| Full feature launch | Full pipeline (Phase 1 → Phase 10) |

## Pipeline Configuration

Configured via `pipeline_config` object passed to the orchestrator:

```json
{
  "skills": [{"name": "requirement-analyzer"}, {"name": "architecture-design"}],
  "parallel_groups": [["clean-code-review", "testing-strategy"]],
  "gates": [
    {"after_skill": "architecture-design", "type": "human_approval"},
    {"after_skill": "deployment-strategy", "type": "human_approval"}
  ],
  "mode": "hybrid"
}
```

## Workflow Change Rules

- Any change to workflow sequence requires updating this file AND `changelog.md`.
- Adding a new pipeline mode requires orchestrator updates in `skills/orchestrator/orchestrator.md`.
- Feedback loop targets must be defined in the skill's `feedback` output schema.

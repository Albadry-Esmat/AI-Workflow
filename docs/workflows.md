# Workflows — End-to-End Lifecycle

**Version:** 2.3.0 | **Last updated:** 2026-06-23

## Full Pipeline Flow (Idea → Production)

```
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
│ PHASE 8d: DEFECT MANAGEMENT  [conditional]         │
│  skill: defect-manager                             │
│  condition: defects_detected OR missings_count > 0 │
└──────────────────────┬─────────────────────────────┘
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
└──────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────┐
│ PHASE 10b: EXPORT  [async]                         │
│  skill: work-item-exporter                         │
└────────────────────────────────────────────────────┘
```

## Parallel Execution Mode

Skills marked as parallel-friendly can execute concurrently:

```
Sequential:  phase-1 → phase-2 → phase-3 → phase-4 → phase-5 → phase-6
Parallel:    phase-2b  [frontend-ux-architect + database-architect]
Parallel:    phase-7   [clean-code-review + testing-strategy + security-review + test-generator]
Parallel:    phase-7b  [database-guard + performance-guard + ui-ux-compliance-guard + work-item-lifecycle-guard]
Conditional: phase-8   [code-repair]  — only if test.failed OR build.broken
Conditional: phase-8d  [defect-manager]  — only if defects_detected OR missings_count > 0
Sequential:  phase-8b → phase-8c → phase-9
Async:       phase-10  [documentation-generator + doc-maintainer]
Async:       phase-10b [work-item-exporter]
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
| Full feature launch | Full pipeline (Phase 1 → Phase 10b) |
| **Report a defect** | **`defect-lifecycle.json`** — defect intake → triage HITL → investigation → fix → test → review HITL → validate → export |
| **Change request** | **`change-request.json`** — CR intake → impact analysis → HITL approval → re-plan → execute → validate → export |
| **Export work items** | Direct invocation: `work-item-exporter` only |

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

---

## Defect Lifecycle Flow (`defect-lifecycle.json`)

Triggered by: "report a bug", "defect found", "create defect", `defect.created` event from code-repair or test-generator.

```
[Defect Report]
       │
       ▼
┌─────────────────────────────────────────┐
│ PHASE 1: DEFECT INTAKE                  │
│  skill: defect-manager                  │
│  Creates BUG-NNNN + companion chain     │
└────────────────────┬────────────────────┘
                     │
     ◆ HITL [amber]: Confirm triage — priority, severity, assignment
                     │
                     ▼
┌─────────────────────────────────────────┐
│ PHASE 2: ROOT CAUSE INVESTIGATION       │
│  skill: change-impact-analyzer          │
└────────────────────┬────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────┐
│ PHASE 3: FIX IMPLEMENTATION             │
│  skill: code-repair                     │
└────────────────────┬────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────┐
│ PHASE 4: LIFECYCLE VALIDATION           │
│  skill: work-item-lifecycle-guard       │
└────────────────────┬────────────────────┘
                     │
     ◇ COND [cyan]: Block if guard verdict = 'block'
                     │
                     ▼
┌─────────────────────────────────────────┐
│ PHASE 5: REGRESSION TEST GENERATION     │
│  skill: test-generator                  │
└────────────────────┬────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────┐
│ PHASE 6: FIX REVIEW                     │
│  skill: clean-code-review               │
└────────────────────┬────────────────────┘
                     │
     ◆ HITL [amber]: Approve fix and confirm regression tests pass
                     │
                     ▼
┌─────────────────────────────────────────┐
│ PHASE 7: COMPLETENESS VALIDATION        │
│  skill: implementation-completeness-auditor │
└────────────────────┬────────────────────┘
                     │
     ┌───────────────┼───────────────┐
     ▼               ▼               ▼
 [async]         [async]
 work-item-    doc-maintainer
 exporter
```

---

## Change Request Flow (`change-request.json`)

Triggered by: "change request", "modify this requirement", "scope change", `change_request.created` event.

```
[Change Request]
       │
       ▼
┌─────────────────────────────────────────┐
│ PHASE 1: CR INTAKE                      │
│  skill: change-request-manager          │
│  Creates CR-NNNN record                 │
└────────────────────┬────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────┐
│ PHASE 2: IMPACT ANALYSIS                │
│  skill: change-impact-analyzer          │
│  Computes modules/tasks/effort delta    │
└────────────────────┬────────────────────┘
                     │
     ◆ HITL [amber]: Review impact (modules, tasks, effort delta, risk level)
                     │
                     ▼
┌─────────────────────────────────────────┐
│ PHASE 3: RE-PLANNING  [conditional]     │
│  skill: feature-planning v2.0.0         │
│  condition: CR approved                 │
└────────────────────┬────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────┐
│ PHASE 4: LIFECYCLE VALIDATION           │
│  skill: work-item-lifecycle-guard       │
└────────────────────┬────────────────────┘
                     │
     ◇ COND [cyan]: Block if guard verdict = 'block'
                     │
                     ▼
┌─────────────────────────────────────────┐
│ PHASE 5: CODE GENERATION  [conditional] │
│  skill: code-generator                  │
│  condition: new tasks in delta          │
└────────────────────┬────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────┐
│ PHASE 6: COMPLETENESS AUDIT             │
│  skill: implementation-completeness-auditor │
└────────────────────┬────────────────────┘
                     │
     ◆ HITL [amber]: Confirm scope of change is fully delivered
                     │
     ┌───────────────┼─────────────────────┐
     ▼               ▼                     ▼
 [async]         [async]               [async]
 work-item-    doc-maintainer        adr-generator
 exporter
```

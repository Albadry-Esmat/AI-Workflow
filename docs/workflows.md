# Workflows — End-to-End Lifecycle

**Version:** 1.0.0 | **Last updated:** 2026-06-16

## Full Pipeline Flow (Idea → Production)

```
[Idea / Raw Input]
        │
        ▼
┌────────────────────────────────────────────────────┐
│ 1. REQUIREMENT ANALYSIS                            │
│    Skill: requirement-analyzer                     │
│    Input: raw text, context, domain hints          │
│    Output: structured requirements, open questions │
│    HITL Gate: validate scope with stakeholder      │
└──────────────────────┬─────────────────────────────┘
                       ▼
┌────────────────────────────────────────────────────┐
│ 2. ARCHITECTURE DESIGN                             │
│    Skill: architecture-design                      │
│    Input: requirements, constraints                │
│    Output: modules, data flow, integration points  │
│    HITL Gate: sign off on architecture             │
└──────────────────────┬─────────────────────────────┘
                       ▼
┌────────────────────────────────────────────────────┐
│ 3. FEATURE PLANNING                                │
│    Skill: feature-planning                         │
│    Input: modules, requirements, capacity          │
│    Output: tasks, dependency map, phases           │
│    HITL Gate: approve roadmap                      │
└──────────────────────┬─────────────────────────────┘
                       ▼
            [IMPLEMENTATION]
                       │
          ┌────────────┴────────────┐
          ▼                         ▼
┌──────────────────┐    ┌──────────────────────┐
│ 4a. CODE REVIEW  │    │ 4b. TESTING           │
│ Skill: clean-    │    │ Skill: testing-        │
│ code-review      │    │ strategy              │
│ Input: code      │    │ Input: requirements,  │
│ Output: issues,  │    │   modules, tasks      │
│   improvements   │    │ Output: test plan,    │
│                  │    │   edge cases          │
│ Feedback: may    │    │                       │
│ backpropagate to │    │ Feedback: may         │
│ architecture     │    │ backpropagate to      │
│                  │    │ requirements          │
└────────┬─────────┘    └───────────┬───────────┘
         │                          │
         └──────────┬───────────────┘
                    ▼
┌────────────────────────────────────────────────────┐
│ 5. SECURITY REVIEW (can run parallel with 4a/4b)   │
│    Skill: security-review                          │
│    Input: architecture, code_snippets              │
│    Output: vulnerabilities, threat_model           │
│    HITL Gate: approve security posture             │
└──────────────────────┬─────────────────────────────┘
                       ▼
┌────────────────────────────────────────────────────┐
│ 6. DEPLOYMENT STRATEGY                             │
│    Skill: deployment-strategy                      │
│    Input: architecture, test_plan                  │
│    Output: environments, promotion_rules           │
│    HITL Gate: final deploy approval                │
└──────────────────────┬─────────────────────────────┘
                       ▼
┌────────────────────────────────────────────────────┐
│ 7. DOCUMENTATION GENERATION (async)                │
│    Skill: documentation-generator                  │
│    Input: requirements, architecture, review       │
│    Output: API docs, ADRs, README                  │
└────────────────────────────────────────────────────┘
```

## Parallel Execution Mode

Skills marked as parallel-friendly can execute concurrently:

```
Group A (sequential):  requirement-analyzer → architecture-design → feature-planning
Group B (parallel):    clean-code-review + testing-strategy + security-review
Group C (sequential):  deployment-strategy
Group D (async):       documentation-generator
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

| Use Case | Skills to Run |
|----------|---------------|
| Quick architecture review | `architecture-design` only |
| Code quality check | `clean-code-review` only |
| Security audit | `security-review` only |
| Requirements-only | `requirement-analyzer` only |
| Pre-deployment check | `testing-strategy` → `security-review` → `deployment-strategy` |
| Full feature launch | Full pipeline (1→7) |

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

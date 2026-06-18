# How to Use — Developer & AI Agent Guide

**Version:** 2.2.0 | **Last updated:** 2026-06-18

## For Developers

### How to Add a New Feature

```
 1. Start with raw input (feature description)
 2. Run requirement-analyzer → structured requirements, open_questions   [Phase 1]
 3. Resolve open_questions with stakeholder; HITL gate approves scope   [HITL gate]
 4. Run architecture-design; adr-generator captures decisions (async)   [Phase 2]
 5. Run frontend-ux-architect + database-architect in parallel          [Phase 2b]
 6. HITL gate: approve architecture, UX design, and DB schema           [HITL gate]
 7. Run dependency-analyzer to build / refresh module dependency graph  [Phase 3]
 8. Run feature-planning → tasks, dependency map, roadmap               [Phase 4]
 9. HITL gate: approve roadmap and impact surface                       [HITL gate]
10. Run change-impact-analyzer; pipeline blocks if severity = critical  [Phase 5]
11. Run code-generator to produce implementation artifacts              [Phase 6]
12. Run in parallel: clean-code-review, testing-strategy,               [Phase 7]
    security-review, test-generator
13. HITL gate: approve security posture and test coverage               [HITL gate]
14. Run guard layer in parallel: database-guard, performance-guard,     [Phase 7b]
    ui-ux-compliance-guard — any 'block' verdict halts the pipeline
15. If test.failed OR build.broken → run code-repair (conditional)      [Phase 8]
16. Run implementation-completeness-auditor to score coverage           [Phase 8b]
17. Run implementation-completeness-guard; blocks if score < 85%        [Phase 8c]
18. Run deployment-strategy to define release plan and promotion rules  [Phase 9]
19. Provide mandatory deployment approval — non-bypassable HITL gate    [HITL gate]
20. documentation-generator + doc-maintainer execute asynchronously     [Phase 10]
```

### How to Create a New Skill

```
1. Copy skills/template/skill-template.md to skills/<domain>/<skill-name>.md
2. Fill in all 13 sections:
   - Header: name, version (start at 1.0.0), domain, description, author
   - Purpose: one-paragraph description
   - Inputs: define fields + JSON Schema
   - Required Context: preconditions
   - Execution Logic: numbered atomic steps
   - Outputs: define fields + JSON Schema (include $defs.metrics + $defs.feedback_entry)
   - Rules & Constraints: invariants
   - Security Considerations: guardrails
   - Token Optimization: compression rules
   - Quality Checklist: validation items
   - Failure Scenarios: fallback behavior
   - HITL Gates: (if applicable)
   - Skill Composition: (if applicable)
3. Add skill entry to skills/registry.json
4. Update docs/skills-registry.md with new skill entry
5. Update docs/changelog.md
6. If new workflow sequence, update docs/workflows.md
```

### How to Create a New Agent

```
1. Define agent capability: which skill(s) it will execute
2. Add agent config to the system's opencode.json:
   {
     "agent": {
       "<agent-name>": {
         "mode": "subagent",
         "model": "<model>",
         "permission": { "edit": "deny" },
         "description": "..."
       }
     }
   }
3. Add agent to docs/agents.md with inputs, outputs, dependencies
4. If the agent introduces a new workflow path, update docs/workflows.md
5. Update docs/changelog.md
```

### How to Modify Workflows

```
1. Determine which skills change position or dependency
2. Update the dependency graph in skills/registry.json (consumes_from/produces_for)
3. Update docs/workflows.md with new flow diagram and pipeline config
4. Update docs/architecture.md if orchestration logic changes
5. Update docs/changelog.md
```

### How to Deploy Changes

```
1. Ensure all quality gates pass:
   - Unit tests
   - Integration tests
   - Schema validation
   - Security scan
2. Bump version per semver rules (see docs/versioning.md)
3. Update docs/changelog.md with change summary
4. Follow promotion flow: dev → staging → pre-prod → production
5. Each promotion gate requires HITL approval (see docs/governance.md)
6. Monitor after deployment (see docs/monitoring.md)
```

### How to Debug Issues

| Symptom | Likely Cause | Check First |
|---------|-------------|-------------|
| Schema validation error | Mismatch between skill output and expected input | Skill's schema, upstream output |
| Pipeline halted | HITL gate timeout or rejection | docs/governance.md gate rules |
| Feedback loop exceeded | Circular skill dependency | Workflow dependency graph |
| Token budget exhausted | Context not compressed | skills/memory/context-protocol.md |
| Skill not found | Registry not updated | skills/registry.json |
| Agent permission denied | Incorrect agent config | Agent permission settings |

## For AI Agents

### How to Read This Documentation

```
1. docs/README.md → system overview, navigation, governance rules
2. docs/system-overview.md → what the system does, scope
3. docs/architecture.md → component model, data flow, orchestration
4. docs/workflows.md → pipeline execution sequences and modes
5. docs/skills-registry.md → all available skills with metadata
6. docs/agents.md → agent responsibilities and configuration
7. docs/governance.md → rules you must follow
8. docs/versioning.md → version compatibility rules
```

### How to Execute a Pipeline

```
1. Identify the pipeline mode from docs/workflows.md
2. Call the orchestrator with pipeline_config + initial_payload
3. The orchestrator resolves skills from registry, validates each step
4. If HITL gate pauses pipeline, present gate context for human decision
5. Pipeline returns: result + execution_log + metrics
```

### How to Handle Feedback Loops

```
When a skill emits feedback entries:
1. The orchestrator detects backpropagation
2. It invalidates downstream artifacts
3. It re-invokes the target skill with augmented input
4. It re-runs downstream skills
5. Max 3 iterations — if unresolved, force-terminate

As an agent, you may see feedback as:
{
  "type": "backpropagate",
  "from_skill": "...",
  "target_skill": "...",
  "reason": "...",
  "evidence": {...}
}
```

### How to Use Registry for Discovery

```
To discover available skills programmatically:
1. Load skills/registry.json
2. Query by domain, consumes_from, or produces_for
3. Resolve skill path from registry entry
4. Load skill markdown from resolved path

The orchestrator automates this — but if you need manual discovery,
the registry is your single source of truth.
```

### Token Optimization Rules for Agents

```
1. Prune input: strip fields the target skill doesn't need
2. Use IDs, not descriptions, for cross-references
3. Remove metrics from inter-skill handoffs
4. Remove feedback entries after the orchestrator consumes them
5. Keep session context compressed: last 3 outputs only
6. Stay within token budget (32K/64K/128K per session type)
```

## Quick Reference

| Action | Command / File |
|--------|---------------|
| Add a skill | Copy template → write spec → update registry → update docs |
| Add an agent | Create config → update agents.md → update changelog |
| Run pipeline | Call orchestrator with pipeline_config |
| Validate output | Run schema-validator with data + schema |
| Track changes | See changelog.md |
| Report issue | Check governance.md for escalation path |

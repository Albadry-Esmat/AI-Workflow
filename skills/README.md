# Skill System Standard

Production-grade skill specification framework for AI agent ecosystems. Version 1.3.0.

## Architecture: Two-Layer System

The skill system uses two complementary layers:

| Layer | Location | Purpose |
|-------|----------|---------|
| **Knowledge layer** | `skills/index.yaml` + `skills/knowledge/` | Lightweight index + rich reference docs. Used for discovery, learning, onboarding, and AI context. |
| **Execution layer** | `skills/<domain>/<skill>.md` | 13-section AI-executable specifications. Used by agents at runtime. |

Each layer is self-contained and cross-references the other.

## Folder Structure

```
skills/
├── README.md                              # System overview (this file)
├── index.yaml                             # Central lightweight skill index (source of truth)
├── registry.json                          # Runtime skill registry for orchestrator
│
├── schema/                                # Index validation
│   ├── skill-schema.yaml                  # Schema definition for index entries
│   └── validation-rules.md                # Human-readable validation rules
│
├── template/                              # Templates for authoring new skills
│   ├── skill-template.md                  # 13-section execution spec template
│   ├── skill-entry.yaml                   # Index entry template
│   └── skill-knowledge.md                 # Knowledge file template
│
├── knowledge/                             # Rich knowledge docs — one per skill
│   ├── requirement-analysis.md            # SKL-001: principles, practices, anti-patterns, sources
│   ├── architecture-design.md             # SKL-002
│   ├── feature-planning.md                # SKL-003
│   ├── clean-code.md                      # SKL-004 — maps to Clean Code book chapters
│   ├── testing-strategy.md                # SKL-005
│   ├── security-review.md                 # SKL-006
│   ├── deployment-strategy.md             # SKL-007
│   ├── documentation-generation.md        # SKL-008
│   ├── schema-validation.md               # SKL-009
│   ├── orchestration.md                   # SKL-010
│   └── doc-maintenance.md                 # SKL-011
│
├── orchestrator/
│   └── orchestrator.md                    # Meta-skill: pipeline execution, routing, HITL gates
├── requirements/
│   └── requirement-analyzer.md            # Execution spec: requirement extraction
├── architecture/
│   └── architecture-design.md             # Execution spec: system architecture
├── planning/
│   └── feature-planning.md                # Execution spec: task decomposition
├── review/
│   └── clean-code-review.md               # Execution spec: code quality analysis
├── testing/
│   └── testing-strategy.md                # Execution spec: test planning
├── security/
│   └── security-review.md                 # Execution spec: threat modeling
├── deployment/
│   └── deployment-strategy.md             # Execution spec: environment & promotion
├── documentation/
│   ├── doc-generator.md                   # Execution spec: documentation generation
│   └── doc-maintainer.md                  # Execution spec: documentation maintenance
├── validation/
│   └── schema-validator.md                # Execution spec: JSON Schema validation
├── governance/
│   ├── versioning.md                      # Semver rules, compatibility, deprecation
│   └── observability.md                   # Metrics, logging, health monitoring
└── memory/
    └── context-protocol.md                # Session persistence & multi-turn state
```

## The Central Index

`skills/index.yaml` is the single source of truth for skill discovery. Every skill has a lightweight entry:

```yaml
- id: SKL-004
  name: Clean Code Review
  short_description: Analyze code against SOLID principles and detect anti-patterns
  reference_path: skills/knowledge/clean-code.md
  executable_skill: skills/review/clean-code-review.md
  tags: [code-quality, solid, clean-code, refactoring]
  version: "1.1.0"
  depends_on: [SKL-003]
  mastery_level: intermediate
  use_when: Reviewing any implementation before a code review gate
  do_not_use_when: Code is minified or auto-generated
```

The index supports: search by tags, filtering by mastery_level, dependency graph traversal, and learning path generation.

## Knowledge Files

Each `skills/knowledge/<skill>.md` file contains:

| Section | Content |
|---------|---------|
| Overview | What the skill is and why it exists |
| Purpose | When to apply it |
| Principles | Core principles with source chapter references |
| Practices | Actionable techniques in table format |
| Anti-patterns | Named failures with cause + fix |
| Examples | ✅ correct and ❌ incorrect code/data examples |
| Related Skills | Cross-links to related skill IDs |
| Source References | Exact chapter/section citations for all principles |

## Execution Flow

```
skills/index.yaml → (resolve skill) → skills/knowledge/<skill>.md (understand)
                                    → skills/<domain>/<skill>.md   (execute)
```

The orchestrator uses `registry.json` for runtime resolution. Humans and AI agents use `index.yaml` for discovery and learning.

## Adding a New Skill

```
1. Copy skills/template/skill-entry.yaml → add entry to skills/index.yaml
2. Copy skills/template/skill-knowledge.md → create skills/knowledge/<name>.md
3. Copy skills/template/skill-template.md → create skills/<domain>/<name>.md
4. Add entry to skills/registry.json
5. Validate: reference_path must exist, depends_on must resolve, schema must pass
6. Update docs/skills-registry.md + docs/changelog.md
```

## Execution Pipeline Flow

```
[Raw Input]
     │
     ▼ SKL-001 Requirement Analysis
     │
     ▼ SKL-002 Architecture Design  ←──────────────────┐
     │                                                  │
     ▼ SKL-003 Feature Planning                         │ feedback
     │                                                  │ loops
     ├──► SKL-004 Clean Code Review ──► SKL-006 Security Review
     │                                                  │
     └──► SKL-005 Testing Strategy ──► SKL-007 Deployment Strategy
                                                        │
                                                   [Production]

SKL-008 Documentation Generation (async, any time)
SKL-009 Schema Validation         (utility, after every step)
SKL-010 Orchestration             (meta: drives all the above)
SKL-011 Documentation Maintenance (after every system change)
```

## Token Optimization

| Technique | Impact |
|-----------|--------|
| Input pruning between steps | 30–50% reduction per handoff |
| Short IDs (`REQ-USR-001`, `TASK-0042`) | ~40% fewer tokens in references |
| `$defs` shared schema fragments | Eliminates duplication across 11 schemas |
| Context compression (last 3 outputs) | 70% reduction in session context size |
| Knowledge layer separate from execution layer | Execution prompts stay small; knowledge loaded on demand |

## Guardrails

- No skill modifies system state outside its declared output.
- All cross-skill communication uses structured JSON — no free-text handoffs.
- Feedback loops are capped at 3 iterations per pipeline.
- HITL gates require human approval at 5 critical checkpoints.
- Index entries are validated against `skills/schema/skill-schema.yaml` on every change.

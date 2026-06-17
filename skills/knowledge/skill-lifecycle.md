# Skill Lifecycle — Knowledge Reference

## Principles

- **Lifecycle is a one-way gate**: Skills advance through stages in order (draft → active → deprecated → retired). Regression to a prior stage (e.g., active → draft) is not permitted — create a new version instead.
- **Deprecation is not deletion**: A deprecated skill is still executable but emits a deprecation warning. It remains registered until all consumers have migrated to a successor.
- **Forced retirement is a breaking change**: Retiring a skill that still has active consumers requires a MAJOR version bump to the registry and migration guidance for all dependent skills.
- **Succession before retirement**: A skill cannot be retired unless either (a) a successor skill exists in the registry at `status: active`, or (b) the skill's use cases have been explicitly absorbed by an existing active skill.
- **Lifecycle events are observable**: Every stage transition emits a `skill.lifecycle_changed` event that triggers doc-maintainer and version governance.

## Lifecycle Stages

```
draft
  │   Condition: SKILL.md created, quality_score < 60
  │   Permitted: read, iterate
  │   Blocked:   production invocation
  ▼
active
  │   Condition: quality_score >= 60, registered in index.yaml
  │   Permitted: full production invocation
  │   Blocked:   deletion
  ▼
deprecated
  │   Condition: successor exists or use cases are absorbed
  │   Permitted: invocation with warning, read-only
  │   Blocked:   new consumer registration
  ▼
retired
      Condition: no active consumers, successor confirmed
      Permitted: read-only archive
      Blocked:   all execution
```

## Transition Rules

| Transition | Gate | Who Approves |
|-----------|------|-------------|
| draft → active | quality_score >= 60, all 13 sections present | skill-authoring + quality-scoring |
| active → deprecated | successor registered OR use case absorbed | Architect (human approval) |
| deprecated → retired | zero active consumers | Orchestrator (auto, after migration confirmed) |

## Anti-patterns

- **Zombie skills**: Skills that are `active` in the registry but have not been invoked in 30+ pipeline runs. These should be reviewed for deprecation.
- **Orphan deprecation**: Marking a skill deprecated without specifying a successor. Consumers have no migration path.
- **Silent retirement**: Retiring a skill without updating all consumer skills' `depends_on` and `consumes_from` fields. Creates broken references in the graph.
- **Draft in production**: Invoking a draft-stage skill in a production pipeline. Draft skills have not passed quality gates.

## Source References

- Semantic versioning specification (semver.org) — version gate model
- API deprecation best practices (Google API Design Guide)
- Software asset lifecycle management frameworks

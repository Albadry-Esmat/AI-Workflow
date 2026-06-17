# Change Impact Analyzer — Knowledge Reference

## Principles

- **Pre-change, not post-change**: Impact analysis runs before a single line of code is modified. Its purpose is to prevent surprises, not to diagnose them.
- **Multi-dimensional impact**: Impact is never just "which modules change." A change affects modules, API contracts, test coverage, documentation, and security boundaries simultaneously. All five dimensions must be assessed.
- **Minimal downstream execution**: The point of impact analysis is to invoke only the skills that are actually needed — not to default to running the full pipeline every time. If the change touches documentation only, do not run security-review.
- **Breaking API change = hard stop**: Any breaking API change (removed field, changed type, renamed function) requires architecture-design to be re-run before implementation continues. This is a non-bypassable rule.
- **Severity drives escalation**: The `impact_severity` field drives the HITL gate decision. `critical` always pauses for human review. `low` proceeds automatically.

## Impact Severity Classification

| Condition | Severity |
|-----------|---------|
| Breaking API change + security boundary crossed + >30% tests invalidated | Critical |
| Breaking API change OR security boundary crossed | High |
| Transitive module impact depth >= 5 | High |
| No breaking changes, <30% tests invalidated, no security boundary | Medium |
| Documentation only, no code change | Low |

## Required Downstream Skills by Impact Dimension

| Impact Dimension | Required Downstream Skills |
|-----------------|--------------------------|
| Code change | clean-code-review, test-generator |
| Breaking API change | architecture-design (re-run), clean-code-review |
| Security boundary crossed | security-review (mandatory) |
| Test invalidation | test-generator (regenerate invalidated tests) |
| Documentation drift | doc-maintainer (automatic via file.written event) |
| Dependency cycle introduced | dependency-analyzer (rebuild), architecture-design (resolve) |

## Anti-patterns

- **Post-hoc impact analysis**: Running impact analysis after code has already been written. The analysis then becomes damage assessment, not prevention.
- **Single-dimension analysis**: Checking only which modules change but ignoring API contracts and test invalidation. This is the most common source of undetected regressions.
- **False low severity**: Classifying a change as `low` because the changed file is small, without checking the module's position in the dependency graph. A single-line change in a core utility can have critical transitive impact.
- **Skipping impact on "safe" changes**: Documentation changes always trigger doc-maintainer. Configuration changes can have security implications. No change type is unconditionally safe.

## Source References

- Software change impact analysis survey (Arnold & Bohner, 1993 — foundational)
- Semantic impact analysis in modular systems (Podgurski & Clarke)
- Test impact analysis in CI pipelines (Microsoft Research, "Predictive Test Selection")

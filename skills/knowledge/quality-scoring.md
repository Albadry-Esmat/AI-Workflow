# Quality Scoring — Knowledge Reference

## Principles

- **Score before register**: No skill enters the registry with `status: active` without a quality score >= 60. The score is a gate, not a suggestion.
- **Dimension parity**: A skill that is perfect on schema but has no trigger conditions is not production-ready. All dimensions must meet minimum thresholds — a single zero blocks registration.
- **Continuous re-scoring**: Skills are re-scored after every MAJOR version bump and every time a feedback_route fires against them more than 3 times in a session. Quality is not assessed once.
- **Evidence-based scoring**: Scores are justified by specific evidence from the SKILL.md content — not subjective assessments. Each dimension score has a concrete reason.
- **Transparent degradation**: When a skill's score drops below 60 post-registration (due to new evidence), it is automatically flagged for evolution — not silently deprecated.

## Scoring Dimensions

| Dimension | Weight | What Is Assessed |
|-----------|--------|-----------------|
| Specification completeness | 20% | All 13 SKILL.md sections present and populated |
| Input/output schema quality | 20% | JSON Schema with `$defs`, required fields, enum constraints |
| Execution logic clarity | 20% | Steps are deterministic, conditions are explicit, no ambiguity |
| Trigger accuracy | 15% | Positive and negative triggers defined; no conflicts with adjacent skills |
| Error handling coverage | 15% | Failure scenarios cover all known error classes; fallback behaviors defined |
| Security compliance | 10% | No credential exposure; data minimization; access control stated |

## Score Thresholds

| Score Range | Status | Action |
|-------------|--------|--------|
| 90–100 | Exemplary | Register as active; mark as reference implementation |
| 75–89 | Production-ready | Register as active |
| 60–74 | Acceptable | Register as active with improvement recommendations |
| 40–59 | Needs improvement | Do not register; return to skill-authoring with gap report |
| 0–39 | Reject | Reject; full redesign required |

## Anti-patterns

- **Threshold gaming**: Writing verbose SKILL.md content to inflate scores without improving actual quality. Scorers assess substance, not length.
- **Skipping re-scoring on PATCH**: PATCH changes seem small but can introduce new failure modes. Re-score the affected dimensions on every release.
- **Dimension isolation**: Treating schema quality as the only dimension that matters because it is machine-checkable. All 6 dimensions contribute equally to production safety.
- **Score without evidence**: Recording a score without citing specific evidence from the skill spec. Evidence is mandatory for audit traceability.

## Source References

- Software capability maturity model (CMMI) — capability scoring framework
- JSON Schema best practices for API contract quality
- OWASP ASVS — application security verification standard (for security compliance dimension)

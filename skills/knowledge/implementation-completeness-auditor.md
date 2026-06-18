# Implementation Completeness Auditing
#
# Version:  1.0.0
# Domain:   quality / audit
# Skill:    .opencode/skills/implementation-completeness-auditor/SKILL.md
#
# Purpose:
#   Knowledge base for cross-checking delivered implementation against
#   requirements, detecting gaps, and producing a release readiness score.

## Principles

- **Requirements are the contract**: every functional requirement is a deliverable. If it isn't implemented, it isn't done — regardless of code quality.
- **Gap detection is non-negotiable**: partial implementations, TODOs, placeholder stubs, and commented-out logic are treated as missing features, not as "in progress".
- **Readiness score drives release gates**: a numeric score (0–100) is produced on every audit run. The release gate threshold (default: 85) is enforced by the implementation-completeness-guard skill.
- **Traceability matrix**: every requirement maps to at least one code artifact, test case, and documentation section. Gaps in any dimension lower the score.
- **Audit is a snapshot**: the audit reflects the system state at the time of invocation. Re-run after fixes to produce an updated score.

## Coverage Dimensions

An implementation is considered complete when all five dimensions are satisfied for every requirement:

| Dimension | What Is Checked | Weight |
|-----------|----------------|--------|
| Code coverage | The feature logic exists and is not a stub/TODO | 40% |
| Test coverage | At least one test case maps to this requirement | 25% |
| UI coverage | If the requirement is UI-bearing, the screen/component exists | 15% |
| Database coverage | If the requirement involves persistence, the entity/migration exists | 10% |
| Documentation coverage | The feature is documented (API doc, user guide, or changelog entry) | 10% |

## Gap Classifications

| Classification | Definition | Score Impact |
|----------------|-----------|--------------|
| `missing` | No implementation exists for the requirement | -10 pts per gap |
| `stub` | Implementation exists but is a placeholder (TODO, NotImplemented, empty function) | -7 pts per gap |
| `partial` | Implementation exists but does not cover all acceptance criteria | -5 pts per gap |
| `untested` | Implementation exists but has no test coverage | -3 pts per gap |
| `undocumented` | Implementation exists but has no documentation | -2 pts per gap |

## Readiness Score Calculation

```
Base score: 100

For each requirement (weight = 1 unless marked as priority):
  For each dimension gap:
    Apply gap classification penalty

Score = max(0, Base - sum(penalties))

Readiness levels:
  90–100  → Release Ready
  80–89   → Conditional (minor gaps must be documented as known issues)
  70–79   → Not Ready (significant gaps, re-audit required after fixes)
  < 70    → Blocked (critical gaps, release blocked)
```

## Stub / Placeholder Detection Patterns

The auditor looks for these patterns in implementation code:

```
# Code patterns that indicate a stub:
- Functions that only contain: `pass`, `throw new Error("Not implemented")`, `TODO`, `FIXME`, `HACK`
- Functions that return hardcoded mock data unconditionally
- UI components that render only `<div>placeholder</div>` or similar
- API routes that return HTTP 501
- Database migrations with `-- TODO: implement` comments
- Test files with `it.skip(...)`, `xit(...)`, or empty `it('...')` blocks
```

## Traceability Matrix Format

The auditor produces a matrix mapping each requirement ID to:

| Column | Value |
|--------|-------|
| `req_id` | Requirement identifier |
| `statement` | Requirement statement |
| `code_artifacts` | List of files/functions that implement this requirement |
| `test_cases` | List of test IDs or test descriptions covering this requirement |
| `ui_screens` | List of screens/components (if UI-bearing) |
| `db_entities` | List of tables/migrations (if data-bearing) |
| `doc_references` | List of documentation sections |
| `gaps` | List of gap classifications for this requirement |
| `coverage_score` | Per-requirement score (0–100) |

## Anti-Patterns in Completeness Review

- Accepting `TODO` comments as "tracked" — TODOs in production code are gaps.
- Counting test files that exist but have all tests disabled as coverage.
- Treating UI screens with hardcoded data as "implemented".
- Skipping documentation dimension because "it's not a code artifact".
- Not re-running the audit after gap remediation.

## Source References

- IEEE 830 — Software Requirements Specification Standard
- ISTQB — Requirements Traceability Matrix
- ISO/IEC 25010 — Software Quality Model

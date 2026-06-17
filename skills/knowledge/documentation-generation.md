# Documentation Generation — Knowledge Reference

**Skill ID:** SKL-008
**Version:** 1.0.0 | **Last updated:** 2026-06-16
**Mastery Level:** beginner
**Executable Skill:** [documentation-generator](../documentation/doc-generator.md)
**Primary Source:** *Docs Like Code* — Anne Gentle (2017); ADR format — Michael Nygard (2011)

---

## Overview

Documentation generation produces human-readable artifacts from structured pipeline data — requirements, architecture decisions, module definitions, and API contracts. When documentation is generated from source-of-truth data rather than written by hand, it stays accurate as the system evolves. The goal is zero documentation rot: docs that are always consistent with the system they describe.

---

## Purpose

Apply this skill to:

- Generate API reference documentation from architecture integration points
- Produce Architecture Decision Records (ADRs) from technical decisions
- Create onboarding guides and READMEs from requirements and architecture summaries
- Maintain a living documentation system that evolves with the codebase

---

## Principles

### P1 — Docs Like Code *(Anne Gentle, 2017 — Ch 1)*

Documentation should be treated like source code: version-controlled, reviewed, tested for accuracy, and generated from data where possible.

**Rules:**
- Store documentation in the same repository as the code it describes
- Docs are reviewed in pull requests alongside code changes
- Broken references (links to non-existent sections) are treated as test failures
- Generated docs are produced from a single source of truth — never manually copied

### P2 — ADR Format *(Michael Nygard, 2011)*

Architecture Decision Records capture the context and rationale behind significant architecture decisions. Without an ADR, future developers will reverse the decision without understanding why it was made.

**Required sections:**
| Section | Purpose |
|---------|---------|
| **Title** | Short imperative phrase: "Use PostgreSQL for order storage" |
| **Status** | Proposed / Accepted / Deprecated / Superseded by ADR-NNN |
| **Context** | What situation forced this decision? What forces are at play? |
| **Decision** | Exactly what was decided. Active voice: "We will…" |
| **Consequences** | What does this mean going forward? Positive and negative outcomes. |

**Rule:** Every significant technical decision in the architecture output must produce an ADR.

### P3 — API Documentation Completeness

An API reference is only useful if it documents every reachable endpoint, every field in every request and response, every error code, and every authentication requirement.

**Rules:**
- Incomplete API docs are worse than no docs — they create false confidence
- Every endpoint must document: method, path, auth requirements, request schema, response schema, error codes
- Examples must be accurate — generated from schema, not hand-written

---

## Practices

| Practice | Description |
|----------|-------------|
| Generate before writing | Always check if the content can be generated from existing structured data before writing it manually |
| Cross-reference, do not duplicate | Link to the authoritative source; do not copy content that will drift |
| Version documentation with the system | Doc version tracks the system version — a version bump requires a doc review |
| Separate what from why | API docs describe what the system does; ADRs explain why it does it that way |

---

## Anti-patterns

### AP1 — Documentation as Afterthought

**What:** Writing documentation after the system is built, as a release checkbox.
**Why harmful:** Context is forgotten; decisions lack rationale; documentation is immediately out of date.
**How to fix:** ADRs are written when decisions are made, not after. API docs are generated from live schemas.

### AP2 — Copy-Paste Documentation

**What:** Copying content from one document into another "for completeness."
**Why harmful:** Two sources of truth for the same fact — they will diverge. One becomes stale.
**How to fix:** Write it once in the authoritative location and link to it everywhere else.

### AP3 — Undated, Unversioned Documentation

**What:** Documents with no version header, no author, and no "last updated" date.
**Why harmful:** No way to assess freshness. Readers cannot tell if the information is current.
**How to fix:** Every document has a version header. Every version bump updates the date.

---

## Examples

### ✅ Correct — ADR Entry

```markdown
# ADR-003: Use event sourcing for order state

**Status:** Accepted
**Date:** 2026-06-16

## Context
Order state is queried heavily for reporting and must support audit trails
with complete history. Traditional CRUD loses intermediate state.

## Decision
We will use event sourcing for the Order aggregate. Events are stored
immutably; projections are rebuilt from the event log.

## Consequences
- Full audit trail by default (+)
- Read projections require separate rebuilding logic (-)
- Operational complexity of event store increases (-)
```

### ❌ Incorrect — Comment-Only Decision Record

```python
# We decided to use PostgreSQL because it's what the team knows
# (This context is lost in git blame; no rationale, no alternatives, no consequences)
class DatabaseConfig:
    engine = "postgresql"
```

---

## Related Skills

| Skill | ID | Relationship |
|-------|----|-------------|
| Requirement Analysis | SKL-001 | Requirements populate README context and user story documentation |
| Architecture Design | SKL-002 | Technical decisions produce ADRs; integration points produce API docs |
| Clean Code Review | SKL-004 | Code review findings inform inline documentation standards |
| Documentation Maintenance | SKL-011 | SKL-011 keeps generated docs in sync as the system evolves |

---

## Source References

| Source | Chapter / Section | Linked Content |
|--------|------------------|----------------|
| *Docs Like Code* — Anne Gentle | Ch 1: Treating Docs Like Code | P1 |
| *Docs Like Code* — Anne Gentle | Ch 4: Publishing Workflows | Practices |
| ADR format — Michael Nygard (2011) | cognitect.com/blog | P2, Examples |
| OpenAPI Specification 3.0 — openapis.org | Full spec | P3 |

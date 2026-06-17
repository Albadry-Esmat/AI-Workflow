# Documentation Maintenance — Knowledge Reference

**Skill ID:** SKL-011
**Version:** 1.1.0 | **Last updated:** 2026-06-16
**Mastery Level:** intermediate
**Executable Skill:** [doc-maintainer](../documentation/doc-maintainer.md)
**Primary Source:** *Docs Like Code* — Anne Gentle (2017); Continuous Documentation (emerging practice)

---

## Overview

Documentation maintenance ensures that the `/docs` folder accurately reflects the current system state at all times. Documentation rot — the gradual divergence between docs and reality — is the norm, not the exception, in long-lived systems. This skill treats documentation drift as a defect and applies systematic detection, correction, and prevention. The goal is a documentation system where the docs are always trustworthy.

---

## Purpose

Apply this skill to:

- Detect documentation drift between skill/agent/workflow changes and the `/docs` folder
- Create new documentation files when new domains are introduced
- Update existing documentation files when the system changes
- Verify cross-file consistency and eliminate contradictions

---

## Principles

### P1 — Single Source of Truth *(Docs Like Code, Gentle — Ch 4)*

Every fact about the system must exist in exactly one authoritative location. All other references must link to that location, never copy it.

**Rules:**
- Version numbers live in `skills/registry.json` — docs reference it, never define it again
- Agent permissions live in `opencode.json` — docs describe it, never contradict it
- Glossary terms live in `docs/glossary.md` — other docs link to it, never redefine terms inline
- When two docs contradict each other, the more specific (closer to the implementation) wins

### P2 — Documentation as a Commit *(Continuous Documentation practice)*

Documentation changes are treated like code changes: they belong in the same commit as the feature or change they describe. A PR that changes a skill file must include the documentation update as part of the same review.

**Rules:**
- A skill change without a documentation update is an incomplete change
- `changelog.md` must be updated on every single run — even no-op inspection runs log an entry
- Documentation review is a required step in the PR process, not a post-merge cleanup

### P3 — Incremental Updates Over Full Rewrites

Documentation is updated incrementally — only the sections that changed. Full rewrites introduce unintended changes and make diffs unreadable.

**Rules:**
- Preserve all unchanged sections during an update
- Bump only the file version that actually changed
- The dry_run mode exists exactly for this: preview what would change before committing

---

## Practices

| Practice | Description |
|----------|-------------|
| Run doc-maintainer on every system change | Trigger via `event_driven` mode; use `git_diff` for batch changes |
| Use `full_scan` weekly | Proactively detect staleness even without explicit change events |
| Cross-reference, do not duplicate | When adding content to one file, link to related files instead of copying |
| No file > 300 lines | Split at 300 lines into domain-specific sub-files with consistent naming |
| Version every file | Every `/docs/*.md` has a `Version: x.y.z` header — bump on every change |

---

## Anti-patterns

### AP1 — Documentation as a Separate Project

**What:** Docs live in a separate repo or wiki, disconnected from the codebase.
**Why harmful:** The wiki drifts immediately; the team stops updating it; eventually it is ignored.
**How to fix:** Docs live in `/docs` in the same repository. PRs are blocked if docs are not updated.

### AP2 — README-Only Documentation

**What:** The entire system is documented in a single 2000-line README.
**Why harmful:** No navigability, no version tracking per domain, no searchability, no modular updates.
**How to fix:** Modular `/docs` structure with one file per domain. README is an index, not the content.

### AP3 — Passive Drift Detection

**What:** Documentation drift is detected only when a developer manually notices a contradiction.
**Why harmful:** By the time it is noticed, the system has already drifted significantly.
**How to fix:** Active drift detection via `full_scan` mode on a schedule. Staleness is flagged automatically.

### AP4 — Over-Documentation

**What:** Every trivial detail, every internal implementation choice, every temporary decision is documented.
**Why harmful:** Volume hides the important; maintenance burden grows faster than the system; docs become noise.
**How to fix:** Document decisions (why), not implementations (how the code works — the code does that). ADRs for decisions; reference files for domain knowledge.

---

## Examples

### ✅ Correct — Cross-Reference Instead of Duplicate

```markdown
## Token Optimization

For token budget rules, see [Context Engineering](context-engineering.md#token-budget-per-session).
```

### ❌ Incorrect — Duplicated Content

```markdown
## Token Optimization

Quick sessions use 32K tokens, standard sessions use 64K tokens,
deep sessions use 128K tokens. (This is also written in context-engineering.md)
```

---

### ✅ Correct — Incremental Doc Update

```
Changed: docs/skills-registry.md
  Section updated: "### 12. new-skill" (added)
  Version bumped: 1.2.0 → 1.3.0
  Unchanged: all other sections
```

### ❌ Incorrect — Full Rewrite for One Addition

```
Rewrote entire docs/skills-registry.md
# Impossible to diff; reviewer cannot tell what changed
```

---

## Related Skills

| Skill | ID | Relationship |
|-------|----|-------------|
| Documentation Generation | SKL-008 | SKL-008 generates content; SKL-011 keeps it in sync |
| Schema Validation | SKL-009 | Used to validate new doc file structure before writing |
| Orchestration | SKL-010 | Orchestrator triggers SKL-011 after every pipeline completion |

---

## Source References

| Source | Chapter / Section | Linked Content |
|--------|------------------|----------------|
| *Docs Like Code* — Anne Gentle | Ch 1: Introduction | P1 |
| *Docs Like Code* — Anne Gentle | Ch 4: Continuous Documentation | P2, P3 |
| *Docs Like Code* — Anne Gentle | Ch 6: Maintaining Docs | AP1, AP3 |
| Continuous Documentation — DevOps practice | General principle | P2 |

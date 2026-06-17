# Requirement Analysis — Knowledge Reference

**Skill ID:** SKL-001
**Version:** 1.1.0 | **Last updated:** 2026-06-16
**Mastery Level:** intermediate
**Executable Skill:** [requirement-analyzer](../requirements/requirement-analyzer.md)
**Primary Source:** *User Story Mapping* — Jeff Patton (2014); *Domain-Driven Design* — Eric Evans (2003)

---

## Overview

Requirement analysis transforms unstructured, ambiguous input into a normalized, unambiguous specification that all downstream skills can consume without guesswork. Poor requirements are the most common cause of rework across every phase of development. This skill forces explicit discovery of assumptions, constraints, and conflicting expectations before any design or coding begins.

---

## Purpose

Apply this skill to:

- Convert raw feature requests, tickets, or stakeholder descriptions into structured requirements
- Detect ambiguous language, missing actors, and unstated preconditions
- Surface hidden assumptions before they become architectural constraints
- Generate targeted clarification questions for stakeholders

---

## Principles

### P1 — INVEST Criteria *(Bill Wake, XP123, 2003)*

Every requirement must be **I**ndependent, **N**egotiable, **V**aluable, **E**stimable, **S**mall, and **T**estable. Requirements that fail INVEST are not ready for design.

**Rules:**
- Independent: requirements should not depend on implementation order
- Negotiable: they are not contracts — options can be explored
- Valuable: every requirement must deliver clear user or business value
- Estimable: if it cannot be estimated, it is not understood well enough
- Small: requirements that span more than one sprint must be split
- Testable: a requirement that cannot be tested cannot be verified

### P2 — Ubiquitous Language *(Domain-Driven Design, Evans — Chapter 2)*

Requirements must use the domain's vocabulary — not technical jargon, not developer shorthand.

**Rules:**
- Use precise domain terms consistently across all requirement statements
- Document every domain-specific term in the glossary
- Reject requirements that mix domain language with implementation language (e.g., "the database should…")
- Every actor in a requirement must be a named role, not "the user" or "the system"

### P3 — Normalization Form

Every functional requirement MUST follow the canonical form:

> The system SHALL `[action]` `[object]` [when/if `[condition]`].

Non-functional requirements follow:

> The system SHALL BE `[quality attribute]` `[measurable constraint]`.

**Rules:**
- No "should", "might", "could" — use SHALL (mandatory) or MAY (optional)
- Every condition must be explicit — no implied prerequisites
- Every measurable constraint must include a number (e.g., "under 200ms", "at least 99.9%")

---

## Practices

| Practice | Description |
|----------|-------------|
| Split compound requirements | One requirement = one verifiable behavior. "AND" in a requirement = two requirements. |
| Assign domain IDs | Use `REQ-{DOM}-{NNN}` to make requirements referenceable across docs |
| Separate F, NF, C | Tag each requirement as Functional (F), Non-Functional (NF), or Constraint (C) |
| Confidence-rate assumptions | Rate each identified assumption as high / medium / low confidence |
| Ask closed questions | Clarification questions must be answerable with a specific answer, not open-ended |

---

## Anti-patterns

### AP1 — The Wish List

**What:** Requirements phrased as desires without measurable acceptance criteria ("the app should be fast", "the UI should be beautiful").
**Why harmful:** Untestable, unprioritizable, and subjective.
**How to fix:** Replace with a measurable constraint: "response time SHALL BE < 200ms at p95 under 500 concurrent users."

### AP2 — Implicit Actors

**What:** "The user clicks…" or "It should send an email…" without naming the actor or system.
**Why harmful:** Creates ambiguity about ownership and responsibility.
**How to fix:** Always name the actor: "The authenticated Customer SHALL…" or "The Notification Service SHALL…"

### AP3 — Bundled Requirements

**What:** One requirement that covers multiple independent behaviors joined by AND/OR.
**Why harmful:** Cannot be estimated, prioritized, or tested independently.
**How to fix:** Split into separate statements, each testable on its own.

### AP4 — Solution Masquerading as Requirement

**What:** "The system shall use PostgreSQL to store orders."
**Why harmful:** Constrains design before architecture is done; couples requirements to implementation.
**How to fix:** State the need: "The system SHALL persist orders durably and support atomic transactions." Let architecture decide the technology.

---

## Examples

### ✅ Correct — Normalized Functional Requirement

```
REQ-ORD-001 [F] [critical]
The system SHALL allow an authenticated Customer to place an order
containing at least one Item, when the Item is in stock.
```

### ❌ Incorrect — Ambiguous Wish

```
The ordering should work properly and be fast.
```

---

### ✅ Correct — Measurable Non-Functional Requirement

```
REQ-PER-001 [NF] [high]
The system SHALL BE responsive, returning order confirmation
within 500ms at the 99th percentile under 1000 concurrent users.
```

### ❌ Incorrect — Unmeasurable Quality Statement

```
The system should be responsive and handle many users.
```

---

## Related Skills

| Skill | ID | Relationship |
|-------|----|-------------|
| Architecture Design | SKL-002 | Consumes validated requirements as primary input |
| Feature Planning | SKL-003 | Tasks must trace back to requirement IDs |
| Testing Strategy | SKL-005 | Every test case must map to a requirement |
| Documentation Generation | SKL-008 | Requirements populate the README and ADR context |

---

## Source References

| Source | Chapter / Section | Linked Content |
|--------|------------------|----------------|
| *User Story Mapping* — Jeff Patton | Ch 1–2: The Big Picture | P1, Overview |
| *Domain-Driven Design* — Eric Evans | Ch 2: Communication and the Use of Language | P2 |
| *Writing Effective Use Cases* — Cockburn | Ch 2: Use Case Fundamentals | P3 |
| INVEST mnemonic — Bill Wake (XP123, 2003) | Full article | P1 |
| *Clean Agile* — Robert C. Martin | Ch 2: Agile Practices | AP1, AP3 |

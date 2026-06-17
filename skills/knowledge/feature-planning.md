# Feature Planning — Knowledge Reference

**Skill ID:** SKL-003
**Version:** 1.1.0 | **Last updated:** 2026-06-16
**Mastery Level:** intermediate
**Executable Skill:** [feature-planning](../planning/feature-planning.md)
**Primary Source:** *Agile Estimating and Planning* — Mike Cohn (2005); *User Story Mapping* — Jeff Patton (2014)

---

## Overview

Feature planning breaks a validated architecture into a dependency-aware sequence of atomic tasks, assigns complexity estimates, and groups work into delivery phases with measurable milestones. The output is not a Gantt chart — it is a living execution plan that communicates scope, risk, and delivery confidence to the team. Estimates are commitments to explore, not promises to deliver.

---

## Purpose

Apply this skill to:

- Convert architecture modules into granular, estimable, independently deliverable tasks
- Identify and document task dependencies and the critical path
- Group tasks into logical delivery phases (foundation → core → enhancement → polish)
- Set milestones that stakeholders can validate against without implementation knowledge

---

## Principles

### P1 — Story Points Measure Complexity, Not Time *(Agile Estimating, Cohn — Ch 4)*

Story points capture relative effort, risk, and complexity — not hours. They are useful for comparing tasks and predicting throughput (velocity), not for committing to exact durations.

**Rules:**
- Use Fibonacci sequence: 1, 2, 3, 5, 8, 13, 21. No other values.
- Anything estimated at > 21 must be split before it enters a sprint
- Never convert story points to hours in planning documents
- Estimate by comparison to a reference task, not from scratch each time

### P2 — Definition of Ready *(Scrum Guide, Schwaber & Sutherland)*

A task is only ready to be worked on when it meets all three conditions: it is understood, it is small enough to complete in one sprint, and it has clear acceptance criteria.

**Rules:**
- A task without acceptance criteria is not estimable and must be rejected
- A task with `confidence: low` estimate must be researched (spike) before committing
- Dependencies must be resolved before a task enters planning

### P3 — Phases as Risk Reduction *(User Story Mapping, Patton — Ch 9)*

Deliver in phases that reduce risk progressively. The first phase must establish the minimal viable foundation — the system must work end-to-end, even if incomplete.

**Phase model:**
1. Foundation — data models, auth, core API, skeleton
2. Core Features — primary happy-path use cases
3. Enhancement — edge cases, optimization, error handling
4. Polish — monitoring, docs, accessibility, performance tuning

**Rule:** Phase 1 must have zero external dependencies. It must be deployable independently.

---

## Practices

| Practice | Description |
|----------|-------------|
| One task = one atomic change | A task should produce a single reviewable artifact or behavior |
| Trace every task to a requirement | No task without a `REQ-NNN` parent — prevents scope creep |
| Identify the critical path | Tasks that block the most other tasks define delivery risk |
| Spike unknown complexity | If you cannot estimate a task, create a time-boxed research task first |
| Phase 1 is always foundation | Build the skeleton first; features come later |

---

## Anti-patterns

### AP1 — The Mega-Task

**What:** Tasks estimated at > 21 points or described at too high an abstraction ("Implement the auth module").
**Why harmful:** Cannot be tracked, reviewed, or delivered atomically. Hides complexity.
**How to fix:** Decompose until every task can be completed and reviewed in isolation in ≤ 3 days.

### AP2 — Hidden Dependencies

**What:** Task B starts before Task A is complete, because the dependency was not mapped.
**Why harmful:** Causes mid-sprint blockers, wasted work, and integration failures.
**How to fix:** Explicitly map `blocked_by` for every task before planning begins.

### AP3 — Estimates as Deadlines

**What:** Story point totals are divided by velocity to produce a promised delivery date.
**Why harmful:** Velocity varies; estimates carry uncertainty; treating them as deadlines destroys trust.
**How to fix:** Use ranges ("3–5 sprints, 90% confidence") and update as uncertainty reduces.

### AP4 — Gold-Plating in Phase 1

**What:** Developers add non-essential features (nice-to-have UI, extra validation, monitoring) to Phase 1.
**Why harmful:** Delays the working skeleton; ties up velocity on low-value work.
**How to fix:** Apply YAGNI (You Aren't Gonna Need It). Phase 1 delivers only what is required for subsequent phases to function.

---

## Examples

### ✅ Correct — Atomic Task with Traceability

```yaml
id: TASK-0042
module: UserAuthentication
description: Implement POST /auth/login endpoint returning JWT on valid credentials
complexity: 3
confidence: high
requirements: [REQ-AUTH-001]
blocked_by: [TASK-0039]  # depends on User entity being defined
```

### ❌ Incorrect — Vague Mega-Task

```yaml
id: TASK-0010
description: Build the authentication system
complexity: 21
# No requirement reference, no clear acceptance criteria, not atomic
```

---

### ✅ Correct — Phase 1 Foundation First

```
Phase 1: User entity, DB schema, JWT auth skeleton → deployable
Phase 2: Register, login, logout endpoints → functional
Phase 3: Password reset, email verification → complete
Phase 4: Rate limiting, audit logging, monitoring → production-ready
```

### ❌ Incorrect — Monitoring in Phase 1

```
Phase 1: User entity + DB schema + auth + monitoring dashboard + email templates
# Monitoring is Phase 4 work; it does not enable Phase 2
```

---

## Related Skills

| Skill | ID | Relationship |
|-------|----|-------------|
| Requirement Analysis | SKL-001 | Every task traces to a requirement from SKL-001 output |
| Architecture Design | SKL-002 | Tasks are derived from modules defined in SKL-002 |
| Testing Strategy | SKL-005 | Test cases map to tasks by module |
| Clean Code Review | SKL-004 | Refactoring tasks are generated by SKL-004 output |

---

## Source References

| Source | Chapter / Section | Linked Content |
|--------|------------------|----------------|
| *Agile Estimating and Planning* — Mike Cohn | Ch 4: Estimating Size | P1 |
| *Agile Estimating and Planning* — Mike Cohn | Ch 7: Estimating in Story Points | P1, AP3 |
| *User Story Mapping* — Jeff Patton | Ch 9: Slicing Your Map | P3 |
| *Scrum Guide* — Schwaber & Sutherland | Sprint Planning | P2 |
| *Clean Agile* — Robert C. Martin | Ch 3: Technical Practices | AP4 |

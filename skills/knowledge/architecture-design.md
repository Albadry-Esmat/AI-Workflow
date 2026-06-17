# Architecture Design — Knowledge Reference

**Skill ID:** SKL-002
**Version:** 1.1.0 | **Last updated:** 2026-06-16
**Mastery Level:** advanced
**Executable Skill:** [architecture-design](../architecture/architecture-design.md)
**Primary Source:** *Clean Architecture* — Robert C. Martin (2017); *Domain-Driven Design* — Eric Evans (2003)

---

## Overview

Architecture design translates validated requirements into a concrete structural model: modules, their responsibilities, boundaries, data flows, and integration contracts. Good architecture makes behavior easy to change and testing independent of delivery mechanisms. Architecture decisions are expensive to reverse — this skill exists to make them explicit, justified, and traceable before implementation begins.

---

## Purpose

Apply this skill to:

- Define system boundaries and the modules within them
- Make data flow and integration contracts explicit before coding
- Justify technology choices with trade-offs documented
- Ensure non-functional requirements drive structural decisions

---

## Principles

### P1 — The Dependency Rule *(Clean Architecture, Martin — Part V, Ch 22)*

Source-code dependencies must point inward toward high-level policy. Nothing in an inner circle may know about anything in an outer circle.

**Layer order (inner → outer):**
1. Entities (enterprise business rules)
2. Use Cases (application business rules)
3. Interface Adapters (controllers, presenters, gateways)
4. Frameworks and Drivers (databases, web, UI)

**Rules:**
- Domain entities must not import application logic or infrastructure
- Use cases must not depend on frameworks, databases, or delivery mechanisms
- Data crossing layer boundaries must use simple data structures or DTOs

### P2 — Bounded Contexts *(DDD, Evans — Ch 14)*

Every module exists within a Bounded Context — an explicit boundary within which a domain model applies with consistent terminology.

**Rules:**
- Each bounded context owns its data — no two contexts share a database table directly
- Cross-context communication happens via published language (events, APIs, DTOs)
- Context maps must document the relationship between bounded contexts
- "Ubiquitous Language" is context-scoped — the same word can mean different things in different contexts

### P3 — Component Cohesion *(Clean Architecture, Martin — Ch 13)*

Group classes into components using three principles:

| Principle | Rule |
|-----------|------|
| REP — Reuse/Release Equivalence | Classes that are released together belong in the same component |
| CCP — Common Closure | Classes that change together belong together |
| CRP — Common Reuse | Do not force users to depend on things they do not use |

### P4 — Stable Dependencies *(Clean Architecture, Martin — Ch 14)*

Depend in the direction of stability. Stable components (slow to change) should not depend on volatile components (frequently changing).

---

## Practices

| Practice | Description |
|----------|-------------|
| Draw the dependency graph first | Identify modules and arrows before writing any code or schema |
| One integration contract per boundary | Define the API, event schema, or message format before implementation |
| Justify every technology choice | For each technology decision, document: what was chosen, what was rejected, why |
| Map requirements to modules | Every module must cover at least one requirement — no orphan modules |
| Prefer events over direct calls | Use asynchronous events for cross-context communication where latency permits |

---

## Anti-patterns

### AP1 — Distributed Monolith

**What:** Microservices that share a database, call each other synchronously in chains, or deploy together.
**Why harmful:** The worst of both worlds — distributed complexity without modularity.
**How to fix:** Each service owns its data; communicate through events or well-defined APIs.

### AP2 — Anemic Domain Model

**What:** Domain objects that are pure data bags (getters/setters only) with all logic in service classes.
**Why harmful:** Logic scattered across services; domain rules are not encapsulated or reusable.
**How to fix:** Put behavior where the data is. Domain entities should enforce their own invariants.

### AP3 — Circular Dependencies

**What:** Module A depends on Module B, which depends on Module A.
**Why harmful:** Cannot be independently deployed, tested, or reasoned about.
**How to fix:** Extract the shared dependency into a third module that both A and B depend on.

### AP4 — Big Ball of Mud

**What:** No discernible architecture — every class depends on every other class.
**Why harmful:** Impossible to test, extend, or understand. Changes have unpredictable side effects.
**How to fix:** Identify cohesive clusters, introduce boundaries, enforce the dependency rule.

---

## Examples

### ✅ Correct — Layered Dependency Direction

```
UserController → CreateUserUseCase → UserRepository (interface)
                                           ↑
                                 PostgresUserRepo (implements)
# Database depends on domain, not the other way around
```

### ❌ Incorrect — Domain Importing Infrastructure

```python
# Bad: Domain entity imports a database library
from sqlalchemy import Column, Integer, String, Base
class User(Base):
    id = Column(Integer, primary_key=True)
# Domain is now coupled to SQLAlchemy — cannot test without a database
```

---

### ✅ Correct — Cross-Context Communication via Events

```
OrderService publishes: OrderPlaced { orderId, customerId, items }
InventoryService subscribes to: OrderPlaced → reserve stock
# Contexts are decoupled; neither knows about the other's internals
```

### ❌ Incorrect — Direct Cross-Context Database Access

```sql
-- InventoryService directly queries OrderService's database table
SELECT * FROM order_service.orders WHERE status = 'placed';
-- Creates hidden coupling; InventoryService breaks if OrderService changes its schema
```

---

## Related Skills

| Skill | ID | Relationship |
|-------|----|-------------|
| Requirement Analysis | SKL-001 | Every module must trace to a requirement |
| Feature Planning | SKL-003 | Tasks are derived from architecture modules |
| Clean Code Review | SKL-004 | SOLID at module level is architecture; at class level is code quality |
| Security Review | SKL-006 | Architecture defines the attack surface |

---

## Source References

| Source | Chapter / Section | Linked Content |
|--------|------------------|----------------|
| *Clean Architecture* — Robert C. Martin | Part V, Ch 22: The Clean Architecture | P1 |
| *Clean Architecture* — Robert C. Martin | Ch 13–14: Component Principles | P3, P4 |
| *Domain-Driven Design* — Eric Evans | Ch 14: Maintaining Model Integrity | P2 |
| *Building Microservices* — Sam Newman | Ch 3: How to Model Services | AP1, AP2 |
| *Patterns of Enterprise Application Architecture* — Fowler | Ch 9: Domain Logic Patterns | AP2 |

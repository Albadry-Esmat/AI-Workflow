# Goal File — Example

> **This is a sample Goal File** showing how to define a project vision for the
> AI Workflow pipeline. Copy this structure and fill in your own project details.
> The pipeline uses the Goal File as its primary source of requirements and constraints.

---

# [Your Project Name] — System Vision

**Version:** 1.0.0 | **Created:** YYYY-MM-DD | **Status:** Active

---

## 1. Project Overview

What are you building? In 2–3 sentences, describe the system and its primary value.

**Example:**
> A multi-tenant SaaS platform for small businesses to automate their invoice workflows,
> integrating with Stripe for billing and QuickBooks for accounting.

---

## 2. Goals

What does success look like?

- Goal 1: ...
- Goal 2: ...
- Goal 3: ...

---

## 3. Non-Goals

What are you explicitly NOT building?

- Not goal 1: ...
- Not goal 2: ...

---

## 4. Target Users

Who uses this system?

| Persona | Description | Primary needs |
|---------|-------------|---------------|
| Admin | ... | ... |
| End user | ... | ... |

---

## 5. Core Requirements

List the must-have capabilities:

1. **REQ-001** — ...
2. **REQ-002** — ...

---

## 6. Tech Stack Preferences

Any constraints or preferences on technology?

- Language: TypeScript / Python / Go / ...
- Database: PostgreSQL / MongoDB / ...
- Hosting: AWS / GCP / Vercel / ...
- Auth: Clerk / Auth0 / custom JWT / ...

---

## 7. Architecture Constraints

Any hard rules the system must follow?

- Constraint 1: ...
- Constraint 2: ...

---

## 8. Quality Gates

What are the minimum quality thresholds?

- Test coverage: ≥ 80%
- Performance: p95 API latency < 200ms
- Security: No HIGH or CRITICAL findings unresolved

---

## 9. Pending Decisions

Decisions not yet made that the pipeline should flag:

| Decision | Options | Blocker |
|----------|---------|---------|
| Auth provider | Clerk vs Auth0 | Budget |

---

> **How the pipeline uses this file:**
> The `requirement-analyzer` skill reads this file to extract REQ-NNN entries.
> The `architecture-design` skill uses the tech stack and constraints sections.
> The `feature-planning` skill uses the goals and requirements to build the roadmap.

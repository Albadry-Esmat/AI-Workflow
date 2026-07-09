# Project Constitution — Example

> **This is an example constitution for a hypothetical SaaS project.**
> Copy this file to your project root and edit it:
> ```
> cp docs/examples/CONSTITUTION-example.md CONSTITUTION.md
> ```

---

## 1. Project Overview

**Name:** Acme Task Manager
**Purpose:** A multi-tenant SaaS application for team task management. Teams can
create workspaces, manage tasks, assign members, and track progress through
Kanban boards and sprint planning views.
**Primary users:** Engineering and product teams at SMB companies (10–500 employees).
**Repository:** acme/task-manager

---

## 2. Tech Stack Decisions

| Layer | Decision | Rationale |
|-------|----------|-----------|
| Backend | Node.js 20 + Express | Team expertise; existing codebase |
| Frontend | React 18 + Next.js 14 | SSR for SEO; App Router adopted in Q1 2026 |
| Database | PostgreSQL 16 | ACID compliance; team expertise |
| ORM | Drizzle ORM | Type-safe; migration tooling |
| Auth | Auth0 | SSO support; compliance requirement |
| Infrastructure | AWS (ECS Fargate + RDS) | Existing AWS account; SOC 2 scope |
| CI/CD | GitHub Actions → ECR → ECS | Existing pipelines |
| Observability | Datadog | APM + logging; corporate license |

---

## 3. Architectural Constraints

- **Multi-tenancy:** All data is tenant-scoped. Every database query MUST include a
  `tenant_id` filter. Row-level security is enforced at the PostgreSQL level.
- **Soft deletes only:** No hard deletes in production. All entities have `deleted_at`
  and `deleted_by` columns.
- **Event sourcing for audit:** All state changes to tasks and assignments are recorded
  in an append-only `audit_events` table.
- **No direct DB access from frontend:** All data access goes through the REST API.
  No direct database connections from Next.js server components.
- **PII in dedicated tables:** Name, email, and phone number are stored only in the
  `users` table and never duplicated into derived tables.

---

## 4. Non-Goals

- This system does NOT support real-time collaborative editing (no CRDT/OT).
- This system does NOT provide a native mobile app — the web app is mobile-responsive only.
- This system does NOT integrate with third-party task trackers (Jira, Linear) in v1.
- This system does NOT support self-hosted on-premises deployment.

---

## 5. Team Conventions

| Convention | Value |
|-----------|-------|
| Indentation | 2 spaces |
| Test framework | Vitest + React Testing Library |
| API style | REST (no GraphQL) |
| Commit format | Conventional Commits |
| Branch naming | `feature/<jira-id>-<slug>` |
| PR requirement | 2 approvals + passing CI + no unresolved comments |
| Error format | `{ "error": { "code": "...", "message": "...", "details": {} } }` |
| Pagination | Cursor-based (`cursor` + `limit`); no offset pagination |

---

## 6. Open Questions

- [ ] Q: Should sprint planning be included in v1 or deferred to v2? (Decision pending with PM)
- [ ] Q: Which regions for multi-region deployment? (Evaluating EU + US-East only vs. full global)

---

## 7. Amendment Log

| Date | Change | Author |
|------|--------|--------|
| 2026-07-09 | Example constitution created for documentation | AI Workflow |

---

> **Token budget note:** This file should stay under 2 000 tokens.

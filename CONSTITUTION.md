# Project Constitution

> **What is this file?**
> `CONSTITUTION.md` is the single source of persistent project context for the AI Workflow
> pipeline. Every pipeline run reads this file at startup and uses it to avoid asking you
> the same questions twice. Think of it as the project's standing orders.
>
> **How to edit it:** Update any section below. Commit the change to version control.
> All future pipeline runs will automatically pick up the new content.
>
> **How it works:** The `requirement-analyzer` skill reads this file at Step 0 before
> any analysis begins. The `orchestrator` injects it as `project_context` into every
> skill invocation so downstream skills (architecture, planning, testing) all share
> the same baseline understanding.

---

## 1. Project Overview

<!-- One paragraph. What does this system do and who uses it? -->

**Name:** AI Workflow System
**Purpose:** A modular, skill-based AI pipeline that takes a feature idea from raw
description through to production-ready architecture, implementation plan, tests,
and deployment strategy.
**Primary users:** Engineering teams building software features who want structured,
AI-assisted delivery workflows.
**Repository:** AI-Workflow

---

## 2. Tech Stack Decisions

<!-- Lock in technology choices so the pipeline does not re-debate them on every run. -->

| Layer | Decision | Rationale |
|-------|----------|-----------|
| Runtime | Node.js 20 LTS | Existing codebase; ecosystem fit |
| Language | TypeScript (strict mode) | Type safety; existing codegen templates |
| Package manager | npm | Existing lock file; no pnpm migration planned |
| CI | GitHub Actions | Existing workflows in `.github/workflows/` |
| Hosting | Vercel (website) | Existing deployment; serverless edge |

---

## 3. Architectural Constraints

<!-- Hard constraints the architect MUST respect. These cannot be overridden by a single run. -->

- **Skill isolation:** Each skill in `.opencode/skills/` is self-contained. Skills MUST NOT
  import from each other at runtime — all inter-skill communication is via the orchestrator.
- **Flat-file persistence:** No database. State is stored in `.opencode/state/` as JSON files.
  Any proposal to add a database requires a CONSTITUTION amendment.
- **No secrets in code:** All tokens and credentials are environment variables. The pipeline
  must never write secrets to disk or include them in artifacts.
- **Backward compatibility:** Skills are versioned with semver. A MAJOR version bump requires
  a HITL gate approval before the pipeline can upgrade.
- **HITL gates are non-negotiable:** The mandatory deployment approval gate (`after_phase:
  phase-9-deploy`) cannot be bypassed. `bypass_on_timeout: false` must remain set.

---

## 4. Non-Goals

<!-- Things this project explicitly does not do. Prevents scope creep on every run. -->

- This system does NOT execute code — it generates plans, specs, and skeletons only.
- This system does NOT manage live infrastructure — use the deployment-strategy output
  to drive your own IaC tooling.
- This system does NOT store user data — all state is session-scoped and ephemeral
  unless explicitly persisted to `.opencode/state/`.
- This system does NOT replace human code review — it augments it.

---

## 5. Team Conventions

<!-- Coding and process conventions so the pipeline generates conformant output. -->

| Convention | Value |
|-----------|-------|
| Indentation | 2 spaces (no tabs) |
| Line endings | LF (Unix) |
| Max line length | 120 characters |
| Test framework | Jest |
| Commit format | Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`) |
| Branch naming | `feature/<id>-<slug>`, `fix/<id>-<slug>` |
| PR requirement | Passing CI + 1 approval before merge |
| API versioning | Semantic versioning; breaking changes bump MAJOR |

---

## 6. Open Questions

<!-- Standing open questions that the pipeline should be aware of but not attempt to resolve. -->

<!-- Example:
- [ ] Q: Should we support multi-tenant pipelines? (Decision pending with leadership)
- [ ] Q: Which observability backend? (Evaluating Datadog vs. OpenTelemetry)
-->

*(No standing open questions — add items here as they arise.)*

---

## 7. Amendment Log

<!-- Record significant changes to this constitution so the history is traceable. -->

| Date | Change | Author |
|------|--------|--------|
| 2026-07-09 | Initial constitution created | AI Workflow Pipeline |

---

> **Token budget note:** This file should stay under 2 000 tokens. If it exceeds that,
> the pipeline will warn and truncate the lower-priority sections (starting from §7).
> Keep §1–5 concise.

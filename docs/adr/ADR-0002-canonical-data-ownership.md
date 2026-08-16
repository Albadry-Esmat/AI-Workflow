# ADR-0002: Canonical Data Ownership

**Status:** Accepted for Batch 0 planning; enforcement begins in Batch 1 and synchronization checks continue in Batch 2  
**Date:** 2026-08-16  
**Owners:** Data/Release and Website

## Decision

AI-Workflow is the source of truth for all facts about AI-Workflow capabilities. The website consumes validated generated data from `AI-Workflow/Dev` and presents it through website-owned UI code.

| Data category | Canonical owner | Website treatment |
|---|---|---|
| Skill implementation and skill metadata | `.opencode/skills/*/SKILL.md` | Exact generated mirror |
| Skill discovery/index metadata | `skills/index.yaml` | Generated mirror |
| Runtime registry | `skills/registry.json` | Generated mirror |
| Skill graph | `skills/graph/skill-graph.yaml` | Generated mirror |
| Pipeline definitions | `skills/pipelines/*.json` | Generated mirror |
| Agent/runtime configuration | `opencode.json` | Generated mirror; security-sensitive changes require review |
| Changelog | `docs/changelog.md` | Generated mirror |
| AI-Workflow counts and capability facts | Derived from canonical source files | Generated; never hand-edited |
| Website editorial copy | `ASE-OS-Website` owned content, explicitly marked | Website-owned and reviewed in website Dev |
| Website components, styling, routing, SEO layout | `ASE-OS-Website` source | Website-owned |

## Rules

1. A derived value must identify its source or generation method.
2. A mirrored file must be delete-aware; source deletion must remove the corresponding mirror.
3. Website-owned editorial content must not overwrite AI-Workflow-owned facts.
4. A website build is not evidence of data freshness unless the source commit and data hash are recorded.
5. Manual edits to generated website data are prohibited; corrections must be made in AI-Workflow and synchronized.

## Consequences

This creates a clean separation between capability authorship and public presentation. It also makes the website dependent on validated AI-Workflow data, which requires a release manifest and compatibility gate before production promotion.

## Follow-up enforcement

Batch 1 will add ownership checks and security-document consistency checks. Batch 2 will add exact hash comparison, deletion regression coverage, and a Dev-to-Dev release manifest.

# Changelog

All notable changes to this project will be documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

_Add upcoming changes here before they ship._

---

## [1.1.0] — 2026-06-28

### Added

- `feature-planning` v2.1.0: always-on Step 7c — materializes `work-items/features/FEATURE-{NNN}-{slug}/`
  folders (`request.md`, `plan.md`, `tasks.md`, `status.md`) for every requirement; rebuilds
  `work-items/indexes/features.md`; populates `work_items.items[]` in state with FEATURE entries.
- `feature_folders[]` and `feature_count` fields added to `feature-planning` output schema (required).
- Enhancement roadmap documented in `docs/enhancements/` — 3-phase plan (v1.1.0 → v2.0.0).

### Changed

- `opencode.json`: `planner` agent `edit` permission changed `deny` → `ask` to allow Step 7c file writes.
- `full-pipeline.json`: `feature-planning` minimum version pinned from `^2.0.0` → `^2.1.0`.
- `skills/index.yaml`: `feature-planning` version updated to `2.1.0`.

### Fixed

- Step 7c `file_path` in state entry corrected: now points to `request.md` (was directory path),
  preventing spurious "file missing" warnings in `work-item-exporter`.
- Step 7c `features.md` rebuild rewritten as idempotent read→merge→write: existing index rows are
  preserved and merged with new rows on every re-run; no rows are ever dropped.
- `full-pipeline.json` version pin updated so deployments always use Step 7c-capable skill.

---

## [1.0.0] — 2026-06-27

### Added

- Initial public release of the AI Workflow framework
- 101 production-ready skills across 19 domains
- 21 pipeline templates (full pipeline, pre-deploy, quick-review, and more)
- 19 specialized agents with complete instruction sets
- Complete documentation suite: architecture, governance, how-to-use, models, MCP, security, and more
- `scripts/validate-skills.sh` — validates all SKILL.md files and pipeline schemas
- GitHub Actions CI workflow for automated skill validation
- Next.js documentation website with live skill browser, pipeline viewer, and agent explorer
- `work-items/` structure for tracking features, bugs, and tasks
- `graphify` integration for codebase knowledge graph

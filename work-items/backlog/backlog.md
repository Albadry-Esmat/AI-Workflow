# Backlog

**Last updated:** 2026-06-23

Ideas, future enhancements, deferred requests, and items awaiting prioritization. Entries here are NOT scheduled. When an item is prioritized, convert it to a full `FEATURE-NNN` folder (or `TASK-NNNN` if adding to an existing roadmap phase).

---

## Pending Prioritization

### Infrastructure & Migration

| Priority | Item | Notes | Source |
|----------|------|-------|--------|
| HIGH | Migrate TASK-0001–TASK-0037 to new WIM folder structure | Legacy flat files predate the Work Item Management System. Requires updating all path references in `docs/enhancements/phase-*.md`. Estimated: 5–8 pts. | Internal |
| MEDIUM | CI/CD dashboard for work item status | Visual dashboard showing Planned/In Progress/Completed counts per phase, linked to `indexes/features.md` | Goal File §6 |
| LOW | Slack/email notifications on work item status change | Infrastructure dependency — requires webhook integration. Blocked by TASK-0036 (Jira sync). | Goal File §8 |

### Post-v5.0.0 Capability Gaps

These were identified during the v4.1.0–v5.0.0 enhancement planning but deferred beyond the current roadmap:

| Priority | Item | Rationale for Deferral | Effort |
|----------|------|------------------------|--------|
| MEDIUM | Runtime executor (live code execution) | Requires sandboxed execution environment — out of scope for spec-level system | Large |
| MEDIUM | `ml-specialist` domain skill | Deferred pending `data-ml-pipeline.json` validation (TASK-0024). Stub included in pipeline as placeholder. | 13 pts |
| LOW | `api-contract-guard` for GraphQL | TASK-0010 covers REST only. GraphQL schema introspection requires separate tooling (graphql-inspector). | 5 pts |
| LOW | Multi-agent concurrent execution tests | Requires integration test harness not yet in place. | 8 pts |
| LOW | `release-notes-generator` Slack/email delivery | Purely additive after TASK-0019 completes. Infrastructure dependency. | 3 pts |
| LOW | `localization-architect` AI translation pre-fill | Integrate DeepL/Google Translate API to pre-fill `.po` files as implementation hints. Controversial (may bias translators). | 5 pts |
| LOW | Website dark mode | Consumer website uses hardcoded light mode. Requires design system update and token migration. | 3 pts |
| LOW | Graphify weekly auto-update hook | Currently `graphify update .` is manual. Automate via pre-commit hook or CI step. | 2 pts |

### Observed DX Improvements

| Priority | Item | Notes |
|----------|------|-------|
| MEDIUM | Interactive pipeline selector CLI | `npx ase-os select-pipeline` — interactive terminal UI to pick pipeline template. Better UX than reading routing table. | 
| LOW | Skill comparison view | Side-by-side diff of two skill versions (e.g., `database-guard v1.0.0` vs `v1.1.0`) — useful for reviewing version bumps | 
| LOW | `validate-skills.sh --fix` mode | Auto-fix common validation errors (missing fields, wrong versions) instead of just reporting them | 
| LOW | `dry_run: true` global pipeline flag | Currently `dry_run` is per-skill. A global `pipeline_dry_run: true` flag would simulate the entire pipeline without state mutations | 

---

## How to Promote a Backlog Item

1. Assign a `FEATURE-NNN` ID from `indexes/features.md` (next available number)
2. Create `work-items/features/FEATURE-NNN-short-name/`
3. Write `request.md`, `plan.md`, `tasks.md`, `status.md`
4. Add to `indexes/features.md`
5. Remove from this backlog file
6. Schedule in the appropriate phase or milestone

---

## Archived Backlog Items

*Items that were in backlog but promoted to active roadmap or cancelled.*

| Item | Outcome | Date |
|------|---------|------|
| `api-contract-guard` skill | Promoted to TASK-0010 (Phase 2) | 2026-06-23 |
| `bundle-size-guard` skill | Promoted to TASK-0011 (Phase 2) | 2026-06-23 |
| `environment-config-manager` skill | Promoted to TASK-0018 (Phase 3) | 2026-06-23 |
| `release-notes-generator` skill | Promoted to TASK-0019 (Phase 3) | 2026-06-23 |
| `localization-architect` skill | Promoted to TASK-0020 (Phase 3) | 2026-06-23 |
| GitHub Actions CI workflows | Promoted to TASK-0014 (Phase 2) | 2026-06-23 |
| Session state persistence | Promoted to TASK-0015 (Phase 2) | 2026-06-23 |

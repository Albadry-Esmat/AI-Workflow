# ADR-0002: Work Item Export Contract — One-Way Jira-Compatible

**Date:** 2026-06-22
**Status:** Accepted
**Supersedes:** N/A

---

## Context

The Work Lifecycle Management Layer must export work items to external work management platforms so that teams can track delivery progress in their existing tooling. Key constraints driving this decision:

1. The system is AI-driven, session-based, and pipeline-executed — it does not run as a persistent background service
2. The primary export target is Jira, which is the most widely adopted enterprise work tracking platform
3. Any bidirectional sync (read back status changes from Jira) would require: a polling or webhook listener, Jira API credentials, network access at runtime, conflict resolution logic for diverged state, and a dedicated sync daemon — none of which are available in the current architecture
4. The value of export is primarily **outbound**: AI-generated work items, tasks, and defects are created by the pipeline and handed off to human teams for execution — the humans then update status in Jira, not in the AI system
5. The export must be usable without any external API call (offline-first): a file written to disk that can be imported by a human into Jira is sufficient for the initial implementation

---

## Decision

**One-way (outbound) export with Jira JSON as the primary format, plus JSON Lines (JSONL) and Markdown as universal fallbacks.**

- Export is triggered at pipeline completion or on-demand via direct `work-item-exporter` invocation
- Export is **outbound only**: the AI system writes, the human imports into Jira (or other platform)
- No status is read back from Jira — the AI system's `work_items` state is the authoritative record
- **Primary format**: Jira Bulk Import JSON (compatible with Jira's native bulk create REST endpoint and CSV importer)
- **Universal fallback**: JSON Lines (`.jsonl`) — one work item per line, machine-readable, platform-agnostic
- **Human-readable fallback**: Markdown table (`.md`) — summary view for non-technical stakeholders
- Export files are written to `exports/` directory with timestamp suffix: `exports/{YYYY-MM-DD}_{pipeline_id}_{format}.{ext}`

---

## Alternatives Considered

### Option A: One-Way Export, Jira-Compatible (Chosen ✓)

**Description:** Outbound-only export. Jira JSON primary format. JSONL + Markdown as fallbacks. No API call required — file-based.

**Pros:**
- Zero runtime dependency — export is a file write, importable by humans without automation
- Jira Bulk Import format is well-documented and stable
- Single source of truth: AI system owns the work item state; Jira receives a snapshot
- No authentication or network access required at export time
- Offline-first: export works in air-gapped, CI, or local environments
- Simpler implementation: no sync agent, no conflict resolution, no polling
- JSONL fallback covers non-Jira platforms (Linear, GitHub Issues, Azure DevOps can all consume JSONL with light transformation)

**Cons:**
- No status sync-back: if a developer marks a Jira ticket as "Done", the AI system does not know
- Requires a human import step (not fully automated end-to-end)
- If AI system and Jira diverge, the AI system's view becomes stale over time (mitigated: AI system is used for planning, not as a real-time tracker)

---

### Option B: Bidirectional Sync (Real-Time)

**Description:** Work items are created in Jira via API; Jira status changes are polled back and written to AI system state.

**Pros:**
- AI system always reflects live Jira state
- Team can close tickets in Jira and AI system completeness checks stay current

**Cons:**
- Requires Jira API credentials at runtime — not available in all environments
- Requires a persistent polling service or webhook receiver — not compatible with session-based pipeline model
- Conflict resolution needed (what if AI system and Jira disagree on status?)
- 2× implementation complexity: export AND import paths
- Network dependency: pipeline would fail if Jira API is unreachable
- GDPR/security: AI system would store Jira user identities and assignment data
- Estimated effort: 2× the one-way approach (8–10 additional weeks)

---

### Option C: Platform-Agnostic JSONL Only

**Description:** Export only JSON Lines format, leave all platform-specific transformation to the consumer.

**Pros:**
- Simplest implementation
- No platform lock-in
- Consumers can transform JSONL with any scripting tool

**Cons:**
- Jira bulk import requires a specific JSON envelope — teams would need to write their own transformer
- Reduces the immediate usability value — the AI system produces a file that requires further manual work before it can be imported
- Missing the specific Jira field mappings (issue_type, priority, labels, components, story_points) that add real value for enterprise teams

---

### Option D: Linear GraphQL API

**Description:** Export directly to Linear via its GraphQL API as the primary integration target.

**Pros:**
- Linear's API is modern, well-structured, and developer-friendly
- Issue creation via GraphQL is simpler than Jira's REST bulk import

**Cons:**
- Linear has significantly lower enterprise adoption than Jira
- Requires API authentication and network access
- Jira is the stated target (U5 decision)
- Linear can still be supported as a second format in a future MINOR version

---

## Consequences

### Positive
- Immediate, zero-dependency export: writing a JSON file requires no credentials or network
- Jira Bulk Import format is fully standardized — no custom parser needed on the import side
- Export works in CI, offline, air-gapped, and local environments
- Architecture remains simple: `work-item-exporter` is a pure transformer (state → file), with no external I/O
- Jira field mappings are defined once in the skill and reused across all exports

### Negative
- No live sync: the AI system's work item state and Jira's state diverge over time after export
- Human import step required for each export (manual CSV/JSON upload to Jira, or scripted via Jira API separately)
- Future bidirectional capability would require a separate `jira-sync` skill (not in scope for this phase)

### Neutral
- Export is idempotent: re-exporting the same state produces the same file (deterministic)
- Export format version is embedded in the export manifest for future schema evolution
- `exports/` directory is a new project artifact (alongside `work-items/`, `docs/`, `skills/`)

---

## Jira Field Mapping

| Work Item Field | Jira Field | Notes |
|----------------|------------|-------|
| `id` | `externalId` | Used for deduplication on re-import |
| `title` | `summary` | Jira max 255 chars |
| `description` | `description` | Markdown → Jira Document Format (ADF) |
| `type` → mapping | `issuetype` | BUG→Bug, TASK→Task, CR→Change Request, FIX→Sub-task, TEST→Test |
| `priority` | `priority` | critical→Highest, high→High, medium→Medium, low→Low |
| `severity` | `labels` | `severity:{value}` label added |
| `status` | `status` (workflow) | Mapped to Jira workflow step names |
| `parent_id` | `parent` | For sub-tasks (FIX, INVESTIGATION, CLOSURE) |
| `linked_items` | `issuelinks` | Mapped to Jira link types (blocks, is blocked by, etc.) |
| `req_ids` | `labels` | `req:{REQ-ID}` labels added for traceability |
| `acceptance_criteria` | `description` (appended) | Checklist format |
| `created_by_skill` | `labels` | `generated-by:{skill}` label added |

---

## Export File Naming Convention

```
exports/
├── 2026-06-22_abc123_jira.json        ← Jira Bulk Import JSON
├── 2026-06-22_abc123_full.jsonl       ← JSON Lines (all items, all fields)
├── 2026-06-22_abc123_summary.md       ← Markdown summary table
└── 2026-06-22_abc123_manifest.json    ← Export metadata (item counts, filters, format version)
```

The `manifest.json` contains:
```json
{
  "export_id": "abc123",
  "exported_at": "2026-06-22T15:00:00Z",
  "pipeline_session_id": "...",
  "format_version": "1.0.0",
  "items_exported": 880,
  "type_breakdown": { "TASK": 200, "REVIEW": 200, "TEST": 200, "VALIDATION": 200, "BUG": 10, ... },
  "filters_applied": { "status": "all", "types": "all" },
  "export_formats": ["jira", "jsonl", "markdown"],
  "jira_project_key": null
}
```

---

## Related Skills

- `work-item-exporter` (SKL-057) — implements this export contract
- `state-manager` (SKL-020) — source of the compressed index read at export time
- `defect-manager` (SKL-055) — producer of BUG/FIX items that appear in exports
- `feature-planning` (SKL-003) v2.0.0 — producer of TASK/companion items
- `change-request-manager` (SKL-056) — producer of CR items
- `doc-maintainer` (SKL-011) — updates `exports/` directory manifest after export

---
id: SKL-062
name: release-notes-generator
version: 1.0.0
status: draft
draft: true
domain: documentation
description: 'Use when synthesizing structured RELEASE_NOTES.md from pipeline artifacts (ADR index, requirements, resolved defects, work items, changelog diffs). Triggers on: "generate release notes", "write the changelog summary", "release summary", "what changed in this release", "draft the release". Do NOT use for live API documentation — use documentation-generator for that.'
author: ASE-OS
---

# Release Notes Generator

**Version:** 1.0.0 | **Last updated:** 2026-09-29

Evidence-producer skill that synthesizes a structured `RELEASE_NOTES.md` from data the pipeline already holds — no manual drafting, no new fact-finding. It assembles closed work items, breaking-change ADRs, resolved requirements, and changelog diffs into the standard sections (Summary, New Features, Improvements, Bug Fixes, Breaking Changes, Migration Notes, Known Issues) and rewrites them for the requested `target_audience`.

---

## 1. Skill Header

```yaml
id: SKL-062
name: release-notes-generator
version: 1.0.0
status: draft
draft: true
domain: documentation
description: >
  Use when synthesizing structured RELEASE_NOTES.md from pipeline artifacts
  (ADR index, requirements, resolved defects, work items, changelog diffs).
  Triggers on: "generate release notes", "write the changelog summary",
  "release summary", "what changed in this release", "draft the release".
  Do NOT use for live API documentation.
author: ASE-OS
```

---

## 2. Purpose

`release-notes-generator` closes the synthesis gap: every release currently requires manually-written notes even though the system already stores every input (decisions, closed tasks, fixed bugs, breaking changes). Where `doc-maintainer` keeps living documentation current and `work-item-exporter` ships tasks outward, this skill produces the single human-readable release record.

**Every listed item MUST trace to a source artifact.** Features trace to closed `FEATURE` work items, fixes to closed `BUG` items, breaking changes to flagged ADRs or requirements, known issues to open high/critical bugs. An item with no source is omitted and reported in `feedback` — never invented.

The skill runs in **phase-10b-async** (`full-pipeline.json`), alongside `doc-maintainer` and `work-item-exporter`.

---

## 3. Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `adr_index` | `array[object]` | No | Architectural decisions for this release: `{ id, title, breaking_change: boolean, migration_note }` |
| `requirements` | `array[object]` | No | Requirements from requirement-analyzer (resolved/filtered): `{ id, title, impact }` |
| `work_items` | `array[object]` | Yes | Closed tasks + defects from state-manager: `{ id, type, title, status, severity }` |
| `changelog_diff` | `string` | No | Raw diff of changelog.md between two tags (supplementary context only) |
| `target_audience` | `string` | No | `"technical"` \| `"stakeholder"` \| `"end_user"`. Default: `"technical"` |
| `version_tag` | `string` | No | Release tag appended to output filename (`RELEASE_NOTES-<tag>.md`). Defaults to current `registry.json` version |
| `dry_run` | `boolean` | No | If true, return preview without writing `RELEASE_NOTES.md`. Default: `false` |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["work_items"],
  "properties": {
    "adr_index": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "title"],
        "properties": {
          "id":             { "type": "string" },
          "title":          { "type": "string" },
          "breaking_change":{ "type": "boolean" },
          "migration_note": { "type": "string" }
        }
      }
    },
    "requirements": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "title"],
        "properties": {
          "id":     { "type": "string" },
          "title":  { "type": "string" },
          "impact": { "type": "string", "enum": ["breaking", "non_breaking"] }
        }
      }
    },
    "work_items": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "type", "title", "status"],
        "properties": {
          "id":       { "type": "string" },
          "type":     { "type": "string", "enum": ["FEATURE", "TASK", "BUG"] },
          "title":    { "type": "string" },
          "status":   { "type": "string", "enum": ["open", "closed"] },
          "severity": { "type": "string", "enum": ["low", "medium", "high", "critical"] }
        }
      }
    },
    "changelog_diff":  { "type": "string" },
    "target_audience": { "type": "string", "enum": ["technical", "stakeholder", "end_user"], "default": "technical" },
    "version_tag":     { "type": "string", "pattern": "^v?[0-9]+\\.[0-9]+\\.[0-9]+$" },
    "dry_run":         { "type": "boolean", "default": false }
  }
}
```

---

## 4. Required Context

- `work_items` from state-manager is mandatory. If `work_items` is missing or empty → fail closed: return an error bundle (`release_notes_md: ""`, `sections: []`) with reason `missing_work_items`, never a fabricated release note.
- `adr_index` and `requirements` are optional but required for the Breaking Changes and Migration Notes sections — those sections are omitted (not invented) when sources are absent.
- `version_tag` defaults to the current `registry.json` version when not provided; output filename is `RELEASE_NOTES-<tag>.md` (e.g. `RELEASE_NOTES-v4.3.0.md`).
- `changelog_diff` is supplementary context only — it never creates items on its own; every item still requires a work-item, ADR, or requirement source.

---

## 5. Execution Logic

```
Step 1 — Classify work items into sections
  New Features  ← work_items where type == "FEATURE" AND status == "closed"
  Improvements  ← work_items where type == "TASK"    AND status == "closed"
  Bug Fixes     ← work_items where type == "BUG"     AND status == "closed"
  Known Issues  ← work_items where type == "BUG"     AND status == "open"
                  AND severity IN ("high", "critical")
  Open low/medium bugs and open FEATURE/TASK items are excluded (reported as counts only).
  Output: section_buckets { features[], improvements[], fixes[], known_issues[] }

Step 2 — Derive breaking changes and migration notes
  Breaking Changes ← adr_index entries with breaking_change == true
                      PLUS requirements with impact == "breaking".
  Migration Notes  ← migration_note of each breaking ADR
                      PLUS architecture modules flagged deprecated (when present in context).
  IF any breaking change exists → migration_required = true; each breaking item
    MUST carry at least one migration sentence (ADR note or generated pointer to
    deployment-strategy runbook; flagged as needs_owner_review when generated).
  Output: breaking_changes[], migration_required (boolean)

Step 3 — Apply audience transformation
  technical   → preserve all IDs, code snippets, API contract details verbatim.
  stakeholder → strip internal IDs; rewrite as business outcomes
                ("Users can now …", "Performance improved …"); no code snippets.
  end_user    → plain consumer language; no acronyms, no internal IDs, no
                implementation detail; emphasize user-visible benefits only.
  Summary section is written last, in the voice of the target audience,
    covering counts per section + migration_required flag.
  Output: release_notes_md (full markdown document)

Step 4 — Assemble sections[] index
  sections[] = [{ name, item_count, item_ids[] }] for each non-empty standard
    section: Summary, New Features, Improvements, Bug Fixes, Breaking Changes,
    Migration Notes, Known Issues. Empty sections are omitted from the document
    and recorded with item_count 0 in feedback (not in sections[]).
  Output: sections[]

Step 5 — Honour dry_run and assemble output
  Compose: release_notes_md, sections, breaking_changes, migration_required,
    output_filename, files_written, metrics, feedback.
  IF dry_run == true: files_written = [] (preview only, no write).
  ELSE: files_written = ["RELEASE_NOTES-<version_tag>.md"].
  Output: complete evidence bundle
```

---

## 6. Outputs

| Field | Type | Description |
|-------|------|-------------|
| `release_notes_md` | `string` | Full formatted `RELEASE_NOTES.md` markdown for the target audience |
| `sections` | `array[object]` | Section index: `{ name, item_count, item_ids[] }` for each non-empty section |
| `breaking_changes` | `array[object]` | Breaking items: `{ source_id, title, migration_note }` |
| `migration_required` | `boolean` | `true` when any breaking change exists (signals deployment-strategy to include a migration runbook) |
| `output_filename` | `string` | `RELEASE_NOTES-<version_tag>.md` |
| `files_written` | `array[string]` | Paths written; always `[]` when `dry_run: true` |
| `metrics` | `object` | tokens_in, tokens_out, duration_ms, items_produced, version |
| `feedback` | `array[object]` | Backpropagate routes to doc-maintainer or deployment-strategy |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["release_notes_md", "sections", "breaking_changes", "migration_required", "metrics", "feedback"],
  "properties": {
    "release_notes_md":   { "type": "string" },
    "sections": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["name", "item_count", "item_ids"],
        "properties": {
          "name":       { "type": "string" },
          "item_count": { "type": "integer", "minimum": 0 },
          "item_ids":   { "type": "array", "items": { "type": "string" } }
        }
      }
    },
    "breaking_changes": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["source_id", "title"],
        "properties": {
          "source_id":      { "type": "string" },
          "title":          { "type": "string" },
          "migration_note": { "type": "string" }
        }
      }
    },
    "migration_required": { "type": "boolean" },
    "output_filename":    { "type": "string" },
    "files_written":      { "type": "array", "items": { "type": "string" } },
    "metrics":  { "$ref": "#/$defs/metrics" },
    "feedback": { "type": "array", "items": { "$ref": "#/$defs/feedback_entry" } }
  },
  "$defs": {
    "metrics": {
      "type": "object",
      "required": ["tokens_in", "tokens_out", "duration_ms", "items_produced", "version"],
      "properties": {
        "tokens_in":      { "type": "integer" },
        "tokens_out":     { "type": "integer" },
        "duration_ms":    { "type": "integer" },
        "items_produced": { "type": "integer" },
        "version":        { "type": "string" }
      }
    },
    "feedback_entry": {
      "type": "object",
      "required": ["type", "from_skill", "reason"],
      "properties": {
        "type":         { "type": "string", "enum": ["backpropagate", "info", "warning"] },
        "from_skill":   { "type": "string" },
        "target_skill": { "type": "string" },
        "reason":       { "type": "string" },
        "evidence":     { "type": "object" }
      }
    }
  }
}
```

---

## 7. Audience Transformation Rules (content contract)

| Rule | Condition | Behavior |
|------|-----------|----------|
| `technical_full_fidelity` | `target_audience == "technical"` | Preserve all IDs, code snippets, API contract details |
| `stakeholder_business_voice` | `target_audience == "stakeholder"` | Strip internal IDs; rewrite as business outcomes; no code snippets |
| `end_user_plain_language` | `target_audience == "end_user"` | Consumer-facing language; no acronyms, no internal IDs, benefits only |
| `breaking_change_always_explicit` | Any breaking change exists | Breaking Changes + Migration Notes sections present in ALL audiences (wording adapted, facts identical) |
| `no_source_no_item` | Item lacks a work-item/ADR/requirement source | Omit the item; report in `feedback` — never invent release content |
| `migration_flag` | Any breaking change exists | `migration_required: true`, warning routed to deployment-strategy |

---

## 8. Rules & Constraints

- Every listed item MUST trace to a source artifact (work item, ADR, or requirement). Unsourced items are omitted, never hallucinated.
- `target_audience: "stakeholder"` and `"end_user"` MUST NOT contain internal IDs, file paths, or code snippets.
- `target_audience: "technical"` MUST preserve API changes and migration code snippets where the source ADR provides them.
- Breaking-change facts MUST be identical across audiences — only wording changes.
- `dry_run: true` MUST NOT write any files: `files_written` is always `[]` in dry-run mode.
- Maximum items per section: 100. Additional items are summarized as `{ count: N, sample_ids: [...] }`.
- No network calls. No secrets in release notes — strip any credential-like strings found in `changelog_diff`.

---

## 9. Security Considerations

- `changelog_diff` is untrusted free text: scan for credential-like patterns (`ghp_`, `KEY=`, `SECRET=`, tokens) and strip before inclusion; emit a warning in `feedback` when stripping occurs.
- Never include secret values, internal URLs, or customer-identifying data in any audience variant.
- The skill writes documentation only — it never modifies work items, ADRs, or requirements.
- `end_user` output MUST NOT leak internal system names, codenames, or employee references.

---

## 10. Token Optimization

- Operate on work-item headers (id/type/title/status/severity) — do not load full work-item bodies or ADR narratives.
- Each release item: id + rewritten title only (≤ 30 tokens per item); details link back to source IDs.
- Cap sections at 100 items each — summarize excess as `{ count: N }`.
- `changelog_diff` is scanned for section hints only, not reproduced verbatim.

---

## 11. Quality Checklist

- [ ] 3 closed FEATURE + 2 closed BUG inputs yield 3 New Features + 2 Bug Fixes items
- [ ] Breaking-change ADR produces a Breaking Changes section with at least one migration note
- [ ] `stakeholder` output contains no internal IDs or code snippets
- [ ] `technical` output preserves API changes and migration code snippets
- [ ] `end_user` output contains no acronyms, IDs, or internal jargon
- [ ] `migration_required` is `true` iff at least one breaking change exists
- [ ] `files_written` is `[]` when `dry_run: true`; otherwise contains `RELEASE_NOTES-<tag>.md`
- [ ] Every item traces to a source artifact; unsourced candidates reported in `feedback`
- [ ] `metrics` populated with execution data
- [ ] Output is valid JSON matching output schema

---

## 12. Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| `work_items` input missing or empty | Return error bundle: `release_notes_md: ""`, reason `missing_work_items` — fail safe, never fabricated notes |
| `version_tag` malformed | Fall back to current `registry.json` version; warn in feedback |
| `target_audience` unrecognized | Default to `"technical"`; warn in feedback |
| `adr_index` missing | Omit Breaking Changes / Migration Notes; note omission in feedback (not an error) |
| Credential-like string in `changelog_diff` | Strip it, emit security warning, continue |
| Zero closed items in release | Emit Summary + Known Issues (if any) with info feedback: "No closed items — verify release scope" |

---

## 13. Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Override |
|------|---------|---------|----------|
| Release notes approval | Non-dry-run run completes | 3600s | Human approves `release_notes_md` before the file is published outward |
| Breaking change present | `migration_required: true` | 7200s | Human confirms Migration Notes accuracy; deployment-strategy must include a migration runbook |

When a HITL gate is triggered, the orchestrator presents `release_notes_md` (in the requested audience voice) along with `breaking_changes` for awareness. The user may:
- Approve the notes as-is (orchestrator writes `files_written`)
- Request re-targeting to a different audience (skill re-runs with new `target_audience`)
- Send breaking-change items back to the architect for migration-note correction

---

## 14. Skill Composition

`release-notes-generator` runs in `phase-10b-async` (`full-pipeline.json`) alongside `doc-maintainer` and `work-item-exporter`, consuming state-manager and ADR outputs:

```yaml
name: phase-10b-async
composes:
  - skill: release-notes-generator
    version: "^1.0.0"
    input_map:
      adr_index:       "adr_index_output"
      requirements:    "requirements_output"
      work_items:      "state_closed_work_items"
      changelog_diff:  "changelog_diff"
      target_audience: "session_context.release_audience"
      version_tag:     "session_context.release_tag"
      dry_run:         "session_context.dry_run"
    output_map:
      release_notes_md:   "release_notes_markdown"
      breaking_changes:   "release_breaking_changes"
      migration_required: "release_migration_required"
```

The orchestrator reads `migration_required` after this phase:
- `true` → warn and require deployment-strategy to include a migration runbook before release sign-off
- `false` → continue to release publication

### Feedback Routes

| Target Skill | Condition | Description |
|---|---|---|
| `doc-maintainer` | Notes published | Backpropagate so living docs reflect the released state |
| `deployment-strategy` | `migration_required: true` | Require a migration runbook covering each breaking change |
| `work-item-exporter` | Notes published | Attach the release-notes reference to exported work items |

### Changelog

| Version | Date | Change |
|---------|------|--------|
| 1.0.0 | 2026-09-29 | Initial release — artifact-sourced release synthesis with audience transformation and migration-required flagging |

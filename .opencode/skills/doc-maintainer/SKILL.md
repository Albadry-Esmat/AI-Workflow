---
name: doc-maintainer
version: 1.1.0
domain: documentation
description: Use after any system change to detect what documentation is outdated and update or create .md files in /docs. Triggers on: "update the docs", "docs are outdated", "keep docs in sync", "documentation is wrong", "sync documentation", after code or architecture changes.
author: system
---

## Purpose

Act as a continuous documentation maintenance engine — not a manual writer. Automatically detect changes across the system (skills, agents, workflows, architecture, security, deployment, prompts, context), decide the appropriate documentation action (create, update, multi-file sync), execute it, and verify consistency. Reduces manual documentation effort to near zero while keeping `/docs` always aligned with the latest system state.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `change_event` | `object` | Yes | Description of the detected change (type, scope, details) |
| `change_type` | `string` | Yes | Category: `skill`, `agent`, `workflow`, `architecture`, `security`, `deployment`, `prompt`, `context`, `ui_ux`, `testing`, `localization`, `governance`, `version` |
| `scope` | `string` | Yes | `isolated` (single domain) or `system_wide` (cross-domain) |
| `details` | `object` | Yes | Specific change details (name, diff, new fields, new files) |
| `docs_snapshot` | `object` | No | Current state of `/docs` (file list, versions, last-modified dates) |
| `detection_mode` | `string` | No | How changes are detected: `event_driven` (explicit trigger), `git_diff` (parse git output), `full_scan` (drift check without trigger). Default: `event_driven` |
| `dry_run` | `boolean` | No | If `true`, produce the maintenance report without writing any files. Default: `false` |
| `git_diff_raw` | `string` | No | Raw output of `git diff` — required when `detection_mode` is `git_diff` |
| `staleness_threshold_days` | `integer` | No | Files not updated within this many days are flagged as stale during `full_scan`. Default: `30` |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "change_event": { "type": "object", "description": "Full change description" },
    "change_type": {
      "type": "string",
      "enum": ["skill", "agent", "workflow", "architecture", "security", "deployment", "prompt", "context", "ui_ux", "testing", "localization", "governance", "version"]
    },
    "scope": { "type": "string", "enum": ["isolated", "system_wide"] },
    "details": {
      "type": "object",
      "properties": {
        "name": { "type": "string" },
        "domain": { "type": "string" },
        "new_fields": { "type": "array", "items": { "type": "string" } },
        "removed_fields": { "type": "array", "items": { "type": "string" } },
        "changed_fields": { "type": "array", "items": { "type": "object" } },
        "new_files": { "type": "array", "items": { "type": "string" } },
        "description": { "type": "string" }
      },
      "required": ["name", "domain"]
    },
    "docs_snapshot": {
      "type": "object",
      "properties": {
        "files": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "path": { "type": "string" },
              "version": { "type": "string" },
              "last_updated": { "type": "string" }
            }
          }
        }
      }
    },
    "detection_mode": {
      "type": "string",
      "enum": ["event_driven", "git_diff", "full_scan"],
      "default": "event_driven"
    },
    "dry_run": { "type": "boolean", "default": false },
    "git_diff_raw": { "type": "string", "description": "Raw git diff output (required when detection_mode is git_diff)" },
    "staleness_threshold_days": { "type": "integer", "minimum": 1, "default": 30 }
  },
  "required": ["change_event", "change_type", "scope", "details"]
}
```

## Required Context

- Current state of `/docs` directory — file list, versions, and cross-reference map.
- Registry (`skills/registry.json`) for skill-related changes.
- Agent configuration (`opencode.json` or `docs/agents.md`) for agent-related changes.

## Execution Logic

```
Step 0 — Snapshot current doc state
  Before modifying any file, record all /docs/*.md paths with: version header, char count, last_updated.
  Store in rollback_info.snapshot. This is the restore point if a MULTI_UPDATE fails mid-run.
  If snapshot creation fails, log warning, set rollback_info: null, and continue.
  Output: rollback_info.snapshot

Step 0.5 — Parse detection source (mode-dependent)
  event_driven: use change_event input as-is. Skip to Step 1.
  git_diff: parse git_diff_raw into change_event —
    extract modified file paths, added/removed lines,
    map paths to change_types using Domain Mapping table,
    emit one change_event per detected file group.
    If git_diff_raw is empty or unparseable → return error: {"error": "UNPARSEABLE_DIFF"}.
  full_scan: compare registry versions vs docs/skills-registry.md, agent config vs docs/agents.md,
    architecture vs docs/architecture.md, workflow vs docs/workflows.md.
    Emit one change_event per detected drift item.
    If no drift found → set action_type = "no_action_needed", log in changelog.md, halt.
  Output: normalized change_event

Step 1 — Classify the change
  Map change_type to the domain mapping table below.
  If scope is "system_wide", flag all domains that are transitively affected.
  Output: impact list (domains, files, action types)

Step 2 — Check if a new domain needs a doc file
  If change_type introduces a domain that has no file in /docs:
    → action = CREATE
  If change_type maps to an existing file in /docs:
    → action = UPDATE
  If change_type affects 2+ existing files simultaneously:
    → action = MULTI_UPDATE
  Output: action decision with justification

Step 3 — Execute CREATE
  a) Determine file name (kebab-case from domain name).
  b) Generate file content following /docs structure conventions:
     - H1 title with subtitle
     - Version header
     - Purpose section
     - Scope section
     - Key concepts
     - Integration points (links to related /docs files)
     - Rules section
  c) Add cross-references to/from related existing docs.
  d) Write file to /docs/<filename>.md.
  Output: new file path, content summary

Step 4 — Execute UPDATE
  a) Load target file from /docs.
  b) Determine which sections need changes (compare details against current content).
  c) Apply targeted edits — preserve all unchanged sections.
  d) Bump file version (PATCH for clarification, MINOR for new section, MAJOR for structural change).
  e) Update "Last updated" date.
  Output: changed sections, version diff

Step 5 — Execute MULTI_UPDATE
  a) Load all affected files from /docs.
  b) For each file, apply targeted edits per Step 4.
  c) Cross-check references between files — update stale cross-references.
  d) If a new term or concept appears across multiple files, ensure consistent definition.
  Output: per-file change list, cross-reference alignment report

Step 6 — Verify consistency
  a) Run consistency checks (see Quality Checklist).
  b) If conflicts found (duplicate definitions, contradictory rules, stale references):
     - Resolve by keeping the most specific definition
     - Add cross-reference links where duplication was removed
     - Document resolution in output
  c) If no conflicts, confirm consistency.
  Output: consistency report

Step 6.5 — Staleness detection
  For each file in docs_snapshot, compute days_since_update from last_updated.
  If days_since_update > staleness_threshold_days:
    Check whether the corresponding system component changed since last_updated.
    If component changed and doc was not updated → flag as stale with reason.
  Also scan for: broken cross-references (links to headings that no longer exist),
    version mismatches (registry version vs. docs version for same skill),
    missing changelog entries for known recent changes.
  Output: staleness_issues array

Step 7 — Generate change report
  Assemble the final output with decision summary, files affected, changes made.
  Output: complete maintenance report

Step 7.5 — Dry-run guard (if dry_run: true)
  Do NOT write any files.
  Mark all files_affected entries as "would_create" / "would_update" instead of "created" / "updated".
  Populate dry_run_report with: list of files that would be created, sections that would change,
    estimated impact score (lines added, version bumps, new cross-references).
  Return dry_run_report. Do not call Step 3, 4, or 5 if dry_run is true.
  Output: dry_run_report
```

## Domain Mapping

| change_type | Target Doc File | Trigger Condition |
|-------------|----------------|-------------------|
| `skill` | `docs/skills-registry.md` | New/modified skill file in `skills/<domain>/` |
| `agent` | `docs/agents.md` | Agent config change in `opencode.json` |
| `workflow` | `docs/workflows.md` | Pipeline sequence or mode change |
| `architecture` | `docs/architecture.md` | Component model, data flow, or orchestration change |
| `security` | `docs/security.md` | Policy, permission, or threat model change |
| `deployment` | `docs/deployment.md` | Environment, rollback, or CI/CD change |
| `prompt` | `docs/prompt-engineering.md` | Skill template, schema, or token strategy change |
| `context` | `docs/context-engineering.md` | Memory protocol, compression, or budget change |
| `ui_ux` | `docs/ui-ux.md` | Output format, design system, or accessibility change |
| `testing` | `docs/testing.md` | Test levels, coverage, or quality gate change |
| `localization` | `docs/localization.md` | Locale, translation, or RTL change |
| `governance` | `docs/governance.md` | Gate rules, approval process, or enforcement change |
| `version` | `docs/versioning.md` + `docs/changelog.md` | Any version bump anywhere in the system |
| NEW domain (unmapped) | Create `docs/<domain>.md` | No existing file covers the new domain |

## Secondary (Transitive) Updates

When one change_type triggers, these additional files may also need updates:

| Primary Change | Also Check |
|----------------|------------|
| `skill` | `docs/development-standards.md` (if new standards introduced) |
| `agent` | `docs/workflows.md` (if new agent changes pipeline flow) |
| `architecture` | `docs/deployment.md` (if deployment model affected) |
| `workflow` | `docs/agents.md` (if agent responsibilities change) |
| `security` | `docs/governance.md` (if new approval gates needed) |
| `deployment` | `docs/testing.md` (if new quality gates needed) |
| Any change | `docs/changelog.md` (always) |

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `decision_summary` | `object` | What changed, why it matters, impact scope |
| `action_type` | `string` | `create`, `update`, `multi_update`, `no_action_needed` |
| `files_affected` | `array[object]` | Files changed (path, action, version_before, version_after) |
| `changes_made` | `array[object]` | Per-file change descriptions |
| `new_files` | `array[object]` | New files created (path, purpose, summary) |
| `consistency_report` | `object` | Verification results, conflicts resolved, cross-reference alignment |
| `dry_run_report` | `object` | Present when `dry_run: true` — files that would be created/updated without writing |
| `staleness_issues` | `array[object]` | Files flagged as stale (path, days_since_update, reason, recommended_action) |
| `rollback_info` | `object` | Pre-edit snapshot and restoration instructions (populated before any write) |
| `metrics` | `object` | Execution metrics (files_checked, files_changed, tokens_in, tokens_out, duration_ms, version) |
| `feedback` | `array[object]` | Feedback entries for cross-skill communication |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "decision_summary": {
      "type": "object",
      "properties": {
        "trigger": { "type": "string" },
        "rationale": { "type": "string" },
        "scope": { "type": "string" },
        "action": { "type": "string" }
      },
      "required": ["trigger", "action"]
    },
    "action_type": { "type": "string", "enum": ["create", "update", "multi_update", "no_action_needed"] },
    "files_affected": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "path": { "type": "string" },
          "action": { "type": "string", "enum": ["created", "updated", "unchanged"] },
          "version_before": { "type": "string" },
          "version_after": { "type": "string" }
        },
        "required": ["path", "action"]
      }
    },
    "changes_made": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "file": { "type": "string" },
          "sections_changed": { "type": "array", "items": { "type": "string" } },
          "summary": { "type": "string" }
        },
        "required": ["file", "summary"]
      }
    },
    "new_files": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "path": { "type": "string" },
          "purpose": { "type": "string" },
          "content_summary": { "type": "string" }
        },
        "required": ["path", "purpose"]
      }
    },
    "consistency_report": {
      "type": "object",
      "properties": {
        "verified": { "type": "boolean" },
        "duplicates_found": { "type": "integer" },
        "duplicates_resolved": { "type": "integer" },
        "stale_references_found": { "type": "integer" },
        "stale_references_fixed": { "type": "integer" },
        "conflicts_resolved": { "type": "integer" }
      },
      "required": ["verified"]
    },
    "metrics": {
      "type": "object",
      "properties": {
        "files_checked": { "type": "integer" },
        "files_changed": { "type": "integer" },
        "tokens_in": { "type": "integer" },
        "tokens_out": { "type": "integer" },
        "duration_ms": { "type": "integer" },
        "version": { "type": "string" }
      },
      "required": ["files_checked", "files_changed", "tokens_in", "tokens_out", "duration_ms", "version"]
    },
    "feedback": {
      "type": "array",
      "items": { "$ref": "#/$defs/feedback_entry" }
    }
  },
  "required": ["decision_summary", "action_type", "files_affected", "changes_made", "consistency_report", "metrics", "feedback"],
  "$defs": {
    "feedback_entry": {
      "type": "object",
      "properties": {
        "type": { "type": "string", "enum": ["backpropagate", "info", "warning"] },
        "from_skill": { "type": "string" },
        "target_skill": { "type": "string" },
        "reason": { "type": "string" },
        "evidence": { "type": "object" }
      },
      "required": ["type", "from_skill", "reason"]
    }
  }
}
```

## Rules & Constraints

- Do NOT create a new doc file if an existing file covers the same domain. Reuse + extend instead.
- Every doc file must cross-reference at least 2 other doc files (or explain why it cannot).
- No file may exceed 300 lines. Split at 300 lines into sub-sections with `_` suffix (e.g., `security-auth.md`, `security-data.md`).
- Version bumps follow semver: PATCH for clarification, MINOR for new section, MAJOR for structural change.
- `changelog.md` MUST be updated on every maintenance run, even if no files changed (log the inspection).
- Never use first-person ("I", "we") — use third-person or imperative voice.
- Never include raw data dumps — summarize and link.

## Security Considerations

- Do NOT expose internal file paths outside `/docs` in cross-references.
- The skill inspects file content but must NOT modify files outside `/docs`.
- Change descriptions in the output must NOT include credentials, tokens, or configuration secrets.
- If a change event contains sensitive data, strip it before logging in the consistency report.

## Token Optimization

- Load only the sections of each doc file that need comparison (use heading anchors).
- Compress change descriptions: one sentence per changed section.
- Reuse existing cross-reference text when adding links — avoid rewriting established link descriptions.
- Limit consistency report to 500 tokens (truncate long duplicate lists with `"truncated": true`).
- Cache `docs_snapshot` between runs — only re-check files whose last_modified changed.

## Quality Checklist

- [ ] All affected files have correct version bumps
- [ ] No duplicate definitions across any two doc files (exact match or semantic overlap)
- [ ] Every cross-reference in changed files still resolves to an existing heading
- [ ] New files follow `/docs` structure conventions (H1 title, version header, purpose, scope)
- [ ] `changelog.md` includes an entry for this maintenance run
- [ ] Consistency report shows `verified: true` or lists all unresolved conflicts
- [ ] No file exceeds 300 lines

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| Change type does not map to any domain | Create new doc file under `docs/<change_type>.md`, log as NEW domain |
| File to update not found | Log warning, create file from template, return `action_type: create` |
| Consistency check finds irresolvable conflict | Flag conflict in report, set `verified: false`, do NOT modify conflicting content |
| Token budget exhausted mid-run | Save partial results, resume from last completed step, flag `"partial": true` |
| Dependency cycle in transitive updates | Process primary changes only, flag transitive updates as pending in feedback |
| Snapshot creation fails | Log warning, set `rollback_info: null`, continue without restore capability |
| `git_diff_raw` empty or unparseable | Return error: `{"error": "UNPARSEABLE_DIFF"}`, halt |
| MULTI_UPDATE partially completes then fails | Restore from snapshot if available; else report partial changes with `"partial": true` |
| `full_scan` finds no drift | Return `action_type: "no_action_needed"`, log inspection entry in `changelog.md` |

## 12. Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Auto-Continue? | Behavior |
|------|---------|---------|----------------|----------|
| New domain file | `action_type` is `create` for an unmapped domain | 300s | No | Pause, emit new file preview for approval |
| File split | A file would exceed 300 lines and requires splitting into two | 300s | No | Pause, show proposed split structure |

- If `dry_run: true`, all gates are bypassed. Full dry_run_report is returned without pausing.
- `update` and `multi_update` actions do NOT trigger gates — only structural `create` and splits.
- Gate timeout action: `auto_continue` with `gate_skipped: true` recorded in consistency_report.

## 13. Skill Composition

`doc-maintainer` composes `schema-validator` to verify structure of newly generated documentation files before writing to disk:

```yaml
composes:
  - skill: schema-validator
    version: "^1.0.0"
    input_map:
      data: "new_file_content_parsed"
      schema: "docs_file_schema"
    output_map:
      issues: "doc_structure_issues"
```

Used only when `action_type` is `create`. If schema-validator returns any `error`-severity issues, the CREATE is aborted and the failure is recorded in `consistency_report.conflicts_resolved`. The generated file content is included in `dry_run_report` regardless so the issue can be reviewed.

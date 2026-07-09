# artifacts/

This directory stores pipeline-generated spec artifacts produced by the AI Workflow
orchestrator at the end of each successful pipeline run.

## Files in this directory

| Pattern | Description |
|---------|-------------|
| `spec-<timestamp>.md` | Full pipeline spec artifact (requirements, architecture, tasks, test plan) |
| `spec-latest.md` | Symlink always pointing to the most recent spec artifact |
| `spec-<timestamp>-partial.md` | Partial artifact written when the pipeline did not complete all phases |
| `clarifications-<timestamp>.md` | Clarification Q&A from the `clarify` skill (FEATURE-012) |
| `cost-history.json` | Running token cost history (FEATURE-018, when implemented) |

## Artifact Schema

Each `spec-*.md` file follows this structure (also available as structured fields):

```
# Spec Artifact — <run_id>

**Pipeline:** <pipeline_name>
**Run ID:** <session_id>
**Timestamp:** <ISO8601>
**Status:** complete | partial

---

## Requirements

<requirements table: id | type | statement | priority>

---

## Architecture

<architecture modules: name | responsibility | dependencies>

---

## Tasks

<task breakdown: id | description | complexity | status>

---

## Test Plan

<test cases: id | description | type | coverage_target>

---

## Project Context (Constitution)

<project_context snapshot from CONSTITUTION.md at time of run>
```

## Git tracking

By default, `artifacts/*.md` are **not tracked by git**. The `.gitignore` excludes them.

To opt-in to tracking artifacts (e.g., for audit or compliance purposes):

```bash
git add -f artifacts/spec-latest.md
```

Or permanently remove the gitignore exclusion:

```bash
# In .gitignore, change:
#   artifacts/*.md
# to:
#   # artifacts/*.md   ← commented out to track artifacts
```

## See Also

- Orchestrator: `.opencode/skills/orchestrator/SKILL.md` — Step 7 (artifact write)
- Schema doc: `docs/spec-artifact.md`
- FEATURE-007: `work-items/features/FEATURE-007-spec-artifact-on-disk/`

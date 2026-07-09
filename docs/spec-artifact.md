# Spec Artifact Schema

> **Reference doc for FEATURE-007 — Spec Artifact on Disk.**
> This document describes the schema, lifecycle, and usage of spec artifacts written
> to the `artifacts/` directory by the orchestrator.

## Overview

At the end of every successful pipeline run the orchestrator writes a spec artifact
to `artifacts/spec-<ISO-timestamp>.md`. The artifact captures the complete output of
the pipeline in a single, human-readable, version-controllable document.

## File Naming

| Pattern | When written |
|---------|-------------|
| `artifacts/spec-<ts>.md` | Pipeline completed all phases successfully |
| `artifacts/spec-<ts>-partial.md` | Pipeline failed or was halted before phase-1-requirements |
| `artifacts/spec-latest.md` | Symlink: always points to the most recent `spec-<ts>.md` |

`<ts>` is the ISO 8601 timestamp with `:` and `.` replaced by `-` to ensure filename safety:
```
2026-07-09T14-30-00-000Z
```

## Markdown Schema

```markdown
# Spec Artifact — <run_id>

**Pipeline:** <pipeline_name>          <!-- e.g. full-pipeline v3.3.0 -->
**Run ID:** <session_id>               <!-- UUID -->
**Timestamp:** <ISO8601>               <!-- e.g. 2026-07-09T14:30:00.000Z -->
**Status:** complete | partial

---

## Requirements

| ID | Type | Statement | Priority |
|----|------|-----------|----------|
| REQ-XXX-001 | F | The system SHALL ... | high |

---

## Architecture

| Module | Responsibility | Depends On |
|--------|---------------|------------|
| user-service | Manages user accounts and auth | — |

---

## Architecture Decision Records

| ID | Decision | Status |
|----|----------|--------|
| ADR-001 | Use PostgreSQL for persistence | accepted |

---

## Tasks

| ID | Description | Complexity | Status |
|----|-------------|------------|--------|
| TASK-0001 | Implement user registration endpoint | 3 | pending |

---

## Test Plan

| ID | Description | Type | Coverage Target |
|----|-------------|------|----------------|
| TEST-001 | User registration happy path | unit | REQ-USR-001 |

---

## Project Context (Constitution)

**Project:** <project_name>
**Tech Stack:** <tech_stack summary>
**Constraints Applied:** <architectural_constraints[]>
```

## Structured Fields (JSON)

The orchestrator also writes a machine-readable JSON object to `session_context` after
each run (not written to disk separately — embedded in the session file):

```json
{
  "run_id": "string (UUID)",
  "timestamp": "string (ISO8601)",
  "pipeline": "string",
  "status": "complete | partial",
  "requirements": [
    {
      "id": "string (REQ-XXX-NNN)",
      "type": "F | NF | C",
      "statement": "string",
      "priority": "critical | high | medium | low"
    }
  ],
  "architecture": {
    "modules": [
      { "name": "string", "responsibility": "string", "depends_on": ["string"] }
    ],
    "adrs": [
      { "id": "string", "decision": "string", "status": "proposed | accepted | deprecated" }
    ]
  },
  "tasks": [
    {
      "id": "string (TASK-NNNN)",
      "description": "string",
      "complexity": "integer (1-8)",
      "status": "pending | in_progress | done"
    }
  ],
  "test_plan": {
    "test_cases": [
      {
        "id": "string (TEST-NNN)",
        "description": "string",
        "type": "unit | integration | e2e",
        "coverage_target": "string (REQ ID)"
      }
    ]
  },
  "constitution": {
    "project_name": "string",
    "tech_stack": [{ "layer": "string", "decision": "string" }],
    "architectural_constraints": ["string"],
    "constitution_token_count": 1234,
    "constitution_truncated": false
  }
}
```

## Size Limits

| Limit | Value | Behavior on exceed |
|-------|-------|-------------------|
| Max artifact size | 50 KB | Truncate `tasks[]` and `test_plan.test_cases[]` from the bottom; emit `WARN: spec_artifact_truncated` |
| Max requirements | 100 | As per requirement-analyzer rule |
| Max tasks | 500 | Truncate with note: `"<N> additional tasks omitted — see session state"` |

## Opt-in Git Tracking

By default `artifacts/*.md` is git-ignored. To track:

```bash
# Track a specific artifact:
git add -f artifacts/spec-2026-07-09T14-30-00-000Z.md

# Track latest symlink:
git add -f artifacts/spec-latest.md

# Always track all artifacts (edit .gitignore):
# Change: artifacts/*.md
# To:   # artifacts/*.md
```

## See Also

- Directory README: `artifacts/README.md`
- Orchestrator write logic: `.opencode/skills/orchestrator/SKILL.md` Step 7
- FEATURE-007: `work-items/features/FEATURE-007-spec-artifact-on-disk/`
- FEATURE-015: Living Spec / Drift Detection (`work-items/features/FEATURE-015-*`)

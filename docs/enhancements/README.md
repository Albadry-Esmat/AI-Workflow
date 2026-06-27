# Enhancement Planning

This directory holds your project's enhancement phases — structured plans for evolving
the framework as you use it on your own project.

## Convention

Each file represents one delivery sprint or milestone:

```
docs/enhancements/
  README.md                           ← This file
  phase-1-v1.1.0-your-phase-title.md  ← Your first enhancement sprint
  phase-2-v1.2.0-your-phase-title.md  ← ...and so on
```

## File Template

Copy this structure when planning a new enhancement phase:

```markdown
# Phase N — vX.Y.Z: Title

**Version target:** vX.Y.Z
**Story points:** N
**Tasks:** TASK-XXXX – TASK-YYYY

## Goals
What this phase delivers.

## Tasks
| ID | Title | Points | Status |
|----|-------|--------|--------|
| TASK-XXXX | Description | N | pending |

## Risks
| Risk | Impact | Mitigation |
|------|--------|-----------|
```

## Workflow

1. Create a new phase file when starting a major sprint
2. Track tasks in `work-items/features/` and `work-items/TASK-*.md`
3. Update status as tasks complete
4. Bump `docs/changelog.md` when the phase ships

# Bug Index

**Last updated:** 2026-06-24 | **Total bugs:** 0 open

Central catalog of all bug reports. Bugs use the `bugs/BUG-NNN-name/` folder structure (new format, v4.4.0+).

---

## Open Bugs

*No open bugs.*

| ID | Title | Severity | Status | Reported |
|----|-------|----------|--------|---------|
| — | — | — | — | — |

---

## Closed Bugs

*Historical bugs resolved during prior releases are documented in `docs/changelog.md` under their respective version entries.*

Key resolved bugs by version:

| Version | Bug | Description |
|---------|-----|-------------|
| v4.0.1 | BUG-1 | `skill-graph.yaml`: 6 wrong node IDs in edges for SKL-055/056 |
| v4.0.1 | BUG-2 | `skills/index.yaml`: Wrong `depends_on` IDs for all 4 new skills |
| v4.0.1 | BUG-3 | `defect-manager/SKILL.md §13`: Stale `(SKL-030)` reference |
| v4.0.1 | BUG-4 | `orchestrator/SKILL.md`: Pipeline template table versions incorrect |
| v4.0.1 | BUG-5 | `defect-lifecycle.json`: Closure HITL gate incorrectly positioned |
| v4.0.1 | BUG-6 | `change-request.json`: Redundant phase-2-impact (invoked twice) |
| v4.0.1 | BUG-7 | `skill-graph.yaml`: Indentation inconsistency for new edges |
| v4.0.1 | BUG-8 | `skills/registry.json`: Missing `metrics`/`feedback` fields for 4 skills |
| v5.1.0 | [BUG-009](../bugs/BUG-009-feature001-wrong-action-verbs/) | `FEATURE-001/plan.md`: "Create" used for SKL-047/048 which already exist — should be "Extend" |
| v5.1.0 | [BUG-010](../bugs/BUG-010-feature004-wrong-skl-number/) | `FEATURE-004/plan.md + request.md`: SKL-049 assigned to gap-to-skill-pipeline (SKL-049 is taken by enhancement-dashboard; correct is SKL-065) |
| v5.1.0 | [BUG-011](../bugs/BUG-011-feature004-mode-vs-operation/) | `FEATURE-004/plan.md`: `mode = gap_seed` used; skill-authoring field is `operation` |
| v5.1.0 | [BUG-012](../bugs/BUG-012-missing-pipeline-enum/) | `system-state-schema.json`: `"gap-to-skill"` missing from `pipeline_template` enum |

---

## How to Report a Bug

1. Assign next `BUG-NNN` from this index
2. Create folder `work-items/bugs/BUG-NNN-short-name/`
3. Write `request.md` with the bug report (verbatim)
4. Write `plan.md` with investigation + remediation plan
5. Write `tasks.md` with fix tasks
6. Write `status.md` with initial status `Planned`
7. Add row to this index
8. If severity is CRITICAL or HIGH, also add to `work-items/backlog/backlog.md` for immediate visibility

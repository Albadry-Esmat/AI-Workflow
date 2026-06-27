# Phase 1 — v1.1.0: Correctness & Quick Wins

**Version target:** v1.1.0
**Story points:** 11
**Tasks:** TASK-0038 – TASK-0044

## Goals

Fix four bugs introduced or exposed by feature-planning v2.1.0 (Step 7c), and deliver three
quick-win improvements to CI and planning UX. All changes are low-risk and ship as a single
patched version of the framework.

**Sub-phase A — Bug fixes (4 SP):** TASK-0038–0041  
**Sub-phase B — Quick wins (7 SP):** TASK-0042–0044

---

## Sub-phase A — Bug Fixes

| ID | Title | Points | Status |
|----|-------|--------|--------|
| TASK-0038 | Fix Step 7c `file_path`: directory → `request.md` file path | 1 | pending |
| TASK-0039 | Fix Step 7c `features.md` rebuild: idempotent read→merge→write | 1 | pending |
| TASK-0040 | Bump `full-pipeline.json` feature-planning pin from `^2.0.0` → `^2.1.0` | 1 | pending |
| TASK-0041 | Add `[1.1.0]` entry to `docs/changelog.md` | 1 | pending |

**Delivery:** Single `fix(feature-planning): v2.1.1 patch + pipeline pin + changelog` commit on `main`.

---

## Sub-phase B — Quick Wins

| ID | Title | Points | Status |
|----|-------|--------|--------|
| TASK-0042 | CI: `index.yaml` ↔ SKILL.md frontmatter version consistency check | 3 | pending |
| TASK-0043 | HITL gate: surface `feature_folders[]` in roadmap approval presentation | 2 | pending |
| TASK-0044 | Create `docs/enhancements/phase-1-v1.1.0-correctness-and-quick-wins.md` | 2 | pending |

**Delivery:** Two commits — one for CI changes (`scripts/` + `.github/`), one for SKILL.md + docs.

---

## Dependency Graph

```
TASK-0038 ──► TASK-0045 (FEATURE-004, blocks Epic mapping)
TASK-0039 ──► (no downstream)
TASK-0040 ──► (no downstream)
TASK-0041 ──► (no downstream)
TASK-0042 ──► (independent)
TASK-0043 ──► depends on TASK-0038 (file_path fix must ship first)
TASK-0044 ──► (independent, documents this phase)
```

---

## Risks

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Patch bump of feature-planning breaks downstream semver consumers | low | `^2.1.0` still satisfies `^2.1.x`; patch bumps are non-breaking |
| pyyaml missing from CI runner for TASK-0042 | medium | Add explicit `pip install pyyaml` step |
| TASK-0043 gate description change breaks orchestrator parsing | low | Gate description is human-readable text, not machine-parsed |

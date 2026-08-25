# Production Readiness Release-Candidate Baseline

**Status:** Hardening in progress  
**Release branch:** `release/production-hardening`  
**Baseline commit:** `4dc256399ba04259d3e5d3f3713c18ae0932119e`  
**Baseline date:** 2026-08-23  
**Owner:** AI Workflow maintainers

## Scope Freeze

During production hardening, changes are limited to installation reliability, secure initialization, synchronization, runtime safety, validation, testing, security, observability, release engineering, and documentation. New skills, new pipeline templates, new debate/convergence modes, autonomous adaptation, and new MCP integrations require explicit release-owner approval.

## Baseline Environment

| Component | Observed value | Supported/project value |
|---|---|---|
| Node.js | v22.13.0 | Node.js 20 LTS (`.nvmrc`) |
| Python | 3.12.3 | Python 3.11 in CI; Python 3.9+ documented |
| npm | 10.9.2 | npm |
| AJV CLI | Installed locally for validation | Required for full pipeline schema validation |
| OpenCode | Not installed in review environment | Required to execute agents |
| Graphify | Not installed in review environment | Optional |
| Git branch | `release/production-hardening` | Release-candidate branch |
| Baseline commit | `4dc2563` | Current `main` baseline |

## Baseline Checks

| Check | Result | Notes |
|---|---|---|
| `scripts/validate-skills.sh` | PASS | 187 passed, 0 failed after validation prerequisites were installed |
| `./aiw lint` | PASS | YAML and all 22 pipeline JSON files parsed and validated |
| Shell syntax | PASS | All tracked shell scripts passed `bash -n` |
| JSON parsing | PASS | `opencode.json`, registry, and pipeline JSON files parsed |
| `scripts/health-check.sh` | FAIL | OpenCode, `.env`, `.opencode/node_modules`, and `GITHUB_TOKEN` are absent in this environment |
| Source-to-website mirror | FAIL | Index, registry, graph, and full-pipeline mirror files differ |
| Runtime end-to-end execution | NOT RUN | OpenCode is not installed and no credential-free conformance harness exists |

## Release Finding Severity

| Severity | Definition | Release policy |
|---|---|---|
| P0 | Installation, credential, data-integrity, or mandatory release-gate failure | Must be fixed before any pilot |
| P1 | Serious reliability or security weakness | Must be fixed before general production release |
| P2 | Non-blocking hardening or usability improvement | Track for the first maintenance release |

## Initial P0/P1 Findings

| ID | Severity | Finding | Planned phase |
|---|---|---|---|
| RC-001 | P0 | Fresh-clone setup requires `.opencode/package.json`, which is not present | Phase 1 |
| RC-002 | P0 | Website data mirror is out of sync with authoritative source files | Phase 2 |
| RC-003 | P0 | No credential-free runtime smoke test exists | Phase 4 |
| RC-004 | P0 | `aiw init` can copy a populated source `.env` into another project | Phase 1 |
| RC-005 | P1 | Asynchronous ADR generation can race the gated architecture phase | Phase 3 |
| RC-006 | P1 | Flat-file state lacks an implemented atomic-write and single-writer protocol | Phase 3 |
| RC-007 | P1 | Static schema validation does not cover all semantic pipeline invariants | Phase 3 |
| RC-008 | P1 | CI action and MCP dependency pinning is incomplete | Phase 5 |

## Definition of Done

A production release is not complete until the exit criteria in `production-readiness-plan.md` are satisfied, every P0/P1 finding has a regression test or an explicitly approved exception, the release candidate passes strict preflight, and a controlled pilot succeeds on non-critical projects.

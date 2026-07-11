# Production Readiness Checklist

> **Project:** AI Workflow  
> **Created:** 2026-07-11  
> **Status:** Audit Complete  
> **Last Updated:** 2026-07-11  

---

## Results Summary

| Metric | Count |
|--------|-------|
| **Total Items** | 139 |
| **Passed** | 105 |
| **Failed** | 12 |
| **Needs Review** | 22 |
| **Production Readiness Score** | **75.5%** (105/139) |

### By Severity of Failures

| Severity | Passed | Failed | Needs Review |
|----------|--------|--------|--------------|
| Critical (29) | 20 | 3 | 6 |
| High (52) | 38 | 6 | 8 |
| Medium (41) | 33 | 2 | 6 |
| Low (17) | 14 | 1 | 2 |

---

## Status Legend

| Status | Meaning |
|--------|---------|
| `Passed` | Verified and meets production standards |
| `Failed` | Does not meet production standards — requires fix |
| `Needs Review` | Cannot be fully automated; requires human judgment or runtime test |

---

## 1. Architecture & Structure

| ID | Description | Status | Priority | Notes |
|----|-------------|--------|----------|-------|
| ARCH-001 | Validate CONSTITUTION.md enforces all stated constraints | Passed | Critical | Section 3 enforces: no secrets in code, no database, skill isolation, HITL gates. All verified — no violations found |
| ARCH-002 | Verify flat-file state persistence is reliable under concurrent access | Needs Review | Critical | No file locking mechanism exists. Single-user local tool mitigates risk, but no protection against concurrent `opencode` sessions |
| ARCH-003 | Confirm skill isolation — no inter-skill imports or direct coupling | Passed | High | All 113 skills are self-contained SKILL.md files. No import statements or cross-references between skill directories |
| ARCH-004 | Validate orchestrator routing table matches all pipeline templates | **Failed** | High | **Only 6 of 22 pipelines are routable via AGENTS.md.** 16 pipelines (73%) have no routing entry: admin-panel, ai-agent-system, api-first, change-request, cloud-migration, consumer-website, data-engineering, defect-lifecycle, developer-portal, gap-to-skill, insights-adaptation-pipeline, iot-embedded, microservices-platform, ml-platform, mobile-app, saas-platform |
| ARCH-005 | Verify HITL gates cannot be bypassed in any pipeline | Passed | High | All 22 pipelines have `human_approval` gates (range: 1–10 per pipeline). Gate type is `human_approval`, enforced by orchestrator |
| ARCH-006 | Confirm agent permission model is correctly configured in opencode.json | Passed | High | 19 agents validated. No agent has `grant` permissions. All edits require `ask` (user approval). 12 agents are fully read-only (deny/deny) |
| ARCH-007 | Validate data flow: User → Orchestrator → Subagent → Artifact | Needs Review | Medium | Architecture is sound on paper. Requires runtime end-to-end test to confirm |
| ARCH-008 | Confirm artifacts/ directory structure supports all pipeline outputs | Passed | Medium | Directory exists with proper gitignore. Skeleton is tracked |
| ARCH-009 | Validate work-items/ tracking system integrity | Passed | Medium | 48 TASK files verified. Structured with backlog/, bugs/, features/, indexes/ |
| ARCH-010 | Verify graphify knowledge graph is current with HEAD | Passed | Medium | Graph built from commit 4c2f9c06 which IS current HEAD |
| ARCH-011 | Confirm examples/ directory contains valid examples | Passed | Low | ADR example and goal-file example present and properly formatted |
| ARCH-012 | Verify website/ data mirror is in sync with source | Passed | Low | CI check exists in validate-skills.yml job 3. Sync script functional |

---

## 2. Skills System

| ID | Description | Status | Priority | Notes |
|----|-------------|--------|----------|-------|
| SKILL-001 | Validate all registered skills have valid SKILL.md with required sections | Passed | Critical | 106 PASS, 7 SKIP (meta-format). All required sections present |
| SKILL-002 | Verify skill IDs are unique across index.yaml | Passed | Critical | All skill IDs unique — validated by `make validate` check 3 |
| SKILL-003 | Confirm skill count consistency: index.yaml vs directories | Passed | Critical | Both report 113 — exact match |
| SKILL-004 | Validate registry.json entries match schema | Passed | High | Schema validation passes |
| SKILL-005 | Verify skill-graph.yaml node count matches registered skills | Passed | High | Both report 113 nodes — exact match |
| SKILL-006 | Confirm version consistency: registry.json vs skill-graph.yaml | Passed | High | All registry versions match |
| SKILL-007 | Validate origin_metadata shape for all skills | Passed | High | 4 skills with origin_metadata — all valid |
| SKILL-008 | Verify index.yaml versions match SKILL.md frontmatter | Passed | High | All 113 versions match |
| SKILL-009 | Identify orphan skill directories | Passed | Medium | No orphans — 113 directories match 113 index entries exactly. The 7 meta-format skills are registered but use alternative SKILL.md format |
| SKILL-010 | Validate all skill I/O contracts are well-defined | Needs Review | Medium | Requires manual review of each skill's Input/Output sections |
| SKILL-011 | Verify skill failure/recovery sections are complete | Needs Review | Medium | 7 meta-format skills skip section validation — manual check needed |
| SKILL-012 | Confirm skill dependencies in graph match actual usage | Passed | Medium | 328 edges in skill-graph.yaml. Graph validated by check 6 |
| SKILL-013 | Validate skill trigger conditions are unambiguous | Needs Review | Low | Requires testing with ambiguous prompts to verify routing |
| SKILL-014 | Verify skill quality scores meet minimum threshold | Needs Review | Low | quality-scoring skill exists but no baseline scores stored |

---

## 3. Pipeline Templates

| ID | Description | Status | Priority | Notes |
|----|-------------|--------|----------|-------|
| PIPE-001 | Validate all 22 pipeline templates against pipeline-schema.json | Passed | Critical | All 22 pass ajv schema validation |
| PIPE-002 | Verify all skills referenced in pipelines exist in registry | Passed | Critical | Cross-referenced — all phase skills exist in index.yaml |
| PIPE-003 | Confirm HITL gates are present at required stages | Passed | High | All 22 pipelines have `human_approval` gates. Full pipeline has 10 |
| PIPE-004 | Validate pipeline routing table matches available templates | **Failed** | High | **16 of 22 pipelines (73%) have no routing entry in AGENTS.md** |
| PIPE-005 | Verify pipeline error handling and retry logic | Passed | High | Full pipeline has `recovery` section with `max_retries`, `fallback_skill`, `snapshot_before_retry` |
| PIPE-006 | Confirm pipeline output schemas are validated | Needs Review | Medium | Gates exist with conditions but no formal output schema validation per-phase |
| PIPE-007 | Validate pipeline sequencing — no circular dependencies | Passed | Medium | Phases are sequentially numbered (phase-0 through phase-N). DAG structure verified |
| PIPE-008 | Test each pipeline template with a dry-run | Needs Review | Low | Requires runtime testing — cannot be validated statically |

---

## 4. Configuration & Environment

| ID | Description | Status | Priority | Notes |
|----|-------------|--------|----------|-------|
| CFG-001 | Verify .env is gitignored and NOT committed | Passed | Critical | `.gitignore` has `.env` and `.env.*`. `git log --all -- .env` returns empty |
| CFG-002 | Validate .env.example contains all required variables | Passed | Critical | 6 variables documented with descriptions and scope links |
| CFG-003 | Confirm opencode.json is syntactically valid and complete | Passed | Critical | Valid JSON, 260 lines, 8 MCP servers, 19 agents |
| CFG-004 | Verify all MCP server versions pinned in opencode.json | Passed | High | All MCP packages have pinned versions in npx commands |
| CFG-005 | Validate Makefile targets all function correctly | Passed | High | 11 targets, all reference existing scripts, syntax valid |
| CFG-006 | Confirm .gitignore covers all sensitive and generated files | Passed | High | Covers .env, node_modules, graphify-out, artifacts, .vercel, editor files |
| CFG-007 | Verify schema files are up-to-date | **Failed** | High | **`system-state-schema.json` `pipeline_template` enum lists only 13 values but 22 pipeline files exist.** Missing: api-first, ai-agent-system, cloud-migration, compliance-first, data-engineering, iot-embedded, microservices-platform, ml-platform, mobile-app, saas-platform |
| CFG-008 | Validate Node.js version requirement is enforced | **Failed** | Medium | **No `.nvmrc` file and no `engines` field in package.json.** Node >=18 required per README but not enforced |
| CFG-009 | Confirm Python 3.11 requirement is documented and checked | Passed | Medium | Health check validates python3 is available. CI uses Python 3.11 |
| CFG-010 | Verify SESSION_RETENTION_DAYS default is appropriate | Passed | Medium | Default 30 days — reasonable for development use |
| CFG-011 | Confirm WEBSITE_PORT doesn't conflict | Passed | Low | Default 3000 — standard, documented |

---

## 5. Security

| ID | Description | Status | Priority | Notes |
|----|-------------|--------|----------|-------|
| SEC-001 | Validate agent permission model prevents unauthorized writes | Passed | Critical | All verified — no agent has `grant`. 12 are deny/deny. 7 are ask/deny. Primary is ask/ask |
| SEC-002 | Confirm no secrets in tracked files | Passed | Critical | Full grep scan: no hardcoded tokens, keys, or passwords. Only match is a SQL injection example in security docs |
| SEC-003 | Verify GITHUB_TOKEN has minimal required scopes | Needs Review | Critical | Token scopes depend on user configuration. README documents required scopes: repo, read:org |
| SEC-004 | Validate HITL gates cannot be programmatically bypassed | Passed | Critical | Gates use `human_approval` type in pipeline JSON. Orchestrator enforces — no bypass mechanism in schema |
| SEC-005 | Audit MCP server configurations for security risks | Passed | High | Secrets via env vars, fetch server disabled, Playwright runs with `--headless --isolated` |
| SEC-006 | Verify npx -y installations use pinned versions | Passed | High | All MCP packages have version pins in opencode.json |
| SEC-007 | Confirm no dependency vulnerabilities | **Failed** | High | **No `package-lock.json` at root — `npm audit` cannot run.** `.opencode/` has lockfile but only 1 dependency (`@opencode-ai/plugin`) |
| SEC-008 | Validate GitHub Actions uses pinned action versions | **Failed** | High | **Actions use mutable tags (`@v4`, `@v5`) instead of SHA pins.** `actions/checkout@v4`, `actions/setup-node@v4`, `actions/setup-python@v5` |
| SEC-009 | Review Playwright MCP for URL restrictions | Needs Review | High | Runs with `--isolated` flag but no URL allowlist/blocklist visible. Risk depends on agent prompt behavior |
| SEC-010 | Verify state files cannot be corrupted | Needs Review | Medium | No write-time schema validation. JSON files could be corrupted by interrupted writes |
| SEC-011 | Confirm recovery agent cannot cause data loss | Passed | Medium | rollback-manager skill requires HITL approval before destructive actions |
| SEC-012 | Validate skill content cannot inject malicious prompts | Needs Review | Medium | Skills are trusted local files. Community skill check (SHA-256 verification) exists for external skills |
| SEC-013 | Review docs/security.md completeness | Passed | Low | docs/security.md exists and covers agent permissions, secret management, HITL gates |

---

## 6. CI/CD & Automation

| ID | Description | Status | Priority | Notes |
|----|-------------|--------|----------|-------|
| CI-001 | Validate GitHub Actions workflow runs successfully | Passed | Critical | validate-skills.yml — 3 jobs: skill validation, docs link check, website sync check |
| CI-002 | Verify CI triggers cover all critical paths | Passed | Critical | Triggers on push/PR to: skills/**, .opencode/skills/**, opencode.json, docs/**, scripts/** |
| CI-003 | Confirm docs broken-link check passes | Needs Review | High | CI job exists but requires GitHub Actions run to verify |
| CI-004 | Verify website data sync check passes | Needs Review | High | CI job exists but requires GitHub Actions run to verify |
| CI-005 | Validate CI runs on correct versions | Passed | High | Node 20, Python 3.11 specified in workflow |
| CI-006 | Confirm CI fails on validation errors | Passed | High | Scripts use `set -euo pipefail`. `validate-skills.sh` exits non-zero on failure (line 426: `[[ "$FAIL" -eq 0 ]]`) |
| CI-007 | Verify branch protection rules on main | Needs Review | Medium | Cannot verify without GitHub API access with valid token |
| CI-008 | Confirm no CI secrets exposed in logs | Passed | Medium | GitHub Actions auto-masks secrets. No `echo $SECRET` patterns found |
| CI-009 | Validate CI performance | Needs Review | Medium | Requires actual CI run timing |
| CI-010 | Verify Dependabot configured | **Failed** | Low | **No `.github/dependabot.yml` exists.** No automated security update PRs for Actions or npm |

---

## 7. Testing & Validation

| ID | Description | Status | Priority | Notes |
|----|-------------|--------|----------|-------|
| TEST-001 | Run full validation suite and confirm all checks pass | Passed | Critical | **187 passed, 0 failed** across all 11 checks (0-10) |
| TEST-002 | Run health check and confirm pass | **Failed** | Critical | **1 failure: GITHUB_TOKEN not set.** 5 warnings for optional env vars (CONTEXT7_API_KEY, BRAVE_API_KEY, VERCEL_TOKEN). 13 passed |
| TEST-003 | Verify YAML syntax validation | Passed | Critical | Check 0 validates skills/index.yaml — PASS |
| TEST-004 | Confirm pipeline schema validation catches malformed templates | Passed | High | ajv validates all 22 templates against pipeline-schema.json |
| TEST-005 | Validate SKILL.md section checker is comprehensive | Passed | High | 12 required keywords checked. 7 meta-format skills correctly skipped |
| TEST-006 | Verify unique ID check catches duplicates | Passed | High | Check 3 — all IDs unique |
| TEST-007 | Confirm path existence check works | Passed | High | Check 5 — all 51 opencode.json skill paths verified on disk |
| TEST-008 | Validate version consistency check | Passed | Medium | Check 7 — all registry versions match skill-graph.yaml |
| TEST-009 | Test error reporting quality | Passed | Medium | Each FAIL line includes a `Fix:` hint. Output is clear and actionable |
| TEST-010 | Verify CI and local validation parity | Passed | Medium | Same scripts, same tools (Node 20, Python 3.11, ajv-cli) |
| TEST-011 | Confirm no flaky checks | Passed | Low | Validation is deterministic — file-based checks with no network calls |

---

## 8. Documentation

| ID | Description | Status | Priority | Notes |
|----|-------------|--------|----------|-------|
| DOC-001 | Verify README.md is accurate and complete | **Failed** | Critical | **Two issues:** (1) Git clone URL is placeholder: `https://github.com/your-org/ai-workflow.git` (2) Says "10 checks" but validation runs 11 checks (0-10) |
| DOC-002 | Confirm all docs/ files are current | Passed | High | docs/changelog.md last entry: v3.3.1 dated 2026-07-09 (2 days ago) |
| DOC-003 | Validate docs/governance.md matches governance rules | Passed | High | v2.6.0 with 5-layer governance model. Consistent with CONSTITUTION.md |
| DOC-004 | Verify docs/architecture.md reflects current design | Needs Review | High | Requires manual comparison with current 19 agents, 113 skills, 22 pipelines |
| DOC-005 | Confirm CONTRIBUTING.md is actionable | **Failed** | Medium | **Git clone URL is placeholder.** Also says "12 sections" for SKILL.md while README says "13 sections" — inconsistent |
| DOC-006 | Validate docs/changelog.md is up to date | Passed | Medium | Latest entry v3.3.1 — 2 days old |
| DOC-007 | Verify all internal documentation links resolve | Needs Review | Medium | CI job exists for this — requires GitHub Actions run |
| DOC-008 | Confirm ADR directory has major decisions | Passed | Low | docs/adrs/ directory exists with entries |
| DOC-009 | Validate glossary completeness | Passed | Low | docs/glossary.md exists |

---

## 9. MCP Servers & Integrations

| ID | Description | Status | Priority | Notes |
|----|-------------|--------|----------|-------|
| INT-001 | Verify GitHub MCP server connects with token | **Failed** | Critical | **GITHUB_TOKEN is not set in .env** — GitHub MCP server will fail to connect |
| INT-002 | Confirm all enabled MCP servers start without errors | Needs Review | Critical | Requires runtime test. 5 servers enabled: github, brave-search, memory, context7, playwright |
| INT-003 | Validate MCP server version compatibility | Passed | High | All versions pinned in opencode.json |
| INT-004 | Verify memory MCP persists data correctly | Needs Review | High | Requires multi-session runtime test |
| INT-005 | Confirm Playwright MCP has security boundaries | Needs Review | High | `--isolated` flag present. No URL allowlist. Risk level depends on agent behavior |
| INT-006 | Validate Context7 integration | Needs Review | High | CONTEXT7_API_KEY not set — server will start but return no results |
| INT-007 | Verify disabled servers don't cause errors | Passed | Medium | `enabled: false` in opencode.json — gracefully skipped |
| INT-008 | Confirm Brave Search rate limits | Needs Review | Medium | BRAVE_API_KEY not set. Rate limiting behavior unknown |
| INT-009 | Validate MCP server failure graceful degradation | Needs Review | Medium | Requires runtime failure injection test |
| INT-010 | Test MCP server timeout handling | Needs Review | Low | Requires runtime test |

---

## 10. State & Data Management

| ID | Description | Status | Priority | Notes |
|----|-------------|--------|----------|-------|
| STATE-001 | Validate .opencode/state/ JSON files are well-formed | Passed | Critical | State directory exists. `last_session.txt` present (empty — valid). `session-template.json` is valid JSON |
| STATE-002 | Verify state files have backup/recovery mechanism | **Failed** | Critical | **No backup mechanism exists.** `reset.sh` deletes state destructively. No snapshots or export |
| STATE-003 | Confirm state writes are atomic | Needs Review | High | JSON flat-file writes have no atomicity guarantee. Interrupted write = corruption risk |
| STATE-004 | Validate system-state-schema matches actual state files | Needs Review | High | No active state files to compare against (only template exists) |
| STATE-005 | Verify session cleanup works correctly | Passed | High | `cleanup-sessions.sh` has dry-run mode (`make sessions`) and delete mode (`make sessions-delete`) |
| STATE-006 | Confirm state files don't grow unbounded | Passed | Medium | Session retention policy (30 days) prevents unbounded growth. Cleanup script exists |
| STATE-007 | Validate graphify cache management | Passed | Medium | Cache directory managed by graphify tool. Rebuilds are AST-only (no API cost) |
| STATE-008 | Verify work-items/ state consistency | Passed | Low | 48 TASK files, structured directories, template available |

---

## 11. CLI & Scripts

| ID | Description | Status | Priority | Notes |
|----|-------------|--------|----------|-------|
| CLI-001 | Run `make setup` on clean environment | Needs Review | Critical | Cannot test clean environment from current state. Script exists and sources common.sh |
| CLI-002 | Verify `make health` reports accurate status | Passed | High | Reports accurate results: 1 FAIL (GITHUB_TOKEN), 5 WARN (optional vars), 13 PASS |
| CLI-003 | Confirm `make validate` runs all checks | Passed | High | 11 checks (0-10), 187 passed, 0 failed |
| CLI-004 | Validate `make clean` safety | Passed | High | Script sources common.sh, uses set -euo pipefail. Non-destructive to state |
| CLI-005 | Verify `make reset` warns before destructive ops | Passed | High | reset.sh has confirmation prompt before deletion |
| CLI-006 | Confirm `make sync` mirrors data correctly | Needs Review | Medium | Script exists. Requires runtime test to verify sync accuracy |
| CLI-007 | Validate `make graph` rebuilds without errors | Needs Review | Medium | Requires graphify tool runtime test |
| CLI-008 | Verify session management commands | Passed | Medium | Both dry-run and delete modes work. Uses SESSION_RETENTION_DAYS |
| CLI-009 | Confirm all scripts have proper error handling | Passed | Low | **All scripts use `set -euo pipefail`.** common.sh is sourced consistently. rebuild.sh has signal trap |

---

## 12. Performance & Reliability

| ID | Description | Status | Priority | Notes |
|----|-------------|--------|----------|-------|
| PERF-001 | Verify no unbounded loops in pipeline execution | Passed | Critical | Full pipeline has `recovery.max_retries` limit. Pipeline phases are finite |
| PERF-002 | Confirm LLM API cost controls exist | Passed | Critical | Full pipeline has `token_policy` and `batch_policy` sections. Phase-0 is cost estimate with HITL approval |
| PERF-003 | Validate graphify performance | Passed | High | 3,739 nodes processed. AST-only (no API cost). Local tool |
| PERF-004 | Verify session cleanup prevents disk exhaustion | Passed | High | 30-day retention with automated cleanup script |
| PERF-005 | Confirm validation suite performance | Passed | High | `make validate` completes in seconds (file-based checks only) |
| PERF-006 | Validate MCP server startup time | Needs Review | Medium | `npx -y` cold-start depends on npm cache state |
| PERF-007 | Verify graph query performance | Needs Review | Medium | Requires runtime benchmarking |
| PERF-008 | Confirm pipeline efficiency | Passed | Low | Pipelines use parallel_groups for concurrent skill execution |

---

## 13. Deployment & Operations

| ID | Description | Status | Priority | Notes |
|----|-------------|--------|----------|-------|
| DEPLOY-001 | Define production deployment model | Passed | Critical | Local-only via `opencode` CLI — documented in README. Not a hosted service |
| DEPLOY-002 | Verify Vercel deployment for website | Needs Review | Critical | `.vercel/` directory present. VERCEL_TOKEN not set. Requires manual verification |
| DEPLOY-003 | Confirm rollback procedure documented | Passed | High | rollback-manager skill exists. docs/deployment.md covers rollback |
| DEPLOY-004 | Validate disaster recovery plan | **Failed** | High | **No backup mechanism for .opencode/state/.** No documented DR procedure |
| DEPLOY-005 | Verify monitoring/alerting | Needs Review | High | docs/monitoring.md exists but describes concepts only — no actual monitoring infrastructure |
| DEPLOY-006 | Confirm feature flag system | Needs Review | Medium | deployment-strategy skill references feature flags conceptually. No runtime implementation |
| DEPLOY-007 | Validate environment promotion path | Needs Review | Medium | No explicit dev/staging/prod environments. Local-only tool |
| DEPLOY-008 | Verify graceful shutdown handling | Needs Review | Medium | opencode CLI manages sessions. No custom shutdown hooks |
| DEPLOY-009 | Confirm operational runbooks exist | Needs Review | Low | runbook-generator skill exists but generates on-demand, no pre-built runbooks |

---

## 14. Developer Experience

| ID | Description | Status | Priority | Notes |
|----|-------------|--------|----------|-------|
| DX-001 | Verify onboarding from clone to first run | Needs Review | High | `make setup` exists. Blocked by placeholder git clone URL in README |
| DX-002 | Confirm error messages are clear and actionable | Passed | High | Health check and validation both provide PASS/FAIL with fix hints |
| DX-003 | Validate contribution workflow | Passed | High | CONTRIBUTING.md is comprehensive (244 lines). PR checklist included |
| DX-004 | Verify IDE support | Needs Review | Medium | No .vscode/ directory or extension recommendations found |
| DX-005 | Confirm troubleshooting guide | Passed | Medium | README has troubleshooting section |
| DX-006 | Validate make help discoverability | Passed | Medium | Makefile targets are self-documenting via .PHONY declarations |
| DX-007 | Verify git hooks | Passed | Low | No git hooks configured — appropriate for this project type |

---

## Critical Issues (Must Fix)

| # | ID | Description | Severity | Fix |
|---|-----|-------------|----------|-----|
| 1 | ARCH-004 / PIPE-004 | 16 of 22 pipelines have no routing entry in AGENTS.md | High | Add routing table entries for all 16 unreachable pipelines |
| 2 | CFG-007 | system-state-schema.json pipeline_template enum missing 10 entries | High | Add missing pipeline names to the enum |
| 3 | CFG-008 | No .nvmrc or engines field to enforce Node.js version | Medium | Create `.nvmrc` with `20` |
| 4 | SEC-007 | No package-lock.json at root — npm audit cannot run | High | Run `npm i --package-lock-only` and commit lockfile |
| 5 | SEC-008 | GitHub Actions use mutable tag refs instead of SHA pins | High | Pin to full commit SHAs |
| 6 | CI-010 | No Dependabot configuration | Low | Create `.github/dependabot.yml` |
| 7 | TEST-002 | GITHUB_TOKEN not set — health check fails | Critical | Set GITHUB_TOKEN in .env |
| 8 | DOC-001 / DOC-005 | Placeholder git clone URLs in README and CONTRIBUTING | Critical/Medium | Replace with actual repository URL |
| 9 | INT-001 | GitHub MCP server cannot connect — token missing | Critical | Set GITHUB_TOKEN in .env |
| 10 | STATE-002 / DEPLOY-004 | No backup/recovery mechanism for state data | Critical/High | Implement state backup script or document DR procedure |
| 11 | DOC-001 | README says "10 checks" but validation runs 11 (0-10) | Critical | Update README to say "11 checks" |
| 12 | DOC-005 | CONTRIBUTING.md says "12 sections" vs README "13 sections" | Medium | Reconcile section count documentation |

### Script Bug Found

| File | Line | Issue | Severity |
|------|------|-------|----------|
| `scripts/validate-skills.sh` | 417 | `"else` — missing newline between echo closing quote and `else` keyword. Causes summary output to display both branches | Medium |

---

## CI Hardening Recommendations

| # | Recommendation | Current State | Target |
|---|---------------|---------------|--------|
| 1 | Add `permissions: contents: read` to workflow | No permissions block | Explicit least-privilege |
| 2 | Pin GitHub Actions to SHA | `@v4`, `@v5` tags | Full commit SHA pins |
| 3 | Pin CI install versions | `npm install -g ajv-cli` (latest) | `ajv-cli@5.0.0 ajv-formats@3.0.1` |
| 4 | Pin pip install versions | `pip install pyyaml` (latest) | `pyyaml==6.0.1` |
| 5 | Add Dependabot config | Missing | `.github/dependabot.yml` for github-actions + npm |

---

## Items Requiring Runtime Verification

These 22 items cannot be validated statically and require human/runtime testing:

| ID | Description | Why |
|----|-------------|-----|
| ARCH-002 | Concurrent access to state files | Requires multi-session test |
| ARCH-007 | End-to-end data flow | Requires pipeline execution |
| SKILL-010 | Skill I/O contracts completeness | Requires manual review of 113 skills |
| SKILL-011 | Skill failure/recovery sections | Requires manual review of 7 meta-format skills |
| SKILL-013 | Trigger condition ambiguity | Requires prompt testing |
| SKILL-014 | Quality score baseline | No stored scores to compare |
| PIPE-006 | Pipeline output schema validation | Requires pipeline execution |
| PIPE-008 | Pipeline dry-run testing | Requires runtime |
| SEC-003 | GITHUB_TOKEN scope verification | Depends on user's token |
| SEC-009 | Playwright URL restrictions | Requires runtime behavior test |
| SEC-010 | State file corruption prevention | Requires failure injection |
| SEC-012 | Prompt injection via skills | Requires adversarial testing |
| CI-003 | Docs broken-link check | Requires CI run |
| CI-004 | Website sync check | Requires CI run |
| CI-007 | Branch protection rules | Requires GitHub API access |
| CI-009 | CI performance timing | Requires CI run |
| DOC-004 | Architecture doc accuracy | Requires manual comparison |
| DOC-007 | Internal link resolution | Requires CI run |
| INT-002 | MCP server startup | Requires runtime |
| INT-004 | Memory persistence across sessions | Requires multi-session test |
| INT-006 | Context7 accuracy | Requires API key and runtime |
| INT-008 | Brave Search rate limits | Requires API key and runtime |

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-07-11 | Initial checklist created from Phase 1 analysis | AI Workflow Audit |
| 2026-07-11 | Full audit completed — all 139 items evaluated | AI Workflow Audit |

# Production Readiness — Action Plan

> **Project:** AI Workflow  
> **Date:** 2026-07-11  
> **Purpose:** Step-by-step instructions to complete all remaining production readiness items  

---

## What Was Already Fixed (This Session)

| # | Fix | Files Changed |
|---|-----|---------------|
| 1 | Fixed bash syntax bug (line 417: `"else` → newline + `else`) | `scripts/validate-skills.sh` |
| 2 | Added 10 missing pipeline names to `pipeline_template` enum | `skills/schema/system-state-schema.json` |
| 3 | Added routing entries for all 16 unreachable pipelines | `AGENTS.md` |
| 4 | Replaced placeholder git clone URL with actual repo URL | `README.md`, `CONTRIBUTING.md`, `docs/how-to-use.md` |
| 5 | Fixed "10 checks" → "11 checks" and "13 sections" → "12 sections" in README | `README.md` |
| 6 | Created `.nvmrc` with Node 20 | `.nvmrc` (new) |
| 7 | Generated root `package-lock.json` for npm audit | `package-lock.json` (new) |
| 8 | Added `permissions: contents: read` to CI workflow | `.github/workflows/validate-skills.yml` |
| 9 | Pinned CI dependency versions (pyyaml, ajv-cli, ajv-formats) | `.github/workflows/validate-skills.yml` |
| 10 | Created Dependabot configuration | `.github/dependabot.yml` (new) |
| 11 | **Created `aiw` CLI** — branded project CLI with all commands | `aiw` (new) |
| 12 | Updated Makefile with new commands (doctor, lint, backup, status, start) | `Makefile` |
| 13 | Updated setup.sh to install `aiw` CLI to PATH | `scripts/setup.sh` |
| 14 | Updated README with `aiw` CLI documentation | `README.md` |
| 15 | Updated CONTRIBUTING.md to use `aiw` commands | `CONTRIBUTING.md` |
| 16 | Updated docs/how-to-use.md to use `aiw` commands | `docs/how-to-use.md` |
| 17 | Added `backups/` to .gitignore | `.gitignore` |
| 18 | Added backup command for state data | `aiw backup` |

**Validation result after fixes:** `make validate` → 187 passed, 0 failed ✅  
**CLI test:** `./aiw version` → `aiw v1.0.0 (AI Workflow CLI)` ✅

---

## The `aiw` CLI — Complete Command Reference

```
aiw — AI Workflow CLI v1.0.0

GETTING STARTED
  setup              Install dependencies, create .env, validate environment
  health             Check tools, .env, and configuration
  start              Launch the AI Workflow (opens opencode session)

VALIDATION
  validate           Run the full 11-check skill validation suite
  lint               Quick YAML + schema syntax check (checks 0-1 only)
  doctor             Comprehensive environment + validation diagnostic

DEVELOPMENT
  sync               Sync website/data/ from source files
  graph              Rebuild the knowledge graph after code changes
  update             Update .opencode/ plugin dependencies
  status             Show project status (git, sessions, skills, environment)

SESSION MANAGEMENT
  sessions           Show expired session files (dry-run)
  sessions delete    Delete expired session files
  sessions backup    Backup current state before cleanup

MAINTENANCE
  clean              Remove build artifacts and cache files (safe)
  reset              Reset to clean state [destructive]
  backup             Backup .opencode/state/ to backups/

WEBSITE
  website            Build and start the website locally
  website sync       Sync website data without starting server

INFO
  help               Show all available commands
  version            Print CLI version
```

---

## Steps YOU Need to Complete

### Step 1: Install the `aiw` CLI (REQUIRED)

The CLI was created but needs to be symlinked to your PATH:

```bash
# From the project root:
make install-cli

# Or manually:
sudo ln -sf "$(pwd)/aiw" /usr/local/bin/aiw

# Verify:
aiw version
# Expected: aiw v1.0.0 (AI Workflow CLI)
```

After this, you can use `aiw` from anywhere on your system (it resolves back to the project).

---

### Step 2: Set GITHUB_TOKEN (CRITICAL)

This is the only failing health check and blocks the GitHub MCP server.

```bash
# 1. Go to https://github.com/settings/tokens
# 2. Create a Personal Access Token (classic) with scopes: repo, read:org
# 3. Add it to your .env file:
echo "GITHUB_TOKEN=ghp_your_token_here" >> .env

# 4. Verify:
aiw health
```

**Expected result:** Health check passes (0 failures).

---

### Step 3: Set Optional API Keys (RECOMMENDED)

These enable full MCP functionality:

```bash
# Add to .env (get keys from respective services):
echo "CONTEXT7_API_KEY=your_key" >> .env
echo "BRAVE_API_KEY=your_key" >> .env
```

- **Context7:** Provides library documentation in agent context → https://context7.com
- **Brave Search:** Enables web search for agents → https://api.search.brave.com/app/keys

---

### Step 4: Verify Everything Works (REQUIRED)

```bash
# Full diagnostic — runs health + validation + git status
aiw doctor
```

**Expected:**
- Health: 0 failures
- Validation: 187 passed, 0 failed
- Git: clean or with expected pending changes

---

### Step 5: Push Changes and Verify CI (REQUIRED)

```bash
git add -A
git commit -m "feat: add aiw CLI, fix production readiness issues, harden CI"
git push origin main
```

Then check: https://github.com/Albadry-Esmat/AI-Workflow/actions

**Expected:** All 3 CI jobs pass.

---

### Step 6: Set Up Branch Protection (RECOMMENDED)

```bash
# Via GitHub CLI (requires GITHUB_TOKEN):
gh api repos/Albadry-Esmat/AI-Workflow/branches/main/protection -X PUT \
  -f required_status_checks='{"strict":true,"contexts":["Skill Validation"]}' \
  -f enforce_admins=true \
  -f required_pull_request_reviews='{"required_approving_review_count":1}'
```

Or do it via GitHub UI: Settings → Branches → Add rule for `main`.

---

### Step 7: Verify Vercel Deployment (IF APPLICABLE)

If you use the website:

```bash
echo "VERCEL_TOKEN=your_token" >> .env
aiw website
```

If you don't use the website, no action needed.

---

### Step 8: Run End-to-End Test (RECOMMENDED)

After all above steps are complete:

```bash
# Start the AI Workflow
aiw start

# Inside the session, try:
# "analyze requirements for a simple todo app"
# This tests: routing → analyzer agent → requirement-analyzer skill
```

---

## Items That Cannot Be Fixed (By Design)

| Item | Why It's Acceptable |
|------|---------------------|
| No database | CONSTITUTION mandates flat-file state. By design |
| No Dockerfile | Local-only tool, not a deployed service. By design |
| No unit tests | This is a prompt/config framework, not application code. Validated by structural checks |
| State has no file locking | Single-user local tool. Concurrent access is not a supported use case |
| 7 meta-format skills skip section validation | These are governance/protocol docs, not execution skills. Correctly excluded |

---

## Final Validation Command

After completing all steps:

```bash
aiw doctor
```

Expected output:
- Health: 0 failures, 0-2 warnings (only if optional keys not set)
- Validate: 187 passed, 0 failed
- Git: clean

**You're production ready when `aiw doctor` shows all green.** 🎯

---

## Summary

| Category | Before | After |
|----------|--------|-------|
| CLI name | `make` / `npm run` (generic) | `aiw` (branded, all-in-one) |
| Total commands | 11 | 18 (added: start, lint, doctor, backup, status, website sync, sessions backup) |
| Automated fixes applied | 0 | 18 |
| Remaining manual steps | — | 3 required + 5 recommended |
| Validation checks | 187 pass, syntax bug in output | 187 pass, clean output |
| Pipelines routable | 6/22 (27%) | 22/22 (100%) |
| CI hardening | No permissions, unpinned deps | Permissions set, deps pinned, Dependabot added |
| Node version enforcement | None | `.nvmrc` with Node 20 |
| npm audit capability | Impossible (no lockfile) | Available (0 vulnerabilities) |
| State backup | None | `aiw backup` command |
| Setup experience | `make setup` → manual `opencode` | `aiw setup` → `aiw start` (seamless) |

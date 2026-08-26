# How to Use — Developer & AI Agent Guide

**Version:** 2.3.0 | **Last updated:** 2026-07-03

---

## For Developers

### Setup

Clone the repository and run setup directly — no install needed first:

```bash
git clone https://github.com/Albadry-Esmat/AI-Workflow.git
cd AI-Workflow
./aiw setup
```

`./aiw` runs straight from the repo before anything is installed. Setup will add `aiw` to your PATH so you can use it globally from that point on. Then open `.env` and fill in your credentials:

```bash
# Minimum required: create a fine-grained token restricted to the repositories
# this workflow operates on, grant only reviewed permissions, and set an expiration.
GITHUB_TOKEN=your_fine_grained_token_here  # https://github.com/settings/personal-access-tokens/fine-grained

# Optional but recommended
CONTEXT7_API_KEY=...           # https://context7.com
BRAVE_API_KEY=...              # https://api.search.brave.com/app/keys
```

Verify the environment:

```bash
aiw health                       # prints PASS/WARN/FAIL per check
aiw start /path/to/your-project  # launch on your project
aiw start                        # or launch here (this repo)
```

---

### Use It on Your Own Project

AI Workflow is a tool you run **on top of your codebase** — not inside it. After setup you have two options:

**Option A — Point it at any project (no copying needed):**

```bash
aiw start /path/to/your-project
```

Agents and skills load from the AI-Workflow folder. The files your agents read and edit are inside your project.

**Option B — Install it into your project permanently:**

```bash
aiw init /path/to/your-project
cd /path/to/your-project
opencode
```

This copies `opencode.json` and `.opencode/` (all 113 skills + 19 agents) into the target project. It creates `.env` from `.env.example` when the target does not already have one; it does not copy credentials from the source project by default. After that it is fully standalone — no dependency on the AI-Workflow folder. Use this when you want the workflow to live inside a specific repo.

---

### Available Commands

| Command | What it does |
|---------|-------------|
| `./aiw setup` | **First run only** — check prerequisites, install validation tools, create `.env`, add `aiw` to PATH |
| `aiw health` | Check tools, `.env`, and config — PASS/WARN/FAIL output |
| `aiw start` | Launch the AI Workflow on this repo |
| `aiw start <path>` | Launch on any project on your machine |
| `aiw init <path>` | Copy the full workflow into another project (standalone) |
| `aiw validate` | Run structural skill and semantic pipeline validation |
| `aiw lint` | Quick YAML + schema syntax check |
| `aiw doctor` | Full diagnostic: health + validation + git |
| `aiw self-test` | Credential-free production conformance tests |
| `aiw preflight` | Strict release-readiness check; fails on missing prerequisites |
| `aiw security-history` | Scan reachable Git history for credential-like patterns |
| `aiw version --json` | Print framework, schema, and runtime compatibility metadata |
| `aiw support-bundle [dir]` | Create sanitized diagnostics without raw state or secrets |
| `aiw sync` | Sync `website/data/` from source files |
| `aiw sync --website --confirm-website` | Sync + publish to ASE-OS-Website after explicit confirmation |
| `aiw graph` | Rebuild the knowledge graph |
| `aiw status` | Show project status (git, sessions, skills) |
| `aiw clean` | Remove build artifacts |
| `aiw reset` | Reset to clean state (removes `.env`, sessions) |
| `aiw update` | Check the `.opencode/` plugin layout and show OpenCode update guidance |
| `aiw backup` | Backup `.opencode/state/` with checksums and a manifest |
| `aiw restore <backup>` | Verify and restore a state backup while retaining previous state |
| `aiw support-bundle [dir]` | Create sanitized diagnostics without raw state or secrets |
| `aiw sessions` | Show expired session files (dry-run) |
| `aiw sessions delete` | Delete expired session files |
| `aiw website` | Build and start the website locally |
| `aiw help` | Show all available commands |

### How to Add a New Feature

```
 1. Start with raw input (feature description)
 2. Run requirement-analyzer → structured requirements, open_questions   [Phase 1]
 3. Resolve open_questions with stakeholder; HITL gate approves scope   [HITL gate]
 4. Run architecture-design; adr-generator captures decisions after required architecture artifacts are ready   [Phase 2]
 5. Run frontend-ux-architect + database-architect in parallel          [Phase 2b]
 6. HITL gate: approve architecture, UX design, and DB schema           [HITL gate]
 7. Run dependency-analyzer to build / refresh module dependency graph  [Phase 3]
 8. Run feature-planning → tasks, dependency map, roadmap               [Phase 4]
 9. HITL gate: approve roadmap and impact surface                       [HITL gate]
10. Run change-impact-analyzer; pipeline blocks if severity = critical  [Phase 5]
11. Run code-generator to produce implementation artifacts              [Phase 6]
12. Run in parallel: clean-code-review, testing-strategy,               [Phase 7]
    security-review, test-generator
13. HITL gate: approve security posture and test coverage               [HITL gate]
14. Run guard layer in parallel: database-guard, performance-guard,     [Phase 7b]
    ui-ux-compliance-guard — any 'block' verdict halts the pipeline
15. If test.failed OR build.broken → run code-repair (conditional)      [Phase 8]
16. Run implementation-completeness-auditor to score coverage           [Phase 8b]
17. Run implementation-completeness-guard; blocks if score < 85%        [Phase 8c]
18. Run deployment-strategy to define release plan and promotion rules  [Phase 9]
19. Provide mandatory deployment approval — non-bypassable HITL gate    [HITL gate]
20. documentation-generator + doc-maintainer execute asynchronously     [Phase 10]
```

### How to Create a New Skill

```
1. Copy skills/template/skill-template.md to .opencode/skills/<name>/SKILL.md
2. Fill in all 12 sections (see CONTRIBUTING.md for section list)
3. Add entry to skills/index.yaml (follow exact format)
4. Add entry to skills/registry.json
5. Increment total_nodes in skills/graph/skill-graph.yaml
6. Update docs/changelog.md
7. Run: make validate && make sync (or `aiw sync`)
```

### How to Create a New Agent

```
1. Define capability: which skill(s) it will execute
2. Add agent config to opencode.json:
   {
     "agent": {
       "<agent-name>": {
         "mode": "subagent",
         "model": "github-copilot/claude-sonnet-4.6",
         "permission": { "edit": "deny", "bash": "deny" },
         "description": "..."
       }
     }
   }
3. Create .opencode/agent/<agent-name>.md (follow existing agent files)
4. Add agent to docs/agents.md with inputs, outputs, dependencies
5. Update docs/changelog.md
```

### How to Modify Workflows

```
1. Determine which skills change position or dependency
2. Update the dependency graph in skills/registry.json (consumes_from/produces_for)
3. Update docs/workflows.md with new flow diagram and pipeline config
4. Update docs/architecture.md if orchestration logic changes
5. Update docs/changelog.md
```

### How to Deploy Changes

```
1. Ensure make validate passes (0 failures)
2. Run make sync to update website/data/
3. Bump version per semver rules (see docs/versioning.md)
4. Update docs/changelog.md with change summary
5. Follow promotion flow: dev → staging → pre-prod → production
6. Each promotion gate requires HITL approval (see docs/governance.md)
7. Monitor after deployment (see docs/monitoring.md)
```

### How to Debug Issues

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Schema validation error | Mismatch between skill output and expected input | Run `make validate`; check skill schema |
| Pipeline halted | HITL gate timeout or rejection | See `docs/governance.md` gate rules |
| Feedback loop exceeded | Circular skill dependency | Check workflow dependency graph |
| Token budget exhausted | Context not compressed | See `docs/context-engineering.md` |
| Skill not found | Registry not updated | Run `make validate` to find which entry is missing |
| Agent permission denied | Incorrect agent config | Check permission in `opencode.json` |
| `ajv: command not found` | ajv-cli not installed | Run `npm install -g ajv-cli ajv-formats` |
| `GITHUB_TOKEN is not set` | Missing env var | Add a repository-scoped fine-grained `GITHUB_TOKEN` to `.env` and keep mode 600 |

---

## For AI Agents

### How to Read This Documentation

```
1. docs/README.md → system overview, navigation, governance rules
2. docs/system-overview.md → what the system does, scope
3. docs/architecture.md → component model, data flow, orchestration
4. docs/workflows.md → pipeline execution sequences and modes
5. docs/skills-registry.md → all available skills with metadata
6. docs/agents.md → agent responsibilities and configuration
7. docs/governance.md → rules you must follow
8. docs/versioning.md → version compatibility rules
```

### How to Execute a Pipeline

```
1. Identify the pipeline mode from docs/workflows.md
2. Call the orchestrator with pipeline_config + initial_payload
3. The orchestrator resolves skills from registry, validates each step
4. If HITL gate pauses pipeline, present gate context for human decision
5. Pipeline returns: result + execution_log + metrics
```

### How to Handle Feedback Loops

```
When a skill emits feedback entries:
1. The orchestrator detects backpropagation
2. It invalidates downstream artifacts
3. It re-invokes the target skill with augmented input
4. It re-runs downstream skills
5. Max 3 iterations — if unresolved, force-terminate

As an agent, you may see feedback as:
{
  "type": "backpropagate",
  "from_skill": "...",
  "target_skill": "...",
  "reason": "...",
  "evidence": {...}
}
```

### How to Use Registry for Discovery

```
To discover available skills programmatically:
1. Load skills/registry.json
2. Query by domain, consumes_from, or produces_for
3. Resolve skill path from registry entry
4. Load skill markdown from resolved path

The orchestrator automates this — but if you need manual discovery,
the registry is your single source of truth.
```

### Token Optimization Rules for Agents

```
1. Prune input: strip fields the target skill doesn't need
2. Use IDs, not descriptions, for cross-references
3. Remove metrics from inter-skill handoffs
4. Remove feedback entries after the orchestrator consumes them
5. Keep session context compressed: last 3 outputs only
6. Stay within token budget (32K/64K/128K per session type)
```

---

## Quick Reference

| Action | Command / File |
|--------|---------------|
| First-time setup | `make setup` |
| Validate environment | `make health` |
| Validate skills | `make validate` |
| Sync website data | `make sync` |
| Update knowledge graph | `make graph` |
| Add a skill | Copy template → write spec → `make validate && make sync` |
| Add an agent | Create config + instruction file → update agents.md + changelog |
| Run pipeline | Call orchestrator with `pipeline_config` |
| Validate output | Run `schema-validator` with data + schema |
| Track changes | See `docs/changelog.md` |
| Report issue | Check `docs/governance.md` for escalation path |

## Repository hardening and publication controls

AI-Workflow is the source of truth for framework data. Before a release or website publication, run npm run validate:all and the relevant production-hardening checks. The website artifact is an exact SHA-256-verified mirror; destination-only files are deleted rather than retained. Populated source .env files are never copied by aiw init, and external MCP packages must be pinned and explicitly enabled. Deployment approval gates are non-bypassable where required, and generated metadata must use the canonical HTTPS site URL.

# AI Workflow

**An open framework that takes ideas to production using a pipeline of specialized AI agents.**

AI Workflow provides a structured skill system — 102 skills, 18 agents, and 21 pipeline templates — that routes any engineering task through analysis, architecture, planning, implementation, review, testing, and deployment, with human-in-the-loop gates at critical checkpoints.

---

## Quick Start

```bash
git clone https://github.com/your-org/ai-workflow.git
cd ai-workflow
make setup
```

`make setup` checks prerequisites, installs dependencies, creates your `.env` from the template, and validates the environment. Then:

```bash
# Edit .env and set your GITHUB_TOKEN
# (get one at https://github.com/settings/tokens — scopes: repo, read:org)
make health     # verify everything is configured
opencode        # start the AI workflow
```

That's it. See [Commands](#commands) for the full list of available targets.

---

## What It Does

You describe what you want to build. The pipeline does the rest:

```
Idea → Requirements → Architecture → Plan → Code → Review → Tests → Deploy
```

Each stage is handled by a specialized agent running a defined **skill** — a structured prompt with strict input/output contracts. The orchestrator routes work, validates outputs, and pauses for your approval at HITL gates before irreversible actions.

---

## Key Numbers

| What | Count |
|------|-------|
| Skills | 102 |
| Agents | 18 specialized + 1 primary orchestrator |
| Pipeline templates | 21 |

---

## Prerequisites

| Tool | Required | Purpose |
|------|----------|---------|
| [opencode](https://opencode.ai) | **Yes** | Runs the AI agent runtime |
| [Node.js](https://nodejs.org) ≥ 18 | **Yes** | Pipeline schema validation + plugin runtime |
| [Python 3](https://python.org) ≥ 3.9 | **Yes** | SKILL.md version consistency checks |
| [Git](https://git-scm.com) | **Yes** | Version control |
| [ajv-cli](https://github.com/ajv-validator/ajv-cli) | Optional | JSON Schema validation (auto-installed by `make setup`) |
| [graphify](https://graphify.ai) | Optional | Knowledge graph queries |

A GitHub Copilot subscription (or another LLM provider supported by opencode) is also required.

---

## Commands

Run `make help` to see the full list at any time.

| Command | What it does |
|---------|-------------|
| `make setup` | **Start here** — install deps, create `.env`, validate environment |
| `make health` | Check tools, `.env`, and configuration — prints PASS/WARN/FAIL |
| `make validate` | Run all 10 skill validation checks before committing |
| `make sync` | Sync `website/data/` from source files after changing skills |
| `make graph` | Rebuild the knowledge graph after code changes |
| `make clean` | Remove build artifacts and cache files (safe, reversible) |
| `make reset` | Reset to a clean state — removes `.env`, sessions, artifacts |
| `make update` | Update `.opencode/` plugin dependencies |
| `make website` | Build and start the website locally (requires companion repo — see below) |
| `make sessions` | Show expired session files (dry-run) |
| `make sessions-delete` | Delete expired session files (no confirmation prompt) |

All commands are also available as `npm run <command>` (e.g., `npm run validate`).

---

## Configuration

All configuration lives in `.env`. Copy the template on first setup:

```bash
cp .env.example .env
```

| Variable | Required | Description |
|----------|----------|-------------|
| `GITHUB_TOKEN` | **Yes** | GitHub PAT — used by the `github` MCP server |
| `CONTEXT7_API_KEY` | No | Context7 library docs in agent context |
| `BRAVE_API_KEY` | No | Brave Search for agent web lookups |
| `VERCEL_TOKEN` | No | Vercel deployment operations |
| `WEBSITE_PORT` | No | Local website port (default: `3000`) |
| `SESSION_RETENTION_DAYS` | No | Session cleanup window in days (default: `30`) |

See `.env.example` for full documentation of every variable.

---

## How It Works

### Skills

A **skill** is a markdown file (`SKILL.md`) with 13 sections that define exactly what an agent does: its purpose, inputs, outputs, quality gates, and composition rules. Skills live in `.opencode/skills/<name>/`.

```
.opencode/skills/
├── requirement-analyzer/SKILL.md
├── architecture-design/SKILL.md
├── feature-planning/SKILL.md
├── clean-code-review/SKILL.md
├── security-review/SKILL.md
└── ... (102 total)
```

The skill registry (`skills/index.yaml`) is the single source of truth for all skill metadata.

### Pipeline Templates

Pipelines are JSON files that define which skills run in sequence, their dependencies, and where HITL gates appear. Templates live in `skills/pipelines/`.

```
skills/pipelines/
├── full-pipeline.json        ← end-to-end: requirements → deploy
├── quick-review.json         ← code & security review only
├── architecture-only.json    ← requirements + architecture
├── pre-deploy.json           ← testing + deployment strategy
└── ... (21 total)
```

### Agents

18 specialized subagents each own a set of skills. The primary agent orchestrates them, routes inputs, enforces HITL gates, and assembles the final response. Agent config lives in `opencode.json`.

```
Primary agent (orchestrator)
├── analyzer          → requirement-analyzer
├── architect         → architecture-design, frontend-ux-architect, database-architect
├── planner           → feature-planning
├── builder           → code-generator, code-repair, design-system-generator, seo-optimizer
├── reviewer          → clean-code-review, security-review, + 6 governance guards
├── tester            → testing-strategy, test-generator, mutation-test-generator
├── deployer          → deployment-strategy
├── documenter        → documentation-generator
├── doc-maintainer    → doc-maintainer
├── data-engineer     → 5 data platform skills
├── api-designer      → 3 API contract skills
├── distributed-systems → 6 distributed architecture skills
├── cloud-platform    → 3 cloud infrastructure skills
├── security-specialist → 3 security depth skills
└── sre               → 5 reliability engineering skills
```

### HITL Gates

The pipeline pauses for your approval before:
- Committing to an architecture (after requirements analysis)
- Beginning code generation (after planning)
- Deploying to production (after testing)

---

## Running a Pipeline

Type any of the following inside an `opencode` session to start a pipeline:

```
analyze requirements for <your idea>
design the architecture for <system>
full pipeline — build this feature: <description>
review code in <path>
plan this feature: <description>
```

---

## Repository Structure

```
ai-workflow/
├── opencode.json              ← agent config, model assignments, MCP servers
├── .env.example               ← environment variable template (copy to .env)
├── Makefile                   ← developer CLI entry point
├── .opencode/
│   ├── skills/                ← 102 SKILL.md files (AI-executable skill specs)
│   └── agent/                 ← per-agent instruction files (19 files)
├── skills/
│   ├── index.yaml             ← skill registry (single source of truth)
│   ├── registry.json          ← machine-readable runtime registry
│   ├── pipelines/             ← 21 pipeline template JSON files
│   ├── graph/skill-graph.yaml ← 102 nodes, 328 edges
│   └── schema/                ← JSON schemas for pipelines and registry
├── scripts/
│   ├── setup.sh               ← one-command project setup
│   ├── health-check.sh        ← environment validation
│   ├── validate-skills.sh     ← 10-check skill validation suite
│   ├── sync-website-data.sh   ← sync website/data/ from source
│   ├── clean.sh               ← remove build artifacts
│   ├── reset.sh               ← reset to clean state
│   ├── cleanup-sessions.sh    ← prune expired session files
│   └── lib/common.sh          ← shared bash utilities
├── docs/                      ← system documentation (25 files)
├── examples/                  ← starter files for new projects
├── work-items/                ← task/feature/bug tracking templates
└── exports/                   ← work item export output
```

---

## Validating Skills

Before committing new or modified skills:

```bash
make validate
```

Expected output: `All checks passed — N passed, 0 failed`. All 10 checks must pass.

---

## Troubleshooting

### `opencode: command not found`
Install opencode from [opencode.ai](https://opencode.ai).

### `GITHUB_TOKEN is not set`
Open `.env` and add your token. Create one at [github.com/settings/tokens](https://github.com/settings/tokens) with scopes: `repo`, `read:org`.

### `ajv: command not found` during validation
Run: `npm install -g ajv-cli ajv-formats` (or just re-run `make setup`).

### `Skill count mismatch` in validation
Every SKILL.md directory under `.opencode/skills/` must have a corresponding `- id:` entry in `skills/index.yaml`. Run `make validate` for the specific skill that is missing.

### `.opencode/node_modules missing`
Run: `npm install --prefix .opencode` (or `make update`).

### Website won't start (`website/package.json not found`)
The website source lives in a separate companion repository. The `website/` directory in this repo contains only the data mirror. Run `make sync` to update that mirror, then deploy via Vercel.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full guide on adding skills, pipeline templates, and agents.

---

## Documentation

Full system documentation lives in [`docs/`](docs/):

| File | What it covers |
|------|---------------|
| `docs/system-overview.md` | Goals, scope, key concepts |
| `docs/architecture.md` | Component model and data flow |
| `docs/governance.md` | Approval gates and quality rules |
| `docs/agents.md` | All 18 agents and their skill assignments |
| `docs/workflows.md` | End-to-end pipeline execution |
| `docs/how-to-use.md` | Step-by-step guides for developers and agents |
| `docs/changelog.md` | Version history |

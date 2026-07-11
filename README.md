# AI Workflow

**An open framework that takes ideas to production using a pipeline of specialized AI agents.**

AI Workflow provides a structured skill system — 113 skills, 19 agents, and 22 pipeline templates — that routes any engineering task through analysis, architecture, planning, implementation, review, testing, and deployment, with human-in-the-loop gates at critical checkpoints.

---

## Quick Start

```bash
git clone https://github.com/Albadry-Esmat/AI-Workflow.git
cd AI-Workflow
./aiw setup
```

`./aiw setup` works straight from the cloned repo — no install needed first. It checks prerequisites, installs dependencies, creates your `.env`, and adds `aiw` to your PATH. Then:

```bash
# Edit .env and set your GITHUB_TOKEN
# (get one at https://github.com/settings/tokens — classic token, no expiration, scopes: repo + read:org)
aiw health                       # verify everything is configured
aiw start /path/to/your-project  # launch on your project
```

That's it. Type `aiw help` for the full list of available commands.

---

## Use It on Your Own Project

AI Workflow is a tool you run **on top of your existing codebase** — not inside it. After setup, point it at any project on your machine:

```bash
# Option A — run it on another project right now (no copying needed)
aiw start /path/to/your-project

# Option B — install the full workflow into another project permanently
aiw init /path/to/your-project
cd /path/to/your-project
opencode   # all 113 skills + 19 agents, fully self-contained
```

**Option A** keeps AI Workflow in its own folder. Your project's files are what the agents read and edit.

**Option B** copies `opencode.json`, `.opencode/` (all skills + agents), and `.env` into your project. After that it works standalone — no dependency on the AI-Workflow folder.

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
| Skills | 113 |
| Agents | 18 specialized + 1 primary orchestrator |
| Pipeline templates | 22 |

---

## Prerequisites

| Tool | Required | Purpose |
|------|----------|---------|
| [opencode](https://opencode.ai) | **Yes** | Runs the AI agent runtime |
| [Node.js](https://nodejs.org) ≥ 20 | **Yes** | Pipeline schema validation + plugin runtime |
| [Python 3](https://python.org) ≥ 3.9 | **Yes** | SKILL.md version consistency checks |
| [Git](https://git-scm.com) | **Yes** | Version control |
| [ajv-cli](https://github.com/ajv-validator/ajv-cli) | Optional | JSON Schema validation (auto-installed by `aiw setup`) |
| [graphify](https://graphify.ai) | Optional | Knowledge graph queries |

A GitHub Copilot subscription (or another LLM provider supported by opencode) is also required.

---

## Commands

The `aiw` CLI is the primary interface. Run `aiw help` for the full list.

### Getting Started

| Command | What it does |
|---------|-------------|
| `./aiw setup` | **Start here** — install deps, create `.env`, add `aiw` to PATH |
| `aiw health` | Check tools, `.env`, and configuration — prints PASS/WARN/FAIL |
| `aiw start` | Launch the AI Workflow on **this** repo |
| `aiw start <path>` | Launch on **any project** on your machine |
| `aiw init <path>` | Copy the full workflow into another project (makes it standalone) |

### Validation

| Command | What it does |
|---------|-------------|
| `aiw validate` | Run the full 11-check skill validation suite |
| `aiw lint` | Quick YAML + schema syntax check (checks 0-1 only) |
| `aiw doctor` | Comprehensive diagnostic: health + validation + git status |

### Development

| Command | What it does |
|---------|-------------|
| `aiw sync` | Sync `website/data/` from source files after changing skills |
| `aiw graph` | Rebuild the knowledge graph after code changes |
| `aiw update` | Update `.opencode/` plugin dependencies |
| `aiw status` | Show project status (git, sessions, skills, environment) |

### Session Management

| Command | What it does |
|---------|-------------|
| `aiw sessions` | Show expired session files (dry-run) |
| `aiw sessions delete` | Delete expired session files |
| `aiw sessions backup` | Backup current state before cleanup |

### Maintenance

| Command | What it does |
|---------|-------------|
| `aiw clean` | Remove build artifacts and cache files (safe, reversible) |
| `aiw reset` | Reset to clean state — removes `.env`, sessions, artifacts ⚠️ |
| `aiw backup` | Backup `.opencode/state/` to `backups/` directory |

### Website

| Command | What it does |
|---------|-------------|
| `aiw website` | Build and start the website locally |
| `aiw website sync` | Sync website data without starting server |

### Info

| Command | What it does |
|---------|-------------|
| `aiw help` | Show all available commands |
| `aiw version` | Print CLI version |

> **Note:** All commands are also available via `make <command>` for backward compatibility.

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

A **skill** is a markdown file (`SKILL.md`) with 12 sections that define exactly what an agent does: its purpose, inputs, outputs, quality gates, and composition rules. Skills live in `.opencode/skills/<name>/`.

```
.opencode/skills/
├── requirement-analyzer/SKILL.md
├── architecture-design/SKILL.md
├── feature-planning/SKILL.md
├── clean-code-review/SKILL.md
├── security-review/SKILL.md
└── ... (113 total)
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
└── ... (22 total)
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

```bash
aiw start
```

Then type any of the following inside the session:

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
AI-Workflow/
├── aiw                        ← CLI entry point (installed to PATH by setup)
├── opencode.json              ← agent config, model assignments, MCP servers
├── .env.example               ← environment variable template (copy to .env)
├── Makefile                   ← make targets (backward compat with aiw CLI)
├── .opencode/
│   ├── skills/                ← 113 SKILL.md files (AI-executable skill specs)
│   └── agent/                 ← per-agent instruction files (19 files)
├── skills/
│   ├── index.yaml             ← skill registry (single source of truth)
│   ├── registry.json          ← machine-readable runtime registry
│   ├── pipelines/             ← 22 pipeline template JSON files
│   ├── graph/skill-graph.yaml ← 113 nodes, 328 edges
│   └── schema/                ← JSON schemas for pipelines and registry
├── scripts/
│   ├── setup.sh               ← one-command project setup
│   ├── health-check.sh        ← environment validation
│   ├── validate-skills.sh     ← 11-check skill validation suite
│   ├── sync-website-data.sh   ← sync website/data/ from source
│   ├── clean.sh               ← remove build artifacts
│   ├── reset.sh               ← reset to clean state
│   ├── cleanup-sessions.sh    ← prune expired session files
│   └── lib/common.sh          ← shared bash utilities
├── docs/                      ← system documentation (35 files)
├── examples/                  ← starter files for new projects
├── work-items/                ← task/feature/bug tracking templates
└── exports/                   ← work item export output
```

---

## Validating Skills

Before committing new or modified skills:

```bash
aiw validate
```

Expected output: `All checks passed — N passed, 0 failed`. All 11 checks must pass.

For a quick syntax check only:

```bash
aiw lint
```

---

## Troubleshooting

### `aiw: command not found`
Run `make install-cli` to symlink the CLI to `/usr/local/bin/`, or use `./aiw` directly from the project root.

### `opencode: command not found`
Install opencode from [opencode.ai](https://opencode.ai).

### `GITHUB_TOKEN is not set`
Open `.env` and add your token. Create one at [github.com/settings/tokens](https://github.com/settings/tokens) with scopes: `repo`, `read:org`.

### `ajv: command not found` during validation
Run: `npm install -g ajv-cli ajv-formats` (or just re-run `aiw setup`).

### `Skill count mismatch` in validation
Every SKILL.md directory under `.opencode/skills/` must have a corresponding `- id:` entry in `skills/index.yaml`. Run `aiw validate` for the specific skill that is missing.

### `.opencode/node_modules missing`
Run: `aiw update`.

### Website won't start (`website/package.json not found`)
The website source lives in a separate repository: [ASE-OS-Website](https://github.com/Albadry-Esmat/ASE-OS-Website). The `website/` directory in this repo contains only the data mirror (`website/data/`). To work on the website locally:

```bash
git clone https://github.com/Albadry-Esmat/ASE-OS-Website.git
cd ASE-OS-Website
npm install
npm run dev
```

To update the data mirror after changing skills or pipelines:
```bash
aiw sync   # updates website/data/ in this repo
```

The live site is at **https://ase-os.vercel.app**.

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

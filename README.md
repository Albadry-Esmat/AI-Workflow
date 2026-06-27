# AI Workflow

**An open framework that takes ideas to production using a pipeline of specialized AI agents.**

AI Workflow provides a structured skill system — 101 skills, 18 agents, and 21 pipeline templates — that routes any engineering task through analysis, architecture, planning, implementation, review, testing, and deployment, with human-in-the-loop gates at critical checkpoints.

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
| Skills | 101 (SKL-001 → SKL-107) |
| Agents | 18 specialized + 1 primary orchestrator |
| Pipeline templates | 21 |

---

## Quick Start

### Prerequisites

- [opencode](https://opencode.ai) — the AI coding tool that powers the agent runtime
- A GitHub Copilot subscription (or any LLM provider supported by opencode)

### 1 — Clone

```bash
git clone https://github.com/your-username/ai-workflow.git
cd ai-workflow
```

### 2 — Open in opencode

```bash
opencode
```

opencode reads `opencode.json` and loads all 18 agents automatically.

### 3 — Run a pipeline

Type any of the following to start a pipeline:

```
analyze requirements for <your idea>
design the architecture for <system>
full pipeline — build this feature: <description>
review code in <path>
plan this feature: <description>
```

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
└── ... (101 total)
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
├── analyzer      → requirement-analyzer
├── architect     → architecture-design, frontend-ux-architect, database-architect
├── planner       → feature-planning
├── builder       → code-generator, code-repair, design-system-generator, seo-optimizer
├── reviewer      → clean-code-review, security-review, + 6 governance guards
├── tester        → testing-strategy, test-generator, mutation-test-generator
├── deployer      → deployment-strategy
├── documenter    → documentation-generator
├── doc-maintainer→ doc-maintainer
├── data-engineer → 5 data platform skills
├── api-designer  → 3 API contract skills
├── distributed-systems → 6 distributed architecture skills
├── cloud-platform→ 3 cloud infrastructure skills
├── security-specialist → 3 security depth skills
└── sre           → 5 reliability engineering skills
```

### HITL Gates

The pipeline pauses for your approval before:
- Committing to an architecture (after requirements analysis)
- Beginning code generation (after planning)
- Deploying to production (after testing)

You review the output, approve or request changes, and the pipeline continues.

---

## Repository Structure

```
ai-workflow/
├── opencode.json              ← agent config, model assignments, permissions
├── .opencode/
│   ├── skills/                ← 101 SKILL.md files (the skill system)
│   └── agent/                 ← per-agent instruction files
├── skills/
│   ├── index.yaml             ← skill registry (single source of truth)
│   ├── pipelines/             ← 21 pipeline template JSON files
│   └── registry.json          ← machine-readable registry
├── docs/                      ← system documentation
│   ├── governance.md          ← approval gates, quality enforcement rules
│   ├── architecture.md        ← full system architecture
│   ├── changelog.md           ← version history
│   └── ...
├── work-items/                ← task/feature/bug tracking templates
│   ├── TASK-TEMPLATE.md
│   └── features/FEATURE-TEMPLATE/
├── scripts/
│   ├── validate-skills.sh     ← validates all SKILL.md files against the template
│   └── cleanup-sessions.sh
├── examples/                  ← starter files for new projects
│   ├── goal-file-example.md
│   └── adr/
```

---

## Validating Skills

Before committing new or modified skills, run the validator:

```bash
bash scripts/validate-skills.sh
```

Expected output: `0 failures`. All 101 skills must pass.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full guide on:
- Adding a new skill
- Adding a pipeline template
- Modifying agents
- PR and review process

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
| `docs/changelog.md` | Version history |

The [AI Workflow website](https://github.com/your-username/ase-os-website) — a separate repo — renders all of this interactively as a browsable skill catalog.

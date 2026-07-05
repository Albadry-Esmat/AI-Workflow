# Contributing to AI Workflow

Thank you for contributing! This guide covers everything you need to add a skill, pipeline, or agent, and get it merged.

---

## Table of Contents

1. [Setup](#setup)
2. [Branching strategy](#branching-strategy)
3. [Adding a skill](#adding-a-skill)
4. [Adding a pipeline template](#adding-a-pipeline-template)
5. [Modifying an agent](#modifying-an-agent)
6. [Validating your changes](#validating-your-changes)
7. [Running the website locally](#running-the-website-locally)
8. [PR checklist](#pr-checklist)

---

## Setup

Clone the repo and run the single setup command:

```bash
git clone https://github.com/your-org/ai-workflow.git
cd ai-workflow
make setup
```

Then open `.env` and set `GITHUB_TOKEN`. That's all you need to start contributing.

```bash
make health     # verify your environment
make validate   # run the full skill validation suite
opencode        # start the AI workflow
```

See `make help` for a full list of available commands.

---

## Branching strategy

| Branch | Purpose |
|--------|---------|
| `main` | Clean public framework. Only framework improvements land here. No personal project data. |
| `develop` (or your fork) | Your project work — tasks, features, bugs, planning docs. Never merge personal project data into `main`. |

**Workflow:**
1. Fork the repo (or branch from `main` for framework changes).
2. Make your changes.
3. Open a PR targeting `main`.
4. Framework improvements (new skills, pipeline fixes, docs) are welcome on `main`. Project-specific content (your work-items, personal identity) stays in your fork/branch.

---

## Adding a skill

### 1 — Create the SKILL.md file

Every skill lives at `.opencode/skills/<skill-name>/SKILL.md`. Copy the structure from the template:

```bash
cp skills/template/skill-template.md .opencode/skills/<skill-name>/SKILL.md
```

Fill in all 12 sections:

```
## 1. Purpose
## 2. Inputs
## 3. Required Context
## 4. Execution Logic
## 5. Outputs
## 6. Rules
## 7. Security
## 8. Token Optimization
## 9. Quality Check
## 10. Failure Handling
## 11. Human-in-the-Loop
## 12. Skill Composition
```

All 12 sections are **required**. `make validate` will fail if any are missing.

### 2 — Assign a Skill ID

Skill IDs follow the format `SKL-NNN` (zero-padded to 3 digits). Find the next available:

```bash
grep "^- id:" skills/index.yaml | tail -5
```

### 3 — Add to skills/index.yaml

Add a new entry at the end of `skills/index.yaml`. Follow the exact format of existing entries:

```yaml
- id: SKL-NNN
  name: your-skill-name
  title: "Short Human-Readable Title"
  version: "1.0.0"
  status: active
  category: <category>
  agent: <agent-name>
  executable_skill: .opencode/skills/your-skill-name/SKILL.md
  description: "One sentence description."
```

> **Note:** `- id:` lines must be at column 0 (no leading spaces).

### 4 — Update skills/registry.json

Add the skill entry to `skills/registry.json` following the existing schema. Required fields: `name`, `version`, `path`, `status`, `domain`, `inputs`, `outputs`.

### 5 — Update skills/graph/skill-graph.yaml

Add a node entry and increment `total_nodes` by 1.

### 6 — Update docs/changelog.md

Add an entry to the `[Unreleased]` section.

### 7 — Sync website data

```bash
make sync
```

### 8 — Validate

```bash
make validate
```

Expected: `All checks passed — N passed, 0 failed`.

---

## Adding a pipeline template

Pipeline templates are JSON files in `skills/pipelines/`. Create a new file named `<pipeline-name>.json`:

```json
{
  "id": "pipeline-name",
  "name": "Human-Readable Pipeline Name",
  "description": "What this pipeline does.",
  "entry_agent": "analyzer",
  "steps": [
    {
      "skill": "requirement-analyzer",
      "agent": "analyzer",
      "hitl_gate": true
    },
    {
      "skill": "architecture-design",
      "agent": "architect",
      "depends_on": ["requirement-analyzer"],
      "hitl_gate": false
    }
  ]
}
```

Then validate against the pipeline schema:

```bash
make validate
```

---

## Modifying an agent

Agent configuration lives in two places:

1. **`opencode.json`** — model assignment, permission level, skill(s) list.
2. **`.opencode/agent/<name>.md`** — behavioral rules and execution constraints.

When you add a skill to an existing agent, update both `opencode.json` (add the skill path to `"skills"`) and `docs/agents.md` (update the agent's skill table).

When you add a **new** agent:
1. Add it to `opencode.json` under `"agent"`.
2. Create `.opencode/agent/<name>.md` (follow the existing agent files as a template).
3. Update `docs/agents.md` — add to the agent definitions table and the capability mapping table.
4. Update `docs/changelog.md`.

### Model IDs

Use only verified model IDs from `opencode models`. Current assignments:

- **Standard tier** (`claude-sonnet-4.6`): architect, planner, reviewer, tester, builder, recovery, documenter, data-engineer, api-designer, distributed-systems, cloud-platform, security-specialist, sre
- **Lightweight tier** (`claude-haiku-4.5`): analyzer, impact-analyzer, test-generator, deployer, doc-maintainer

---

## Validating your changes

```bash
# Run the full 9-check validation suite (required before any PR)
make validate
```

Expected: `All checks passed — N passed, 0 failed`.

If `website/data/` exists locally, also sync it:

```bash
make sync
```

---

## Running the website locally

The website source lives in a separate companion repository. The `website/` directory in this repo contains only the data mirror used at build time. To update it:

```bash
make sync     # syncs website/data/ from skills/, docs/, .opencode/skills/, opencode.json
```

Then deploy through Vercel or clone the companion repo into `website/` to run locally.

---

## PR checklist

Before opening a pull request, verify:

- [ ] `make validate` → `All checks passed`
- [ ] `make sync` run and `website/data/` changes committed (if skills/docs changed)
- [ ] New skill has all 12 required sections in `SKILL.md`
- [ ] New skill has entries in both `skills/index.yaml` AND `skills/registry.json`
- [ ] `skills/graph/skill-graph.yaml` `total_nodes` updated if skill added/removed
- [ ] `docs/changelog.md` updated with a summary of the change
- [ ] No personal project data (work-items content, personal identity) included
- [ ] No hardcoded owner-specific values in source files

---

## Questions?

Open an issue or start a discussion in the repository. PRs that add genuinely useful skills, fix bugs, or improve documentation are welcome.

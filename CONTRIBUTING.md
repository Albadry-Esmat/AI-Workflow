# Contributing to AI Workflow

Thank you for contributing! This guide covers everything you need to add a skill, pipeline, or agent, and get it merged.

---

## Table of Contents

1. [Branching strategy](#branching-strategy)
2. [Adding a skill](#adding-a-skill)
3. [Adding a pipeline template](#adding-a-pipeline-template)
4. [Modifying an agent](#modifying-an-agent)
5. [Validating your changes](#validating-your-changes)
6. [Running the website locally](#running-the-website-locally)
7. [PR checklist](#pr-checklist)

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

Every skill lives at `.opencode/skills/<skill-name>/SKILL.md`. Copy the structure from an existing skill (e.g., `.opencode/skills/requirement-analyzer/SKILL.md`) and fill in all 13 sections:

```
## 1. Purpose
## 2. Trigger Conditions
## 3. Input Contract
## 4. Output Contract
## 5. Quality Gates
## 6. Execution Steps
## 7. Error Handling
## 8. Examples
## 9. Anti-Patterns
## 10. Related Skills
## 11. Governance
## 12. Changelog
## 13. Skill Composition
```

All 13 sections are **required**. The validator will fail if any section is missing.

### 2 — Assign a Skill ID

Skill IDs follow the format `SKL-NNN` (zero-padded to 3 digits). Check the last entry in `skills/index.yaml` to find the next available number:

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
  path: .opencode/skills/your-skill-name/SKILL.md
  description: "One sentence description."
  triggers:
    - "trigger phrase one"
    - "trigger phrase two"
  inputs:
    - name: input_name
      type: string
      required: true
      description: "What this input is"
  outputs:
    - name: output_name
      type: object
      description: "What this output contains"
  dependencies: []
  pipeline_position: <position>
  hitl_gate: false
```

> **Note:** `- id:` lines must be at column 0 (no leading spaces).

### 4 — Validate

```bash
bash scripts/validate-skills.sh
```

Expected: `0 failures`.

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

Reference the pipeline in `skills/registry.json` if it should appear in the website's pipeline catalog.

---

## Modifying an agent

Agent configuration lives in two places:

1. **`opencode.json`** — model assignment, permission level, skill(s) list.
2. **`.opencode/agent/<name>.md`** — behavioral rules and execution constraints.

When you add a skill to an existing agent, update both `opencode.json` (add the skill path to `"skills"`) and `docs/agents.md` (update the agent's skill table).

When you add a **new** agent:
1. Add it to `opencode.json` under `"agent"`.
2. Create `.opencode/agent/<name>.md`.
3. Update `docs/agents.md` — add to the agent definitions table and the capability mapping table.
4. Update `docs/changelog.md`.

### Model IDs

Use only verified model IDs from `opencode models`. Do not invent model names. Current assignments use tier labels in documentation (`Standard` / `Lightweight`), never exact model IDs in the website UI.

---

## Validating your changes

```bash
# Validate all SKILL.md files (required before any PR)
bash scripts/validate-skills.sh

# Build the website (must be 117+/117 pages, 0 errors)
cd website && npm run build
```

Both must pass with **zero failures / zero errors** before opening a PR.

---

## Running the website locally

```bash
cd website
cp .env.example .env.local   # set your NEXT_PUBLIC_* vars
npm install
npm run dev
```

The site auto-detects data from the parent `ai-workflow/` directory (monorepo mode) — no separate data setup needed.

---

## PR checklist

Before opening a pull request, verify:

- [ ] `bash scripts/validate-skills.sh` → `0 failures`
- [ ] `cd website && npm run build` → all pages generated, 0 errors
- [ ] New skill has all 13 required sections in `SKILL.md`
- [ ] `skills/index.yaml` entry follows the exact format (no leading spaces on `- id:`)
- [ ] `docs/changelog.md` updated with a summary of the change
- [ ] No personal project data (work-items content, personal identity) included in the PR
- [ ] No hardcoded owner-specific values in source code (use `NEXT_PUBLIC_*` env vars)

---

## Questions?

Open an issue or start a discussion in the repository. We review PRs that add genuinely useful skills, fix bugs, or improve documentation.

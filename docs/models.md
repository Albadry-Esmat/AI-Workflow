# Model Configuration Guide

**Version:** 1.0.0 | **Last updated:** 2026-06-25

Per-agent model assignment is fully supported in ASE-OS. Every agent in `opencode.json` carries its own `"model"` field. Changing the model for any agent is a **single-line edit** — no code changes, no restarts required.

---

## How It Works

```json
{
  "model": "github-copilot/claude-sonnet-4.6",   ← global fallback (used if agent has no "model")

  "agent": {
    "builder": {
      "model": "github-copilot/claude-sonnet-4.6", ← per-agent override
      ...
    },
    "test-generator": {
      "model": "github-copilot/gpt-4o-mini",       ← lighter model for rote tasks
      ...
    }
  }
}
```

**Resolution order:** per-agent `"model"` field → global `"model"` at the top of `opencode.json`.

If you remove the `"model"` field from an agent entry, that agent inherits the global default.

---

## Available Models (GitHub Copilot Provider)

All model IDs follow the pattern `github-copilot/<model-id>`.

| Model ID | Provider | Context | Strength | Best for |
|----------|----------|---------|----------|----------|
| `github-copilot/claude-sonnet-4.6` | Anthropic | 200k | Balanced reasoning + code | Default — most agents |
| `github-copilot/claude-opus-4-5` | Anthropic | 200k | Deepest reasoning | Architect, security-specialist when precision is critical |
| `github-copilot/gpt-4o` | OpenAI | 128k | Fast + strong code gen | builder, test-generator |
| `github-copilot/gpt-4o-mini` | OpenAI | 128k | Fast, low cost | doc-maintainer, test-generator, documenter |
| `github-copilot/o3-mini` | OpenAI | 128k | Structured reasoning | impact-analyzer, planner |
| `github-copilot/o1` | OpenAI | 128k | Deep chain-of-thought | reviewer, security-specialist |
| `github-copilot/gemini-2.0-flash` | Google | 1M | Very large context window | Agents that need to read the entire codebase |

> **Tip:** Check your GitHub Copilot plan — some models (Opus, o1, Gemini) require specific subscription tiers.
> Full list: https://docs.github.com/en/copilot/using-github-copilot/ai-models-for-github-copilot

---

## Current Assignments

| Agent | Model | Why |
|-------|-------|-----|
| `primary` | `claude-sonnet-4.6` | Orchestration requires reliable multi-step reasoning |
| `analyzer` | `claude-sonnet-4.6` | Requirement ambiguity detection needs depth |
| `architect` | `claude-sonnet-4.6` | System design decisions have long-range impact |
| `planner` | `claude-sonnet-4.6` | Dependency mapping needs consistent logic |
| `reviewer` | `claude-sonnet-4.6` | Security + SOLID analysis — no shortcuts |
| `tester` | `claude-sonnet-4.6` | Test strategy requires understanding business logic |
| `builder` | `claude-sonnet-4.6` | Code generation must match architecture contracts |
| `impact-analyzer` | `claude-sonnet-4.6` | Graph traversal and blast-radius reasoning |
| `test-generator` | `gpt-4o-mini` | Rote test file output — speed and volume matter |
| `recovery` | `claude-sonnet-4.6` | Rollback decisions must be precise |
| `deployer` | `claude-sonnet-4.6` | Infrastructure decisions have irreversible consequences |
| `documenter` | `claude-sonnet-4.6` | Doc generation quality affects onboarding |
| `doc-maintainer` | `gpt-4o-mini` | Lightweight diff-and-update — no deep reasoning needed |
| `data-engineer` | `claude-sonnet-4.6` | ETL/ML pipeline design is architecturally complex |
| `api-designer` | `claude-sonnet-4.6` | API contracts must be precise and versioned correctly |
| `distributed-systems` | `claude-sonnet-4.6` | DDD/CQRS/saga patterns require deep context |
| `cloud-platform` | `claude-sonnet-4.6` | Cloud architecture trade-offs need careful reasoning |
| `security-specialist` | `claude-sonnet-4.6` | Threat modeling accuracy is non-negotiable |
| `sre` | `claude-sonnet-4.6` | SLO design and chaos experiments need precision |

---

## How to Change a Model

**1. Open `opencode.json`**

**2. Find the agent entry and update its `"model"` field:**

```json
"architect": {
  "mode": "subagent",
  "model": "github-copilot/claude-opus-4-5",   ← change this line
  "permission": { "edit": "deny", "bash": "deny" },
  ...
}
```

**3. Save the file.** The change takes effect on the next agent invocation — no restart needed.

---

## Recommended Tuning Strategies

### Cost Optimisation
Assign `gpt-4o-mini` to high-volume, low-complexity agents:
```json
"doc-maintainer":  { "model": "github-copilot/gpt-4o-mini" },
"test-generator":  { "model": "github-copilot/gpt-4o-mini" },
"documenter":      { "model": "github-copilot/gpt-4o-mini" }
```

### Maximum Quality (critical systems)
Assign `claude-opus-4-5` or `o1` to high-stakes agents:
```json
"architect":            { "model": "github-copilot/claude-opus-4-5" },
"security-specialist":  { "model": "github-copilot/o1" },
"reviewer":             { "model": "github-copilot/o1" }
```

### Large Codebase (context-heavy analysis)
Use `gemini-2.0-flash` for agents that need to read thousands of files:
```json
"impact-analyzer": { "model": "github-copilot/gemini-2.0-flash" },
"reviewer":        { "model": "github-copilot/gemini-2.0-flash" }
```

### Reasoning-Heavy Tasks
Use `o3-mini` for structured multi-step reasoning:
```json
"planner":         { "model": "github-copilot/o3-mini" },
"impact-analyzer": { "model": "github-copilot/o3-mini" }
```

---

## Global Default

The top-level `"model"` key in `opencode.json` is the system-wide fallback:

```json
{
  "model": "github-copilot/claude-sonnet-4.6",
  ...
}
```

To switch every agent to a different default at once, change only this one line. Per-agent overrides continue to take precedence.

---

## Governance Rule

> Model changes to `reviewer`, `security-specialist`, or `recovery` agents require a comment in the PR explaining why a different model was chosen. Downgrading these agents to a lightweight model (e.g. `gpt-4o-mini`) is not permitted without documented justification — they are the safety layer of the pipeline.

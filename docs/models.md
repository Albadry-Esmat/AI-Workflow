# Model Configuration Guide

**Version:** 1.1.0 | **Last updated:** 2026-06-25

Per-agent model assignment is fully supported in ASE-OS. Every agent in `opencode.json` carries its own `"model"` field. Changing the model for any agent is a **single-line edit** — no code changes, no restarts required.

---

## How It Works

```json
{
  "model": "github-copilot/claude-sonnet-4.6",   // global fallback

  "agent": {
    "builder": {
      "model": "github-copilot/claude-sonnet-4.6", // per-agent override
      ...
    },
    "doc-maintainer": {
      "model": "github-copilot/claude-haiku-4.5",  // lighter model for rote tasks
      ...
    }
  }
}
```

**Resolution order:** per-agent `"model"` field → global `"model"` at the top of `opencode.json`.

If you remove the `"model"` field from an agent entry, that agent inherits the global default.

---

## Available Models

Run `opencode models` at any time to see the live list of available model IDs for your account.

All IDs below are verified against `opencode models` output on 2026-06-25.

### Anthropic (Claude)

| Model ID | Tier | Strength | Best for |
|----------|------|----------|----------|
| `github-copilot/claude-sonnet-4.6` | Standard | Balanced reasoning + code | **Current default** — most agents |
| `github-copilot/claude-sonnet-4.5` | Standard | Balanced reasoning + code | Alternative default |
| `github-copilot/claude-sonnet-4` | Standard | Balanced reasoning + code | Stable baseline |
| `github-copilot/claude-opus-4.8` | Premium | Deepest reasoning | Architect, security-specialist, reviewer |
| `github-copilot/claude-opus-4.8-fast` | Premium | Deep reasoning, faster | Same as above with lower latency |
| `github-copilot/claude-opus-4.7` | Premium | Deep reasoning | Alternative premium |
| `github-copilot/claude-opus-4.6` | Premium | Deep reasoning | Alternative premium |
| `github-copilot/claude-opus-4.5` | Premium | Deep reasoning | Alternative premium |
| `github-copilot/claude-haiku-4.5` | Lightweight | Fast, low cost | **doc-maintainer, test-generator, documenter** |
| `github-copilot/claude-fable-5` | Specialised | Creative + long-form | documenter, design-oriented agents |

### OpenAI (GPT)

| Model ID | Tier | Strength | Best for |
|----------|------|----------|----------|
| `github-copilot/gpt-5.5` | Premium | Latest GPT reasoning | reviewer, planner |
| `github-copilot/gpt-5.4` | Standard | Strong reasoning | General-purpose alternative |
| `github-copilot/gpt-5.4-mini` | Lightweight | Fast, mid-cost | test-generator, documenter |
| `github-copilot/gpt-5.4-nano` | Lightweight | Fastest, lowest cost | doc-maintainer (maximum cost savings) |
| `github-copilot/gpt-5.3-codex` | Code | Code-specialised | builder, test-generator |
| `github-copilot/gpt-5.2-codex` | Code | Code-specialised | builder alternative |
| `github-copilot/gpt-5.2` | Standard | Solid reasoning | General-purpose |
| `github-copilot/gpt-5-mini` | Lightweight | Fast, low cost | doc-maintainer, test-generator |
| `github-copilot/gpt-4.1` | Standard | Proven reasoning | Stable alternative to GPT-5 |

### Google (Gemini)

| Model ID | Tier | Strength | Best for |
|----------|------|----------|----------|
| `github-copilot/gemini-2.5-pro` | Premium | Massive context (1M+) | impact-analyzer, reviewer on large codebases |
| `github-copilot/gemini-3.5-flash` | Lightweight | Fast + large context | doc-maintainer, documenter |
| `github-copilot/gemini-3.1-pro-preview` | Premium | Large context, preview | Experimental use |
| `github-copilot/gemini-3-flash-preview` | Lightweight | Fast, preview | Experimental use |

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
| `test-generator` | `claude-haiku-4.5` | Rote test file output — speed and volume matter |
| `recovery` | `claude-sonnet-4.6` | Rollback decisions must be precise |
| `deployer` | `claude-sonnet-4.6` | Infrastructure decisions have irreversible consequences |
| `documenter` | `claude-sonnet-4.6` | Doc generation quality affects onboarding |
| `doc-maintainer` | `claude-haiku-4.5` | Lightweight diff-and-update — no deep reasoning needed |
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
  "model": "github-copilot/claude-opus-4.8",
  "permission": { "edit": "deny", "bash": "deny" },
  ...
}
```

**3. Save the file.** The change takes effect on the next agent invocation — no restart needed.

> **Verify available IDs:** run `opencode models` to see the current live list for your account before editing.

---

## Recommended Tuning Strategies

### Cost Optimisation
Assign `claude-haiku-4.5` (or `gpt-5.4-nano` for maximum savings) to high-volume, low-complexity agents:
```json
"doc-maintainer":  { "model": "github-copilot/claude-haiku-4.5" },
"test-generator":  { "model": "github-copilot/claude-haiku-4.5" },
"documenter":      { "model": "github-copilot/claude-haiku-4.5" }
```

### Maximum Quality (critical systems)
Assign `claude-opus-4.8` to high-stakes reasoning agents:
```json
"architect":            { "model": "github-copilot/claude-opus-4.8" },
"security-specialist":  { "model": "github-copilot/claude-opus-4.8" },
"reviewer":             { "model": "github-copilot/claude-opus-4.8" }
```

### Large Codebase (context-heavy analysis)
Use `gemini-2.5-pro` for agents that need to read thousands of files at once:
```json
"impact-analyzer": { "model": "github-copilot/gemini-2.5-pro" },
"reviewer":        { "model": "github-copilot/gemini-2.5-pro" }
```

### Code-Specialised Generation
Use `gpt-5.3-codex` for agents focused on generating and repairing code:
```json
"builder":         { "model": "github-copilot/gpt-5.3-codex" },
"test-generator":  { "model": "github-copilot/gpt-5.3-codex" }
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

> Model changes to `reviewer`, `security-specialist`, or `recovery` agents require a comment in the PR explaining why a different model was chosen. Downgrading these agents to a lightweight model (e.g. `claude-haiku-4.5`) is not permitted without documented justification — they are the safety layer of the pipeline.

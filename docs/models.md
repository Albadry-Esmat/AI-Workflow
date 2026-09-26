# Model Configuration Guide

**Version:** 2.0.0 | **Last updated:** 2026-09-25

**Single source of truth:** `config/model-requirements.yml` is the ONLY place
that declares model *policy*. To change policy, edit the manifest, then
regenerate the runtime projection:

```bash
node scripts/sync-opencode-models.js --write   # project manifest → opencode.json
node scripts/sync-opencode-models.js --check   # CI drift gate
```

`opencode.json` model fields are a generated runtime representation — never
edit them independently. The task router chooses WHAT executes
(pipeline/agent/stage) and references the manifest via `model_requirement`;
it never declares model IDs.

---

## Model precedence

```text
Agent/task-specific explicit model
        ↓
Global agent model (global_agent_model)
        ↓
Current runtime/session model
```

Highest priority wins. Resolution is deterministic.

**The runtime determines the default model. The repository overrides it only
when an explicit model policy exists. Explicit model requirements are strict.
Inherited runtime selection is dynamic.** This replaces the previous rule that
every agent always declares an exact repository model.

### Examples

Case A — inheritance (no overrides anywhere, session `openai/gpt-5.6`):

```text
developer → openai/gpt-5.6   (selection source: runtime)
```

Case B — global override (`global_agent_model: github-copilot/claude-sonnet-4.6`,
session `openai/gpt-5.6`, no developer override):

```text
developer → github-copilot/claude-sonnet-4.6   (selection source: global_override)
```

Case C — agent override (session `openai/gpt-5.6`, global
`github-copilot/claude-sonnet-4.6`, reviewer override
`github-copilot/claude-haiku-4.5`):

```text
reviewer → github-copilot/claude-haiku-4.5   (selection source: agent_override)
```

---

## Inheritance is NOT fallback

If no agent/global override exists, using the current runtime model is normal
inheritance — not fallback.

However, once an explicit override is selected and that model is unavailable,
execution **BLOCKS**. It never falls back to the runtime model, the global
model, another provider, or a similar model. Likewise, if a global model is
explicitly configured and unavailable, every agent relying on it fails closed
(agents with their own valid overrides still resolve per execution policy).

---

## Configuration semantics

### Inherit

Model field absent or `model: null`:

```yaml
agents:
  developer:
    model: null
    provider: null
    capabilities: [code-generation, code-repair]
    tier_hint: balanced
    fallbacks: []
    on_unavailable: fail_closed
```

Meaning: continue to the lower-priority source. Missing model configuration is
valid and means inheritance.

### Explicit model

```yaml
agents:
  reviewer:
    model: github-copilot/claude-sonnet-4.6
    fallbacks: []
    on_unavailable: fail_closed
```

Meaning: require exactly this model. If it (and any declared fallback) is
unavailable, block with no silent inheritance.

### Global agent model

Optional, top-level, clearly separate from the runtime's own selected model:

```yaml
global_agent_model: null   # null = no global override (inherit runtime model)
```

Meaning: use this exact model for all agents/tasks without their own override.
When set, it is an explicit requirement — unavailable means dependents block.

---

## Runtime/session model discovery

The intended default is **the model currently active for the
execution/session** — not the catalog, not a configured provider default, and
never the first available model.

OpenCode loads its session model in this priority: `--model`/`-m` flag →
`model` in OpenCode config → last used model → first model (internal
priority). OpenCode exposes **no CLI/API that reports the live
TUI/CLI-selected model** to an out-of-band script (`opencode models` lists the
*catalog*, not the *selection*). That is a runtime limitation, documented here
exactly.

Safest supported mechanism (`scripts/runtime-session-model.js`, deterministic,
no auth, no secrets):

```text
AIW_RUNTIME_MODEL env → OPENCODE_MODEL env → opencode.json top-level
`model` (project default; skipped when it carries global policy) → missing
```

- `AIW_RUNTIME_MODEL` is the primary operator/CI pin. Running
  `opencode run -m <id>`? Export the same `<id>` so AIW verification matches
  the live session.
- `OPENCODE_MODEL` is honored because `opencode.json` supports
  `"model": "{env:OPENCODE_MODEL}"`.
- The catalog is never consulted for selection. If no override exists and no
  session model resolves, execution fails closed:
  `No model override is configured and no current runtime model could be
  resolved.` A random model is never picked.

---

## How it works

```json
{
  "agent": {
    "builder": {
      "model": "some-provider/some-model"
    },
    "doc-maintainer": {
    }
  }
}
```

Only agents with an explicit override carry a `"model"` field (generated).
Inheriting agents carry **no** model field, so OpenCode/runtime behavior stays
native: primary agents use the globally configured model while subagents use
the model of the primary agent that invoked them.

**Resolution order:** `config/model-requirements.yml` (policy) → task router
`model_requirement` reference → `scripts/resolve-model.js` precedence
(agent/global/runtime) → `runtime.listAvailableModels()` live verification →
execute, or declared fallback, or `fail_closed`. `tier_hint` is reporting
metadata only and never participates in resolution.

> **Verify available IDs:** ask the runtime (`runtime.listAvailableModels()`,
> surfaced locally via `node scripts/check-model-runtime-compatibility.js`)
> to see the current list before editing. Availability never changes an
> explicit requirement — an unavailable explicit model fails closed unless a
> manifest-declared fallback is available.

If you remove the `"model"` field from a manifest entry (or set it `null`),
that agent inherits the global override, else the runtime/session model.

---

## Runtime catalog verification (mandatory)

After precedence selects a model (override, global, or inherited session),
that exact model is verified against the live runtime catalog:

```text
resolve source
      ↓
selected model
      ↓
live catalog verification
      ↓
available → execute
missing   → block
```

No execution uses an unverified model. Connecting GitHub Copilot, OpenAI, LM
Studio, or another provider automatically makes its models available through
the runtime catalog — no repository change needed unless an explicit override
requires a specific provider.

---

## Provider neutrality

The resolver does not care which provider a model comes from
(`openai/*`, `github-copilot/*`, `lmstudio-llm/*`, `opencode/*`,
`future-provider/*`) unless an explicit override requires one. Provider
availability remains runtime-owned. The repository pins a provider only when
that is intentional policy.

---

## Tasks

Tasks use the same precedence, with task and agent overrides as intentionally
separate namespaces sharing the global and runtime layers:

```text
task-specific model → global model → runtime/session model   (template launch)
agent-specific model → global model → runtime/session model  (agent launch)
```

A template launch (`aiw run --template …`) resolves the **task's**
requirement; an agent launch resolves the **agent's** requirement. Both fall
through to the same global override, then the same session model.

---

## Available models

> Boundary: Declare → Verify → Consume → Execute. The workflow declares model
> *policy* in `config/model-requirements.yml` and verifies availability
> through the runtime capability interface
> (`runtime.listAvailableModels()`). Provider-specific discovery (e.g.
> `opencode models`, a provider API, or a local runtime probe) lives below the
> AI Workflow boundary in `scripts/runtime-integration/` and is never invoked
> by core workflow logic. For a deterministic local check, set
> `AIW_AVAILABLE_MODELS="<provider>/<model>,..."` (catalog fixture) and
> `AIW_RUNTIME_MODEL="<provider>/<model>"` (session fixture).

Model IDs below are known examples, **not** requirements — verify against
your runtime before pinning one explicitly. The manifest is authoritative for
policy; the runtime is authoritative for availability.

### Anthropic (Claude)

| Model ID | Tier | Strength | Best for |
|----------|------|----------|----------|
| `github-copilot/claude-sonnet-4.6` | Standard | Balanced reasoning + code | General-purpose default |
| `github-copilot/claude-opus-4.8` | Premium | Deepest reasoning | architect, security-specialist, reviewer |
| `github-copilot/claude-haiku-4.5` | Lightweight | Fast, low cost | doc-maintainer, test-generator |

### OpenAI (GPT)

| Model ID | Tier | Strength | Best for |
|----------|------|----------|----------|
| `openai/gpt-5.6` | Standard | Strong reasoning | General-purpose alternative |
| `openai/gpt-5.4` | Standard | Strong reasoning | General-purpose alternative |
| `openai/gpt-5.4-mini` | Lightweight | Fast, mid-cost | test-generator, documenter |

### Local (LM Studio)

| Model ID | Tier | Strength | Best for |
|----------|------|----------|----------|
| `lmstudio-llm/qwen/qwen3.6-35b-a3b` | Local | Private, offline-capable | Any agent when selected in the runtime |

---

## Current assignments

All 24 agents and 3 tasks **inherit** the runtime/session model (no explicit
pins, no global override). `config/model-requirements.yml` is authoritative;
`capabilities` and `tier_hint` below remain as descriptive signals for future
explicit policy, not execution requirements.

| Agent/Task | Policy | Signal |
|------------|--------|--------|
| `primary` and all subagents | inherit | `tier_hint` balanced/cheap per role |
| `quick-fix`, `feature-delivery`, `release-review` | inherit | `tier_hint` cheap/balanced/frontier |
| `global_agent_model` | none (`null`) | runtime/session model is the default |

Cost/quality tuning (e.g. lightweight models for rote agents, premium models
for the safety layer) should be re-expressed as deliberate explicit policy
with documented justification — not as provider-coupled defaults. The
`tier_hint` field preserves the cost/quality signal without provider coupling.

---

## How to change a model

**1. Open `config/model-requirements.yml`**

**2. Set an explicit `model` (and `fallbacks` if needed), or a global override:**

```yaml
global_agent_model: null   # or an exact provider/model id

agents:
  architect:
    model: some-provider/some-model
    fallbacks: []
    on_unavailable: fail_closed
```

To return an agent to inheritance, set its `model:` to `null` (and clear
`fallbacks` and `provider`).

**3. Regenerate the runtime projection and verify:**

```bash
node scripts/sync-opencode-models.js --write
node scripts/sync-opencode-models.js --check
python3 scripts/validate-model-requirements.py
AIW_AVAILABLE_MODELS="..." AIW_RUNTIME_MODEL="..." node scripts/check-model-runtime-compatibility.js
```

The change takes effect on the next agent invocation — no restart needed.
Never edit `opencode.json` model fields or `.opencode/agent/*.md` frontmatter
`model:` lines by hand; both are generated.

> Availability check: ask the runtime capability interface — never assume a
> provider-specific command. Availability never changes an explicit
> requirement: an unavailable explicit model (and no available declared
> fallback) fails closed.

---

## Global default

The optional `global_agent_model` in `config/model-requirements.yml` is the
system-wide policy default. When set, it projects to the top-level `"model"`
key in `opencode.json` so inheriting agents use it natively:

```yaml
global_agent_model: some-provider/some-model
```

When `null`, `opencode.json` carries no top-level `"model"` key and the
runtime chooses natively (`--model` flag / last-used / first). Per-agent
explicit overrides always take precedence over the global model.

---

## Runtime ownership, availability verification, and fail-closed semantics

**The runtime determines the default model. The repository overrides it only
when explicit policy exists. The resolver proves compatibility. Execution
consumes the verified resolution.**

- **Manifest authority:** `config/model-requirements.yml` is the sole
  authority for model *policy*: optional per-agent/task explicit overrides
  plus the optional `global_agent_model`. `tier_hint` is descriptive metadata
  only.
- **Generated projection:** `opencode.json` `"model"` fields and
  `.opencode/agent/*.md` frontmatter `model:` lines are generated from the
  manifest (`node scripts/sync-opencode-models.js --write`, gated by
  `--check`). Explicit entries project an exact field/line; inheriting entries
  project no field and no line (this is what lets agents inherit the
  runtime/session model natively). Never edit them by hand.
- **Runtime ownership:** installed providers, provider authentication,
  credentials, the available model catalog, and the live session selection
  belong to the operator/runtime. The workflow never authenticates providers,
  configures credentials, modifies secret stores, or runs provider login. It
  asks `runtime.listAvailableModels()` WHAT is available and resolves the
  session model via `AIW_RUNTIME_MODEL → OPENCODE_MODEL → project default`.
- **Enforcement on the execution path:** launchers that dispatch work
  (`scripts/aiw-run.js` via `aiw run`, `scripts/orchestrate-workers.js`)
  verify through the single authoritative module
  `scripts/require-model-availability.js` BEFORE contacting any adapter. On
  failure they exit non-zero with one concise actionable error and write no
  partial state. Adapters never resolve — they consume the verified
  `model_resolution` record and bind it into trace/checkpoint.
  `opencode models` (via `opencode-provider.js`) is the authoritative
  discovery source for OpenCode-executable models; `copilot-provider.js` is
  intentionally unsupported so discovery can never contradict what OpenCode
  itself reports.
- **Resolution outcomes** (`scripts/resolve-model.js`, via
  `node scripts/check-model-runtime-compatibility.js`: `Agent | Selected Model
  | Source`, then availability verification):
  - `AVAILABLE` — the selected model (override, global, or inherited runtime)
    exists exactly. Execution allowed.
  - `APPROVED_FALLBACK` — an explicit override is unavailable but a
    manifest-declared fallback is available. Execution allowed on the fallback.
  - `UNAVAILABLE` — the selection is missing from the catalog (or no session
    model resolves). Execution denied (fail closed).
  - An available model is **not** automatically an acceptable model. Implicit
    substitution (similar/cheaper/newer/same-tier/cross-provider) is forbidden,
    and explicit overrides never inherit silently.
- **Two separate validations** (do not conflate them):
  1. *Projection integrity* — `model-requirements.yml → opencode.json` has no
     drift: `node scripts/sync-opencode-models.js --check`.
  2. *Runtime compatibility* — precedence selections ⊆ live runtime
     capabilities: `node scripts/check-model-runtime-compatibility.js`.
     OpenCode startup must never be the first component to discover a mismatch.
- **Diagnosing unavailable models:** the gate prints one actionable line per
  blocked entry — e.g. an explicit block, a missing-session block (`No model
  override is configured and no current runtime model could be resolved`), or
  an absent-session-model block. It never prints credentials. The full matrix
  and audit-grade resolution records (selection source, explicit-override
  flag, requested agent override, global override, runtime/session model,
  provider, fallback use, reason, availability source, HEAD SHA, timestamp)
  are written to `artifacts/model-runtime-compatibility.json`.
- **Operator action when a required provider is not connected:** connect the
  required provider in your runtime and re-run the gate. Do NOT weaken
  explicit policy, add silent fallbacks, or hand-edit `opencode.json` to make
  startup succeed — an explicit requirement change needs a manifest edit with
  governance review (safety-critical agents: `reviewer`, `gatekeeper`,
  `security-specialist`, `recovery`).
- **Deterministic checks:** for CI or pinning, set
  `AIW_AVAILABLE_MODELS="<provider>/<model>,..."` (catalog fixture) and
  `AIW_RUNTIME_MODEL="<provider>/<model>"` (session fixture). Fixtures never
  redefine policy; they only satisfy it or not.

## Governance Rule

> Adding an explicit model override to `reviewer`, `gatekeeper`,
> `security-specialist`, or `recovery` requires a comment in the PR explaining
> why that exact model was chosen. Downgrading these agents to a lightweight
> model (e.g. a haiku-class model) is not permitted without documented
> justification — they are the safety layer of the pipeline.

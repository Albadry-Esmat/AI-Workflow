---
id: SKL-061
name: environment-config-manager
version: 1.0.0
status: draft
draft: true
domain: system
description: 'Use when generating .env.example templates, validating that all referenced environment variables are declared, and producing environment-specific config overlays. Triggers on: "env template", "missing env var", "undeclared env", "env config check", "is this safe to deploy", "env overlay". Do NOT use for secret rotation or vault management — use secrets-management-architect for that.'
author: ASE-OS
---

# Environment Config Manager

**Version:** 1.0.0 | **Last updated:** 2026-09-29

Evidence-producer skill that extracts every environment variable referenced in `code_map` and architecture `integration_points`, cross-references them against `env_declarations`, and emits a grouped, documented `.env.example` template plus per-environment config overlays. Any var used in code but absent from declarations is flagged as a **deployment risk**.

**This skill NEVER outputs secret values — variable names only. Values are always placeholders or empty.**

---

## 1. Skill Header

```yaml
id: SKL-061
name: environment-config-manager
version: 1.0.0
status: draft
draft: true
domain: system
description: >
  Use when generating .env.example templates, validating that all referenced
  environment variables are declared, and producing environment-specific
  config overlays. Triggers on: "env template", "missing env var",
  "undeclared env", "env config check", "is this safe to deploy", "env overlay".
  Do NOT use for secret rotation or vault management.
author: ASE-OS
```

---

## 2. Purpose

`environment-config-manager` closes the silent-deployment-failure gap: a new env var is added in code but never documented, so staging or production crashes at runtime. Where `code-generator` writes code that reads env vars and `deployment-strategy` defines where that code runs, this skill produces the contract between them — the complete, grouped, annotated variable inventory.

**No referenced env var may reach deployment without a declaration entry.** Any var found in code but missing from `env_declarations` is emitted in `undeclared_vars` and escalated to a `deployment_risk` verdict when a `REQUIRED` var is missing from a `staging` or `production` overlay. This is a fail-closed evidence producer: missing inputs produce a risk verdict, never a clean pass.

The skill runs in **phase-8c-env-config** (`pre-deploy.json`) and **phase-8b-env** (`full-pipeline.json`), consuming `code_map` output and feeding `deployment-strategy`.

---

## 3. Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `code_map` | `object` | Yes | Code inventory from state-manager: file paths mapped to referenced symbols and env var usages |
| `env_declarations` | `object` | No | Current `.env.example` contents as `{ VAR_NAME: { documented: boolean, required: boolean, default_value_hint: string } }`. If absent, every discovered var is treated as undeclared |
| `target_environments` | `array[string]` | No | Environments to produce overlays for. Default: `["development", "staging", "production"]` |
| `dry_run` | `boolean` | No | If true, return template preview without writing any files (`files_written: []`). Default: `false` |
| `architecture` | `object` | No | Full architecture output — `integration_points` are scanned for third-party credential requirements |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["code_map"],
  "properties": {
    "code_map": {
      "type": "object",
      "description": "File path -> file record map. Each record may carry env_refs[] or raw source for pattern scanning."
    },
    "env_declarations": {
      "type": "object",
      "description": "Current .env.example declarations keyed by VAR_NAME",
      "additionalProperties": {
        "type": "object",
        "required": ["documented"],
        "properties": {
          "documented":         { "type": "boolean" },
          "required":           { "type": "boolean" },
          "default_value_hint": { "type": "string" }
        }
      }
    },
    "target_environments": {
      "type": "array",
      "items": { "type": "string", "enum": ["development", "staging", "production"] },
      "default": ["development", "staging", "production"]
    },
    "dry_run": { "type": "boolean", "default": false },
    "architecture": {
      "type": "object",
      "description": "Architecture output; integration_points scanned for credential needs"
    }
  }
}
```

---

## 4. Required Context

- `code_map` from state-manager is mandatory. If `code_map` is missing or empty → fail closed: `verdict: "deployment_risk"` with reason `missing_code_map` (never an empty clean template).
- `env_declarations` is optional but its absence means every discovered var lands in `undeclared_vars`.
- `architecture.integration_points` (when present) contribute expected credential vars (e.g. a `stripe` integration implies `STRIPE_SECRET_KEY` should exist); a missing expected credential is a deployment risk, not an undeclared-var violation.
- This skill reads declarations and code only — it never reads real `.env` files, vault contents, or process environments.

---

## 5. Execution Logic

```
Step 1 — Extract referenced env vars from code_map (and architecture.integration_points)
  Apply per-ecosystem patterns:
    JavaScript/TypeScript: process\.env\.([A-Z_][A-Z0-9_]*) , env\.([A-Z_][A-Z0-9_]*)
    Python:                os\.environ\[['"]([A-Z_][A-Z0-9_]*)['"]\] , os\.getenv\(['"]([A-Z_][A-Z0-9_]*)['"]\)
    Go:                    os\.Getenv\("([A-Z_][A-Z0-9_]*)"\)
    Rust:                 env::var\("([A-Z_][A-Z0-9_]*)"\)
  Record each hit as { var, found_in: ["<path>:<line>"] }. Merge duplicate vars, union locations.
  Output: discovered_vars[]

Step 2 — Cross-reference against env_declarations
  For each var in discovered_vars:
    IF var NOT in env_declarations (or documented == false):
      → undeclared_vars[] entry { var, reason: "undeclared", found_in: [...] }
  Output: undeclared_vars[]

Step 3 — Classify, group, and annotate
  SECRET detection (name-only heuristic): var name contains KEY, SECRET, TOKEN,
  PASSWORD, PRIVATE, CREDENTIAL → type: SECRET, else type: STANDARD.
  REQUIRED vs OPTIONAL: env_declarations[var].required == true → REQUIRED, else OPTIONAL.
  Group by prefix heuristic:
    DB_ / DATABASE_        → DATABASE
    JWT_ / AUTH_ / SESSION_ → AUTHENTICATION
    STRIPE_ / PAYMENT_ / BILLING_ → PAYMENTS
    S3_ / AWS_ / GCP_ / AZURE_ / CLOUD_ → CLOUD
    FEATURE_ / FLAG_       → FEATURE FLAGS
    LOG_ / OTEL_ / SENTRY_ → OBSERVABILITY
    everything else        → GENERAL
  Emit env_template: grouped .env.example text with per-var comment
    "<REQUIRED|OPTIONAL>[ SECRET] | <description or 'Undocumented — added by environment-config-manager'>".
  NEVER emit a real value: SECRET vars render as empty; others render empty or
  with a non-sensitive placeholder (e.g. DATABASE_POOL_SIZE=10).
  Output: env_template (string)

Step 4 — Produce per-environment overlays
  For each env in target_environments (default development, staging, production):
    overlay = { environment: env, vars: [{ var, presence: REQUIRED|OPTIONAL, type: STANDARD|SECRET }] }
    Staging/production overlays mark every REQUIRED var explicitly; a REQUIRED var
    with no declaration entry is recorded in deployment_risks[]:
      { var, environment: env, reason: "required_undeclared_in_<env>" }.
  Output: overlays[]

Step 5 — Determine verdict
  IF code_map missing/empty → verdict = "deployment_risk", reason "missing_code_map".
  ELSE IF any REQUIRED var is missing in a staging or production overlay
    → verdict = "deployment_risk".
  ELSE IF undeclared_vars.length > 0 (OPTIONAL-only) → verdict = "needs_documentation".
  ELSE → verdict = "clean".
  Output: verdict

Step 6 — Assemble output (honour dry_run)
  Compose: env_template, overlays, undeclared_vars, deployment_risks,
    verdict, files_written, metrics, feedback.
  IF dry_run == true: files_written = [] (no filesystem mutation; preview only).
  ELSE: files_written = [".env.example"] (+ per-env overlay paths adopted by the orchestrator).
  Output: complete evidence bundle
```

---

## 6. Outputs

| Field | Type | Description |
|-------|------|-------------|
| `env_template` | `string` | Grouped `.env.example` template text (names + annotations only, never values) |
| `overlays` | `array[object]` | Per-environment overlays: `{ environment, vars: [{ var, presence, type }] }` |
| `undeclared_vars` | `array[object]` | Vars used in code but absent from declarations: `{ var, reason, found_in }` |
| `deployment_risks` | `array[object]` | REQUIRED vars missing per environment: `{ var, environment, reason }` |
| `verdict` | `string` | `"clean"` \| `"needs_documentation"` \| `"deployment_risk"` |
| `files_written` | `array[string]` | Paths written; always `[]` when `dry_run: true` |
| `metrics` | `object` | tokens_in, tokens_out, duration_ms, items_produced, version |
| `feedback` | `array[object]` | Backpropagate routes to code-generator or deployment-strategy |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["env_template", "overlays", "undeclared_vars", "deployment_risks", "verdict", "metrics", "feedback"],
  "properties": {
    "env_template": { "type": "string" },
    "overlays": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["environment", "vars"],
        "properties": {
          "environment": { "type": "string", "enum": ["development", "staging", "production"] },
          "vars": {
            "type": "array",
            "items": {
              "type": "object",
              "required": ["var", "presence", "type"],
              "properties": {
                "var":      { "type": "string", "pattern": "^[A-Z][A-Z0-9_]*$" },
                "presence": { "type": "string", "enum": ["REQUIRED", "OPTIONAL"] },
                "type":     { "type": "string", "enum": ["STANDARD", "SECRET"] }
              }
            }
          }
        }
      }
    },
    "undeclared_vars": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["var", "reason", "found_in"],
        "properties": {
          "var":      { "type": "string" },
          "reason":   { "type": "string", "enum": ["undeclared"] },
          "found_in": { "type": "array", "items": { "type": "string" } }
        }
      }
    },
    "deployment_risks": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["var", "environment", "reason"],
        "properties": {
          "var":         { "type": "string" },
          "environment": { "type": "string" },
          "reason":      { "type": "string" }
        }
      }
    },
    "verdict":       { "type": "string", "enum": ["clean", "needs_documentation", "deployment_risk"] },
    "files_written": { "type": "array", "items": { "type": "string" } },
    "metrics":  { "$ref": "#/$defs/metrics" },
    "feedback": { "type": "array", "items": { "$ref": "#/$defs/feedback_entry" } }
  },
  "$defs": {
    "metrics": {
      "type": "object",
      "required": ["tokens_in", "tokens_out", "duration_ms", "items_produced", "version"],
      "properties": {
        "tokens_in":      { "type": "integer" },
        "tokens_out":     { "type": "integer" },
        "duration_ms":    { "type": "integer" },
        "items_produced": { "type": "integer" },
        "version":        { "type": "string" }
      }
    },
    "feedback_entry": {
      "type": "object",
      "required": ["type", "from_skill", "reason"],
      "properties": {
        "type":         { "type": "string", "enum": ["backpropagate", "info", "warning"] },
        "from_skill":   { "type": "string" },
        "target_skill": { "type": "string" },
        "reason":       { "type": "string" },
        "evidence":     { "type": "object" }
      }
    }
  }
}
```

---

## 7. Deployment Risk Conditions (verdict = "deployment_risk")

| Rule | Condition | Resolution Path |
|------|-----------|-----------------|
| `missing_code_map` | `code_map` input missing or empty | Pipeline block — state-manager must provide code_map first (fail closed) |
| `required_undeclared_in_staging` | REQUIRED var missing from staging overlay | Declare the var or downgrade to OPTIONAL with justification |
| `required_undeclared_in_production` | REQUIRED var missing from production overlay | Declare the var or downgrade to OPTIONAL with justification |
| `undeclared_var` | Var referenced in code, absent from `env_declarations` | Add to `.env.example` (surfaced in `undeclared_vars`; OPTIONAL-only yields `needs_documentation`) |
| `secret_without_annotation` | SECRET-pattern var emitted without `SECRET` annotation | Re-run template generation (internal invariant) |

---

## 8. Rules & Constraints

- This skill **never outputs secret values** — only variable names, `REQUIRED`/`OPTIONAL`/`SECRET` annotations, and non-sensitive placeholders. A `SECRET`-typed var MUST render with an empty value.
- This skill never reads real `.env` files, vaults, or live process environments — declarations and code references only.
- `dry_run: true` MUST NOT write any files: `files_written` is always `[]` in dry-run mode.
- Classification is name-based only (`KEY`, `SECRET`, `TOKEN`, `PASSWORD`, `PRIVATE`, `CREDENTIAL` substrings) — never inferred from a value, because values are never visible.
- Maximum `undeclared_vars` returned: 100. Additional vars are summarized as `{ count: N, sample: [...] }`.
- No network calls. No credential minting, rotation, or storage.

---

## 9. Security Considerations

- Secret values are never present in inputs by design; if any input field resembling a value (`value`, `secret`, `password`) is detected, strip it, keep the name, and emit a security warning in `feedback`.
- Do NOT log file contents beyond `path:line` references and var names.
- Do NOT echo `default_value_hint` when the var is `SECRET`-typed — render the annotation only.
- The guard MUST NOT downgrade a `REQUIRED` var to `OPTIONAL` on its own authority — that requires a human or owning-skill decision.

---

## 10. Token Optimization

- Scan only env-reference patterns — do not load full file bodies into context; operate on `code_map` records.
- Each undeclared var summary: var + reason + first location only (≤ 30 tokens per var).
- Cap `undeclared_vars` at 100, `deployment_risks` at 100 — summarize excess as `{ count: N }`.
- `target_environments` is a short enum array — no verbose loading required.

---

## 11. Quality Checklist

- [ ] Every `process.env.*` / `os.environ` / `os.Getenv` / `env::var` reference extracted with at least one `found_in` location
- [ ] Every discovered var either declared or present in `undeclared_vars` with reason `undeclared`
- [ ] All `KEY`/`SECRET`/`TOKEN`/`PASSWORD` vars annotated `type: SECRET` with empty values
- [ ] `.env.example` groups follow the prefix heuristic; ungrouped vars fall through to GENERAL
- [ ] Staging/production overlays mark every REQUIRED var; missing ones appear in `deployment_risks`
- [ ] `verdict` is exactly `"clean"`, `"needs_documentation"`, or `"deployment_risk"` — no other values
- [ ] `files_written` is `[]` when `dry_run: true`
- [ ] No secret value appears anywhere in the output
- [ ] `metrics` populated with execution data
- [ ] Output is valid JSON matching output schema

---

## 12. Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| `code_map` input missing or empty | `verdict: "deployment_risk"`, `reason: "missing_code_map"` — fail safe, never clean |
| `env_declarations` missing | Treat all discovered vars as undeclared; `verdict` per Step 5 |
| `target_environments` contains unknown env | Ignore unknown env; warn in feedback |
| Var name does not match `^[A-Z][A-Z0-9_]*$` | Keep the finding with reason `undeclared`; flag name-format warning |
| Input carries a secret-like value field | Strip the value, keep the name, emit security warning |
| Zero vars discovered | `verdict: "clean"` with info feedback: "No env references found — verify code_map coverage" |

---

## 13. Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Override |
|------|---------|---------|----------|
| Deployment risk approval | `verdict: "deployment_risk"` | 3600s | Human declares the var (or downgrades REQUIRED → OPTIONAL with reason); skill re-runs |
| Undocumented vars only | `verdict: "needs_documentation"` | 3600s | Human approves template as-is or adds descriptions; re-run |

When a HITL gate is triggered, the orchestrator presents `undeclared_vars` and `deployment_risks` verbatim along with the `env_template` preview. The user may:
- Declare the missing vars (decision recorded; orchestrator re-runs with updated `env_declarations`)
- Downgrade REQUIRED → OPTIONAL with written justification
- Accept the preview without writing (dry-run acknowledgement)

---

## 14. Skill Composition

`environment-config-manager` runs in `phase-8c-env-config` (`pre-deploy.json`) and `phase-8b-env` (`full-pipeline.json`), consuming `code_map` and feeding `deployment-strategy`:

```yaml
name: phase-8c-env-config
composes:
  - skill: environment-config-manager
    version: "^1.0.0"
    input_map:
      code_map:             "state_code_map"
      env_declarations:     "env_example_declarations"
      target_environments:  "session_context.target_environments"
      dry_run:              "session_context.dry_run"
    output_map:
      env_template:     "env_example_template"
      overlays:         "env_overlays"
      undeclared_vars:  "env_undeclared_vars"
      deployment_risks: "env_deployment_risks"
```

The orchestrator reads `verdict` after this phase:
- `"clean"` → continue to deployment-strategy
- `"needs_documentation"` → surface template for approval, then continue
- `"deployment_risk"` → halt pre-deploy, present `deployment_risks` to user, await HITL response

### Feedback Routes

| Target Skill | Condition | Description |
|---|---|---|
| `code-generator` | `undeclared_vars.length > 0` | Backpropagate: new env reads need declarations added alongside code |
| `deployment-strategy` | `verdict == "deployment_risk"` | Block pre-deploy until REQUIRED vars are declared per environment |
| `secrets-management-architect` | Any `SECRET`-typed var undeclared | Surface unmanaged secret for vault onboarding |

### Changelog

| Version | Date | Change |
|---------|------|--------|
| 1.0.0 | 2026-09-29 | Initial release — .env.example synthesis, declaration cross-check, per-environment overlays with fail-closed deployment-risk verdict |

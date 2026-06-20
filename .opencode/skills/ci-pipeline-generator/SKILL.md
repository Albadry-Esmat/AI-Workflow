---
name: ci-pipeline-generator
version: 1.0.0
domain: deployment
description: 'Use when generating executable CI/CD pipeline files from a deployment strategy. Triggers on: "generate the pipeline", "create GitHub Actions workflow", "CI/CD scaffold", "write the Dockerfile", "generate pipeline YAML", "create CI config". Do NOT use before deployment-strategy has run — this skill requires deployment_strategy output as its primary input.'
author: ASE-OS
---

# CI Pipeline Generator

**Version:** 1.0.0 | **Last updated:** 2026-06-18

Closes the deployment artifact gap: `deployment-strategy` produces a strategy document, this skill produces the **executable files** — GitHub Actions workflows, GitLab CI YAML, Dockerfiles, docker-compose specs, and environment variable templates. It runs after `deployment-strategy` and before the final production release gate.

---

## 1. Skill Header

```yaml
name: ci-pipeline-generator
version: 1.0.0
domain: deployment
description: >
  Use when generating executable CI/CD pipeline files from a deployment strategy.
  Triggers on: "generate the pipeline", "create GitHub Actions workflow", "CI/CD scaffold",
  "write the Dockerfile", "generate pipeline YAML", "create CI config".
  Do NOT use before deployment-strategy has run.
author: ASE-OS
```

---

## 2. Purpose

`ci-pipeline-generator` bridges the gap between the deployment strategy document and runnable infrastructure files. It reads the deployment strategy output and generates:

- **GitHub Actions** `.github/workflows/*.yml` or **GitLab CI** `.gitlab-ci.yml`
- A multi-stage `Dockerfile` tuned to the detected language and runtime
- A `docker-compose.yml` for local development
- A `.env.example` file documenting all required environment variables
- Optionally: Kubernetes `deployment.yaml` + `service.yaml` specs

All generated files are returned as structured artifacts (path + content) that `code-generator` or the `builder` agent writes to disk.

---

## 3. Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `deployment_strategy` | `object` | Yes | Full output from `deployment-strategy` (SKL-007): environments, promotion_rules, rollback_criteria, feature_flags, deployment_plan |
| `architecture` | `object` | Yes | Modules, integration_points, technical_decisions from `architecture-design` (SKL-002) |
| `repository_metadata` | `object` | Yes | VCS platform, language stack, existing CI config presence |
| `domain_context` | `object` | No | Domain classification from `prompt-normalizer` — used for domain-specific pipeline steps |
| `dry_run` | `boolean` | No | If true, return generated content without writing files (default: false) |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["deployment_strategy", "architecture", "repository_metadata"],
  "properties": {
    "deployment_strategy": {
      "type": "object",
      "description": "Output from deployment-strategy (SKL-007)",
      "required": ["environments", "promotion_rules", "deployment_plan"],
      "properties": {
        "environments":      { "type": "array" },
        "promotion_rules":   { "type": "array" },
        "rollback_criteria": { "type": "object" },
        "feature_flags":     { "type": "object" },
        "deployment_plan":   { "type": "object" }
      }
    },
    "architecture": {
      "type": "object",
      "required": ["modules", "technical_decisions"],
      "properties": {
        "modules":              { "type": "array" },
        "integration_points":   { "type": "array" },
        "technical_decisions":  { "type": "array" }
      }
    },
    "repository_metadata": {
      "type": "object",
      "required": ["platform"],
      "properties": {
        "platform": {
          "type": "string",
          "enum": ["github", "gitlab", "bitbucket", "azure_devops"]
        },
        "language_stack": {
          "type": "array",
          "items": { "type": "string" },
          "description": "Primary languages/runtimes (e.g. ['typescript', 'node', 'postgresql'])"
        },
        "existing_ci_config": {
          "type": "boolean",
          "description": "True if a CI config already exists — generates merge-safe additions only"
        },
        "container_registry": {
          "type": "string",
          "enum": ["ghcr", "docker_hub", "ecr", "gcr", "acr", "none"],
          "default": "ghcr"
        },
        "deployment_target": {
          "type": "string",
          "enum": ["kubernetes", "docker_compose", "serverless", "static_hosting", "paas", "bare_metal"],
          "default": "docker_compose"
        }
      }
    },
    "domain_context": {
      "type": "object",
      "description": "Domain classification from prompt-normalizer (SKL-040)"
    },
    "dry_run": { "type": "boolean", "default": false }
  }
}
```

---

## 4. Required Context

- `deployment_strategy` from `deployment-strategy` (SKL-007) — mandatory.
- `architecture` from `architecture-design` (SKL-002) — mandatory to select correct language-specific steps.
- `repository_metadata.platform` determines which CI format to generate.
- `domain_context.domain_primary` applies domain-specific pipeline steps:
  - `mobile` → adds App Store / Play Store distribution jobs
  - `ai_agent` → adds model evaluation + prompt regression test jobs
  - `embedded_iot` → adds OTA firmware packaging + device test jobs

---

## 5. Execution Logic

```
Step 1 — Detect language stack and runtime
  From architecture.technical_decisions, infer:
    - Primary language (TypeScript, Python, Go, Rust, Java, Swift, Kotlin, etc.)
    - Runtime/framework (Node.js, Django, FastAPI, Spring Boot, etc.)
    - Database engine (PostgreSQL, MongoDB, Redis, etc.)
    - Package manager (npm/pnpm/yarn, pip/poetry, cargo, gradle/maven, etc.)
  Output: detected_stack { language, runtime, db_engine, pkg_manager, test_runner }

Step 2 — Select CI platform template
  github      → .github/workflows/ (YAML, GitHub Actions syntax)
  gitlab      → .gitlab-ci.yml (YAML, GitLab CI syntax)
  bitbucket   → bitbucket-pipelines.yml
  azure_devops → azure-pipelines.yml
  Output: ci_platform, ci_template_format

Step 3 — Build CI pipeline stages
  Standard stages (all platforms):
    install:  dependency installation using detected pkg_manager
    lint:     linter step for detected language (ESLint, Ruff, Clippy, Checkstyle, etc.)
    test:     unit + integration test run using detected test_runner
    build:    compile / bundle step for detected language
    docker:   multi-stage Docker image build + push to container_registry
    deploy:   deployment job per environment (dev, staging, production)
              promotion rules from deployment_strategy.promotion_rules applied as conditions
    notify:   Slack/email notification on failure (webhook placeholder)

  Domain-specific additional stages:
    mobile (ios):    xcode-build job, TestFlight upload step
    mobile (android): gradle-build job, Play Store upload step
    ai_agent:       model-eval job (runs prompt regression suite), token budget check
    embedded_iot:   firmware-build job, OTA package job, device-flash test step

  Output: ci_stages (ordered array of stage definitions)

Step 4 — Generate CI YAML content
  Render ci_stages into platform-specific YAML.
  Apply:
    - Environment variable references (no hardcoded secrets — all use ${{ secrets.* }} syntax)
    - Cache step for pkg_manager dependencies
    - Artifact upload for build outputs
    - Deployment environment protection rules from deployment_strategy.environments
    - Manual approval gates for production promotion (maps from deployment_strategy.promotion_rules)
  Output: ci_yaml_content (string)

Step 5 — Generate Dockerfile
  Multi-stage build pattern:
    Stage 1 (builder): full language SDK, install deps, compile/bundle
    Stage 2 (runtime): minimal base image (distroless or alpine), copy compiled output only
  Language-specific base images:
    TypeScript/Node → node:20-alpine (builder) + node:20-alpine (runtime, non-root)
    Python          → python:3.12-slim (builder) + python:3.12-slim (runtime, non-root)
    Go              → golang:1.22-alpine (builder) + gcr.io/distroless/static (runtime)
    Java            → eclipse-temurin:21-jdk-alpine (builder) + eclipse-temurin:21-jre-alpine (runtime)
    Rust            → rust:1.77-alpine (builder) + gcr.io/distroless/static (runtime)
  Security rules:
    - Always set USER nonroot in runtime stage
    - COPY --chown=nonroot:nonroot for all files
    - No curl/wget in runtime stage
    - HEALTHCHECK instruction required
  Output: dockerfile_content (string)

Step 6 — Generate docker-compose.yml (for local development)
  Services: app + all detected db_engine services
  Environment variable placeholders from .env.example
  Health checks mirroring production Dockerfile HEALTHCHECK
  Named volumes for database persistence
  Output: docker_compose_content (string)

Step 7 — Generate .env.example
  Collect all environment variables referenced in:
    - Generated CI YAML (secrets references)
    - Generated Dockerfile (ENV instructions)
    - Architecture integration_points (API keys, connection strings)
  Format: KEY=description_of_value (no actual secrets)
  Group by: APP_*, DB_*, REDIS_*, CLOUD_*, CI_*
  Output: env_example_content (string)

Step 8 — Generate Kubernetes manifests (if deployment_target == "kubernetes")
  deployment.yaml:
    - replicas from deployment_strategy.deployment_plan
    - resource limits / requests (CPU + memory estimates from architecture.modules)
    - liveness + readiness probes matching Dockerfile HEALTHCHECK
    - envFrom: configmap + secretRef pattern (no inline secrets)
  service.yaml:
    - ClusterIP for internal services
    - LoadBalancer for public-facing services (from integration_points)
  Output: k8s_manifests (array of { filename, content })

Step 9 — Assemble artifacts
  Collect all generated files:
    { path: ".github/workflows/ci.yml", content: ci_yaml_content }
    { path: "Dockerfile", content: dockerfile_content }
    { path: "docker-compose.yml", content: docker_compose_content }
    { path: ".env.example", content: env_example_content }
    + k8s_manifests if applicable
  Validate: no file contains hardcoded secrets (scan for AWS_ACCESS_KEY pattern, etc.)
  Output: artifacts (array)

Step 10 — Return output
  If dry_run: return artifacts with content but no file writes
  Emit metrics and feedback
  Output: complete structured response
```

---

## 6. Outputs

| Field | Type | Description |
|-------|------|-------------|
| `artifacts` | `array[object]` | Generated files: `{ path, content, file_type, overwrite_safe }` |
| `detected_stack` | `object` | Inferred language, runtime, package manager, test runner |
| `ci_platform` | `string` | CI platform used (`github`, `gitlab`, etc.) |
| `validation_result` | `object` | Secret scan result: `{ passed, found_secrets: [] }` |
| `dry_run_only` | `boolean` | Whether files were written or only returned |
| `metrics` | `object` | tokens_in, tokens_out, duration_ms, items_produced, version |
| `feedback` | `array[object]` | Feedback to deployment-strategy or architecture-design |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["artifacts", "detected_stack", "ci_platform", "validation_result",
               "dry_run_only", "metrics", "feedback"],
  "properties": {
    "artifacts": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["path", "content", "file_type", "overwrite_safe"],
        "properties": {
          "path":          { "type": "string", "description": "Relative path from repo root" },
          "content":       { "type": "string", "description": "Full file content as string" },
          "file_type":     { "type": "string", "enum": ["yaml","dockerfile","env","json","hcl","toml"] },
          "overwrite_safe":{ "type": "boolean", "description": "False if file already exists and diff is required" }
        }
      }
    },
    "detected_stack": {
      "type": "object",
      "properties": {
        "language":    { "type": "string" },
        "runtime":     { "type": "string" },
        "db_engine":   { "type": ["string","null"] },
        "pkg_manager": { "type": "string" },
        "test_runner": { "type": "string" }
      },
      "required": ["language", "runtime", "pkg_manager", "test_runner"]
    },
    "ci_platform":      { "type": "string", "enum": ["github","gitlab","bitbucket","azure_devops"] },
    "validation_result":{
      "type": "object",
      "required": ["passed", "found_secrets"],
      "properties": {
        "passed":        { "type": "boolean" },
        "found_secrets": { "type": "array", "items": { "type": "string" } }
      }
    },
    "dry_run_only": { "type": "boolean" },
    "metrics":  { "$ref": "#/$defs/metrics" },
    "feedback": { "type": "array", "items": { "$ref": "#/$defs/feedback_entry" } }
  },
  "$defs": {
    "metrics": {
      "type": "object",
      "required": ["tokens_in","tokens_out","duration_ms","items_produced","version"],
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
      "required": ["type","from_skill","reason"],
      "properties": {
        "type":         { "type": "string", "enum": ["backpropagate","info","warning"] },
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

## 7. Rules & Constraints

- Generated files MUST NOT contain hardcoded secrets, tokens, or passwords. All sensitive values use platform-secret references (`${{ secrets.MY_KEY }}`, `$CI_SECRET`, etc.).
- Dockerfile MUST use multi-stage build — single-stage builds are not accepted.
- Runtime stage MUST set a non-root `USER`.
- All deployment jobs MUST reference the `promotion_rules` from `deployment_strategy` — no self-invented promotion logic.
- Maximum artifacts per invocation: 20 files. For larger IaC suites, split into batches.
- When `existing_ci_config: true`, generated jobs are additive only — no existing job definitions are overwritten.
- Production deployment jobs MUST have a `manual` trigger (no auto-deploy to production).
- `dry_run: true` NEVER writes files — returns content only for review.

---

## 8. Security Considerations

- Secret scan (Step 9) is mandatory — any artifact containing a pattern matching `[A-Z0-9]{20,}` adjacent to secret-indicating keywords is flagged and `validation_result.passed: false`.
- If secret scan fails, emit `feedback` backpropagate to `deployment-strategy` and return artifacts with `validation_result.passed: false` — do NOT write files.
- Container images MUST reference specific digest pinned versions in production pipelines (not `:latest`).
- `.env.example` must contain only placeholder values — never real secrets from `architecture.technical_decisions`.
- Do NOT include any cloud provider credentials in Kubernetes manifests — use `secretRef` patterns only.

---

## 9. Token Optimization

- Load only `deployment_strategy.promotion_rules`, `deployment_strategy.environments`, and `architecture.modules` into generation context — skip full narrative fields.
- CI YAML templates are pre-structured; only variable interpolation is LLM-generated.
- Language-specific Dockerfile templates are templated — only port numbers, health check paths, and entrypoint commands are inferred from architecture.
- Kubernetes manifest resource limits use pre-defined tier defaults (small/medium/large) — no LLM estimation.

---

## 10. Quality Checklist

- [ ] All secrets use platform-specific reference syntax (no hardcoded values)
- [ ] Dockerfile has multi-stage build with non-root runtime user
- [ ] Dockerfile includes HEALTHCHECK instruction
- [ ] CI pipeline has manual gate on production deploy job
- [ ] .env.example has only placeholder values, all grouped by prefix
- [ ] docker-compose.yml has health checks and named volumes
- [ ] Kubernetes manifests (if generated) use secretRef pattern — no inline secrets
- [ ] `validation_result.passed` is true before any file write
- [ ] Domain-specific jobs added when `domain_context` specifies mobile/ai_agent/embedded_iot
- [ ] All artifacts have correct `overwrite_safe` flag set
- [ ] Output is valid JSON

---

## 11. Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| `deployment_strategy` missing or malformed | Return error with `feedback` backpropagate to deployment-strategy; no artifacts generated |
| Language stack cannot be inferred from architecture | Default to generic Dockerfile (alpine base); emit warning in feedback |
| Secret pattern detected in generated artifact | Set `validation_result.passed: false`; do NOT write files; backpropagate to deployment-strategy |
| `existing_ci_config: true` but conflict detected | Set `overwrite_safe: false` on conflicting artifact; emit HITL gate for human merge decision |
| Unknown `deployment_target` | Generate docker-compose.yml only; emit warning that Kubernetes/PaaS manifests were skipped |
| > 20 artifacts required | Generate core files (CI YAML, Dockerfile, .env.example); emit info that additional manifests need a second invocation |

---

## 12. Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Behavior |
|------|---------|---------|----------|
| Review generated CI pipeline | Always — first run | 3600s | Present artifacts summary to user before write; confirm output paths |
| Existing config conflict | `overwrite_safe: false` on any artifact | 3600s | User must approve overwrite or select merge strategy |
| Secret scan failure | `validation_result.passed: false` | 3600s | User must confirm no secrets before re-run; pipeline halts |

---

## 13. Skill Composition

`ci-pipeline-generator` runs as the first step of `phase-9a-ci-scaffold`, after `deployment-strategy` and after all guard gates have passed:

```yaml
name: phase-9a-ci-scaffold
composes:
  - skill: ci-pipeline-generator
    version: "^1.0.0"
    input_map:
      deployment_strategy:  "deployment_strategy_output"
      architecture:         "architecture_output"
      repository_metadata:  "session_context.repository_metadata"
      domain_context:       "domain_context"
      dry_run:              false
    output_map:
      artifacts:         "ci_artifacts"
      validation_result: "ci_validation"
      detected_stack:    "detected_stack"
```

### Feedback Routes

| Target Skill | Condition | Description |
|---|---|---|
| `deployment-strategy` | `validation_result.passed: false` | Re-run deployment strategy when secret references cannot be resolved from the strategy |
| `architecture-design` | Language stack cannot be inferred | Re-run architecture when technology decisions are too vague for pipeline generation |

### Changelog

| Version | Date | Change |
|---------|------|--------|
| 1.0.0 | 2026-06-18 | Initial release — generates GitHub Actions / GitLab CI YAML, Dockerfile, docker-compose.yml, .env.example, and optional Kubernetes manifests from deployment-strategy output |

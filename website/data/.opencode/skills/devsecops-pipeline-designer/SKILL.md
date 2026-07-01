---
name: devsecops-pipeline-designer
version: 1.0.0
domain: security
description: >
  Use when designing and integrating security controls into CI/CD pipelines (shift-left security).
  Triggers on: "DevSecOps pipeline", "SAST integration", "shift-left security", "pipeline security
  gates", "SBOM generation", "SLSA compliance", "container scanning CI", "SCA in pipeline".
  Do NOT use when only reviewing application code security without CI/CD integration — use
  security-review instead.
author: system
---

## Purpose

The devsecops-pipeline-designer skill systematically embeds security controls into CI/CD pipelines following the shift-left security principle. Rather than treating security as a post-deployment gate, this skill produces executable, ready-to-paste pipeline stage definitions that integrate scanning at every code transition point — from first commit through build, test, and promotion. It selects, configures, and tunes the optimal security toolchain for each supported CI platform (GitHub Actions, GitLab CI, Jenkins, Azure DevOps, CircleCI) and any combination of application technology stacks.

The skill covers the full spectrum of automated DevSecOps controls: Static Application Security Testing (SAST) via SonarQube (`sonar-scanner` with `sonar.qualitygate.wait=true`), Semgrep (`semgrep --config=p/owasp-top-ten,p/security-audit`), CodeQL (`codeql database analyze --suite security-extended`), and Bandit (`bandit -r . -f json -ll`); Dynamic Application Security Testing (DAST) via OWASP ZAP (`zap-baseline.py`, `zap-full-scan.py`) and Burp Suite Enterprise API; Software Composition Analysis (SCA) via Snyk (`snyk test --severity-threshold=high`), Grype (`grype dir:. --fail-on high`), Trivy (`trivy fs . --security-checks vuln`), and Dependabot; container image scanning via Trivy, Clair, and Docker Scout; SBOM generation in CycloneDX JSON format using Syft (`syft image:tag -o cyclonedx-json=sbom.json`); supply-chain integrity via SLSA framework levels 1–3 with Sigstore cosign; policy-as-code enforcement via OPA bundles and Conftest Rego policies; secret scanning via Gitleaks and TruffleHog; and license compliance via FOSSA and LicenseFinder.

Outputs are production-ready YAML pipeline stages, companion tool configuration files (`.semgrep.yml`, `sonar-project.properties`, `trivy.yaml`, `policy/*.rego`), and a gate policy matrix defining which severity levels block promotion versus produce audit-only warnings. This skill is the connective tissue between security-review findings and ci-pipeline-generator execution — it transforms security requirements into machine-executable enforcement points.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `ci_platform` | `string` | Yes | Target CI/CD platform: `github_actions`, `gitlab_ci`, `jenkins`, `azure_devops`, `circleci` |
| `tech_stack` | `array[string]` | Yes | Languages/frameworks (e.g., `["python", "docker", "nodejs", "terraform"]`) |
| `security_gates` | `array[string]` | No | Gate types: `sast`, `dast`, `sca`, `container`, `secrets`, `sbom`, `license`. Default: all |
| `slsa_level` | `integer` | No | Target SLSA supply-chain compliance level: `1`, `2`, or `3`. Default: `1` |
| `block_on_severity` | `string` | No | Minimum severity to fail pipeline: `critical`, `high`, `medium`. Default: `high` |
| `context` | `object` | No | `{ repo_url, deployment_environment, compliance_frameworks[] }` |

**Input Schema:**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["ci_platform", "tech_stack"],
  "properties": {
    "ci_platform": {
      "type": "string",
      "enum": ["github_actions", "gitlab_ci", "jenkins", "azure_devops", "circleci"]
    },
    "tech_stack": {
      "type": "array",
      "items": { "type": "string" },
      "minItems": 1
    },
    "security_gates": {
      "type": "array",
      "items": {
        "type": "string",
        "enum": ["sast", "dast", "sca", "container", "secrets", "sbom", "license"]
      },
      "default": ["sast", "dast", "sca", "container", "secrets", "sbom", "license"]
    },
    "slsa_level": {
      "type": "integer",
      "enum": [1, 2, 3],
      "default": 1
    },
    "block_on_severity": {
      "type": "string",
      "enum": ["critical", "high", "medium"],
      "default": "high"
    },
    "context": {
      "type": "object",
      "properties": {
        "repo_url": { "type": "string" },
        "deployment_environment": { "type": "string" },
        "compliance_frameworks": {
          "type": "array",
          "items": { "type": "string", "enum": ["pci_dss", "hipaa", "soc2", "iso27001", "nist_csf"] }
        }
      }
    }
  }
}
```

## Required Context

- `ci_platform` and `tech_stack` are mandatory — the skill cannot produce pipeline stages without the target platform and language list.
- Container scanning (`container` gate) requires Docker/OCI image builds to exist in the pipeline; if absent, the stage is skipped with a warning.
- DAST (`dast` gate) requires a deployed test environment URL; generated stages use `$TARGET_URL` env-var placeholder if unavailable.
- SLSA level 3 assumes hermetic build support (Bazel, Nix, or equivalent build isolation) — generated config includes a compliance gap notice if evidence is missing.
- License compliance stages require a policy decisions file (`.licensefinderrc`, `doc/dependency_decisions.yml`) or FOSSA project key env reference.

## Execution Logic

```
Step 1 — Validate and normalize inputs
  Normalize tech_stack entries to lowercase. Map each entry to primary/secondary SAST tools:
    python     → bandit + semgrep (p/python)
    java       → sonarqube + codeql (java)
    nodejs/js  → semgrep (p/nodejs) + nodejsscan
    go         → gosec + semgrep (p/golang)
    terraform  → checkov + tfsec
    ruby       → brakeman + semgrep
    php        → phpstan-security + semgrep
    <unknown>  → semgrep (p/security-audit) as universal fallback
  Resolve effective security_gates (default all if not specified).
  Output: normalized_inputs, tool_selection_map

Step 2 — Generate secret scanning stage (MUST be first)
  Gitleaks: gitleaks detect --source . --report-format json --report-path gitleaks-report.json --exit-code 1
  TruffleHog: trufflehog git file://. --json --fail
  Emit pre-commit hook stub (.pre-commit-config.yaml with gitleaks + trufflehog hooks).
  gate_policy: block on any finding (secrets have zero-tolerance policy).
  Output: secret_scanning_config { tool_configs[], pipeline_stage_yaml, pre_commit_yaml }

Step 3 — Generate SAST configuration
  SonarQube: sonar-project.properties with sonar.projectKey, sonar.sources, sonar.qualitygate.wait=true,
             sonar.coverage.exclusions=**/tests/**. Pipeline step uses sonarsource/sonarqube-scan-action@v3.
  Semgrep: .semgrep.yml with rules: [{id: owasp-top-ten}, {id: security-audit}, {id: supply-chain}].
           Pipeline step uses returntocorp/semgrep-action@v1.
  CodeQL: .github/codeql/codeql-config.yml with queries: [security-extended, security-and-quality].
          Matrix strategy covers all identified languages.
  Bandit: .bandit config with skips=[], confidence=HIGH, level=HIGH.
  gate_policy: block on severity >= block_on_severity.
  Output: sast_config { tool_configs[], pipeline_stage_yaml }

Step 4 — Generate SCA / dependency scanning configuration
  Snyk: snyk test --severity-threshold=<block_on_severity> --json > snyk-report.json --all-projects
        snyk monitor for continuous tracking.
  Grype: grype dir:. -o json --fail-on <block_on_severity> > grype-report.json
  Trivy: trivy fs . --security-checks vuln --exit-code 1 --severity HIGH,CRITICAL --format sarif
  Dependabot: .github/dependabot.yml with schedule.interval=daily, grouped updates by ecosystem.
  Output: sca_config { tool_configs[], dependabot_yaml, pipeline_stage_yaml }

Step 5 — Generate container image scanning (if container in gates and docker in tech_stack)
  Trivy: trivy image --exit-code 1 --severity HIGH,CRITICAL --ignore-unfixed $IMAGE_TAG
  Clair: clairctl analyze --format json $IMAGE_TAG
  Docker Scout: docker scout cves $IMAGE_TAG --format sarif --output scout-report.sarif
  Stage placement: after docker build, before registry push (depends: [build]).
  Output: container_config { tool_configs[], pipeline_stage_yaml }

Step 6 — Generate DAST configuration (if dast in gates)
  OWASP ZAP baseline: zap-baseline.py -t $TARGET_URL -r zap-report.html -x zap-report.xml -I
  OWASP ZAP full scan: zap-full-scan.py -t $TARGET_URL -r zap-full-report.html -l WARN
  Burp Suite Enterprise: burp-rest-api scan --target=$TARGET_URL --config=burp-config.json
  Stage placement: separate job depending on successful staging deployment (needs: [deploy-staging]).
  gate_policy: block on HIGH/CRITICAL active findings; warn on informational.
  Output: dast_config { tool_configs[], pipeline_stage_yaml }

Step 7 — Generate SBOM generation + license compliance
  Syft SBOM: syft $IMAGE_TAG -o cyclonedx-json=sbom.cyclonedx.json (before push)
  Attach sbom.cyclonedx.json as signed build artifact using actions/upload-artifact@v4.
  FOSSA: fossa analyze && fossa test --exit-1-on-conflict (license compliance gate)
  LicenseFinder: license_finder action --decisions-file=doc/dependency_decisions.yml
  Output: sbom_config { syft_config, fossa_config, pipeline_stage_yaml }

Step 8 — Generate SLSA compliance configuration
  Level 1: Add provenance generation via slsa-github-generator or slsa-framework/slsa-generic-generator.
           Emit actions/attest-build-provenance@v1 step after build.
  Level 2: Isolated ephemeral build on hosted runner (github-hosted, not self-hosted).
           Sigstore cosign signing: cosign sign --key env://COSIGN_KEY $IMAGE_TAG@$DIGEST
           Cosign verify step added to deployment pre-flight.
  Level 3: Hermetic build requirement (Bazel/Nix). Two-party CODEOWNERS review enforcement.
           SLSA verification: slsa-verifier verify-image $IMAGE_TAG --source-uri $REPO
  Output: slsa_compliance { current_level, target_level, gaps[], improvements[], provenance_yaml }

Step 9 — Generate policy-as-code gates (OPA / Conftest)
  Emit policy/base.rego enforcing: no-latest-tag, non-root user, resource limits present,
  no privileged containers, approved base images only (allowlist), no host network.
  conftest test --policy policy/ --all-namespaces deployment.yaml --output tap
  OPA bundle: opa build policy/ -o bundle.tar.gz && opa sign bundle.tar.gz
  Output: policy_gates[ { policy_name, rego_content, conftest_command } ]

Step 10 — Assemble full pipeline and estimate overhead
  Compose all stage YAMLs with correct needs/depends_on ordering:
    secrets → sast → sca → [build] → container → sbom → [deploy-staging] → dast → policy
  GitHub Actions: single .github/workflows/devsecops.yml with job dependency graph.
  GitLab CI: .gitlab-ci.yml stages[] with parallel jobs per gate.
  Jenkins: Declarative Jenkinsfile with parallel stage blocks inside pipeline{}.
  Azure DevOps: azure-pipelines.yml with stages and dependsOn arrays.
  Estimate overhead: secrets=1min, sast=4-8min, sca=2-3min, container=2-4min,
                     sbom=1min, dast=10-20min, policy=1min. Sum by enabled gates.
  Output: pipeline_stages[], estimated_pipeline_overhead_minutes
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `pipeline_stages` | `array` | Stage defs: `{ stage_name, tool, config_files[], pipeline_yaml, gate_policy }` |
| `sast_config` | `object` | SonarQube/Semgrep/CodeQL/Bandit configs and pipeline YAML fragments |
| `dast_config` | `object` | ZAP/Burp scan parameters and job YAML |
| `sca_config` | `object` | Snyk/Grype/Trivy configs and Dependabot config |
| `sbom_config` | `object` | Syft + CycloneDX output config and FOSSA/LicenseFinder setup |
| `slsa_compliance` | `object` | `{ current_level, target_level, gaps[], improvements[], provenance_yaml }` |
| `secret_scanning_config` | `object` | Gitleaks + TruffleHog configs and pre-commit hooks |
| `policy_gates` | `array` | OPA/Conftest Rego policies: `{ policy_name, rego_content, conftest_command }` |
| `estimated_pipeline_overhead_minutes` | `number` | Estimated added CI execution time |
| `metrics` | `object` | Execution metrics |
| `feedback` | `array` | Backpropagation and advisory entries |

**Output Schema:**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["pipeline_stages", "sast_config", "sca_config", "slsa_compliance",
               "secret_scanning_config", "policy_gates", "estimated_pipeline_overhead_minutes",
               "metrics", "feedback"],
  "properties": {
    "pipeline_stages": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["stage_name", "tool", "gate_policy"],
        "properties": {
          "stage_name": { "type": "string" },
          "tool": { "type": "string" },
          "config_files": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "path": { "type": "string" },
                "content": { "type": "string" }
              },
              "required": ["path", "content"]
            }
          },
          "pipeline_yaml": { "type": "string" },
          "gate_policy": { "type": "string", "enum": ["block", "warn", "audit"] }
        }
      }
    },
    "sast_config": { "type": "object" },
    "dast_config": { "type": "object" },
    "sca_config": { "type": "object" },
    "sbom_config": { "type": "object" },
    "slsa_compliance": {
      "type": "object",
      "properties": {
        "current_level": { "type": "integer" },
        "target_level": { "type": "integer" },
        "gaps": { "type": "array", "items": { "type": "string" } },
        "improvements": { "type": "array", "items": { "type": "string" } },
        "provenance_yaml": { "type": "string" }
      },
      "required": ["current_level", "target_level", "gaps"]
    },
    "secret_scanning_config": { "type": "object" },
    "policy_gates": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "policy_name": { "type": "string" },
          "rego_content": { "type": "string" },
          "conftest_command": { "type": "string" }
        },
        "required": ["policy_name", "conftest_command"]
      }
    },
    "estimated_pipeline_overhead_minutes": { "type": "number" },
    "metrics": {
      "type": "object",
      "properties": {
        "tokens_in": { "type": "integer" },
        "tokens_out": { "type": "integer" },
        "duration_ms": { "type": "integer" },
        "stages_generated": { "type": "integer" },
        "tools_configured": { "type": "integer" },
        "version": { "type": "string" }
      },
      "required": ["tokens_in", "tokens_out", "duration_ms", "stages_generated", "version"]
    },
    "feedback": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "type": { "type": "string", "enum": ["backpropagate", "info", "warning"] },
          "from_skill": { "type": "string" },
          "target_skill": { "type": "string" },
          "reason": { "type": "string" }
        },
        "required": ["type", "from_skill", "reason"]
      }
    }
  }
}
```

## Rules & Constraints

- Secret scanning MUST be the first stage in the dependency chain — a leaked secret in code invalidates all downstream security scan results.
- DAST stages MUST never target production — they require a dedicated staging/test environment URL.
- SBOM generation MUST run before container push so every published image has a traceable bill of materials.
- When `block_on_severity=critical`, all non-critical findings are `audit` policy (logged but non-blocking).
- SLSA level 3 configurations emit a compliance-gap warning when hermetic build evidence is absent; they do not silently downgrade.
- All commercial tool API keys (Snyk, FOSSA, Burp Suite) MUST reference environment variable secrets — never inline values.
- All tool version pins in pipeline YAML MUST use immutable SHA digest references (e.g., `aquasecurity/trivy-action@sha256:...`) for supply-chain integrity.
- License compliance gates MUST load policy from a committed decisions file, not implicit tool defaults.

## Security Considerations

- Never emit API keys, tokens, or credentials inline in pipeline YAML — always use `${{ secrets.TOOL_API_KEY }}`, `${TOOL_API_KEY}`, or platform-equivalent secret injection.
- SLSA level 2+ requires ephemeral, hosted build environments — self-hosted runner configurations are flagged as SLSA compliance gaps.
- The OPA/Conftest policy bundle MUST be signed with `opa sign` and verified at evaluation time to prevent policy tampering.
- Gitleaks and TruffleHog configurations MUST specify `--exclude-path=tests/fixtures/**` to reduce false positives while preserving real-finding detection.
- DAST and ZAP scan reports contain live application response data — restrict artifact access permissions in CI artifact storage.

## Token Optimization

- Pass `tech_stack` as a flat string array — exclude framework versions; tool selection operates at language level only.
- Request specific `security_gates` rather than the full default set when pipeline overhead is a constraint.
- Return `pipeline_yaml` as compact single-line YAML strings; prettified full file content is written to state, not returned inline.
- For large OPA policy bundles, return `policy_name` and `conftest_command` inline; write full `rego_content` to state as separate `.rego` files.

## Quality Checklist

- [ ] All `ci_platform` pipeline YAML is syntactically valid for the target platform schema
- [ ] Secret scanning stage is the first job in the pipeline dependency graph
- [ ] All tool version references use immutable digests or pinned semver (no `@latest` or `@master`)
- [ ] Every commercial tool configuration references environment-variable credentials only
- [ ] SBOM stage dependency places it before container push in the job graph
- [ ] SLSA provenance config matches the declared `slsa_level` target without silent downgrade
- [ ] At least one `gate_policy: block` stage is present in `pipeline_stages`
- [ ] Estimated pipeline overhead documents per-gate breakdown, not just total

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| `dast` gate enabled but no `TARGET_URL` in context | Generate DAST stage with `$TARGET_URL` placeholder; emit `warning` in feedback |
| `container` gate enabled but no Docker in tech_stack | Skip container stage; emit `info` noting the gate was skipped |
| SLSA level 3 requested without hermetic build evidence | Generate level-1 config; emit `backpropagate` to deployment-strategy requesting hermetic build setup |
| Unknown language in tech_stack entry | Use Semgrep `p/security-audit` as universal fallback; emit `warning` in feedback |
| License compliance policy file not referenced in context | Generate FOSSA config with API key env-var placeholder; emit `warning` to add decisions file |

## 12. Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Behavior |
|------|---------|---------|----------|
| SLSA level downgrade required | Requested SLSA level cannot be met with current infrastructure | 3600s | Pause; present gaps list; human decides whether to proceed at lower level or fix infrastructure |
| block_on_severity=medium selected | `block_on_severity` is set to `medium` | 1800s | Warn that medium-severity blocking typically causes high false-positive friction; require human confirmation before emitting config |

## 13. Skill Composition

```yaml
composes_with:
  - skill: security-review
    role: upstream
    note: "security-review findings inform which gate types to prioritize and what severities to block on"
  - skill: ci-pipeline-generator
    role: downstream
    note: "ci-pipeline-generator consumes pipeline_stages[] to produce the final pipeline file"
  - skill: deployment-strategy
    role: upstream
    note: "deployment-strategy provides environment topology needed for DAST TARGET_URL resolution"

consumed_by:
  - orchestrator
  - ci-pipeline-generator

input_from_state:
  - scope: deployment_strategy
    field: environments[*].url
    maps_to: context.deployment_environment
  - scope: security_review
    field: findings[*].severity
    maps_to: block_on_severity (inferred from highest finding severity)

emits_events:
  - devsecops.pipeline.designed
  - devsecops.slsa.gap.detected
```

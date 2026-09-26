# ─────────────────────────────────────────────────────────────────────────────
# AI Workflow — Makefile
# Primary developer CLI. Run `make help` or `aiw help` to see all commands.
#
# Usage:
#   make setup      ← start here on a fresh clone (also installs `aiw` CLI)
#   aiw health      ← verify environment after editing .env
#   aiw validate    ← run the full skill and execution-contract validation suites
#   aiw start       ← launch the AI workflow
# ─────────────────────────────────────────────────────────────────────────────

.PHONY: help setup health validate validate-contracts validate-model-requirements test-model-boundary validate-batch6 validate-batch7 validate-batch8 validate-batch9 validate-onboarding-o0 validate-onboarding-o1 validate-onboarding-o2 validate-onboarding-o3 validate-onboarding-o4 validate-onboarding-o5 validate-onboarding-o6 validate-onboarding-o7 toolchain-check validate-traceability test-context-preservation validate-evals eval-quick-review eval-quality-vector operational-evidence measure-slos evaluate-model-compatibility test-telemetry-privacy simulate-incident-containment generate-sbom scan-supply-chain check-release-compatibility skill-create skill-apply feedback-to-eval autonomy-experiments consolidation-analysis quick-review clean reset sync sync-push website sessions sessions-delete update graph install-cli backup doctor lint start status demo recover onboarding onboarding-install-plan onboarding-install-verify onboarding-install onboarding-execute-plan onboarding-artifact-hash onboarding-execute onboarding-attestation-plan onboarding-attestation-verify onboarding-verifier-plan onboarding-verifier-verify onboarding-verifier-refresh-plan onboarding-verifier-refresh

.DEFAULT_GOAL := help
WEBSITE_ROOT ?= ../ASE-OS-Website
PYTHON ?= $(if $(wildcard .venv/bin/python),.venv/bin/python,python3)

# ── Help ──────────────────────────────────────────────────────────────────────
help: ## Show this help message
	@echo ""
	@echo "  AI Workflow — Developer Commands"
	@echo "  ================================"
	@echo ""
	@echo "  Recommended: use the 'aiw' CLI directly (installed by 'make setup')."
	@echo "  Example: aiw setup, aiw health, aiw start, aiw validate"
	@echo ""
	@awk 'BEGIN {FS = ":.*##"} /^[a-zA-Z_-]+:.*##/ { printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)
	@echo ""
	@echo "  First time? Run:  make setup"
	@echo ""

# ── Setup & Core ──────────────────────────────────────────────────────────────
setup: install-cli ## Install dependencies, create .env, install 'aiw' CLI, validate environment [start here]
	@bash scripts/setup.sh

install-cli: ## Install the 'aiw' CLI to /usr/local/bin (symlink)
	@echo "→ Installing 'aiw' CLI..."
	@if [ -w /usr/local/bin ]; then \
		ln -sf "$(CURDIR)/aiw" /usr/local/bin/aiw; \
		echo "  PASS: aiw installed to /usr/local/bin/aiw"; \
	else \
		sudo ln -sf "$(CURDIR)/aiw" /usr/local/bin/aiw; \
		echo "  PASS: aiw installed to /usr/local/bin/aiw (via sudo)"; \
	fi

start: ## Launch the AI Workflow (opens opencode session)
	@./aiw start

health: ## Check tools, .env, and configuration — prints PASS/WARN/FAIL per item
	@bash scripts/health-check.sh

validate: ## Run the full skill, contract, Batch 6/7/8/9, evaluation, and operational validation suites
	@bash scripts/validate-skills.sh
	@$(MAKE) validate-contracts
	@$(MAKE) validate-model-requirements
	@$(MAKE) validate-pipeline-gates
	@$(MAKE) test-model-boundary
	@$(MAKE) test-governance-1a
	@$(MAKE) test-governance-1b
	@$(MAKE) test-governance-2
	@$(MAKE) test-governance-3
	@$(MAKE) test-governance-4
	@$(MAKE) validate-governance-flags
	@$(MAKE) validate-batch6
	@$(MAKE) validate-batch7
	@$(MAKE) validate-batch8
	@$(MAKE) validate-batch9
	@$(MAKE) validate-onboarding-o0
	@$(MAKE) validate-onboarding-o1
	@$(MAKE) validate-onboarding-o2
	@$(MAKE) validate-onboarding-o3
	@$(MAKE) validate-onboarding-o4
	@$(MAKE) validate-onboarding-o5
	@$(MAKE) validate-onboarding-o6
	@$(MAKE) validate-onboarding-o7
	@$(MAKE) validate-evals

validate-contracts: ## Validate versioned execution contracts and fixtures
	@$(PYTHON) scripts/validate-execution-contracts.py

validate-model-requirements: ## Validate single model authority, router references, and runtime boundary
	@$(PYTHON) scripts/validate-model-requirements.py

validate-pipeline-gates: ## Validate HITL gate timeout/bypass governance (fail-closed, explicit declarations)
	@$(PYTHON) scripts/validate-pipeline-gates.py

test-governance-1a: ## Run Phase 1A governance tests (timeout fail-closed, atomic approvals)
	@bash tests/test-governance-1a.sh

test-governance-1b: ## Run Phase 1B governance tests (decision registry, identity, chain)
	@bash tests/test-governance-1b.sh

test-governance-2: ## Run Phase 2 governance tests (override migration, identity, flags)
	@bash tests/test-governance-2.sh

test-governance-3: ## Run Phase 3 governance tests (SHA binding, evidence, cache)
	@bash tests/test-governance-3.sh

test-governance-4: ## Run Phase 4 governance tests (change protection, separation, terminal)
	@bash tests/test-governance-4.sh

validate-governance-flags: ## Validate ci_mode skips and weakening-input policy
	@$(PYTHON) scripts/validate-governance-flags.py

test-model-boundary: ## Run model + runtime-boundary regression suite (fail_closed, no provisioning)
	@bash tests/test-model-boundary.sh

validate-batch6: ## Validate Batch 6 budget, retry, and capability-policy controls
	@$(PYTHON) scripts/validate-batch6-controls.py

validate-batch7: ## Validate Batch 7 quality, policy, traceability, and context controls
	@$(PYTHON) scripts/validate-batch7-controls.py
	@$(MAKE) validate-traceability
	@$(MAKE) test-context-preservation

validate-batch8: ## Run Batch 8 operational evidence, SLO, privacy, incident, and supply-chain controls
	@$(MAKE) operational-evidence
	@$(MAKE) generate-sbom
	@$(MAKE) scan-supply-chain
	@$(MAKE) test-telemetry-privacy
	@$(MAKE) simulate-incident-containment
	@$(MAKE) measure-slos
	@$(MAKE) evaluate-model-compatibility
	@$(PYTHON) scripts/validate-batch8-controls.py

validate-batch9: ## Run Batch 9 Skill SDK, feedback, consolidation, and autonomy controls
	@$(PYTHON) scripts/validate-batch9-controls.py

validate-onboarding-o0: ## Validate agent-neutral onboarding and runtime-adapter O0 contracts
	@$(PYTHON) scripts/validate-onboarding-o0-controls.py

validate-onboarding-o1: ## Validate deterministic core and adapter toolchain controls
	@$(PYTHON) scripts/validate-onboarding-o1-controls.py

validate-onboarding-o2: ## Validate resumable, agent-neutral onboarding controls
	@$(PYTHON) scripts/validate-onboarding-o2-controls.py

validate-onboarding-o3: ## Validate guided, agent-neutral onboarding controls
	@$(PYTHON) scripts/validate-onboarding-o3-controls.py

validate-onboarding-o4: ## Validate provenance-aware runtime installer and verification controls
	@$(PYTHON) scripts/validate-onboarding-o4-controls.py

validate-onboarding-o5: ## Validate digest-bound local artifact execution controls
	@$(PYTHON) scripts/validate-onboarding-o5-controls.py

validate-onboarding-o6: ## Validate offline publisher signature and attestation controls
	@$(PYTHON) scripts/validate-onboarding-o6-controls.py

validate-onboarding-o7: ## Validate vendor-neutral verifier adapters and refresh controls
	@$(PYTHON) scripts/validate-onboarding-o7-controls.py

onboarding: ## Run the guided O3 onboarding plan (pass ARGS="--lane native")
	@./aiw onboarding plan $(ARGS)

onboarding-install-plan: ## Show O4 installer options without writes or network (pass ARGS="--agent auto")
	@./aiw onboarding install-plan $(ARGS)

onboarding-install-verify: ## Run an O4 read-only verification probe (pass ARGS="--agent opencode")
	@./aiw onboarding install-verify $(ARGS)

onboarding-install: ## Attempt an exact O4 installer record; manual-only records fail closed
	@./aiw onboarding install $(ARGS)

onboarding-execute-plan: ## Show O5 digest-bound local execution options without writes or network
	@./aiw onboarding execute-plan $(ARGS)

onboarding-artifact-hash: ## Verify an exact O5 local artifact digest (pass ARGS="--installer <id>")
	@./aiw onboarding artifact-hash $(ARGS)

onboarding-execute: ## Execute one approved O5 local artifact with evidence (pass ARGS="--installer <id> --yes")
	@./aiw onboarding execute $(ARGS)

onboarding-attestation-plan: ## Show O6 offline attestation verification options without network or writes
	@./aiw onboarding attestation-plan $(ARGS)

onboarding-attestation-verify: ## Verify an O6 local attestation bundle (pass ARGS="--attestation <id> --artifact <path>")
	@./aiw onboarding attestation-verify $(ARGS)

onboarding-verifier-plan: ## Show O7 vendor-neutral verifier adapters without network or writes
	@./aiw onboarding verifier-plan $(ARGS)

onboarding-verifier-verify: ## Verify with one O7 adapter (pass ARGS="--adapter <id> --artifact <path>")
	@./aiw onboarding verifier-verify $(ARGS)

onboarding-verifier-refresh-plan: ## Show O7 bounded evidence-refresh policy
	@./aiw onboarding verifier-refresh-plan $(ARGS)

onboarding-verifier-refresh: ## Fetch an O7 allowlisted candidate only with explicit consent
	@./aiw onboarding verifier-refresh $(ARGS)

toolchain-check: ## Run non-mutating no-network toolchain verification
	@$(PYTHON) scripts/check-toolchain.py --check-only --no-network --json-output artifacts/onboarding-o1-toolchain-evidence.json

skill-create: ## Create a draft skill scaffold without registry mutation
	@$(PYTHON) scripts/create-skill-scaffold.py $(ARGS)

skill-apply: ## Apply an explicitly approved skill scaffold with rollback safety
	@$(PYTHON) scripts/apply-skill-scaffold.py $(ARGS)

feedback-to-eval: ## Ingest sanitized feedback; active eval cases require explicit approval
	@$(PYTHON) scripts/ingest-feedback-to-eval.py $(ARGS)

autonomy-experiments: ## Run bounded zero-write autonomy experiments
	@$(PYTHON) scripts/run-autonomy-experiments.py $(ARGS)

consolidation-analysis: ## Recommend consolidation/deprecation without changing the registry
	@$(PYTHON) scripts/analyze-skill-consolidation.py $(ARGS)

operational-evidence: ## Record generalized dry-run evidence for two additional pipeline classes
	@$(PYTHON) scripts/run-operational-evidence.py --pipeline full-pipeline
	@$(PYTHON) scripts/run-operational-evidence.py --pipeline insights-adaptation-pipeline

generate-sbom: ## Generate the deterministic CycloneDX SBOM for both repositories
	@test -d "$(WEBSITE_ROOT)" || (echo "WEBSITE_ROOT=$(WEBSITE_ROOT) is required"; exit 2)
	@$(PYTHON) scripts/generate-sbom.py --website-root "$(WEBSITE_ROOT)"

scan-supply-chain: ## Check both lockfiles and immutable supply-chain workflow pins
	@test -d "$(WEBSITE_ROOT)" || (echo "WEBSITE_ROOT=$(WEBSITE_ROOT) is required"; exit 2)
	@$(PYTHON) scripts/scan-supply-chain.py --website-root "$(WEBSITE_ROOT)"
	@$(PYTHON) scripts/validate-batch8-controls.py --supply-chain-only

test-telemetry-privacy: ## Test Batch 8 opt-out, redaction, allowlist, and retention invariants
	@$(PYTHON) scripts/test-telemetry-privacy.py

simulate-incident-containment: ## Run contained runaway, prompt-injection, supply-chain, and credential fixtures
	@$(PYTHON) scripts/simulate-incident-containment.py

measure-slos: ## Measure Batch 8 SLOs from local evaluation and operational evidence
	@$(PYTHON) scripts/measure-slos.py

evaluate-model-compatibility: ## Evaluate model/provider compatibility and rollback behavior
	@$(PYTHON) scripts/evaluate-model-compatibility.py

validate-traceability: ## Validate requirement-to-deployment traceability fixtures
	@$(PYTHON) scripts/validate-traceability.py

test-context-preservation: ## Run context compression/resume preservation tests
	@$(PYTHON) scripts/test-context-preservation.py

validate-evals: ## Validate Batch 5/6 evaluation definitions, fixtures, and replay traces
	@$(PYTHON) scripts/validate-quick-review-evals.py

eval-quick-review: ## Run the Batch 5/6 golden, adversarial, budget, and policy evaluation suite
	@$(PYTHON) scripts/evaluate-quick-review.py $(if $(OUTPUT_ROOT),--output-root $(OUTPUT_ROOT),)

eval-quality-vector: ## Aggregate evaluation evidence into the Batch 7 quality vector
	@$(PYTHON) scripts/evaluate-quality-vector.py $(if $(MANIFEST),--manifest $(MANIFEST),)

check-release-compatibility: ## Compare source Dev with a generated website ReleaseManifest
	@test -n "$(MANIFEST)" || (echo "MANIFEST is required"; exit 2)
	@$(PYTHON) scripts/check-release-compatibility.py --manifest "$(MANIFEST)"

quick-review: ## Run bounded quick-review with local execution evidence
	@$(PYTHON) scripts/run-quick-review.py $(ARGS)

lint: ## Quick YAML + schema syntax check (checks 0-1 only)
	@./aiw lint

doctor: ## Comprehensive environment + validation + git diagnostic
	@./aiw doctor

# ── Maintenance ───────────────────────────────────────────────────────────────
clean: ## Remove build artifacts and generated cache files (safe, reversible)
	@bash scripts/clean.sh

reset: ## Reset sessions, cache, and artifacts — preserves .env and tokens [destructive]
	@bash scripts/reset.sh

update: ## Update opencode plugin dependencies in .opencode/
	@./aiw update

backup: ## Backup .opencode/state/ to backups/ directory
	@./aiw backup

# ── Data & Knowledge ─────────────────────────────────────────────────────────
sync: ## Sync website/data/ from source files (skills/, docs/, .opencode/skills/) — CI does this automatically on push
	@bash scripts/sync-website-data.sh

sync-push: ## Sync website/data/ AND push the result to ASE-OS-Website repo
	@bash scripts/sync-website-data.sh --website

graph: ## Rebuild the knowledge graph after code changes (requires graphify — optional)
	@./aiw graph

# ── Website ───────────────────────────────────────────────────────────────────
website: ## Build and start the website at localhost (reads WEBSITE_PORT from .env)
	@bash rebuild.sh

# ── Session Management ────────────────────────────────────────────────────────
sessions: ## Show expired session files (dry-run — no files deleted)
	@bash scripts/cleanup-sessions.sh

sessions-delete: ## Delete expired session files (reads SESSION_RETENTION_DAYS from .env)
	@bash scripts/cleanup-sessions.sh --delete

# ── Info ──────────────────────────────────────────────────────────────────────
status: ## Show project status (git, sessions, skills, environment)
	@./aiw status

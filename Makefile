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

.PHONY: help setup health validate validate-contracts validate-batch6 validate-batch7 validate-batch8 validate-batch9 validate-traceability test-context-preservation validate-evals eval-quick-review eval-quality-vector operational-evidence measure-slos evaluate-model-compatibility test-telemetry-privacy simulate-incident-containment generate-sbom scan-supply-chain check-release-compatibility skill-create skill-apply feedback-to-eval autonomy-experiments consolidation-analysis quick-review clean reset sync sync-push website sessions sessions-delete update graph install-cli backup doctor lint start status

.DEFAULT_GOAL := help
WEBSITE_ROOT ?= ../ASE-OS-Website

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
	@$(MAKE) validate-batch6
	@$(MAKE) validate-batch7
	@$(MAKE) validate-batch8
	@$(MAKE) validate-batch9
	@$(MAKE) validate-evals

validate-contracts: ## Validate versioned execution contracts and fixtures
	@python3 scripts/validate-execution-contracts.py

validate-batch6: ## Validate Batch 6 budget, retry, and capability-policy controls
	@python3 scripts/validate-batch6-controls.py

validate-batch7: ## Validate Batch 7 quality, policy, traceability, and context controls
	@python3 scripts/validate-batch7-controls.py
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
	@python3 scripts/validate-batch8-controls.py

validate-batch9: ## Run Batch 9 Skill SDK, feedback, consolidation, and autonomy controls
	@python3 scripts/validate-batch9-controls.py

skill-create: ## Create a draft skill scaffold without registry mutation
	@python3 scripts/create-skill-scaffold.py $(ARGS)

skill-apply: ## Apply an explicitly approved skill scaffold with rollback safety
	@python3 scripts/apply-skill-scaffold.py $(ARGS)

feedback-to-eval: ## Ingest sanitized feedback; active eval cases require explicit approval
	@python3 scripts/ingest-feedback-to-eval.py $(ARGS)

autonomy-experiments: ## Run bounded zero-write autonomy experiments
	@python3 scripts/run-autonomy-experiments.py $(ARGS)

consolidation-analysis: ## Recommend consolidation/deprecation without changing the registry
	@python3 scripts/analyze-skill-consolidation.py $(ARGS)

operational-evidence: ## Record generalized dry-run evidence for two additional pipeline classes
	@python3 scripts/run-operational-evidence.py --pipeline full-pipeline
	@python3 scripts/run-operational-evidence.py --pipeline insights-adaptation-pipeline

generate-sbom: ## Generate the deterministic CycloneDX SBOM for both repositories
	@test -d "$(WEBSITE_ROOT)" || (echo "WEBSITE_ROOT=$(WEBSITE_ROOT) is required"; exit 2)
	@python3 scripts/generate-sbom.py --website-root "$(WEBSITE_ROOT)"

scan-supply-chain: ## Check both lockfiles and immutable supply-chain workflow pins
	@test -d "$(WEBSITE_ROOT)" || (echo "WEBSITE_ROOT=$(WEBSITE_ROOT) is required"; exit 2)
	@python3 scripts/scan-supply-chain.py --website-root "$(WEBSITE_ROOT)"
	@python3 scripts/validate-batch8-controls.py --supply-chain-only

test-telemetry-privacy: ## Test Batch 8 opt-out, redaction, allowlist, and retention invariants
	@python3 scripts/test-telemetry-privacy.py

simulate-incident-containment: ## Run contained runaway, prompt-injection, supply-chain, and credential fixtures
	@python3 scripts/simulate-incident-containment.py

measure-slos: ## Measure Batch 8 SLOs from local evaluation and operational evidence
	@python3 scripts/measure-slos.py

evaluate-model-compatibility: ## Evaluate model/provider compatibility and rollback behavior
	@python3 scripts/evaluate-model-compatibility.py

validate-traceability: ## Validate requirement-to-deployment traceability fixtures
	@python3 scripts/validate-traceability.py

test-context-preservation: ## Run context compression/resume preservation tests
	@python3 scripts/test-context-preservation.py

validate-evals: ## Validate Batch 5/6 evaluation definitions, fixtures, and replay traces
	@python3 scripts/validate-quick-review-evals.py

eval-quick-review: ## Run the Batch 5/6 golden, adversarial, budget, and policy evaluation suite
	@python3 scripts/evaluate-quick-review.py $(if $(OUTPUT_ROOT),--output-root $(OUTPUT_ROOT),)

eval-quality-vector: ## Aggregate evaluation evidence into the Batch 7 quality vector
	@python3 scripts/evaluate-quality-vector.py $(if $(MANIFEST),--manifest $(MANIFEST),)

check-release-compatibility: ## Compare source Dev with a generated website ReleaseManifest
	@test -n "$(MANIFEST)" || (echo "MANIFEST is required"; exit 2)
	@python3 scripts/check-release-compatibility.py --manifest "$(MANIFEST)"

quick-review: ## Run bounded quick-review with local execution evidence
	@python3 scripts/run-quick-review.py $(ARGS)

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

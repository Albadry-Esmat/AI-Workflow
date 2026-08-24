# ─────────────────────────────────────────────────────────────────────────────
# AI Workflow — Makefile
# Primary developer CLI. Run `make help` or `aiw help` to see all commands.
#
# Usage:
#   make setup      ← start here on a fresh clone (also installs `aiw` CLI)
#   aiw health      ← verify environment after editing .env
#   aiw validate    ← run the full skill validation suite
#   aiw start       ← launch the AI workflow
# ─────────────────────────────────────────────────────────────────────────────

.PHONY: help setup health validate validate-semantic validate-mcp validate-budget validate-golden validate-events validate-pilot-evidence write-plan score-artifact validate-adapters certify-opencode certify-adapters generate-projections install-projections website-check docs-check self-test preflight pilot-preflight rollback-rehearsal support-bundle security-history events clean reset sync sync-push website sessions sessions-delete update graph install-cli backup restore doctor lint start status

.DEFAULT_GOAL := help

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

validate: ## Run structural and semantic skill/pipeline validation
	@./aiw validate

validate-semantic: ## Run semantic pipeline validation
	@node scripts/validate-pipelines.js

validate-mcp: ## Validate the approved MCP permission profile
	@node scripts/validate-mcp-policy.js

validate-budget: ## Validate pilot execution capacity and cost limits
	@node scripts/validate-execution-budget.js

validate-golden: ## Validate golden artifact compatibility contracts
	@node scripts/validate-golden-artifacts.js

validate-events: ## Validate sanitized execution event records
	@node scripts/validate-events.js

validate-pilot-evidence: ## Validate a sanitized pilot evidence record
	@node scripts/validate-pilot-evidence.js

write-plan: ## Create a canary-only dry-run plan for a write-capable operation
	@node scripts/write-plan.js

score-artifact: ## Score a structured artifact and route low-quality output to human review
	@node scripts/score-artifact.js --type requirements --input tests/fixtures/requirements-artifact.json

validate-adapters: ## Validate the canonical adapter registry and capability matrix
	@node scripts/validate-adapter-config.js

certify-opencode: ## Run credential-free OpenCode reference-adapter certification
	@node scripts/adapter-certification.js opencode

certify-adapters: ## Run fixture-only certification across every registered adapter
	@node scripts/certify-adapters.js

generate-projections: ## Generate deterministic runtime-specific configuration projections
	@node scripts/generate-projections.js --output /tmp/aiw-projections --profile pilot-read-only

install-projections: ## Install reviewed projections only with explicit --confirm --overwrite
	@node scripts/install-projections.js --source /tmp/aiw-projections --target . --confirm --overwrite

website-check: ## Fail when authoritative sources and website/data are out of sync
	@node scripts/verify-website-sync.js

docs-check: ## Require changelog and affected documentation for every change
	@node scripts/verify-documentation-policy.js

self-test: ## Run credential-free production conformance tests
	@node scripts/self-test.js

preflight: ## Run strict release readiness checks
	@node scripts/preflight.js

pilot-preflight: ## Prepare a constrained live smoke test without executing OpenCode
	@node scripts/pilot-preflight.js

rollback-rehearsal: ## Rehearse disposable state corruption and verified restore
	@node scripts/rollback-rehearsal.js

security-history: ## Scan all reachable Git history for credential-like patterns
	@node scripts/security-check.js --history

events: ## Show recent sanitized execution events
	@node scripts/events.js

lint: ## Quick YAML + schema syntax check (checks 0-1 only)
	@./aiw lint

doctor: ## Comprehensive environment + validation + git diagnostic
	@./aiw doctor

# ── Maintenance ───────────────────────────────────────────────────────────────
clean: ## Remove build artifacts and generated cache files (safe, reversible)
	@bash scripts/clean.sh

reset: ## Reset sessions, cache, and artifacts — preserves .env and tokens [destructive]
	@bash scripts/reset.sh

update: ## Check .opencode plugin layout and show OpenCode update guidance
	@./aiw update

backup: ## Backup .opencode/state/ with checksums
	@./aiw backup

restore: ## Verify and restore a state backup: make restore BACKUP=backups/state-...
	@test -n "$(BACKUP)" || (echo "Usage: make restore BACKUP=backups/state-..."; exit 2)
	@./aiw restore "$(BACKUP)"

support-bundle: ## Create sanitized diagnostics without raw state or secrets
	@./aiw support-bundle

# ── Data & Knowledge ─────────────────────────────────────────────────────────
sync: ## Sync website/data/ from source files (skills/, docs/, .opencode/skills/) — CI does this automatically on push
	@bash scripts/sync-website-data.sh

sync-push: ## Sync website/data/ and publish after explicit confirmation
	@bash scripts/sync-website-data.sh --website --confirm-website

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

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

.PHONY: help setup health validate validate-semantic self-test preflight support-bundle security-history clean reset sync sync-push website sessions sessions-delete update graph install-cli backup restore doctor lint start status

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

validate-semantic: ## Run semantic pipeline invariant validation only
	@node scripts/validate-pipelines.js

self-test: ## Run credential-free production conformance tests
	@node scripts/self-test.js

preflight: ## Run strict release readiness checks
	@node scripts/preflight.js

security-history: ## Scan all reachable Git history for credential-like patterns
	@node scripts/security-check.js --history

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

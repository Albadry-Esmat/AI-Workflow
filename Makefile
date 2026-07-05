# ─────────────────────────────────────────────────────────────────────────────
# AI Workflow — Makefile
# Primary developer CLI. Run `make help` to see all available commands.
#
# Usage:
#   make setup      ← start here on a fresh clone
#   make health     ← verify environment after editing .env
#   make validate   ← run the full skill validation suite
# ─────────────────────────────────────────────────────────────────────────────

.PHONY: help setup health validate clean reset sync website sessions sessions-delete update graph

.DEFAULT_GOAL := help

# ── Help ──────────────────────────────────────────────────────────────────────
help: ## Show this help message
	@echo ""
	@echo "  AI Workflow — Developer Commands"
	@echo "  ================================"
	@echo ""
	@awk 'BEGIN {FS = ":.*##"} /^[a-zA-Z_-]+:.*##/ { printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)
	@echo ""
	@echo "  First time? Run:  make setup"
	@echo ""

# ── Setup & Validation ────────────────────────────────────────────────────────
setup: ## Install dependencies, create .env, validate environment [start here]
	@bash scripts/setup.sh

health: ## Check tools, .env, and configuration — prints PASS/WARN/FAIL per item
	@bash scripts/health-check.sh

validate: ## Run the full 9-check skill validation suite
	@bash scripts/validate-skills.sh

# ── Maintenance ───────────────────────────────────────────────────────────────
clean: ## Remove build artifacts and generated cache files (safe, reversible)
	@bash scripts/clean.sh

reset: ## Reset to a clean state — removes .env, sessions, and artifacts [destructive]
	@bash scripts/reset.sh

update: ## Update opencode plugin dependencies in .opencode/
	@echo "→ Updating .opencode/ dependencies..."
	@npm install --prefix .opencode
	@echo ""
	@echo "  To update opencode CLI itself, run the installer again:"
	@echo "  https://opencode.ai/docs/installation"
	@echo ""
	@echo "  To update global validators:"
	@echo "  npm install -g ajv-cli ajv-formats"

# ── Data & Knowledge ─────────────────────────────────────────────────────────
sync: ## Sync website/data/ from source files (skills/, docs/, .opencode/skills/)
	@bash scripts/sync-website-data.sh

graph: ## Rebuild the knowledge graph after code changes (requires graphify — optional)
	@command -v graphify &>/dev/null \
	  && graphify update . \
	  || { echo "  SKIP: graphify is not installed — see https://graphify.ai to install it"; exit 0; }

# ── Website ───────────────────────────────────────────────────────────────────
website: ## Build and start the website at localhost (reads WEBSITE_PORT from .env)
	@bash rebuild.sh

# ── Session Management ────────────────────────────────────────────────────────
sessions: ## Show expired session files (dry-run — no files deleted)
	@bash scripts/cleanup-sessions.sh

sessions-delete: ## Delete expired session files (reads SESSION_RETENTION_DAYS from .env)
	@bash scripts/cleanup-sessions.sh --delete

#!/usr/bin/env bash
# scripts/setup.sh — One-command setup for AI Workflow.
#
# Usage:
#   make setup               ← recommended (must be run from the project root)
#   bash scripts/setup.sh    ← direct invocation (works from any directory)
#
# What this script does:
#   1. Checks required prerequisites (git, node, python3)
#   2. Checks optional tools (opencode, ajv-cli) and installs ajv-cli if missing
#   3. Installs .opencode/ npm plugin dependencies (skips if already done)
#   4. Creates .env from .env.example if .env does not yet exist
#   5. Creates required runtime directories
#   6. Runs health-check.sh to validate the final state
#   7. Prints next steps

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Load shared utilities
# shellcheck source=scripts/lib/common.sh
source "$ROOT/scripts/lib/common.sh"

PASS=0
WARN=0
FAIL=0

_ok()   { ok "$1";   PASS=$((PASS+1)); }
_warn() { warn "$1"; WARN=$((WARN+1)); }
_fail() { fail "$1"; FAIL=$((FAIL+1)); }

# Load .env if present (so env vars are available for steps below)
load_env "$ROOT/.env"

# ─────────────────────────────────────────────────────────────────────────────
banner "Setup"
# ─────────────────────────────────────────────────────────────────────────────

# ── 1. Required prerequisites ─────────────────────────────────────────────────
header "Checking required prerequisites"

for tool in git node python3; do
  if command -v "$tool" &>/dev/null; then
    _ok "$tool found ($(command -v "$tool"))"
  else
    _fail "$tool is required but not found"
  fi
done

if [[ "$FAIL" -gt 0 ]]; then
  echo
  fail "Setup cannot continue — $FAIL required tool(s) are missing."
  echo "  Install Node.js: https://nodejs.org"
  echo "  Install Python:  https://python.org"
  echo "  Install Git:     https://git-scm.com"
  exit 1
fi

# ── 2. Optional tools ─────────────────────────────────────────────────────────
header "Checking optional tools"

if command -v opencode &>/dev/null; then
  _ok "opencode found ($(command -v opencode))"
else
  _warn "opencode not found — install at: https://opencode.ai"
  echo "       The workflow requires opencode to run. Scripts and validation"
  echo "       will work without it, but you cannot start the AI agents."
fi

if command -v ajv &>/dev/null; then
  _ok "ajv-cli found"
else
  step "Installing ajv-cli (required for pipeline schema validation)..."
  if npm install -g ajv-cli ajv-formats --silent; then
    _ok "ajv-cli installed successfully"
  else
    _warn "ajv-cli install failed — run manually: npm install -g ajv-cli ajv-formats"
  fi
fi

# ── 3. .opencode/ npm plugin ──────────────────────────────────────────────────
header "Setting up .opencode/ plugin dependencies"

if [[ -d "$ROOT/.opencode/node_modules" ]]; then
  _ok ".opencode/node_modules already present — skipping install"
else
  step "Installing .opencode/ npm packages..."
  if npm install --prefix "$ROOT/.opencode" --silent; then
    _ok ".opencode/ packages installed"
  else
    _warn ".opencode/ npm install failed — run: npm install --prefix .opencode"
  fi
fi

# ── 4. Create .env from .env.example ─────────────────────────────────────────
header "Environment configuration (.env)"

if [[ -f "$ROOT/.env" ]]; then
  _ok ".env already exists — skipping copy"
  info "Edit .env to update values (especially GITHUB_TOKEN)"
else
  if [[ -f "$ROOT/.env.example" ]]; then
    cp "$ROOT/.env.example" "$ROOT/.env"
    _ok ".env created from .env.example"
    echo
    echo -e "  ${BOLD}${YELLOW}Action required:${NC} Open .env and set your GITHUB_TOKEN."
    echo "  The file is at: $ROOT/.env"
    echo
    echo "  Create a GitHub token at: https://github.com/settings/tokens"
    echo "  Required scopes: repo, read:org"
    echo
  else
    _fail ".env.example not found — cannot create .env"
  fi
fi

# ── 5. Required runtime directories ──────────────────────────────────────────
header "Creating required directories"

REQUIRED_DIRS=(
  ".opencode/state/sessions"
  "exports"
  "work-items/bugs"
)

for dir in "${REQUIRED_DIRS[@]}"; do
  if [[ -d "$ROOT/$dir" ]]; then
    _ok "$dir exists"
  else
    mkdir -p "$ROOT/$dir"
    _ok "$dir created"
  fi
done

# ── 6. Install aiw CLI ────────────────────────────────────────────────────────
header "Installing aiw CLI"

AIW_BIN="$ROOT/aiw"
if [[ -x "$AIW_BIN" ]]; then
  if [[ -w /usr/local/bin ]]; then
    ln -sf "$AIW_BIN" /usr/local/bin/aiw
    _ok "aiw CLI installed to /usr/local/bin/aiw"
  elif command -v sudo &>/dev/null; then
    sudo ln -sf "$AIW_BIN" /usr/local/bin/aiw 2>/dev/null && \
      _ok "aiw CLI installed to /usr/local/bin/aiw (via sudo)" || \
      _warn "Could not install aiw to PATH — use ./aiw from project root"
  else
    _warn "Cannot write to /usr/local/bin — use ./aiw from project root"
  fi
else
  _fail "aiw script not found at $AIW_BIN"
fi

# ── 7. Pre-commit hook ────────────────────────────────────────────────────────
# ── 7. Pre-commit hook ────────────────────────────────────────────────────────
header "Installing pre-commit hook"

HOOKS_DIR="$ROOT/.git/hooks"
PRECOMMIT="$HOOKS_DIR/pre-commit"

if [[ ! -d "$ROOT/.git" ]]; then
  _warn "Not a git repository — skipping pre-commit hook install"
elif [[ -f "$PRECOMMIT" ]]; then
  _ok "pre-commit hook already installed"
else
  mkdir -p "$HOOKS_DIR"
  cat > "$PRECOMMIT" << 'HOOK'
#!/usr/bin/env bash
# Pre-commit hook — run skill validation before every commit.
# Installed by scripts/setup.sh. Remove this file to disable.
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
echo "Running skill validation..."
if bash "$ROOT/scripts/validate-skills.sh" --quiet 2>&1; then
  echo "  PASS: Skill validation passed"
else
  echo "  FAIL: Skill validation failed — commit blocked"
  echo "  Run: make validate  for a full diagnostic"
  exit 1
fi
HOOK
  chmod +x "$PRECOMMIT"
  _ok "pre-commit hook installed at $PRECOMMIT"
  info "The hook runs 'make validate' before every commit. Remove .git/hooks/pre-commit to disable."
fi

# ── 8. Final health check ─────────────────────────────────────────────────────
header "Running health check"
echo
bash "$ROOT/scripts/health-check.sh" || true

# ── Summary ───────────────────────────────────────────────────────────────────
echo
echo -e "${BOLD}════════════════════════════════════════${NC}"
echo -e "  Setup complete: ${GREEN}$PASS passed${NC}, ${YELLOW}$WARN warnings${NC}, ${RED}$FAIL failed${NC}"
echo -e "${BOLD}════════════════════════════════════════${NC}"
echo
echo -e "${BOLD}Next steps:${NC}"
echo "  1. Edit .env and set GITHUB_TOKEN (and any other keys you want)"
echo "  2. Run: aiw health     — verify your configuration"
echo "  3. Run: aiw start      — launch the AI workflow"
echo
echo "  Quick reference:"
echo "    aiw validate         — validate all skills before committing"
echo "    aiw sync             — sync website/data/ after changing skills"
echo "    aiw graph            — update the knowledge graph"
echo "    aiw doctor           — full diagnostic (health + validation + git)"
echo "    aiw help             — list all available commands"
echo

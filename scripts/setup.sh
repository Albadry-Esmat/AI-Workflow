#!/usr/bin/env bash
# scripts/setup.sh — One-command setup for AI Workflow.
#
# Usage:
#   make setup               ← recommended (must be run from the project root)
#   bash scripts/setup.sh    ← direct invocation (works from any directory)
#
# What this script does:
#   1. Checks required prerequisites (git, node, npm, python3)
#   2. Installs committed root npm dependencies with npm ci
#   3. Checks optional tools (opencode, ajv-cli) and installs ajv-cli if missing
#   4. Checks the dependency-free .opencode plugin layout
#   5. Creates .env from .env.example if .env does not yet exist
#   6. Creates required runtime directories
#   7. Installs or refreshes the managed documentation-aware pre-commit hook
#   8. Runs health-check.sh to validate the final state
#   9. Prints next steps

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

for tool in git node npm python3; do
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

# ── 2. Root npm dependencies ───────────────────────────────────────────────────
header "Installing root npm dependencies"
if npm ci --ignore-scripts --no-audit --no-fund --silent; then
  _ok "Root npm dependencies installed from package-lock.json"
else
  _fail "npm ci failed — package-lock.json and package.json may be out of sync"
fi

if node "$ROOT/scripts/version.js" --json >/dev/null 2>&1; then
  _ok "Compatibility manifest and version metadata are valid"
else
  _fail "Compatibility manifest does not match package or schema metadata"
fi

# ── 3. Optional tools ─────────────────────────────────────────────────────────
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

# ── 4. .opencode/ plugin layout ───────────────────────────────────────────────
header "Checking .opencode/ plugin layout"

# The checked-in graphify plugin uses only Node.js built-ins and has no separate
# package manifest. Do not run npm install against .opencode/; doing so fails on
# a clean clone because .opencode/package.json does not exist.
if [[ -f "$ROOT/.opencode/plugins/graphify.js" ]]; then
  _ok ".opencode/plugins/graphify.js present — no plugin install required"
else
  _warn ".opencode/plugins/graphify.js not found — continuing without optional plugin"
fi

# ── 5. Create .env from .env.example ─────────────────────────────────────────
header "Environment configuration (.env)"

if [[ -f "$ROOT/.env" ]]; then
  _ok ".env already exists — skipping copy"
  info "Edit .env to update values (especially GITHUB_TOKEN)"
else
  if [[ -f "$ROOT/.env.example" ]]; then
    cp "$ROOT/.env.example" "$ROOT/.env"
    chmod 600 "$ROOT/.env"
    _ok ".env created from .env.example (mode 600)"
    echo
    echo -e "  ${BOLD}${YELLOW}Action required:${NC} Open .env and set your GITHUB_TOKEN."
    echo "  The file is at: $ROOT/.env"
    echo
    echo "  Create a fine-grained token at: https://github.com/settings/personal-access-tokens/fine-grained"
    echo "  Restrict repository access and grant only the permissions your workflow needs."
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
    _ok "aiw installed → /usr/local/bin/aiw"
  else
    # Try ~/.local/bin (always writable, no sudo needed)
    mkdir -p "$HOME/.local/bin"
    ln -sf "$AIW_BIN" "$HOME/.local/bin/aiw"
    _ok "aiw installed → $HOME/.local/bin/aiw"

    # Warn if ~/.local/bin is not on PATH
    if ! echo "$PATH" | tr ':' '\n' | grep -q "$HOME/.local/bin"; then
      echo
      warn "~/.local/bin is not on your PATH yet."
      echo "  Add this line to your shell profile (~/.zshrc or ~/.bashrc):"
      echo
      echo '    export PATH="$HOME/.local/bin:$PATH"'
      echo
      echo "  Then reload: source ~/.zshrc"
      echo "  Or for this session only: export PATH=\"\$HOME/.local/bin:\$PATH\""
      echo
    fi
  fi
else
  _fail "aiw script not found at $AIW_BIN"
fi

# ── 7. Pre-commit hook ────────────────────────────────────────────────────────
header "Installing pre-commit hook"

HOOKS_DIR="$ROOT/.git/hooks"
PRECOMMIT="$HOOKS_DIR/pre-commit"
HOOK_SOURCE="$ROOT/.githooks/pre-commit"

if [[ ! -d "$ROOT/.git" ]]; then
  _warn "Not a git repository — skipping pre-commit hook install"
elif [[ ! -f "$HOOK_SOURCE" ]]; then
  _fail "Versioned pre-commit hook is missing at $HOOK_SOURCE"
elif [[ ! -f "$PRECOMMIT" ]]; then
  mkdir -p "$HOOKS_DIR"
  cp "$HOOK_SOURCE" "$PRECOMMIT"
  chmod +x "$PRECOMMIT"
  _ok "pre-commit hook installed at $PRECOMMIT"
  info "The hook checks documentation policy, website synchronization, and skill validation before every commit."
elif grep -q "AIW_MANAGED_PRECOMMIT_V" "$PRECOMMIT" 2>/dev/null; then
  cp "$HOOK_SOURCE" "$PRECOMMIT"
  chmod +x "$PRECOMMIT"
  _ok "managed pre-commit hook refreshed at $PRECOMMIT"
else
  _warn "Custom pre-commit hook already exists; leaving it unchanged"
  info "CI remains authoritative. Integrate $HOOK_SOURCE checks into the custom hook or run aiw docs-check and aiw website-check manually."
fi

# ── 8. Final health check ─────────────────────────────────────────────────────
header "Running health check"
echo
bash "$ROOT/scripts/health-check.sh" || true

# ── Summary ───────────────────────────────────────────────────────────────────
echo
echo -e "${BOLD}════════════════════════════════════════${NC}"
if (( FAIL > 0 )); then
  echo -e "  Setup failed: ${GREEN}$PASS passed${NC}, ${YELLOW}$WARN warnings${NC}, ${RED}$FAIL failed${NC}"
else
  if (( WARN > 0 )); then
    echo -e "  Setup complete with warnings: ${GREEN}$PASS passed${NC}, ${YELLOW}$WARN warnings${NC}, ${RED}$FAIL failed${NC}"
    echo "  The repository is installed, but review the warnings before running a production pipeline."
  else
    echo -e "  Setup complete: ${GREEN}$PASS passed${NC}, ${YELLOW}$WARN warnings${NC}, ${RED}$FAIL failed${NC}"
  fi
fi
echo -e "${BOLD}════════════════════════════════════════${NC}"
echo
echo -e "${BOLD}Next steps:${NC}"
echo "  1. Edit .env and set GITHUB_TOKEN (and any other keys you want)"
echo "     Create a fine-grained token with repository-scoped access and reviewed permissions."
echo "     Set the shortest practical expiration and record a rotation owner."
echo ""
echo "  2. aiw health                      — verify your configuration"
echo "  3. aiw start /path/to/your-project — launch on your project"
echo "     aiw start                       — or launch here (this repo)"
echo ""
echo "  Quick reference:"
echo "    aiw init /path/to/project  — copy workflow into another project"
echo "    aiw validate               — validate all skills"
echo "    aiw docs-check             — require affected docs and changelog"
echo "    aiw website-check          — verify the website mirror"
echo "    aiw doctor                 — full diagnostic"
echo "    aiw help                   — all available commands"
echo

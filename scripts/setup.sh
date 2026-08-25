#!/usr/bin/env bash
# scripts/setup.sh — One-command setup for AI Workflow.
#
# Usage:
#   ./aiw setup
#   bash scripts/setup.sh
#
# The setup path is intentionally self-contained: validation dependencies are
# installed from the root package-lock.json and no global AJV/PyYAML packages
# are required.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/lib/common.sh
source "$ROOT/scripts/lib/common.sh"

PASS=0
WARN=0
FAIL=0
_ok() { ok "$1"; PASS=$((PASS + 1)); }
_warn() { warn "$1"; WARN=$((WARN + 1)); }
_fail() { fail "$1"; FAIL=$((FAIL + 1)); }

load_env "$ROOT/.env"
banner "Setup"

header "Checking required prerequisites"
for tool in git node npm; do
  if command -v "$tool" >/dev/null 2>&1; then
    _ok "$tool found ($(command -v "$tool"))"
  else
    _fail "$tool is required but not found"
  fi
done

if [[ "$FAIL" -gt 0 ]]; then
  echo
  fail "Setup cannot continue — required tools are missing."
  echo "  Install Node.js: https://nodejs.org"
  echo "  Install Git:     https://git-scm.com"
  exit 1
fi

header "Installing repository-pinned validation dependencies"
if [[ ! -f "$ROOT/package-lock.json" ]]; then
  _fail "package-lock.json not found — cannot install pinned dependencies"
else
  if npm ci --ignore-scripts --no-audit --no-fund --silent; then
    _ok "Root npm dependencies installed from package-lock.json"
  else
    _fail "Root npm dependency installation failed"
  fi
fi

if [[ "$FAIL" -gt 0 ]]; then
  echo
  fail "Setup cannot continue — dependency installation failed."
  exit 1
fi

header "Checking optional tools"
if command -v opencode >/dev/null 2>&1; then
  _ok "opencode found ($(command -v opencode))"
else
  _warn "opencode not found — install from https://opencode.ai before running agents"
fi
if command -v graphify >/dev/null 2>&1; then
  _ok "graphify found ($(command -v graphify))"
else
  _warn "graphify not found — knowledge graph commands will be unavailable"
fi

header "Setting up .opencode plugin dependencies"
if [[ -d "$ROOT/.opencode/node_modules" ]]; then
  _ok ".opencode/node_modules already present — skipping install"
else
  if npm install --prefix "$ROOT/.opencode" --ignore-scripts --no-audit --no-fund --silent; then
    _ok ".opencode packages installed"
  else
    _fail ".opencode dependency installation failed"
  fi
fi

header "Environment configuration"
if [[ -f "$ROOT/.env" ]]; then
  _ok ".env exists — existing credentials were not modified"
else
  if [[ -f "$ROOT/.env.example" ]]; then
    cp "$ROOT/.env.example" "$ROOT/.env"
    chmod 600 "$ROOT/.env"
    _ok ".env created from .env.example"
    warn "Set GITHUB_TOKEN in $ROOT/.env before starting agents"
  else
    _fail ".env.example not found — cannot create .env"
  fi
fi

header "Creating required runtime directories"
for dir in ".opencode/state/sessions" "exports" "work-items/bugs"; do
  if [[ -d "$ROOT/$dir" ]]; then
    _ok "$dir exists"
  else
    mkdir -p "$ROOT/$dir"
    _ok "$dir created"
  fi
done

header "Installing aiw CLI"
if [[ -x "$ROOT/aiw" ]]; then
  if [[ -w /usr/local/bin ]]; then
    ln -sf "$ROOT/aiw" /usr/local/bin/aiw
    _ok "aiw installed → /usr/local/bin/aiw"
  else
    mkdir -p "$HOME/.local/bin"
    ln -sf "$ROOT/aiw" "$HOME/.local/bin/aiw"
    _ok "aiw installed → $HOME/.local/bin/aiw"
    if ! echo "$PATH" | tr ':' '\n' | grep -qx "$HOME/.local/bin"; then
      _warn "$HOME/.local/bin is not on PATH; add it to your shell profile"
    fi
  fi
else
  _fail "aiw script not found at $ROOT/aiw"
fi

header "Installing pre-commit hook"
HOOKS_DIR="$ROOT/.git/hooks"
PRECOMMIT="$HOOKS_DIR/pre-commit"
if [[ ! -d "$ROOT/.git" ]]; then
  _warn "Not a Git repository — skipping pre-commit hook"
elif [[ -f "$PRECOMMIT" ]]; then
  _ok "pre-commit hook already installed"
else
  mkdir -p "$HOOKS_DIR"
  cat > "$PRECOMMIT" <<'HOOK'
#!/usr/bin/env bash
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
echo "Running skill validation..."
if bash "$ROOT/scripts/validate-skills.sh" --quiet 2>&1; then
  echo "  PASS: Skill validation passed"
else
  echo "  FAIL: Skill validation failed — commit blocked"
  echo "  Run: npm run validate"
  exit 1
fi
HOOK
  chmod +x "$PRECOMMIT"
  _ok "pre-commit hook installed"
fi

header "Running health check"
bash "$ROOT/scripts/health-check.sh" || true

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
echo "Next steps:"
echo "  1. Set GITHUB_TOKEN in .env"
echo "  2. Run: aiw health"
echo "  3. Run: aiw validate"
echo "  4. Run: aiw start /path/to/your-project"
[[ "$FAIL" -eq 0 ]]

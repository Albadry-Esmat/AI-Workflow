#!/usr/bin/env bash
# scripts/setup.sh — One-command setup for AI Workflow.
#
# Usage:
#   make setup               ← recommended (must be run from the project root)
#   bash scripts/setup.sh    ← direct invocation (works from any directory)
#
# What this script does:
#   1. Checks required prerequisites (git, node, npm, python3)
#   2. Creates a project-local Python environment and installs pinned requirements
#   3. Installs root Node dependencies from package-lock.json with npm ci
#   4. Installs .opencode/ npm plugin dependencies in its local directory
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

# ── 2. Project-local Python toolchain ─────────────────────────────────────────
header "Setting up project-local Python environment"

VENV="$ROOT/.venv"
if [[ ! -x "$VENV/bin/python" ]]; then
  step "Creating $VENV..."
  python3 -m venv "$VENV"
  _ok "Created disposable project-local Python environment"
else
  _ok "$VENV already exists"
fi

if "$VENV/bin/python" -c 'import jsonschema, yaml' &>/dev/null; then
  _ok "Pinned Python validation dependencies are available"
else
  step "Installing pinned Python requirements into $VENV..."
  if "$VENV/bin/python" -m pip install --disable-pip-version-check --requirement "$ROOT/requirements-dev.txt" --quiet; then
    _ok "Pinned Python requirements installed"
  else
    _fail "Pinned Python requirements could not be installed"
    echo "       Fix: $VENV/bin/python -m pip install --requirement requirements-dev.txt"
  fi
fi

# ── 3. Project-local root Node toolchain ───────────────────────────────────────
header "Setting up project-local Node dependencies"

if [[ -f "$ROOT/package-lock.json" ]]; then
  step "Installing root packages from package-lock.json with npm ci..."
  if npm ci --ignore-scripts --no-audit --no-fund --silent; then
    _ok "Root Node dependencies installed from the committed lockfile"
  else
    _fail "Root Node dependencies could not be installed from package-lock.json"
  fi
else
  _fail "package-lock.json not found — deterministic Node installation is unavailable"
fi

if [[ -x "$ROOT/node_modules/.bin/ajv" ]]; then
  _ok "Project-local ajv-cli found"
else
  _fail "Project-local ajv-cli not found after npm ci"
fi

# ── 4. .opencode/ npm plugin ──────────────────────────────────────────────────
header "Setting up .opencode/ plugin dependencies"

if [[ ! -f "$ROOT/.opencode/package.json" ]]; then
  _ok ".opencode has no plugin package manifest — no plugin dependency install required"
elif [[ -d "$ROOT/.opencode/node_modules" ]]; then
  _ok ".opencode/node_modules already present — skipping install"
else
  step "Installing .opencode/ npm packages..."
  if [[ -f "$ROOT/.opencode/package-lock.json" ]]; then
    install_cmd=(npm ci --prefix "$ROOT/.opencode" --ignore-scripts --no-audit --no-fund --silent)
  else
    install_cmd=(npm install --prefix "$ROOT/.opencode" --ignore-scripts --no-audit --no-fund --silent)
  fi
  if "${install_cmd[@]}"; then
    _ok ".opencode/ packages installed locally"
  else
    _warn ".opencode/ npm packages could not be installed"
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
    echo "  Optional: add provider or GitHub credentials later through the approved auth flow."
    echo "  Prefer short-lived, fine-grained credentials and rotate them regularly."
    echo "  The core no-secret demo and validation path do not require credentials."
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
echo "  1. aiw health                      — verify the project-local toolchain"
echo "  2. aiw validate-onboarding-o0      — verify the agent-neutral O0 contract"
echo "  3. Select and authenticate an agent runtime only when you are ready"
echo "  4. aiw start /path/to/your-project — launch behavior is runtime-adapter work"
echo ""
echo "  Quick reference:"
echo "    aiw init /path/to/project  — copy workflow into another project"
echo "    aiw validate               — validate all skills"
echo "    aiw doctor                 — full diagnostic"
echo "    aiw help                   — all available commands"
echo

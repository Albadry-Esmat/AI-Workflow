#!/usr/bin/env bash
# scripts/health-check.sh — Validate environment, tools, and configuration.
#
# Run from the project root:  make health  OR  bash scripts/health-check.sh
#
# Checks:
#   1. Required tools (git, node, python3, opencode)
#   2. Optional tools (ajv-cli, graphify)
#   3. .env file exists
#   4. GITHUB_TOKEN is set (required)
#   5. Optional env vars (with warnings, not failures)
#   6. .opencode/node_modules installed
#   7. Skill count sanity (index.yaml vs .opencode/skills/)
#   8. opencode.json skill paths exist on disk
#
# Exit code: 0 if all required checks pass (warnings are non-fatal)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Load shared utilities — guard against missing library
COMMON_SH="$ROOT/scripts/lib/common.sh"
if [[ ! -f "$COMMON_SH" ]]; then
  echo "ERROR: scripts/lib/common.sh not found at $COMMON_SH" >&2
  echo "  Fix: run 'make setup' from the project root, or verify the repository is intact." >&2
  exit 1
fi
# shellcheck source=scripts/lib/common.sh
source "$COMMON_SH"

# Load .env if present
load_env "$ROOT/.env"

FAILURES=0
WARNINGS=0
PASSES=0

_ok()   { ok "$1";   PASSES=$((PASSES+1));   }
_warn() { warn "$1"; WARNINGS=$((WARNINGS+1)); }
_fail() { fail "$1"; FAILURES=$((FAILURES+1)); }

banner "Health Check"

# ── 1. Required tools ─────────────────────────────────────────────────────────
header "Required tools"

for tool in git node python3; do
  if command -v "$tool" &>/dev/null; then
    _ok "$tool  →  $(command -v "$tool")"
  else
    _fail "$tool not found"
    case "$tool" in
      node)   echo "       Install Node.js at: https://nodejs.org" ;;
      python3) echo "       Install Python at: https://python.org" ;;
      git)    echo "       Install Git at: https://git-scm.com" ;;
    esac
  fi
done

if command -v opencode &>/dev/null; then
  _ok "opencode  →  $(command -v opencode)"
else
  _fail "opencode not found — install at: https://opencode.ai"
fi

# ── 2. Optional tools ─────────────────────────────────────────────────────────
header "Optional tools"

if command -v ajv &>/dev/null; then
  _ok "ajv-cli  →  $(command -v ajv)"
else
  _warn "ajv-cli not found — pipeline schema validation will be skipped"
  echo "       Fix: npm install -g ajv-cli ajv-formats"
fi

if command -v graphify &>/dev/null; then
  _ok "graphify  →  $(command -v graphify)"
else
  _warn "graphify not found — knowledge graph features unavailable"
  echo "       See: https://github.com/graphify-ai/graphify"
fi

# ── 3. .env file ──────────────────────────────────────────────────────────────
header "Environment file"

if [[ -f "$ROOT/.env" ]]; then
  _ok ".env exists at $ROOT/.env"
else
  _fail ".env not found — run: make setup  (or: cp .env.example .env)"
fi

# ── 4. Required env vars ──────────────────────────────────────────────────────
header "Required environment variables"

if [[ -n "${GITHUB_TOKEN:-}" ]]; then
  # Mask the token — show first 4 chars then fixed asterisks
  MASKED="${GITHUB_TOKEN:0:4}********************"
  _ok "GITHUB_TOKEN is set  ($MASKED)"
else
  _fail "GITHUB_TOKEN is not set"
  echo "       Add GITHUB_TOKEN=<your-token> to .env"
  echo "       Create a token at: https://github.com/settings/tokens"
  echo "       Required scopes: repo, read:org"
fi

# ── 5. Optional env vars ──────────────────────────────────────────────────────
header "Optional environment variables"

for var_pair in \
  "CONTEXT7_API_KEY:Context7 (library docs in context)" \
  "BRAVE_API_KEY:Brave Search (web search for agents)" \
  "VERCEL_TOKEN:Vercel (deployment operations)"
do
  var="${var_pair%%:*}"
  desc="${var_pair##*:}"
  if [[ -n "${!var:-}" ]]; then
    _ok "$var is set  ($desc)"
  else
    _warn "$var is not set  ($desc)"
  fi
done

# MCP servers that are enabled by default but need API keys to be useful:
for mcp_var in CONTEXT7_API_KEY BRAVE_API_KEY; do
  if [[ "${!mcp_var:-}" == "" ]]; then
    _warn "$mcp_var is empty — the corresponding MCP server will start but return no results"
    echo "       Set $mcp_var in .env to enable full functionality"
  fi
done

# ── 6. .opencode/ plugin ──────────────────────────────────────────────────────
header ".opencode/ plugin dependencies"

if [[ -d "$ROOT/.opencode/node_modules" ]]; then
  _ok ".opencode/node_modules exists"
else
  _fail ".opencode/node_modules missing — run: make setup  (or: npm install --prefix .opencode)"
fi

# ── 7. Skill count sanity ─────────────────────────────────────────────────────
header "Skill count consistency"

if command -v grep &>/dev/null; then
  INDEX_COUNT=$(grep -c "^- id:" "$ROOT/skills/index.yaml" 2>/dev/null || echo 0)
  DIR_COUNT=$(find "$ROOT/.opencode/skills" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l | tr -d ' ')
  if [[ "$INDEX_COUNT" -eq "$DIR_COUNT" ]] && [[ "$INDEX_COUNT" -gt 0 ]]; then
    _ok "index.yaml ($INDEX_COUNT) matches .opencode/skills/ ($DIR_COUNT)"
  else
    _fail "Skill count mismatch — index.yaml: $INDEX_COUNT, .opencode/skills/: $DIR_COUNT"
    echo "       Run: make validate — for a full diagnostic"
  fi
else
  _warn "grep not available — skipping skill count check"
fi

# ── 8. opencode.json skill paths ──────────────────────────────────────────────
header "opencode.json skill path integrity"

if command -v node &>/dev/null && [[ -f "$ROOT/opencode.json" ]]; then
  MISSING_PATHS=$(node -e "
    const fs = require('fs');
    const cfg = JSON.parse(fs.readFileSync('opencode.json', 'utf8'));
    const missing = [];
    for (const agent of Object.values(cfg.agent || {})) {
      const paths = [];
      if (agent.skill)  paths.push(agent.skill);
      if (agent.skills) paths.push(...agent.skills);
      for (const p of paths) {
        if (!fs.existsSync(p)) missing.push(p);
      }
    }
    missing.forEach(p => console.log(p));
  " 2>/dev/null || true)

  if [[ -z "$MISSING_PATHS" ]]; then
    _ok "All skill paths in opencode.json exist on disk"
  else
    while IFS= read -r path; do
      _fail "Missing skill file: $path"
    done <<< "$MISSING_PATHS"
    echo "       Run: make validate — for detailed diagnostics"
  fi
else
  _warn "node not available or opencode.json missing — skipping path check"
fi

# ── 9. Required runtime directories ──────────────────────────────────────────
header "Required runtime directories"

REQUIRED_DIRS=(
  ".opencode/state/sessions"
  "exports"
  "work-items/bugs"
)

for dir in "${REQUIRED_DIRS[@]}"; do
  if [[ -d "$ROOT/$dir" ]]; then
    _ok "$dir exists"
  else
    _warn "$dir missing — run: make setup  to create it"
  fi
done

# ── Summary ───────────────────────────────────────────────────────────────────
echo
echo -e "${BOLD}════════════════════════════════════════${NC}"
if [[ "$FAILURES" -eq 0 ]]; then
  echo -e "  ${GREEN}${BOLD}Health check passed${NC} — $PASSES checks OK, $WARNINGS warning(s)"
  echo
  echo -e "  ${BOLD}Ready to run:${NC}  opencode"
  echo "  MCP servers will start automatically on first use."
  echo "  Servers with missing API keys start but return no results until keys are set."
else
  echo -e "  ${RED}${BOLD}Health check failed${NC} — $FAILURES failure(s), $WARNINGS warning(s), $PASSES passed"
  echo
  echo "  Fix the failures above, then run: make health"
fi
echo -e "${BOLD}════════════════════════════════════════${NC}"
echo

[[ "$FAILURES" -eq 0 ]]

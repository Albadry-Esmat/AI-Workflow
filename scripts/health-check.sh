#!/usr/bin/env bash
# scripts/health-check.sh — Validate environment, tools, and configuration.
#
# Run from the project root:  make health  OR  bash scripts/health-check.sh
#
# Checks:
#   1. Required host tools (git, node, npm, python3)
#   2. Project-local tools (.venv and scripts/validate-json-schema.mjs)
#   3. Optional agent runtimes and graphify
#   4. .env file exists
#   5. Credentials are optional until a provider operation is requested
#   6. Optional env vars (with warnings, not failures)
#   7. .opencode plugin dependency state
#   8. Skill count sanity (index.yaml vs .opencode/skills/)
#   9. opencode.json skill paths exist on disk
#  10. Required runtime directories
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

PYTHON_BIN="${AIW_PYTHON_BIN:-$ROOT/.venv/bin/python}"
if [[ ! -x "$PYTHON_BIN" ]]; then
  PYTHON_BIN="$(command -v python3 || true)"
fi
AJV_BIN="${AIW_AJV_BIN:-$ROOT/scripts/validate-json-schema.mjs}"
if [[ ! -x "$AJV_BIN" ]]; then
  AJV_BIN="$(command -v ajv || true)"
fi

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

for tool in git node npm python3; do
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

# ── 2. Project-local tools ─────────────────────────────────────────────────────
header "Project-local tools"

if [[ -n "$PYTHON_BIN" ]] && [[ -x "$PYTHON_BIN" ]] && "$PYTHON_BIN" -c 'import jsonschema, yaml' &>/dev/null; then
  _ok "project-local Python dependencies  →  $PYTHON_BIN"
else
  _fail "project-local Python dependencies missing — run: make setup"
fi

if [[ -n "$AJV_BIN" ]] && [[ -x "$AJV_BIN" ]]; then
  _ok "project-local JSON Schema validator  →  $AJV_BIN"
else
  _fail "project-local JSON Schema validator missing — run: make setup"
fi

# ── 3. Optional agent runtimes and tools ───────────────────────────────────────
header "Optional agent runtimes and tools"

RUNTIME_FOUND=0
for runtime in opencode claude codex; do
  if command -v "$runtime" &>/dev/null; then
    _ok "$runtime  →  $(command -v "$runtime")"
    RUNTIME_FOUND=$((RUNTIME_FOUND+1))
  fi
done
if [[ "$RUNTIME_FOUND" -eq 0 ]]; then
  _warn "No candidate agent runtime detected — core validation and no-secret demo remain available"
fi

if command -v graphify &>/dev/null; then
  _ok "graphify  →  $(command -v graphify)"
else
  _warn "graphify not found — knowledge graph features unavailable"
  echo "       See: https://github.com/graphify-ai/graphify"
fi

# ── 4. .env file ──────────────────────────────────────────────────────────────
header "Environment file"

if [[ -f "$ROOT/.env" ]]; then
  _ok ".env exists at $ROOT/.env"
else
  _fail ".env not found — run: make setup  (or: cp .env.example .env)"
fi

# ── 5. Optional credentials ────────────────────────────────────────────────────
header "Optional credentials"

if [[ -n "${GITHUB_TOKEN:-}" ]]; then
  MASKED="${GITHUB_TOKEN:0:4}********************"
  _ok "GITHUB_TOKEN is set  ($MASKED)"
else
  _warn "GITHUB_TOKEN is not set — optional provider/GitHub operations will request approved auth later; use short-lived, fine-grained credentials and rotate them"
fi

# ── 6. Optional env vars ──────────────────────────────────────────────────────
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

# ── 7. .opencode/ plugin ──────────────────────────────────────────────────────
header ".opencode/ plugin dependencies"

if [[ ! -f "$ROOT/.opencode/package.json" ]]; then
  _ok ".opencode has no plugin package manifest — no node_modules required"
elif [[ -d "$ROOT/.opencode/node_modules" ]]; then
  _ok ".opencode/node_modules exists"
else
  _fail ".opencode/node_modules missing — run: make setup"
fi

# ── 8. Skill count sanity ─────────────────────────────────────────────────────
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

# ── 9. opencode.json skill paths ──────────────────────────────────────────────
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

# ── 10. Required runtime directories ──────────────────────────────────────────
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
  echo -e "  ${BOLD}Ready to run:${NC}  aiw validate / aiw demo"
  echo "  Select and authenticate an agent runtime only when you are ready."
  echo "  Servers with missing API keys start but return no results until keys are set."
else
  echo -e "  ${RED}${BOLD}Health check failed${NC} — $FAILURES failure(s), $WARNINGS warning(s), $PASSES passed"
  echo
  echo "  Fix the failures above, then run: make health"
fi
echo -e "${BOLD}════════════════════════════════════════${NC}"
echo

[[ "$FAILURES" -eq 0 ]]

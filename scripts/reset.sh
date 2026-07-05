#!/usr/bin/env bash
# scripts/reset.sh — Reset the workspace to a clean state.
#
# Run from the project root:  make reset  OR  bash scripts/reset.sh
#
# ⚠️  DESTRUCTIVE — this script removes:
#   - .env                        Your secrets (you will need to re-enter them)
#   - .opencode/state/sessions/   All session history
#   - exports/                    All exported work items
#   - website/.next/              Build artifacts
#   - graphify-out/cache/         Graphify cache
#   - graphify-out/YYYY-MM-DD/    Graphify dated snapshots
#
# Prompts for confirmation before deleting anything.
# Pass --yes to skip the confirmation prompt (useful in CI / scripted flows).

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Load shared utilities
# shellcheck source=scripts/lib/common.sh
source "$ROOT/scripts/lib/common.sh"

banner "Reset"

SKIP_CONFIRM=false
for arg in "$@"; do
  [[ "$arg" == "--yes" ]] && SKIP_CONFIRM=true
done

# ── Confirm ───────────────────────────────────────────────────────────────────
echo -e "${BOLD}${RED}WARNING: This will delete:${NC}"
echo "  - .env                   (your secrets — you will need to re-enter them)"
echo "  - .opencode/state/       (all session history)"
echo "  - exports/               (all exported work items)"
echo "  - website/.next/         (build cache)"
echo "  - graphify-out/cache/    (graphify parse cache)"
echo "  - graphify-out/YYYY-MM-DD/ (graphify snapshots)"
echo

if [[ "$SKIP_CONFIRM" == "false" ]]; then
  read -r -p "  Are you sure you want to continue? [y/N] " REPLY
  echo
  if [[ ! "$REPLY" =~ ^[Yy]$ ]]; then
    echo "  Reset cancelled."
    exit 0
  fi
fi

REMOVED=0

_remove_file() {
  if [[ -f "$1" ]]; then
    rm -f "$1"
    ok "Removed $1"
    REMOVED=$((REMOVED+1))
  fi
}

_remove_dir() {
  if [[ -d "$1" ]]; then
    rm -rf "$1"
    ok "Removed $1"
    REMOVED=$((REMOVED+1))
  fi
}

# ── Remove .env ───────────────────────────────────────────────────────────────
header "Secrets"
_remove_file "$ROOT/.env"

# ── Remove session state ──────────────────────────────────────────────────────
header "Session state"
_remove_dir  "$ROOT/.opencode/state/sessions"
_remove_file "$ROOT/.opencode/state/last_session.txt"

# ── Remove exports ────────────────────────────────────────────────────────────
header "Exports"
if [[ -d "$ROOT/exports" ]]; then
  # Remove files inside but keep the directory and .gitkeep
  find "$ROOT/exports" -mindepth 1 -not -name ".gitkeep" -delete 2>/dev/null || true
  ok "Cleared exports/ (directory kept)"
  REMOVED=$((REMOVED+1))
fi

# ── Remove build artifacts (delegates to clean.sh) ────────────────────────────
header "Build artifacts"
bash "$ROOT/scripts/clean.sh" 2>/dev/null || true

# ── Re-create required directories ────────────────────────────────────────────
header "Re-creating required directories"
mkdir -p "$ROOT/.opencode/state/sessions"
mkdir -p "$ROOT/exports"
ok "Runtime directories restored"

# ── Summary ───────────────────────────────────────────────────────────────────
echo
echo -e "${GREEN}${BOLD}Reset complete${NC} — $REMOVED item(s) removed."
echo
echo "  Run 'make setup' to restore your environment:"
echo "  $ make setup"
echo

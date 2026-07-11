#!/usr/bin/env bash
# scripts/reset.sh — Reset the workspace to a clean state.
#
# Run from the project root:  aiw reset  OR  bash scripts/reset.sh
#
# ⚠️  DESTRUCTIVE — this script removes:
#   - .opencode/state/sessions/   All session history
#   - exports/                    All exported work items
#   - website/.next/              Build artifacts
#   - graphify-out/cache/         Graphify cache
#   - graphify-out/YYYY-MM-DD/    Graphify dated snapshots
#
# NOTE: .env is intentionally NOT deleted. Your tokens are preserved.
#       Use 'aiw backup' before reset if you want a state snapshot.
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
echo "  - .opencode/state/       (all session history)"
echo "  - exports/               (all exported work items)"
echo "  - website/.next/         (build cache)"
echo "  - graphify-out/cache/    (graphify parse cache)"
echo "  - graphify-out/YYYY-MM-DD/ (graphify snapshots)"
echo
echo -e "  ${GREEN}NOT deleted:${NC} .env — your tokens are always preserved."
echo "  (To also clear .env, delete it manually: rm .env)"
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

# ── .env is intentionally NOT touched ────────────────────────────────────────
# Tokens and secrets in .env are never deleted by reset.
# This was the #1 cause of repeated token rotation — fixed.

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
echo "  Your .env is intact — no need to re-enter tokens."
echo "  Run 'aiw health' to confirm environment is still valid."
echo "  Run 'aiw start' to launch the AI workflow."
echo

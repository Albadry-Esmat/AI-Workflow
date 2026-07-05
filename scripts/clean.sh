#!/usr/bin/env bash
# scripts/clean.sh — Remove build artifacts and cache files.
#
# Run from the project root:  make clean  OR  bash scripts/clean.sh
#
# What is removed (safe — all are generated/cached files):
#   - website/.next/              Next.js build output
#   - graphify-out/cache/         Graphify parse cache
#   - graphify-out/YYYY-MM-DD/    Dated graphify snapshot directories
#
# What is NOT removed:
#   - .env                        Your secrets
#   - .opencode/state/sessions/   Active session state
#   - graphify-out/graph.json     Current knowledge graph
#   - graphify-out/wiki/          Generated wiki pages
#   - exports/                    Work item exports

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Load shared utilities
# shellcheck source=scripts/lib/common.sh
source "$ROOT/scripts/lib/common.sh"

banner "Clean"

CLEANED=0

# ── website/.next/ ────────────────────────────────────────────────────────────
header "Website build artifacts"
if [[ -d "$ROOT/website/.next" ]]; then
  rm -rf "$ROOT/website/.next"
  ok "Removed website/.next/"
  CLEANED=$((CLEANED+1))
else
  info "website/.next/ not present — skipping"
fi

# ── graphify cache ────────────────────────────────────────────────────────────
header "Graphify cache"
if [[ -d "$ROOT/graphify-out/cache" ]]; then
  rm -rf "$ROOT/graphify-out/cache"
  ok "Removed graphify-out/cache/"
  CLEANED=$((CLEANED+1))
else
  info "graphify-out/cache/ not present — skipping"
fi

# ── graphify dated snapshots (YYYY-MM-DD directories) ─────────────────────────
header "Graphify dated snapshots"
SNAPSHOT_COUNT=0
while IFS= read -r -d '' snapshot; do
  dir_name=$(basename "$snapshot")
  if [[ "$dir_name" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
    rm -rf "$snapshot"
    ok "Removed graphify-out/$dir_name/"
    SNAPSHOT_COUNT=$((SNAPSHOT_COUNT+1))
    CLEANED=$((CLEANED+1))
  fi
done < <(find "$ROOT/graphify-out" -mindepth 1 -maxdepth 1 -type d -print0 2>/dev/null || true)

if [[ "$SNAPSHOT_COUNT" -eq 0 ]]; then
  info "No dated graphify snapshots found"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo
if [[ "$CLEANED" -eq 0 ]]; then
  echo "  Nothing to clean — workspace is already tidy."
else
  echo -e "  ${GREEN}Clean complete${NC} — $CLEANED item(s) removed."
fi
echo

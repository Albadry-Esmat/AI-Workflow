#!/usr/bin/env bash
# scripts/cleanup-sessions.sh
# Prune session state files older than the configured retention window.
# Safe to run in CI or as a cron job. Dry-run mode by default.
#
# Usage:
#   make sessions                              ← dry-run (shows what would be deleted)
#   make sessions-delete                       ← actually delete files
#   bash scripts/cleanup-sessions.sh          ← dry-run
#   bash scripts/cleanup-sessions.sh --delete ← actually delete
#   bash scripts/cleanup-sessions.sh --days 7 ← custom retention window
#
# Environment variables (read from .env if present):
#   SESSION_RETENTION_DAYS   Default retention in days (default: 30)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Load shared utilities
# shellcheck source=scripts/lib/common.sh
source "$ROOT/scripts/lib/common.sh"

# Load .env for SESSION_RETENTION_DAYS
load_env "$ROOT/.env"

SESSIONS_DIR=".opencode/state/sessions"
# CLI --days overrides env var which overrides default
RETENTION_DAYS="${SESSION_RETENTION_DAYS:-30}"
DRY_RUN=true

# ── Parse arguments ───────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --delete)
      DRY_RUN=false
      shift
      ;;
    --days)
      RETENTION_DAYS="$2"
      shift 2
      ;;
    --help|-h)
      echo "Usage: $0 [--delete] [--days N]"
      echo
      echo "  --delete       Actually delete expired files (default: dry-run)"
      echo "  --days N       Retention window in days (default: \$SESSION_RETENTION_DAYS or 30)"
      echo
      echo "  Environment: set SESSION_RETENTION_DAYS in .env to change the default"
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

# ── Validate RETENTION_DAYS is a positive integer ────────────────────────────
if ! [[ "$RETENTION_DAYS" =~ ^[0-9]+$ ]] || [[ "$RETENTION_DAYS" -lt 1 ]]; then
  fail "SESSION_RETENTION_DAYS must be a positive integer (got: '$RETENTION_DAYS')"
  echo "  Fix: set SESSION_RETENTION_DAYS=N in .env (e.g. SESSION_RETENTION_DAYS=30)"
  exit 1
fi

# ── Guard: sessions directory must exist ─────────────────────────────────────
if [[ ! -d "$SESSIONS_DIR" ]]; then
  info "Sessions directory not found: $SESSIONS_DIR — nothing to clean."
  exit 0
fi

# ── Header ────────────────────────────────────────────────────────────────────
header "Session Cleanup"
echo "  Directory : $SESSIONS_DIR"
echo "  Retention : $RETENTION_DAYS days"
echo "  Mode      : $([ "$DRY_RUN" = true ] && echo 'dry-run (pass --delete to remove)' || echo 'DELETE')"
echo

# ── Find expired files ────────────────────────────────────────────────────────
EXPIRED_FILES=$(find "$SESSIONS_DIR" -maxdepth 1 -name "*.json" -mtime +"$RETENTION_DAYS" 2>/dev/null || true)

if [[ -z "$EXPIRED_FILES" ]]; then
  info "No session files older than $RETENTION_DAYS days found."
  exit 0
fi

COUNT=$(echo "$EXPIRED_FILES" | wc -l | tr -d ' ')
echo "  Found $COUNT expired file(s):"
echo "$EXPIRED_FILES" | while read -r f; do
  MTIME=$(date -r "$f" "+%Y-%m-%d" 2>/dev/null || stat -c "%y" "$f" 2>/dev/null | cut -d' ' -f1)
  echo "    [$MTIME] $(basename "$f")"
done
echo

# ── Act ───────────────────────────────────────────────────────────────────────
if [[ "$DRY_RUN" = true ]]; then
  info "Dry-run: no files deleted. Run with --delete (or: make sessions-delete) to remove them."
else
  while IFS= read -r f; do
    rm -f "$f"
  done <<< "$EXPIRED_FILES"
  ok "Deleted $COUNT expired session file(s)."

  # Clear last_session.txt if the referenced session was deleted
  LAST_SESSION_FILE=".opencode/state/last_session.txt"
  if [[ -f "$LAST_SESSION_FILE" ]]; then
    LAST_ID=$(cat "$LAST_SESSION_FILE")
    if [[ ! -f "$SESSIONS_DIR/$LAST_ID.json" ]]; then
      warn "last_session.txt references a deleted session ($LAST_ID) — clearing."
      rm -f "$LAST_SESSION_FILE"
    fi
  fi

  ok "Done."
fi

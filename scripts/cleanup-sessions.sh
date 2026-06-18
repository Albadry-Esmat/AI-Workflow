#!/usr/bin/env bash
# cleanup-sessions.sh
# Prune session state files older than 30 days from .opencode/state/sessions/
# Safe to run in CI or as a cron job. Dry-run mode enabled by default.
#
# Usage:
#   ./scripts/cleanup-sessions.sh            # dry-run (shows what would be deleted)
#   ./scripts/cleanup-sessions.sh --delete   # actually delete files
#   ./scripts/cleanup-sessions.sh --days 7   # custom retention window

set -euo pipefail

# Anchor to project root regardless of where the script is invoked from
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SESSIONS_DIR=".opencode/state/sessions"
RETENTION_DAYS=30
DRY_RUN=true

# Parse arguments
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
      echo "  --delete       Actually delete expired files (default: dry-run)"
      echo "  --days N       Retention window in days (default: 30)"
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

# Verify directory exists
if [[ ! -d "$SESSIONS_DIR" ]]; then
  echo "Sessions directory not found: $SESSIONS_DIR — nothing to clean."
  exit 0
fi

echo "=== Session Cleanup ==="
echo "  Directory:  $SESSIONS_DIR"
echo "  Retention:  $RETENTION_DAYS days"
echo "  Mode:       $([ "$DRY_RUN" = true ] && echo 'dry-run' || echo 'DELETE')"
echo ""

# Find expired session files
EXPIRED_FILES=$(find "$SESSIONS_DIR" -maxdepth 1 -name "*.json" -mtime +"$RETENTION_DAYS" 2>/dev/null || true)

if [[ -z "$EXPIRED_FILES" ]]; then
  echo "No session files older than $RETENTION_DAYS days found."
  exit 0
fi

COUNT=$(echo "$EXPIRED_FILES" | wc -l | tr -d ' ')
echo "Found $COUNT expired file(s):"
echo "$EXPIRED_FILES" | while read -r f; do
  MTIME=$(date -r "$f" "+%Y-%m-%d" 2>/dev/null || stat -c "%y" "$f" 2>/dev/null | cut -d' ' -f1)
  echo "  [$MTIME] $f"
done
echo ""

if [[ "$DRY_RUN" = true ]]; then
  echo "Dry-run: no files deleted. Run with --delete to remove them."
else
  while IFS= read -r f; do
    rm -f "$f"
  done <<< "$EXPIRED_FILES"
  echo "Deleted $COUNT expired session file(s)."

  # Update last_session.txt if the referenced session was deleted
  LAST_SESSION_FILE=".opencode/state/last_session.txt"
  if [[ -f "$LAST_SESSION_FILE" ]]; then
    LAST_ID=$(cat "$LAST_SESSION_FILE")
    if [[ ! -f "$SESSIONS_DIR/$LAST_ID.json" ]]; then
      echo "Warning: last_session.txt references a deleted session ($LAST_ID). Clearing."
      rm -f "$LAST_SESSION_FILE"
    fi
  fi

  echo "Done."
fi

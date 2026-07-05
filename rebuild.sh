#!/usr/bin/env bash

# ─────────────────────────────────────────────────────────────────────────────
# rebuild.sh — Build and start the AI Workflow website locally.
#
# Usage:
#   make website        ← preferred
#   bash rebuild.sh     ← direct
#
# Configuration (via .env or environment):
#   WEBSITE_PORT        Port for the local server (default: 3000)
#
# Requires the website source code (website/package.json) to be present.
# The source lives in the ase-os-website companion repository.
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEBSITE="$ROOT/website"

# Load shared utilities (provides load_env, step, fail, ok, info)
# shellcheck source=scripts/lib/common.sh
source "$ROOT/scripts/lib/common.sh"

# Load .env for WEBSITE_PORT
load_env "$ROOT/.env"

# Use WEBSITE_PORT from env (default: 3000)
PORT="${WEBSITE_PORT:-3000}"

# ── Guard: website source must be present ─────────────────────────────────────
if [[ ! -f "$WEBSITE/package.json" ]]; then
  fail "Website source not found at $WEBSITE/package.json"
  echo
  echo "  The website source lives in a separate repository (ase-os-website)."
  echo "  Clone it into the website/ directory, then run this command again."
  echo
  echo "  Alternatively, run 'make sync' to update website/data/ and deploy"
  echo "  the website through Vercel instead of running it locally."
  exit 1
fi

step "Stopping any process on port $PORT..."
if command -v lsof &>/dev/null; then
  # Graceful SIGTERM first, then SIGKILL after 1s if still running
  lsof -ti "tcp:$PORT" | xargs kill 2>/dev/null || true
  sleep 1
  lsof -ti "tcp:$PORT" | xargs kill -9 2>/dev/null || true
elif command -v fuser &>/dev/null; then
  fuser -k "${PORT}/tcp" 2>/dev/null || true
fi

step "Installing dependencies..."
npm install --prefix "$WEBSITE" --silent

step "Building website..."
npm run build --prefix "$WEBSITE"

step "Starting server on http://localhost:$PORT ..."
npm start --prefix "$WEBSITE" &
SERVER_PID=$!

# Ensure the server process is killed on SIGINT (Ctrl+C) or SIGTERM
trap 'kill "$SERVER_PID" 2>/dev/null; exit' INT TERM

step "Waiting for server to be ready..."
MAX_WAIT=30
ELAPSED=0
until curl -s -o /dev/null "http://localhost:$PORT"; do
  sleep 0.5
  ELAPSED=$((ELAPSED+1))
  if [[ "$ELAPSED" -ge "$((MAX_WAIT * 2))" ]]; then
    fail "Server did not become ready within ${MAX_WAIT}s"
    kill "$SERVER_PID" 2>/dev/null || true
    exit 1
  fi
done

step "Opening browser..."
if command -v xdg-open &>/dev/null; then
  xdg-open "http://localhost:$PORT" 2>/dev/null || true
elif command -v open &>/dev/null; then
  open "http://localhost:$PORT" 2>/dev/null || true
else
  info "Visit http://localhost:$PORT in your browser"
fi

echo
ok "Website running at http://localhost:$PORT (PID: $SERVER_PID)"
echo "  Press Ctrl+C to stop the server."
echo

wait "$SERVER_PID"

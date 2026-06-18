#!/usr/bin/env zsh

# ─────────────────────────────────────────────
# rebuild.sh — Rebuild and open the ASE-OS website
# Usage: ./rebuild.sh
# ─────────────────────────────────────────────

set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
WEBSITE="$ROOT/website"
PORT=3000

echo "→ Killing any process on port $PORT..."
lsof -ti tcp:$PORT | xargs kill -9 2>/dev/null || true

echo "→ Installing dependencies..."
cd "$WEBSITE"
npm install --silent

echo "→ Building website..."
npm run build

echo "→ Starting server on http://localhost:$PORT ..."
npm start &
SERVER_PID=$!

echo "→ Waiting for server to be ready..."
until curl -s -o /dev/null http://localhost:$PORT; do
  sleep 0.5
done

echo "→ Opening browser..."
open "http://localhost:$PORT"

echo ""
echo "Website running at http://localhost:$PORT (PID: $SERVER_PID)"
echo "Press Ctrl+C to stop the server."

wait $SERVER_PID

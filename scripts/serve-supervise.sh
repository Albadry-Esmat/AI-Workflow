#!/usr/bin/env bash
# Phase 3: supervise opencode serve :4096 (health probe + reconnect hint). No auto-install.
set -euo pipefail
if curl -sf --max-time 5 http://localhost:4096/api/health >/dev/null 2>&1 || curl -sf --max-time 5 http://localhost:4096/ >/dev/null 2>&1; then
  echo "PASS: opencode serve :4096 reachable"
else
  echo "WARN: opencode serve :4096 not reachable — run 'aiw start' to launch, then retry"
  exit 1
fi

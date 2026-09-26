#!/usr/bin/env bash
# shadow-hook.sh — OPTIONAL unbiased capture helper (non-invasive).
# Intended: caller may pipe task text; failure must never block legacy path.
# Usage: ./scripts/shadow-hook.sh "<task>" "<files-csv>" || true
# Decision for g0-window-2026-09-26-v1: NOT auto-wired into orchestrator/primary
# (would touch sensitive runtime). Manual runbook retained for this window.
# Missed-observation risk: manual logging may under-sample; mitigated by requiring
# unique-task count + category minimums before G0 (missing tasks delay G0, never fake it).
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
node "$ROOT/scripts/log-shadow-observation.js" "${1:-}" "${2:-}" >/dev/null 2>&1 || echo "WARN: shadow log failed (non-blocking, legacy path unaffected)" >&2
exit 0

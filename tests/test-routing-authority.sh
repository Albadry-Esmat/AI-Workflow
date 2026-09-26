#!/usr/bin/env bash
# test-routing-authority.sh — SAFE regression: authority declaration + reporter exist and behave.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
fail() { echo "FAIL: $1" >&2; exit 1; }
pass() { echo "PASS: $1"; }
[ -f "$ROOT/docs/routing-authority.md" ] || fail "docs/routing-authority.md missing"
grep -q "Sole execution authority" "$ROOT/docs/routing-authority.md" || fail "authority declaration missing"
grep -q "NOT activated" "$ROOT/docs/routing-authority.md" || fail "P2 non-activation note missing"
[ -f "$ROOT/scripts/check-routing-consistency.js" ] || fail "check-routing-consistency.js missing"
OUT="$(node "$ROOT/scripts/check-routing-consistency.js" 2>&1)" || fail "consistency reporter exited non-zero (must exit 0 report-only)"
echo "$OUT" | grep -q "authority:" || fail "reporter output missing authority line"
echo "$OUT" | grep -q "exit 0" || fail "reporter must declare report-only exit 0"
grep -q "FLAG_ADAPTIVE_ROUTER" "$ROOT/config/adaptive-flags.json" || fail "flags file unreadable"
node -e "const f=require('$ROOT/config/adaptive-flags.json'); if(f.flags.FLAG_FLOOR_ENFORCE.default!==false) throw new Error('FLOOR_ENFORCE must stay false'); if(f.flags.FLAG_ADAPTIVE_ROUTER.default!==false) throw new Error('ADAPTIVE_ROUTER must stay false')" || fail "execution flags changed (must stay false)"
pass "routing authority SAFE files + frozen flags hold"

#!/usr/bin/env bash
# test-specs-structure.sh — SAFE regression: specs/ proposal structure present, nothing wired.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
fail() { echo "FAIL: $1" >&2; exit 1; }
pass() { echo "PASS: $1"; }
[ -f "$ROOT/specs/README.md" ] || fail "specs/README.md missing"
for f in spec.md plan.md tasks.md decisions.md progress.md verification.md review.md completion.md; do
  [ -f "$ROOT/specs/TEMPLATE/$f" ] || fail "specs/TEMPLATE/$f missing"
done
grep -q "req_ids" "$ROOT/specs/TEMPLATE/tasks.md" || fail "tasks.md must mandate req_ids column"
grep -q "Append-only" "$ROOT/specs/TEMPLATE/progress.md" || fail "progress.md must be append-only"
grep -q "work-items/.*[Ii]ntake" "$ROOT/specs/README.md" || fail "README must declare work-items=intake"
grep -q "Authoritative" "$ROOT/specs/README.md" || fail "README must declare specs=authoritative"
[ -f "$ROOT/config/token-budget.json" ] || fail "config/token-budget.json proposal missing"
node -e "JSON.parse(require('fs').readFileSync('$ROOT/config/token-budget.json','utf8'))" || fail "token-budget.json invalid JSON"
# Prove unwired: no existing runtime file may reference token-budget.json yet
if grep -rql "token-budget.json" "$ROOT/scripts" "$ROOT/.opencode/skills" 2>/dev/null | grep -v check-routing; then
  # allow only this test + plan docs to mention it
  REFS="$(grep -rll "token-budget.json" "$ROOT/scripts" "$ROOT/.opencode/skills" 2>/dev/null || true)"
  [ -z "$REFS" ] || fail "token-budget.json must stay unwired (found refs: $REFS)"
fi
pass "specs TEMPLATE (8 files) + README + unwired token proposal hold"

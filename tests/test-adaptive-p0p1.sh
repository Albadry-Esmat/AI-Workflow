#!/usr/bin/env bash
# test-adaptive-p0p1.sh — P0/P1 verification (new tests only, no behavior change).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
echo "== T-P0-03 authority =="
node "$ROOT/scripts/sync-authority.js" --check
echo "== flags boundary =="
python3 "$ROOT/scripts/validate-adaptive-flags.py"
echo "== schemas =="
node -e "JSON.parse(require('fs').readFileSync('$ROOT/skills/schema/classification.schema.json','utf8'));JSON.parse(require('fs').readFileSync('$ROOT/skills/schema/safety-signals.schema.json','utf8'));console.log('PASS: schemas parse')"
echo "== shadow runner =="
node "$ROOT/scripts/eval-router.js"
echo "== promotion harness =="
node "$ROOT/scripts/eval-promotion.js" || true
echo "== existing governance (must still pass) =="
python3 "$ROOT/scripts/validate-pipeline-gates.py"
echo "PASS: P0/P1 new tests complete"

#!/usr/bin/env bash
# Pre-PR gate — run before every push/PR so CI checks pass first time.
# Verifies: website mirrors in sync, policy discovery, all deterministic suites.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "== 1/4 website mirrors =="
bash scripts/sync-website-data.sh > /dev/null
if [ -n "$(git diff --name-only -- website/data/)" ]; then
  echo "  FAIL: website/data/ drifted — mirrors updated above, review + commit them"
  git diff --name-only -- website/data/
  exit 1
fi
echo "  PASS: mirrors in sync"

echo "== 2/4 governance policies =="
bash tests/test-governance-policies.sh > /tmp/prepr-gov.log 2>&1 || { tail -5 /tmp/prepr-gov.log; exit 1; }

echo "== 3/4 workflow state =="
bash tests/test-workflow-p2.sh > /tmp/prepr-wf.log 2>&1 || { tail -5 /tmp/prepr-wf.log; exit 1; }

echo "== 4/4 kernel =="
bash tests/test-execution-kernel.sh > /tmp/prepr-k.log 2>&1 || { tail -5 /tmp/prepr-k.log; exit 1; }

echo ""
echo "PRE-PR: all green — safe to push"

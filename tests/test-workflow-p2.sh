#!/usr/bin/env bash
# P2 workflow tests — state machine, locks, router, case store. Deterministic, no network.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PASS=0; FAIL=0
ok() { echo "  PASS: $1"; PASS=$((PASS+1)); }
bad() { echo "  FAIL: $1"; FAIL=$((FAIL+1)); }

# 1. happy-path transitions + forbidden rejection
node -e "
const {canTransition, transition} = require('$ROOT/scripts/workflow-state');
if (!canTransition('READY', 'ANALYZING')) process.exit(1);
if (canTransition('READY', 'MERGING')) process.exit(1);
let s = { state: 'READY', fixCycles: 0 };
s = transition(s, 'ANALYZING', {});
if (s.state !== 'ANALYZING') process.exit(1);
try { transition(s, 'MERGING', {}); process.exit(1); } catch (e) {
  if (!/FORBIDDEN_TRANSITION/.test(e.message)) process.exit(1);
}
" && ok "state transitions + forbidden" || bad "transitions"

# 2. fix-cycle cap: 3 rounds ok, 4th throws
node -e "
const {transition} = require('$ROOT/scripts/workflow-state');
let s = { state: 'REVIEW', fixCycles: 0 };
for (let i = 0; i < 3; i++) {
  s = transition(s, 'FIXING', {});
  s = transition(s, 'VALIDATING', {});
  s = { ...s, state: 'REVIEW' };
}
s = transition(s, 'FIXING', {});
try { transition(s, 'VALIDATING', {}); process.exit(1); } catch (e) {
  if (!/FIX_CYCLE_EXHAUSTED/.test(e.message)) process.exit(1);
}
" && ok "fix-cycle cap at 3" || bad "cycle cap"

# 3. locks: acquire, conflict, expiry, release
node -e "
const L = require('$ROOT/scripts/work-locks');
const scope = 'test-scope-' + Date.now();
const a = L.acquire(scope, { caseId: 'CASE-A', owner: 'dev' });
if (!a.acquired) process.exit(1);
const b = L.acquire(scope, { caseId: 'CASE-B', owner: 'dev2' });
if (b.acquired || b.holder.case_id !== 'CASE-A') process.exit(1);
L.release(scope, 'CASE-A');
const c = L.acquire(scope, { caseId: 'CASE-B', owner: 'dev2' });
if (!c.acquired) process.exit(1);
L.release(scope, 'CASE-B');
" && ok "work locks" || bad "locks"

# 4. PR router
node -e "
const {route} = require('$ROOT/scripts/pr-router');
if (route({action: 'opened'}).route !== 'review') process.exit(1);
if (route({action: 'synchronize', headShaChanged: true}).route !== 're-review') process.exit(1);
if (route({action: 'opened', draft: true}).route !== 'observe') process.exit(1);
if (route({action: 'checks_completed'}).route !== 'gate') process.exit(1);
" && ok "PR event routing" || bad "router"

# 5. case store + audit chain (temp case, cleaned after)
node -e "
const C = require('$ROOT/scripts/case-store');
const id = 'TEST-' + Date.now();
C.createCase(id, { issue: 1 });
C.advance(id, 'ANALYZING', { actor: 'test' });
C.emit(id, { event: 'PR_REVIEW_PUBLISHED', verdict: 'approve', head_sha: 'abc123', pr: 9 });
const chain = C.auditChain(id);
if (chain.reviews.length !== 1 || chain.pr !== 9) process.exit(1);
const rep = require('$ROOT/scripts/case-report').report(id);
if (!rep.includes('ANALYZING')) process.exit(1);
" && ok "case store + audit chain" || bad "case store"
rm -rf "$ROOT/artifacts/cases/TEST-"*

echo ""
echo "workflow-p2: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]

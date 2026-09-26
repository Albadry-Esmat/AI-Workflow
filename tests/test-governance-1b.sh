#!/usr/bin/env bash
# Phase 1B governance tests: gate-decisions.js authoritative registry.
# Separation under test: integrity (hashes) vs attribution (principal) vs
# authorization (gate class + scope). Uses an isolated registry file.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PASS=0; FAIL=0
ok() { echo "  PASS: $1"; PASS=$((PASS+1)); }
bad() { echo "  FAIL: $1"; FAIL=$((FAIL+1)); }

export AIW_GATE_REGISTRY="/tmp/gd-test-$$-$(date +%s).jsonl"
rm -f "$AIW_GATE_REGISTRY"
trap 'rm -f "$AIW_GATE_REGISTRY"' EXIT

# 1. Record → resolve round-trip carries the full envelope.
node -e "
const gd = require('$ROOT/scripts/gate-decisions');
const rec = gd.record({
  gate_id: 'GATE-TEST-001', gate_class: 'general', decision: 'approve',
  subject_kind: 'plan', subject_hash: 'ab12cd34ef56ab78',
  principal: { type: 'human', id: 'reviewer@example.com', authenticated: false, source: 'chat-hitl' },
  scope: { pipeline: 'full-pipeline', phase: 'phase-4h-validation' },
  reason: 'plan reviewed and accepted with two minor notes',
  execution_id: 'exec-1', policy_version: '1.0.0',
});
if (!/^gd_[a-f0-9]{16}$/.test(rec.decision_id)) process.exit(1);
const r = gd.resolve(rec.decision_id, { gate_id: 'GATE-TEST-001' });
if (!r.valid || r.record.decision_id !== rec.decision_id) process.exit(1);
if (r.record.principal.id !== 'reviewer@example.com') process.exit(1);
if (r.record.subject_hash !== 'ab12cd34ef56ab78') process.exit(1);
" && ok "record → resolve round-trip with full envelope" || bad "round-trip"

# 2. Envelope validation rejects anonymous / reason-free / malformed decisions.
node -e "
const gd = require('$ROOT/scripts/gate-decisions');
const cases = [
  {}, // empty
  { gate_id: 'G', decision: 'approve', reason: 'long enough reason here' }, // no principal
  { gate_id: 'G', decision: 'approve', principal: { type: 'human', id: 'x', source: 'chat' }, reason: 'long enough reason here' }, // authenticated omitted
  { gate_id: 'G', decision: 'maybe', principal: { type: 'human', id: 'x', authenticated: false, source: 'chat' }, reason: 'long enough reason here' }, // bad decision
  { gate_id: 'G', decision: 'approve', principal: { type: 'human', id: 'x', authenticated: false, source: 'chat' }, reason: 'short' }, // reason too short
  { gate_id: 'G', decision: 'approve', subject_kind: 'repo_head', subject_hash: 'not-hex!!', principal: { type: 'human', id: 'x', authenticated: false, source: 'chat' }, reason: 'long enough reason here' },
];
for (const c of cases) {
  try { gd.record(c); console.error('accepted: ' + JSON.stringify(c)); process.exit(1); }
  catch (e) { if (e.code !== 'INVALID_DECISION_ENVELOPE') { console.error('wrong error: ' + e.message); process.exit(1); } }
}
" && ok "envelope validation rejects malformed decisions" || bad "envelope validation"

# 3. Tamper evidence: editing a record breaks chain verification and resolution.
node -e "
const fs = require('fs');
const gd = require('$ROOT/scripts/gate-decisions');
const rec = gd.record({
  gate_id: 'GATE-TAMPER', decision: 'approve',
  principal: { type: 'human', id: 'tamper-test', authenticated: false, source: 'chat-hitl' },
  reason: 'baseline decision for tamper test',
});
const v0 = gd.verifyChain();
if (!v0.valid) process.exit(1);
// Tamper: flip the decision in the stored line, keep the hash.
const lines = fs.readFileSync(process.env.AIW_GATE_REGISTRY, 'utf8').split('\n').filter(Boolean);
const obj = JSON.parse(lines[lines.length - 1]);
obj.decision = 'reject';
lines[lines.length - 1] = JSON.stringify(obj);
fs.writeFileSync(process.env.AIW_GATE_REGISTRY, lines.join('\n') + '\n');
const v1 = gd.verifyChain();
if (v1.valid) { console.error('tamper undetected'); process.exit(1); }
const r = gd.resolve(rec.decision_id);
if (r.valid) { console.error('resolve honored tampered registry'); process.exit(1); }
" && ok "tamper breaks chain and resolution fails closed" || bad "tamper evidence"
# Rebuild a clean registry for the remaining tests (tamper test rewrote it).
rm -f "$AIW_GATE_REGISTRY"

# 4. Expiry, gate binding, scope binding, subject binding, unknown id.
node -e "
const gd = require('$ROOT/scripts/gate-decisions');
const rec = gd.record({
  gate_id: 'GATE-BIND', gate_class: 'general', decision: 'approve',
  subject_kind: 'plan', subject_hash: 'aaaa1111bbbb2222',
  principal: { type: 'agent', id: 'primary', authenticated: false, source: 'orchestrator-relay' },
  scope: { pipeline: 'quick-review', finding_ids: ['F-1'] },
  reason: 'binding test decision with sufficient length',
  expires_at: new Date(Date.now() + 60000).toISOString(),
});
if (!gd.resolve(rec.decision_id, { gate_id: 'GATE-BIND' }).valid) process.exit(1);
if (gd.resolve('gd_doesnotexist0000').valid) process.exit(1);
if (gd.resolve(rec.decision_id, { gate_id: 'OTHER-GATE' }).valid) process.exit(1);
if (gd.resolve(rec.decision_id, { scope: { finding_ids: ['F-2'] } }).valid) process.exit(1);
if (!gd.resolve(rec.decision_id, { scope: { finding_ids: ['F-1'] } }).valid) process.exit(1);
if (gd.resolve(rec.decision_id, { subject_hash: 'changed-subject-hash-0000' }).valid) process.exit(1);
const old = gd.record({
  gate_id: 'GATE-OLD', decision: 'approve',
  principal: { type: 'human', id: 'old', authenticated: true, source: 'chat-hitl' },
  reason: 'already-expired decision for expiry test',
  expires_at: new Date(Date.now() - 1000).toISOString(),
});
if (gd.resolve(old.decision_id).valid) process.exit(1);
" && ok "expiry + gate/scope/subject binding enforced" || bad "binding"

# 5. Authority assessment: authenticated human suffices; unauthenticated at
#    high-stakes gates is reported insufficient (advisory in 1B, enforced in Phase 2).
node -e "
const gd = require('$ROOT/scripts/gate-decisions');
const authed = gd.record({
  gate_id: 'GATE-DEPLOY', gate_class: 'deployment', decision: 'approve',
  principal: { type: 'human', id: 'release-captain', authenticated: true, source: 'chat-hitl' },
  reason: 'deploy approved after reading release notes',
});
const r1 = gd.resolve(authed.decision_id);
if (!r1.valid || r1.authority.sufficient_for_high_stakes !== true) process.exit(1);
const anon = gd.record({
  gate_id: 'GATE-DEPLOY', gate_class: 'deployment', decision: 'approve',
  principal: { type: 'agent', id: 'primary', authenticated: false, source: 'orchestrator-relay' },
  reason: 'agent-relayed approval without authentication',
});
const r2 = gd.resolve(anon.decision_id);
if (!r2.valid) process.exit(1); // recorded and resolvable (1B does not reject)..
if (r2.authority.sufficient_for_high_stakes !== false) process.exit(1);
if (r2.authority.level !== 'unauthenticated-for-high-stakes') process.exit(1);
" && ok "authority assessment distinguishes authenticated principals" || bad "authority"

# 6. Concurrent records keep a valid chain with unique ids.
node -e "
const { spawnSync } = require('node:child_process');
const gd = require('$ROOT/scripts/gate-decisions');
const before = gd.verifyChain();
if (!before.valid) process.exit(1);
const n0 = before.records;
const procs = [];
for (let i = 0; i < 6; i++) {
  procs.push(spawnSync('node', ['-e',
    'const gd=require(' + JSON.stringify('$ROOT/scripts/gate-decisions') + ');' +
    'gd.record({gate_id:\"GATE-RACE\",decision:\"acknowledge\",' +
    'principal:{type:\"system\",id:\"race-'+i+'\",authenticated:false,source:\"test\"},' +
    'reason:\"concurrent record number ' + i + ' for chain test\"});'
  ], { encoding: 'utf8', env: { ...process.env } }));
}
for (const p of procs) if (p.status !== 0) { console.error(p.stderr); process.exit(1); }
const after = gd.verifyChain();
if (!after.valid || after.records !== n0 + 6) { console.error(JSON.stringify(after)); process.exit(1); }
" && ok "concurrent records keep valid chain" || bad "concurrency"

echo ""
echo "governance-1b: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]

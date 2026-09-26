#!/usr/bin/env bash
# Phase 3 governance tests: SHA binding (G-5), evidence schema (G-10),
# HEAD-bound cache (G-8), release attestation binding.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Abort-safe: strip this suite's fixture marker lines from shared HEAD evidence
# files on ANY exit (success, failure, abort). Prevents test scratch from ever
# influencing authority decisions in later runs.
clean_phase_markers() {
  local H f d
  H=$(git -C "$ROOT" rev-parse HEAD 2>/dev/null) || return 0
  for d in producers reviews; do
    f="$ROOT/.opencode/state/$d/$H.jsonl"
    [ -f "$f" ] || continue
    grep -v "test-fixture-phased" "$f" > "$f.tmp" || true
    mv "$f.tmp" "$f"
    [ -s "$f" ] || rm -f "$f"
  done
}
trap clean_phase_markers EXIT
PASS=0; FAIL=0
ok() { echo "  PASS: $1"; PASS=$((PASS+1)); }
bad() { echo "  FAIL: $1"; FAIL=$((FAIL+1)); }

# 1. Release attestation binds HEAD + benchmark hash + gate decision; wrong --head-sha fails.
HEAD_SHA=$(git -C "$ROOT" rev-parse HEAD)
export AIW_GATE_REGISTRY="/tmp/gd-rel3-$$-$(date +%s).jsonl"
# Model precedence fixtures (catalog + session; no provider auth).
export AIW_AVAILABLE_MODELS="openai/gpt-5.6,openai/gpt-5.4"
export AIW_RUNTIME_MODEL="openai/gpt-5.6"
TREL3="test-rel3-$RANDOM"
node -e "
const pe=require('$ROOT/scripts/producer-evidence');
const re=require('$ROOT/scripts/review-evidence');
const id=require('$ROOT/scripts/execution-identity');
pe.record({agentIdentity:id.createLauncherIdentity({agent:'builder',executionId:'$TREL3-producer',source:'test-fixture-phased'}),subjectHash:'$HEAD_SHA',outcome:'completed',sourceRef:'$TREL3-producer'});
re.record({reviewerIdentity:id.createLauncherIdentity({agent:'reviewer',executionId:'$TREL3-review',source:'test-fixture-phased'}),subjectHash:'$HEAD_SHA',executionId:'$TREL3-review',outcome:'approve',reason:'gov3 fixture review'});
" > /dev/null || { bad "release fixture evidence"; }
REL3_DID=$(node -e "
const gd = require('$ROOT/scripts/gate-decisions');
const rec = gd.record({ gate_id: 'release', gate_class: 'release', decision: 'approve', subject_kind: 'repo_head', subject_hash: '$HEAD_SHA', principal: { type: 'human', id: 'test-releaser', authenticated: true, source: 'test-fixture' }, scope: {}, reason: 'gov3 fixture release decision', execution_id: '$TREL3', policy_version: '1.1.0' });
console.log(rec.decision_id);
")
if node "$ROOT/scripts/release-review.js" --yes --decision-id "$REL3_DID" --thread "$TREL3" --bench-out /tmp/rel3-bench.json > /tmp/rel3-out.json 2>&1; then
  node -e "
  const a = require('/tmp/rel3-out.json');
  if (a.repo_head_sha !== '$HEAD_SHA') process.exit(1);
  if (!/^[a-f0-9]{64}$/.test(a.benchmark_sha256)) process.exit(1);
  if (a.policy_version !== '1.1.0') process.exit(1);
  if (a.decision_id !== '$REL3_DID' || a.gate_id !== 'release' || a.subject_hash !== '$HEAD_SHA') process.exit(1);
  if (a.execution_id !== '$TREL3') process.exit(1);
  if (!a.authorizing_principal || a.authorizing_principal.id !== 'test-releaser') process.exit(1);
  if (!a.requesting_principal || a.requesting_principal.id !== 'reviewer') process.exit(1);
  if (!a.consumed_at) process.exit(1);
  if (!Array.isArray(a.producer_principals) || !a.producer_principals.some((p) => p.id === 'builder')) process.exit(1);
  if (!a.reviewer_principal || a.reviewer_principal.id !== 'reviewer') process.exit(1);
  if (!Array.isArray(a.sod_codes)) process.exit(1);
  const fs = require('fs');
  const crypto = require('crypto');
  const raw = fs.readFileSync('/tmp/rel3-bench.json');
  if (crypto.createHash('sha256').update(raw).digest('hex') !== a.benchmark_sha256) process.exit(1);
  const bench = JSON.parse(raw);
  if (bench.repo_head_sha !== '$HEAD_SHA') process.exit(1);
  " && ok "attestation binds HEAD + benchmark hash + decision" || bad "attestation binding"
else
  bad "release-review run"; cat /tmp/rel3-out.json
fi
if node "$ROOT/scripts/release-review.js" --yes --thread "test-rel3x-$RANDOM" --bench-out /tmp/rel3x-bench.json --head-sha deadbeefdeadbeefdeadbeefdeadbeefdeadbeef > /dev/null 2>&1; then
  bad "stale --head-sha not rejected"
else
  ok "stale --head-sha rejected"
fi
node -e "
const fs=require('fs');
for (const d of ['producers','reviews']) {
  const p='$ROOT/.opencode/state/'+d+'/$HEAD_SHA.jsonl';
  if (!fs.existsSync(p)) continue;
  const lines=fs.readFileSync(p,'utf8').split('\n').filter(Boolean).filter((l)=>!l.includes('test-fixture-phased'));
  fs.writeFileSync(p,lines.join('\n')+(lines.length?'\n':''));
}
" > /dev/null 2>&1 || true
rm -f "$AIW_GATE_REGISTRY"; unset AIW_GATE_REGISTRY

# 2. Governance decision schema: release-class requires evidence; pass forbids blocking findings.
node -e "
const Ajv = require('$ROOT/node_modules/ajv');
const addFormats = require('$ROOT/node_modules/ajv-formats');
const ajv = new Ajv({ strict: true }); addFormats(ajv);
const v = ajv.compile(require('$ROOT/config/governance-decision-schema.json'));
const base = { gate_id: 'G', decided_at: new Date().toISOString() };
const rel = { ...base, gate_class: 'release', subject_kind: 'repo_head', subject_hash: 'ab12',
  decision: 'pass', decision_reason: 'all green',
  tests_run: ['kernel'], test_results: { passed: 8, failed: 0 },
  blocking_findings: [], policy_checks: [{ policy: 'p', version: '1', result: 'pass' }] };
const relBare = { gate_id: 'G', gate_class: 'release', subject_kind: 'repo_head', decision: 'pass', decision_reason: 'trust me', decided_at: new Date().toISOString() };
const passBlocked = { ...rel, blocking_findings: [{ id: 'F-1' }] };
const general = { gate_id: 'G', gate_class: 'general', subject_kind: 'finding_set', decision: 'warn', decision_reason: 'noted', decided_at: new Date().toISOString() };
if (!v(rel)) process.exit(1);
if (v(relBare)) process.exit(1);
if (v(passBlocked)) process.exit(1);
if (!v(general)) process.exit(1);
" && ok "evidence schema enforces release evidence" || bad "evidence schema"

# 3. Guards reference the canonical evidence schema (no second verdict format).
for g in security-guard implementation-completeness-guard cross-artifact-consistency database-guard; do
  : # envelope conformance is asserted structurally below in one pass
done
node -e "
const fs = require('fs');
const must = ['verdict', 'blocking_findings'];
for (const g of ['security-guard', 'implementation-completeness-guard', 'cross-artifact-consistency', 'database-guard']) {
  const s = fs.readFileSync('$ROOT/.opencode/skills/' + g + '/SKILL.md', 'utf8');
  for (const k of must) if (!s.includes(k)) { console.error(g + ' lacks ' + k); process.exit(1); }
  if (!s.includes('override_decision_id')) { console.error(g + ' lacks decision-id override'); process.exit(1); }
}
" && ok "guards carry verdict + blocking findings + decision ids" || bad "guard envelope"

# 4. Invocation cache: HEAD-bound keys, staleness, gate-evidence eligibility.
node -e "
const ic = require('$ROOT/scripts/invocation-cache');
const store = new Map();
const input = { foo: 'bar' };
const k1 = ic.key('reviewer', input, 'aaa111');
const k2 = ic.key('reviewer', input, 'bbb222');
const k3 = ic.key('reviewer', input, 'aaa111');
if (k1 === k2) process.exit(1); // HEAD move must miss
if (k1 !== k3) process.exit(1); // same HEAD must hit deterministically
if (ic.lookup(store, k1).hit) process.exit(1);
ic.storeResult(store, k1, { output: { v: 1 }, headSha: 'aaa111', skill: 'reviewer' });
const h = ic.lookup(store, k1);
if (!h.hit || !h.entry.cache_hit) process.exit(1);
if (ic.eligibleAsGateEvidence(h.entry, 'aaa111').eligible) process.exit(1); // hits never sole evidence
const fresh = { cache_hit: false, head_sha: 'aaa111', head_unbound: false };
if (!ic.eligibleAsGateEvidence(fresh, 'aaa111').eligible) process.exit(1);
if (ic.eligibleAsGateEvidence(fresh, 'bbb222').eligible) process.exit(1); // stale HEAD
const unbound = { cache_hit: false, head_sha: null, head_unbound: true };
if (ic.eligibleAsGateEvidence(unbound, 'aaa111').eligible) process.exit(1);
const kn = ic.key('reviewer', input, null);
ic.storeResult(store, kn, { output: { v: 1 }, headSha: null });
if (ic.lookup(store, kn).entry.head_unbound !== true) process.exit(1);
" && ok "HEAD-bound cache with gate-evidence rules" || bad "invocation cache"

# 5. Trace envelope carries identity/gate/subject/execution fields and validates.
node -e "
const tr = require('$ROOT/scripts/trace-envelope');
const Ajv = require('$ROOT/node_modules/ajv');
const addFormats = require('$ROOT/node_modules/ajv-formats');
const ajv = new Ajv({ strict: true }); addFormats(ajv);
const schema = require('$ROOT/config/trace-envelope-schema.json');
const rec = tr.writeTrace('test-g3-' + Date.now(), {
  model: 'github-copilot/claude-sonnet-4.6', model_id: 'github-copilot/claude-sonnet-4.6',
  agent_identity: { agent: 'reviewer' }, gate_id: 'GATE-003',
  subject_hash: 'ab12cd34', execution_id: 'exec-9',
  tool_calls: [], guardrail: 'allow',
});
if (rec.agent_identity.agent !== 'reviewer' || rec.gate_id !== 'GATE-003') process.exit(1);
if (!ajv.compile(schema)(rec)) process.exit(1);
" && ok "trace identity/gate/subject fields validate" || bad "trace fields"

# 6. Merge-gate audit location fixed (no location-less audit claims).
if grep -q "artifacts/merge-gate-audit.jsonl" "$ROOT/.opencode/skills/github-merge-gate/SKILL.md"; then
  ok "merge audit location fixed"
else
  bad "merge audit location"
fi

echo ""
echo "governance-3: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]

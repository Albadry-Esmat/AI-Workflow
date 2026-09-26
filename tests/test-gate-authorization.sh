#!/usr/bin/env bash
# Phase B — gate-decision authorization regression suite.
# Isolated registry per run (AIW_GATE_REGISTRY); programmatic minting below is
# test-fixture only and never a production path (production has no minting CLI
# by design — high-stakes paths fail closed without a real decision).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PASS=0; FAIL=0
ok() { echo "  PASS: $1"; PASS=$((PASS+1)); }
bad() { echo "  FAIL: $1"; FAIL=$((FAIL+1)); }
export AIW_GATE_REGISTRY="/tmp/gd-phaseb-$$-$(date +%s).jsonl"
rm -f "$AIW_GATE_REGISTRY"
# Model precedence fixtures (catalog + session; no provider auth).
export AIW_AVAILABLE_MODELS="openai/gpt-5.6,openai/gpt-5.4"
export AIW_RUNTIME_MODEL="openai/gpt-5.6"
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
trap 'clean_phase_markers; rm -f "$AIW_GATE_REGISTRY"' EXIT

MINT='const gd = require(process.env.AIWX_ROOT + "/scripts/gate-decisions");'
export AIWX_ROOT="$ROOT"
mint() {
  # mint <gate_id> <gate_class> <decision> <subject_kind> <subject_hash> <ptype> <pid> <auth> <exec> [reason]
  node -e "$MINT const rec = gd.record({ gate_id: '$1', gate_class: '$2', decision: '$3', subject_kind: '$4', subject_hash: '$5', principal: { type: '$6', id: '$7', authenticated: $8, source: 'test-fixture' }, scope: {}, reason: '${10:-phase-b fixture decision}', execution_id: '$9', policy_version: '1.0.0' }); console.log(rec.decision_id);"
}
consume() {
  # consume <decision-id> <gate-id> <gate-class> <action> <subject> <exec>
  node -e "const g = require('$ROOT/scripts/require-gate-decision'); const r = g.requireGateDecision({ decisionId: '$1', gateId: '$2', gateClass: '$3', action: '$4', subjectHash: '$5', subjectKind: 'repo_head', executionId: '$6' }); console.log(JSON.stringify({ ok: true, consumed: r.consumption.consumed_at }));"
}

HEAD_SHA=$(git -C "$ROOT" rev-parse HEAD)

# ── Decision resolution ─────────────────────────────────────────────────
D_OK=$(mint release release approve repo_head "$HEAD_SHA" human alice true exec-ok)
consume "$D_OK" release release release-attest "$HEAD_SHA" exec-ok > /dev/null \
  && ok "valid decision authorizes" || bad "valid decision"
node -e "const g=require('$ROOT/scripts/require-gate-decision'); try{g.requireGateDecision({decisionId:'',gateId:'release',gateClass:'release',action:'a',subjectHash:'$HEAD_SHA',subjectKind:'repo_head',executionId:'e'});process.exit(1);}catch(e){if(e.code!=='GATE_DECISION_BLOCKED')process.exit(1);}" \
  && ok "missing decision fails" || bad "missing decision"
node -e "const g=require('$ROOT/scripts/require-gate-decision'); try{g.requireGateDecision({decisionId:'gd_0000000000000000',gateId:'release',gateClass:'release',action:'a',subjectHash:'$HEAD_SHA',subjectKind:'repo_head',executionId:'e'});process.exit(1);}catch(e){if(!/unknown decision_id/.test(e.message))process.exit(1);}" \
  && ok "unknown decision fails" || bad "unknown decision"
D_EXP=$(node -e "$MINT const rec = gd.record({ gate_id: 'release', gate_class: 'release', decision: 'approve', subject_kind: 'repo_head', subject_hash: '$HEAD_SHA', principal: { type: 'human', id: 'alice', authenticated: true, source: 'test-fixture' }, scope: {}, reason: 'expired fixture decision', execution_id: 'exec-exp', policy_version: '1.0.0', expires_at: '2000-01-01T00:00:00.000Z' }); console.log(rec.decision_id);")
consume "$D_EXP" release release release-attest "$HEAD_SHA" exec-exp > /dev/null 2>&1 \
  && bad "expired decision authorized" || ok "expired decision fails"

# ── Subject binding ─────────────────────────────────────────────────────
D_SUB=$(mint release release approve repo_head "$HEAD_SHA" human alice true exec-sub)
consume "$D_SUB" release release release-attest deadbeefdeadbeefdeadbeefdeadbeefdeadbeef exec-sub > /dev/null 2>&1 \
  && bad "wrong subject authorized" || ok "wrong subject fails"
D_STALE_OK=$(mint release release approve repo_head "$HEAD_SHA" human alice true exec-sub2)
consume "$D_STALE_OK" release release release-attest "$HEAD_SHA" exec-sub2 > /dev/null \
  && ok "exact subject passes" || bad "exact subject"

# ── Execution binding ───────────────────────────────────────────────────
D_EXE=$(mint release release approve repo_head "$HEAD_SHA" human alice true exec-a)
consume "$D_EXE" release release release-attest "$HEAD_SHA" exec-b > /dev/null 2>&1 \
  && bad "different execution authorized" || ok "different execution fails"

# ── Authority ───────────────────────────────────────────────────────────
D_UNAUTH=$(mint release release approve repo_head "$HEAD_SHA" human mallory false exec-unauth)
consume "$D_UNAUTH" release release release-attest "$HEAD_SHA" exec-unauth > /dev/null 2>&1 \
  && bad "unauthenticated human authorized release" || ok "unauthenticated human fails release gate"
D_CLAIM=$(mint general general approve repo_head "$HEAD_SHA" human mallory false exec-claim)
consume "$D_CLAIM" general general general-action "$HEAD_SHA" exec-claim > /dev/null \
  && ok "non-high-stakes class allows claimed principal (audit-recorded)" || bad "general class"
# role:null gains nothing: authority is principal-based; unauthenticated still fails high-stakes.
node -e "
const id=require('$ROOT/scripts/execution-identity');
const e=id.createLauncherIdentity({agent:'sre',executionId:'e',source:'s'});
if(e.role!==null)process.exit(1);
" && ok "role:null preserved (no privilege inferred)" || bad "role null"

# ── Class / kind ────────────────────────────────────────────────────────
D_CLS=$(mint general general approve repo_head "$HEAD_SHA" human alice true exec-cls)
consume "$D_CLS" release release release-attest "$HEAD_SHA" exec-cls > /dev/null 2>&1 \
  && bad "wrong decision class authorized" || ok "wrong decision class fails"
D_REJ=$(mint release release reject repo_head "$HEAD_SHA" human alice true exec-rej)
consume "$D_REJ" release release release-attest "$HEAD_SHA" exec-rej > /dev/null 2>&1 \
  && bad "reject decision authorized" || ok "non-approve decision fails"

# ── Replay / consumption ────────────────────────────────────────────────
D_RPL=$(mint release release approve repo_head "$HEAD_SHA" human alice true exec-rpl)
consume "$D_RPL" release release release-attest "$HEAD_SHA" exec-rpl > /dev/null \
  || { bad "first consumption"; }
consume "$D_RPL" release release release-attest "$HEAD_SHA" exec-rpl > /dev/null 2>&1 \
  && bad "replay authorized" || ok "consumed decision cannot be replayed"

# ── Override API ────────────────────────────────────────────────────────
# Raw resolveOverride is the read-only/audit API (principal authority only).
# Override ACCEPTANCE goes through requireGateDecision, which additionally
# enforces class match + single-use consumption.
D_OVR=$(mint governance-change governance-change approve policy ab12cd34ef56ab78 human alice true exec-ovr)
AIW_GATE_REGISTRY="$AIW_GATE_REGISTRY" node scripts/resolve-override.js --decision-id "$D_OVR" --gate-id governance-change --gate-class governance-change > /dev/null 2>&1 \
  && ok "valid override resolves (audit API)" || bad "override resolve"
node -e "
const g=require('$ROOT/scripts/require-gate-decision');
const r=g.requireGateDecision({decisionId:'$D_OVR',gateId:'governance-change',gateClass:'governance-change',action:'override:scope',subjectHash:'ab12cd34ef56ab78',subjectKind:'policy',executionId:'exec-ovr'});
if(!r.record||!r.consumption)process.exit(1);
try{g.requireGateDecision({decisionId:'$D_OVR',gateId:'governance-change',gateClass:'governance-change',action:'override:scope',subjectHash:'ab12cd34ef56ab78',subjectKind:'policy',executionId:'exec-ovr'});process.exit(1);}catch(e){if(e.reason!=='already-consumed')process.exit(1);}
" && ok "override acceptance consumes (no replay)" || bad "override acceptance"
D_ORD=$(mint general general approve repo_head "$HEAD_SHA" human alice true exec-ord)
node -e "
const g=require('$ROOT/scripts/require-gate-decision');
// gate binding fires before class check ...
try{g.requireGateDecision({decisionId:'$D_ORD',gateId:'governance-change',gateClass:'governance-change',action:'override:scope',subjectHash:'$HEAD_SHA',subjectKind:'repo_head',executionId:'exec-ord'});process.exit(1);}catch(e){if(e.reason!=='decision-invalid')process.exit(1);}
// ... and class mismatch fires when the gate itself matches.
try{g.requireGateDecision({decisionId:'$D_ORD',gateId:'general',gateClass:'release',action:'override:scope',subjectHash:'$HEAD_SHA',subjectKind:'repo_head',executionId:'exec-ord'});process.exit(1);}catch(e){if(e.reason!=='decision-class')process.exit(1);}
" && ok "ordinary decision cannot authorize override action" || bad "override class"

# ── §0: consumption scoped per registry file (no cross-repo interference) ──
node -e "
const g=require('$ROOT/scripts/require-gate-decision');
if(g.consumptionsPath()!=='$AIW_GATE_REGISTRY'.replace(/\.jsonl$/,'')+'.consumptions.jsonl')process.exit(1);
" && ok "consumption path scoped to registry file" || bad "consumption scoping"
RA="/tmp/gd-scope-a-$$-$(date +%s).jsonl"; RB="/tmp/gd-scope-b-$$-$(date +%s).jsonl"
DA=$(AIW_GATE_REGISTRY="$RA" node -e "const gd=require('$ROOT/scripts/gate-decisions'); console.log(gd.record({gate_id:'release',gate_class:'release',decision:'approve',subject_kind:'repo_head',subject_hash:'$HEAD_SHA',principal:{type:'human',id:'alice',authenticated:true,source:'test-fixture'},scope:{},reason:'scope fixture A',execution_id:'ex-a',policy_version:'1.0.0'}).decision_id);")
AIW_GATE_REGISTRY="$RA" node -e "require('$ROOT/scripts/require-gate-decision').requireGateDecision({decisionId:'$DA',gateId:'release',gateClass:'release',action:'release-attest',subjectHash:'$HEAD_SHA',subjectKind:'repo_head',executionId:'ex-a'})" > /dev/null \
&& DB=$(AIW_GATE_REGISTRY="$RB" node -e "const gd=require('$ROOT/scripts/gate-decisions'); console.log(gd.record({gate_id:'release',gate_class:'release',decision:'approve',subject_kind:'repo_head',subject_hash:'$HEAD_SHA',principal:{type:'human',id:'alice',authenticated:true,source:'test-fixture'},scope:{},reason:'scope fixture B',execution_id:'ex-b',policy_version:'1.0.0'}).decision_id);") \
&& AIW_GATE_REGISTRY="$RB" node -e "require('$ROOT/scripts/require-gate-decision').requireGateDecision({decisionId:'$DB',gateId:'release',gateClass:'release',action:'release-attest',subjectHash:'$HEAD_SHA',subjectKind:'repo_head',executionId:'ex-b'})" > /dev/null \
&& ok "sibling registries do not share consumption" || bad "consumption isolation"
rm -f "$RA" "$RB" "${RA%.jsonl}.consumptions.jsonl" "${RB%.jsonl}.consumptions.jsonl"

# ── Evidence ────────────────────────────────────────────────────────────
D_EVD=$(mint release release approve repo_head "$HEAD_SHA" human alice true exec-evd)
EVD=$(consume "$D_EVD" release release release-attest "$HEAD_SHA" exec-evd)
node -e "
const g=require('$ROOT/scripts/require-gate-decision');
const r=g.requireGateDecision; void r;
const fs=require('fs');
const cons=fs.readFileSync(require('$ROOT/scripts/require-gate-decision').consumptionsPath(),'utf8').trim().split('\n').map((l)=>JSON.parse(l));
const m=cons.find((c)=>c.decision_id==='$D_EVD');
if(!m||m.consumed_by_execution!=='exec-evd'||m.action!=='release-attest'||!m.consumed_at)process.exit(1);
const gd=require('$ROOT/scripts/gate-decisions');
const rec=gd.resolve('$D_EVD',{}).record;
if(rec.principal.id!=='alice'||rec.subject_hash!=='$HEAD_SHA')process.exit(1);
" && ok "consumption + bindings recorded (no secrets)" || bad "evidence"
if grep -rE "sk-[A-Za-z0-9]{8,}|ghp_[A-Za-z0-9]{8,}|api[_-]?key[\"' ]*[:=]|Bearer [A-Za-z0-9]" "$AIW_GATE_REGISTRY" "$(node -e "console.log(require('$ROOT/scripts/require-gate-decision').consumptionsPath())")" 2>/dev/null | grep -q .; then
  bad "secrets in gate evidence"
else
  ok "no secrets in gate evidence"
fi

# ── release-review CLI ──────────────────────────────────────────────────
# Release attestation requires producer + review evidence for HEAD: mint both
# as fixtures here (self-contained; cleaned below).
TCLI="test-relcli-$RANDOM"
node -e "
const pe=require('$ROOT/scripts/producer-evidence');
const re=require('$ROOT/scripts/review-evidence');
const id=require('$ROOT/scripts/execution-identity');
pe.record({agentIdentity:id.createLauncherIdentity({agent:'builder',executionId:'$TCLI-producer',source:'test-fixture-phased'}),subjectHash:'$HEAD_SHA',outcome:'completed',sourceRef:'$TCLI-producer'});
re.record({reviewerIdentity:id.createLauncherIdentity({agent:'reviewer',executionId:'$TCLI-review',source:'test-fixture-phased'}),subjectHash:'$HEAD_SHA',executionId:'$TCLI-review',outcome:'approve',reason:'gate-auth fixture review'});
" > /dev/null || { bad "release fixture evidence"; }
D_CLI=$(mint release release approve repo_head "$HEAD_SHA" human alice true "$TCLI")
node "$ROOT/scripts/release-review.js" --yes --decision-id "$D_CLI" --thread "$TCLI" --bench-out /tmp/relcli-bench.json > /tmp/relcli-out.json 2>&1 \
  && ok "release-review authorizes with valid decision" || { bad "release CLI"; cat /tmp/relcli-out.json; }
node -e "
const fs=require('fs');
for (const d of ['producers','reviews']) {
  const p='$ROOT/.opencode/state/'+d+'/$HEAD_SHA.jsonl';
  if (!fs.existsSync(p)) continue;
  const lines=fs.readFileSync(p,'utf8').split('\n').filter(Boolean).filter((l)=>!l.includes('test-fixture-phased'));
  fs.writeFileSync(p,lines.join('\n')+(lines.length?'\n':''));
}
" > /dev/null 2>&1 || true
rm -rf "$ROOT/.opencode/state/$TCLI" "$ROOT/.opencode/state/store/$TCLI"

echo ""
echo "gate-authorization: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]

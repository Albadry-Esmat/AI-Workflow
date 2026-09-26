#!/usr/bin/env bash
# Phase D — evidence freshness, producer/review pipeline, retry, promotion, bypass.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PASS=0; FAIL=0
ok() { echo "  PASS: $1"; PASS=$((PASS+1)); }
bad() { echo "  FAIL: $1"; FAIL=$((FAIL+1)); }
export AIW_GATE_REGISTRY="/tmp/gd-phased-$$-$(date +%s).jsonl"
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
trap 'clean_phase_markers; rm -f "$AIW_GATE_REGISTRY" "${AIW_GATE_REGISTRY%.jsonl}.consumptions.jsonl"' EXIT
# Unique synthetic subjects per run (never collide with other runs/residue).
SYN_A=$(node -e "console.log(require('crypto').createHash('sha256').update('syn-a-'+Date.now()+''+process.pid).digest('hex'))")
SYN_B=$(node -e "console.log(require('crypto').createHash('sha256').update('syn-b-'+Date.now()+''+process.pid).digest('hex'))")
cleanup_subject() { # remove fixture lines for a subject file
  for d in producers reviews; do
    f="$ROOT/.opencode/state/$d/$1.jsonl"
    if [ -f "$f" ]; then
      grep -v "test-fixture-phased" "$f" > "$f.tmp" || true
      mv "$f.tmp" "$f"
      [ -s "$f" ] || rm -f "$f"
    fi
  done
  return 0
}

# ── Producer evidence ─────────────────────────────────────────────────
node -e "
const pe=require('$ROOT/scripts/producer-evidence');
const id=require('$ROOT/scripts/execution-identity');
const b=id.createLauncherIdentity({agent:'builder',executionId:'e-b',source:'test-fixture-phased'});
const r=pe.record({agentIdentity:b,subjectHash:'$SYN_A',outcome:'completed',sourceRef:'e-b'});
if(!r.recorded)process.exit(1);
const w=id.createWorkerIdentity({agent:'builder',parentExecutionId:'p',workerIndex:2,source:'test-fixture-phased'});
pe.record({agentIdentity:w,subjectHash:'$SYN_A',outcome:'completed',sourceRef:'p-w2'});
const set=pe.loadForSubject('$SYN_A');
if(set.producers.length!==1||set.producers[0].id!=='builder')process.exit(1);
if(set.entries.length!==2)process.exit(1);
// analyzer role is not a producer role → skipped, never widens the set
const a=id.createLauncherIdentity({agent:'analyzer',executionId:'e-a',source:'test-fixture-phased'});
const s=pe.record({agentIdentity:a,subjectHash:'$SYN_A',outcome:'completed',sourceRef:'e-a'});
if(s.recorded)process.exit(1);
" && ok "producer set (multi-entry, role-filtered, deterministic)" || bad "producer evidence"
node -e "
const pe=require('$ROOT/scripts/producer-evidence');
const id=require('$ROOT/scripts/execution-identity');
const b=id.createLauncherIdentity({agent:'builder',executionId:'e-b',source:'t'});
try{pe.record({agentIdentity:b,subjectHash:'not-hex!!',outcome:'completed'});process.exit(1);}catch(e){if(!/hex/.test(e.message))process.exit(1);}
try{pe.record({agentIdentity:{agent:'builder'},subjectHash:'$SYN_A',outcome:'completed'});process.exit(1);}catch(e){if(!/execution-identity/.test(e.message))process.exit(1);}
" && ok "malformed/unattributed producer rejected" || bad "producer fail-closed"
cleanup_subject "$SYN_A"

# ── Review freshness ──────────────────────────────────────────────────
node -e "
const re=require('$ROOT/scripts/review-evidence');
const id=require('$ROOT/scripts/execution-identity');
const ri=id.createLauncherIdentity({agent:'reviewer',executionId:'e-r',source:'test-fixture-phased'});
re.record({reviewerIdentity:ri,subjectHash:'$SYN_A',executionId:'e-r',outcome:'approve',reason:'looks good'});
const f=require('$ROOT/scripts/evidence-freshness');
if(!f.check('review',re.latestApproval('$SYN_A'),{subjectHash:'$SYN_A'}).fresh)process.exit(1);
const stale=f.check('review',re.latestApproval('$SYN_A'),{subjectHash:'$SYN_B'});
if(stale.fresh||stale.code!=='EVIDENCE_SUBJECT_MISMATCH')process.exit(1);
" && ok "current review fresh, moved subject stale" || bad "review freshness"
cleanup_subject "$SYN_A"

# ── Gate freshness (stale fails before consumption) ───────────────────
GD=$(node -e "const gd=require('$ROOT/scripts/gate-decisions');console.log(gd.record({gate_id:'release',gate_class:'release',decision:'approve',subject_kind:'repo_head',subject_hash:'$SYN_A',principal:{type:'human',id:'alice',authenticated:true,source:'test-fixture'},scope:{},reason:'freshness fixture decision',execution_id:'ex-f',policy_version:'1.0.0'}).decision_id);")
node -e "
const g=require('$ROOT/scripts/require-gate-decision');
const id=require('$ROOT/scripts/execution-identity');
const mk=(a,e)=>id.createLauncherIdentity({agent:a,executionId:e,source:'t'});
try{g.requireGateDecision({decisionId:'$GD',gateId:'release',gateClass:'release',action:'release-attest',subjectHash:'$SYN_B',subjectKind:'repo_head',executionId:'ex-f',
  sod:{producers:[{principal:{type:'agent',id:'builder'},subject_hash:'$SYN_A'}],
    reviewer:{reviewer_identity:mk('reviewer','e-r'),subject_hash:'$SYN_A',execution_id:'e-r',outcome:'approve'},gateRole:'gatekeeper'}});
  process.exit(1);}catch(e){if(e.reason!=='decision-invalid')process.exit(1);}
// unconsumed: same decision authorizes the true subject afterwards
const ok=g.requireGateDecision({decisionId:'$GD',gateId:'release',gateClass:'release',action:'release-attest',subjectHash:'$SYN_A',subjectKind:'repo_head',executionId:'ex-f',
  sod:{producers:[{principal:{type:'agent',id:'builder'},subject_hash:'$SYN_A'}],
    reviewer:{reviewer_identity:mk('reviewer','e-r'),subject_hash:'$SYN_A',execution_id:'e-r',outcome:'approve'},gateRole:'gatekeeper'}});
if(!ok.consumption)process.exit(1);
" && ok "stale gate fails pre-consumption; true subject proceeds" || bad "gate freshness"

# ── SoD release wiring (synthetic subjects) ───────────────────────────
node -e "
const g=require('$ROOT/scripts/require-gate-decision');
const id=require('$ROOT/scripts/execution-identity');
const mk=(a,e)=>id.createLauncherIdentity({agent:a,executionId:e,source:'t'});
const gd=require('$ROOT/scripts/gate-decisions');
const d=gd.record({gate_id:'release',gate_class:'release',decision:'approve',subject_kind:'repo_head',subject_hash:'$SYN_A',principal:{type:'human',id:'gk',authenticated:true,source:'test-fixture'},scope:{},reason:'sod wiring fixture decision',execution_id:'ex-w',policy_version:'1.0.0'}).decision_id;
const base={decisionId:d,gateId:'release',gateClass:'release',action:'release-attest',subjectHash:'$SYN_A',subjectKind:'repo_head',executionId:'ex-w'};
const good={producers:[{principal:{type:'agent',id:'builder'},subject_hash:'$SYN_A'}],
  reviewer:{reviewer_identity:mk('reviewer','e-r'),subject_hash:'$SYN_A',execution_id:'e-r',outcome:'approve'},gateRole:'gatekeeper'};
const failWith=(sod,reason)=>{try{g.requireGateDecision({...base,sod});return false;}catch(e){return e.reason===reason;}};
if(!failWith({...good,reviewer:{reviewer_identity:mk('builder','e-r'),subject_hash:'$SYN_A',execution_id:'e-r',outcome:'approve'}},'sod-violation'))process.exit(1);
" && ok "release SoD blocks producer==reviewer" || bad "sod wiring"

# ── Retry model ───────────────────────────────────────────────────────
node -e "
// bounded budget exists and exhausts (MAX_FIX_CYCLES=3)
const {transition}=require('$ROOT/scripts/workflow-state');
let s={state:'REVIEW',fixCycles:0};
for(let i=0;i<3;i++){s=transition(s,'FIXING',{});s=transition(s,'VALIDATING',{});s={...s,state:'REVIEW'};}
s=transition(s,'FIXING',{});
try{transition(s,'VALIDATING',{});process.exit(1);}catch(e){if(!/FIX_CYCLE_EXHAUSTED/.test(e.message))process.exit(1);}
" && ok "retry budget bounded (3 fix cycles)" || bad "retry budget"
node -e "
// recovery preserves budgets: no reset path (only createCase initializes)
const src=require('fs').readFileSync('$ROOT/scripts/case-store.js','utf8');
// exactly one initializer (createCase); no reset path anywhere
if((src.match(/fixCycles\s*:\s*0/g)||[]).length!==1)process.exit(1);
const C=require('$ROOT/scripts/case-store');
const id='RECTEST-'+Date.now();
C.createCase(id,{});C.advance(id,'ANALYZING',{actor:'t'});
const reread=C.readCase(id);
if(reread.fixCycles!==0||reread.state!=='ANALYZING')process.exit(1);
require('fs').rmSync('$ROOT/artifacts/cases/'+id,{recursive:true,force:true});
" && ok "recovery preserves budgets (no reset path)" || bad "recovery"
if grep -rn "adapter.send\|adapter\.send\|opencode.send" "$ROOT/scripts/aiw-run.js" "$ROOT/scripts/orchestrate-workers.js" | grep -qE "for |while |retry"; then
  bad "unexpected retry loop around dispatch"
else
  ok "no automated retry loops around dispatch (single attempt)"
fi

# ── Bypass ────────────────────────────────────────────────────────────
if grep -l "producer-evidence\|review-evidence\|case-store\|gate-decisions" "$ROOT/scripts/runtime-adapter.js" "$ROOT/scripts/adapter-factory.js" "$ROOT/scripts/codex-adapter.js" 2>/dev/null | grep -q .; then
  bad "adapter can write governance evidence"
else
  ok "adapters cannot create producer/review/promotion evidence"
fi
node -e "
// cross-subject contamination in producer store fails closed (snapshot/restore: no residue)
const fs=require('fs');
const p='$ROOT/.opencode/state/producers/$SYN_A.jsonl';
fs.mkdirSync(require('path').dirname(p),{recursive:true});
const saved=fs.existsSync(p)?fs.readFileSync(p,'utf8'):null;
fs.appendFileSync(p,JSON.stringify({producer:{type:'agent',id:'x'},subject_hash:'$SYN_B'})+'\n');
const pe=require('$ROOT/scripts/producer-evidence');
let failed=false;
try{pe.loadForSubject('$SYN_A');}catch(e){failed=/contamination/.test(e.message);}
if(saved===null){fs.rmSync(p,{force:true});}else{fs.writeFileSync(p,saved);}
if(!failed)process.exit(1);
" && ok "tampered producer store detected" || bad "store integrity"
cleanup_subject "$SYN_A"
node -e "
// old attestation cannot authorize a new subject
const f=require('$ROOT/scripts/evidence-freshness');
const r=f.check('attestation',{repo_head_sha:'$SYN_A',verdict:'approved'},{subjectHash:'$SYN_B'});
if(r.fresh||r.code!=='EVIDENCE_SUBJECT_MISMATCH')process.exit(1);
" && ok "stale attestation not reusable" || bad "attestation reuse"

# ── Release SoD wiring end-to-end (real HEAD, snapshot/restore isolation) ──
RHEAD=$(git -C "$ROOT" rev-parse HEAD)
snap() { for d in producers reviews; do f="$ROOT/.opencode/state/$d/$RHEAD.jsonl"; [ -f "$f" ] && cp "$f" "$f.snap" || true; done; return 0; }
restore() { for d in producers reviews; do f="$ROOT/.opencode/state/$d/$RHEAD.jsonl"; [ -f "$f.snap" ] && mv "$f.snap" "$f" || rm -f "$f"; done; return 0; }
mkdec() { # mkdec <exec> → decision id in isolated registry
  node -e "const gd=require('$ROOT/scripts/gate-decisions');console.log(gd.record({gate_id:'release',gate_class:'release',decision:'approve',subject_kind:'repo_head',subject_hash:'$RHEAD',principal:{type:'human',id:'alice',authenticated:true,source:'test-fixture'},scope:{},reason:'release wiring fixture',execution_id:'$1',policy_version:'1.0.0'}).decision_id);"
}
mkprod() { # mkprod <agent> <exec>
  node -e "const pe=require('$ROOT/scripts/producer-evidence');const id=require('$ROOT/scripts/execution-identity');pe.record({agentIdentity:id.createLauncherIdentity({agent:'$1',executionId:'$2',source:'test-fixture-phased'}),subjectHash:'$RHEAD',outcome:'completed',sourceRef:'$2'});" > /dev/null
}
mkrev() { # mkrev <agent> <exec>
  node -e "const re=require('$ROOT/scripts/review-evidence');const id=require('$ROOT/scripts/execution-identity');re.record({reviewerIdentity:id.createLauncherIdentity({agent:'$1',executionId:'$2',source:'test-fixture-phased'}),subjectHash:'$RHEAD',executionId:'$2',outcome:'approve',reason:'wiring fixture review'});" > /dev/null
}
snap
# missing producer evidence → block (producers file moved away; no decision burned)
mv "$ROOT/.opencode/state/producers/$RHEAD.jsonl" "$ROOT/.opencode/state/producers/$RHEAD.jsonl.kept" 2>/dev/null || true
D1=$(mkdec "rel-w1"); mkrev reviewer rel-w1r
if node "$ROOT/scripts/release-review.js" --yes --decision-id "$D1" --thread rel-w1 --bench-out /tmp/relw-bench.json > /dev/null 2>&1; then bad "missing producers attested"; else ok "missing producer evidence blocks"; fi
mv "$ROOT/.opencode/state/producers/$RHEAD.jsonl.kept" "$ROOT/.opencode/state/producers/$RHEAD.jsonl" 2>/dev/null || true
# producer==reviewer → block (helper level; the review store correctly refuses
# non-reviewer roles, so this combination cannot be file-stored — proven here)
node -e "const g=require('$ROOT/scripts/require-gate-decision');const id=require('$ROOT/scripts/execution-identity');
const D=require('child_process').execSync(\"node -e \\\"const gd=require('$ROOT/scripts/gate-decisions');console.log(gd.record({gate_id:'release',gate_class:'release',decision:'approve',subject_kind:'repo_head',subject_hash:'$RHEAD',principal:{type:'human',id:'alice',authenticated:true,source:'test-fixture'},scope:{},reason:'self-review negative',execution_id:'rel-w2',policy_version:'1.0.0'}).decision_id);\\\"\",{encoding:'utf8'}).trim();
try{g.requireGateDecision({decisionId:D,gateId:'release',gateClass:'release',action:'release-attest',subjectHash:'$RHEAD',subjectKind:'repo_head',executionId:'rel-w2',
sod:{producers:[{principal:{type:'agent',id:'builder'},subject_hash:'$RHEAD'}],
reviewer:{reviewer_identity:id.createLauncherIdentity({agent:'builder',executionId:'e',source:'t'}),subject_hash:'$RHEAD',execution_id:'e',outcome:'approve'},gateRole:'gatekeeper'}});process.exit(1);}catch(e){if(e.reason!=='sod-violation')process.exit(1);}" > /dev/null 2>&1 \
&& ok "producer==reviewer blocks attestation" || bad "self-review"
# reviewer==gatekeeper (human alice reviews and authorizes) → block
D3=$(mkdec "rel-w3")
node -e "const g=require('$ROOT/scripts/require-gate-decision');
const humanReviewer={identity_version:1,agent:'alice',principal:{type:'human',id:'alice',authenticated:false,source:'test-fixture-phased'},role:'reviewer',execution_id:'e-hr',parent_execution_id:null,worker:null,source:'test-fixture-phased'};
try{g.requireGateDecision({decisionId:'$D3',gateId:'release',gateClass:'release',action:'release-attest',subjectHash:'$RHEAD',subjectKind:'repo_head',executionId:'rel-w3',
sod:{producers:[{principal:{type:'agent',id:'builder'},subject_hash:'$RHEAD'}],
reviewer:{reviewer_identity:humanReviewer,subject_hash:'$RHEAD',execution_id:'e-hr',outcome:'approve'},gateRole:'gatekeeper'}});process.exit(1);}catch(e){if(e.reason!=='sod-violation')process.exit(1);}" > /dev/null 2>&1 \
&& ok "reviewer==gate principal blocks (helper)" || bad "reviewer-gate"
# A/B/C independent → attests
mkprod builder rel-w4p; mkrev reviewer rel-w4r; D4=$(mkdec "rel-w4")
if node "$ROOT/scripts/release-review.js" --yes --decision-id "$D4" --thread rel-w4 --bench-out /tmp/relw-bench.json > /tmp/relw-out.json 2>&1; then
  node -e "const a=require('/tmp/relw-out.json');if(a.verdict!=='approved'||!a.sod_codes||!a.producer_principals||!a.reviewer_principal)process.exit(1);" \
  && ok "independent chain attests with evidence graph" || bad "attestation graph"
else bad "independent attestation"; cat /tmp/relw-out.json; fi
rm -rf "$ROOT/.opencode/state/rel-w1" "$ROOT/.opencode/state/rel-w2" "$ROOT/.opencode/state/rel-w4" "$ROOT/.opencode/state/store/rel-w1" "$ROOT/.opencode/state/store/rel-w2" "$ROOT/.opencode/state/store/rel-w4"
restore

echo ""
echo "governance-evidence: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]

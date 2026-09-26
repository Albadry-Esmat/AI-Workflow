#!/usr/bin/env bash
# Phase E — adversarial governance matrix. Isolated registry + synthetic
# subjects; never touches real repository state. Each attack asserts the
# exact fail-closed contract (codes, not message text).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PASS=0; FAIL=0
ok() { echo "  PASS: $1"; PASS=$((PASS+1)); }
bad() { echo "  FAIL: $1"; FAIL=$((FAIL+1)); }
export AIW_GATE_REGISTRY="/tmp/gd-adv-$$-$(date +%s).jsonl"
rm -f "$AIW_GATE_REGISTRY"
trap 'rm -f "$AIW_GATE_REGISTRY" "${AIW_GATE_REGISTRY%.jsonl}.consumptions.jsonl"' EXIT
# Unique synthetic subjects per run (never collide with other runs/residue).
SA=$(node -e "console.log(require('crypto').createHash('sha256').update('syn-a-'+Date.now()+''+process.pid).digest('hex'))")
SB=$(node -e "console.log(require('crypto').createHash('sha256').update('syn-b-'+Date.now()+''+process.pid).digest('hex'))")
PRE="const sod=require('$ROOT/scripts/separation-of-duties');const id=require('$ROOT/scripts/execution-identity');const g=require('$ROOT/scripts/require-gate-decision');const gd=require('$ROOT/scripts/gate-decisions');"
mkd() { # mkd <exec> <subject> [class] → decision id (authed human)
  node -e "console.log(gd_record());" 2>/dev/null || node -e "
const gd=require('$ROOT/scripts/gate-decisions');
console.log(gd.record({gate_id:'release',gate_class:'${3:-release}',decision:'approve',subject_kind:'repo_head',subject_hash:'$2',principal:{type:'human',id:'chief',authenticated:true,source:'test-fixture'},scope:{},reason:'adversarial fixture decision',execution_id:'$1',policy_version:'1.0.0'}).decision_id);"
}
atk() { # atk <decision> <subject> <exec> [extra sod json] → prints reason or OK
  node -e "$PRE
try {
  const r=g.requireGateDecision({decisionId:'$1',gateId:'release',gateClass:'release',action:'release-attest',subjectHash:'$2',subjectKind:'repo_head',executionId:'$3'${4:-}});
  console.log('OK');
} catch(e){ console.log('BLOCKED:'+e.reason); }
"
}

# ── Identity attacks ────────────────────────────────────────────────
node -e "$PRE
const prod={principal:{type:'agent',id:'dev-x'},subject_hash:'$SA'};
const base={subjectHash:'$SA',producers:[prod],
  reviewer:{reviewer_identity:id.createLauncherIdentity({agent:'reviewer',executionId:'e',source:'t'}),subject_hash:'$SA',execution_id:'e',outcome:'approve'},
  gatePrincipal:{type:'human',id:'h',authenticated:true,source:'t'},gateRole:'gatekeeper'};
// self-review / self-gating / reviewer-as-gatekeeper
const cases=[
  [{...base,reviewer:{...base.reviewer,reviewer_identity:id.createLauncherIdentity({agent:'dev-x',executionId:'e2',source:'t'})}},'SOD_PRODUCER_EQUALS_REVIEWER'],
  [{...base,gatePrincipal:{type:'agent',id:'dev-x'}},'SOD_PRODUCER_EQUALS_GATEKEEPER'],
  [{...base,gatePrincipal:{type:'agent',id:'reviewer'}},'SOD_REVIEWER_EQUALS_GATEKEEPER'],
  // role relabeling / execution relabeling / worker-index relabeling
  [{...base,reviewer:{...base.reviewer,reviewer_identity:{...id.createLauncherIdentity({agent:'dev-x',executionId:'e9',source:'t'}),role:'reviewer'}}},'SOD_PRODUCER_EQUALS_REVIEWER'],
  [{...base,reviewer:{...base.reviewer,reviewer_identity:id.createWorkerIdentity({agent:'dev-x',parentExecutionId:'p',workerIndex:7,source:'t'})}},'SOD_PRODUCER_EQUALS_REVIEWER'],
];
for (const [input, code] of cases) {
  const r=sod.evaluate(input);
  if (r.allowed || !r.codes.includes(code)) { console.error('escape: '+code); process.exit(1); }
}
" && ok "identity attacks blocked (self-review/gating, relabeling)" || bad "identity attacks"
node -e "$PRE
// sibling independence abuse: same-agent siblings stay one actor
const w0=id.createWorkerIdentity({agent:'dev-x',parentExecutionId:'p',workerIndex:0,source:'t'});
const w1=id.createWorkerIdentity({agent:'dev-x',parentExecutionId:'p',workerIndex:1,source:'t'});
const r=sod.evaluate({subjectHash:'$SA',producers:[{principal:w0.principal,subject_hash:'$SA'}],
  reviewer:{reviewer_identity:w1,subject_hash:'$SA',execution_id:w1.execution_id,outcome:'approve'},
  gatePrincipal:{type:'human',id:'h',authenticated:true,source:'t'},gateRole:'gatekeeper'});
if(r.allowed)process.exit(1);
" && ok "sibling worker abuse blocked" || bad "sibling abuse"

# ── Evidence attacks ────────────────────────────────────────────────
[ "$(atk "$(mkd ex-a $SA)" $SA ex-a)" = "OK" ] || { bad "baseline chain"; }
[ "$(atk "$(mkd ex-b $SA)" $SB ex-b)" = "BLOCKED:decision-invalid" ] && ok "wrong-subject decision blocked" || bad "wrong subject"
D_E=$(mkd ex-c $SA); atk "$D_E" $SA ex-c > /dev/null
[ "$(atk "$D_E" $SA ex-c)" = "BLOCKED:already-consumed" ] && ok "replayed decision blocked" || bad "replay"
[ "$(atk "$(mkd ex-d $SA)" $SA ex-e)" = "BLOCKED:decision-invalid" ] && ok "wrong-execution decision blocked" || bad "wrong execution"
node -e "$PRE
// forged producer evidence (non-canonical principal) rejected at record
const pe=require('$ROOT/scripts/producer-evidence');
try{pe.record({agentIdentity:{agent:'ghost'},subjectHash:'$SA',outcome:'completed'});process.exit(1);}catch(e){if(!/execution-identity/.test(e.message))process.exit(1);}
// stale producer / review / benchmark rejected by freshness
const f=require('$ROOT/scripts/evidence-freshness');
if(f.check('producer',{producer:{type:'agent',id:'x',authenticated:false,source:'t'},producer_role:'developer',execution_id:'e',subject_hash:'$SB',source:'t'}, {subjectHash:'$SA'}).code!=='EVIDENCE_SUBJECT_MISMATCH')process.exit(1);
if(f.check('benchmark',{repo_head_sha:'$SB',passed:8,failed:0},{subjectHash:'$SA'}).code!=='EVIDENCE_SUBJECT_MISMATCH')process.exit(1);
" && ok "forged/stale evidence rejected" || bad "evidence attacks"

# ── Findings attacks ────────────────────────────────────────────────
node -e "$PRE
const f=require('$ROOT/scripts/finding-evidence');
const rep={identity_version:1,agent:'reviewer',principal:{type:'agent',id:'reviewer',authenticated:false,source:'t'},role:'reviewer',execution_id:'e',parent_execution_id:null,worker:null,source:'t'};
// open blocking finding + fake resolution (wrong subject) stays blocking
const r=f.record({rule_id:'A',target:'t',checker:'c',severity:'high',blocking:true,subjectHash:'$SA',reporterIdentity:rep,reason:'attack probe'});
f.resolveFinding({fingerprint:r.fingerprint,resolvedSubject:'$SB',resolverIdentity:rep,reason:'fake fix elsewhere'});
if(!f.blockingState(r.fingerprint,{subjectHash:'$SA',producerKeys:[]}).blocking)process.exit(1);
// suppression used as waiver → still blocking
f.suppress({fingerprint:r.fingerprint,reason:'suppressing to bypass',byIdentity:rep});
if(!f.blockingState(r.fingerprint,{subjectHash:'$SA',producerKeys:[]}).blocking)process.exit(1);
" && ok "fake resolution + suppression-as-waiver blocked" || bad "findings attacks"

# ── Retry/state attacks ─────────────────────────────────────────────
node -e "
// retry-budget reset: fixCycles only initializes in createCase, never resets
const src=require('fs').readFileSync('$ROOT/scripts/case-store.js','utf8');
if((src.match(/fixCycles\s*:\s*0/g)||[]).length!==1)process.exit(1);
const {transition,MAX_FIX_CYCLES}=require('$ROOT/scripts/workflow-state');
if(MAX_FIX_CYCLES!==3)process.exit(1);
// checkpoint resume cannot reset budgets: checkpointer.task replays cached results identically
" && ok "no retry-budget reset path" || bad "budget reset"
node -e "$PRE
// state traversal: sanitizeId containment
const s=require('$ROOT/scripts/sanitize-id');
for (const evil of ['../x','/abs','a/../../b','']) {
  try{ const out=s.sanitizeId(evil); if(out.includes('..'))process.exit(1); }catch(e){ /* rejection also safe */ }
}
if(s.sanitizeId('ok-id')!=='ok-id')process.exit(1);
" && ok "state traversal contained" || bad "traversal"
node -e "$PRE
// state tampering: rewritten registry fails verification (fail closed, not bypass); registry restored after
const fs=require('fs');
const d=gd.record({gate_id:'release',gate_class:'release',decision:'approve',subject_kind:'repo_head',subject_hash:'$SA',principal:{type:'human',id:'chief',authenticated:true,source:'test-fixture'},scope:{},reason:'tamper fixture decision',execution_id:'ex-t',policy_version:'1.0.0'}).decision_id;
const p=process.env.AIW_GATE_REGISTRY;
const saved=fs.readFileSync(p,'utf8');
fs.appendFileSync(p,JSON.stringify({decision_id:'gd_forged00000000',execution_id:null,gate_id:'release',gate_class:'release',decision:'approve',subject_kind:'repo_head',subject_hash:'$SA',principal:{type:'human',id:'mallory',authenticated:true,source:'evil'},scope:{},reason:'forged entry!',decided_at:new Date().toISOString(),expires_at:null,policy_version:'1.0.0',prev_hash:'WRONG',record_hash:'WRONG'})+'\n');
let okResult=false;
try {
  const r=gd.resolve(d,{});
  okResult=!r.valid&&/integrity|unreadable/.test(r.reason);
} finally { fs.writeFileSync(p,saved); }
if(!okResult)process.exit(1);
" && ok "registry tampering detected (fail closed)" || bad "tampering"
node -e "$PRE
// corrupt registry bytes fail closed (no throw past caller); registry restored after
const fs=require('fs');
const p=process.env.AIW_GATE_REGISTRY;
const saved=fs.readFileSync(p,'utf8');
fs.appendFileSync(p,'{corrupt-json\n');
let failed=false;
try {
  const r=gd.resolve('gd_aaaaaaaaaaaaaaaa',{});
  if(r.valid||!/unreadable|integrity/.test(r.reason))process.exit(1);
  const g2=require('$ROOT/scripts/require-gate-decision');
  try{g2.requireGateDecision({decisionId:'gd_aaaaaaaaaaaaaaaa',gateId:'release',gateClass:'release',action:'a',subjectHash:'$SA',subjectKind:'repo_head',executionId:'e'});process.exit(1);}catch(e){if(e.code!=='GATE_DECISION_BLOCKED')process.exit(1);}
  try{gd.record({gate_id:'x',gate_class:'general',decision:'approve',subject_kind:'none',principal:{type:'human',id:'x',authenticated:false,source:'t'},reason:'must refuse on corruption',execution_id:'e'});process.exit(1);}catch(e){failed=false;}
} finally { fs.writeFileSync(p,saved); }
if(failed)process.exit(1);
" && ok "corrupt registry fails closed (resolve, consume, record)" || bad "corrupt state"

# ── Invocation-level bypass ─────────────────────────────────────────
node "$ROOT/scripts/release-review.js" --yes --thread "adv-nodecision-$RANDOM" > /dev/null 2>&1 \
  && bad "boolean bypass attested" || ok "CLI boolean cannot authorize"
node -e "
// --audit-only output is never consumed for advancement (grep: no caller disables enforcement)
const src=require('fs').readFileSync('$ROOT/scripts/require-gate-decision.js','utf8');
if(/enforceAuthority\s*:\s*false/.test(src))process.exit(1);
const callers=require('child_process').execSync('grep -rl \"resolveOverride\" $ROOT/scripts/*.js').toString().split('\n').filter(Boolean);
for (const c of callers) { if(!/resolve-override\.js|gate-decisions\.js/.test(c)) process.exit(1); }
" && ok "audit-only path cannot advance" || bad "audit bypass"
if grep -rn "store.put.*release-attestation" "$ROOT/scripts/"*.js 2>/dev/null | grep -v "release-review.js" | grep -q .; then
  bad "attestation writable outside release-review"
else
  ok "attestation only via release-review"
fi

# ── End-to-end advancement chain (§20) ────────────────────────────────
node -e "$PRE
const S='$SA';
const pe=require('$ROOT/scripts/producer-evidence');
const re=require('$ROOT/scripts/review-evidence');
const fe=require('$ROOT/scripts/evidence-freshness');
const fi=require('$ROOT/scripts/finding-evidence');
// Developer A produces S
const devA=id.createLauncherIdentity({agent:'builder',executionId:'e2e-dev',source:'e2e'});
pe.record({agentIdentity:devA,subjectHash:S,outcome:'completed',sourceRef:'e2e-dev'});
// deterministic tests pass on S
const bench={repo_head_sha:S,passed:8,failed:0};
if(!fe.check('benchmark',bench,{subjectHash:S}).fresh)process.exit(1);
// Reviewer B reviews S; no blocking findings on S
const revB=id.createLauncherIdentity({agent:'reviewer',executionId:'e2e-rev',source:'e2e'});
re.record({reviewerIdentity:revB,subjectHash:S,executionId:'e2e-rev',outcome:'approve',reason:'e2e fixture review'});
const review=re.latestApproval(S);
if(!review||!fe.check('review',review,{subjectHash:S}).fresh)process.exit(1);
if(fi.listForSubject(S).length!==0)process.exit(1);
// Gatekeeper/Human C decides for S
const dec=gd.record({gate_id:'release',gate_class:'release',decision:'approve',subject_kind:'repo_head',subject_hash:S,principal:{type:'human',id:'chief',authenticated:true,source:'e2e'},scope:{},reason:'e2e fixture release decision',execution_id:'e2e-rel',policy_version:'1.0.0'}).decision_id;
// full chain authorizes once
const producers=pe.loadForSubject(S).entries.map((e)=>({principal:e.producer,subject_hash:e.subject_hash}));
const auth=g.requireGateDecision({decisionId:dec,gateId:'release',gateClass:'release',action:'release-attest',subjectHash:S,subjectKind:'repo_head',executionId:'e2e-rel',
  sod:{producers,reviewer:review,gateRole:'gatekeeper'}});
if(!auth.consumption||!auth.sod.allowed)process.exit(1);
// mutate subject: EVERY edge of the old chain is dead for S2
const S2='$SB';
if(fe.check('review',review,{subjectHash:S2}).fresh)process.exit(1);
if(fe.check('benchmark',bench,{subjectHash:S2}).fresh)process.exit(1);
try{g.requireGateDecision({decisionId:dec,gateId:'release',gateClass:'release',action:'release-attest',subjectHash:S2,subjectKind:'repo_head',executionId:'e2e-rel2',
  sod:{producers,reviewer:review,gateRole:'gatekeeper'}});process.exit(1);}catch(e){if(e.reason!=='decision-invalid')process.exit(1);}
const staleProd=pe.loadForSubject(S2);
if(staleProd.producers.length!==0)process.exit(1);
console.log('E2E-OK');
" | grep -q E2E-OK && ok "end-to-end chain authorizes; subject mutation kills every edge" || bad "e2e chain"
rm -rf "$ROOT/.opencode/state/producers/$SA.jsonl" "$ROOT/.opencode/state/reviews/$SA.jsonl"

echo ""
echo "governance-adversarial: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]

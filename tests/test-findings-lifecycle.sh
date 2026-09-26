#!/usr/bin/env bash
# Phase E — findings lifecycle, waiver/suppression governance, blocking computation.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PASS=0; FAIL=0
ok() { echo "  PASS: $1"; PASS=$((PASS+1)); }
bad() { echo "  FAIL: $1"; FAIL=$((FAIL+1)); }
export AIW_GATE_REGISTRY="/tmp/gd-find-$$-$(date +%s).jsonl"
rm -f "$AIW_GATE_REGISTRY"
trap 'rm -f "$AIW_GATE_REGISTRY" "${AIW_GATE_REGISTRY%.jsonl}.consumptions.jsonl"; rm -rf "$ROOT/.opencode/state/findings"/fp_* 2>/dev/null; true' EXIT
# Unique synthetic subjects per run (never collide with other runs/residue).
SYN_A=$(node -e "console.log(require('crypto').createHash('sha256').update('syn-a-'+Date.now()+''+process.pid).digest('hex'))")
SYN_B=$(node -e "console.log(require('crypto').createHash('sha256').update('syn-b-'+Date.now()+''+process.pid).digest('hex'))")
REP='{"identity_version":1,"agent":"reviewer","principal":{"type":"agent","id":"reviewer","authenticated":false,"source":"test"},"role":"reviewer","execution_id":"e-r","parent_execution_id":null,"worker":null,"source":"test"}'

# ── Fingerprint stability ─────────────────────────────────────────────
node -e "
const f=require('$ROOT/scripts/finding-evidence');
const a=f.fingerprint({rule_id:'SEC-1',target:'src/auth.js',checker:'security-review'});
const b=f.fingerprint({rule_id:'SEC-1',target:'SRC/AUTH.JS  ',checker:'security-review'});
const c=f.fingerprint({rule_id:'SEC-1',target:'src/other.js',checker:'security-review'});
const d=f.fingerprint({rule_id:'SEC-2',target:'src/auth.js',checker:'security-review'});
if(a!==b)process.exit(1);
if(new Set([a,c,d]).size!==3)process.exit(1);
" && ok "fingerprint stable (case/whitespace), distinct per rule/target" || bad "fingerprint"

# ── Lifecycle: record → rediscover → resolve ──────────────────────────
node -e "
const f=require('$ROOT/scripts/finding-evidence');
const rep=$REP;
const r1=f.record({rule_id:'SEC-1',target:'src/auth.js',checker:'security-review',severity:'high',blocking:true,subjectHash:'$SYN_A',reporterIdentity:rep,reason:'hardcoded secret'});
const r2=f.record({rule_id:'SEC-1',target:'src/auth.js',checker:'other-checker',severity:'low',blocking:true,subjectHash:'$SYN_A',reporterIdentity:rep,reason:'same issue other tool'});
if(r1.fingerprint===r2.fingerprint)process.exit(1);
const r3=f.record({rule_id:'SEC-1',target:'src/auth.js',checker:'security-review',severity:'critical',blocking:true,subjectHash:'$SYN_A',reporterIdentity:rep,reason:'reworded rediscovery, shifted lines'});
if(r3.event.event!=='finding_rediscovered'||r3.fingerprint!==r1.fingerprint)process.exit(1);
let st=f.blockingState(r1.fingerprint,{subjectHash:'$SYN_A',producerKeys:['agent:builder']});
if(!st.blocking||st.code!=='FINDING_BLOCKING_OPEN')process.exit(1);
f.resolveFinding({fingerprint:r1.fingerprint,resolvedSubject:'$SYN_A',resolverIdentity:rep,reason:'rotated secret, verified'});
st=f.blockingState(r1.fingerprint,{subjectHash:'$SYN_A',producerKeys:[]});
if(st.blocking||st.code!=='FINDINGS_CLEAR')process.exit(1);
" && ok "lifecycle record→rediscover→resolve; severity never decides" || bad "lifecycle"
node -e "
// advisory finding (blocking=false) never blocks, even when open
const f=require('$ROOT/scripts/finding-evidence');
const rep=$REP;
const r=f.record({rule_id:'LINT-9',target:'docs/x.md',checker:'style',severity:'low',blocking:false,subjectHash:'$SYN_A',reporterIdentity:rep,reason:'nit'});
const st=f.blockingState(r.fingerprint,{subjectHash:'$SYN_A',producerKeys:[]});
if(st.blocking||st.code!=='FINDINGS_CLEAR')process.exit(1);
// resolved on another subject stays stale here
const r2=f.record({rule_id:'SEC-9',target:'src/b.js',checker:'security-review',severity:'high',blocking:true,subjectHash:'$SYN_A',reporterIdentity:rep,reason:'issue'});
f.resolveFinding({fingerprint:r2.fingerprint,resolvedSubject:'$SYN_B',resolverIdentity:rep,reason:'fixed elsewhere'});
const st2=f.blockingState(r2.fingerprint,{subjectHash:'$SYN_A',producerKeys:[]});
if(!st2.blocking||st2.code!=='FINDING_EVIDENCE_STALE')process.exit(1);
" && ok "advisory never blocks; foreign resolution stays stale" || bad "resolution scope"

# ── Waiver governance ─────────────────────────────────────────────────
node -e "
// waiver requires an authorized, scoped, bound decision
const f=require('$ROOT/scripts/finding-evidence');
const gd=require('$ROOT/scripts/gate-decisions');
const rep=$REP;
const r=f.record({rule_id:'SEC-2',target:'src/c.js',checker:'security-review',severity:'critical',blocking:true,subjectHash:'$SYN_A',reporterIdentity:rep,reason:'needs waiver'});
const mk=(cls,sub,auth,scope)=>gd.record({gate_id:'sec',gate_class:cls,decision:'approve',subject_kind:'repo_head',subject_hash:sub,principal:{type:'human',id:'ciso',authenticated:auth,source:'test-fixture'},scope:scope||{},reason:'waiver fixture decision',execution_id:'ex-w',policy_version:'1.0.0'}).decision_id;
// unauthenticated claim cannot waive
const d1=mk('security','$SYN_A',false,{});
try{f.waive({fingerprint:r.fingerprint,subjectHash:'$SYN_A',decisionId:d1,gateClass:'security',reason:'risk accepted for now'});process.exit(1);}catch(e){if(!/unauthorized|authority/.test(e.message))process.exit(1);}
// wrong class cannot waive
const d2=mk('general','$SYN_A',true,{});
try{f.waive({fingerprint:r.fingerprint,subjectHash:'$SYN_A',decisionId:d2,gateClass:'security',reason:'risk accepted for now'});process.exit(1);}catch(e){if(!/class/.test(e.message))process.exit(1);}
// wrong-subject decision cannot waive
const d3=mk('security','$SYN_B',true,{});
try{f.waive({fingerprint:r.fingerprint,subjectHash:'$SYN_A',decisionId:d3,gateClass:'security',reason:'risk accepted for now'});process.exit(1);}catch(e){if(!/different subject/.test(e.message))process.exit(1);}
// valid scoped waiver clears, and is re-validated per check
const d4=mk('security','$SYN_A',true,{waiver_fingerprint:r.fingerprint,waiver_subject:'$SYN_A'});
f.waive({fingerprint:r.fingerprint,subjectHash:'$SYN_A',decisionId:d4,gateClass:'security',reason:'risk accepted until rotation'});
const st=f.blockingState(r.fingerprint,{subjectHash:'$SYN_A',producerKeys:[],reviewerKey:null});
if(st.blocking||st.code!=='FINDINGS_CLEAR')process.exit(1);
// same waiver on another subject → mismatch (narrow scope default)
const st2=f.blockingState(r.fingerprint,{subjectHash:'$SYN_B',producerKeys:[]});
if(!st2.blocking)process.exit(1);
" && ok "waiver authority/scope/subject enforced" || bad "waiver"
node -e "
// waiver self-authorization refused (producer / reviewer cannot waive own finding)
const f=require('$ROOT/scripts/finding-evidence');
const gd=require('$ROOT/scripts/gate-decisions');
const rep=$REP;
const r=f.record({rule_id:'SEC-3',target:'src/d.js',checker:'security-review',severity:'high',blocking:true,subjectHash:'$SYN_A',reporterIdentity:rep,reason:'self waiver probe'});
const d=gd.record({gate_id:'sec',gate_class:'security',decision:'approve',subject_kind:'repo_head',subject_hash:'$SYN_A',principal:{type:'human',id:'alice',authenticated:true,source:'test-fixture'},scope:{},reason:'self waiver fixture decision',execution_id:'ex-w',policy_version:'1.0.0'}).decision_id;
f.waive({fingerprint:r.fingerprint,subjectHash:'$SYN_A',decisionId:d,gateClass:'security',reason:'alice accepts own risk'});
const prod=f.blockingState(r.fingerprint,{subjectHash:'$SYN_A',producerKeys:['human:alice']});
if(!prod.blocking||prod.code!=='FINDING_WAIVER_UNAUTHORIZED')process.exit(1);
const rev=f.blockingState(r.fingerprint,{subjectHash:'$SYN_A',producerKeys:[],reviewerKey:'human:alice'});
if(!rev.blocking||rev.code!=='FINDING_WAIVER_UNAUTHORIZED')process.exit(1);
const other=f.blockingState(r.fingerprint,{subjectHash:'$SYN_A',producerKeys:['agent:builder'],reviewerKey:'agent:reviewer'});
if(other.blocking)process.exit(1);
" && ok "self-waiver refused; independent waiver holds" || bad "waiver SoD"
node -e "
// expired waiver blocks again
const f=require('$ROOT/scripts/finding-evidence');
const gd=require('$ROOT/scripts/gate-decisions');
const rep=$REP;
const r=f.record({rule_id:'SEC-4',target:'src/e.js',checker:'security-review',severity:'high',blocking:true,subjectHash:'$SYN_A',reporterIdentity:rep,reason:'expiry probe'});
const future=new Date(Date.now()+3600000).toISOString();
const d=gd.record({gate_id:'sec',gate_class:'security',decision:'approve',subject_kind:'repo_head',subject_hash:'$SYN_A',principal:{type:'human',id:'ciso',authenticated:true,source:'test-fixture'},scope:{},reason:'expiring waiver fixture decision',execution_id:'ex-w',policy_version:'1.0.0',expires_at:future});
f.waive({fingerprint:r.fingerprint,subjectHash:'$SYN_A',decisionId:d.decision_id,gateClass:'security',reason:'waiver that will expire'});
const st=f.blockingState(r.fingerprint,{subjectHash:'$SYN_A',producerKeys:[],nowMs:Date.now()+7200000});
if(!st.blocking||st.code!=='FINDING_WAIVER_EXPIRED')process.exit(1);
" && ok "expired waiver blocks" || bad "waiver expiry"

# ── Suppression is presentation only ────────────────────────────────────
node -e "
const f=require('$ROOT/scripts/finding-evidence');
const rep=$REP;
const r=f.record({rule_id:'SEC-5',target:'src/f.js',checker:'security-review',severity:'medium',blocking:true,subjectHash:'$SYN_A',reporterIdentity:rep,reason:'suppression probe'});
f.suppress({fingerprint:r.fingerprint,scope:{triage:'noise'},reason:'triaged as noise for now',byIdentity:rep});
const st=f.blockingState(r.fingerprint,{subjectHash:'$SYN_A',producerKeys:[]});
if(!st.blocking||st.code!=='FINDING_BLOCKING_OPEN')process.exit(1);
const folded=f.fold(f.readEvents(r.fingerprint));
if(!folded.suppressed||folded.status!=='OPEN')process.exit(1);
" && ok "suppression never authorizes (still blocking)" || bad "suppression"

# ── Review approve cannot override open blocking findings ───────────────
node -e "
const f=require('$ROOT/scripts/finding-evidence');
const rep=$REP;
const r=f.record({rule_id:'SEC-6',target:'src/g.js',checker:'security-review',severity:'high',blocking:true,subjectHash:'$SYN_A',reporterIdentity:rep,reason:'approve override probe'});
const st=f.blockingState(r.fingerprint,{subjectHash:'$SYN_A',producerKeys:[]});
if(!st.blocking)process.exit(1);
" && ok "approve outcome bows to structured findings" || bad "approve vs findings"

echo ""
echo "findings-lifecycle: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]

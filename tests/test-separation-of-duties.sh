#!/usr/bin/env bash
# Phase C — separation-of-duties regression suite (policy only, no authorization
# redesign; reason codes asserted, never message text).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PASS=0; FAIL=0
ok() { echo "  PASS: $1"; PASS=$((PASS+1)); }
bad() { echo "  FAIL: $1"; FAIL=$((FAIL+1)); }
export AIW_GATE_REGISTRY="/tmp/gd-sod-$$-$(date +%s).jsonl"
rm -f "$AIW_GATE_REGISTRY"
trap 'rm -f "$AIW_GATE_REGISTRY" "${AIW_GATE_REGISTRY%.jsonl}.consumptions.jsonl"' EXIT

PRE="const sod=require('$ROOT/scripts/separation-of-duties');const id=require('$ROOT/scripts/execution-identity');"
mk() { # mk <agent> <exec> [parent] → identity JSON via node print
  node -e "const id=require('$ROOT/scripts/execution-identity');console.log(JSON.stringify(id.createLauncherIdentity({agent:'$1',executionId:'$2',source:'test'})));"
}
reviewOf() { # reviewOf <agent> <exec> <subject> [outcome] → review JSON
  node -e "const id=require('$ROOT/scripts/execution-identity');console.log(JSON.stringify({reviewer_identity:id.createLauncherIdentity({agent:'$1',executionId:'$2',source:'test'}),subject_hash:'$3',execution_id:'$2',outcome:'${4:-approve}',review_id:'rev-$2',timestamp:new Date().toISOString()}));"
}

SUB="abcdef0123456789abcdef0123456789abcdef01"
P_BUILDER="{\"principal\":{\"type\":\"agent\",\"id\":\"builder\"},\"subject_hash\":\"$SUB\"}"
P_REVIEWER="{\"principal\":{\"type\":\"agent\",\"id\":\"reviewer\"}}"

# ── Valid independence ────────────────────────────────────────────────
node -e "$PRE
const r=sod.evaluate({subjectHash:'$SUB',
  producers:[{principal:{type:'agent',id:'builder'},subject_hash:'$SUB'}],
  reviewer:{reviewer_identity:id.createLauncherIdentity({agent:'reviewer',executionId:'e-r',source:'t'}),subject_hash:'$SUB',execution_id:'e-r',outcome:'approve'},
  gatePrincipal:{type:'human',id:'g',authenticated:true,source:'t'},gateRole:'gatekeeper'});
if(!r.allowed||r.codes.length!==0)process.exit(1);
" && ok "producer/reviewer/gatekeeper independence passes" || bad "independence"
node -e "$PRE
const r=sod.evaluate({subjectHash:'$SUB',
  producers:[{principal:{type:'agent',id:'builder'},subject_hash:'$SUB'}],
  reviewer:{reviewer_identity:id.createLauncherIdentity({agent:'github-reviewer',executionId:'e-r',source:'t'}),subject_hash:'$SUB',execution_id:'e-r',outcome:'approve'},
  gatePrincipal:{type:'human',id:'g',authenticated:true,source:'t'},gateRole:'gatekeeper'});
if(!r.allowed)process.exit(1);
" && ok "mapped reviewer role passes" || bad "reviewer role"

# ── Self-review / self-gating ─────────────────────────────────────────
node -e "$PRE
const r=sod.evaluate({subjectHash:'$SUB',
  producers:[{principal:{type:'agent',id:'builder'},subject_hash:'$SUB'}],
  reviewer:{reviewer_identity:id.createLauncherIdentity({agent:'builder',executionId:'e-r',source:'t'}),subject_hash:'$SUB',execution_id:'e-r',outcome:'approve'},
  gatePrincipal:{type:'human',id:'g',authenticated:true,source:'t'},gateRole:'gatekeeper'});
if(r.allowed||!r.codes.includes('SOD_PRODUCER_EQUALS_REVIEWER'))process.exit(1);
" && ok "producer==reviewer blocked" || bad "self-review"
node -e "$PRE
// same principal, different execution → still same actor
const r=sod.evaluate({subjectHash:'$SUB',
  producers:[{principal:{type:'agent',id:'builder'},subject_hash:'$SUB',execution_id:'e-1'}],
  reviewer:{reviewer_identity:{...id.createLauncherIdentity({agent:'builder',executionId:'e-2',source:'t'})},subject_hash:'$SUB',execution_id:'e-2',outcome:'approve'},
  gatePrincipal:{type:'human',id:'g',authenticated:true,source:'t'},gateRole:'gatekeeper'});
if(r.allowed||!r.codes.includes('SOD_PRODUCER_EQUALS_REVIEWER'))process.exit(1);
" && ok "execution reseparation does not confer independence" || bad "execution evasion"
node -e "$PRE
// same principal id, relabeled role → still same actor
const fake={...id.createLauncherIdentity({agent:'builder',executionId:'e-r',source:'t'}),role:'reviewer'};
const r=sod.evaluate({subjectHash:'$SUB',
  producers:[{principal:{type:'agent',id:'builder'},subject_hash:'$SUB'}],
  reviewer:{reviewer_identity:fake,subject_hash:'$SUB',execution_id:'e-r',outcome:'approve'},
  gatePrincipal:{type:'human',id:'g',authenticated:true,source:'t'},gateRole:'gatekeeper'});
if(r.allowed||!r.codes.includes('SOD_PRODUCER_EQUALS_REVIEWER'))process.exit(1);
" && ok "role relabeling does not confer independence" || bad "role evasion"
node -e "$PRE
const g={type:'agent',id:'builder'};
const r=sod.evaluate({subjectHash:'$SUB',
  producers:[{principal:{type:'agent',id:'builder'},subject_hash:'$SUB'}],
  reviewer:{reviewer_identity:id.createLauncherIdentity({agent:'reviewer',executionId:'e-r',source:'t'}),subject_hash:'$SUB',execution_id:'e-r',outcome:'approve'},
  gatePrincipal:g,gateRole:'gatekeeper'});
if(r.allowed||!r.codes.includes('SOD_PRODUCER_EQUALS_GATEKEEPER'))process.exit(1);
const r2=sod.evaluate({subjectHash:'$SUB',
  producers:[{principal:{type:'agent',id:'builder'},subject_hash:'$SUB'}],
  reviewer:{reviewer_identity:id.createLauncherIdentity({agent:'reviewer',executionId:'e-r',source:'t'}),subject_hash:'$SUB',execution_id:'e-r',outcome:'approve'},
  gatePrincipal:{type:'agent',id:'reviewer'},gateRole:'gatekeeper'});
if(r2.allowed||!r2.codes.includes('SOD_REVIEWER_EQUALS_GATEKEEPER'))process.exit(1);
" && ok "producer/reviewer self-gating blocked" || bad "self-gating"

# ── Workers ───────────────────────────────────────────────────────────
node -e "$PRE
// same worker produces + reviews → block
const w=id.createWorkerIdentity({agent:'builder',parentExecutionId:'p',workerIndex:0,source:'t'});
const r=sod.evaluate({subjectHash:'$SUB',
  producers:[{principal:w.principal,subject_hash:'$SUB',execution_id:w.execution_id,parent_execution_id:'p'}],
  reviewer:{reviewer_identity:w,subject_hash:'$SUB',execution_id:w.execution_id,outcome:'approve'},
  gatePrincipal:{type:'human',id:'g',authenticated:true,source:'t'},gateRole:'gatekeeper'});
if(r.allowed||!r.codes.includes('SOD_PRODUCER_EQUALS_REVIEWER'))process.exit(1);
" && ok "same worker produce+review blocked" || bad "same worker"
node -e "$PRE
// same-agent siblings (distinct execution_id, shared parent) → one actor → block
const w0=id.createWorkerIdentity({agent:'builder',parentExecutionId:'p',workerIndex:0,source:'t'});
const w1=id.createWorkerIdentity({agent:'builder',parentExecutionId:'p',workerIndex:1,source:'t'});
const r=sod.evaluate({subjectHash:'$SUB',
  producers:[{principal:w0.principal,subject_hash:'$SUB',execution_id:w0.execution_id,parent_execution_id:'p'}],
  reviewer:{reviewer_identity:w1,subject_hash:'$SUB',execution_id:w1.execution_id,outcome:'approve'},
  gatePrincipal:{type:'human',id:'g',authenticated:true,source:'t'},gateRole:'gatekeeper'});
if(r.allowed||!r.codes.includes('SOD_PRODUCER_EQUALS_REVIEWER'))process.exit(1);
if(!r.details.shared_lineage_roots.includes('p'))process.exit(1);
" && ok "same-agent siblings blocked (lineage reported)" || bad "sibling same-agent"
node -e "$PRE
// distinct-agent siblings (orchestrator-delegated builder + reviewer) → independent
const w0=id.createWorkerIdentity({agent:'builder',parentExecutionId:'p',workerIndex:0,source:'t'});
const w1=id.createWorkerIdentity({agent:'reviewer',parentExecutionId:'p',workerIndex:1,source:'t'});
const r=sod.evaluate({subjectHash:'$SUB',
  producers:[{principal:w0.principal,subject_hash:'$SUB',execution_id:w0.execution_id,parent_execution_id:'p'}],
  reviewer:{reviewer_identity:w1,subject_hash:'$SUB',execution_id:w1.execution_id,outcome:'approve'},
  gatePrincipal:{type:'human',id:'g',authenticated:true,source:'t'},gateRole:'gatekeeper'});
if(!r.allowed)process.exit(1);
" && ok "distinct-agent siblings independent" || bad "sibling distinct-agent"

# ── Roles ─────────────────────────────────────────────────────────────
node -e "$PRE
const badRole=(agent)=>sod.evaluate({subjectHash:'$SUB',
  producers:[{principal:{type:'agent',id:'builder'},subject_hash:'$SUB'}],
  reviewer:{reviewer_identity:id.createLauncherIdentity({agent,executionId:'e',source:'t'}),subject_hash:'$SUB',execution_id:'e',outcome:'approve'},
  gatePrincipal:{type:'human',id:'g',authenticated:true,source:'t'},gateRole:'gatekeeper'});
if(badRole('builder').allowed||!badRole('builder').codes.includes('SOD_UNKNOWN_REVIEWER_ROLE'))process.exit(1);
if(badRole('sre').allowed||!badRole('sre').codes.includes('SOD_UNKNOWN_REVIEWER_ROLE'))process.exit(1);
const orch=sod.evaluate({subjectHash:'$SUB',
  producers:[{principal:{type:'agent',id:'builder'},subject_hash:'$SUB'}],
  reviewer:{reviewer_identity:id.createLauncherIdentity({agent:'reviewer',executionId:'e',source:'t'}),subject_hash:'$SUB',execution_id:'e',outcome:'approve'},
  gatePrincipal:{type:'agent',id:'primary'},gateRole:'orchestrator'});
if(orch.allowed||!orch.codes.includes('SOD_UNKNOWN_GATE_ROLE'))process.exit(1);
const nullGate=sod.evaluate({subjectHash:'$SUB',
  producers:[{principal:{type:'agent',id:'builder'},subject_hash:'$SUB'}],
  reviewer:{reviewer_identity:id.createLauncherIdentity({agent:'reviewer',executionId:'e',source:'t'}),subject_hash:'$SUB',execution_id:'e',outcome:'approve'},
  gatePrincipal:{type:'human',id:'g',authenticated:true,source:'t'},gateRole:null});
if(nullGate.allowed||!nullGate.codes.includes('SOD_UNKNOWN_GATE_ROLE'))process.exit(1);
" && ok "wrong/null roles blocked (orchestrator cannot gate)" || bad "roles"

# ── Subject binding / multi-producer / legacy ──────────────────────────
node -e "$PRE
const stale=sod.evaluate({subjectHash:'$SUB',
  producers:[{principal:{type:'agent',id:'builder'},subject_hash:'$SUB'}],
  reviewer:{reviewer_identity:id.createLauncherIdentity({agent:'reviewer',executionId:'e',source:'t'}),subject_hash:'deadbeefdeadbeef',execution_id:'e',outcome:'approve'},
  gatePrincipal:{type:'human',id:'g',authenticated:true,source:'t'},gateRole:'gatekeeper'});
if(stale.allowed||!stale.codes.includes('SOD_REVIEW_SUBJECT_MISMATCH'))process.exit(1);
const multi=sod.evaluate({subjectHash:'$SUB',
  producers:[{principal:{type:'agent',id:'builder'},subject_hash:'$SUB'},{principal:{type:'agent',id:'test-generator'},subject_hash:'$SUB'}],
  reviewer:{reviewer_identity:id.createLauncherIdentity({agent:'test-generator',executionId:'e',source:'t'}),subject_hash:'$SUB',execution_id:'e',outcome:'approve'},
  gatePrincipal:{type:'human',id:'g',authenticated:true,source:'t'},gateRole:'gatekeeper'});
if(multi.allowed||!multi.codes.includes('SOD_PRODUCER_EQUALS_REVIEWER'))process.exit(1);
const legacy=sod.evaluate({subjectHash:'$SUB',
  producers:[{principal:{type:'agent',id:'builder'},subject_hash:'$SUB'}],
  reviewer:{reviewer_identity:{agent:'reviewer'},subject_hash:'$SUB',execution_id:'e',outcome:'approve'},
  gatePrincipal:{type:'human',id:'g',authenticated:true,source:'t'},gateRole:'gatekeeper'});
if(legacy.allowed||!legacy.codes.includes('SOD_UNATTRIBUTED_REVIEW'))process.exit(1);
const noprod=sod.evaluate({subjectHash:'$SUB',producers:[],
  reviewer:{reviewer_identity:id.createLauncherIdentity({agent:'reviewer',executionId:'e',source:'t'}),subject_hash:'$SUB',execution_id:'e',outcome:'approve'},
  gatePrincipal:{type:'human',id:'g',authenticated:true,source:'t'},gateRole:'gatekeeper'});
if(noprod.allowed||!noprod.codes.includes('SOD_PRODUCER_EVIDENCE_MISSING'))process.exit(1);
" && ok "subject/multi-producer/legacy fail closed" || bad "evidence binding"

# ── Consumption ordering: SoD failure must NOT burn the decision ────────
SOD_D=$(node -e "const gd=require('$ROOT/scripts/gate-decisions');console.log(gd.record({gate_id:'release',gate_class:'release',decision:'approve',subject_kind:'repo_head',subject_hash:'$SUB',principal:{type:'human',id:'alice',authenticated:true,source:'test-fixture'},scope:{},reason:'sod ordering fixture',execution_id:'ex-sod',policy_version:'1.0.0'}).decision_id);")
node -e "
const g=require('$ROOT/scripts/require-gate-decision');
const id=require('$ROOT/scripts/execution-identity');
const sodIn={producers:[{principal:{type:'agent',id:'builder'},subject_hash:'$SUB'}],
  reviewer:{reviewer_identity:id.createLauncherIdentity({agent:'builder',executionId:'e',source:'t'}),subject_hash:'$SUB',execution_id:'e',outcome:'approve'},
  gateRole:'gatekeeper'};
try{g.requireGateDecision({decisionId:'$SOD_D',gateId:'release',gateClass:'release',action:'release-attest',subjectHash:'$SUB',subjectKind:'repo_head',executionId:'ex-sod',sod:sodIn});process.exit(1);}catch(e){if(e.reason!=='sod-violation')process.exit(1);}
// decision must still be consumable by a compliant request
const ok=g.requireGateDecision({decisionId:'$SOD_D',gateId:'release',gateClass:'release',action:'release-attest',subjectHash:'$SUB',subjectKind:'repo_head',executionId:'ex-sod',
  sod:{producers:[{principal:{type:'agent',id:'builder'},subject_hash:'$SUB'}],
    reviewer:{reviewer_identity:id.createLauncherIdentity({agent:'reviewer',executionId:'e2',source:'t'}),subject_hash:'$SUB',execution_id:'e2',outcome:'approve'},
    gateRole:'gatekeeper'}});
if(!ok.consumption||!ok.sod||!ok.sod.allowed)process.exit(1);
" && ok "SoD failure preserves decision; compliant retry consumes" || bad "consumption ordering"

echo ""
echo "separation-of-duties: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]

#!/usr/bin/env bash
# Phase A — canonical execution identity regression suite.
# Attribution foundation only: no authorization rules are tested here.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PASS=0; FAIL=0
ok() { echo "  PASS: $1"; PASS=$((PASS+1)); }
bad() { echo "  FAIL: $1"; FAIL=$((FAIL+1)); }
cleanup() { rm -rf "$ROOT/.opencode/state/phasea-"*; }
trap cleanup EXIT

FX="github-copilot/claude-sonnet-4.6,github-copilot/claude-haiku-4.5"
# Fixture session model (precedence gate needs catalog + session; no auth).
export AIW_RUNTIME_MODEL="github-copilot/claude-haiku-4.5"

# ── Launcher: principal + role + execution bound ──────────────────────────
node -e "
const id=require('$ROOT/scripts/execution-identity');
const e=id.createLauncherIdentity({agent:'analyzer',executionId:'ex-1',source:'launcher:aiw-run'});
if(e.identity_version!==1)process.exit(1);
if(e.principal.type!=='agent'||e.principal.id!=='analyzer')process.exit(1);
if(e.principal.authenticated!==false)process.exit(1);
if(e.role!=='analyzer')process.exit(1);
if(e.execution_id!=='ex-1'||e.parent_execution_id!==null||e.worker!==null)process.exit(1);
if(e.source!=='launcher:aiw-run')process.exit(1);
id.validateAgentIdentity(e);
" && ok "launcher identity (principal, role, execution bound)" || bad "launcher identity"

# Unmapped agent → explicit null role (never fabricated).
node -e "
const id=require('$ROOT/scripts/execution-identity');
const e=id.createLauncherIdentity({agent:'sre',executionId:'ex-2',source:'t'});
if(e.role!==null)process.exit(1);
id.validateAgentIdentity(e);
" && ok "unmapped agent role is explicit null" || bad "null role"

# ── Workers: distinct principals, shared lineage ──────────────────────────
node -e "
const id=require('$ROOT/scripts/execution-identity');
const w0=id.createWorkerIdentity({agent:'analyzer',parentExecutionId:'p1',workerIndex:0,source:'launcher:orchestrate-workers'});
const w1=id.createWorkerIdentity({agent:'analyzer',parentExecutionId:'p1',workerIndex:1,source:'launcher:orchestrate-workers'});
const w2=id.createWorkerIdentity({agent:'analyzer',parentExecutionId:'p1',workerIndex:2,source:'launcher:orchestrate-workers'});
const ids=new Set([w0.execution_id,w1.execution_id,w2.execution_id]);
if(ids.size!==3)process.exit(1);
for(const w of [w0,w1,w2]){
  id.validateAgentIdentity(w);
  if(w.parent_execution_id!=='p1')process.exit(1);
  if(w.role!=='analyzer'||w.principal.id!=='analyzer')process.exit(1);
}
if(w0.worker.index!==0||w1.worker.id!==w1.execution_id)process.exit(1);
" && ok "workers distinct with parent lineage" || bad "worker identity"

# Orchestrator identity differs in role from its workers.
node -e "
const id=require('$ROOT/scripts/execution-identity');
const o=id.createOrchestratorIdentity({executionId:'p1',source:'launcher:orchestrate-workers'});
const w=id.createWorkerIdentity({agent:'analyzer',parentExecutionId:'p1',workerIndex:0,source:'launcher:orchestrate-workers'});
if(o.role!=='orchestrator'||w.role==='orchestrator')process.exit(1);
if(o.execution_id!=='p1'||o.parent_execution_id!==null)process.exit(1);
" && ok "orchestrator role distinct from workers" || bad "orchestrator identity"

# ── Dispatch: exact identity reaches trace, downstream never rewrites ─────
AIW_AVAILABLE_MODELS="$FX" node "$ROOT/scripts/aiw-run.js" --template quick-fix --thread "phasea-dispatch" "probe" > /tmp/phasea-d.txt 2>&1 \
&& node -e "
const fs=require('fs');
const recs=fs.readFileSync('$ROOT/.opencode/state/phasea-dispatch/trace.jsonl','utf8').trim().split('\n').map((l)=>JSON.parse(l));
const t=recs.find((r)=>r.model_resolution);
if(!t||!t.agent_identity)process.exit(1);
const id=require('$ROOT/scripts/execution-identity');
const v=id.validateAgentIdentity(t.agent_identity);
if(v.agent!=='analyzer'||v.role!=='analyzer')process.exit(1);
if(v.principal.id!=='analyzer'||v.execution_id!=='phasea-dispatch')process.exit(1);
if(v.source!=='launcher:aiw-run')process.exit(1);
// start checkpoint carries the same identity (reference, not rewrite)
const cps=fs.readFileSync('$ROOT/.opencode/state/phasea-dispatch/checkpoint.jsonl','utf8').trim().split('\n').map((l)=>JSON.parse(l));
const run=cps.find((c)=>c.kind==='run');
if(!run||!run.agent_identity||run.agent_identity.execution_id!=='phasea-dispatch')process.exit(1);
if(JSON.stringify(run.agent_identity)!==JSON.stringify(t.agent_identity))process.exit(1);
" && ok "dispatch identity exact end-to-end (trace + checkpoint)" || bad "dispatch identity"
rm -rf "$ROOT/.opencode/state/phasea-dispatch"

# Adapter passthrough is byte-identical (downstream consumes, never rewrites).
node -e "
const fs=require('fs');
const id=require('$ROOT/scripts/execution-identity');
const e=id.createLauncherIdentity({agent:'analyzer',executionId:'phasea-pt',source:'t'});
const a=require('$ROOT/scripts/runtime-adapter');
a.start('phasea-pt',{model_id:'p/m',pipeline:'x',agent_identity:e});
a.send('phasea-pt',{prompt:'x',model_id:'p/m',agent_identity:e,tool:'read',targetPath:'docs/a.md'});
const t=fs.readFileSync('$ROOT/.opencode/state/phasea-pt/trace.jsonl','utf8').trim().split('\n').map((l)=>JSON.parse(l))[0];
if(JSON.stringify(t.agent_identity)!==JSON.stringify(e))process.exit(1);
" && ok "adapter passthrough byte-identical (no rewriting)" || bad "adapter passthrough"
rm -rf "$ROOT/.opencode/state/phasea-pt"

# ── Approval minting ──────────────────────────────────────────────────────
node -e "
const ap=require('$ROOT/scripts/policy-approval');
const t='phasea-appr-'+Date.now();
const rec=ap.approve({thread:t,tool:'read',targetPath:'docs/a.md',principal:{type:'human',id:'alice',source:'cli-claim'}});
if(!rec.minted_by||rec.minted_by.type!=='human'||rec.minted_by.id!=='alice')process.exit(1);
if(rec.minted_by.authenticated!==false)process.exit(1);
if(rec.minted_by.source!=='cli-claim'||rec.execution_id!==t||!rec.created_at)process.exit(1);
" && ok "approval with principal succeeds + records minter" || bad "approval attribution"

node -e "
const ap=require('$ROOT/scripts/policy-approval');
try{ap.approve({thread:'phasea-x',tool:'read',targetPath:'docs/a.md'});process.exit(1);}catch(e){if(!/requires a principal/.test(e.message))process.exit(1);}
try{ap.approve({thread:'phasea-x',tool:'read',targetPath:'docs/a.md',principal:null});process.exit(1);}catch(e){if(!/requires a principal/.test(e.message))process.exit(1);}
try{ap.approve({thread:'phasea-x',tool:'read',targetPath:'docs/a.md',principal:{type:'human',source:'cli'}});process.exit(1);}catch(e){if(!/principal id/.test(e.message))process.exit(1);}
" && ok "anonymous/missing/malformed minter refused" || bad "approval fail-closed"

# Claimed human is NEVER recorded authenticated.
node -e "
const ap=require('$ROOT/scripts/policy-approval');
try{ap.approve({thread:'phasea-x',tool:'read',targetPath:'docs/a.md',principal:{type:'human',id:'mallory',source:'cli-claim',authenticated:true}});process.exit(1);}catch(e){if(!/must not claim authenticated/.test(e.message))process.exit(1);}
" && ok "human authenticated:true claim rejected" || bad "human boundary"
rm -rf "$ROOT/.opencode/state/phasea-appr-"* "$ROOT/.opencode/state/phasea-x"

# ── Smuggling / malformed ─────────────────────────────────────────────────
node -e "
const id=require('$ROOT/scripts/execution-identity');
const good=id.createLauncherIdentity({agent:'analyzer',executionId:'e',source:'s'});
for(const evil of [{...good,admin:true},{...good,principal:{...good.principal,authenticated:true,clearance:'root'}},{...good,role:'gatekeeper',principal:{...good.principal,id:'gatekeeper'}},{...good,execution_id:''},{...good,worker:{index:-1,id:'e'}},'x',null,42]){
  try{id.validateAgentIdentity(evil);console.error('accepted '+JSON.stringify(evil).slice(0,60));process.exit(1);}catch(e){if(!/execution-identity/.test(e.message))process.exit(1);}
}
" && ok "smuggled/malformed identity rejected" || bad "identity validation"

# ── Evidence: failure path preserves identity ─────────────────────────────
AIW_AVAILABLE_MODELS="$FX" node -e "
const a=require('$ROOT/scripts/runtime-adapter');
const id=require('$ROOT/scripts/execution-identity');
const e=id.createLauncherIdentity({agent:'analyzer',executionId:'phasea-fail',source:'t'});
const r=a.send('phasea-fail',{prompt:'x',model_id:'p/m',agent_identity:e,tool:'shell',targetPath:'docs/a.md'});
if(!r.denied||!r.trace_id)process.exit(1);
const fs=require('fs');
const t=fs.readFileSync('$ROOT/.opencode/state/phasea-fail/trace.jsonl','utf8').trim().split('\n').map((l)=>JSON.parse(l)).find((x)=>x.trace_id===r.trace_id);
if(!t||t.agent_identity.execution_id!=='phasea-fail'||t.guardrail!=='deny')process.exit(1);
" && ok "identity survives denial/failure path" || bad "failure-path identity"
rm -rf "$ROOT/.opencode/state/phasea-fail"

# ── Backward compatibility ────────────────────────────────────────────────
node -e "
const id=require('$ROOT/scripts/execution-identity');
if(id.describeIdentity({agent:'analyzer'})!=='legacy')process.exit(1);
if(id.describeIdentity(id.createLauncherIdentity({agent:'analyzer',executionId:'e',source:'s'}))!=='canonical')process.exit(1);
if(id.describeIdentity(null)!=='unknown'||id.describeIdentity({})!=='unknown'||id.describeIdentity({agent:''})!=='unknown')process.exit(1);
if(id.describeIdentity({agent:'analyzer',identity_version:999})!=='unknown')process.exit(1);
" && ok "legacy/canonical/unknown distinguished (legacy never authorized)" || bad "back-compat classifier"

# ── Secrets ───────────────────────────────────────────────────────────────
if AIW_AVAILABLE_MODELS="$FX" node "$ROOT/scripts/aiw-run.js" --template quick-fix --thread "phasea-sec" "probe" > /tmp/phasea-sec.txt 2>&1; then
  # Secret VALUES (not descriptive prose such as "holds zero credentials").
  if grep -rE "sk-[A-Za-z0-9]{8,}|ghp_[A-Za-z0-9]{8,}|gho_[A-Za-z0-9]{8,}|api[_-]?key[\"' ]*[:=]|Bearer [A-Za-z0-9]|password[\"' ]*[:=]" /tmp/phasea-sec.txt "$ROOT/.opencode/state/phasea-sec/trace.jsonl" "$ROOT/.opencode/state/phasea-sec/checkpoint.jsonl" 2>/dev/null | grep -q .; then
    bad "secrets in identity evidence"
  else
    ok "no secrets in identity/evidence"
  fi
else
  bad "fixture run for secrets scan"
fi
rm -rf "$ROOT/.opencode/state/phasea-sec"

# ── Trace schema admits canonical + legacy, rejects smuggled ─────────────
node -e "
const Ajv=require('$ROOT/node_modules/ajv');const addF=require('$ROOT/node_modules/ajv-formats');
const ajv=new Ajv({strict:true});addF(ajv);
const schema=require('$ROOT/config/trace-envelope-schema.json');
const id=require('$ROOT/scripts/execution-identity');
const mk=(ai)=>({trace_id:'t',thread_id:'th',model:'p/m',agent_identity:ai,tool_calls:[],guardrail:'allow',ts:new Date().toISOString()});
const v=ajv.compile(schema);
if(!v(mk(id.createLauncherIdentity({agent:'analyzer',executionId:'x',source:'s'}))))process.exit(1);
if(!v(mk(id.createWorkerIdentity({agent:'analyzer',parentExecutionId:'p',workerIndex:0,source:'s'}))))process.exit(1);
if(!v(mk({agent:'analyzer'})))process.exit(1);
if(v(mk({...id.createLauncherIdentity({agent:'analyzer',executionId:'x',source:'s'}),admin:true})))process.exit(1);
" && ok "trace schema admits canonical/legacy, rejects smuggled" || bad "trace schema"

echo ""
echo "execution-identity: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]

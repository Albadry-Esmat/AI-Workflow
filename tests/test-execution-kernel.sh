#!/usr/bin/env bash
# T7 MVP: deterministic execution-kernel suite (no network, no live model).
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

# 1. js-yaml present (REQ-FIX-001 regression)
node -e "require('$ROOT/node_modules/js-yaml')" && ok "js-yaml resolvable" || bad "js-yaml missing"
# 2. configs parse
node -e "require('js-yaml').load(require('fs').readFileSync('$ROOT/config/policy-gateway.yaml','utf8'))" && ok "policy-gateway.yaml parses" || bad "policy parse"
node -e "require('js-yaml').load(require('fs').readFileSync('$ROOT/config/task-router.yaml','utf8'))" && ok "task-router.yaml parses" || bad "router parse"
# 3. gateway deny-by-default
node -e "const g=require('$ROOT/scripts/policy-gateway'); const r=g.check({tool:'write',path:'docs/a.md'}); if(r.decision!=='deny')process.exit(1)" && ok "gateway denies write without approval" || bad "gateway write"
node -e "const g=require('$ROOT/scripts/policy-gateway'); const r=g.check({tool:'read',path:'.env'}); if(r.decision!=='deny')process.exit(1)" && ok "gateway denies .env" || bad "gateway env"
node -e "const g=require('$ROOT/scripts/policy-gateway'); const r=g.check({tool:'read',path:'docs/a.md'}); if(r.decision!=='allow')process.exit(1)" && ok "gateway allows read docs/" || bad "gateway allow"
# 4. router static mapping (model_requirement → manifest; tier_hint metadata only;
#    null task model = inherit runtime/session model via precedence)
node -e "const r=require('$ROOT/scripts/task-router'); const q=r.route('quick-fix'); if(q.model_id!==null||q.model_requirement!=='tasks.quick-fix'||q.tier_hint!=='cheap')process.exit(1)" && ok "router quick-fix->inherit" || bad "router"
node -e "const r=require('$ROOT/scripts/task-router'); const q=r.route('release-review'); if(q.model_id!==null||q.model_requirement!=='tasks.release-review')process.exit(1)" && ok "router release-review->inherit" || bad "router2"
# 5. checkpointer resume + idempotent task
node -e "
const c=require('$ROOT/scripts/checkpointer'); const t='test-thread-'+Date.now();
c.appendCheckpoint(t,{kind:'run',phase:'started'});
const a=c.task(t,'demo',{x:1},()=>({v:1}));
const b=c.task(t,'demo',{x:1},()=>({v:999}));
if(a.cached||!b.cached||b.result.v!==1)process.exit(1);
if(!c.latestCheckpoint(t))process.exit(1);
" && ok "checkpointer resume + idempotent task" || bad "checkpointer"
# 6. trace envelope writes valid record (model_id authoritative)
node -e "
const tr=require('$ROOT/scripts/trace-envelope'); const t='test-trace-'+Date.now();
const rec=tr.writeTrace(t,{model:'openai/gpt-5.6',model_id:'openai/gpt-5.6',model_resolution:{model_requirement:'tasks.quick-fix',requested_model_id:null,requested_agent_override:null,global_override:null,runtime_model:'openai/gpt-5.6',runtime_model_source:'test',selected_model_id:'openai/gpt-5.6',selection_source:'runtime',explicit_override:false,provider:'openai',fallback_used:false,fallback_reason:null,fallback_index:0,declared_candidates:[],availability_source:'test',availability_verified:true,resolution_result:'resolved'},tool_calls:[],guardrail:'allow'});
const Ajv=require('$ROOT/node_modules/ajv'); const addFormats=require('$ROOT/node_modules/ajv-formats');
const ajv=new Ajv({strict:true}); addFormats(ajv);
const schema=require('$ROOT/config/trace-envelope-schema.json');
if(!ajv.compile(schema)(rec))process.exit(1);
" && ok "trace envelope validates" || bad "trace"
# 7. aiw run vertical slice (deterministic: fixture catalog + fixture session
# model satisfy the precedence gate; no provider auth required)
AIW_AVAILABLE_MODELS="openai/gpt-5.6,openai/gpt-5.4" AIW_RUNTIME_MODEL="openai/gpt-5.6" \
node "$ROOT/scripts/aiw-run.js" --template quick-fix --thread "test-run-$RANDOM" --path docs/a.md "fix typo" > /tmp/aiw-run-out.json && ok "aiw run quick-fix slice" || bad "aiw run"
# 8. aiw plan still works (no regression)
node "$ROOT/scripts/plan-workflow.js" "smoke" --json > /dev/null && ok "aiw plan --json" || bad "aiw plan"
# 9. benchmark 8/8 (Phase 2)
node "$ROOT/scripts/evaluate-execution-kernel.js" --mode det --out /tmp/ek-bench.json > /dev/null && ok "benchmark 8/8 det" || bad "benchmark"
# 10. scoped approval single-use (Phase 2)
node -e "
const ap=require('$ROOT/scripts/policy-approval'); const g=require('$ROOT/scripts/policy-gateway');
const t='test-appr-'+Date.now();
const rec=ap.approve({thread:t,tool:'shell',targetPath:'docs/a.md',ttlSeconds:600,principal:{type:'human',id:'test-minter',source:'test'}});
const first=g.check({tool:'shell',path:'docs/a.md',threadId:t,approval:rec.token});
const second=g.check({tool:'shell',path:'docs/a.md',threadId:t,approval:rec.token});
if(first.decision!=='allow'||second.decision!=='deny')process.exit(1);
" && ok "approval single-use + scope" || bad "approval"
# 11. codex adapter plan path (Phase 2, model_id authoritative)
node -e "const c=require('$ROOT/scripts/codex-adapter'); const r=c.send('test-codex-'+Date.now(),{prompt:'x',model_id:'github-copilot/claude-sonnet-4.6',tool:'read',targetPath:'docs/a.md'}); if(r.denied)process.exit(1)" && ok "codex adapter allow path" || bad "codex"
# 12. retrieval A/B flag (Phase 2)
node -e "const {retrieve}=require('$ROOT/scripts/retrieve'); const r=retrieve('kernel','vector-trial'); if(r.trial!=='vector-trial')process.exit(1)" && ok "retrieval vector-trial flag" || bad "retrieval"
# 13. cross-thread store (Phase 3)
node -e "const s=require('$ROOT/scripts/store'); s.put('test-ns','k1',{v:1}); const g=s.get('test-ns','k1'); if(!g||g.value.v!==1)process.exit(1)" && ok "store put/get" || bad "store"
# 14. orchestrator-workers fan-out (Phase 3; same fixture-gate convention as #7)
AIW_AVAILABLE_MODELS="openai/gpt-5.6,openai/gpt-5.4" AIW_RUNTIME_MODEL="openai/gpt-5.6" \
node "$ROOT/scripts/orchestrate-workers.js" --parent "test-parent-$RANDOM" --template quick-fix "a" "b" > /dev/null && ok "workers fan-out" || bad "workers"
# 15. release-review fails closed without --yes (Phase 4)
node "$ROOT/scripts/release-review.js" --thread "test-rel-$RANDOM" 2>/dev/null && bad "release-review should fail closed" || ok "release-review fail-closed without --yes"
# 16. release-review approves with --yes + gate decision + green benchmark
# (Phase B: --yes alone authorizes nothing; fixture decision minted into an
# isolated registry — test-only minting, never a production path).
# Model precedence uses fixture catalog + fixture session (no provider auth).
export AIW_GATE_REGISTRY="/tmp/gd-kernel-$$-$(date +%s).jsonl"
export AIW_AVAILABLE_MODELS="openai/gpt-5.6,openai/gpt-5.4"
export AIW_RUNTIME_MODEL="openai/gpt-5.6"
TREL="test-rel-kernel-$RANDOM"
FIXHEAD=$(git -C "$ROOT" rev-parse HEAD)
node -e "
const pe=require('$ROOT/scripts/producer-evidence');
const re=require('$ROOT/scripts/review-evidence');
const id=require('$ROOT/scripts/execution-identity');
pe.record({agentIdentity:id.createLauncherIdentity({agent:'builder',executionId:'$TREL-producer',source:'test-fixture-phased'}),subjectHash:'$FIXHEAD',outcome:'completed',sourceRef:'$TREL-producer'});
re.record({reviewerIdentity:id.createLauncherIdentity({agent:'reviewer',executionId:'$TREL-review',source:'test-fixture-phased'}),subjectHash:'$FIXHEAD',executionId:'$TREL-review',outcome:'approve',reason:'kernel fixture review'});
" > /dev/null || { bad "release fixture evidence"; }
REL_DID=$(node -e "
const gd = require('$ROOT/scripts/gate-decisions');
const head = require('node:child_process').execFileSync('git', ['-C', '$ROOT', 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const rec = gd.record({ gate_id: 'release', gate_class: 'release', decision: 'approve', subject_kind: 'repo_head', subject_hash: head, principal: { type: 'human', id: 'test-releaser', authenticated: true, source: 'test-fixture' }, scope: {}, reason: 'kernel fixture release decision', execution_id: '$TREL', policy_version: '1.1.0' });
console.log(rec.decision_id);
")
node "$ROOT/scripts/release-review.js" --yes --decision-id "$REL_DID" --thread "$TREL" > /dev/null && ok "release-review decision authorized" || bad "release-review decision"
node -e "
const fs=require('fs');
const p='$ROOT/.opencode/state/producers/$FIXHEAD.jsonl';
const lines=fs.readFileSync(p,'utf8').split('\n').filter(Boolean).filter((l)=>!l.includes('test-fixture-phased'));
fs.writeFileSync(p,lines.join('\n')+(lines.length?'\n':''));
const r='$ROOT/.opencode/state/reviews/$FIXHEAD.jsonl';
const rlines=fs.readFileSync(r,'utf8').split('\n').filter(Boolean).filter((l)=>!l.includes('test-fixture-phased'));
fs.writeFileSync(r,rlines.join('\n')+(rlines.length?'\n':''));
" > /dev/null 2>&1 || true
# --yes alone cannot authorize.
node "$ROOT/scripts/release-review.js" --yes --thread "test-rel-$RANDOM" > /dev/null 2>&1 && bad "yes-alone authorized release" || ok "--yes alone rejected"
rm -f "$AIW_GATE_REGISTRY"; unset AIW_GATE_REGISTRY
# 17. cost dashboard emits JSON (Phase 4)
node "$ROOT/scripts/cost-dashboard.js" > /dev/null && ok "cost-dashboard" || bad "cost-dashboard"
# 17b. no AIW-owned model credentials: provider keys must not appear outside
# redaction lists (scripts/onboarding-o2.py) and null-fixture envs (evals/onboarding-o0)
if grep -rE "OPENAI_API_KEY|ANTHROPIC_API_KEY|GEMINI_API_KEY|PROVIDER_API_KEY" \
  "$ROOT/scripts/checkpointer.js" "$ROOT/scripts/policy-gateway.js" "$ROOT/scripts/policy-approval.js" \
  "$ROOT/scripts/trace-envelope.js" "$ROOT/scripts/task-router.js" "$ROOT/scripts/runtime-adapter.js" \
  "$ROOT/scripts/codex-adapter.js" "$ROOT/scripts/claude-adapter.js" "$ROOT/scripts/copilot-adapter.js" \
  "$ROOT/scripts/antigravity-adapter.js" "$ROOT/scripts/cursor-adapter.js" "$ROOT/scripts/gemini-adapter.js" \
  "$ROOT/scripts/aider-adapter.js" "$ROOT/scripts/adapter-factory.js" "$ROOT/scripts/runtime-auth.js" \
  "$ROOT/scripts/aiw-run.js" "$ROOT/scripts/evaluate-execution-kernel.js" "$ROOT/scripts/cost-dashboard.js" \
  "$ROOT/scripts/store.js" "$ROOT/scripts/orchestrate-workers.js" "$ROOT/scripts/release-review.js" \
  "$ROOT/scripts/retrieve.js" "$ROOT/config/policy-gateway.yaml" "$ROOT/config/task-router.yaml" \
  "$ROOT/.github/workflows/nightly-evaluation.yml" "$ROOT/.github/workflows/agent-review.yml" \
  "$ROOT/docs/execution-kernel.md" "$ROOT/aiw" 2>/dev/null; then
  bad "provider key reference in kernel surface"
else
  ok "no provider keys in kernel surface"
fi
# 18a. runtime-auth attests without secrets (environment-aware: proves live
# where authenticated, proves fail-closed shape everywhere)
node -e "
const {checkAuth} = require('$ROOT/scripts/runtime-auth');
const a = checkAuth('codex');
if (typeof a.installed !== 'boolean' || typeof a.authenticated !== 'boolean') process.exit(1);
if (!a.installed && a.authenticated) process.exit(1); // never authed when absent
const c = checkAuth('cursor');
if (c.authenticated && !/cursor/i.test(c.version || '')) process.exit(1); // non-Cursor binary must not pass
const d = require('$ROOT/scripts/live-dispatch');
if (!a.authenticated) {
  const r = d.dispatch('test-noauth', { adapter: 'codex', prompt: 'x', targetPath: '' });
  if (!r.failed || !/no-authenticated-runtime/.test(r.reason)) process.exit(1);
}
" && ok "runtime-auth attestation" || bad "runtime-auth"
# 18b. live-dispatch refuses unauthenticated runtimes (fail-closed)
node -e "
const d = require('$ROOT/scripts/live-dispatch');
const r = d.dispatch('test-live-refuse', { adapter: 'claude-code', prompt: 'x', targetPath: '' });
if (!r.failed || !/no-authenticated-runtime/.test(r.reason)) process.exit(1);
const r2 = d.dispatch('test-live-refuse', { adapter: 'codex', prompt: 'x', tool: 'shell', targetPath: '' });
if (!r2.denied) process.exit(1);
" && ok "live-dispatch fail-closed" || bad "live-dispatch"
# 18b. claude-code promotion fixture validates against live detect
node -e "
const fs = require('fs');
const fx = JSON.parse(fs.readFileSync('$ROOT/evals/execution-kernel/fixtures/claude-code.json', 'utf8'));
const a = require('$ROOT/scripts/claude-adapter');
const d = a.detect();
if (fx.adapter_id !== d.id) process.exit(1);
if (typeof d.installed !== 'boolean') process.exit(1);
const deny = a.send('test-fx-' + Date.now(), { prompt: 'x', model_id: 'github-copilot/claude-haiku-4.5', tool: fx.deny_case.tool, targetPath: fx.deny_case.path });
if (!deny.denied || !deny.reason.includes(fx.deny_case.reason_contains)) process.exit(1);
" && ok "claude-code fixture (detect + deny)" || bad "claude fixture"
# 18c. live-dispatch binds execution context without ReferenceError.
# A fast-failing codex shim (/tmp only, test-owned) lets auth pass so dispatch
# reaches the trace line, then fails closed on exec. Asserts OUR evidence
# binding (agent/gate/subject/execution carried into the trace) — never a
# model success claim.
mkdir -p /tmp/mrc-shimbin
printf '#!/usr/bin/env bash\nif [ "$1" = "--version" ]; then echo "codex-shim 0.0-test"; exit 0; fi\nif [ "$1" = "login" ]; then echo "Logged in (shim)"; exit 0; fi\necho "shim: no live model" >&2; exit 1\n' > /tmp/mrc-shimbin/codex
chmod +x /tmp/mrc-shimbin/codex
PATH="/tmp/mrc-shimbin:$PATH" node -e "
const d = require('$ROOT/scripts/live-dispatch');
const tid = 'test-livedisc-' + Date.now();
const r = d.dispatch(tid, { adapter: 'codex', prompt: 'x', targetPath: '',
  agent_identity: { agent: 'analyzer' }, gate_id: 'g-test', subject_hash: 'ab'.repeat(16), execution_id: 'ex-test' });
if (!r || !r.failed || !/codex exec failed/.test(r.reason)) { console.error('expected failed exec, got ' + JSON.stringify(r)); process.exit(1); }
const fs = require('fs');
const lines = fs.readFileSync('$ROOT/.opencode/state/' + tid + '/trace.jsonl', 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const bound = lines.filter((x) => x.trace_id === r.trace_id);
if (bound.length !== 1) process.exit(1);
const t = bound[0];
if (!t.agent_identity || t.agent_identity.agent !== 'analyzer') process.exit(1);
if (t.gate_id !== 'g-test' || t.subject_hash !== 'ab'.repeat(16) || t.execution_id !== 'ex-test') process.exit(1);
const rm = require('node:child_process');
rm.execFileSync('rm', ['-rf', '$ROOT/.opencode/state/' + tid]);
" && ok "live-dispatch binds execution context (fail-closed exec)" || bad "live-dispatch context binding"
# 18. full CLI matrix: detect never crashes, allow/deny enforced per adapter
node -e "
const map = {'claude-code':'claude-adapter','copilot-cli':'copilot-adapter','antigravity':'antigravity-adapter','cursor':'cursor-adapter','gemini-cli':'gemini-adapter','aider':'aider-adapter'};
for (const [id, mod] of Object.entries(map)) {
  const a = require('$ROOT/scripts/' + mod);
  const d = a.detect();
  if (!d || d.id !== id || typeof d.installed !== 'boolean') { console.error('bad detect: ' + id); process.exit(1); }
  const t = 'test-matrix-' + id + '-' + Date.now();
  a.start(t, { model_id: 'github-copilot/claude-haiku-4.5', pipeline: 'quick-review' });
  const okRes = a.send(t, { prompt: 'x', model_id: 'github-copilot/claude-haiku-4.5', tool: 'read', targetPath: 'docs/a.md' });
  const denyRes = a.send(t, { prompt: 'x', model_id: 'github-copilot/claude-haiku-4.5', tool: 'shell', targetPath: 'docs/a.md' });
  if (okRes.denied || !denyRes.denied) { console.error('bad enforce: ' + id); process.exit(1); }
}
" && ok "CLI matrix allow/deny (6 adapters)" || bad "CLI matrix"

echo ""
echo "kernel: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]

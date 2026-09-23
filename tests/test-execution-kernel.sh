#!/usr/bin/env bash
# T7 MVP: deterministic execution-kernel suite (no network, no live model).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
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
# 4. router static mapping
node -e "const r=require('$ROOT/scripts/task-router'); if(r.route('quick-fix').model_tier!=='cheap')process.exit(1)" && ok "router quick-fix->cheap" || bad "router"
node -e "const r=require('$ROOT/scripts/task-router'); if(r.route('release-review').model_tier!=='frontier')process.exit(1)" && ok "router release-review->frontier" || bad "router2"
# 5. checkpointer resume + idempotent task
node -e "
const c=require('$ROOT/scripts/checkpointer'); const t='test-thread-'+Date.now();
c.appendCheckpoint(t,{kind:'run',phase:'started'});
const a=c.task(t,'demo',{x:1},()=>({v:1}));
const b=c.task(t,'demo',{x:1},()=>({v:999}));
if(a.cached||!b.cached||b.result.v!==1)process.exit(1);
if(!c.latestCheckpoint(t))process.exit(1);
" && ok "checkpointer resume + idempotent task" || bad "checkpointer"
# 6. trace envelope writes valid record
node -e "
const tr=require('$ROOT/scripts/trace-envelope'); const t='test-trace-'+Date.now();
const rec=tr.writeTrace(t,{model:'cheap',tool_calls:[],guardrail:'allow'});
const Ajv=require('$ROOT/node_modules/ajv'); const addFormats=require('$ROOT/node_modules/ajv-formats');
const ajv=new Ajv({strict:true}); addFormats(ajv);
const schema=require('$ROOT/config/trace-envelope-schema.json');
if(!ajv.compile(schema)(rec))process.exit(1);
" && ok "trace envelope validates" || bad "trace"
# 7. aiw run vertical slice (deterministic)
node "$ROOT/scripts/aiw-run.js" --template quick-fix --thread "test-run-$RANDOM" --path docs/a.md "fix typo" > /tmp/aiw-run-out.json && ok "aiw run quick-fix slice" || bad "aiw run"
# 8. aiw plan still works (no regression)
node "$ROOT/scripts/plan-workflow.js" "smoke" --json > /dev/null && ok "aiw plan --json" || bad "aiw plan"
# 9. benchmark 8/8 (Phase 2)
node "$ROOT/scripts/evaluate-execution-kernel.js" --mode det --out /tmp/ek-bench.json > /dev/null && ok "benchmark 8/8 det" || bad "benchmark"
# 10. scoped approval single-use (Phase 2)
node -e "
const ap=require('$ROOT/scripts/policy-approval'); const g=require('$ROOT/scripts/policy-gateway');
const t='test-appr-'+Date.now();
const rec=ap.approve({thread:t,tool:'shell',targetPath:'docs/a.md',ttlSeconds:600});
const first=g.check({tool:'shell',path:'docs/a.md',threadId:t,approval:rec.token});
const second=g.check({tool:'shell',path:'docs/a.md',threadId:t,approval:rec.token});
if(first.decision!=='allow'||second.decision!=='deny')process.exit(1);
" && ok "approval single-use + scope" || bad "approval"
# 11. codex adapter plan path (Phase 2)
node -e "const c=require('$ROOT/scripts/codex-adapter'); const r=c.send('test-codex-'+Date.now(),{prompt:'x',model_tier:'balanced',tool:'read',targetPath:'docs/a.md'}); if(r.denied)process.exit(1)" && ok "codex adapter allow path" || bad "codex"
# 12. retrieval A/B flag (Phase 2)
node -e "const {retrieve}=require('$ROOT/scripts/retrieve'); const r=retrieve('kernel','vector-trial'); if(r.trial!=='vector-trial')process.exit(1)" && ok "retrieval vector-trial flag" || bad "retrieval"
# 13. cross-thread store (Phase 3)
node -e "const s=require('$ROOT/scripts/store'); s.put('test-ns','k1',{v:1}); const g=s.get('test-ns','k1'); if(!g||g.value.v!==1)process.exit(1)" && ok "store put/get" || bad "store"
# 14. orchestrator-workers fan-out (Phase 3)
node "$ROOT/scripts/orchestrate-workers.js" --parent "test-parent-$RANDOM" --template quick-fix "a" "b" > /dev/null && ok "workers fan-out" || bad "workers"
# 15. release-review fails closed without --yes (Phase 4)
node "$ROOT/scripts/release-review.js" --thread "test-rel-$RANDOM" 2>/dev/null && bad "release-review should fail closed" || ok "release-review fail-closed without --yes"
# 16. release-review approves with --yes + green benchmark (Phase 4)
node "$ROOT/scripts/release-review.js" --yes --thread "test-rel-$RANDOM" > /dev/null && ok "release-review --yes approved" || bad "release-review yes"
# 17. cost dashboard emits JSON (Phase 4)
node "$ROOT/scripts/cost-dashboard.js" > /dev/null && ok "cost-dashboard" || bad "cost-dashboard"

echo ""
echo "kernel: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]

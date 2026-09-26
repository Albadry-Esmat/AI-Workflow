#!/usr/bin/env bash
# Runtime compatibility gate regression suite (v2 precedence).
# Precedence: agent/task override → global agent model → runtime/session model.
# Inheritance is normal (NOT fallback). Explicit overrides fail closed with no
# silent inheritance. Deterministic: AIW_AVAILABLE_MODELS / AIW_RUNTIME_MODEL
# fixtures only — never live provider auth.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PASS=0; FAIL=0
ok() { echo "  PASS: $1"; PASS=$((PASS+1)); }
bad() { echo "  FAIL: $1"; FAIL=$((FAIL+1)); }

# Fixtures: no Copilot anywhere (regression for the reported startup mismatch
# "Agent primary's configured model github-copilot/claude-sonnet-4.6 is not valid").
LIVE_NO_COPILOT="opencode/muse-spark-1.3-contributor-free,openai/gpt-5.4,lmstudio-llm/qwen/qwen3.6-35b-a3b"
FX_OPENAI="openai/gpt-5.6,openai/gpt-5.4"
SESSION_OPENAI="openai/gpt-5.6"
NOSESSION="env -u AIW_RUNTIME_MODEL -u OPENCODE_MODEL"

# 1. Runtime inheritance: no overrides + session available → PASS, source runtime.
if AIW_AVAILABLE_MODELS="$FX_OPENAI" AIW_RUNTIME_MODEL="$SESSION_OPENAI" node "$ROOT/scripts/check-model-runtime-compatibility.js" --out /tmp/mrc-pass.json > /tmp/mrc-pass.txt 2>&1; then
  node -e "
const rep=require('/tmp/mrc-pass.json');
if(rep.summary.verdict!=='pass')process.exit(1);
for(const r of rep.records){
  if(r.selection_source!=='runtime')process.exit(1);
  if(r.explicit_override!==false)process.exit(1);
  if(r.selected_model!=='$SESSION_OPENAI')process.exit(1);
  if(r.runtime_model!=='$SESSION_OPENAI')process.exit(1);
}
if(rep.records.length!==27)process.exit(1);
" && ok "inheritance: session model resolves all 27 (source runtime)" || bad "inheritance resolution records"
else
  bad "inheritance available"; cat /tmp/mrc-pass.txt
fi

# 2. Changing the runtime-selected model changes inherited resolution.
if AIW_AVAILABLE_MODELS="$FX_OPENAI" AIW_RUNTIME_MODEL="openai/gpt-5.4" node "$ROOT/scripts/check-model-runtime-compatibility.js" --out /tmp/mrc-switch.json > /dev/null 2>&1; then
  node -e "
const rep=require('/tmp/mrc-switch.json');
if(!rep.records.every((r)=>r.selected_model==='openai/gpt-5.4'&&r.selection_source==='runtime'))process.exit(1);
" && ok "session switch changes inherited resolution" || bad "session switch"
else
  bad "session switch gate must pass"
fi

# 3. Provider changes require no repo change: manifest carries zero exact pins.
node -e "
const yaml=require('js-yaml');const fs=require('fs');
const m=yaml.load(fs.readFileSync('$ROOT/config/model-requirements.yml','utf8'));
if(m.global_agent_model!==null)process.exit(1);
for(const s of ['agents','tasks'])for(const n of Object.keys(m[s])){
  if(m[s][n].model!==null&&m[s][n].model!==undefined){console.error('pinned '+s+'.'+n);process.exit(1);}
  if((m[s][n].fallbacks||[]).length!==0)process.exit(1);
}
if(Object.keys(m.agents).length!==24||Object.keys(m.tasks).length!==3)process.exit(1);
" && ok "provider-neutral manifest (0 pins, global null)" || bad "manifest neutrality"
# ...and an lmstudio session resolves without any repo edit.
if AIW_AVAILABLE_MODELS="lmstudio-llm/qwen/qwen3.6-35b-a3b,openai/gpt-5.4" AIW_RUNTIME_MODEL="lmstudio-llm/qwen/qwen3.6-35b-a3b" node "$ROOT/scripts/check-model-runtime-compatibility.js" --out /tmp/mrc-lmstudio.json > /dev/null 2>&1; then
  ok "lmstudio session resolves with no repo change"
else
  bad "lmstudio session resolution"
fi

# 4. Precedence: agent override beats global (synthetic, deterministic).
node -e "
const r=require('$ROOT/scripts/resolve-model');
const entry=(model)=>({model,provider:'p',capabilities:['c'],fallbacks:[],on_unavailable:'fail_closed'});
const manifest={global_agent_model:'p/global-1',agents:{a:entry('p/agent-1')},tasks:{t:entry(null)}};
const rec=r.resolveWithPrecedence('agent','a',{manifest,available:new Set(['p/agent-1','p/global-1','p/session-1']),availabilitySource:'test',globalModel:'p/global-1',sessionModel:'p/session-1',sessionSource:'test'});
if(rec.selected_model_id!=='p/agent-1'||rec.selection_source!=='agent_override'||rec.explicit_override!==true)process.exit(1);
" && ok "precedence: agent override beats global" || bad "agent-beats-global"

# 5. Precedence: global beats runtime.
node -e "
const r=require('$ROOT/scripts/resolve-model');
const entry=(model)=>({model,provider:null,capabilities:['c'],fallbacks:[],on_unavailable:'fail_closed'});
const manifest={global_agent_model:'p/global-1',agents:{a:entry(null)},tasks:{t:entry(null)}};
const rec=r.resolveWithPrecedence('agent','a',{manifest,available:new Set(['p/global-1','p/session-1']),availabilitySource:'test',sessionModel:'p/session-1',sessionSource:'test'});
if(rec.selected_model_id!=='p/global-1'||rec.selection_source!=='global_override'||rec.explicit_override!==true)process.exit(1);
const rec2=r.resolveWithPrecedence('task','t',{manifest,available:new Set(['p/global-1','p/session-1']),availabilitySource:'test',sessionModel:'p/session-1',sessionSource:'test'});
if(rec2.selected_model_id!=='p/global-1'||rec2.selection_source!=='global_override')process.exit(1);
" && ok "precedence: global beats runtime (agents + tasks)" || bad "global-beats-runtime"

# 6. Runtime used when both absent (synthetic).
node -e "
const r=require('$ROOT/scripts/resolve-model');
const entry={model:null,provider:null,capabilities:['c'],fallbacks:[],on_unavailable:'fail_closed'};
const manifest={global_agent_model:null,agents:{a:entry},tasks:{}};
const rec=r.resolveWithPrecedence('agent','a',{manifest,available:new Set(['p/session-1']),availabilitySource:'test',sessionModel:'p/session-1',sessionSource:'test'});
if(rec.selected_model_id!=='p/session-1'||rec.selection_source!=='runtime'||rec.explicit_override!==false)process.exit(1);
if(rec.provider!=='p')process.exit(1);
" && ok "precedence: runtime used when overrides absent" || bad "runtime-default"

# 7. Explicit agent override available → pass.
node -e "
const r=require('$ROOT/scripts/resolve-model');
const manifest={global_agent_model:null,agents:{a:{model:'p/agent-1',provider:'p',capabilities:['c'],fallbacks:[],on_unavailable:'fail_closed'}},tasks:{}};
const rec=r.resolveWithPrecedence('agent','a',{manifest,available:new Set(['p/agent-1']),availabilitySource:'test',sessionModel:'p/session-1',sessionSource:'test'});
if(rec.resolution_result!=='resolved'||rec.selected_model_id!=='p/agent-1')process.exit(1);
" && ok "explicit override available → pass" || bad "explicit available"

# 8. Explicit unavailable → BLOCK, no silent fallback to global/runtime.
node -e "
const r=require('$ROOT/scripts/resolve-model');
const manifest={global_agent_model:'p/global-1',agents:{a:{model:'p/agent-1',provider:'p',capabilities:['c'],fallbacks:[],on_unavailable:'fail_closed'}},tasks:{}};
const rec=r.resolveWithPrecedence('agent','a',{manifest,available:new Set(['p/global-1','p/session-1']),availabilitySource:'test',sessionModel:'p/session-1',sessionSource:'test'});
if(rec.resolution_result!=='fail_closed'||rec.selected_model_id!==null)process.exit(1);
if(rec.selection_source!=='agent_override'||rec.explicit_override!==true)process.exit(1);
try{r.resolveOrThrow('agent','a',['p/global-1','p/session-1'],'test',{manifest,sessionModel:'p/session-1',sessionSource:'test'});process.exit(1);}catch(e){if(e.code!=='NO_AVAILABLE_MODEL')process.exit(1);}
" && ok "explicit unavailable → block (no inheritance)" || bad "explicit strict"

# 9. Global override available → inherited by agents without overrides.
node -e "
const r=require('$ROOT/scripts/resolve-model');
const entry={model:null,provider:null,capabilities:['c'],fallbacks:[],on_unavailable:'fail_closed'};
const manifest={global_agent_model:'p/global-1',agents:{a:entry,b:entry},tasks:{}};
for(const n of ['a','b']){
  const rec=r.resolveWithPrecedence('agent',n,{manifest,available:new Set(['p/global-1','p/session-1']),availabilitySource:'test',sessionModel:'p/session-1',sessionSource:'test'});
  if(rec.selected_model_id!=='p/global-1'||rec.selection_source!=='global_override'||rec.explicit_override!==true)process.exit(1);
}
" && ok "global available → inherited" || bad "global inherit"

# 10. Global unavailable → dependent agents block (session cannot rescue them).
node -e "
const r=require('$ROOT/scripts/resolve-model');
const entry={model:null,provider:null,capabilities:['c'],fallbacks:[],on_unavailable:'fail_closed'};
const manifest={global_agent_model:'p/global-1',agents:{a:entry},tasks:{}};
const rec=r.resolveWithPrecedence('agent','a',{manifest,available:new Set(['p/session-1']),availabilitySource:'test',sessionModel:'p/session-1',sessionSource:'test'});
if(rec.resolution_result!=='fail_closed'||rec.selection_source!=='global_override')process.exit(1);
" && ok "global unavailable → dependents block" || bad "global strict"

# 11. Agent override supersedes global when both available.
node -e "
const r=require('$ROOT/scripts/resolve-model');
const manifest={global_agent_model:'p/global-1',agents:{a:{model:'p/agent-1',provider:'p',capabilities:['c'],fallbacks:[],on_unavailable:'fail_closed'}},tasks:{}};
const rec=r.resolveWithPrecedence('agent','a',{manifest,available:new Set(['p/agent-1','p/global-1']),availabilitySource:'test',sessionModel:'p/session-1',sessionSource:'test'});
if(rec.selected_model_id!=='p/agent-1'||rec.selection_source!=='agent_override')process.exit(1);
" && ok "agent override supersedes global" || bad "override-supersedes"

# 12. No runtime-selected model → block with actionable error (never guess).
if $NOSESSION node "$ROOT/scripts/check-model-runtime-compatibility.js" --out /tmp/mrc-nosession.json > /tmp/mrc-nosession.txt 2>&1; then
  bad "missing session must BLOCK"
else
  if grep -q "has no model override and no current runtime model could be resolved" /tmp/mrc-nosession.txt; then
    node -e "
const rep=require('/tmp/mrc-nosession.json');
if(rep.summary.verdict!=='block')process.exit(1);
if(!rep.records.every((x)=>x.resolution==='UNAVAILABLE'&&x.selected_model===null&&x.selection_source==='runtime'&&x.explicit_override===false))process.exit(1);
" && ok "no session → fail closed (nothing selected, nothing guessed)" || bad "no-session records"
  else
    bad "missing actionable no-session error"; cat /tmp/mrc-nosession.txt
  fi
fi

# 13. Runtime-selected model absent from catalog → block.
if AIW_AVAILABLE_MODELS="openai/gpt-5.4" AIW_RUNTIME_MODEL="openai/gpt-5.6" node "$ROOT/scripts/check-model-runtime-compatibility.js" --out /tmp/mrc-absent.json > /tmp/mrc-absent.txt 2>&1; then
  bad "absent session model must BLOCK"
else
  grep -q "absent from the live runtime catalog" /tmp/mrc-absent.txt \
    && ok "session absent from catalog → block" || { bad "absent-session error"; cat /tmp/mrc-absent.txt; }
fi

# 14. Declared fallbacks still honored for explicit overrides (manifest order only).
node -e "
const r=require('$ROOT/scripts/resolve-model');
const req={model:'p/required-1.0',fallbacks:['p/fallback-1.0'],on_unavailable:'fail_closed'};
const rec=r.resolveRequirement(req,new Set(['p/fallback-1.0']),'test','agents.synthetic');
if(rec.resolution_result!=='fallback'||rec.selected_model_id!=='p/fallback-1.0'||!rec.fallback_used)process.exit(1);
const req2={model:'p/model-A',fallbacks:['p/model-B','p/model-C'],on_unavailable:'fail_closed'};
const r1=r.resolveRequirement(req2,new Set(['p/model-C','p/model-B']),'test','tasks.synthetic');
if(r1.selected_model_id!=='p/model-B')process.exit(1);
" && ok "declared fallbacks honored in manifest order" || bad "declared fallbacks"

# 15. No implicit fallback: available-but-undeclared model never wins.
node -e "
const r=require('$ROOT/scripts/resolve-model');
const req={model:'p/required-1.0',fallbacks:[],on_unavailable:'fail_closed'};
const rec=r.resolveRequirement(req,new Set(['p/other-1.0']),'test','agents.synthetic');
if(rec.resolution_result!=='fail_closed')process.exit(1);
" && ok "no implicit fallback (undeclared model never selected)" || bad "implicit fallback"

# 16. Provider-scoped mismatch: copilot requirement never satisfied by openai.
node -e "
const r=require('$ROOT/scripts/resolve-model');
const manifest={global_agent_model:null,agents:{primary:{model:'github-copilot/claude-sonnet-4.6',provider:'github-copilot',capabilities:['c'],fallbacks:[],on_unavailable:'fail_closed'}},tasks:{}};
const rec=r.resolveWithPrecedence('agent','primary',{manifest,available:new Set(['opencode/muse-spark-1.3-contributor-free','openai/gpt-5.4']),'availabilitySource':'test',sessionModel:'openai/gpt-5.4',sessionSource:'test'});
if(rec.resolution_result!=='fail_closed')process.exit(1);
" && ok "provider-scoped mismatch → no cross-provider substitution" || bad "provider scope"

# 17. Projection: inherit → no per-agent model; deterministic.
if node "$ROOT/scripts/sync-opencode-models.js" --check > /tmp/mrc-drift.txt 2>&1; then
  node -e "
const cfg=require('$ROOT/opencode.json');
if('model' in cfg){console.error('top-level model must be absent (global null)');process.exit(1);}
for(const [n,e] of Object.entries(cfg.agent)){if('model' in e){console.error('pinned '+n);process.exit(1);}}
const fs=require('fs');const path=require('path');
const dir=path.join('$ROOT','.opencode','agent');
for(const f of fs.readdirSync(dir)){
  if(!f.endsWith('.md'))continue;
  const text=fs.readFileSync(path.join(dir,f),'utf8');
  const fm=text.split('\n');
  if(fm[0].trim()!=='---')continue;
  for(let i=1;i<fm.length;i++){
    if(fm[i].trim()==='---')break;
    if(/^\s*model:/.test(fm[i])){console.error('frontmatter pin in '+f);process.exit(1);}
  }
}
" && ok "projection: inherited agents carry no hardcoded model (opencode.json + agent-md)" || bad "projection fields"
else
  bad "projection drift"; cat /tmp/mrc-drift.txt
fi
node "$ROOT/scripts/sync-opencode-models.js" --write > /dev/null 2>&1 \
  && node "$ROOT/scripts/sync-opencode-models.js" --check > /dev/null 2>&1 \
  && ok "projection deterministic (write idempotent)" || bad "projection idempotence"

# 18. Resolution evidence: audit fields + SHA + timestamp, no secrets.
node -e "
const rep=require('/tmp/mrc-pass.json');
const must=['requirement_key','requested_agent_override','global_override','runtime_model','runtime_model_source','resolved_model','selected_model','selection_source','explicit_override','provider','fallback_used','resolution','resolution_reason','availability_source','availability_verified','head_sha','timestamp'];
for(const rec of rep.records){
  for(const k of must){ if(!(k in rec)){console.error('missing '+k);process.exit(1);} }
  if(!rec.requirement_key.match(/^(agents|tasks)\./))process.exit(1);
  if(rec.provider!=='openai')process.exit(1);
  if(rec.head_sha!=='unknown'&&!/^[0-9a-f]{4,40}/.test(rec.head_sha))process.exit(1);
  if(isNaN(Date.parse(rec.timestamp)))process.exit(1);
}
if(rep.availability_source!=='env-override')process.exit(1);
if(rep.runtime_model!='$SESSION_OPENAI'||rep.global_agent_model!==null)process.exit(1);
" && ok "resolution evidence carries audit fields" || bad "resolution evidence"

# 19. GitHub Copilot regression: Copilot disconnected, OpenAI session → all inherit.
if AIW_AVAILABLE_MODELS="$LIVE_NO_COPILOT" AIW_RUNTIME_MODEL="openai/gpt-5.4" node "$ROOT/scripts/check-model-runtime-compatibility.js" --out /tmp/mrc-copilot.json > /tmp/mrc-copilot.txt 2>&1; then
  node -e "
const rep=require('/tmp/mrc-copilot.json');
if(!rep.records.every((r)=>r.selected_model==='openai/gpt-5.4'&&r.selection_source==='runtime'))process.exit(1);
" && ok "copilot disconnected → inherited OpenAI resolves (startup mismatch gone)" || bad "copilot regression records"
else
  bad "copilot-disconnected must PASS"; cat /tmp/mrc-copilot.txt
fi

# 20. Session discovery: env precedence + invalid fail-closed + never guess.
node -e "
const d=require('$ROOT/scripts/runtime-session-model');
process.env.AIW_RUNTIME_MODEL='p/aiw-1'; process.env.OPENCODE_MODEL='p/oc-1';
let s=d.getSessionModel();
if(s.model!=='p/aiw-1'||s.source!=='env:AIW_RUNTIME_MODEL')process.exit(1);
delete process.env.AIW_RUNTIME_MODEL;
s=d.getSessionModel();
if(s.model!=='p/oc-1'||s.source!=='env:OPENCODE_MODEL')process.exit(1);
process.env.AIW_RUNTIME_MODEL='vague-tier!!bad';
s=d.getSessionModel();
if(s.model!==null||!s.invalid)process.exit(1);
delete process.env.AIW_RUNTIME_MODEL; delete process.env.OPENCODE_MODEL;
" && ok "session discovery precedence (AIW > OPENCODE > file)" || bad "session discovery"
AIW_AVAILABLE_MODELS="$FX_OPENAI" AIW_RUNTIME_MODEL="not a model id" node -e "
const g=require('$ROOT/scripts/require-model-availability');
try{g.verifyAgent('primary');process.exit(1);}catch(e){if(e.code!=='NO_AVAILABLE_MODEL')process.exit(1);}
" && ok "invalid session model fails closed" || bad "invalid session"

# 21. Malformed/unknown IDs rejected (never resolve).
node -e "
const r=require('$ROOT/scripts/resolve-model');
for(const badId of ['cheap','balanced','', 'no-slash-model']){
  try{r.resolveRequirement({model:badId,fallbacks:[],on_unavailable:'fail_closed'},new Set([badId]),'test','agents.s');process.exit(1);}catch(e){if(!/vague|exact|empty/.test(e.message))process.exit(1);}
}
try{r.resolveAgent('no-such-agent',['p/m'],'test',{sessionModel:'p/m',sessionSource:'test'});process.exit(1);}catch(e){if(!/unknown agent/.test(e.message))process.exit(1);}
try{r.resolveRequirement({model:null,fallbacks:[],on_unavailable:'fail_closed'},new Set(['p/m']),'test','agents.s');process.exit(1);}catch(e){if(!/resolveWithPrecedence/.test(e.message))process.exit(1);}
" && ok "malformed/unknown model IDs rejected" || bad "malformed IDs"

# 22. opencode-provider parses live plaintext `opencode models` output.
# CI-safe: skipped when the opencode binary is absent (provider is best-effort []).
if ! command -v opencode >/dev/null 2>&1; then
  echo "  SKIP: opencode binary absent (provider best-effort [] applies)"
else
  node -e "
const p=require('$ROOT/scripts/runtime-integration/opencode-provider');
const models=p.listModels();
if(!Array.isArray(models)||models.length===0)process.exit(1);
for(const id of models){if(!/^[^\/\s]+\/[^\s]+$/.test(id))process.exit(1);}
" && ok "opencode-provider discovers live plaintext catalog" || bad "opencode-provider discovery"
fi

# 23. No secrets in diagnostics: gate output and report contain no credential material.
if grep -riE "api[_-]?key|Bearer sk-|ghp_[A-Za-z0-9]+|GITHUB_TOKEN=" /tmp/mrc-nosession.txt /tmp/mrc-nosession.json 2>/dev/null | grep -q .; then
  bad "secrets leaked in diagnostics"
else
  ok "no secrets in diagnostics"
fi

# 24. Launcher enforcement (failure): no session → fail closed, one concise
#     actionable error, no partial state.
if $NOSESSION node "$ROOT/scripts/aiw-run.js" --template quick-fix --thread mrc-t24-fail "enforcement probe" > /tmp/mrc-t24.txt 2>&1; then
  bad "launcher must fail closed without session"
else
  if grep -q "No model override is configured and no current runtime model could be resolved" /tmp/mrc-t24.txt \
    && [ ! -e "$ROOT/.opencode/state/mrc-t24-fail" ]; then
    ok "launcher failure path (concise error, no partial state)"
  else
    bad "launcher failure semantics"; cat /tmp/mrc-t24.txt
  fi
fi

# 25. Launcher enforcement (success): fixture session → verified resolution
#     consumed + bound into trace.
if AIW_AVAILABLE_MODELS="$FX_OPENAI" AIW_RUNTIME_MODEL="$SESSION_OPENAI" node "$ROOT/scripts/aiw-run.js" --template quick-fix --thread mrc-t25-ok "enforcement probe" > /tmp/mrc-t25.txt 2>&1; then
  node -e "
const fs=require('fs');
const recs=fs.readFileSync('$ROOT/.opencode/state/mrc-t25-ok/trace.jsonl','utf8').trim().split('\n').map((l)=>JSON.parse(l));
const bound=recs.filter((r)=>r.model_resolution);
if(bound.length===0)process.exit(1);
const mr=bound[0].model_resolution;
if(mr.model_requirement!=='tasks.quick-fix')process.exit(1);
if(mr.selection_source!=='runtime'||mr.explicit_override!==false)process.exit(1);
if(mr.selected_model_id!='$SESSION_OPENAI'||mr.resolution_result!=='resolved')process.exit(1);
if(mr.requested_agent_override!==null||mr.global_override!==null)process.exit(1);
if(bound[0].model!='$SESSION_OPENAI')process.exit(1);
" && ok "launcher success path (inherited resolution bound)" || bad "launcher success resolution binding"
else
  bad "launcher success path must exit 0"; cat /tmp/mrc-t25.txt
fi
rm -rf "$ROOT/.opencode/state/mrc-t24-fail" "$ROOT/.opencode/state/mrc-t25-ok"

# 26. Single resolution path: adapters consume but never resolve (no imports of
#     the resolver, availability interface, or enforcement module).
if grep -l "resolve-model\|runtime-models\|listAvailableModels\|require-model-availability" \
  "$ROOT"/scripts/runtime-adapter.js "$ROOT"/scripts/adapter-factory.js \
  "$ROOT"/scripts/codex-adapter.js "$ROOT"/scripts/claude-adapter.js "$ROOT"/scripts/copilot-adapter.js \
  "$ROOT"/scripts/cursor-adapter.js "$ROOT"/scripts/gemini-adapter.js "$ROOT"/scripts/antigravity-adapter.js \
  "$ROOT"/scripts/aider-adapter.js "$ROOT"/scripts/live-dispatch.js 2>/dev/null | grep -q .; then
  bad "adapter independently resolves (must only consume verified resolution)"
else
  ok "adapters never resolve (consume verified resolution only)"
fi

# 27. orchestrate-workers enforces the same gate (failure + fixture success).
if $NOSESSION node "$ROOT/scripts/orchestrate-workers.js" --parent mrc-t27-fail --template quick-fix "probe" > /tmp/mrc-t27.txt 2>&1; then
  bad "orchestrate-workers must fail closed without session"
else
  grep -q "No model override is configured" /tmp/mrc-t27.txt \
  && [ ! -e "$ROOT/.opencode/state/mrc-t27-fail" ] \
  && ok "orchestrate-workers failure path" || bad "orchestrate-workers failure semantics"
fi
if AIW_AVAILABLE_MODELS="$FX_OPENAI" AIW_RUNTIME_MODEL="$SESSION_OPENAI" node "$ROOT/scripts/orchestrate-workers.js" --parent mrc-t27-ok --template quick-fix "probe" > /tmp/mrc-t27-ok.txt 2>&1; then
  ok "orchestrate-workers fixture success path"
else
  bad "orchestrate-workers fixture success"; cat /tmp/mrc-t27-ok.txt
fi
rm -rf "$ROOT/.opencode/state/mrc-t27-fail" "$ROOT/.opencode/state/mrc-t27-ok" "$ROOT/.opencode/state/mrc-t27-ok-w0" "$ROOT/.opencode/state/store/mrc-t27-ok"

echo ""
echo "model-runtime-compatibility: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]

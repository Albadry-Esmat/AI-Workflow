#!/usr/bin/env bash
# Phase 4 governance tests: governance-change protection (G-13), reviewer/
# gatekeeper separation (G-11), extension budgets (G-6), terminal semantics
# (G-7), escalation wiring (G-15).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PASS=0; FAIL=0
ok() { echo "  PASS: $1"; PASS=$((PASS+1)); }
bad() { echo "  FAIL: $1"; FAIL=$((FAIL+1)); }
PY="$ROOT/.venv/bin/python"
[ -x "$PY" ] || PY="python3"

# 1. Control-plane classifier covers gate definitions, enforcement code,
#    guard contracts, model authority, and governance docs.
node -e "
const {loadPolicies,isGovernancePath}=require('$ROOT/scripts/policy-loader');
const {policies}=loadPolicies();
const yes=['skills/pipelines/quick-review.json','skills/schema/pipeline-schema.json',
 'scripts/gate-decisions.js','scripts/resolve-override.js','scripts/validate-pipeline-gates.py',
 'scripts/policy-gateway.js','scripts/release-review.js','scripts/escalate-case.js',
 '.opencode/skills/orchestrator/SKILL.md','.opencode/skills/security-guard/SKILL.md',
 '.opencode/skills/delegate/SKILL.md','.opencode/agent/gatekeeper.md',
 'docs/governance.md','docs/branch-protection.md','opencode.json',
 'config/model-requirements.yml','config/governance-decision-schema.json',
 'config/terminal-failure-schema.json','config/governance-flags-policy.json'];
const no=['docs/how-to-use.md','skills/knowledge/code-repair.md','scripts/cost-dashboard.js'];
for (const f of yes) if (!isGovernancePath(f,policies)){console.error('missed: '+f);process.exit(1);}
for (const f of no) if (isGovernancePath(f,policies)){console.error('overmatch: '+f);process.exit(1);}
" && ok "control-plane classifier covers governance surface" || bad "classifier"

# 2. CI requires governance approval: require-approval job fails closed without
#    the label (static shape check — the job must exist and reference the label).
if grep -q "require-approval" "$ROOT/.github/workflows/governance-gate.yml" \
  && grep -q "governance-approved" "$ROOT/.github/workflows/governance-gate.yml" \
  && grep -q "setFailed" "$ROOT/.github/workflows/governance-gate.yml"; then
  ok "governance-approval blocking check in CI"
else
  bad "governance-approval check"
fi
if grep -q "Deterministic review gate" "$ROOT/.github/workflows/agent-review.yml" \
  && grep -q "branch-protection" "$ROOT/docs/branch-protection.md" 2>/dev/null; then
  : # agent-review job presence already covered by workflow file existing
fi
if grep -q "Require status checks to pass" "$ROOT/docs/branch-protection.md" \
  && grep -q "require-approval" "$ROOT/docs/branch-protection.md"; then
  ok "branch-protection spec documents required checks"
else
  bad "branch-protection spec"
fi

# 3. Separation: reviewer produces only; gatekeeper enforces only.
node -e "
const cfg = require('$ROOT/opencode.json');
const rev = cfg.agent.reviewer.skills;
const gate = cfg.agent.gatekeeper;
if (!gate) process.exit(1);
if (rev.some(s => /guard|consistency|freezer|checklist|scorer|aggregator|traceability|drift|compliance-gate/.test(s))) process.exit(1);
if (!rev.every(s => /clean-code-review|security-review|implementation-completeness-auditor/.test(s))) process.exit(1);
if (gate.permission.edit !== 'deny' || gate.permission.bash !== 'deny') process.exit(1);
if (gate.skills.length < 10) process.exit(1);
const fs = require('fs');
if (!fs.existsSync('$ROOT/.opencode/agent/gatekeeper.md')) process.exit(1);
const manifest = require('js-yaml').load(fs.readFileSync('$ROOT/config/model-requirements.yml','utf8'));
if (!manifest.agents.gatekeeper || manifest.agents.gatekeeper.on_unavailable !== 'fail_closed') process.exit(1);
" && ok "reviewer/gatekeeper separation in config" || bad "separation"

# 4. Delegated outputs tagged + ineligible; debate sides carry lineage.
if grep -q "delegated: true" "$ROOT/.opencode/skills/delegate/SKILL.md" \
  && grep -q "ineligible as gate evidence" "$ROOT/.opencode/skills/delegate/SKILL.md" \
  && grep -q "gate laundering" "$ROOT/.opencode/skills/delegate/SKILL.md"; then
  ok "delegation tagging rule"
else
  bad "delegation tagging"
fi
if grep -q "participant_lineage" "$ROOT/.opencode/skills/plan-debate/SKILL.md" \
  && grep -q "participant_lineage" "$ROOT/.opencode/skills/multi-agent-debate/SKILL.md"; then
  ok "debate lineage required"
else
  bad "debate lineage"
fi

# 5. Extension budget: EXTEND without max_extensions fails; current tree passes.
if "$PY" scripts/validate-pipeline-gates.py > /dev/null 2>&1; then
  ok "gate validator passes with extension budgets"
else
  bad "gate validator"
fi
cp "$ROOT/skills/pipelines/full-pipeline.json" /tmp/fp-good.json
python3 -c "
import json
p = 'skills/pipelines/full-pipeline.json'
d = json.loads(open(p, encoding='utf-8').read())
esc = next(g for g in d['gates'] if g.get('gate_id') == 'GATE-ESC-001')
del esc['max_extensions']
open(p, 'w', encoding='utf-8').write(json.dumps(d, indent=2, ensure_ascii=False) + chr(10))
"
if "$PY" scripts/validate-pipeline-gates.py > /dev/null 2>&1; then
  bad "missing max_extensions not rejected"
else
  ok "missing max_extensions rejected"
fi
cp /tmp/fp-good.json "$ROOT/skills/pipelines/full-pipeline.json"
"$PY" scripts/validate-pipeline-gates.py > /dev/null 2>&1 && ok "tree restored clean" || bad "tree restore"

# 6. Terminal schema compiles; valid record passes, bare record fails.
node -e "
const Ajv = require('$ROOT/node_modules/ajv');
const addFormats = require('$ROOT/node_modules/ajv-formats');
const ajv = new Ajv({ strict: true }); addFormats(ajv);
const v = ajv.compile(require('$ROOT/config/terminal-failure-schema.json'));
const good = { code: 'FEEDBACK_LOOP_TERMINATED', reason_chain: ['loop hit 3 iterations', 'terminated'], failed_phase: 'phase-5', evidence_refs: ['tr-1'], decided_at: new Date().toISOString(), resolved: false };
const bare = { code: 'UNKNOWN_FAILURE', failed_phase: 'x', decided_at: new Date().toISOString() };
if (!v(good)) process.exit(1);
if (v(bare)) process.exit(1);
" && ok "terminal schema enforces reason chain + resolved flag" || bad "terminal schema"
if grep -q "terminal-failure-schema.json" "$ROOT/.opencode/skills/orchestrator/SKILL.md" \
  && grep -q "terminal_failures" "$ROOT/.opencode/skills/orchestrator/SKILL.md"; then
  ok "terminal records in orchestrator contract"
else
  bad "orchestrator terminal contract"
fi

# 7. Escalation CLI: legal path works, forbidden transitions and targets refuse.
node -e "
const { createCase, advance } = require('$ROOT/scripts/case-store');
createCase('g4-test', { actor: 'test' });
advance('g4-test', 'ANALYZING', { actor: 'test' });
" || { bad "case setup"; }
if node "$ROOT/scripts/escalate-case.js" --case g4-test --reason "phase4 test escalation" --actor test > /dev/null 2>&1; then
  node -e "
  const { readCase, readEvents } = require('$ROOT/scripts/case-store');
  if (readCase('g4-test').state !== 'ESCALATED') process.exit(1);
  if (!readEvents('g4-test').some(e => e.event === 'STATE_ESCALATED')) process.exit(1);
  " && ok "escalation transitions + audits" || bad "escalation record"
else
  bad "escalate-case run"
fi
if node "$ROOT/scripts/escalate-case.js" --case g4-test --reason x --to DONE > /dev/null 2>&1; then
  bad "illegal escalation target accepted"
else
  ok "illegal escalation target refused"
fi
if node "$ROOT/scripts/escalate-case.js" --case g4-test > /dev/null 2>&1; then
  bad "reasonless escalation accepted"
else
  ok "reasonless escalation rejected"
fi
rm -rf "$ROOT/artifacts/cases/g4-test"

echo ""
echo "governance-4: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]

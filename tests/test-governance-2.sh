#!/usr/bin/env bash
# Phase 2 governance tests: override migration (G-2), identity enforcement (G-3),
# relay-only primary (G-14), ci_mode + weakening-flag policy (G-4/G-12).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PASS=0; FAIL=0
ok() { echo "  PASS: $1"; PASS=$((PASS+1)); }
bad() { echo "  FAIL: $1"; FAIL=$((FAIL+1)); }
PY="$ROOT/.venv/bin/python"
[ -x "$PY" ] || PY="python3"

export AIW_GATE_REGISTRY="/tmp/gd2-test-$$-$(date +%s).jsonl"
export AIW_TEST_ROOT="$ROOT"
rm -f "$AIW_GATE_REGISTRY"
trap 'rm -f "$AIW_GATE_REGISTRY"' EXIT

GUARDS="security-guard implementation-completeness-guard cross-artifact-consistency database-guard"

# 1. Flags validator passes on the clean tree.
if "$PY" scripts/validate-governance-flags.py > /tmp/gflags-out.txt 2>&1; then
  ok "governance-flags validator passes"
else
  bad "governance-flags validator"; cat /tmp/gflags-out.txt
fi

# 2. Poison: unregistered skip_condition is rejected (restore afterwards).
cp "$ROOT/skills/pipelines/architecture-only.json" /tmp/arch-good.json
python3 -c "
import json
p = 'skills/pipelines/architecture-only.json'
d = json.loads(open(p, encoding='utf-8').read())
d['gates'][0]['skip_condition'] = 'pipeline_config.ci_mode === true'
open(p, 'w', encoding='utf-8').write(json.dumps(d, indent=2, ensure_ascii=False) + chr(10))
"
if "$PY" scripts/validate-governance-flags.py > /dev/null 2>&1; then
  bad "unregistered skip_condition not rejected"
else
  ok "unregistered skip_condition rejected"
fi
cp /tmp/arch-good.json "$ROOT/skills/pipelines/architecture-only.json"

# 3. Poison: skip_validation:true on a guard skill is rejected (restore afterwards).
cp "$ROOT/skills/pipelines/pre-deploy.json" /tmp/pd-good.json
python3 -c "
import json
p = 'skills/pipelines/pre-deploy.json'
d = json.loads(open(p, encoding='utf-8').read())
d['phases'][0]['skills'][0]['skip_validation'] = True
open(p, 'w', encoding='utf-8').write(json.dumps(d, indent=2, ensure_ascii=False) + chr(10))
"
if "$PY" scripts/validate-governance-flags.py > /dev/null 2>&1; then
  bad "skip_validation:true not rejected"
else
  ok "skip_validation:true rejected"
fi
cp /tmp/pd-good.json "$ROOT/skills/pipelines/pre-deploy.json"
"$PY" scripts/validate-pipeline-gates.py > /dev/null 2>&1 && ok "tree restored clean" || bad "tree restore"

# 4. resolve-override CLI: valid general override resolves; high-stakes without
#    authenticated human is rejected; bearer-shaped calls fail.
ID_GENERAL=$(AIW_GATE_REGISTRY="$AIW_GATE_REGISTRY" node -e "
const gd = require(process.env.AIW_TEST_ROOT + '/scripts/gate-decisions');
const rec = gd.record({ gate_id: 'G2-GENERAL', gate_class: 'general', decision: 'acknowledge',
  principal: { type: 'agent', id: 'primary', authenticated: false, source: 'orchestrator-relay' },
  scope: { finding_ids: ['F-9'] }, reason: 'phase2 test override for general gate' });
console.log(rec.decision_id);
")
if AIW_GATE_REGISTRY="$AIW_GATE_REGISTRY" node scripts/resolve-override.js --decision-id "$ID_GENERAL" --gate-id G2-GENERAL --gate-class general --scope-json '{"finding_ids":["F-9"]}' > /dev/null 2>&1; then
  ok "CLI resolves valid general override"
else
  bad "CLI general override"
fi
if AIW_GATE_REGISTRY="$AIW_GATE_REGISTRY" node scripts/resolve-override.js --decision-id "$ID_GENERAL" --gate-id G2-GENERAL --gate-class security --scope-json '{"finding_ids":["F-9"]}' > /dev/null 2>&1; then
  bad "high-stakes gate accepted unauthenticated principal"
else
  ok "high-stakes gate rejects unauthenticated principal"
fi
ID_AUTHED=$(AIW_GATE_REGISTRY="$AIW_GATE_REGISTRY" node -e "
const gd = require(process.env.AIW_TEST_ROOT + '/scripts/gate-decisions');
const rec = gd.record({ gate_id: 'G2-DEPLOY', gate_class: 'deployment', decision: 'approve',
  principal: { type: 'human', id: 'captain', authenticated: true, source: 'chat-hitl' },
  reason: 'phase2 test deploy approval by authenticated human' });
console.log(rec.decision_id);
")
if AIW_GATE_REGISTRY="$AIW_GATE_REGISTRY" node scripts/resolve-override.js --decision-id "$ID_AUTHED" --gate-id G2-DEPLOY --gate-class deployment > /dev/null 2>&1; then
  ok "authenticated human resolves at deployment class"
else
  bad "authenticated human at deployment class"
fi
if node scripts/resolve-override.js --gate-id G2-DEPLOY > /dev/null 2>&1; then
  bad "CLI accepted call without decision_id"
else
  ok "CLI rejects bearer-shaped call without decision_id"
fi
ID_REJECT=$(AIW_GATE_REGISTRY="$AIW_GATE_REGISTRY" node -e "
const gd = require(process.env.AIW_TEST_ROOT + '/scripts/gate-decisions');
const rec = gd.record({ gate_id: 'G2-REJ', decision: 'reject',
  principal: { type: 'human', id: 'r', authenticated: true, source: 'chat-hitl' },
  reason: 'phase2 test rejection decision' });
console.log(rec.decision_id);
")
if AIW_GATE_REGISTRY="$AIW_GATE_REGISTRY" node scripts/resolve-override.js --decision-id "$ID_REJECT" --gate-id G2-REJ --gate-class general > /dev/null 2>&1; then
  bad "reject decision authorized an override"
else
  ok "reject decision cannot authorize override"
fi

# 5. Guard specs migrated: override_decision_id + resolve-override.js present,
#    bearer inputs gone from all four guards.
MIGRATED=0
for g in $GUARDS; do
  f="$ROOT/.opencode/skills/$g/SKILL.md"
  if grep -q "override_decision_id" "$f" && grep -q "resolve-override.js" "$f"; then
    MIGRATED=$((MIGRATED+1))
  else
    bad "guard not migrated: $g"
  fi
  if grep -qE '"(override_approved|approval_context)":' "$f"; then
    bad "bearer input still honored in schema: $g"
  fi
done
[ "$MIGRATED" -eq 4 ] && ok "all four guards migrated to decision ids" || bad "guard migration count"

# 6. Relay-only language: primary never originates approvals.
if grep -q "relays human HITL gate decisions" "$ROOT/.opencode/agent/primary.md" \
  && grep -q "MUST NEVER originate an approval" "$ROOT/.opencode/agent/primary.md" \
  && grep -q "never originates" "$ROOT/docs/agents.md"; then
  ok "relay-only primary documented"
else
  bad "relay-only language"
fi
if grep -q "only agent authorized to approve gates" "$ROOT/.opencode/agent/primary.md" \
  || grep -q "only agent that can approve HITL gates" "$ROOT/docs/agents.md" \
  || grep -q "approves HITL gates, and coordinates" "$ROOT/opencode.json" \
  || grep -q "approves HITL gates, and coordinates" "$ROOT/docs/agents.md"; then
  bad "stale approver-authority language remains"
else
  ok "stale approver-authority language removed"
fi
if grep -q "decided_by" "$ROOT/.opencode/skills/orchestrator/SKILL.md"; then
  ok "decided_by envelope in orchestrator gate log"
else
  bad "decided_by envelope"
fi

echo ""
echo "governance-2: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]

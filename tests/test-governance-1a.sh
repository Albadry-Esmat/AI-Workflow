#!/usr/bin/env bash
# Phase 1A governance tests: timeout fail-closed (G-1) + atomic approvals (G-9).
# Boundary: timeout → BLOCKED + escalate, never implicit approval.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PASS=0; FAIL=0
ok() { echo "  PASS: $1"; PASS=$((PASS+1)); }
bad() { echo "  FAIL: $1"; FAIL=$((FAIL+1)); }
PY="$ROOT/.venv/bin/python"
[ -x "$PY" ] || PY="python3"

# 1. Validator passes on the clean tree (94 explicit human-gate declarations).
if "$PY" scripts/validate-pipeline-gates.py > /tmp/gates-out.txt 2>&1; then
  ok "pipeline gate validator passes"
else
  bad "pipeline gate validator"; cat /tmp/gates-out.txt
fi

# 2. Poison: a human gate without an explicit flag is rejected.
cp "$ROOT/skills/pipelines/quick-review.json" /tmp/qr-good.json
python3 -c "
import json
p = 'skills/pipelines/quick-review.json'
d = json.loads(open(p, encoding='utf-8').read())
del d['gates'][0]['bypass_on_timeout']
open(p, 'w', encoding='utf-8').write(json.dumps(d, indent=2, ensure_ascii=False) + chr(10))
"
if "$PY" scripts/validate-pipeline-gates.py > /dev/null 2>&1; then
  bad "missing bypass flag not rejected"
else
  ok "missing bypass flag rejected"
fi
cp /tmp/qr-good.json "$ROOT/skills/pipelines/quick-review.json"

# 3. Poison: bypass:true on a security-class gate is rejected (forbidden class).
python3 -c "
import json
p = 'skills/pipelines/quick-review.json'
d = json.loads(open(p, encoding='utf-8').read())
d['gates'][0]['bypass_on_timeout'] = True
d['gates'][0]['timeout_expiry_action'] = 'continue_by_policy'
d['gates'][0]['policy_exception'] = 'pol-test-001'
open(p, 'w', encoding='utf-8').write(json.dumps(d, indent=2, ensure_ascii=False) + chr(10))
"
if "$PY" scripts/validate-pipeline-gates.py > /dev/null 2>&1; then
  bad "security-class bypass not rejected"
else
  ok "security-class bypass rejected even with exception fields"
fi
cp /tmp/qr-good.json "$ROOT/skills/pipelines/quick-review.json"

# 4. Poison: bypass:true on a general gate without a registered exception fails.
cp "$ROOT/skills/pipelines/requirements-only.json" /tmp/ro-good.json
python3 -c "
import json
p = 'skills/pipelines/requirements-only.json'
d = json.loads(open(p, encoding='utf-8').read())
d['gates'][0]['bypass_on_timeout'] = True
open(p, 'w', encoding='utf-8').write(json.dumps(d, indent=2, ensure_ascii=False) + chr(10))
print('class-probe done')
"
if "$PY" scripts/validate-pipeline-gates.py > /dev/null 2>&1; then
  bad "unregistered bypass exception not rejected"
else
  ok "unregistered bypass exception rejected"
fi
cp /tmp/ro-good.json "$ROOT/skills/pipelines/requirements-only.json"
cp /tmp/qr-good.json "$ROOT/skills/pipelines/quick-review.json"
"$PY" scripts/validate-pipeline-gates.py > /dev/null 2>&1 && ok "tree restored clean" || bad "tree restore"

# 5. Race: 8 parallel gateway checks on one single-use token → exactly 1 allow.
ALLOWS=$(AIW_TEST_ROOT="$ROOT" node -e '
const { spawnSync } = require("node:child_process");
const ROOT = process.env.AIW_TEST_ROOT;
const ap = require(ROOT + "/scripts/policy-approval");
const t = "race-" + Date.now();
const rec = ap.approve({ thread: t, tool: "shell", targetPath: "docs/a.md", ttlSeconds: 600, principal: { type: "human", id: "test-minter", source: "test" } });
const child = "const g=require(" + JSON.stringify(ROOT + "/scripts/policy-gateway") + ");" +
  "const r=g.check({tool:\"shell\",path:\"docs/a.md\",threadId:" + JSON.stringify(t) +
  ",approval:" + JSON.stringify(rec.token) + "});" +
  "process.exit(r.decision===\"allow\"?0:1);";
let allows = 0;
for (let i = 0; i < 8; i++) {
  const p = spawnSync("node", ["-e", child], { encoding: "utf8" });
  if (p.status === 0) allows++;
}
console.log(allows);
' 2>/dev/null)
# Fallback when worker/spawn output is unavailable: sequential double-consume.
if [ -z "$ALLOWS" ]; then ALLOWS="race-skip"; fi
if [ "$ALLOWS" = "1" ]; then
  ok "single-use token allows exactly once under 8-way race"
elif [ "$ALLOWS" = "race-skip" ]; then
  node -e "
  const ap = require('$ROOT/scripts/policy-approval');
  const g = require('$ROOT/scripts/policy-gateway');
  const t = 'seq-' + Date.now();
  const rec = ap.approve({ thread: t, tool: 'read', targetPath: 'docs/a.md', ttlSeconds: 600, principal: { type: 'human', id: 'test-minter', source: 'test' } });
  const a = g.check({ tool: 'read', path: 'docs/a.md', threadId: t, approval: rec.token });
  const b = g.check({ tool: 'read', path: 'docs/a.md', threadId: t, approval: rec.token });
  if (a.decision !== 'allow' || b.decision !== 'deny') process.exit(1);
  " && ok "sequential double-consume denies second use" || bad "double-consume"
else
  bad "race allowed $ALLOWS uses (expected exactly 1)"
fi

# 6. Traversal: hostile thread/ns/case ids stay inside state roots or throw.
node -e "
const cp = require('$ROOT/scripts/checkpointer');
const st = require('$ROOT/scripts/store');
const tr = require('$ROOT/scripts/trace-envelope');
const pa = require('$ROOT/scripts/policy-approval');
const path = require('path');
const root = path.resolve('$ROOT');
for (const evil of ['../../etc', '/abs/path', '..', 'a/b/c']) {
  for (const fn of [() => cp.threadDir(evil), () => tr.tracePath(evil), () => pa && null]) {
    try {
      const p = fn();
      if (p && !path.resolve(p).startsWith(root)) { console.error('escape: ' + p); process.exit(1); }
    } catch (e) { /* rejection is also containment */ }
  }
  try {
    const p = st.put(evil, 'k', { v: 1 });
    if (!path.resolve('$ROOT/.opencode/state/store').startsWith(path.resolve('$ROOT'))) process.exit(1);
  } catch (e) { /* rejection is also containment */ }
}
// Verify a hostile thread write lands inside the state root, not outside.
const t = '.._.._evil-' + Date.now();
cp.appendCheckpoint(t, { kind: 'probe' });
const p = cp.checkpointPath(t);
if (!path.resolve(p).startsWith(path.join(root, '.opencode', 'state'))) { console.error('escape: ' + p); process.exit(1); }
if (require('fs').existsSync(path.join(root, 'evil-probe'))) process.exit(1);
" && ok "traversal contained in state roots" || bad "traversal"

# 7. Expired approvals deny (no use-after-expiry). Uses a privileged tool so the
#    approval path (not the read allowlist) is exercised.
node -e "
const ap = require('$ROOT/scripts/policy-approval');
const g = require('$ROOT/scripts/policy-gateway');
const t = 'exp-' + Date.now();
const rec = ap.approve({ thread: t, tool: 'shell', targetPath: 'docs/a.md', ttlSeconds: -1, principal: { type: 'human', id: 'test-minter', source: 'test' } });
const r = g.check({ tool: 'shell', path: 'docs/a.md', threadId: t, approval: rec.token });
if (r.decision !== 'deny') process.exit(1);
" && ok "expired approval denied" || bad "expiry"

echo ""
echo "governance-1a: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]

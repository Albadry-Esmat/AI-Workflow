#!/usr/bin/env bash
# tests/test-mcp-projections.sh — S1 MCP manifest + projection fixtures (CI).
#
# Covers: valid manifest, invalid manifest, deterministic generation
# (second write = zero diff), projection deletion/edit detected by --check,
# optional missing env warns, required missing env fails start-gate,
# disabled excluded, unsupported required projection fails, unsupported
# optional field logged, no secret values emitted.
# No network, no secrets (only reference NAMES are inspected).

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PASS=0
FAIL=0
_ok()   { echo "  PASS: $1"; PASS=$((PASS+1)); }
_fail() { echo "  FAIL: $1"; FAIL=$((FAIL+1)); }

FIX="$(mktemp -d /tmp/aiw-mcp-XXXX)"
trap 'rm -rf "$FIX"' EXIT

echo "=== manifest schema ==="
if python3 -c "
import json, jsonschema
jsonschema.validate(json.load(open('config/mcp-manifest.json')), json.load(open('config/mcp-manifest-schema.json')))
"; then _ok "valid manifest validates"; else _fail "valid manifest rejected"; fi

python3 -c "import json; d=json.load(open('config/mcp-manifest.json')); d['servers']['github']['transport']='bogus'" 2>/dev/null || true
BAD="$FIX/bad-manifest.json"
python3 -c "
import json
d = json.load(open('config/mcp-manifest.json'))
d['servers']['github']['transport'] = 'bogus-transport'
json.dump(d, open('$BAD', 'w'))
"
if AIW_MCP_MANIFEST="$BAD" node scripts/sync-mcp.js --check >/dev/null 2>&1; then
  _fail "invalid manifest accepted"
else
  _ok "invalid manifest rejected"
fi

python3 -c "
import json
d = json.load(open('config/mcp-manifest.json'))
d['servers']['github']['env_refs']['GITHUB_PERSONAL_ACCESS_TOKEN'] = 'ghp_literalSECRET1234567890'
json.dump(d, open('$BAD', 'w'))
"
if AIW_MCP_MANIFEST="$BAD" node scripts/sync-mcp.js --check >/dev/null 2>&1; then
  _fail "literal secret value accepted"
else
  _ok "literal secret value rejected"
fi

echo "=== determinism ==="
node scripts/sync-mcp.js --write >/dev/null 2>&1
if node scripts/sync-mcp.js --write 2>&1 | grep -q "no changes"; then
  _ok "second generation = zero diff"
else
  _fail "second generation produced diffs"
fi
if node scripts/sync-mcp.js --check >/dev/null 2>&1; then _ok "--check clean"; else _fail "--check failed on clean tree"; fi

echo "=== deletion / edit detected ==="
cp .mcp.json "$FIX/mcp.backup"
rm .mcp.json
if node scripts/sync-mcp.js --check >/dev/null 2>&1; then _fail "deleted projection not detected"; else _ok "deleted projection detected"; fi
cp "$FIX/mcp.backup" .mcp.json
echo " " >> .cursor/mcp.json
if node scripts/sync-mcp.js --check >/dev/null 2>&1; then _fail "edited projection not detected"; else _ok "edited projection detected"; fi
node scripts/sync-mcp.js --write >/dev/null 2>&1
if node scripts/sync-mcp.js --check >/dev/null 2>&1; then _ok "restored to clean"; else _fail "restore failed"; fi

echo "=== disabled excluded / opencode retains flag ==="
if node -e "const m=require('./.mcp.json'); if (m.mcpServers.slack||m.mcpServers.vercel) process.exit(1)"; then
  _ok "disabled servers excluded from .mcp.json"
else
  _fail "disabled server leaked into .mcp.json"
fi
if node -e "const o=require('./opencode.json'); if (o.mcp.slack && o.mcp.slack.enabled===false && o.mcp.vercel) process.exit(0); process.exit(1)"; then
  _ok "disabled servers retained with enabled:false in opencode.json"
else
  _fail "opencode disabled entries wrong"
fi

echo "=== S2-B .vscode/mcp.json projection ==="
if node -e 'const v = require("./.vscode/mcp.json"); if (!v.servers || typeof v.servers !== "object") process.exit(1); if (v.servers.slack || v.servers.vercel) process.exit(1); if (!v.servers.github || !v.servers.memory) process.exit(1); const env = v.servers.github.env || {}; const re = new RegExp("^\\$\\{env:[A-Za-z_][A-Za-z0-9_]*\\}$"); if (!Object.values(env).every((s) => re.test(s))) process.exit(1);'; then _ok ".vscode projection shape valid (servers, enabled-only, env refs)"; else _fail ".vscode projection shape wrong"; fi
cp .vscode/mcp.json "$FIX/vscode.backup"
echo " " >> .vscode/mcp.json
if node scripts/sync-mcp.js --check >/dev/null 2>&1; then _fail "edited .vscode projection not detected"; else _ok "edited .vscode projection detected"; fi
cp "$FIX/vscode.backup" .vscode/mcp.json
if node scripts/sync-mcp.js --check >/dev/null 2>&1; then _ok ".vscode restored to clean"; else _fail ".vscode restore failed"; fi

echo "=== no secret values emitted ==="
if grep -rEq 'ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]+|sk-(live|ant)-[A-Za-z0-9]+|xox[bpas]-[A-Za-z0-9-]+' .mcp.json .cursor/mcp.json .vscode/mcp.json; then
  _fail "token-like value in generated projections"
else
  _ok "no secret values in projections"
fi
if node -e "
  const fs=require('fs');
  for (const f of ['.mcp.json','.cursor/mcp.json']) {
    const text=fs.readFileSync(f,'utf8');
    for (const m of text.matchAll(/\\\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g)) { /* refs ok */ }
  }
  const mcp=JSON.parse(fs.readFileSync('.mcp.json','utf8'));
  const vals=JSON.stringify(Object.values(mcp.mcpServers).map(s=>s.env||{}));
  if (!/GITHUB_TOKEN|BRAVE_API_KEY|CONTEXT7_API_KEY/.test(vals)) process.exit(1);
"; then _ok "env values are references only"; else _fail "env reference check failed"; fi

echo "=== optional vs required env (hermetic manifest) ==="
REQMAN="$FIX/req-manifest.json"
python3 -c "
import json
d = json.load(open('config/mcp-manifest.json'))
d['servers'] = {'req-srv': dict(d['servers']['memory'], required=True,
                env_refs={'REQ_X': '\${AIW_TEST_MISSING_XYZ}'},
                compatibility=['claude-code']),
                'opt-srv': dict(d['servers']['memory'], required=False,
                env_refs={'OPT_X': '\${AIW_TEST_MISSING_XYZ}'},
                compatibility=['claude-code'])}
json.dump(d, open('$REQMAN', 'w'))
"
if AIW_MCP_MANIFEST="$REQMAN" node scripts/check-mcp-deps.js --adapter claude-code --warn >/dev/null 2>&1; then
  _ok "optional missing env warns (exit 0)"
else
  _fail "optional missing env should warn-only"
fi
if AIW_MCP_MANIFEST="$REQMAN" node scripts/check-mcp-deps.js --adapter claude-code --strict >/dev/null 2>&1; then
  _fail "required missing env should fail strict"
else
  _ok "required missing env fails strict"
fi

echo "=== unsupported required projection ==="
python3 -c "
import json
d = json.load(open('$REQMAN'))
d['servers']['req-srv']['transport'] = 'bogus'
json.dump(d, open('$REQMAN', 'w'))
"
if AIW_MCP_MANIFEST="$REQMAN" node scripts/check-mcp-deps.js --adapter claude-code --strict >/dev/null 2>&1; then
  _fail "unsupported required transport should fail"
else
  _ok "unsupported required transport fails"
fi

echo "=== S2-B start gates (stale blocks, IDE strict runs) ==="
FIXBIN="$FIX/startbin"
mkdir -p "$FIXBIN"
for essential in node bash sh; do
  command -v "$essential" >/dev/null 2>&1 && ln -sf "$(command -v "$essential")" "$FIXBIN/$essential"
done
printf '#!/bin/sh\necho "claude fake 9.9.9"\n' > "$FIXBIN/claude"; chmod +x "$FIXBIN/claude"
printf '#!/bin/sh\necho "cursor fake 9.9.9"\n' > "$FIXBIN/cursor"; chmod +x "$FIXBIN/cursor"
cp .mcp.json "$FIX/mcp.start.backup"
restore_start() { cp "$FIX/mcp.start.backup" .mcp.json; }
# stale projection blocks start even in dry-run
echo " " >> .mcp.json
if AIW_EXEC_DRY_RUN=1 AIW_O2_STATE_ROOT="$FIX/startstate" PATH="$FIXBIN:/usr/bin:/bin" bash aiw start "$ROOT" --for claude-code >/dev/null 2>&1; then
  _fail "stale projection did not block start"
else
  _ok "stale projection blocks start"
fi
restore_start
# cursor-ide strict gate runs and dry-run argv captured
if out="$(AIW_EXEC_DRY_RUN=1 AIW_O2_STATE_ROOT="$FIX/startstate" PATH="$FIXBIN:/usr/bin:/bin" bash aiw start "$ROOT" --for cursor-ide 2>&1)"; then
  if echo "$out" | grep -q "DRY-RUN argv: \[cursor-ide\]"; then _ok "cursor-ide strict gate passes, opener argv captured"; else _fail "cursor-ide argv missing: $out"; fi
else
  _fail "cursor-ide start failed on clean tree"
fi
restore_start
if node scripts/sync-mcp.js --check >/dev/null 2>&1; then _ok "projections clean after start-gate tests"; else _fail "start-gate tests left drift"; fi

echo
echo "MCP projections: $PASS passed, $FAIL failed"
[[ "$FAIL" -eq 0 ]]

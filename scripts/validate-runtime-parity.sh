#!/usr/bin/env bash
# scripts/validate-runtime-parity.sh — P0 runtime-neutral parity gates (CI).
#
# Gates:
#   1. Canonical count parity: index.yaml == .agents/skills/ dir count.
#   2. Registry/graph parity: registry paths canonical + graph total_nodes == index count.
#   3. No executable skill-body duplication across discovery roots
#      (invariant: ONE CANONICAL EXECUTABLE BODY per portable skill in
#      .agents/skills/. website/data/.agents/skills/ is explicitly excluded:
#      generated non-executable publication data, byte-copies only).
#   4. Generated adapter drift: sync-runtimes.sh --check clean.
#   5. Claude adapter integrity: 121 links, all resolve to canonical bodies.
#   6. OpenCode discovery compatibility: tests/test-opencode-discovery.sh.
#   7. Runtime catalog schema: agent-runtime-catalog.json validates (node ajv or python).
#   8. Secret safety: no token-like values in generated/adapter files.
#
# Deterministic, no network. Exit 0 all pass, non-zero on any fail.

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PASS=0
FAIL=0
_ok()   { echo "  PASS: $1"; PASS=$((PASS+1)); }
_fail() { echo "  FAIL: $1"; FAIL=$((FAIL+1)); }

echo "=== P0 runtime parity gates ==="

# 1. Canonical count parity
INDEX_COUNT=$(grep -c "^- id:" skills/index.yaml || echo 0)
DIR_COUNT=$(find .agents/skills -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l | tr -d ' ')
echo "  index.yaml: $INDEX_COUNT | .agents/skills/: $DIR_COUNT"
if [[ "$INDEX_COUNT" -gt 0 && "$INDEX_COUNT" -eq "$DIR_COUNT" ]]; then
  _ok "canonical count parity ($INDEX_COUNT)"
else
  _fail "count mismatch — index.yaml ($INDEX_COUNT) vs .agents/skills/ ($DIR_COUNT)"
fi

# 2. Registry/graph parity
GRAPH_NODES=$(grep "total_nodes:" skills/graph/skill-graph.yaml 2>/dev/null | awk '{print $2}')
GRAPH_NODES="${GRAPH_NODES:-0}"
if [[ "$GRAPH_NODES" -eq "$INDEX_COUNT" ]]; then
  _ok "graph total_nodes parity ($GRAPH_NODES)"
else
  _fail "graph total_nodes ($GRAPH_NODES) != index ($INDEX_COUNT)"
fi
if command -v node &>/dev/null; then
  NONCANON=$(node -e "
    const r = JSON.parse(require('fs').readFileSync('skills/registry.json','utf8'));
    console.log(r.skills.filter(s => !String(s.path||'').startsWith('.agents/skills/')).map(s=>s.name).join('\n'));
  " 2>/dev/null || true)
  if [[ -z "$NONCANON" ]]; then
    _ok "registry.json paths all canonical (.agents/skills/)"
  else
    while IFS= read -r n; do [[ -n "$n" ]] && _fail "registry non-canonical path: $n"; done <<< "$NONCANON"
  fi
else
  echo "  SKIP: node unavailable for registry path check"
fi

# 3. No duplicate bodies (Case-B invariant)
DUP_FAIL=0
if [[ -e ".opencode/skills" ]] && [[ ! -L ".opencode/skills" ]]; then
  BODIES=$(find .opencode/skills -name "SKILL.md" 2>/dev/null | wc -l | tr -d ' ')
  if [[ "$BODIES" -gt 0 ]]; then _fail ".opencode/skills holds $BODIES bodies"; DUP_FAIL=1; fi
fi
for r in ".cursor/skills" ".github/skills" ".gemini/skills" ".codex/skills"; do
  if [[ -d "$r" ]]; then
    B=$(find "$r" -name "SKILL.md" 2>/dev/null | wc -l | tr -d ' ')
    if [[ "$B" -gt 0 ]]; then _fail "$r holds $B duplicate bodies"; DUP_FAIL=1; fi
  fi
done
[[ "$DUP_FAIL" -eq 0 ]] && _ok "no duplicate skill bodies (one canonical body per skill)"

# 4. Generated adapter drift
if bash scripts/sync-runtimes.sh --check >/tmp/parity_sync_check.log 2>&1; then
  _ok "sync-runtimes --check clean"
else
  _fail "sync-runtimes --check drift (see /tmp/parity_sync_check.log; run bash scripts/sync-runtimes.sh)"
  tail -n 5 /tmp/parity_sync_check.log >&2 || true
fi

# 5. Claude adapter integrity
if [[ -d ".claude/skills" ]]; then
  LINKS=$(find .claude/skills -mindepth 1 -maxdepth 1 2>/dev/null | wc -l | tr -d ' ')
  BROKEN=0
  for l in .claude/skills/*; do
    [[ -e "$l" ]] || continue
    if [[ -L "$l" ]]; then
      target=$(readlink "$l" || echo "")
      case "$target" in
        "../../.agents/skills/"*) ;;
        *) echo "  FAIL: unexpected link target: $l -> $target" >&2; BROKEN=$((BROKEN+1));;
      esac
      [[ -f "$l/SKILL.md" ]] || { echo "  FAIL: broken link: $l" >&2; BROKEN=$((BROKEN+1)); }
    elif [[ -f "$l/SKILL.md" ]]; then
      grep -q "generated compatibility proxy" "$l/SKILL.md" 2>/dev/null || { echo "  FAIL: unmanaged proxy: $l" >&2; BROKEN=$((BROKEN+1)); }
    fi
  done
  if [[ "$LINKS" -eq "$DIR_COUNT" && "$BROKEN" -eq 0 ]]; then
    _ok "Claude adapter integrity ($LINKS links, all resolve)"
  else
    _fail "Claude adapter: $LINKS entries (expected $DIR_COUNT), $BROKEN broken/unmanaged"
  fi
else
  _fail ".claude/skills missing (run bash scripts/sync-runtimes.sh)"
fi

# 6. OpenCode discovery compat
if bash tests/test-opencode-discovery.sh >/tmp/parity_discovery.log 2>&1; then
  _ok "OpenCode discovery compatibility (Case B)"
else
  _fail "test-opencode-discovery.sh failed (see /tmp/parity_discovery.log)"
  tail -n 8 /tmp/parity_discovery.log >&2 || true
fi

# 7. Runtime catalog schema (python jsonschema if available, else structural check)
if python3 -c 'import jsonschema' 2>/dev/null; then
  if python3 -c "
import json, jsonschema
schema = json.load(open('config/agent-runtime-adapter-schema.json'))
cat = json.load(open('config/agent-runtime-catalog.json'))
jsonschema.validate(cat, schema)
print('catalog validates')
"; then
    _ok "agent-runtime-catalog.json validates against schema"
  else
    _fail "agent-runtime-catalog.json schema validation failed"
  fi
else
  # Structural fallback: required interoperability fields present
  if node -e "
    const c = JSON.parse(require('fs').readFileSync('config/agent-runtime-catalog.json','utf8'));
    const bad = c.adapters.filter(a => !a.interoperability || !a.interoperability.skills_path || !a.interoperability.skills_support);
    if (bad.length) { console.error(bad.map(a=>a.id).join(',')); process.exit(1); }
  " 2>/dev/null; then
    _ok "agent-runtime-catalog.json interoperability fields present (structural)"
  else
    _fail "agent-runtime-catalog.json missing interoperability fields"
  fi
fi

# 8. Secret safety on generated/adapter surface
SECRET_HIT=0
for f in $(find .claude/skills -name "SKILL.md" -type f 2>/dev/null || true) scripts/sync-runtimes.sh scripts/validate-runtime-parity.sh tests/test-opencode-discovery.sh; do
  if [[ -f "$f" ]] && grep -Eq 'ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]+|sk-(live|ant)-[A-Za-z0-9]+|xox[bpas]-[A-Za-z0-9-]+' "$f" 2>/dev/null; then
    echo "  FAIL: token-like value in $f" >&2; SECRET_HIT=1
  fi
done
if [[ "$SECRET_HIT" -eq 0 ]]; then
  _ok "secret safety clean (adapters + generators)"
else
  _fail "secret safety: token-like values detected"
fi

echo
echo "Runtime parity: $PASS passed, $FAIL failed"
[[ "$FAIL" -eq 0 ]]

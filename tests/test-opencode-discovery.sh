#!/usr/bin/env bash
# tests/test-opencode-discovery.sh — P0 OpenCode discovery compatibility (Case B).
#
# Proves:
#   1. `.agents/skills/` holds all canonical skills (count == index.yaml).
#   2. `.opencode/skills/` holds NO independently maintained skill bodies
#      (absent entirely, or a symlink — never a physical directory with SKILL.md).
#   3. Every `opencode.json` agent skill path resolves to `.agents/skills/` on disk.
#   4. No duplicate executable bodies per skill ID across discovery roots
#      (`.agents/skills`, `.opencode/skills`, `.claude/skills`).
#      Invariant: ONE CANONICAL EXECUTABLE BODY per portable skill.
#      website/data/.agents/skills/ is generated non-executable publication
#      data (not a discovery root) and is excluded here by design.
#   5. If `opencode` binary is present, live `opencode debug skill` shows zero
#      duplicate IDs (warn-only if binary absent — CI without opencode still passes
#      on the filesystem invariant).
#
# Evidence basis: artifacts/p0-opencode-discovery/SUMMARY.md
#   (opencode 1.18.32: baseline 123 unique/0 dupes via .agents; symlink trial
#   123 unique/0 dupes but 70/51 ambiguous source split → Case B selected).
#
# Exit 0 on pass, non-zero on fail. Deterministic, no network, no secrets.

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PASS=0
FAIL=0
_ok()   { echo "  PASS: $1"; PASS=$((PASS+1)); }
_fail() { echo "  FAIL: $1"; FAIL=$((FAIL+1)); }

echo "=== OpenCode discovery compatibility (P0 Case B) ==="

# 1. Canonical count parity
INDEX_COUNT=$(grep -c "^- id:" skills/index.yaml || echo 0)
DIR_COUNT=$(find .agents/skills -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l | tr -d ' ')
echo "  index.yaml entries : $INDEX_COUNT"
echo "  .agents/skills/    : $DIR_COUNT"
if [[ "$INDEX_COUNT" -gt 0 && "$INDEX_COUNT" -eq "$DIR_COUNT" ]]; then
  _ok "canonical count parity ($INDEX_COUNT)"
else
  _fail "count mismatch — index.yaml ($INDEX_COUNT) vs .agents/skills/ ($DIR_COUNT)"
fi

# 2. No physical .opencode/skills bodies
if [[ ! -e ".opencode/skills" ]]; then
  _ok ".opencode/skills absent (sole discoverable path is .agents/skills/)"
elif [[ -L ".opencode/skills" ]]; then
  _fail ".opencode/skills is a symlink — Case B forbids the shim (remove it)"
else
  BODIES=$(find .opencode/skills -name "SKILL.md" 2>/dev/null | wc -l | tr -d ' ')
  if [[ "$BODIES" -eq 0 ]]; then
    _ok ".opencode/skills exists but holds no SKILL.md bodies"
  else
    _fail ".opencode/skills holds $BODIES independently maintained bodies (invariant: one canonical body per skill)"
  fi
fi

# 3. opencode.json paths resolve under .agents/skills/
if command -v node &>/dev/null; then
  MISSING=$(node -e "
    const fs = require('fs');
    const cfg = JSON.parse(fs.readFileSync('opencode.json', 'utf8'));
    const missing = [];
    for (const agent of Object.values(cfg.agent || {})) {
      const paths = [];
      if (agent.skill)  paths.push(agent.skill);
      if (agent.skills) paths.push(...agent.skills);
      for (const p of paths) {
        if (!p.startsWith('.agents/skills/')) missing.push('NON_CANONICAL:' + p);
        else if (!fs.existsSync(p)) missing.push('MISSING:' + p);
      }
    }
    missing.forEach(m => console.log(m));
  " 2>/dev/null || true)
  if [[ -z "$MISSING" ]]; then
    _ok "all opencode.json skill paths canonical (.agents/skills/) and on disk"
  else
    while IFS= read -r line; do _fail "$line"; done <<< "$MISSING"
  fi
else
  echo "  SKIP: node unavailable — cannot verify opencode.json paths"
fi

# 4. No duplicate bodies across discovery roots (by skill dir name)
TMP_DUPES=$(mktemp)
{
  [[ -d ".agents/skills" ]] && find .agents/skills -mindepth 1 -maxdepth 1 -type d -exec basename {} \; 2>/dev/null
} | sort | uniq -d > "$TMP_DUPES" || true
# Cross-root check: same skill name with a physical SKILL.md in more than one root
CROSS=0
for root in ".opencode/skills" ".claude/skills"; do
  if [[ -d "$root" && ! -L "$root" ]]; then
    while IFS= read -r d; do
      name=$(basename "$d")
      if [[ -f ".agents/skills/$name/SKILL.md" && -f "$d/SKILL.md" ]]; then
        # Allow Claude symlinks (they resolve into .agents); flag only real duplicate bodies
        if [[ ! -L "$d" && ! -L "$d/SKILL.md" ]]; then
          echo "  FAIL: duplicate body for '$name' in $root + .agents/skills/"
          CROSS=$((CROSS+1))
        fi
      fi
    done < <(find "$root" -mindepth 1 -maxdepth 1 -type d 2>/dev/null || true)
  fi
done
if [[ "$CROSS" -eq 0 ]]; then
  _ok "one canonical executable body per portable skill (no cross-root duplicate bodies)"
else
  FAIL=$((FAIL+CROSS))
fi
rm -f "$TMP_DUPES"

# 5. Live probe (optional — warn-only when binary absent)
if command -v opencode &>/dev/null; then
  LIVE_JSON=$(mktemp /tmp/opencode_skills_XXXX.json)
  if opencode debug skill --print-logs 2>/dev/null > "$LIVE_JSON"; then
    LIVE_RESULT=$(python3 - "$LIVE_JSON" <<'PYEOF'
import json, sys, collections
d = json.load(open(sys.argv[1]))
names = [s.get("name") for s in d]
dupes = [k for k, v in collections.Counter(names).items() if v > 1]
agents = sum(1 for s in d if ".agents/skills" in (s.get("location") or ""))
print(f"{len(d)} total, {agents} via .agents/skills/, {len(dupes)} duplicate IDs")
sys.exit(1 if dupes else 0)
PYEOF
) && _ok "live opencode discovery: $LIVE_RESULT" || _fail "live opencode discovery shows duplicate IDs: $LIVE_RESULT"
  else
    _fail "opencode debug skill failed to run"
  fi
  rm -f "$LIVE_JSON"
else
  echo "  SKIP: opencode binary absent — filesystem invariant above is authoritative"
fi

echo
echo "OpenCode discovery: $PASS passed, $FAIL failed"
[[ "$FAIL" -eq 0 ]]

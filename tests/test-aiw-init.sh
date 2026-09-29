#!/usr/bin/env bash
# tests/test-aiw-init.sh — S1 aiw init fixtures (CI).
#
# Covers: empty target install, identical rerun --merge, conflicting skill
# fails, conflicting MCP fails, --merge missing-entry add, --merge identical
# keep, --merge different-entry fail, .env fake-secret never copied,
# unknown --for rejected, no .opencode wholesale copy.
# Temp targets only; never touches the developer workspace.

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PASS=0
FAIL=0
_ok()   { echo "  PASS: $1"; PASS=$((PASS+1)); }
_fail() { echo "  FAIL: $1"; FAIL=$((FAIL+1)); }

FIX="$(mktemp -d /tmp/aiw-init-XXXX)"
for d in t1 t2 t3 t4; do mkdir -p "$FIX/$d"; done
trap 'rm -rf "$FIX"' EXIT

echo "=== empty target ==="
./aiw init "$FIX/t1" --for claude-code >/dev/null 2>&1
if [[ -d "$FIX/t1/.agents/skills" && -f "$FIX/t1/AGENTS.md" && -f "$FIX/t1/.mcp.json" && -f "$FIX/t1/.env" ]]; then
  _ok "empty target gets core + projections + .env"
else
  _fail "empty target install incomplete"
fi
count="$(find "$FIX/t1/.agents/skills" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l | tr -d ' ')"
if [[ "$count" -eq 126 ]]; then _ok "126 skills installed"; else _fail "skill count $count"; fi
if [[ -L "$FIX/t1/.claude/skills/clean-code-review" && -f "$FIX/t1/.claude/skills/clean-code-review/SKILL.md" ]]; then
  _ok "claude links resolve inside target"
else
  _fail "claude links broken in target"
fi
if [[ -e "$FIX/t1/.opencode" ]]; then _fail ".opencode wholesale copied"; else _ok "no .opencode wholesale copy"; fi

echo "=== default rerun fails closed ==="
if ./aiw init "$FIX/t1" --for claude-code >/dev/null 2>&1; then _fail "rerun should fail closed"; else _ok "rerun fails closed"; fi

echo "=== identical rerun --merge ==="
./aiw init "$FIX/t1" --for claude-code --merge > "$FIX/merge-identical.log" 2>&1
if grep -q "0 added" "$FIX/merge-identical.log"; then _ok "identical merge is no-op"; else _fail "identical merge not no-op (see $FIX/merge-identical.log)"; fi

echo "=== conflicting skill fails ==="
echo "user content" > "$FIX/t1/.agents/skills/clean-code-review/SKILL.md"
if ./aiw init "$FIX/t1" --for claude-code --merge >/dev/null 2>&1; then
  _fail "conflicting skill should fail"
else
  _ok "conflicting skill fails"
fi
if [[ "$(cat "$FIX/t1/.agents/skills/clean-code-review/SKILL.md")" == "user content" ]]; then
  _ok "user-owned file untouched"
else
  _fail "user-owned file modified"
fi

echo "=== conflicting MCP fails ==="
mkdir -p "$FIX/t2" && ./aiw init "$FIX/t2" --for cursor >/dev/null 2>&1
echo '{"different": true}' > "$FIX/t2/.cursor/mcp.json"
if ./aiw init "$FIX/t2" --for cursor --merge >/dev/null 2>&1; then _fail "conflicting MCP should fail"; else _ok "conflicting MCP fails"; fi

echo "=== merge missing-entry add ==="
mkdir -p "$FIX/t3" && ./aiw init "$FIX/t3" --for claude-code >/dev/null 2>&1
rm "$FIX/t3/.mcp.json"
./aiw init "$FIX/t3" --for claude-code --merge > "$FIX/merge-missing.log" 2>&1
if grep -q "1 added" "$FIX/merge-missing.log"; then _ok "missing entry added"; else _fail "missing entry not added (see $FIX/merge-missing.log)"; fi
[[ -f "$FIX/t3/.mcp.json" ]] && _ok "missing file present after merge" || _fail "missing file absent"

echo "=== .env fake secret never copied ==="
mkdir -p "$FIX/t4" && echo "GITHUB_TOKEN=fake-secret-abcdef123" > "$FIX/t4/.env"
./aiw init "$FIX/t4" --for claude-code >/dev/null 2>&1
if grep -q "fake-secret-abcdef123" "$FIX/t4/.env" && ! grep -q "fake-secret-abcdef123" "$FIX"/t4/.agents/skills/* 2>/dev/null; then
  _ok ".env secret preserved, never propagated"
else
  _fail ".env secret handling wrong"
fi

echo "=== unknown --for rejected ==="
if ./aiw init "$FIX/t4" --for definitely-not-a-runtime >/dev/null 2>&1; then _fail "unknown runtime accepted"; else _ok "unknown runtime rejected"; fi

echo "=== S2-C IDE projections + MCP merge-assist ==="
mkdir -p "$FIX/t5" "$FIX/t6"
./aiw init "$FIX/t5" --for cursor-ide >/dev/null 2>&1
if [[ -f "$FIX/t5/.cursor/mcp.json" && -f "$FIX/t5/AGENTS.md" ]]; then _ok "cursor-ide installs shared cursor projection"; else _fail "cursor-ide install incomplete"; fi
./aiw init "$FIX/t6" --for vscode-copilot >/dev/null 2>&1
if node -e "const v=require('$FIX/t6/.vscode/mcp.json');if(!v.servers||!v.servers.github)process.exit(1)"; then _ok "vscode-copilot installs vscode projection"; else _fail "vscode-copilot install incomplete"; fi
echo '{"mcpServers":{"user-srv":{"command":"x"},"github":{"command":"y"}}}' > "$FIX/t5/.cursor/mcp.json"
./aiw init "$FIX/t5" --for cursor-ide --merge > "$FIX/merge-assist.log" 2>&1
if grep -q "target-only servers (kept): user-srv" "$FIX/merge-assist.log" && grep -q "differing servers (kept target version): github" "$FIX/merge-assist.log"; then
  _ok "merge-assist explains MCP conflict per server"
else
  _fail "merge-assist explanation missing (see $FIX/merge-assist.log)"
fi
if grep -q '"user-srv"' "$FIX/t5/.cursor/mcp.json"; then _ok "conflicting MCP target kept"; else _fail "conflicting MCP target modified"; fi

echo
echo "aiw init: $PASS passed, $FAIL failed"
[[ "$FAIL" -eq 0 ]]

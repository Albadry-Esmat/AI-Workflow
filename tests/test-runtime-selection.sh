#!/usr/bin/env bash
# tests/test-runtime-selection.sh — S1 runtime selection fixtures (CI).
#
# Hermetic: fake --version shims on a fixture PATH, temp target dirs with
# markers, isolated O2 state via AIW_O2_STATE_ROOT. No network, no secrets,
# no mutation of the developer workspace (O2 state redirected; aiw start runs
# with AIW_EXEC_DRY_RUN=1 so nothing executes).
#
# Covers: single-runtime (opencode/claude/codex/cursor/copilot/gemini/generic),
# no-runtime, multi-runtime ambiguity, explicit, explicit-unavailable, stale
# persisted, one marker, conflicting markers, IDE-only, opencode-absent
# regression, model-argv invariance.

# Note: no `set -e` — failing resolutions are expected outputs under test.
# Every case records PASS/FAIL explicitly; the suite exits nonzero iff FAIL > 0.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PASS=0
FAIL=0
_ok()   { echo "  PASS: $1"; PASS=$((PASS+1)); }
_fail() { echo "  FAIL: $1"; FAIL=$((FAIL+1)); }

FIX="$(mktemp -d /tmp/aiw-rt-XXXX)"
trap 'rm -rf "$FIX"' EXIT
mkdir -p "$FIX/bin" "$FIX/state" "$FIX/targets"
# Essentials available inside fixture PATHs (aiw needs node+bash; probes stay isolated).
for essential in node bash sh; do
  command -v "$essential" >/dev/null 2>&1 && ln -sf "$(command -v "$essential")" "$FIX/bin/$essential"
done

make_shim() { # $1 name — responds "<name> fake 9.9.9" to --version
  printf '#!/bin/sh\necho "%s fake 9.9.9"\n' "$1" > "$FIX/bin/$1"
  chmod +x "$FIX/bin/$1"
}

reset_fixtures() { # clear runtime shims, keep essentials (node/bash/sh)
  for f in "$FIX/bin/"*; do
    case "$(basename "$f")" in
      node|bash|sh) : ;;
      *) rm -f "$f" ;;
    esac
  done
}

O2="python3 scripts/onboarding-o2.py"
run_o2() { # args... — isolated state, fixture PATH first
  AIW_O2_STATE_ROOT="$FIX/state" PATH="$FIX/bin:/usr/bin:/bin" $O2 "$@"
}

MARKA="$FIX/targets/a"
MARKB="$FIX/targets/b"
MARKC="$FIX/targets/c"
mkdir -p "$MARKA/.claude" "$MARKB/.cursor" "$MARKC/.windsurf"
mkdir -p "$FIX/targets/empty"

echo "=== single-runtime probes (one shim at a time) ==="
for runtime in opencode claude-code codex cursor copilot-cli gemini-cli; do
  exe="$runtime"
  case "$runtime" in
    opencode) exe="opencode" ;; claude-code) exe="claude" ;; codex) exe="codex" ;;
    cursor) exe="agent" ;; copilot-cli) exe="copilot" ;; gemini-cli) exe="gemini" ;;
  esac
  reset_fixtures
  make_shim "$exe"
  out="$(run_o2 agent-resolve --target "$FIX/targets/empty" --for auto --dry-run --json 2>/dev/null)"
  got="$(node -e "console.log(JSON.parse(require('fs').readFileSync(0,'utf8')).adapter_id||'')" <<<"$out" 2>/dev/null)"
  if [[ "$got" == "$runtime" ]]; then _ok "single $runtime resolves"; else _fail "single $runtime resolved as '$got'"; fi
done

echo "=== generic-command only ==="
reset_fixtures
make_shim "myagent"
AIW_AGENT_COMMAND="$FIX/bin/myagent --prompt" AIW_O2_STATE_ROOT="$FIX/state" PATH="$FIX/bin:/usr/bin:/bin" \
  python3 scripts/onboarding-o2.py agent-resolve --target "$FIX/targets/empty" --for auto --dry-run --json 2>/dev/null > /tmp/aiw_rt_generic.json || true
got="$(node -e "console.log(JSON.parse(require('fs').readFileSync('/tmp/aiw_rt_generic.json','utf8')).adapter_id||'')" 2>/dev/null)"
if [[ "$got" == "generic-command" ]]; then _ok "generic-command resolves"; else _fail "generic resolved as '$got'"; fi

echo "=== no runtime ==="
reset_fixtures
out="$(run_o2 agent-resolve --target "$FIX/targets/empty" --for auto --dry-run --json 2>/dev/null)"
code_out="$(node -e "console.log(JSON.parse(require('fs').readFileSync(0,'utf8')).error_code||'')" <<<"$out" 2>/dev/null)"
if [[ "$code_out" == "O2-NO-RUNTIME" ]]; then _ok "no runtime fails closed (O2-NO-RUNTIME)"; else _fail "no-runtime gave '$code_out'"; fi

echo "=== multi-runtime ambiguity ==="
reset_fixtures
make_shim opencode
make_shim claude
out="$(run_o2 agent-resolve --target "$FIX/targets/empty" --for auto --dry-run --json 2>/dev/null)"
code_out="$(node -e "console.log(JSON.parse(require('fs').readFileSync(0,'utf8')).error_code||'')" <<<"$out" 2>/dev/null)"
if [[ "$code_out" == "O2-RUNTIME-AMBIGUOUS" ]]; then _ok "multi-runtime fails closed (O2-RUNTIME-AMBIGUOUS)"; else _fail "multi gave '$code_out'"; fi

echo "=== explicit / explicit-unavailable ==="
out="$(run_o2 agent-resolve --target "$FIX/targets/empty" --for codex --dry-run --json 2>/dev/null || true)"
code_out="$(node -e "console.log(JSON.parse(require('fs').readFileSync(0,'utf8')).error_code||JSON.parse(require('fs').readFileSync(0,'utf8')).adapter_id||'')" <<<"$out" 2>/dev/null)"
# codex shim absent here (only opencode+claude) → must fail closed, never switch
if [[ "$code_out" == "O2-ADAPTER-MISSING" ]]; then _ok "explicit unavailable fails closed"; else _fail "explicit-unavailable gave '$code_out'"; fi
make_shim codex
out="$(AIW_O2_STATE_ROOT="$FIX/state2" PATH="$FIX/bin:/usr/bin:/bin" python3 scripts/onboarding-o2.py agent-resolve --target "$FIX/targets/empty" --for codex --dry-run --json 2>/dev/null)"
got="$(node -e "console.log(JSON.parse(require('fs').readFileSync(0,'utf8')).adapter_id||'')" <<<"$out" 2>/dev/null)"
if [[ "$got" == "codex" ]]; then _ok "explicit available resolves"; else _fail "explicit gave '$got'"; fi

echo "=== stale persisted runtime ==="
reset_fixtures
make_shim codex
AIW_O2_STATE_ROOT="$FIX/state" PATH="$FIX/bin:/usr/bin:/bin" python3 scripts/onboarding-o2.py agent-use claude-code --json >/dev/null 2>&1 || true
# claude shim absent → use fails; persist claude via state seeding instead
python3 - "$FIX/state" "$ROOT" <<'PYEOF'
import hashlib
import json, sys
from pathlib import Path
root = Path(sys.argv[1])
repo = Path(sys.argv[2]).resolve()
root.mkdir(parents=True, exist_ok=True)
workflow_id = hashlib.sha256(str(repo).encode()).hexdigest()[:32]
state = {"schema_version": "1.0.0", "workflow_id": workflow_id, "mode": "apply", "steps": [],
         "runtime_selection": {"adapter_id": "claude-code", "selection_mode": "explicit-arg",
                               "availability": "detected", "version": "9.9.9",
                               "selected_at": "2026-01-01T00:00:00Z", "evidence_recorded": True},
         "auth": {}, "demo": {}, "recovery": {}, "updated_at": "2026-01-01T00:00:00Z"}
(root / "state.json").write_text(json.dumps(state))
PYEOF
out="$(run_o2 agent-resolve --target "$FIX/targets/empty" --for auto --dry-run --json 2>/dev/null)"
code_out="$(node -e "console.log(JSON.parse(require('fs').readFileSync(0,'utf8')).error_code||'')" <<<"$out" 2>/dev/null)"
if [[ "$code_out" == "O2-RUNTIME-STALE" ]]; then _ok "stale persisted fails closed without switching"; else _fail "stale gave '$code_out'"; fi
rm -rf "$FIX/state"
mkdir -p "$FIX/state"

echo "=== markers: one / conflicting / IDE-only ==="
reset_fixtures
make_shim opencode
make_shim claude
make_shim agent
out="$(run_o2 agent-resolve --target "$MARKA" --for auto --dry-run --json 2>/dev/null)"
got="$(node -e "console.log(JSON.parse(require('fs').readFileSync(0,'utf8')).adapter_id||'')" <<<"$out" 2>/dev/null)"
if [[ "$got" == "claude-code" ]]; then _ok "single marker constrains to claude-code"; else _fail "marker gave '$got'"; fi
mkdir -p "$FIX/targets/both/.claude" "$FIX/targets/both/.cursor"
out="$(run_o2 agent-resolve --target "$FIX/targets/both" --for auto --dry-run --json 2>/dev/null)"
code_out="$(node -e "console.log(JSON.parse(require('fs').readFileSync(0,'utf8')).error_code||'')" <<<"$out" 2>/dev/null)"
if [[ "$code_out" == "O2-RUNTIME-AMBIGUOUS" ]]; then _ok "conflicting markers fail closed"; else _fail "conflict gave '$code_out'"; fi
reset_fixtures
out="$(run_o2 agent-resolve --target "$MARKC" --for auto --dry-run --json 2>/dev/null)"
code_out="$(node -e "console.log(JSON.parse(require('fs').readFileSync(0,'utf8')).error_code||JSON.parse(require('fs').readFileSync(0,'utf8')).adapter_id||'')" <<<"$out" 2>/dev/null)"
if [[ "$code_out" == "O2-NO-RUNTIME" ]]; then _ok "IDE-only markers without opener fall through closed"; else _fail "ide-only gave '$code_out'"; fi

echo "=== opencode-absent regression (aiw start --for auto) ==="
reset_fixtures
make_shim claude
export AIW_EXEC_DRY_RUN=1
export AIW_O2_STATE_ROOT="$FIX/state"
SAVED_PATH="$PATH"
export PATH="$FIX/bin:/usr/bin:/bin"
out="$(bash aiw start "$MARKA" --for auto 2>&1)"
code_start=0
echo "$out" | grep -q "DRY-RUN argv: \[claude-code\]" || { _fail "start did not resolve claude-code without opencode"; code_start=1; }
if [[ "$code_start" -eq 0 ]]; then _ok "opencode absent + claude present starts claude"; fi
export PATH="$SAVED_PATH"
unset AIW_EXEC_DRY_RUN AIW_O2_STATE_ROOT

echo "=== model argv invariance (dry-run across adapters) ==="
export AIW_EXEC_DRY_RUN=1
export AIW_O2_STATE_ROOT="$FIX/state2b"
mkdir -p "$FIX/state2b"
BAD=0
for spec in "opencode:opencode:opencode" "claude-code:claude:claude" "codex:codex:codex" "cursor:agent:cursor" "copilot-cli:copilot:copilot-cli" "gemini-cli:gemini:gemini-cli"; do
  runtime="${spec%%:*}"; rest="${spec#*:}"; exe="${rest%%:*}"
  reset_fixtures
  make_shim "$exe"
  export PATH="$FIX/bin:/usr/bin:/bin"
  out="$(bash aiw start "$FIX/targets/empty" --for "$runtime" 2>&1 || true)"
  argv="$(echo "$out" | grep "DRY-RUN argv" || true)"
  if [[ -z "$argv" ]]; then _fail "$runtime: no DRY-RUN argv captured"; BAD=1; continue; fi
  if echo "$argv" | grep -Eq '(^|[[:space:]])(-m|--model)([[:space:]]|=|$)'; then
    _fail "$runtime: model flag leaked into argv: $argv"; BAD=1
  fi
done
[[ "$BAD" -eq 0 ]] && _ok "no model override flags in any launch argv"
export PATH="$SAVED_PATH"
unset AIW_EXEC_DRY_RUN AIW_O2_STATE_ROOT

echo
echo "Runtime selection: $PASS passed, $FAIL failed"
[[ "$FAIL" -eq 0 ]]

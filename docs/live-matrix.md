# Live Execution Matrix — runtime-owned auth, zero AIW keys

Live = execution through the runtime's own non-interactive entry with the runtime's
own auth. AIW holds zero model credentials and never calls provider APIs.

| Runtime | Dispatch | Auth check | Live status |
|---|---|---|---|
| Codex | `codex exec --json` (default read-only sandbox) | `codex login status` | ✅ proven (12–14s, usage captured) |
| Claude Code | `claude -p --bare --no-session-persistence --output-format json --allowedTools Read --max-turns 3`, stdin piping | account markers in `~/.claude.json` (presence alone is NOT enough — verified) | runner implemented, awaiting `/login` (refuses correctly today) |
| Copilot CLI | `copilot -p` / `-s` (docs-verified) | probe unverified | deferred — needs installed+authed runtime to prove |
| Cursor | `agent -p --mode=ask` (docs-verified) | `agent status` | deferred — local `agent` binary is not Cursor (recorded honestly) |
| Aider | `aider --message` read-only (`--read` only, `--no-auto-commits`, never `--yes-always`) | per-run completion | deferred — needs installed+authed runtime to prove |
| Antigravity | unknown (`agy --help` at implementation) | unknown | blocked on flag verification — no claims |
| Gemini CLI | legacy | — | kept det-only; prefer Antigravity |

Rules: read-only tools only for live; every dispatch gateway-wrapped; latency + runtime-reported
usage recorded in the trace envelope; costs aggregated from usage, never billing APIs.
`no-authenticated-runtime` is fail-closed, never bypassed.

## Native review commands
| Runtime | Command | Status |
|---|---|---|
| Codex | `codex review --base <branch>` / `--uncommitted` | ✅ proven (caught planted credential, P1 file:line) |
| Claude Code | `claude ultrareview [target] --json` | runner implemented, awaiting `/login` |

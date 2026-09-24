#!/usr/bin/env node
'use strict';
// Runtime authentication checks — best-effort, read-only, never prints secrets.
// AIW holds zero model credentials by design; auth always belongs to the runtime.
// Each check answers: is this runtime installed AND plausibly authenticated?
// A `false` result is fail-closed (no-authenticated-runtime), never an error to bypass.
const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function homedir() { return os.homedir(); }
function tryExec(cmd, args, timeout = 15000) {
  // spawnSync captures stdout AND stderr (CLIs often report status on stderr).
  const r = spawnSync(cmd, args, { encoding: 'utf8', timeout, stdio: ['ignore', 'pipe', 'pipe'] });
  const out = String(r.stdout || '') + '\n' + String(r.stderr || '');
  if (r.error) return { ok: false, out: out.trim(), code: r.status };
  return { ok: r.status === 0, out: out.trim(), code: r.status };
}
// Kept for --version probes where stdout-only is fine.
function probeVersion(cmd, args, timeout = 15000) {
  try {
    return { ok: true, out: execFileSync(cmd, args, { encoding: 'utf8', timeout }).trim() };
  } catch {
    return { ok: false, out: '' };
  }
}
function configExists(...parts) {
  try {
    const p = path.join(...parts);
    return fs.existsSync(p) && fs.statSync(p).size > 0;
  } catch { return false; }
}

const CHECKS = {
  // codex login status reports authentication state only (no model turn, no spend).
  'codex': () => {
    const r = tryExec('codex', ['login', 'status']);
    const authed = /logged in/i.test(r.out) && !/not logged in/i.test(r.out);
    return { authenticated: authed, method: 'codex login status', detail: authed ? 'runtime reports logged-in' : 'not logged in (or probe failed)' };
  },
  // OpenCode keeps provider auth in its own auth file; presence = configured (best-effort).
  'opencode': () => {
    const ok = configExists(homedir(), '.local', 'share', 'opencode', 'auth.json')
      || configExists(homedir(), '.config', 'opencode', 'auth.json');
    return { authenticated: ok, method: 'runtime auth file presence', detail: ok ? 'opencode auth file present' : 'no opencode auth file found' };
  },
  // Claude Code: account/OAuth markers inside its own config (keys only, never values).
  // Bare config presence is NOT enough (verified: config without login fails with "Not logged in").
  'claude-code': () => {
    try {
      const raw = fs.readFileSync(path.join(homedir(), '.claude.json'), 'utf8');
      const keys = Object.keys(JSON.parse(raw));
      const ok = keys.some((k) => /oauth|account|subscription|email/i.test(k));
      return { authenticated: ok, method: 'runtime account markers', detail: ok ? 'claude account markers present' : 'no claude account markers (run /login)' };
    } catch {
      return { authenticated: false, method: 'runtime account markers', detail: 'no claude config found' };
    }
  },
  // Cursor: agent status is the documented auth probe (needs auth itself).
  'cursor': () => {
    const r = tryExec('agent', ['status']);
    const authed = r.ok && /logged|email|account|plan/i.test(r.out);
    return { authenticated: authed, method: 'agent status', detail: authed ? 'agent reports authenticated session' : 'agent status did not confirm auth (or binary is not Cursor)' };
  },
  // Copilot CLI / Antigravity / Gemini / Aider: binary presence only until probes verify.
  'copilot-cli': () => ({ authenticated: false, method: 'unverified', detail: 'auth probe not yet verified for copilot CLI' }),
  'antigravity': () => ({ authenticated: false, method: 'unverified', detail: 'non-interactive flags not yet verified for agy' }),
  'gemini-cli': () => ({ authenticated: false, method: 'unverified', detail: 'legacy runtime; prefer antigravity' }),
  'aider': () => ({ authenticated: false, method: 'unverified', detail: 'provider backend is user env; completion proves auth per-run' }),
};

function checkAuth(adapterId) {
  const fn = CHECKS[adapterId];
  if (!fn) return { adapter: adapterId, installed: false, authenticated: false, method: 'unknown-adapter', detail: 'unknown adapter id' };
  const det = tryExec(
    adapterId === 'opencode' ? 'opencode' : adapterId === 'codex' ? 'codex' : adapterId === 'claude-code' ? 'claude' : adapterId === 'cursor' ? 'agent' : adapterId === 'copilot-cli' ? 'copilot' : adapterId === 'antigravity' ? 'agy' : adapterId === 'gemini-cli' ? 'gemini' : 'aider',
    ['--version']);
  const res = fn();
  return { adapter: adapterId, installed: det.ok, version: det.ok ? det.out.split('\n')[0] : null, ...res };
}
module.exports = { checkAuth, CHECKS };
if (require.main === module) {
  const id = process.argv[2] || 'codex';
  console.log(JSON.stringify(checkAuth(id), null, 2));
}

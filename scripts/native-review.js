#!/usr/bin/env node
'use strict';
// Native runtime review commands (P3 matrix) — the runtime's own reviewer with its
// own auth. Read-only by construction (reviews, never edits). Gateway-wrapped,
// trace-recorded with latency. Fail-closed on unauthenticated runtimes.
// Supported: codex (`codex review --base/--uncommitted`), claude (`ultrareview`).
const { spawnSync } = require('node:child_process');
const checkpointer = require('./checkpointer');
const gateway = require('./policy-gateway');
const trace = require('./trace-envelope');
const { checkAuth } = require('./runtime-auth');

function run(cmd, args, { timeoutMs = 240000, cwd } = {}) {
  const t0 = Date.now();
  const r = spawnSync(cmd, args, { encoding: 'utf8', timeout: timeoutMs, cwd, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 10 * 1024 * 1024 });
  return { ok: r.status === 0 && !r.error, code: r.status, out: String(r.stdout || ''), err: String(r.stderr || '').slice(-500), latency_ms: Date.now() - t0 };
}

const RUNNERS = {
  'codex': (target, opts) => target === 'uncommitted'
    ? run('codex', ['review', '--uncommitted'], opts)
    : run('codex', ['review', '--base', target], opts),
  'claude-code': (target, opts) => run('claude', ['ultrareview', target, '--json'], opts),
};

function nativeReview(threadId, { adapter = 'codex', target = 'uncommitted', cwd = null } = {}) {
  if (!RUNNERS[adapter]) return { failed: true, reason: `native review not implemented for: ${adapter}` };
  const auth = checkAuth(adapter);
  if (!auth.installed || !auth.authenticated) {
    return { failed: true, reason: `no-authenticated-runtime: ${adapter}` };
  }
  const verdict = gateway.check({ tool: 'read', path: '', threadId });
  if (verdict.decision !== 'allow') return { denied: true, reason: verdict.reason };
  const res = RUNNERS[adapter](target, { cwd });
  const rec = trace.writeTrace(threadId, {
    model: 'runtime-native',
    tool_calls: [{ tool: `${adapter}-review`, path: target, decision: res.ok ? 'allow' : 'deny', live: true, latency_ms: res.latency_ms, exit_code: res.code }],
    guardrail: res.ok ? 'allow' : 'deny',
    handoff: res.ok ? null : 'native-review-failed',
  });
  checkpointer.appendCheckpoint(threadId, { kind: 'native-review', adapter, target, latency_ms: res.latency_ms, trace_id: rec.trace_id, ok: res.ok });
  if (!res.ok) return { failed: true, reason: `native review failed (code ${res.code}): ${res.err}`, trace_id: rec.trace_id };
  return { ok: true, findings: res.out.slice(0, 4000), trace_id: rec.trace_id, latency_ms: res.latency_ms };
}
module.exports = { nativeReview, RUNNERS };
if (require.main === module) {
  const argv = process.argv.slice(2);
  const get = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
  const [adapter, target] = argv.filter((a) => !a.startsWith('--'));
  const r = nativeReview('native-' + Date.now(), { adapter: adapter || 'codex', target: target || 'uncommitted', cwd: get('--cwd') || undefined });
  console.log(JSON.stringify({ ok: r.ok, reason: r.reason, latency_ms: r.latency_ms, findings: String(r.findings || '').slice(0, 1000) }, null, 2));
}

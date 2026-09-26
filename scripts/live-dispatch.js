#!/usr/bin/env node
'use strict';
// Live dispatch v1 — executes a READ-ONLY analysis prompt through a runtime's OWN
// non-interactive entry with the runtime's OWN auth. AIW holds zero model credentials.
// Fail-closed: unauthenticated runtime, non-read-only tool, timeout, or any error
// returns { denied|failed } — never a fabricated result.
// v1 supports: codex (`codex exec --json`, default read-only sandbox),
// claude-code (`claude -p --bare`, read-only tool allowlist).
const { spawnSync } = require('node:child_process');
const checkpointer = require('./checkpointer');
const gateway = require('./policy-gateway');
const trace = require('./trace-envelope');
const { checkAuth } = require('./runtime-auth');

// Only read-class tools may go live. Anything else is denied before dispatch.
const LIVE_TOOLS = new Set(['read']);

function runCodex(prompt, { timeoutMs = 180000, cwd } = {}) {
  const t0 = Date.now();
  const r = spawnSync('codex', ['exec', '--json', prompt], {
    encoding: 'utf8', timeout: timeoutMs, cwd, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 10 * 1024 * 1024,
  });
  const latency_ms = Date.now() - t0;
  const out = String(r.stdout || '');
  // Parse JSONL events: final agent_message + best-effort usage.
  let final = null;
  let usage = null;
  for (const line of out.split('\n')) {
    const t = line.trim();
    if (!t.startsWith('{')) continue;
    try {
      const e = JSON.parse(t);
      const item = e.item || e;
      if (item.type === 'agent_message' && item.text) final = item.text;
      if (item.usage || e.usage) usage = item.usage || e.usage;
    } catch { /* ignore non-JSON progress lines */ }
  }
  return {
    ok: r.status === 0 && !r.error,
    code: r.status,
    timedOut: Boolean(r.error && String(r.error.message || '').includes('timed out')),
    final: final || (r.status === 0 ? out.slice(-2000) : null),
    usage, latency_ms,
    stderrTail: String(r.stderr || '').slice(-500),
  };
}

function runClaude(prompt, { timeoutMs = 180000, cwd } = {}) {
  const t0 = Date.now();
  const r = spawnSync('claude', ['-p', prompt, '--bare', '--no-session-persistence', '--output-format', 'json', '--allowedTools', 'Read', '--max-turns', '3'], {
    encoding: 'utf8', timeout: timeoutMs, cwd, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 10 * 1024 * 1024,
  });
  const latency_ms = Date.now() - t0;
  let final = null;
  let usage = null;
  try {
    const e = JSON.parse(String(r.stdout || ''));
    final = e.result || null;
    usage = e.usage || e.total_cost_usd !== undefined ? { ...(e.usage || {}), cost_usd: e.total_cost_usd } : null;
  } catch { final = String(r.stdout || '').slice(-2000) || null; }
  return {
    ok: r.status === 0 && !r.error,
    code: r.status,
    timedOut: Boolean(r.error && String(r.error.message || '').includes('timed out')),
    final, usage, latency_ms,
    stderrTail: String(r.stderr || '').slice(-500),
  };
}

const RUNNERS = { 'codex': runCodex, 'claude-code': runClaude };

function dispatch(threadId, { adapter = 'codex', prompt, model_id = null, model_tier = null, tier_hint = null, model_resolution = null, agent_identity = null, gate_id = null, subject_hash = null, execution_id = null, tool = 'read', targetPath = '', approval = null, timeoutMs } = {}) {
  if (!RUNNERS[adapter]) return { failed: true, reason: `live dispatch not yet implemented for adapter: ${adapter} (v1 supports: ${Object.keys(RUNNERS).join(', ')})` };
  if (!LIVE_TOOLS.has(tool)) return { denied: true, reason: `live dispatch allows read-only tools only (got: ${tool || '(empty)'})` };
  const auth = checkAuth(adapter);
  if (!auth.installed || !auth.authenticated) {
    return { failed: true, reason: `no-authenticated-runtime: ${adapter} (installed=${auth.installed}, authenticated=${auth.authenticated})` };
  }
  const verdict = gateway.check({ tool, path: targetPath, threadId, approval });
  if (verdict.decision !== 'allow') return { denied: true, reason: verdict.reason };
  const res = RUNNERS[adapter](prompt, { timeoutMs });
  const effectiveModel = model_id || model_tier || 'unknown';
  const rec = trace.writeTrace(threadId, {
    model: effectiveModel,
    model_id: model_id || undefined,
    model_resolution,
    agent_identity, gate_id, subject_hash, execution_id,
    tool_calls: [{ tool: `${adapter}-exec`, path: targetPath, decision: res.ok ? 'allow' : 'deny', live: true, latency_ms: res.latency_ms, usage: res.usage || undefined, exit_code: res.code }],
    guardrail: res.ok ? 'allow' : 'deny',
    handoff: res.ok ? null : (res.timedOut ? 'live-timeout' : 'live-failed'),
  });
  checkpointer.appendCheckpoint(threadId, { kind: 'live-turn', adapter, prompt: String(prompt).slice(0, 500), latency_ms: res.latency_ms, trace_id: rec.trace_id, ok: res.ok });
  if (!res.ok) return { failed: true, reason: res.timedOut ? `${adapter} exec timed out` : `${adapter} exec failed (code ${res.code}): ${res.stderrTail}`, trace_id: rec.trace_id, latency_ms: res.latency_ms };
  return { ok: true, final: res.final, usage: res.usage, trace_id: rec.trace_id, latency_ms: res.latency_ms };
}
module.exports = { dispatch, LIVE_TOOLS };

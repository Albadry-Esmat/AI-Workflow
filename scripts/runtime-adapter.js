#!/usr/bin/env node
'use strict';
// M1: RuntimeAdapter interface + OpenCode-local hardening (P1).
// Interface: start(thread_id) / send(prompt) / interrupt() / resume() / evidence().
// P1 evidence is launch-level + file checkpoints/traces only (no sandbox claims).
// Codex CLI remains interface-stub for Phase 2.
const { execFileSync } = require('node:child_process');
const checkpointer = require('./checkpointer');
const gateway = require('./policy-gateway');
const trace = require('./trace-envelope');

function detect() {
  try {
    const out = execFileSync('opencode', ['--version'], { encoding: 'utf8', timeout: 10000 }).trim();
    return { id: 'opencode', installed: true, version: out };
  } catch {
    return { id: 'opencode', installed: false, version: null };
  }
}
function start(threadId, { model_tier, pipeline }) {
  checkpointer.appendCheckpoint(threadId, { kind: 'run', phase: 'started', adapter: 'opencode', model_tier, pipeline });
  return { threadId, adapter: 'opencode' };
}
// send() enforces policy gateway BEFORE any tool use, records checkpoint + trace.
// In P1 the adapter executes deterministically (no live model call): it performs
// read-only retrieval planning and returns a planned diff. Live model dispatch
// lands in Phase 2 behind the same gateway + trace envelope.
function send(threadId, { prompt, model_tier, tool, targetPath, approval }) {
  const verdict = gateway.check({ tool: tool || 'read', path: targetPath || '', threadId, approval });
  const rec = trace.writeTrace(threadId, {
    model: model_tier || 'cheap',
    tool_calls: [{ tool: tool || 'read', path: targetPath || '', decision: verdict.decision }],
    guardrail: verdict.decision,
    handoff: verdict.decision === 'deny' ? 'policy-denied' : null,
  });
  checkpointer.appendCheckpoint(threadId, { kind: 'turn', prompt: String(prompt).slice(0, 500), verdict, trace_id: rec.trace_id });
  if (verdict.decision === 'deny') return { denied: true, reason: verdict.reason, trace_id: rec.trace_id };
  return { denied: false, planned: true, note: 'Deterministic plan (no live model). Live execution runs via the runtime with its own auth; AIW holds zero model credentials.', trace_id: rec.trace_id };
}
function interrupt(threadId, reason) {
  checkpointer.appendCheckpoint(threadId, { kind: 'interrupt', reason: reason || 'HITL' });
  return { interrupted: true };
}
function resume(threadId) {
  const latest = checkpointer.latestCheckpoint(threadId);
  return { resumed: true, from: latest };
}
function evidence(threadId) {
  return {
    adapter: 'opencode',
    evidence_level: 'launch-only + file-checkpoints/traces (P1)',
    checkpoints: checkpointer.readCheckpoints(threadId).length,
  };
}
module.exports = { detect, start, send, interrupt, resume, evidence };

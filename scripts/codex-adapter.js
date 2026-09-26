#!/usr/bin/env node
'use strict';
// Phase 2: Codex CLI adapter (interface-compatible with M1).
// Isolation via CODEX_HOME per tenant/thread; JSON-RPC app-server awareness
// without claiming sandbox guarantees beyond launch-level + file evidence.
// Evidence level stays honest: launch-only + file-checkpoints/traces until fixtures prove more.
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const checkpointer = require('./checkpointer');
const gateway = require('./policy-gateway');
const trace = require('./trace-envelope');

function detect() {
  try {
    const out = execFileSync('codex', ['--version'], { encoding: 'utf8', timeout: 10000 }).trim();
    return { id: 'codex', installed: true, version: out };
  } catch {
    return { id: 'codex', installed: false, version: null };
  }
}
function codexHome(threadId) {
  return path.join('CODEX_HOME=' + path.resolve('.opencode', 'state', threadId, 'codex-home'));
}
function start(threadId, { model_id, model_tier, tier_hint, pipeline, model_resolution = null, agent_identity = null }) {
  const effectiveModel = model_id || model_tier || 'unknown';
  checkpointer.appendCheckpoint(threadId, { kind: 'run', phase: 'started', adapter: 'codex', model_id: effectiveModel, model_tier, pipeline, isolation: 'CODEX_HOME per thread', model_resolution, agent_identity });
  return { threadId, adapter: 'codex' };
}
function send(threadId, { prompt, model_id, model_tier, tier_hint, model_resolution = null, agent_identity = null, gate_id = null, subject_hash = null, execution_id = null, tool, targetPath, approval }) {
  const verdict = gateway.check({ tool: tool || 'read', path: targetPath || '', threadId, approval });
  const effectiveModel = model_id || model_tier || 'unknown';
  const rec = trace.writeTrace(threadId, {
    model: effectiveModel,
    model_id: model_id || undefined,
    model_resolution,
    agent_identity, gate_id, subject_hash, execution_id,
    tool_calls: [{ tool: tool || 'read', path: targetPath || '', decision: verdict.decision, adapter: 'codex' }],
    guardrail: verdict.decision,
    handoff: verdict.decision === 'deny' ? 'policy-denied' : null,
  });
  checkpointer.appendCheckpoint(threadId, { kind: 'turn', adapter: 'codex', prompt: String(prompt).slice(0, 500), verdict, trace_id: rec.trace_id });
  if (verdict.decision === 'deny') return { denied: true, reason: verdict.reason, trace_id: rec.trace_id };
  return { denied: false, planned: true, isolation: codexHome(threadId), note: 'Deterministic plan via Codex adapter (no live model). Live runs as `codex exec` with the runtime auth; AIW holds zero model credentials.', trace_id: rec.trace_id };
}
module.exports = { detect, start, send, codexHome };

#!/usr/bin/env node
'use strict';
// Shared factory for CLI runtime adapters (Phase: full CLI matrix).
// Every adapter enforces the policy gateway BEFORE any tool use and records
// checkpoint + trace envelope. Evidence stays launch-only + file evidence until
// per-runtime fixtures prove more. Unknown behavior is never promoted.
const { execFileSync } = require('node:child_process');
const checkpointer = require('./checkpointer');
const gateway = require('./policy-gateway');
const trace = require('./trace-envelope');

function makeAdapter({ id, executable, isolation, notes }) {
  function detect() {
    try {
      const out = execFileSync(executable, ['--version'], { encoding: 'utf8', timeout: 10000 }).trim().split('\n')[0];
      return { id, installed: true, version: out };
    } catch {
      return { id, installed: false, version: null };
    }
  }
  function start(threadId, { model_id, model_tier, tier_hint, pipeline, model_resolution = null, agent_identity = null }) {
    const effectiveModel = model_id || model_tier || 'unknown';
    checkpointer.appendCheckpoint(threadId, { kind: 'run', phase: 'started', adapter: id, model_id: effectiveModel, model_tier, pipeline, isolation, model_resolution, agent_identity });
    return { threadId, adapter: id };
  }
  function send(threadId, { prompt, model_id, model_tier, tier_hint, model_resolution = null, agent_identity = null, gate_id = null, subject_hash = null, execution_id = null, tool, targetPath, approval }) {
    const verdict = gateway.check({ tool: tool || 'read', path: targetPath || '', threadId, approval });
    const effectiveModel = model_id || model_tier || 'unknown';
    const rec = trace.writeTrace(threadId, {
      model: effectiveModel,
      model_id: model_id || undefined,
      model_resolution,
      tool_calls: [{ tool: tool || 'read', path: targetPath || '', decision: verdict.decision, adapter: id }],
      guardrail: verdict.decision,
      handoff: verdict.decision === 'deny' ? 'policy-denied' : null,
    });
    checkpointer.appendCheckpoint(threadId, { kind: 'turn', adapter: id, prompt: String(prompt).slice(0, 500), verdict, trace_id: rec.trace_id });
    if (verdict.decision === 'deny') return { denied: true, reason: verdict.reason, trace_id: rec.trace_id };
    return { denied: false, planned: true, isolation, note: notes || 'Deterministic plan (no live model). Live execution runs via the runtime with its own auth; AIW holds zero model credentials.', trace_id: rec.trace_id };
  }
  function evidence(threadId) {
    return {
      adapter: id,
      evidence_level: 'launch-only + file-checkpoints/traces',
      checkpoints: checkpointer.readCheckpoints(threadId).length,
    };
  }
  return { detect, start, send, evidence, isolation };
}
module.exports = { makeAdapter };

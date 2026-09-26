#!/usr/bin/env node
'use strict';
// M4: Minimal trace envelope writer — one JSON line per turn to trace.jsonl.
// Schema: config/trace-envelope-schema.json (trace_id, thread_id, model, tool_calls, guardrail, handoff?, ts).
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
const { sanitizeId } = require('./sanitize-id');

function tracePath(threadId) {
  return path.join(ROOT, '.opencode', 'state', sanitizeId(threadId), 'trace.jsonl');
}
function newTraceId() {
  return 'tr-' + crypto.randomBytes(8).toString('hex');
}
function writeTrace(threadId, { model, model_id, model_resolution = null, agent_identity = null, gate_id = null, subject_hash = null, execution_id = null, tool_calls, guardrail, handoff = null, trace_id = null }) {
  if (!threadId) throw new Error('threadId required');
  if (!['allow', 'deny'].includes(guardrail)) throw new Error('guardrail must be allow|deny');
  // AUTHORITY: `model`/`model_id` must be an exact model ID when provided by
  // model-aware callers. Legacy bare tiers are rejected here to prevent hidden
  // substitution; unknown callers may still pass 'unknown' (no model claim).
  const resolvedModel = String(model_id || model || 'unknown');
  if (resolvedModel !== 'unknown' && ['cheap', 'balanced', 'frontier'].includes(resolvedModel)) {
    throw new Error(`trace-envelope: vague model tier '${resolvedModel}' forbidden; record an exact model_id`);
  }
  // Phase A: canonical envelopes (identity_version) are strictly validated
  // (unknown nested fields rejected — no downstream rewriting/smuggling);
  // legacy {agent}-only records remain accepted and are classified legacy
  // downstream via describeIdentity (never authenticated/authorized).
  if (agent_identity !== null && agent_identity !== undefined && typeof agent_identity === 'object' && agent_identity.identity_version !== undefined) {
    const identity = require('./execution-identity');
    agent_identity = identity.validateAgentIdentity(agent_identity);
  }
  if (model_resolution !== null && model_resolution !== undefined) {
    const forbidden = ['api_key', 'token', 'secret', 'credential', 'password'];
    const blob = JSON.stringify(model_resolution).toLowerCase();
    for (const key of forbidden) {
      if (blob.includes(key)) throw new Error('trace-envelope: model_resolution must not contain credentials');
    }
  }
  const record = {
    trace_id: trace_id || newTraceId(),
    thread_id: threadId,
    model: resolvedModel,
    tool_calls: Array.isArray(tool_calls) ? tool_calls : [],
    guardrail,
    handoff,
    ts: new Date().toISOString(),
  };
  if (model_id !== undefined) record.model_id = String(model_id);
  if (model_resolution !== undefined && model_resolution !== null) record.model_resolution = model_resolution;
  if (agent_identity !== undefined && agent_identity !== null) {
    if (typeof agent_identity !== 'object' || !agent_identity.agent) {
      throw new Error('trace-envelope: agent_identity must be { agent, ... }');
    }
    record.agent_identity = agent_identity;
  }
  if (gate_id !== undefined && gate_id !== null) record.gate_id = String(gate_id);
  if (subject_hash !== undefined && subject_hash !== null) record.subject_hash = String(subject_hash);
  if (execution_id !== undefined && execution_id !== null) record.execution_id = String(execution_id);
  fs.mkdirSync(path.dirname(tracePath(threadId)), { recursive: true });
  fs.appendFileSync(tracePath(threadId), JSON.stringify(record) + '\n', 'utf8');
  return record;
}
module.exports = { writeTrace, tracePath, newTraceId };

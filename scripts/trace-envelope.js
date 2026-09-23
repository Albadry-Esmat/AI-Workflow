#!/usr/bin/env node
'use strict';
// M4: Minimal trace envelope writer — one JSON line per turn to trace.jsonl.
// Schema: config/trace-envelope-schema.json (trace_id, thread_id, model, tool_calls, guardrail, handoff?, ts).
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');

function tracePath(threadId) {
  return path.join(ROOT, '.opencode', 'state', threadId, 'trace.jsonl');
}
function newTraceId() {
  return 'tr-' + crypto.randomBytes(8).toString('hex');
}
function writeTrace(threadId, { model, tool_calls, guardrail, handoff = null, trace_id = null }) {
  if (!threadId) throw new Error('threadId required');
  if (!['allow', 'deny'].includes(guardrail)) throw new Error('guardrail must be allow|deny');
  const record = {
    trace_id: trace_id || newTraceId(),
    thread_id: threadId,
    model: String(model || 'unknown'),
    tool_calls: Array.isArray(tool_calls) ? tool_calls : [],
    guardrail,
    handoff,
    ts: new Date().toISOString(),
  };
  fs.mkdirSync(path.dirname(tracePath(threadId)), { recursive: true });
  fs.appendFileSync(tracePath(threadId), JSON.stringify(record) + '\n', 'utf8');
  return record;
}
module.exports = { writeTrace, tracePath, newTraceId };

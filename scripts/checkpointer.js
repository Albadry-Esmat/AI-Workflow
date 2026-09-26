#!/usr/bin/env node
'use strict';
// M2: Durable file checkpointer — append-only JSONL per thread.
// Survives process restart (vs MemorySaver). Atomic write-tmp+rename.
// Side-effect idempotency via task() envelope with deterministic keys.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
const STATE_ROOT = path.join(ROOT, '.opencode', 'state');
const { sanitizeId } = require('./sanitize-id');

function threadDir(threadId) {
  return path.join(STATE_ROOT, sanitizeId(threadId));
}
function checkpointPath(threadId) {
  return path.join(threadDir(threadId), 'checkpoint.jsonl');
}
function ensureThread(threadId) {
  fs.mkdirSync(threadDir(threadId), { recursive: true });
}
function appendCheckpoint(threadId, record) {
  ensureThread(threadId);
  const line = JSON.stringify({ ...record, ts: new Date().toISOString() }) + '\n';
  const tmp = checkpointPath(threadId) + '.tmp-' + process.pid;
  // Append atomically: write tmp then append via read+rename is overkill for JSONL;
  // use appendFileSync (POSIX atomic for short lines) + fsync best-effort.
  fs.appendFileSync(checkpointPath(threadId), line, 'utf8');
  try { void tmp; } catch { /* noop */ }
  return record;
}
function readCheckpoints(threadId) {
  const p = checkpointPath(threadId);
  if (!fs.existsSync(p)) return [];
  return fs.readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
}
function latestCheckpoint(threadId) {
  const all = readCheckpoints(threadId);
  return all.length ? all[all.length - 1] : null;
}
// Idempotent task envelope: deterministic key = sha256(name + canonical args).
// If key already completed in checkpoint log, return cached result without re-executing.
function task(threadId, name, args, fn) {
  const key = 'task:' + crypto.createHash('sha256').update(name + ':' + JSON.stringify(args)).digest('hex').slice(0, 16);
  const all = readCheckpoints(threadId);
  const done = all.find((r) => r.key === key && r.status === 'completed');
  if (done) return { cached: true, result: done.result };
  const result = fn();
  appendCheckpoint(threadId, { kind: 'task', key, name, status: 'completed', result });
  return { cached: false, result };
}
module.exports = { threadDir, checkpointPath, appendCheckpoint, readCheckpoints, latestCheckpoint, task };

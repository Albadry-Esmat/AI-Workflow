#!/usr/bin/env node
'use strict';
// Work-item locks (K) — logical scopes with heartbeat + expiry. Stale locks die safely.
// Scopes: repository | module | service | schema | api-contract | infra
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const LOCKS_ROOT = path.join(ROOT, '.opencode', 'state', 'locks');
const DEFAULT_TTL_MS = 30 * 60 * 1000;

function lockPath(scope) {
  return path.join(LOCKS_ROOT, String(scope).replace(/[^a-zA-Z0-9-_/:]/g, '_').replace(/\//g, '__') + '.json');
}
function readLock(scope) {
  const p = lockPath(scope);
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}
function isLive(lock, now = Date.now()) {
  return Boolean(lock) && now < lock.expires_at && now - lock.heartbeat_at < lock.ttl_ms;
}
// Returns { acquired: true } or { acquired: false, holder }.
function acquire(scope, { caseId, owner, ttlMs = DEFAULT_TTL_MS } = {}) {
  if (!caseId || !owner) throw new Error('caseId and owner required');
  fs.mkdirSync(LOCKS_ROOT, { recursive: true });
  const existing = readLock(scope);
  if (isLive(existing)) {
    if (existing.case_id === caseId) return { acquired: true, renewed: true };
    return { acquired: false, holder: { case_id: existing.case_id, owner: existing.owner } };
  }
  const now = Date.now();
  fs.writeFileSync(lockPath(scope), JSON.stringify({
    scope, case_id: caseId, owner, created_at: now, heartbeat_at: now,
    expires_at: now + ttlMs, ttl_ms: ttlMs,
  }));
  return { acquired: true };
}
function heartbeat(scope, caseId) {
  const lock = readLock(scope);
  if (!lock || lock.case_id !== caseId) return false;
  lock.heartbeat_at = Date.now();
  fs.writeFileSync(lockPath(scope), JSON.stringify(lock));
  return true;
}
function release(scope, caseId) {
  const lock = readLock(scope);
  if (lock && lock.case_id === caseId) fs.rmSync(lockPath(scope), { force: true });
}
module.exports = { acquire, heartbeat, release, readLock, isLive, LOCKS_ROOT };

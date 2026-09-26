#!/usr/bin/env node
'use strict';
// invocation-cache.js — HEAD-bound memoization for skill invocations (Phase 3, G-8).
//
// The orchestrator memoizes identical skill invocations. A cache key that omits
// the code revision serves STALE outputs after code changes, letting gates
// evaluate artifacts that no longer correspond to the code. This module binds
// every key to the repo HEAD SHA (or marks the entry head-unbound), so a HEAD
// move always misses. Cache-hit outputs are tagged and NEVER eligible as sole
// gate evidence — a gate must see at least one fresh execution for its subject.
//
// Head SHA provider is injectable for deterministic tests; the default reads
// `git rev-parse HEAD` best-effort (null when unavailable → head-unbound).
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

function defaultHeadSha(cwd) {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim() || null;
  } catch {
    return null;
  }
}

function canonical(value) {
  return JSON.stringify(value);
}

// key(): deterministic cache key for (skill, input, head).
// headSha === null → the key carries 'no-head' AND the entry is flagged
// head_unbound (ineligible as gate evidence).
function key(skill, inputPayload, headSha) {
  const head = headSha || 'no-head';
  const digest = crypto.createHash('sha256')
    .update(`${skill}:${head}:${canonical(inputPayload)}`, 'utf8')
    .digest('hex')
    .slice(0, 32);
  return `${skill}:${head.slice(0, 12)}:${digest}`;
}

// lookup(store, cacheKey): store is a Map (or plain object). Returns
// { hit, entry } where a hit carries cache_hit:true.
function lookup(store, cacheKey) {
  const get = store instanceof Map ? store.get(cacheKey) : store[cacheKey];
  if (get === undefined) return { hit: false, entry: null };
  return { hit: true, entry: { ...get, cache_hit: true } };
}

function storeResult(store, cacheKey, { output, headSha, skill }) {
  const entry = {
    output,
    skill: skill || null,
    head_sha: headSha || null,
    head_unbound: !headSha,
    stored_at: new Date().toISOString(),
  };
  if (store instanceof Map) store.set(cacheKey, entry);
  else store[cacheKey] = entry;
  return entry;
}

// eligibleAsGateEvidence(): cache hits are never sole gate evidence; entries
// recorded without a HEAD binding are never gate evidence at all.
function eligibleAsGateEvidence(entry, currentHeadSha) {
  if (!entry || entry.cache_hit) return { eligible: false, reason: 'cache-hit outputs are never sole gate evidence' };
  if (entry.head_unbound) return { eligible: false, reason: 'entry recorded without HEAD binding' };
  if (currentHeadSha && entry.head_sha && entry.head_sha !== currentHeadSha) {
    return { eligible: false, reason: 'entry predates current HEAD (stale)' };
  }
  return { eligible: true, reason: 'fresh execution bound to current HEAD' };
}

module.exports = { defaultHeadSha, key, lookup, storeResult, eligibleAsGateEvidence };

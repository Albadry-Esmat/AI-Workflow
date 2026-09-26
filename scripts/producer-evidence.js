#!/usr/bin/env node
'use strict';
// Phase D — Trustworthy producer-evidence pipeline.
//
// Answers: which canonical principals produced the exact governed subject?
// Attribution comes ONLY from system-generated launcher evidence (launcher-
// owned Phase A identity + derived HEAD subject), never from git author text,
// CLI input, branch names, or prompt text.
//
// Lifecycle: launchers record one entry per completed producer-role dispatch
// (outcome recorded; denied turns produced nothing and are skipped). Records
// are subject-keyed append-only JSONL: .opencode/state/producers/<sha>.jsonl.
// The producer SET for a subject = all recorded principals (deterministic,
// sorted); never collapsed to "last writer".
//
// Roles: only producer-class roles are recorded (PRODUCER_ROLES). Analysis /
// planning / review executions are auditable elsewhere and must not widen
// the governed producer set (over-inclusion would block legitimate review).

const fs = require('node:fs');
const path = require('node:path');
const identity = require('./execution-identity');
const { withLock } = require('./file-lock');
const { sanitizeId } = require('./sanitize-id');

const ROOT = path.resolve(__dirname, '..');

// Roles whose executions can modify the governed repo subject.
const PRODUCER_ROLES = new Set(['developer']);

// repoHeadSha(): derived current subject (repo HEAD). Returns null when the
// working tree is not a readable git checkout (non-repo executions record
// nothing — attribution without a subject is not producer evidence).
function repoHeadSha() {
  try {
    const { execFileSync } = require('node:child_process');
    const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    return /^[a-f0-9]{16,128}$/i.test(sha) ? sha.toLowerCase() : null;
  } catch {
    return null;
  }
}

function producersPath(subjectHash) {
  if (!/^[a-f0-9]{16,128}$/i.test(subjectHash || '')) {
    throw new Error('producer-evidence: subject hash must be hex (16-128 chars)');
  }
  return path.join(ROOT, '.opencode', 'state', 'producers', `${sanitizeId(subjectHash.toLowerCase(), { maxLength: 128 })}.jsonl`);
}

// record(): launcher-owned identity + derived subject only. Throws on
// malformed input (fail-closed); never invents attribution.
function record({ agentIdentity, subjectHash, outcome = 'completed', sourceRef = null }) {
  const valid = identity.validateAgentIdentity(agentIdentity, 'producer.agentIdentity');
  if (!PRODUCER_ROLES.has(valid.role)) {
    return { recorded: false, reason: `role '${valid.role}' is not a producer role` };
  }
  if (!/^[a-f0-9]{16,128}$/i.test(subjectHash || '')) {
    throw new Error('producer-evidence: subject hash must be hex (16-128 chars)');
  }
  if (!['completed', 'failed'].includes(outcome)) {
    throw new Error('producer-evidence: outcome must be completed|failed');
  }
  const entry = {
    event: 'producer_recorded',
    producer: valid.principal,
    producer_role: valid.role,
    producer_agent: valid.agent,
    execution_id: valid.execution_id,
    parent_execution_id: valid.parent_execution_id,
    worker: valid.worker,
    subject_hash: subjectHash.toLowerCase(),
    outcome,
    source_ref: sourceRef,
    source: valid.source,
    recorded_at: new Date().toISOString(),
  };
  const p = producersPath(subjectHash);
  withLock(p, () => {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.appendFileSync(p, JSON.stringify(entry) + '\n', 'utf8');
  });
  return { recorded: true, entry };
}

// loadForSubject(): deterministic producer set (sorted by principal key).
// Malformed lines fail closed (never silently skipped into the set).
function loadForSubject(subjectHash) {
  let p;
  try {
    p = producersPath(subjectHash);
  } catch {
    return { subject_hash: subjectHash || null, producers: [], entries: [] };
  }
  if (!fs.existsSync(p)) return { subject_hash: subjectHash.toLowerCase(), producers: [], entries: [] };
  const entries = fs.readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  for (const e of entries) {
    if (!e.producer || typeof e.producer.type !== 'string' || typeof e.producer.id !== 'string') {
      throw new Error('producer-evidence: stored entry lacks a canonical producer principal');
    }
    if (e.subject_hash !== subjectHash.toLowerCase()) {
      throw new Error('producer-evidence: stored entry subject mismatch (cross-subject contamination)');
    }
  }
  const seen = new Map();
  for (const e of entries) seen.set(`${e.producer.type}:${e.producer.id}`, e.producer);
  const producers = [...seen.values()].sort((a, b) => `${a.type}:${a.id}`.localeCompare(`${b.type}:${b.id}`));
  return { subject_hash: subjectHash.toLowerCase(), producers, entries };
}

module.exports = { PRODUCER_ROLES, producersPath, record, loadForSubject, repoHeadSha };

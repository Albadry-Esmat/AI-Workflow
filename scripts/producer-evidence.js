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

// Producer evidence is a launcher-owned assertion.  These are the only
// provenance values emitted by the real dispatch paths; CLI/test labels and
// arbitrary caller supplied sources are not evidence.
const LAUNCHER_SOURCES = new Set(['launcher:aiw-run', 'launcher:orchestrate-workers']);

const ENTRY_KEYS = new Set([
  'event', 'producer', 'producer_role', 'producer_agent', 'execution_id',
  'parent_execution_id', 'worker', 'subject_hash', 'outcome', 'source_ref',
  'source', 'recorded_at',
]);

function evidenceError(message, code = 'PRODUCER_EVIDENCE_MALFORMED') {
  const err = new Error(`producer-evidence: ${message}`);
  err.code = code;
  return err;
}

function normalizeSubjectHash(subjectHash) {
  if (typeof subjectHash !== 'string' || !/^[a-f0-9]{16,128}$/i.test(subjectHash)) {
    throw evidenceError('subject hash must be hex (16-128 chars)', 'PRODUCER_SUBJECT_INVALID');
  }
  return subjectHash.toLowerCase();
}

function assertLauncherIdentity(valid) {
  if (!LAUNCHER_SOURCES.has(valid.source)) {
    throw evidenceError(`identity source '${valid.source}' is not a launcher-owned producer source`, 'PRODUCER_PROVENANCE_INVALID');
  }
  if (valid.principal.type !== 'agent' || valid.principal.authenticated !== false) {
    throw evidenceError('producer principal must be an unauthenticated canonical agent principal', 'PRODUCER_PRINCIPAL_INVALID');
  }
  if (valid.principal.source !== valid.source) {
    throw evidenceError('principal source must match launcher identity source', 'PRODUCER_PROVENANCE_INVALID');
  }
  if (identity.roleForAgent(valid.agent) !== valid.role) {
    throw evidenceError('producer role does not match the canonical agent role', 'PRODUCER_ROLE_MISMATCH');
  }
}

function validateWorkerFields(entry) {
  if (entry.worker === null) {
    if (entry.parent_execution_id !== null) {
      throw evidenceError('non-worker producer cannot have a parent execution id', 'PRODUCER_EXECUTION_INVALID');
    }
    return;
  }
  if (!entry.worker || typeof entry.worker !== 'object' || Array.isArray(entry.worker)) {
    throw evidenceError('worker must be an object or null', 'PRODUCER_EXECUTION_INVALID');
  }
  const workerKeys = Object.keys(entry.worker).sort();
  if (workerKeys.length !== 2 || workerKeys[0] !== 'id' || workerKeys[1] !== 'index'
      || !Number.isInteger(entry.worker.index) || entry.worker.index < 0
      || typeof entry.worker.id !== 'string') {
    throw evidenceError('worker must be {index >= 0, id}', 'PRODUCER_EXECUTION_INVALID');
  }
  if (typeof entry.parent_execution_id !== 'string' || entry.parent_execution_id.length === 0
      || entry.worker.id !== entry.execution_id
      || entry.worker.id !== `${entry.parent_execution_id}-w${entry.worker.index}`) {
    throw evidenceError('worker, parent execution, and execution_id are inconsistent', 'PRODUCER_EXECUTION_INVALID');
  }
}

// Validate an on-disk record as a complete, canonical evidence envelope.
// This is intentionally stricter than the identity reader: stored evidence is
// an authorization input and must fail closed on any ambiguity.
function validateEntry(entry, { subjectHash = null } = {}) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    throw evidenceError('stored entry must be an object');
  }
  for (const key of Object.keys(entry)) {
    if (!ENTRY_KEYS.has(key)) throw evidenceError(`unknown stored entry field '${key}'`);
  }
  const required = [...ENTRY_KEYS].filter((key) => !['parent_execution_id', 'worker'].includes(key));
  for (const key of required) {
    if (!(key in entry)) throw evidenceError(`stored entry is missing '${key}'`);
  }
  if (entry.event !== 'producer_recorded') throw evidenceError('event must be producer_recorded');

  let principal;
  try {
    principal = identity.validatePrincipal(entry.producer, 'producer.entry.producer');
  } catch (err) {
    throw evidenceError(`canonical producer principal invalid: ${err.message}`, 'PRODUCER_PRINCIPAL_INVALID');
  }
  const principalKeys = Object.keys(entry.producer || {}).sort();
  if (principalKeys.join(',') !== 'authenticated,id,source,type') {
    throw evidenceError('canonical producer principal must contain exactly type,id,authenticated,source', 'PRODUCER_PRINCIPAL_INVALID');
  }
  if (principal.type !== 'agent' || principal.authenticated !== false) {
    throw evidenceError('producer principal must be an unauthenticated canonical agent principal', 'PRODUCER_PRINCIPAL_INVALID');
  }
  if (typeof entry.producer_agent !== 'string' || entry.producer_agent.length === 0
      || entry.producer_agent !== principal.id) {
    throw evidenceError('producer_agent must match producer.id', 'PRODUCER_AGENT_MISMATCH');
  }
  if (typeof entry.producer_role !== 'string' || entry.producer_role.length === 0) {
    throw evidenceError('producer_role must be a non-empty string', 'PRODUCER_ROLE_INVALID');
  }
  if (identity.roleForAgent(entry.producer_agent) !== entry.producer_role) {
    throw evidenceError('producer_role does not match producer_agent', 'PRODUCER_ROLE_MISMATCH');
  }
  if (!PRODUCER_ROLES.has(entry.producer_role)) {
    throw evidenceError(`role '${entry.producer_role}' is not a producer role`, 'PRODUCER_ROLE_INVALID');
  }
  if (typeof entry.source !== 'string' || !LAUNCHER_SOURCES.has(entry.source)) {
    throw evidenceError('source is not launcher-owned', 'PRODUCER_PROVENANCE_INVALID');
  }
  if (principal.source !== entry.source) {
    throw evidenceError('producer principal source does not match source', 'PRODUCER_PROVENANCE_INVALID');
  }
  if (typeof entry.execution_id !== 'string' || entry.execution_id.length === 0) {
    throw evidenceError('execution_id must be a non-empty string', 'PRODUCER_EXECUTION_INVALID');
  }
  if (typeof entry.source_ref !== 'string' || entry.source_ref.length === 0
      || entry.source_ref !== entry.execution_id) {
    throw evidenceError('source_ref must be the recorded execution_id', 'PRODUCER_EXECUTION_INVALID');
  }
  if (!Object.prototype.hasOwnProperty.call(entry, 'parent_execution_id')) {
    throw evidenceError('parent_execution_id is required', 'PRODUCER_EXECUTION_INVALID');
  }
  if (entry.parent_execution_id !== null && typeof entry.parent_execution_id !== 'string') {
    throw evidenceError('parent_execution_id must be a string or null', 'PRODUCER_EXECUTION_INVALID');
  }
  validateWorkerFields(entry);

  const subject = normalizeSubjectHash(entry.subject_hash);
  if (subjectHash !== null && subject !== normalizeSubjectHash(subjectHash)) {
    throw evidenceError('stored entry subject mismatch (cross-subject contamination)', 'PRODUCER_SUBJECT_MISMATCH');
  }
  if (!['completed', 'failed'].includes(entry.outcome)) {
    throw evidenceError('outcome must be completed|failed', 'PRODUCER_OUTCOME_INVALID');
  }
  if (typeof entry.recorded_at !== 'string' || Number.isNaN(Date.parse(entry.recorded_at))
      || new Date(entry.recorded_at).toISOString() !== entry.recorded_at) {
    throw evidenceError('recorded_at must be an ISO timestamp', 'PRODUCER_TIMESTAMP_INVALID');
  }
  return { ...entry, producer: principal, subject_hash: subject };
}

function readEntries(filePath, subjectHash) {
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, 'utf8');
  if (raw.length === 0) return [];
  const lines = raw.split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  if (lines.some((line) => line.trim() === '')) throw evidenceError('blank or ambiguous JSONL record');
  const entries = lines.map((line, index) => {
    let parsed;
    try {
      parsed = JSON.parse(line);
    } catch (err) {
      throw evidenceError(`stored record ${index + 1} is not valid JSON: ${err.message}`);
    }
    return validateEntry(parsed, { subjectHash });
  });
  const executionIds = new Set();
  for (const entry of entries) {
    if (executionIds.has(entry.execution_id)) {
      throw evidenceError(`ambiguous duplicate execution_id '${entry.execution_id}'`, 'PRODUCER_EXECUTION_AMBIGUOUS');
    }
    executionIds.add(entry.execution_id);
  }
  return entries;
}

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
  const subject = normalizeSubjectHash(subjectHash);
  return path.join(ROOT, '.opencode', 'state', 'producers', `${sanitizeId(subject, { maxLength: 128 })}.jsonl`);
}

// record(): launcher-owned identity + derived subject only. Throws on
// malformed input (fail-closed); never invents attribution.
function record({ agentIdentity, subjectHash, outcome, sourceRef }) {
  const valid = identity.validateAgentIdentity(agentIdentity, 'producer.agentIdentity');
  assertLauncherIdentity(valid);
  const subject = normalizeSubjectHash(subjectHash);
  if (!['completed', 'failed'].includes(outcome)) {
    throw evidenceError('outcome must be explicitly completed|failed', 'PRODUCER_OUTCOME_INVALID');
  }
  if (typeof sourceRef !== 'string' || sourceRef.length === 0 || sourceRef !== valid.execution_id) {
    throw evidenceError('source_ref must equal the launcher execution_id', 'PRODUCER_EXECUTION_INVALID');
  }
  if (!PRODUCER_ROLES.has(valid.role)) {
    if (valid.role === null) throw evidenceError(`unknown role for agent '${valid.agent}'`, 'PRODUCER_ROLE_INVALID');
    return { recorded: false, reason: `role '${valid.role}' is not a producer role` };
  }
  const entry = {
    event: 'producer_recorded',
    producer: valid.principal,
    producer_role: valid.role,
    producer_agent: valid.agent,
    execution_id: valid.execution_id,
    parent_execution_id: valid.parent_execution_id,
    worker: valid.worker,
    subject_hash: subject,
    outcome,
    source_ref: sourceRef,
    source: valid.source,
    recorded_at: new Date().toISOString(),
  };
  validateEntry(entry, { subjectHash: subject });
  const p = producersPath(subject);
  withLock(p, () => {
    const existing = readEntries(p, subject);
    if (existing.some((stored) => stored.execution_id === entry.execution_id)) {
      throw evidenceError(`ambiguous duplicate execution_id '${entry.execution_id}'`, 'PRODUCER_EXECUTION_AMBIGUOUS');
    }
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.appendFileSync(p, JSON.stringify(entry) + '\n', 'utf8');
  });
  return { recorded: true, entry };
}

// Launcher dispatch wrapper.  A failed evidence write is an execution failure,
// not a warning: callers must not report a successful producer dispatch.
function recordDispatch({ agentIdentity, result, sourceRef }) {
  if (result && result.denied) return { recorded: false, skipped: true, reason: 'policy-denied' };
  if (!agentIdentity || !PRODUCER_ROLES.has(agentIdentity.role)) return { recorded: false, skipped: true, reason: 'non-producer-role' };
  const subject = repoHeadSha();
  if (!subject) throw evidenceError('cannot derive repo HEAD subject for producer dispatch', 'PRODUCER_SUBJECT_UNAVAILABLE');
  const written = record({ agentIdentity, subjectHash: subject, outcome: result && result.failed ? 'failed' : 'completed', sourceRef });
  if (!written.recorded) throw evidenceError(`producer dispatch was not recorded: ${written.reason}`, 'PRODUCER_WRITE_FAILED');
  return written;
}

// loadForSubject(): deterministic producer set (sorted by principal key).
// Malformed lines fail closed (never silently skipped into the set).
function loadForSubject(subjectHash) {
  const subject = normalizeSubjectHash(subjectHash);
  const p = producersPath(subject);
  const entries = readEntries(p, subject);
  const seen = new Map();
  for (const e of entries) seen.set(`${e.producer.type}:${e.producer.id}`, e.producer);
  const producers = [...seen.values()].sort((a, b) => `${a.type}:${a.id}`.localeCompare(`${b.type}:${b.id}`));
  return { subject_hash: subject, producers, entries };
}

module.exports = {
  PRODUCER_ROLES,
  LAUNCHER_SOURCES,
  producersPath,
  record,
  recordDispatch,
  validateEntry,
  loadForSubject,
  repoHeadSha,
};

#!/usr/bin/env node
'use strict';
// gate-decisions.js — authoritative approval / rejection / override registry.
//
// Separate code-owned governance infrastructure (Phase 1B). NOT the same as:
//   policy-approval.js → permission to perform a privileged tool/action
//   case-store.js      → workflow/case event history
// This module answers: may workflow state advance past a governance gate?
//
// Flow: human / authorized decision source → record() → decision_id → guards,
// orchestrator, and promotion resolve()/validate the id against the registry.
// Consumers receive ONLY { override_decision_id: "gd_..." } and must never
// trust { override_approved: true, approver: "..." } bearer objects.
//
// Record shape (integrity / attribution / authorization kept distinct):
//   integrity:     decision_id, subject_kind, subject_hash, prev_hash, record_hash
//   attribution:   principal { type, id, authenticated, source }
//   authorization: gate_id, gate_class, scope, policy_version
//   lifecycle:     decision, reason, decided_at, expires_at, execution_id
//
// Storage: append-only JSONL under .opencode/state/governance/decisions.jsonl.
// All writes hold scripts/file-lock.js and land via tmp+rename. Reads verify
// the hash chain (tamper-evident; a rewritten file fails verification).
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { withLock } = require('./file-lock');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_REGISTRY_PATH = path.join(ROOT, '.opencode', 'state', 'governance', 'decisions.jsonl');
const GENESIS_HASH = 'GENESIS';

// Overridable for deterministic tests (mirrors AIW_O2_STATE_ROOT convention).
// Production code must never set AIW_GATE_REGISTRY.
function registryPath() {
  return process.env.AIW_GATE_REGISTRY || DEFAULT_REGISTRY_PATH;
}

const DECISIONS = new Set(['approve', 'reject', 'acknowledge']);
const PRINCIPAL_TYPES = new Set(['human', 'agent', 'system']);
const SUBJECT_KINDS = new Set(['repo_head', 'plan', 'artifact', 'finding_set', 'policy', 'none']);

function utcNow() {
  return new Date().toISOString();
}

function sha256Hex(s) {
  return crypto.createHash('sha256').update(s, 'utf8').digest('hex');
}

// Canonical encoding: fixed key order, no whitespace variance.
function canonical(record) {
  const ordered = {
    decision_id: record.decision_id,
    execution_id: record.execution_id || null,
    gate_id: record.gate_id,
    gate_class: record.gate_class || null,
    decision: record.decision,
    subject_kind: record.subject_kind || 'none',
    subject_hash: record.subject_hash || null,
    principal: {
      type: record.principal.type,
      id: record.principal.id,
      authenticated: record.principal.authenticated === true,
      source: record.principal.source,
    },
    scope: record.scope || {},
    reason: record.reason,
    decided_at: record.decided_at,
    expires_at: record.expires_at || null,
    policy_version: record.policy_version || null,
    prev_hash: record.prev_hash,
  };
  return JSON.stringify(ordered);
}

function validateEnvelope(input) {
  const errors = [];
  if (!input.gate_id || typeof input.gate_id !== 'string') errors.push('gate_id required');
  if (!DECISIONS.has(input.decision)) errors.push(`decision must be one of ${[...DECISIONS].join('|')}`);
  if (input.subject_kind !== undefined && !SUBJECT_KINDS.has(input.subject_kind)) {
    errors.push(`subject_kind must be one of ${[...SUBJECT_KINDS].join('|')}`);
  }
  if (input.subject_hash !== undefined && input.subject_hash !== null
      && !/^[a-f0-9]{16,128}$/i.test(input.subject_hash) && input.subject_hash !== 'GENESIS') {
    errors.push('subject_hash must be hex (or null when subject is not yet bound)');
  }
  const p = input.principal;
  if (!p || typeof p !== 'object') {
    errors.push('principal envelope required');
  } else {
    if (!PRINCIPAL_TYPES.has(p.type)) errors.push(`principal.type must be one of ${[...PRINCIPAL_TYPES].join('|')}`);
    if (!p.id || typeof p.id !== 'string') errors.push('principal.id required');
    if (typeof p.authenticated !== 'boolean') errors.push('principal.authenticated must be boolean (never omit; unknown is false)');
    if (!p.source || typeof p.source !== 'string') errors.push('principal.source required (channel the decision arrived on)');
  }
  if (!input.reason || typeof input.reason !== 'string' || input.reason.trim().length < 8) {
    errors.push('reason required (minimum 8 characters; overrides need real justification)');
  }
  if (input.expires_at !== undefined && input.expires_at !== null
      && Number.isNaN(new Date(input.expires_at).getTime())) {
    errors.push('expires_at must be ISO-8601 or null');
  }
  if (input.scope !== undefined && (typeof input.scope !== 'object' || input.scope === null || Array.isArray(input.scope))) {
    errors.push('scope must be an object when present');
  }
  return errors;
}

function readAll() {
  const p = registryPath();
  if (!fs.existsSync(p)) return [];
  return fs.readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

function appendRecord(record) {
  const p = registryPath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const tmp = `${p}.tmp-${process.pid}`;
  const line = JSON.stringify(record) + '\n';
  if (!fs.existsSync(p)) {
    fs.writeFileSync(tmp, line, 'utf8');
  } else {
    const prev = fs.readFileSync(p, 'utf8');
    const prefix = prev.endsWith('\n') || prev === '' ? prev : `${prev}\n`;
    fs.writeFileSync(tmp, prefix + line, 'utf8');
  }
  fs.renameSync(tmp, p);
}

// record(): validate envelope, chain, and append. Returns the stored record
// (including decision_id and record_hash). Throws on invalid input.
function record(input) {
  const errors = validateEnvelope(input);
  if (errors.length > 0) {
    const err = new Error(`invalid decision envelope: ${errors.join('; ')}`);
    err.code = 'INVALID_DECISION_ENVELOPE';
    throw err;
  }
  // Fail-closed on corrupt state: nothing is recorded past unreadable history.
  let out;
  try {
    out = withLock(registryPath(), () => {
      const existing = readAll();
    const prev = existing.length > 0 ? existing[existing.length - 1].record_hash : GENESIS_HASH;
    const rec = {
      decision_id: 'gd_' + crypto.randomBytes(8).toString('hex'),
      execution_id: input.execution_id || null,
      gate_id: input.gate_id,
      gate_class: input.gate_class || null,
      decision: input.decision,
      subject_kind: input.subject_kind || 'none',
      subject_hash: input.subject_hash || null,
      principal: {
        type: input.principal.type,
        id: input.principal.id,
        authenticated: input.principal.authenticated === true,
        source: input.principal.source,
      },
      scope: input.scope || {},
      reason: input.reason,
      decided_at: input.decided_at || utcNow(),
      expires_at: input.expires_at || null,
      policy_version: input.policy_version || null,
      prev_hash: prev,
    };
    rec.record_hash = sha256Hex(canonical(rec));
    appendRecord(rec);
    return rec;
    });
  } catch (err) {
    if (err.code === 'INVALID_DECISION_ENVELOPE') throw err;
    const blocked = new Error(`decision not recorded: registry unreadable (${err.message})`);
    blocked.code = 'REGISTRY_CORRUPT';
    throw blocked;
  }
  return out;
}

function verifyChain(records = null) {
  const recs = records === null ? readAll() : records;
  let prev = GENESIS_HASH;
  for (const rec of recs) {
    if (rec.prev_hash !== prev) {
      return { valid: false, reason: `chain break at ${rec.decision_id}: prev_hash mismatch` };
    }
    if (rec.record_hash !== sha256Hex(canonical(rec))) {
      return { valid: false, reason: `tamper detected at ${rec.decision_id}: record_hash mismatch` };
    }
    prev = rec.record_hash;
  }
  return { valid: true, records: recs.length };
}

// resolve(): the only read path consumers may use. Returns
// { valid, reason, record }. Checks, in order: chain integrity, existence,
// expiry, then optional gate/scope/execution binding. Authority policy
// (which principals may decide which gate classes) is assessed via
// assessAuthority() and enforced by callers in Phase 2 — resolve() reports
// the assessment but does not yet reject on it.
function resolve(decisionId, expectations = {}, nowMs = Date.now()) {
  // Fail-closed on unreadable/corrupt registry state (never throw past the
  // caller: callers treat invalid as blocked, not as bypass).
  let chain;
  try {
    chain = verifyChain();
  } catch (err) {
    return { valid: false, reason: `registry unreadable: ${err.message}`, record: null };
  }
  if (!chain.valid) return { valid: false, reason: `registry integrity failure: ${chain.reason}`, record: null };
  let rec;
  try {
    rec = readAll().find((r) => r.decision_id === decisionId);
  } catch (err) {
    return { valid: false, reason: `registry unreadable: ${err.message}`, record: null };
  }
  if (!rec) return { valid: false, reason: 'unknown decision_id', record: null };
  if (rec.expires_at && new Date(rec.expires_at).getTime() < nowMs) {
    return { valid: false, reason: 'decision expired', record: rec };
  }
  if (expectations.gate_id && rec.gate_id !== expectations.gate_id) {
    return { valid: false, reason: `gate mismatch (${rec.gate_id} != ${expectations.gate_id})`, record: rec };
  }
  if (expectations.execution_id && rec.execution_id !== expectations.execution_id) {
    return { valid: false, reason: 'execution binding mismatch', record: rec };
  }
  if (expectations.scope) {
    for (const [k, v] of Object.entries(expectations.scope)) {
      if (JSON.stringify((rec.scope || {})[k]) !== JSON.stringify(v)) {
        return { valid: false, reason: `scope mismatch on '${k}'`, record: rec };
      }
    }
  }
  if (expectations.subject_hash && rec.subject_hash !== expectations.subject_hash) {
    return { valid: false, reason: 'subject changed since decision (stale approval)', record: rec };
  }
  return { valid: true, reason: 'decision resolves', record: rec, authority: assessAuthority(rec) };
}

// assessAuthority(): advisory reporter. Enforcement lives in authorizeForGate()
// below — callers that accept overrides MUST go through resolveOverride(),
// which enforces authority unless explicitly disabled (disabled only for
// read-only audits, never for gate advancement).
const HIGH_STAKES_CLASSES = new Set(['deployment', 'release', 'force-proceed', 'governance-change', 'security', 'completeness']);
function assessAuthority(rec) {
  if (rec.principal.type === 'human' && rec.principal.authenticated === true) {
    return { level: 'authenticated-human', sufficient_for_high_stakes: true };
  }
  if ((rec.gate_class && HIGH_STAKES_CLASSES.has(rec.gate_class))) {
    return {
      level: 'unauthenticated-for-high-stakes',
      sufficient_for_high_stakes: false,
      note: 'high-stakes gates require an authenticated human principal',
    };
  }
  return { level: 'unverified-principal', sufficient_for_high_stakes: false };
}

// authorizeForGate(): enforcing check. High-stakes gate classes require an
// authenticated human principal. Non-high-stakes classes require only a valid
// (integrity/expiry/binding-checked) record — the principal is still recorded
// for audit, so nothing is ever anonymous.
function authorizeForGate(rec, gateClass) {
  const cls = gateClass || rec.gate_class || 'general';
  if (HIGH_STAKES_CLASSES.has(cls)) {
    const p = rec.principal || {};
    if (!(p.type === 'human' && p.authenticated === true)) {
      return {
        allowed: false,
        reason: `gate class '${cls}' requires an authenticated human principal (got ${p.type || '?'}/authenticated=${p.authenticated === true})`,
      };
    }
  }
  return { allowed: true, reason: 'principal sufficient for gate class' };
}

const OVERRIDE_DECISIONS = new Set(['approve', 'acknowledge']);

// resolveOverride(): the SINGLE entry point for accepting an override.
// Rejects bearer objects by construction — callers pass only a decision_id.
// Checks: registry integrity → existence → expiry → gate/execution/scope/
// subject binding → decision kind (approve|acknowledge) → authority
// (unless enforceAuthority:false, which is allowed only for read-only audits).
function resolveOverride({ decision_id, gate_id, gate_class, execution_id, scope, subject_hash, enforceAuthority = true } = {}) {
  if (!decision_id || typeof decision_id !== 'string') {
    return { valid: false, reason: 'override requires a decision_id from the registry (bearer override objects are never trusted)', record: null };
  }
  const r = resolve(decision_id, { gate_id, execution_id, scope, subject_hash });
  if (!r.valid) return r;
  if (!OVERRIDE_DECISIONS.has(r.record.decision)) {
    return { valid: false, reason: `decision '${r.record.decision}' cannot authorize an override (requires approve|acknowledge)`, record: r.record };
  }
  if (enforceAuthority !== false) {
    const a = authorizeForGate(r.record, gate_class);
    if (!a.allowed) return { valid: false, reason: a.reason, record: r.record };
  }
  return { valid: true, reason: 'override authorized by registry decision', record: r.record };
}

module.exports = {
  record,
  resolve,
  resolveOverride,
  authorizeForGate,
  verifyChain,
  assessAuthority,
  validateEnvelope,
  registryPath,
  REGISTRY_PATH: DEFAULT_REGISTRY_PATH,
  HIGH_STAKES_CLASSES,
  DECISIONS,
};

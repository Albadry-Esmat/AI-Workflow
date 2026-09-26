#!/usr/bin/env node
'use strict';
// Phase E — Canonical findings lifecycle (single format; no competitor).
//
// Identity: fingerprint = sha256(canonical {rule_id, target, checker}).
// Excluded deliberately: message text, line numbers, timestamps, reporter —
// a finding stays the same lineage across retries/rewording/rediscovery.
// Materially different problems (different rule/target/checker) never merge.
//
// Lifecycle (append-only per fingerprint; history never rewritten):
//   OPEN       finding applies to its introduced subject.
//   RESOLVED   evidence proves it no longer applies (records resolved subject).
//   WAIVED     an authorized gate decision permits advancement despite it
//              (narrow scope: fingerprint + subject + expiry; see below).
//   SUPPRESSED presentation/triage only — NEVER changes blocking effect.
// Findings do NOT auto-carry across subjects: a HEAD change requires
// rediscovery (same fingerprint → historical continuity) or the old record
// stays readable but inapplicable. Resolution ≠ waiver, always.
//
// Severity (low|medium|high|critical) is INFORMATIONAL ONLY. Blocking is the
// separate boolean policy effect consumed by gates. Severity never decides
// advancement; a low-severity blocking finding still blocks.
//
// Waiver governance: waive() validates a gate decision (resolve + class +
// principal authority + scope binding + expiry) WITHOUT consuming it; the
// waiver is then re-validated on every advancement (freshness), so replay
// beyond fingerprint/subject/expiry scope is impossible. Waiver classes:
// security | completeness | governance-change (existing policy; authenticated
// principal required via authorizeForGate). The waiving principal must be
// independent of the governed producers and reviewer (SoD; no exceptions
// invented). No production minter exists — fail closed without a decision.

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const identity = require('./execution-identity');
const { withLock } = require('./file-lock');
const { sanitizeId } = require('./sanitize-id');

const ROOT = path.resolve(__dirname, '..');
const SEVERITIES = new Set(['low', 'medium', 'high', 'critical']);
const WAIVER_CLASSES = new Set(['security', 'completeness', 'governance-change']);

function sha256Hex(s) {
  return crypto.createHash('sha256').update(s, 'utf8').digest('hex');
}

// Deterministic fingerprint over logical identity only.
function fingerprint({ rule_id, target, checker }) {
  if (!rule_id || typeof rule_id !== 'string') throw new Error('finding-evidence: rule_id required');
  if (!target || typeof target !== 'string') throw new Error('finding-evidence: target required');
  if (!checker || typeof checker !== 'string') throw new Error('finding-evidence: checker required');
  const canonical = JSON.stringify({ checker: checker.trim(), rule_id: rule_id.trim(), target: target.trim().toLowerCase() });
  return 'fp_' + sha256Hex(canonical).slice(0, 16);
}

function findingsPath(fp) {
  if (!/^fp_[a-f0-9]{16}$/.test(fp || '')) throw new Error('finding-evidence: invalid fingerprint');
  return path.join(ROOT, '.opencode', 'state', 'findings', `${sanitizeId(fp, { maxLength: 32 })}.jsonl`);
}

function readEvents(fp) {
  const p = findingsPath(fp);
  if (!fs.existsSync(p)) return [];
  return fs.readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

function appendEvent(fp, event) {
  const p = findingsPath(fp);
  withLock(p, () => {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.appendFileSync(p, JSON.stringify(event) + '\n', 'utf8');
  });
  return event;
}

function checkHex(h, name) {
  if (!/^[a-f0-9]{16,128}$/i.test(h || '')) throw new Error(`finding-evidence: ${name} must be hex (16-128 chars)`);
  return h.toLowerCase();
}

// record(): open (or rediscover) a finding. Rediscovery on a new subject
// appends continuity to the same fingerprint lineage.
function record({ rule_id, target, checker, severity, blocking, subjectHash, reporterIdentity, evidenceRef = null, reason = null }) {
  const fp = fingerprint({ rule_id, target, checker });
  if (!SEVERITIES.has(severity)) throw new Error('finding-evidence: severity must be low|medium|high|critical (informational only)');
  if (typeof blocking !== 'boolean') throw new Error('finding-evidence: blocking must be boolean (policy effect, distinct from severity)');
  const reporter = identity.validateAgentIdentity(reporterIdentity, 'finding.reporterIdentity');
  const subject_hash = checkHex(subjectHash, 'subjectHash');
  const prior = readEvents(fp);
  const event = {
    event: prior.length === 0 ? 'finding_recorded' : 'finding_rediscovered',
    fingerprint: fp, rule_id, target, checker, severity, blocking,
    subject_hash, reporter: reporter.principal, reporter_role: reporter.role,
    reporter_execution: reporter.execution_id, evidence_ref: evidenceRef, reason,
    recorded_at: new Date().toISOString(),
  };
  appendEvent(fp, event);
  return { fingerprint: fp, event };
}

// resolveFinding(): evidence the issue no longer applies. Records resolved
// subject + resolver; validity for a subject is computed, never asserted.
function resolveFinding({ fingerprint: fp, resolvedSubject, resolverIdentity, evidenceRef = null, reason = null }) {
  const resolver = identity.validateAgentIdentity(resolverIdentity, 'resolution.resolverIdentity');
  const events = readEvents(fp);
  if (events.length === 0) throw new Error('finding-evidence: cannot resolve unknown fingerprint');
  const event = {
    event: 'finding_resolved', fingerprint: fp,
    previous_subject: events[events.length - 1].subject_hash || null,
    resolved_subject: checkHex(resolvedSubject, 'resolvedSubject'),
    resolver: resolver.principal, resolver_role: resolver.role,
    resolver_execution: resolver.execution_id, evidence_ref: evidenceRef, reason,
    recorded_at: new Date().toISOString(),
  };
  appendEvent(fp, event);
  return { fingerprint: fp, event };
}

// suppress(): presentation/triage ONLY. Recorded for audit; blockingState()
// ignores suppression for authorization (a suppressed blocking finding still
// blocks unless a valid waiver exists).
function suppress({ fingerprint: fp, scope = null, reason, byIdentity }) {
  if (!reason || reason.trim().length < 8) throw new Error('finding-evidence: suppression requires a reason (min 8 chars)');
  const by = identity.validateAgentIdentity(byIdentity, 'suppression.byIdentity');
  const event = {
    event: 'finding_suppressed', fingerprint: fp, scope,
    reason, suppressed_by: by.principal, recorded_at: new Date().toISOString(),
  };
  appendEvent(fp, event);
  return { fingerprint: fp, event };
}

// waive(): validate (not consume) a gate decision and record the waiver.
// Scope is fingerprint + subject + decision expiry, always.
function waive({ fingerprint: fp, subjectHash, decisionId, gateClass, reason }) {
  const subject_hash = checkHex(subjectHash, 'subjectHash');
  if (!WAIVER_CLASSES.has(gateClass)) {
    throw new Error(`finding-evidence: waiver class must be one of ${[...WAIVER_CLASSES].join('|')} (existing policy)`);
  }
  if (!reason || reason.trim().length < 8) throw new Error('finding-evidence: waiver requires a reason (min 8 chars)');
  const gd = require('./gate-decisions');
  const r = gd.resolve(decisionId, {});
  if (!r.valid) throw new Error(`finding-evidence: waiver decision invalid (${r.reason})`);
  const rec = r.record;
  if (rec.decision !== 'approve') throw new Error('finding-evidence: waiver requires an approve decision');
  if (rec.gate_class !== gateClass) throw new Error('finding-evidence: waiver decision class mismatch');
  const auth = gd.authorizeForGate(rec, gateClass);
  if (!auth.allowed) throw new Error(`finding-evidence: waiver unauthorized (${auth.reason})`);
  const scope = rec.scope || {};
  if (scope.waiver_fingerprint && scope.waiver_fingerprint !== fp) {
    throw new Error('finding-evidence: waiver decision scoped to a different fingerprint');
  }
  if (scope.waiver_subject && String(scope.waiver_subject).toLowerCase() !== subject_hash) {
    throw new Error('finding-evidence: waiver decision scoped to a different subject');
  }
  if (rec.subject_hash && rec.subject_hash.toLowerCase() !== subject_hash) {
    throw new Error('finding-evidence: waiver decision bound to a different subject');
  }
  const event = {
    event: 'finding_waived', fingerprint: fp, subject_hash,
    decision_id: rec.decision_id, gate_id: rec.gate_id, gate_class: rec.gate_class,
    waived_by: rec.principal, expires_at: rec.expires_at,
    reason, recorded_at: new Date().toISOString(),
  };
  appendEvent(fp, event);
  return { fingerprint: fp, event };
}

// fold(): current lifecycle state from history (no I/O beyond read).
function fold(events) {
  let status = 'UNKNOWN';
  let resolved_subject = null;
  let waiver = null;
  let suppressed = false;
  for (const e of events) {
    if (e.event === 'finding_recorded' || e.event === 'finding_rediscovered') status = 'OPEN';
    else if (e.event === 'finding_resolved') { status = 'RESOLVED'; resolved_subject = e.resolved_subject; waiver = null; }
    else if (e.event === 'finding_waived') { if (status === 'OPEN') status = 'WAIVED'; waiver = e; }
    else if (e.event === 'finding_suppressed') suppressed = true;
  }
  return { status, resolved_subject, waiver, suppressed };
}

// blockingState(): THE authoritative computation. Returns stable codes:
// FINDINGS_CLEAR | FINDING_BLOCKING_OPEN | FINDING_WAIVER_MISSING |
// FINDING_WAIVER_EXPIRED | FINDING_WAIVER_SUBJECT_MISMATCH |
// FINDING_WAIVER_UNAUTHORIZED | FINDING_EVIDENCE_STALE.
// producerKeys / reviewerKey enforce waiver independence (no invented exceptions).
function blockingState(fp, { subjectHash, producerKeys = [], reviewerKey = null, nowMs = Date.now() } = {}) {
  const fail = (code, detail) => ({ blocking: true, code, detail });
  const events = readEvents(fp);
  if (events.length === 0) return { blocking: false, code: 'FINDINGS_CLEAR', detail: 'no such finding' };
  const first = events[0];
  if (!first.blocking) return { blocking: false, code: 'FINDINGS_CLEAR', detail: 'finding is advisory (blocking=false)' };
  const subject = String(subjectHash || '').toLowerCase();
  if (first.subject_hash !== subject) {
    return fail('FINDING_EVIDENCE_STALE', 'finding was introduced on a different subject (readable history, not applicable)');
  }
  const state = fold(events);
  if (state.status === 'RESOLVED') {
    if (state.resolved_subject !== subject) {
      return fail('FINDING_EVIDENCE_STALE', 'finding resolved on a different subject; re-evaluation required');
    }
    return { blocking: false, code: 'FINDINGS_CLEAR', detail: 'finding resolved on the governed subject' };
  }
  if (state.status !== 'OPEN' && state.status !== 'WAIVED') {
    return fail('FINDING_EVIDENCE_STALE', `unexpected finding status ${state.status}`);
  }
  if (state.status === 'OPEN') {
    return fail('FINDING_BLOCKING_OPEN', 'open blocking finding with no waiver');
  }
  // WAIVED: re-validate scope, expiry, authority, independence on EVERY check.
  const w = state.waiver;
  if (!w) return fail('FINDING_WAIVER_MISSING', 'waived status without waiver record');
  if (w.subject_hash !== subject) return fail('FINDING_WAIVER_SUBJECT_MISMATCH', 'waiver scoped to a different subject');
  if (w.expires_at && new Date(w.expires_at).getTime() < nowMs) return fail('FINDING_WAIVER_EXPIRED', 'waiver expired');
  const wKey = w.waived_by ? `${w.waived_by.type}:${w.waived_by.id}` : null;
  if (!wKey) return fail('FINDING_WAIVER_UNAUTHORIZED', 'waiver lacks an attributable authorizer');
  if (producerKeys.includes(wKey)) return fail('FINDING_WAIVER_UNAUTHORIZED', 'waiver authorizer is a governed producer (self-waiver refused)');
  if (reviewerKey && wKey === reviewerKey) return fail('FINDING_WAIVER_UNAUTHORIZED', 'waiver authorizer authored the review (self-waiver refused)');
  return { blocking: false, code: 'FINDINGS_CLEAR', detail: `waived by ${wKey} until ${w.expires_at || 'subject change'}` };
}

// listForSubject(): fingerprints introduced on this subject (sorted).
// Deterministic directory scan; files are fingerprint-keyed by construction.
function listForSubject(subjectHash) {
  const subject = String(subjectHash || '').toLowerCase();
  const dir = path.join(ROOT, '.opencode', 'state', 'findings');
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const f of fs.readdirSync(dir).sort()) {
    if (!/^fp_[a-f0-9]{16}\.jsonl$/.test(f)) continue;
    const fp = f.slice(0, -'.jsonl'.length);
    const events = readEvents(fp);
    if (events.length > 0 && events[0].subject_hash === subject) out.push(fp);
  }
  return out;
}

module.exports = {
  SEVERITIES, WAIVER_CLASSES, fingerprint, findingsPath,
  record, resolveFinding, suppress, waive, fold, blockingState, readEvents,
  listForSubject,
};

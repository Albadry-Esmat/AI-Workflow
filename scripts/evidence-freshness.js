#!/usr/bin/env node
'use strict';
// Phase D — Central freshness/binding evaluator for governance evidence.
//
// Freshness matrix (derived from code):
//   producer evidence : subject-bound yes, execution-bound (audit) yes,
//                       reusable after HEAD change: NO (subject-keyed stores).
//   review            : subject-bound yes (must equal governed subject),
//                       execution recorded for audit; reusable after HEAD
//                       change: NO (stale reviews stay readable, authorize nothing).
//   gate decision     : delegated to gate-decisions.resolve (chain/expiry/
//                       gate/execution/subject binding); reusable: NO after
//                       subject change; single-use consumption via helper.
//   policy approval   : scope+expiry+single-use via policy-approval.validate/
//                       consume; thread-bound (execution); reusable after HEAD
//                       change only if scope/expiry still satisfy (policy-owned).
//   benchmark report  : bound via report.repo_head_sha; reusable after HEAD
//                       change: NO.
//   attestation       : immutable; authorizes only its own subject (stale for
//                       advancement on a new subject, auditable forever).
//
// Stable reason codes (tests assert codes, never text):
//   EVIDENCE_OK | EVIDENCE_MISSING | EVIDENCE_MALFORMED | EVIDENCE_UNATTRIBUTED
//   | EVIDENCE_SUBJECT_MISMATCH | EVIDENCE_EXECUTION_MISMATCH | EVIDENCE_STALE
//   | EVIDENCE_EXPIRED | EVIDENCE_NOT_APPROVING

const identity = require('./execution-identity');

function ok(kind) {
  return { fresh: true, code: 'EVIDENCE_OK', kind, detail: 'evidence is current for the governed subject' };
}
function stale(kind, code, detail) {
  return { fresh: false, code, kind, detail };
}

// check(kind, record, { subjectHash, executionId? }):
//   producer      record = producer-evidence entry (or {principal,...})
//   review        record = review-evidence entry (authoritative shape)
//   approval      record = policy-approval record ({expires_at, used, ...})
//   benchmark     record = benchmark report ({repo_head_sha, passed,...})
//   attestation   record = prior attestation ({repo_head_sha,...})
function check(kind, record, { subjectHash, executionId = null } = {}) {
  if (!subjectHash || typeof subjectHash !== 'string') {
    return stale(kind, 'EVIDENCE_MISSING', 'governed subject hash required');
  }
  const subject = subjectHash.toLowerCase();
  if (!record || typeof record !== 'object') return stale(kind, 'EVIDENCE_MISSING', `no ${kind} evidence presented`);

  if (kind === 'producer') {
    const cls = identity.describeIdentity({ identity_version: 1, agent: (record.producer || {}).id || '', principal: record.producer, role: record.producer_role || null, execution_id: record.execution_id || '', parent_execution_id: record.parent_execution_id || null, worker: record.worker || null, source: record.source || '' });
    if (!record.producer || typeof record.producer.id !== 'string') return stale(kind, 'EVIDENCE_UNATTRIBUTED', 'producer entry lacks a canonical principal');
    if (cls !== 'canonical') return stale(kind, 'EVIDENCE_MALFORMED', `producer identity is ${cls}`);
    if (String(record.subject_hash || '').toLowerCase() !== subject) return stale(kind, 'EVIDENCE_SUBJECT_MISMATCH', 'producer evidence refers to a different subject');
    if (executionId && record.execution_id !== executionId) return stale(kind, 'EVIDENCE_EXECUTION_MISMATCH', 'producer evidence belongs to a different execution');
    return ok(kind);
  }

  if (kind === 'review') {
    const duties = require('./separation-of-duties');
    const v = duties.validateReviewEvidence(record);
    if (!v.valid) {
      const code = v.code === 'SOD_UNATTRIBUTED_REVIEW' ? 'EVIDENCE_UNATTRIBUTED'
        : v.code === 'SOD_REVIEW_NOT_APPROVING' ? 'EVIDENCE_NOT_APPROVING'
        : 'EVIDENCE_MALFORMED';
      return stale(kind, code, v.detail);
    }
    if (String(record.subject_hash || '').toLowerCase() !== subject) return stale(kind, 'EVIDENCE_SUBJECT_MISMATCH', 'review refers to a different subject (stale review authorizes nothing)');
    if (executionId && record.execution_id !== executionId) return stale(kind, 'EVIDENCE_EXECUTION_MISMATCH', 'review belongs to a different execution');
    return ok(kind);
  }

  if (kind === 'approval') {
    if (record.used) return stale(kind, 'EVIDENCE_STALE', 'approval already consumed (single-use)');
    if (record.expires_at && new Date(record.expires_at).getTime() < Date.now()) return stale(kind, 'EVIDENCE_EXPIRED', 'approval expired');
    if (!record.token || !record.tool) return stale(kind, 'EVIDENCE_MALFORMED', 'approval record incomplete');
    return ok(kind);
  }

  if (kind === 'benchmark') {
    if (String(record.repo_head_sha || '').toLowerCase() !== subject) return stale(kind, 'EVIDENCE_SUBJECT_MISMATCH', 'benchmark ran against a different HEAD');
    if (typeof record.passed !== 'number' || typeof record.failed !== 'number' || record.failed !== 0) {
      return stale(kind, 'EVIDENCE_STALE', 'benchmark not green');
    }
    return ok(kind);
  }

  if (kind === 'attestation') {
    if (String(record.repo_head_sha || '').toLowerCase() !== subject) return stale(kind, 'EVIDENCE_SUBJECT_MISMATCH', 'attestation authorizes a different subject (readable, not reusable)');
    if (record.verdict !== 'approved') return stale(kind, 'EVIDENCE_NOT_APPROVING', 'attestation verdict is not approved');
    return ok(kind);
  }

  return stale(kind, 'EVIDENCE_MALFORMED', `unknown evidence kind '${kind}'`);
}

module.exports = { check };

#!/usr/bin/env node
'use strict';
// Phase D — Authoritative review-evidence records.
//
// An authoritative review binds: canonical reviewer principal + reviewer
// role + subject hash + execution id + outcome + timestamp (+ optional
// findings reference). Shape-validated by separation-of-duties
// validateReviewEvidence; stored subject-keyed append-only JSONL:
// .opencode/state/reviews/<sha>.jsonl.
//
// Minting: explicit record() calls (programmatic or CLI) with a Phase A
// identity. Claimed principals are recorded honestly (authenticated:false
// enforced by validatePrincipal); nothing here authenticates. The system
// never auto-records approvals — a review outcome is asserted by the
// recording actor, and SoD + freshness decide whether it authorizes.
// Latest approving review per subject is loadable deterministically.

const fs = require('node:fs');
const path = require('node:path');
const identity = require('./execution-identity');
const duties = require('./separation-of-duties');
const { withLock } = require('./file-lock');
const { sanitizeId } = require('./sanitize-id');

const ROOT = path.resolve(__dirname, '..');

function reviewsPath(subjectHash) {
  if (!/^[a-f0-9]{16,128}$/i.test(subjectHash || '')) {
    throw new Error('review-evidence: subject hash must be hex (16-128 chars)');
  }
  return path.join(ROOT, '.opencode', 'state', 'reviews', `${sanitizeId(subjectHash.toLowerCase(), { maxLength: 128 })}.jsonl`);
}

// record(): strict inputs; reviewer_identity must be canonical (claimed or
// launcher-owned — provenance in principal.source). Throws fail-closed.
function record({ reviewerIdentity, subjectHash, executionId, outcome, findingsRef = null, reason = null }) {
  const reviewer_identity = identity.validateAgentIdentity(reviewerIdentity, 'review.reviewerIdentity');
  if (!/^[a-f0-9]{16,128}$/i.test(subjectHash || '')) {
    throw new Error('review-evidence: subject hash must be hex (16-128 chars)');
  }
  if (typeof executionId !== 'string' || executionId.length === 0) {
    throw new Error('review-evidence: executionId must be a non-empty string');
  }
  const entry = {
    event: 'review_recorded',
    reviewer_identity,
    subject_hash: subjectHash.toLowerCase(),
    execution_id: executionId,
    outcome,
    findings_ref: findingsRef,
    reason,
    recorded_at: new Date().toISOString(),
  };
  const check = duties.validateReviewEvidence(entry);
  if (!check.valid && check.code !== 'SOD_REVIEW_NOT_APPROVING') {
    throw new Error(`review-evidence: not an authoritative review record (${check.code}: ${check.detail})`);
  }
  const p = reviewsPath(subjectHash);
  withLock(p, () => {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.appendFileSync(p, JSON.stringify(entry) + '\n', 'utf8');
  });
  return { recorded: true, entry };
}

// loadForSubject(): all reviews for the subject, timestamp-ordered.
// latestApproval(): newest outcome:'approve' record or null.
function loadForSubject(subjectHash) {
  let p;
  try {
    p = reviewsPath(subjectHash);
  } catch {
    return [];
  }
  if (!fs.existsSync(p)) return [];
  return fs.readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
    .sort((a, b) => String(a.recorded_at).localeCompare(String(b.recorded_at)));
}

function latestApproval(subjectHash) {
  const approvals = loadForSubject(subjectHash).filter((r) => r.outcome === 'approve');
  return approvals.length > 0 ? approvals[approvals.length - 1] : null;
}

module.exports = { reviewsPath, record, loadForSubject, latestApproval };

if (require.main === module) {
  const argv = process.argv.slice(2);
  const get = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
  if (argv[0] === 'record') {
    try {
      const reviewerIdentity = {
        identity_version: 1,
        agent: get('--reviewer') || '',
        principal: { type: get('--principal-type') || 'human', id: get('--principal-id') || '', source: get('--source') || 'cli-claim' },
        role: get('--role') || null,
        execution_id: get('--execution-id') || '',
        parent_execution_id: get('--parent-execution-id') || null,
        worker: null,
        source: get('--source') || 'cli-claim',
      };
      if (reviewerIdentity.agent === '') reviewerIdentity.agent = reviewerIdentity.principal.id;
      const rec = record({
        reviewerIdentity,
        subjectHash: get('--subject'),
        executionId: get('--execution-id') || '',
        outcome: get('--outcome') || 'approve',
        findingsRef: get('--findings-ref') || null,
        reason: get('--reason') || null,
      });
      console.log(JSON.stringify(rec.entry, null, 2));
    } catch (err) {
      console.error(`review refused: ${err.message}`);
      process.exit(1);
    }
  } else {
    console.error('Usage: review-evidence.js record --reviewer <agent> --subject <hex> --execution-id <id> --outcome approve|reject|needs-work [--principal-type human|agent|system] [--principal-id <id>] [--role <role>] [--source <origin>] [--findings-ref <ref>] [--reason <text>]');
    process.exit(2);
  }
}

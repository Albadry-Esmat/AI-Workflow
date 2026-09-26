#!/usr/bin/env node
'use strict';
// Phase C — Central separation-of-duties policy evaluator (no other module
// may implement SoD comparisons).
//
// Governed triad: Producer (created the subject) → Reviewer (independently
// evaluated it) → Gatekeeper (authorizes advancement on the evidence).
// Independence is PRINCIPAL-based: canonical `type:id`. Role relabeling,
// execution reseparation, and worker-index differences NEVER create
// independence for the same principal (Rules 5–6).
//
// Worker lineage policy: sibling workers are independent IFF their canonical
// principals differ. Rationale: the principal is the Phase A trust anchor and
// orchestrator delegation of distinct agents is the designed review pattern;
// same-agent siblings (same principal, different execution_id) remain one
// actor. Lineage (parent_execution_id) is reported for audit, never used to
// merge distinct principals or split one principal.
//
// Orchestrator: 'orchestrator' is in neither REVIEWER_ROLES nor
// GATEKEEPER_ROLES, so it can satisfy neither reviewer nor gate checks by
// construction (coordinates only). No SoD override exists: failures are
// terminal (a NEW independent review/gate is the only remedy).
//
// Reason codes are stable machine-readable strings; tests assert codes,
// never message text.

const identity = require('./execution-identity');

function principalKey(p) {
  if (!p || typeof p !== 'object') return null;
  if (typeof p.type !== 'string' || typeof p.id !== 'string') return null;
  return `${p.type}:${p.id}`;
}

// validateReviewEvidence(): the minimum authoritative review record.
// Binds reviewer principal + role + subject + execution + outcome.
// Legacy/unknown identity → fail closed (readable, never authoritative).
function validateReviewEvidence(review) {
  const fail = (code, detail) => ({ valid: false, code, detail });
  if (!review || typeof review !== 'object') return fail('SOD_REVIEW_EVIDENCE_MISSING', 'no review evidence presented');
  const classification = identity.describeIdentity(review.reviewer_identity);
  if (classification !== 'canonical') {
    return fail('SOD_UNATTRIBUTED_REVIEW', `reviewer identity is ${classification}; authoritative review requires canonical identity`);
  }
  const ri = review.reviewer_identity;
  if (!identity.REVIEWER_ROLES.has(ri.role)) {
    return fail('SOD_UNKNOWN_REVIEWER_ROLE', `reviewer role '${ri.role}' is not an authorized reviewer role`);
  }
  if (typeof review.subject_hash !== 'string' || review.subject_hash.length === 0) {
    return fail('SOD_REVIEW_SUBJECT_MISSING', 'review carries no subject hash');
  }
  if (typeof review.execution_id !== 'string' || review.execution_id.length === 0) {
    return fail('SOD_REVIEW_EXECUTION_MISSING', 'review carries no execution id');
  }
  if (typeof review.outcome !== 'string' || !['approve', 'reject', 'needs-work'].includes(review.outcome)) {
    return fail('SOD_REVIEW_OUTCOME_MISSING', 'review outcome must be approve|reject|needs-work');
  }
  if (review.outcome !== 'approve') {
    return fail('SOD_REVIEW_NOT_APPROVING', `review outcome '${review.outcome}' does not support advancement`);
  }
  return { valid: true, code: 'SOD_REVIEW_OK', reviewer_key: principalKey(ri.principal) };
}

// evaluate(): full triad check. Inputs:
//   subjectHash   governed subject all evidence must reference
//   producers     [{ principal, subject_hash?, execution_id? }] (set semantics)
//   reviewer      authoritative review record (see validateReviewEvidence)
//   gatePrincipal canonical principal authorizing (usually record.principal)
//   gateRole      role asserted for the gatekeeper (must be mapped)
// Returns { allowed, codes:[], details } — codes[] carries EVERY violation
// (all deterministic checks run; caller decides consumption).
function evaluate({ subjectHash, producers, reviewer, gatePrincipal, gateRole }) {
  const codes = [];
  const details = {};
  const deny = (code, detail) => { codes.push(code); details[code] = detail; };

  if (!subjectHash || typeof subjectHash !== 'string') {
    deny('SOD_SUBJECT_MISSING', 'governed subject hash required');
  }
  if (!Array.isArray(producers) || producers.length === 0) {
    deny('SOD_PRODUCER_EVIDENCE_MISSING', 'no producer evidence for the governed subject');
  }
  const producerKeys = new Set();
  for (const p of producers || []) {
    const k = principalKey(p && p.principal);
    if (!k) {
      deny('SOD_PRODUCER_EVIDENCE_MISSING', 'producer entry lacks a canonical principal');
      continue;
    }
    producerKeys.add(k);
    if (p.subject_hash && p.subject_hash !== subjectHash) {
      deny('SOD_PRODUCER_SUBJECT_MISMATCH', `producer ${k} evidence refers to a stale subject`);
    }
  }
  details.producer_keys = [...producerKeys].sort();

  // Principal equality (Rules 1–3, 5–6) is evaluated independently of role
  // validity so every violation is reported, even jointly with role failures.
  const reviewerKey = principalKey(reviewer && reviewer.reviewer_identity && reviewer.reviewer_identity.principal);
  if (reviewerKey) details.reviewer_key = reviewerKey;
  const rev = validateReviewEvidence(reviewer);
  if (!rev.valid) {
    deny(rev.code, rev.detail);
  } else if (reviewer.subject_hash !== subjectHash) {
    deny('SOD_REVIEW_SUBJECT_MISMATCH', 'review refers to a different subject than governed');
  }

  const gateKey = principalKey(gatePrincipal);
  if (!gateKey) {
    deny('SOD_UNATTRIBUTED_GATE', 'gatekeeper principal unattributable; authoritative gate requires canonical identity');
  }
  if (gateRole === undefined || gateRole === null || !identity.GATEKEEPER_ROLES.has(gateRole)) {
    deny('SOD_UNKNOWN_GATE_ROLE', `gate role '${gateRole}' is not an authorized gatekeeper role`);
  }

  // Rules 1–3, 5–6: principal equality only. Roles, executions, worker
  // indexes are reported for audit but never confer independence.
  if (reviewerKey && producerKeys.has(reviewerKey)) {
    deny('SOD_PRODUCER_EQUALS_REVIEWER', `reviewer ${reviewerKey} is a governed producer (role/execution relabeling does not confer independence)`);
  }
  if (gateKey && producerKeys.has(gateKey)) {
    deny('SOD_PRODUCER_EQUALS_GATEKEEPER', `gatekeeper ${gateKey} is a governed producer`);
  }
  if (gateKey && reviewerKey && gateKey === reviewerKey) {
    deny('SOD_REVIEWER_EQUALS_GATEKEEPER', `gatekeeper ${gateKey} authored the review it would authorize`);
  }

  // Lineage advisory (audit only): shared parents reported, never decisive.
  const lineages = new Set();
  for (const p of producers || []) {
    if (p && p.parent_execution_id) lineages.add(p.parent_execution_id);
  }
  if (reviewer && reviewer.parent_execution_id) lineages.add(reviewer.parent_execution_id);
  details.shared_lineage_roots = [...lineages].sort();

  return { allowed: codes.length === 0, codes, details };
}

module.exports = { evaluate, validateReviewEvidence, principalKey };

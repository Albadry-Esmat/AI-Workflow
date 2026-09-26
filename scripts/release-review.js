#!/usr/bin/env node
'use strict';
// Phase 4 (Phase 3-hardened) + Phase B: gate-decision-authorized release
// review with SHA binding. Requires:
//  --yes (explicit human intent; authorizes NOTHING by itself),
//  --decision-id gd_... (registry decision: gate_id 'release',
//    gate_class 'release', decision 'approve', subject repo HEAD, bound to this
//    thread, authenticated-human principal, unexpired, unconsumed),
//  benchmark det green, policy v1.1, template release-review resolving through
//  the authoritative model precedence path (task override → global →
//  runtime/session, verified against the live catalog).
// Attestation binds: repo_head_sha, decision/gate/subject/execution bindings,
// authorizing + requesting + producer + reviewer principals, SoD result,
// benchmark report hash, policy version. Flow: subject → producer evidence →
// review evidence → freshness → gate decision → SoD → authority → consume →
// attest. Missing/stale evidence fails closed before consumption.
// Boundary: model_id is authoritative; tier metadata never gates execution.
const { execFileSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const router = require('./task-router');
const checkpointer = require('./checkpointer');
const store = require('./store');

const ROOT = path.resolve(__dirname, '..');
const POLICY_VERSION = '1.1.0';

function repoHeadSha() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim() || null;
  } catch {
    return null;
  }
}

function sha256File(p) {
  try {
    return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
  } catch {
    return null;
  }
}

function main() {
  const argv = process.argv.slice(2);
  const get = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
  const yes = argv.includes('--yes');
  const thread = get('--thread') || 'release-' + Date.now();
  const claimedHead = get('--head-sha');
  const benchOut = get('--bench-out') || '/tmp/release-bench.json';
  const decisionId = get('--decision-id');
  if (!yes) { console.error('release-review requires explicit --yes (human intent confirmation; authorizes nothing by itself). Failing closed.'); process.exit(2); }
  if (!decisionId) {
    console.error('release-review requires --decision-id gd_... (a registry gate decision: gate_id \'release\', class \'release\', decision \'approve\', subject repo HEAD, authenticated-human principal). --yes alone cannot authorize release. Failing closed.');
    process.exit(2);
  }
  const r = router.route('release-review');
  // Precedence check: the template must resolve through the authoritative
  // verify path (task override → global → runtime/session), verified against
  // the live catalog. The router requirement key must match the manifest.
  const modelGate = require('./require-model-availability');
  let verified;
  try {
    verified = modelGate.verifyTemplate('release-review');
  } catch (err) {
    console.error(`release-review model verification failed: ${err.message} Failing closed.`);
    process.exit(1);
  }
  if (r.model_requirement !== 'tasks.release-review' || verified.model_resolution.model_requirement !== 'tasks.release-review') {
    console.error(`release-review must resolve via manifest requirement 'tasks.release-review'. Failing closed.`);
    process.exit(1);
  }
  const head = repoHeadSha();
  if (!head) { console.error('release-review cannot determine repo HEAD SHA. Failing closed.'); process.exit(1); }
  if (claimedHead && claimedHead !== head) {
    console.error(`release-review head mismatch: claimed ${claimedHead} != repo HEAD ${head} (stale approval). Failing closed.`);
    process.exit(1);
  }
  try {
    execFileSync('node', ['scripts/evaluate-execution-kernel.js', '--mode', 'det', '--out', benchOut], { stdio: 'pipe' });
  } catch {
    console.error('release blocked: deterministic benchmark not green. Failing closed.');
    process.exit(1);
  }
  const benchmarkHash = sha256File(benchOut);
  if (!benchmarkHash) { console.error('release blocked: benchmark report unreadable, cannot bind evidence. Failing closed.'); process.exit(1); }
  // Phase B: authorize LAST, after all evidence is green — a red benchmark
  // must not burn the single-use decision. Subject derived (repo HEAD);
  // execution from launcher context (thread). Caller-supplied hashes are
  // never trusted; --head-sha above is an optimistic-concurrency check only.
  const identity = require('./execution-identity');
  const requester = identity.createLauncherIdentity({ agent: 'reviewer', executionId: thread, source: 'launcher:release-review' });
  const gate = require('./require-gate-decision');
  // Phase D: evidence chain BEFORE authorization (stale/missing evidence must
  // not burn the single-use decision). Producers from launcher-generated
  // evidence only — no CLI producer claims exist or are accepted.
  const freshness = require('./evidence-freshness');
  const producerEvidence = require('./producer-evidence');
  const reviewEvidence = require('./review-evidence');
  const produced = producerEvidence.loadForSubject(head);
  const developerProducers = (produced.entries || []).filter((e) => producerEvidence.PRODUCER_ROLES.has(e.producer_role));
  if (developerProducers.length === 0) {
    console.error(`release blocked: no producer evidence for HEAD ${head.slice(0, 12)} (SOD_PRODUCER_EVIDENCE_MISSING). Producing executions record it automatically; unattributable subjects cannot advance. Failing closed.`);
    process.exit(1);
  }
  const review = reviewEvidence.latestApproval(head);
  if (!review) {
    console.error(`release blocked: no approving review for HEAD ${head.slice(0, 12)}. Authoritative reviews are recorded via review-evidence; stale/absent reviews authorize nothing. Failing closed.`);
    process.exit(1);
  }
  for (const entry of developerProducers) {
    const f = freshness.check('producer', entry, { subjectHash: head });
    if (!f.fresh) { console.error(`release blocked: producer evidence not fresh (${f.code}: ${f.detail}). Failing closed.`); process.exit(1); }
  }
  // Phase E: blocking findings for this subject — evaluated BEFORE gate
  // resolution so finding failures never burn the single-use decision.
  // Structured findings are authoritative over the review's approve outcome.
  const findingEvidence = require('./finding-evidence');
  const sodProducers = developerProducers.map((e) => ({ principal: e.producer, subject_hash: e.subject_hash }));
  const reviewerKeyForWaiver = `${review.reviewer_identity.principal.type}:${review.reviewer_identity.principal.id}`;
  const producerKeysForWaiver = sodProducers.map((p) => `${p.principal.type}:${p.principal.id}`);
  const findingResults = [];
  for (const fp of findingEvidence.listForSubject(head)) {
    const st = findingEvidence.blockingState(fp, { subjectHash: head, producerKeys: producerKeysForWaiver, reviewerKey: reviewerKeyForWaiver });
    findingResults.push({ fingerprint: fp, ...st });
    if (st.blocking) {
      console.error(`release blocked: finding ${fp} not clear (${st.code}: ${st.detail}). Failing closed.`);
      process.exit(1);
    }
  }
  const rf = freshness.check('review', review, { subjectHash: head });
  if (!rf.fresh) { console.error(`release blocked: review evidence not fresh (${rf.code}: ${rf.detail}). Failing closed.`); process.exit(1); }
  let benchReport = null;
  try {
    benchReport = JSON.parse(fs.readFileSync(benchOut, 'utf8'));
  } catch {
    console.error('release blocked: benchmark report unreadable, cannot verify freshness. Failing closed.');
    process.exit(1);
  }
  const bf = freshness.check('benchmark', benchReport, { subjectHash: head });
  if (!bf.fresh) { console.error(`release blocked: benchmark evidence not fresh (${bf.code}: ${bf.detail}). Failing closed.`); process.exit(1); }
  let authorization;
  try {
    authorization = gate.requireGateDecision({
      decisionId, gateId: 'release', gateClass: 'release', action: 'release-attest',
      subjectHash: head, subjectKind: 'repo_head', executionId: thread, requester,
      // Gate role asserted from exercised authority: a decision that passes
      // class + principal authorization for a governance gate class performs
      // the gatekeeper function (humans carry no agent role label).
      sod: { producers: sodProducers, reviewer: review, gateRole: 'gatekeeper' },
    });
  } catch (err) {
    console.error(`release blocked: ${err.message}`);
    process.exit(1);
  }
  const attestation = {
    verdict: 'approved',
    model_id: r.model_id,
    pipeline: r.pipeline,
    repo_head_sha: head,
    decision_id: authorization.record.decision_id,
    gate_id: authorization.record.gate_id,
    gate_class: authorization.record.gate_class,
    subject_kind: authorization.record.subject_kind,
    subject_hash: authorization.record.subject_hash,
    execution_id: thread,
    authorizing_principal: authorization.record.principal,
    requesting_principal: requester.principal,
    producer_principals: sodProducers.map((p) => p.principal),
    findings_evaluated: findingResults.map((f) => ({ fingerprint: f.fingerprint, code: f.code })),
    reviewer_principal: review.reviewer_identity.principal,
    review_recorded_at: review.recorded_at,
    sod_codes: (authorization.sod && authorization.sod.codes) || [],
    consumed_at: authorization.consumption.consumed_at,
    benchmark_path: benchOut,
    benchmark_sha256: benchmarkHash,
    policy_version: POLICY_VERSION,
    approved_by_flag: '--yes',
    ts: new Date().toISOString(),
  };
  checkpointer.appendCheckpoint(thread, { kind: 'release-review', ...attestation });
  store.put(thread, 'release-attestation', attestation);
  console.log(JSON.stringify({ thread, ...attestation }, null, 2));
}
if (require.main === module) main();
module.exports = { repoHeadSha, sha256File, POLICY_VERSION };

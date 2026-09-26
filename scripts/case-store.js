#!/usr/bin/env node
'use strict';
// Case/event store (P2) — artifacts/cases/<id>/ with immutable append-only events.
// Links thread_id -> PR -> reviews -> merge SHA into one audit chain.
const fs = require('node:fs');
const path = require('node:path');
const { transition } = require('./workflow-state');
const { sanitizeId } = require('./sanitize-id');

const ROOT = path.resolve(__dirname, '..');
const CASES_ROOT = path.join(ROOT, 'artifacts', 'cases');

function caseDir(caseId) {
  return path.join(CASES_ROOT, sanitizeId(caseId, { maxLength: 64 }));
}
function sanitize(id) {
  return sanitizeId(id, { maxLength: 64 });
}
function createCase(caseId, { issue = null, actor = 'orchestrator' } = {}) {
  const dir = caseDir(caseId);
  fs.mkdirSync(dir, { recursive: true });
  const state = { case_id: sanitize(caseId), state: 'READY', fixCycles: 0, issue, createdAt: new Date().toISOString() };
  fs.writeFileSync(path.join(dir, 'case.json'), JSON.stringify(state, null, 2));
  emit(caseId, { event: 'CASE_CREATED', actor, issue });
  return state;
}
function readCase(caseId) {
  return JSON.parse(fs.readFileSync(path.join(caseDir(caseId), 'case.json'), 'utf8'));
}
function writeArtifact(caseId, name, data) {
  const dir = caseDir(caseId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), typeof data === 'string' ? data : JSON.stringify(data, null, 2));
}
// Immutable: events are appended, never rewritten.
function emit(caseId, { event, actor = 'orchestrator', ...rest }) {
  const line = JSON.stringify({ event, actor, case_id: sanitize(caseId), timestamp: new Date().toISOString(), ...rest }) + '\n';
  fs.appendFileSync(path.join(caseDir(caseId), 'events.jsonl'), line, 'utf8');
  return line;
}
function readEvents(caseId) {
  const p = path.join(caseDir(caseId), 'events.jsonl');
  if (!fs.existsSync(p)) return [];
  return fs.readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
}
// State advance = validate transition + persist + audit event (atomic unit).
// case.json persists via tmp+rename (crash-safe: no partial state).
// `evidence` (optional references: decision/review/SoD results) is carried
// into the STATE_ event for audit; advancement authorization itself lives in
// the owning flow (e.g. release attestation), not in this generic writer.
function advance(caseId, to, { actor = 'orchestrator', headSha = null, reason = null, evidence = null } = {}) {
  const current = readCase(caseId);
  const next = transition(current, to, { actor });
  const target = path.join(caseDir(caseId), 'case.json');
  const tmp = `${target}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(next, null, 2), 'utf8');
  fs.renameSync(tmp, target);
  emit(caseId, { event: `STATE_${to}`, actor, from: current.state, head_sha: headSha, reason, evidence });
  return next;
}
// Audit chain: thread -> PR -> reviews -> merge, reconstructed from events.
function auditChain(caseId) {
  const chain = { thread_id: null, pr: null, reviews: [], merge_sha: null };
  for (const e of readEvents(caseId)) {
    if (e.thread_id && !chain.thread_id) chain.thread_id = e.thread_id;
    if (e.pr && !chain.pr) chain.pr = e.pr;
    if (e.event === 'PR_REVIEW_PUBLISHED') chain.reviews.push({ verdict: e.verdict, head_sha: e.head_sha, at: e.timestamp });
    if (e.event === 'STATE_MERGING' && e.head_sha) chain.merge_sha = e.head_sha;
  }
  return chain;
}
module.exports = { createCase, readCase, writeArtifact, emit, readEvents, advance, auditChain, CASES_ROOT };

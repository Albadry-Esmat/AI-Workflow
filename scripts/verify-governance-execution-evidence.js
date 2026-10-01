#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const { canonicalize } = require('./canonicalize-source-governance');

function reject(reason) { return { valid: false, reason }; }
function sha(value) { return crypto.createHash('sha256').update(value).digest('hex'); }

// Recompute subject evidence from Git objects in the trusted Gatekeeper. No
// repository script is invoked; callers must provide an absolute Git path.
function computeGitSubject({ repoDir, gitPath, baseSha, headSha, allowedPaths }) {
  if (!path.isAbsolute(gitPath)) throw new Error('git executable path must be absolute');
  if (!/^[a-f0-9]{40}$/.test(baseSha || '') || !/^[a-f0-9]{40}$/.test(headSha || '')) throw new Error('base/head must be full commit SHA');
  if (!Array.isArray(allowedPaths) || allowedPaths.some((p) => typeof p !== 'string' || p.startsWith('/') || p.split('/').includes('..'))) throw new Error('invalid allowed path set');
  const run = (...args) => execFileSync(gitPath, ['-C', repoDir, ...args], { env: {}, stdio: ['ignore', 'pipe', 'pipe'] });
  const common = run('merge-base', baseSha, headSha).toString('utf8').trim();
  if (common !== baseSha) throw new Error('base is not merge-base');
  const paths = run('diff', '--name-only', baseSha + '...' + headSha).toString('utf8').trim().split('\n').filter(Boolean).sort();
  const allow = [...allowedPaths].sort();
  if (new Set(allow).size !== allow.length || JSON.stringify(paths) !== JSON.stringify(allow)) throw new Error('Git path set differs from exact allowlist');
  const diff = run('diff', '--binary', '--full-index', '--no-ext-diff', baseSha + '...' + headSha);
  return { base_sha: baseSha, head_sha: headSha, changed_paths: paths, diff_sha256: sha(diff), scope_sha256: sha(canonicalize({ allowed_paths: allow })) };
}

function runtimeGatekeeperIdentity() {
  const repo = process.env.GITHUB_REPOSITORY || '';
  const ref = process.env.GITHUB_REF || '';
  const workflowRef = process.env.GITHUB_WORKFLOW_REF || '';
  const workflowSha = process.env.GITHUB_WORKFLOW_SHA || '';
  const runId = process.env.GITHUB_RUN_ID || '';
  const trustedPath = '.github/workflows/source-governance-witness.yml';
  const trustedRef = 'refs/heads/main';
  const trustedWorkflowRef = `${repo}/${trustedPath}@${trustedRef}`;
  if (repo !== 'Albadry-Esmat/AI-Workflow' || ref !== trustedRef || workflowRef !== trustedWorkflowRef || !/^[a-f0-9]{40}$/.test(workflowSha) || !/^\d+$/.test(runId)) return null;
  return { trusted: true, workflow_path: trustedPath, workflow_source_sha: workflowSha, repository: repo, ref, run_id: runId };
}

function verifyTriad({ subject, producers, reviewer, gatekeeper, authorization, repoDir, gitPath }) {
  if (!subject || !/^[a-f0-9]{64}$/.test(subject.diff_sha256 || '') || !/^[a-f0-9]{64}$/.test(subject.scope_sha256 || '')) return reject('invalid subject digests');
  if (!Array.isArray(producers) || producers.length !== 1 || !reviewer || !gatekeeper) return reject('producer/reviewer/gatekeeper evidence missing or ambiguous');
  if (!authorization || authorization.approver_login !== 'Albadry-Esmat' || !authorization.authorization_id || !/^[a-f0-9]{64}$/.test(authorization.canonical_payload_sha256 || '') || authorization.state !== 'active' || authorization.consumed !== false || !authorization.allowed_paths) return reject('trusted active owner authorization context is required');
  const authorizationExpiry = Date.parse(authorization.expires_at || '');
  if (!Number.isFinite(authorizationExpiry) || authorizationExpiry <= Date.now()) return reject('owner authorization expired/invalid');
  const runtimeIdentity = runtimeGatekeeperIdentity();
  if (!runtimeIdentity) return reject('Gatekeeper runtime identity unavailable');
  let independentlyRecomputed;
  try {
    independentlyRecomputed = computeGitSubject({ repoDir, gitPath, baseSha: authorization.base_sha, headSha: authorization.head_sha, allowedPaths: authorization.allowed_paths });
  } catch (error) { return reject(`Gatekeeper subject recomputation failed: ${error.message}`); }
  if (subject.base_sha !== independentlyRecomputed.base_sha || subject.head_sha !== independentlyRecomputed.head_sha || subject.diff_sha256 !== independentlyRecomputed.diff_sha256 || subject.scope_sha256 !== independentlyRecomputed.scope_sha256) return reject('subject differs from independently recomputed Git evidence');
  const p = producers[0];
  const sameSubject = (x) => x.base_sha === independentlyRecomputed.base_sha && x.head_sha === independentlyRecomputed.head_sha && x.diff_sha256 === independentlyRecomputed.diff_sha256 && x.scope_sha256 === independentlyRecomputed.scope_sha256;
  for (const [name, record] of [['producer', p], ['reviewer', reviewer], ['gatekeeper', gatekeeper]]) {
    if (!sameSubject(record)) return reject(`${name} evidence stale or bound to another subject`);
    if (record.role !== name) return reject(`${name} role mismatch`);
    if (!record.execution_id || !record.session_id) return reject(`${name} execution/session identity missing`);
    if (name !== 'producer' && record.outcome !== 'pass') return reject(`${name} outcome blocks`);
    if (!record.capabilities || !record.credentials) return reject(`${name} capability or credential inventory missing`);
    if (!record.model || record.model.requested !== 'openai/gpt-6-luna' || record.model.resolved !== 'openai/gpt-6-luna' || record.model.available !== true || typeof record.model.attested !== 'boolean') return reject(`${name} model resolution mismatch/unavailable`);
  }
  if (p.execution_id === reviewer.execution_id || p.session_id === reviewer.session_id) return reject('producer and reviewer execution/session must differ');
  if (p.execution_id === gatekeeper.execution_id || p.session_id === gatekeeper.session_id || reviewer.execution_id === gatekeeper.execution_id || reviewer.session_id === gatekeeper.session_id) return reject('gatekeeper execution/session must differ');
  if (p.capabilities.merge || p.capabilities.reviewer_evidence || p.capabilities.gatekeeper || p.capabilities.witness_signing || p.capabilities.source_write_scope_sha256 !== subject.scope_sha256) return reject('producer has forbidden authority or out-of-scope write capability');
  if (!reviewer.capabilities.read_only || reviewer.capabilities.source_write || reviewer.capabilities.merge || reviewer.capabilities.witness_signing || reviewer.capabilities.gatekeeper || reviewer.capabilities.reviewer_evidence !== true) return reject('reviewer capability is not read-only/authoritative');
  if (reviewer.reviewer_execution_id && reviewer.reviewer_execution_id !== reviewer.execution_id) return reject('reviewer execution binding mismatch');
  if (!reviewer.model || typeof reviewer.model.requested !== 'string' || typeof reviewer.model.resolved !== 'string' || reviewer.model.available !== true || typeof reviewer.model.attested !== 'boolean') return reject('model resolution evidence incomplete');
  if (reviewer.model.same_model_allowed !== true) return reject('same-model policy declaration missing');
  if (reviewer.model.same_execution_not_allowed !== true) return reject('same-execution prohibition missing');
  if (!gatekeeper.gatekeeper_identity || gatekeeper.gatekeeper_identity.trusted !== true || !gatekeeper.gatekeeper_identity.workflow_path || !gatekeeper.gatekeeper_identity.workflow_source_sha || !gatekeeper.gatekeeper_identity.repository || !gatekeeper.gatekeeper_identity.ref || !gatekeeper.gatekeeper_identity.run_id) return reject('gatekeeper trusted workflow identity incomplete');
  for (const key of ['workflow_path', 'workflow_source_sha', 'repository', 'ref', 'run_id']) {
    if (gatekeeper.gatekeeper_identity[key] !== runtimeIdentity[key]) return reject(`gatekeeper identity not independently bound: ${key}`);
  }
  if (gatekeeper.capabilities.source_write || gatekeeper.capabilities.reviewer_evidence || gatekeeper.capabilities.merge || gatekeeper.capabilities.witness_signing || !gatekeeper.capabilities.gatekeeper) return reject('gatekeeper capability mismatch');
  for (const [name, record] of [['producer', p], ['reviewer', reviewer], ['gatekeeper', gatekeeper]]) {
    if (!record.credentials || record.credentials.merge !== false || record.credentials.source_signing !== false || record.credentials.witness_signing !== false) return reject(`${name} has forbidden credential capability`);
  }
  const canonical = canonicalize({ authorization, subject: independentlyRecomputed, producers, reviewer, gatekeeper, gatekeeper_runtime: runtimeIdentity });
  return { valid: true, evidence_sha256: sha(canonical), subject_sha256: sha(canonicalize(subject)), same_model_allowed: Boolean(reviewer.model && reviewer.model.same_model_allowed), same_execution_not_allowed: true };
}

module.exports = { computeGitSubject, verifyTriad };

if (require.main === module) {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => { raw += chunk; });
  process.stdin.on('end', () => {
    try {
      const input = JSON.parse(raw);
      const result = verifyTriad(input);
      process.stdout.write(JSON.stringify(result) + '\n');
      if (!result.valid) process.exitCode = 2;
    } catch (error) {
      process.stderr.write(`verify-governance-execution-evidence: ${error.message}\n`);
      process.exitCode = 2;
    }
  });
}

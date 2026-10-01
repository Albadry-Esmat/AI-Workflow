#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { canonicalize } = require('./canonicalize-source-governance');

const OWNER = 'Albadry-Esmat';
const REPO = 'AI-Workflow';
const FULL_REPO = `${OWNER}/${REPO}`;
const API = 'https://api.github.com';
const AUTH_START = '<!-- AIW-W0-AUTHORIZATION/1 -->';
const AUTH_END = '<!-- /AIW-W0-AUTHORIZATION/1 -->';
const PASS_START = '<!-- AIW-W0-VERIFIER-PASS/1 -->';
const PASS_END = '<!-- /AIW-W0-VERIFIER-PASS/1 -->';

function sha(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function fail(message) { throw new Error(message); }

function parseCanonicalEnvelope(bytes) {
  let value;
  try { value = JSON.parse(bytes.toString('utf8')); } catch { fail('witness envelope JSON invalid'); }
  if (canonicalize(value) + '\n' !== bytes.toString('utf8')) fail('witness envelope is not canonical JCS');
  return value;
}

function parseA0Body(body) {
  let wrapper;
  try { wrapper = JSON.parse(body); } catch { fail('A0 issue body is not JSON'); }
  if (!wrapper || wrapper.canonicalization !== 'RFC8785-JCS (ASCII member names/values; integer-only numeric fields)' || !wrapper.a0_payload || typeof wrapper.canonical_payload_sha256 !== 'string') fail('A0 envelope shape invalid');
  const digest = sha(canonicalize(wrapper.a0_payload));
  if (digest !== wrapper.canonical_payload_sha256) fail('A0 canonical payload digest mismatch');
  const a0 = wrapper.a0_payload;
  if (a0.schema !== 'aiw-source-governance-a0/1' || a0.state !== 'pending_witness') fail('A0 is not pending_witness');
  if (a0.governance.governance_mode !== 'solo-owner-autonomous' || a0.governance.independent_human_review !== false) fail('A0 governance mode mismatch');
  if (a0.repository.full_name !== FULL_REPO || a0.repository.default_branch !== 'main') fail('A0 repository mismatch');
  const a0Expiry = Date.parse(a0.expires_at);
  if (!Number.isFinite(a0Expiry) || a0Expiry <= Date.now()) fail('A0 authority expired/invalid');
  return { payload: a0, digest };
}

function parseW0Authorization(comment, issueNumber) {
  const start = comment.indexOf(AUTH_START);
  const end = comment.indexOf(AUTH_END);
  if (start < 0 || end <= start) fail('W0 authorization comment delimiters missing');
  let auth;
  try { auth = JSON.parse(comment.slice(start + AUTH_START.length, end).trim()); } catch { fail('W0 authorization JSON invalid'); }
  if (auth.schema !== 'aiw-w0-authorization/1' || auth.issue_number !== issueNumber || auth.state !== 'active' || auth.consumed !== false) fail('W0 authorization is not active/unconsumed');
  const authDigest = auth.canonical_payload_sha256;
  const authPayload = { ...auth };
  delete authPayload.canonical_payload_sha256;
  if (!/^[a-f0-9]{64}$/.test(authDigest || '') || sha(canonicalize(authPayload)) !== authDigest) fail('W0 authorization canonical digest mismatch');
  if (!/^[a-f0-9]{64}$/.test(auth.nonce || '') || !/^[a-f0-9]{64}$/.test(auth.diff_sha256 || '')) fail('W0 authorization digest/nonce invalid');
  if (auth.nonce === auth.parent_a0_nonce) fail('W0 nonce must differ from parent A0 nonce');
  if (!Array.isArray(auth.allowed_paths) || auth.allowed_paths.join('\n') !== [...auth.allowed_paths].sort().join('\n')) fail('W0 path allowlist not canonical');
  if (auth.repository !== FULL_REPO || !Number.isInteger(auth.pr_number) || !Number.isInteger(auth.issue_number)) fail('W0 repository/PR/Issue identity invalid');
  if (auth.verifier.id !== 'AIW-SOLO-W0-BOOTSTRAP-VERIFIER' || auth.verifier.version !== '1.0.1' || auth.acquirer.id !== 'AIW-SOLO-W0-EVIDENCE-ACQUIRER' || auth.acquirer.version !== '1.0.0') fail('W0 verifier/acquirer identity mismatch');
  const expiry = Date.parse(auth.expires_at);
  if (!Number.isFinite(expiry) || expiry <= Date.now()) fail('W0 authorization expired/invalid');
  for (const key of ['canonical_payload_sha256', 'parent_a0_id', 'parent_a0_sha256', 'pr_number', 'base_sha', 'head_sha', 'diff_sha256', 'b0_before_sha256', 'b0_after_sha256', 'witness_profile_sha256', 'verifier', 'acquirer', 'required_checks']) {
    if (auth[key] === undefined || auth[key] === null) fail(`W0 authorization missing ${key}`);
  }
  return auth;
}

function parseVerifierPass(comment, authorization) {
  const start = comment.indexOf(PASS_START);
  const end = comment.indexOf(PASS_END);
  if (start < 0 || end <= start) fail('W0 verifier PASS receipt missing');
  let receipt;
  try { receipt = JSON.parse(comment.slice(start + PASS_START.length, end).trim()); } catch { fail('W0 verifier PASS receipt malformed'); }
  const receiptDigest = receipt.canonical_payload_sha256;
  const receiptPayload = { ...receipt };
  delete receiptPayload.canonical_payload_sha256;
  if (!/^[a-f0-9]{64}$/.test(receiptDigest || '') || sha(canonicalize(receiptPayload)) !== receiptDigest) fail('W0 verifier receipt canonical digest mismatch');
  const expected = {
    verdict: 'PASS', repository: FULL_REPO, pr_number: authorization.pr_number,
    base_sha: authorization.base_sha, head_sha: authorization.head_sha,
    diff_sha256: authorization.diff_sha256,
    w0_authorization_id: authorization.authorization_id,
    b0_before_sha256: authorization.b0_before_sha256,
    b0_after_sha256: authorization.b0_after_sha256,
    witness_profile_sha256: authorization.witness_profile_sha256,
    verifier: authorization.verifier, acquirer: authorization.acquirer,
    allowed_paths: authorization.allowed_paths,
  };
  for (const [key, value] of Object.entries(expected)) {
    if (JSON.stringify(receipt[key]) !== JSON.stringify(value)) fail(`W0 verifier PASS receipt binding mismatch: ${key}`);
  }
  if (!/^[a-f0-9]{64}$/.test(receipt.evidence_manifest_sha256 || '')) fail('W0 verifier evidence manifest digest missing');
  if (!Array.isArray(receipt.required_checks) || JSON.stringify(receipt.required_checks) !== JSON.stringify(authorization.required_checks)) fail('W0 verifier check receipt incomplete or mismatched');
  return receipt;
}

function parseLifecycleComments(comments) {
  return comments.filter((comment) => comment.user && ['github-actions[bot]', OWNER].includes(comment.user.login) && comment.body && comment.body.includes('<!-- AIW-A0-W0-LIFECYCLE/1 -->')).map((comment) => {
    const match = comment.body.match(/<!-- AIW-A0-W0-LIFECYCLE\/1 -->\s*([\s\S]*?)\s*<!-- \/AIW-A0-W0-LIFECYCLE\/1 -->/);
    if (!match) fail('malformed A0/W0 lifecycle entry');
    try { return JSON.parse(match[1]); } catch { fail('malformed A0/W0 lifecycle JSON'); }
  });
}

function assertW0NotAttempted(events, authorizationId) {
  if (events.some((event) => event.w0_authorization_id === authorizationId && ['witnessing', 'consumed'].includes(event.w0_state))) {
    fail('W0 authorization already attempted/consumed; replay is blocked');
  }
}

function parseIssueReference(body) {
  const issue = body.match(/(?:^|\n)A0 Issue: #([1-9][0-9]*)(?:\n|$)/);
  const authorization = body.match(/(?:^|\n)W0 Authorization ID: ([A-Za-z0-9._-]+)(?:\n|$)/);
  if (!issue || !authorization) fail('merged W0 PR lacks A0/W0 authorization references');
  return { issueNumber: Number(issue[1]), authorizationId: authorization[1] };
}

function checkApiPath(path, method = 'GET') {
  if (method === 'POST') {
    if (/^\/repos\/Albadry-Esmat\/AI-Workflow\/issues\/[1-9][0-9]*\/comments$/.test(path)) return;
    fail('witness write endpoint outside append-only Issue comment allowlist');
  }
  if (method !== 'GET') fail('witness HTTP method outside allowlist');
  const permitted = [
    /^\/repos\/Albadry-Esmat\/AI-Workflow\/commits\/[a-f0-9]{40}\/pulls$/,
    /^\/repos\/Albadry-Esmat\/AI-Workflow\/issues\/[1-9][0-9]*$/,
    /^\/repos\/Albadry-Esmat\/AI-Workflow\/issues\/[1-9][0-9]*\/comments$/,
    /^\/repos\/Albadry-Esmat\/AI-Workflow\/pulls\/[1-9][0-9]*$/,
    /^\/repos\/Albadry-Esmat\/AI-Workflow\/commits\/[a-f0-9]{40}\/check-runs$/,
    /^\/repos\/Albadry-Esmat\/AI-Workflow\/commits\/[a-f0-9]{40}$/,
    /^\/repos\/Albadry-Esmat\/AI-Workflow\/pulls\/[1-9][0-9]*\/files$/,
  ];
  if (!permitted.some((pattern) => pattern.test(path))) fail('witness API path outside allowlist');
}

async function api(path, token, query = {}) {
  checkApiPath(path, 'GET');
  const url = new URL(API + path);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, String(value));
  const response = await fetch(url, { headers: {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
  } });
  if (!response.ok) fail(`GitHub read failed (${response.status}) for ${path}`);
  return response.json();
}

async function appendLifecycleComment(issueNumber, token, payload) {
  const path = `/repos/${FULL_REPO}/issues/${issueNumber}/comments`;
  checkApiPath(path, 'POST');
  const response = await fetch(API + path, {
    method: 'POST',
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' },
    body: JSON.stringify({ body: `<!-- AIW-A0-W0-LIFECYCLE/1 -->\n${canonicalize(payload)}\n<!-- /AIW-A0-W0-LIFECYCLE/1 -->` }),
  });
  if (!response.ok) fail(`append-only lifecycle comment failed (${response.status})`);
  return response.json();
}

function tufEvidenceChunkRecords(bytes, authorizationId, chunkSize = 32000, materialKind = 'tuf-evidence') {
  if (!Buffer.isBuffer(bytes) || bytes.length === 0 || bytes.length > 1000000) fail('TUF evidence size is invalid');
  const digest = sha(bytes);
  const encoded = bytes.toString('base64');
  const total = Math.ceil(encoded.length / chunkSize);
  return Array.from({ length: total }, (_, index) => ({
    schema: 'aiw-source-governance-lifecycle/1',
    event_id: `w0-${materialKind}-${authorizationId}-${index + 1}`,
    w0_authorization_id: authorizationId,
    w0_state: materialKind,
    tuf_evidence_sha256: digest,
    chunk_index: index + 1,
    chunk_count: total,
    content_base64: encoded.slice(index * chunkSize, (index + 1) * chunkSize),
  }));
}

function captureTufEvidence({ home = os.homedir(), xdgCache = process.env.XDG_CACHE_HOME, xdgData = process.env.XDG_DATA_HOME, witnessPath, outputPath }) {
  const tufUrl = 'https://tuf-repo-cdn.sigstore.dev';
  const encodedUrl = encodeURIComponent(tufUrl);
  const cacheRoot = xdgCache || path.join(home, '.cache');
  const dataRoot = xdgData || path.join(home, '.local', 'share');
  const cacheDir = path.join(cacheRoot, 'sigstore-python', 'tuf', encodedUrl);
  const metadataDir = path.join(dataRoot, 'sigstore-python', 'tuf', encodedUrl, 'metadata');
  function readRegular(file) {
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink()) fail(`unsafe TUF material: ${path.basename(file)}`);
    const bytes = fs.readFileSync(file);
    return { name: path.basename(file), size_bytes: bytes.length, sha256: sha(bytes), content_base64: bytes.toString('base64') };
  }
  const target = readRegular(path.join(cacheDir, 'trusted_root.json'));
  const metadataNames = ['root.json', 'timestamp.json', 'snapshot.json', 'targets.json'];
  const metadata = metadataNames.map((name) => {
    const entry = readRegular(path.join(metadataDir, name));
    const parsed = JSON.parse(Buffer.from(entry.content_base64, 'base64').toString('utf8'));
    entry.version = parsed.signed && parsed.signed.version;
    if (!Number.isInteger(entry.version)) fail(`TUF metadata version missing: ${name}`);
    return entry;
  });
  const targetMetadata = JSON.parse(Buffer.from(metadata.find((entry) => entry.name === 'targets.json').content_base64, 'base64').toString('utf8'));
  const trustedRootTarget = targetMetadata.signed && targetMetadata.signed.targets && targetMetadata.signed.targets['trusted_root.json'];
  if (!trustedRootTarget || trustedRootTarget.hashes.sha256 !== target.sha256 || trustedRootTarget.length !== target.size_bytes) fail('TUF targets metadata does not bind exact trusted_root.json bytes');
  const witnessBundle = readRegular(witnessPath + '.sigstore.json');
  const witnessBytes = readRegular(witnessPath);
  const evidence = {
    schema: 'aiw-sigstore-tuf-evidence/1',
    action: { repository: 'sigstore/gh-action-sigstore-python', commit: '790bc6befb9d733738f18d8f895854b453640ec9', sigstore_python: '4.5.0', rekor_protocol: 'v1', staging: false },
    tuf_url: tufUrl,
    trusted_root: target,
    metadata,
    signed_witness_payload: witnessBytes,
    signed_witness_bundle: witnessBundle,
    captured_at: new Date().toISOString(),
  };
  fs.writeFileSync(outputPath, canonicalize(evidence) + '\n', { mode: 0o600, flag: 'wx' });
  return { trusted_root_sha256: target.sha256, tuf_metadata: metadata.map(({ name, version, sha256 }) => ({ name, version, sha256 })), evidence_sha256: sha(fs.readFileSync(outputPath)) };
}

async function pages(path, token, itemKey = null, baseQuery = {}) {
  const all = [];
  let page = 1;
  while (page <= 10000) {
    const body = await api(path, token, { ...baseQuery, per_page: 100, page });
    const batch = itemKey ? body[itemKey] : body;
    if (!Array.isArray(batch)) fail(`GitHub list shape invalid for ${path}`);
    all.push(...batch);
    if (batch.length < 100) {
      if (itemKey && Number.isInteger(body.total_count) && all.length !== body.total_count) fail(`GitHub list truncated for ${path}`);
      return all;
    }
    page += 1;
  }
  fail(`GitHub pagination limit exceeded for ${path}`);
}

function sortedUnique(values) {
  const sorted = [...values].sort();
  if (new Set(sorted).size !== sorted.length) fail('duplicate source paths');
  return sorted;
}

function createWitnessEnvelope({ a0, a0Digest, authorization, pr, files, checks, diffDigest, workflowSha, currentSha, mergeCommit, verifierReceipt }) {
  if (pr.merged !== true || pr.base.ref !== 'main' || pr.base.repo.full_name !== FULL_REPO || pr.head.repo.full_name !== FULL_REPO) fail('W0 PR merge/repository binding failed');
  if (pr.head.sha !== authorization.head_sha || pr.number !== authorization.pr_number) fail('W0 PR commit binding failed');
  if (pr.merge_commit_sha !== currentSha || !mergeCommit || mergeCommit.sha !== currentSha || !Array.isArray(mergeCommit.parents) || mergeCommit.parents.length !== 1 || mergeCommit.parents[0].sha !== authorization.base_sha) fail('W0 squash merge/base binding failed');
  const paths = sortedUnique(files.map((entry) => entry.filename));
  if (JSON.stringify(paths) !== JSON.stringify(authorization.allowed_paths)) fail('W0 PR paths do not match authorization');
  if (diffDigest !== authorization.diff_sha256) fail('W0 binary diff digest mismatch');
  if (currentSha !== pr.merge_commit_sha) fail('workflow push is not the expected W0 merge commit');
  if (verifierReceipt.verdict !== 'PASS') fail('external deterministic W0 verifier did not pass');
  const required = authorization.required_checks;
  for (const item of required) {
    const matching = checks.filter((check) => check.name === item.context && (check.app || {}).id === item.app_id && check.head_sha === authorization.head_sha && check.status === 'completed' && check.conclusion === 'success');
    if (matching.length !== 1) fail(`required check missing/ambiguous on W0 head: ${item.context}`);
  }
  if (a0.authorization_id !== authorization.parent_a0_id || a0.repository.base_sha !== authorization.base_sha || a0Digest !== authorization.parent_a0_sha256) fail('A0/W0 parent binding failed');
  if (authorization.witness_profile_sha256 !== a0.witness_profile_sha256) fail('witness-profile digest mismatch');
  if (authorization.verifier.id !== a0.package.verifier.id || authorization.verifier.version !== a0.package.verifier.version || authorization.verifier.sha256 !== a0.package.verifier.sha256) fail('A0 verifier identity mismatch');
  if (authorization.acquirer.id !== a0.package.acquirer.id || authorization.acquirer.version !== a0.package.acquirer.version || authorization.acquirer.sha256 !== a0.package.acquirer.sha256) fail('A0 acquirer identity mismatch');
  return {
    schema: 'aiw-source-governance-witness/1',
    event: 'A0_W0_BOOTSTRAP_WITNESSED',
    repository: { id: 1271718831, full_name: FULL_REPO, ref: 'refs/heads/main' },
    a0: { issue_number: authorization.issue_number, authorization_id: a0.authorization_id, state_before_witness: 'pending_witness', canonical_payload_sha256: a0Digest },
    w0: { authorization_id: authorization.authorization_id, nonce: authorization.nonce, pr_number: pr.number, base_sha: pr.base.sha, head_sha: pr.head.sha, merge_commit_sha: pr.merge_commit_sha, changed_paths: paths, diff_sha256: diffDigest, state_after_witness: 'consumed' },
    required_checks: required.map((item) => ({ context: item.context, app_id: item.app_id, head_sha: authorization.head_sha, conclusion: 'success' })),
    verifier: authorization.verifier,
    acquirer: authorization.acquirer,
    external_verifier_receipt: verifierReceipt,
    b0_before_sha256: authorization.b0_before_sha256,
    b0_after_sha256: authorization.b0_after_sha256,
    witness_profile_sha256: authorization.witness_profile_sha256,
    witness_workflow_source_sha256: workflowSha,
    witnessed_at: new Date().toISOString(),
  };
}

async function main() {
  const repo = process.env.GITHUB_REPOSITORY;
  const token = process.env.GITHUB_TOKEN;
  const currentSha = process.env.GITHUB_SHA;
  const workflowSha = process.env.GITHUB_WORKFLOW_SHA;
  if (repo !== FULL_REPO || !token || !/^[a-f0-9]{40}$/.test(currentSha || '') || !/^[a-f0-9]{40}$/.test(workflowSha || '')) fail('trusted GitHub workflow context incomplete');
  const merged = await api(`/repos/${FULL_REPO}/commits/${currentSha}/pulls`, token);
  if (!Array.isArray(merged) || merged.length !== 1) fail('expected exactly one PR associated with W0 merge commit');
  const pr = merged[0];
  if (!pr.user || pr.user.login !== OWNER) fail('W0 PR author is not the repository owner');
  const ref = parseIssueReference(pr.body || '');
  const issue = await api(`/repos/${FULL_REPO}/issues/${ref.issueNumber}`, token);
  if (issue.user.login !== OWNER || issue.state !== 'open') fail('A0 Issue author/state invalid');
  const a0 = parseA0Body(issue.body || '');
  const comments = await pages(`/repos/${FULL_REPO}/issues/${ref.issueNumber}/comments`, token);
  const matches = comments.filter((comment) => comment.user && comment.user.login === OWNER && comment.body && comment.body.includes(AUTH_START) && comment.body.includes(AUTH_END))
    .map((comment) => parseW0Authorization(comment.body, ref.issueNumber))
    .filter((auth) => auth.authorization_id === ref.authorizationId);
  if (matches.length !== 1) fail('W0 authorization comment missing or duplicated');
  const authorization = matches[0];
  if (authorization.issue_number !== ref.issueNumber || authorization.pr_number !== pr.number || authorization.authorization_id !== ref.authorizationId) fail('W0 authorization PR/Issue binding failed');
  const passReceipts = comments.filter((comment) => comment.user && comment.user.login === OWNER && comment.body && comment.body.includes(PASS_START) && comment.body.includes(PASS_END));
  const receiptMatches = passReceipts.map((comment) => parseVerifierPass(comment.body, authorization)).filter((receipt) => receipt.w0_authorization_id === authorization.authorization_id);
  if (receiptMatches.length !== 1) fail('expected exactly one owner-recorded W0 verifier PASS receipt');
  const verifierReceipt = receiptMatches[0];
  assertW0NotAttempted(parseLifecycleComments(comments), authorization.authorization_id);
  const files = await pages(`/repos/${FULL_REPO}/pulls/${pr.number}/files`, token);
  const checkRuns = await pages(`/repos/${FULL_REPO}/commits/${authorization.head_sha}/check-runs`, token, 'check_runs', { filter: 'all' });
  const mergeCommit = await api(`/repos/${FULL_REPO}/commits/${currentSha}`, token);
  execFileSync('git', ['fetch', '--no-tags', 'origin', `refs/pull/${pr.number}/head:refs/aiw-w0/head-${pr.number}`], { stdio: 'ignore' });
  const fetchedHead = execFileSync('git', ['rev-parse', `refs/aiw-w0/head-${pr.number}`], { encoding: 'utf8' }).trim();
  if (fetchedHead !== authorization.head_sha) fail('fetched PR head differs from authorized head');
  const actualPaths = execFileSync('git', ['diff', '--name-only', `${authorization.base_sha}...${authorization.head_sha}`], { encoding: 'utf8' }).trim().split('\n').filter(Boolean).sort();
  if (JSON.stringify(actualPaths) !== JSON.stringify(sortedUnique(files.map((item) => item.filename)))) fail('GitHub API/Git path mismatch');
  const diff = execFileSync('git', ['diff', '--binary', '--full-index', '--no-ext-diff', `${authorization.base_sha}...${authorization.head_sha}`]);
  const diffDigest = sha(diff);
  const witnessSource = fs.readFileSync(__filename, 'utf8');
  const websiteSource = fs.readFileSync('.github/workflows/sync-website.yml', 'utf8');
  const websiteSecretName = ['WEBSITE', 'DEPLOY', 'TOKEN'].join('_');
  const websiteRepository = ['Albadry-Esmat', 'ASE-OS-Website'].join('/');
  if (witnessSource.includes(websiteSecretName) || witnessSource.includes(websiteRepository) || websiteSource.includes(websiteSecretName) || websiteSource.includes(websiteRepository) || /\bgit\s+push\b/.test(websiteSource)) fail('website mutation isolation failed');
  const envelope = createWitnessEnvelope({ a0: a0.payload, a0Digest: a0.digest, authorization, pr, files, checks: checkRuns, diffDigest, workflowSha, currentSha, mergeCommit, verifierReceipt });
  fs.writeFileSync(process.env.RUNNER_TEMP + '/aiw-source-governance-witness.json', canonicalize(envelope) + '\n', { mode: 0o600, flag: 'wx' });
}

module.exports = { parseCanonicalEnvelope, parseA0Body, parseW0Authorization, parseVerifierPass, parseLifecycleComments, assertW0NotAttempted, parseIssueReference, checkApiPath, createWitnessEnvelope, appendLifecycleComment, captureTufEvidence, tufEvidenceChunkRecords };

if (require.main === module) {
  const args = process.argv.slice(2);
  const token = process.env.GITHUB_TOKEN;
  if (args.length === 1 && args[0] === '--capture-trust-root') {
    try {
      const result = captureTufEvidence({
        witnessPath: `${process.env.RUNNER_TEMP}/aiw-source-governance-witness.json`,
        outputPath: `${process.env.RUNNER_TEMP}/aiw-sigstore-tuf-evidence.json`,
      });
      process.stdout.write(JSON.stringify(result) + '\n');
    } catch (error) {
      process.stderr.write(`source-governance-witness: ${error.message}\n`);
      process.exitCode = 2;
    }
  } else if (args.length === 1 && ['--mark-witnessing', '--record-consumed'].includes(args[0])) {
    (async () => {
      if (!token) fail('GitHub token missing');
      const mode = args[0];
      const path = `${process.env.RUNNER_TEMP}/aiw-source-governance-witness.json`;
      const envelope = parseCanonicalEnvelope(fs.readFileSync(path));
      if (envelope.event !== 'A0_W0_BOOTSTRAP_WITNESSED' || envelope.w0.state_after_witness !== 'consumed') fail('witness envelope not verified');
      const signedPayloadSha256 = sha(canonicalize(envelope) + '\n');
      const comments = await pages(`/repos/${FULL_REPO}/issues/${envelope.a0.issue_number}/comments`, token);
      const parsed = parseLifecycleComments(comments).filter((event) => event.w0_authorization_id === envelope.w0.authorization_id);
      if (mode === '--mark-witnessing') {
        assertW0NotAttempted(parsed, envelope.w0.authorization_id);
        const start = {
          schema: 'aiw-source-governance-lifecycle/1', event_id: `w0-witnessing-${envelope.w0.authorization_id}`,
          parent_a0_id: envelope.a0.authorization_id, parent_a0_sha256: envelope.a0.canonical_payload_sha256,
          w0_authorization_id: envelope.w0.authorization_id, w0_state: 'witnessing', a0_derived_state: 'pending_witness',
          repository: envelope.repository, pr_number: envelope.w0.pr_number, base_sha: envelope.w0.base_sha,
          head_sha: envelope.w0.head_sha, diff_sha256: envelope.w0.diff_sha256,
          witness_payload_sha256: signedPayloadSha256, witness_workflow_run_id: process.env.GITHUB_RUN_ID,
          witness_workflow_run_attempt: process.env.GITHUB_RUN_ATTEMPT, started_at: new Date().toISOString(),
        };
        await appendLifecycleComment(envelope.a0.issue_number, token, start);
        process.stdout.write(JSON.stringify({ event_id: start.event_id, w0_state: start.w0_state }) + '\n');
        return;
      }
      const tufPath = `${process.env.RUNNER_TEMP}/aiw-sigstore-tuf-evidence.json`;
      const tufBytes = fs.readFileSync(tufPath);
      const tufBundleBytes = fs.readFileSync(tufPath + '.sigstore.json');
      const tufEvidence = JSON.parse(tufBytes.toString('utf8'));
      if (tufEvidence.schema !== 'aiw-sigstore-tuf-evidence/1' || tufEvidence.action.rekor_protocol !== 'v1' || tufEvidence.action.staging !== false || tufEvidence.signed_witness_bundle.sha256 !== sha(fs.readFileSync(path + '.sigstore.json'))) fail('Sigstore TUF evidence/profile/bundle binding invalid');
      const tufAfterPath = `${process.env.RUNNER_TEMP}/aiw-sigstore-tuf-after.json`;
      captureTufEvidence({ witnessPath: path, outputPath: tufAfterPath });
      const tufAfter = JSON.parse(fs.readFileSync(tufAfterPath, 'utf8'));
      const beforeRootMetadata = tufEvidence.metadata.filter((entry) => ['root.json', 'targets.json'].includes(entry.name)).map(({ name, version, sha256 }) => ({ name, version, sha256 }));
      const afterRootMetadata = tufAfter.metadata.filter((entry) => ['root.json', 'targets.json'].includes(entry.name)).map(({ name, version, sha256 }) => ({ name, version, sha256 }));
      if (tufAfter.trusted_root.sha256 !== tufEvidence.trusted_root.sha256 || JSON.stringify(afterRootMetadata) !== JSON.stringify(beforeRootMetadata)) fail('Sigstore TUF trust root changed during witness run');
      const primaryBundleSha256 = sha(fs.readFileSync(path + '.sigstore.json'));
      const receipt = {
        schema: 'aiw-source-governance-lifecycle/1', event_id: `w0-consumed-${envelope.w0.authorization_id}`,
        parent_a0_id: envelope.a0.authorization_id, parent_a0_sha256: envelope.a0.canonical_payload_sha256,
        w0_authorization_id: envelope.w0.authorization_id, w0_state: 'consumed', a0_derived_state: 'active',
        repository: envelope.repository, pr_number: envelope.w0.pr_number, base_sha: envelope.w0.base_sha,
        head_sha: envelope.w0.head_sha, diff_sha256: envelope.w0.diff_sha256,
        witness_payload_sha256: signedPayloadSha256, primary_bundle_sha256: primaryBundleSha256,
        primary_bundle_artifact_name: 'a0-w0-primary-witness',
        trust_root_manifest_artifact_name: 'signing-artifacts-witness-a0-w0', tuf_evidence_sha256: sha(tufBytes),
        tuf_manifest_bundle_sha256: sha(tufBundleBytes),
        tuf_trusted_root_sha256: tufEvidence.trusted_root.sha256,
        tuf_metadata: tufEvidence.metadata.map(({ name, version, sha256 }) => ({ name, version, sha256 })),
        tuf_evidence_chunk_count: tufEvidenceChunkRecords(tufBytes, envelope.w0.authorization_id, 32000, 'tuf-evidence').length,
        tuf_bundle_chunk_count: tufEvidenceChunkRecords(tufBundleBytes, envelope.w0.authorization_id, 32000, 'tuf-bundle').length,
        witness_workflow_run_id: process.env.GITHUB_RUN_ID, witness_workflow_run_attempt: process.env.GITHUB_RUN_ATTEMPT,
        witnessed_at: envelope.witnessed_at,
      };
      if (parsed.length !== 1 || parsed[0].w0_state !== 'witnessing' || parsed[0].witness_workflow_run_id !== process.env.GITHUB_RUN_ID || parsed[0].witness_payload_sha256 !== signedPayloadSha256) fail('no matching one-shot witness-start record');
      for (const chunk of [...tufEvidenceChunkRecords(tufBytes, envelope.w0.authorization_id, 32000, 'tuf-evidence'), ...tufEvidenceChunkRecords(tufBundleBytes, envelope.w0.authorization_id, 32000, 'tuf-bundle')]) {
        await appendLifecycleComment(envelope.a0.issue_number, token, chunk);
      }
      await appendLifecycleComment(envelope.a0.issue_number, token, receipt);
      process.stdout.write(JSON.stringify({ event_id: receipt.event_id, w0_state: receipt.w0_state, a0_derived_state: receipt.a0_derived_state }) + '\n');
    })().catch((error) => {
      process.stderr.write(`source-governance-witness: ${error.message}\n`);
      process.exitCode = 2;
    });
  } else if (args.length === 0) {
    main().catch((error) => {
      process.stderr.write(`source-governance-witness: ${error.message}\n`);
      process.exitCode = 2;
    });
  } else {
    process.stderr.write('Usage: verify-source-governance-witness.js [--capture-trust-root|--mark-witnessing|--record-consumed]\n');
    process.exitCode = 2;
  }
}

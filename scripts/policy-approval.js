#!/usr/bin/env node
'use strict';
// Phase 2: scoped single-use approval workflow for privileged tools.
// approve --tool <t> --path <p> --thread <id> --ttl 600 -> token (stored under state, single-use, expiring).
// Gateway check() accepts { approval: token } and validates scope + expiry + single-use.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { withLock } = require('./file-lock');
const { sanitizeId } = require('./sanitize-id');

const ROOT = path.resolve(__dirname, '..');
function approvalPath(threadId) {
  return path.join(ROOT, '.opencode', 'state', sanitizeId(threadId), 'approvals.jsonl');
}
// Phase A: approvals cannot be minted anonymously. Every approval records the
// minting principal in canonical form {type, id, authenticated, source}.
// Human principals are recorded exactly as claimed with authenticated:false —
// this module performs NO authentication and never upgrades a claim. Only the
// gate-decisions registry may record authenticated humans (later phase).
// `executionId` binds the mint to its execution context (defaults to thread).
function approve({ thread, tool, targetPath, ttlSeconds = 600, principal, executionId = null }) {
  if (principal === undefined || principal === null) {
    throw new Error('policy-approval: approve() requires a principal (anonymous minting refused; pass {type, id, source})');
  }
  const identity = require('./execution-identity');
  const mintedBy = identity.validatePrincipal(principal, 'approval.principal');
  const token = 'appr-' + crypto.randomBytes(8).toString('hex');
  const rec = { token, tool, path: targetPath || '', expires_at: new Date(Date.now() + ttlSeconds * 1000).toISOString(), used: false, created_at: new Date().toISOString(), minted_by: mintedBy, execution_id: executionId || thread };
  fs.mkdirSync(path.dirname(approvalPath(thread)), { recursive: true });
  fs.appendFileSync(approvalPath(thread), JSON.stringify(rec) + '\n', 'utf8');
  return rec;
}
function readRecords(p) {
  if (!fs.existsSync(p)) return null;
  return fs.readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
}
function writeRecordsAtomic(p, recs) {
  const tmp = `${p}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, recs.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf8');
  fs.renameSync(tmp, p);
}
function validate(threadId, token, { tool, targetPath }) {
  const p = approvalPath(threadId);
  const recs = readRecords(p);
  if (!recs) return { valid: false, reason: 'no approvals for thread' };
  const rec = recs.find((r) => r.token === token);
  if (!rec) return { valid: false, reason: 'unknown approval token' };
  if (rec.used) return { valid: false, reason: 'approval already used (single-use)' };
  if (new Date(rec.expires_at).getTime() < Date.now()) return { valid: false, reason: 'approval expired' };
  if (rec.tool !== tool) return { valid: false, reason: `tool scope mismatch (${rec.tool} != ${tool})` };
  if (rec.path && rec.path !== targetPath) return { valid: false, reason: `path scope mismatch (${rec.path} != ${targetPath})` };
  return { valid: true, rec };
}
// consume(): atomic compare-and-swap under a file lock. Returns true only to
// the single caller that flips used:false→true; concurrent contenders get
// false (their gateway check must deny). Never throws on contention outcome.
function consume(threadId, token) {
  const p = approvalPath(threadId);
  return withLock(p, () => {
    const recs = readRecords(p);
    if (!recs) return false;
    const rec = recs.find((r) => r.token === token);
    if (!rec || rec.used) return false;
    if (new Date(rec.expires_at).getTime() < Date.now()) return false;
    const updated = recs.map((r) => (r.token === token ? { ...r, used: true } : r));
    writeRecordsAtomic(p, updated);
    return true;
  });
}
module.exports = { approve, validate, consume };
if (require.main === module) {
  const argv = process.argv.slice(2);
  const get = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
  if (argv[0] === 'approve') {
    // Claimed (NOT authenticated) minter identity — recorded honestly as such.
    const principal = { type: get('--principal-type') || 'human', id: get('--principal-id'), source: get('--source') || 'cli-claim' };
    try {
      const rec = approve({ thread: get('--thread') || 'default', tool: get('--tool'), targetPath: get('--path') || '', ttlSeconds: parseInt(get('--ttl') || '600', 10), principal });
      console.log(JSON.stringify(rec, null, 2));
    } catch (err) {
      console.error(`approval refused: ${err.message}`);
      process.exit(1);
    }
  } else { console.error('Usage: policy-approval.js approve --thread <id> --tool <t> --path <p> [--ttl 600] --principal-id <id> [--principal-type human|agent|system] [--source <origin>]'); process.exit(2); }
}

#!/usr/bin/env node
'use strict';
// Phase 2: scoped single-use approval workflow for privileged tools.
// approve --tool <t> --path <p> --thread <id> --ttl 600 -> token (stored under state, single-use, expiring).
// Gateway check() accepts { approval: token } and validates scope + expiry + single-use.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
function approvalPath(threadId) {
  return path.join(ROOT, '.opencode', 'state', threadId, 'approvals.jsonl');
}
function approve({ thread, tool, targetPath, ttlSeconds = 600 }) {
  const token = 'appr-' + crypto.randomBytes(8).toString('hex');
  const rec = { token, tool, path: targetPath || '', expires_at: new Date(Date.now() + ttlSeconds * 1000).toISOString(), used: false, created_at: new Date().toISOString() };
  fs.mkdirSync(path.dirname(approvalPath(thread)), { recursive: true });
  fs.appendFileSync(approvalPath(thread), JSON.stringify(rec) + '\n', 'utf8');
  return rec;
}
function validate(threadId, token, { tool, targetPath }) {
  const p = approvalPath(threadId);
  if (!fs.existsSync(p)) return { valid: false, reason: 'no approvals for thread' };
  const recs = fs.readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const rec = recs.find((r) => r.token === token);
  if (!rec) return { valid: false, reason: 'unknown approval token' };
  if (rec.used) return { valid: false, reason: 'approval already used (single-use)' };
  if (new Date(rec.expires_at).getTime() < Date.now()) return { valid: false, reason: 'approval expired' };
  if (rec.tool !== tool) return { valid: false, reason: `tool scope mismatch (${rec.tool} != ${tool})` };
  if (rec.path && rec.path !== targetPath) return { valid: false, reason: `path scope mismatch (${rec.path} != ${targetPath})` };
  return { valid: true, rec };
}
function consume(threadId, token) {
  const p = approvalPath(threadId);
  const recs = fs.readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const updated = recs.map((r) => (r.token === token ? { ...r, used: true } : r));
  fs.writeFileSync(p, updated.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf8');
}
module.exports = { approve, validate, consume };
if (require.main === module) {
  const argv = process.argv.slice(2);
  const get = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
  if (argv[0] === 'approve') {
    const rec = approve({ thread: get('--thread') || 'default', tool: get('--tool'), targetPath: get('--path') || '', ttlSeconds: parseInt(get('--ttl') || '600', 10) });
    console.log(JSON.stringify(rec, null, 2));
  } else { console.error('Usage: policy-approval.js approve --thread <id> --tool <t> --path <p> [--ttl 600]'); process.exit(2); }
}

#!/usr/bin/env node
'use strict';
// M3: Policy gateway — deny by default, fail closed (P2 full rules).
// Every adapter call must pass check() before execution.
// Privileged tools require scoped single-use approval with expiry via policy-approval.js.
// check({ tool, path, threadId, approval }) validates scope + expiry + single-use and consumes on allow.
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const ROOT = path.resolve(__dirname, '..');
const POLICY_PATH = path.join(ROOT, 'config', 'policy-gateway.yaml');

function loadPolicy() {
  try {
    return yaml.load(fs.readFileSync(POLICY_PATH, 'utf8'));
  } catch (err) {
    // Fail closed on parse error.
    return { __parseError: String(err && err.message || err) };
  }
}
// input: { tool, path, threadId, approval }
// output: { decision: 'allow'|'deny', reason }
function check(input) {
  const policy = loadPolicy();
  if (policy.__parseError) return { decision: 'deny', reason: 'policy parse error (fail-closed): ' + policy.__parseError };
  const tool = String(input.tool || '');
  const p = String(input.path || '');
  if (!tool) return { decision: 'deny', reason: 'empty tool (fail-closed)' };
  if (policy.denied_paths && policy.denied_paths.some((d) => p === d || p.startsWith(d))) {
    return { decision: 'deny', reason: `path denied: ${p}` };
  }
  if ((policy.privileged_tools_requiring_approval || []).includes(tool)) {
    if (!input.approval) return { decision: 'deny', reason: `privileged tool requires scoped approval: ${tool} (no approval presented)` };
    try {
      const approvals = require('./policy-approval');
      const v = approvals.validate(input.threadId || 'default', input.approval, { tool, targetPath: p });
      if (!v.valid) return { decision: 'deny', reason: `approval invalid: ${v.reason}` };
      approvals.consume(input.threadId || 'default', input.approval);
      return { decision: 'allow', reason: `scoped approval consumed: ${tool} ${p}` };
    } catch (e) {
      return { decision: 'deny', reason: 'approval store error (fail-closed): ' + e.message };
    }
  }
  if ((policy.allowed_tools || []).includes(tool)) {
    const okPath = (policy.allowed_paths || []).some((a) => p.startsWith(a) || p === '' || p === '.');
    if (!okPath && p) return { decision: 'deny', reason: `path outside allowlist: ${p}` };
    return { decision: 'allow', reason: 'baseline allowlist match' };
  }
  return { decision: 'deny', reason: `tool not allowlisted (default deny): ${tool}` };
}
module.exports = { check, loadPolicy, POLICY_PATH };

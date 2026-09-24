#!/usr/bin/env node
'use strict';
// Policy discovery (B) — loads config/*.yml policies + versions without hard-coded paths.
// New repos may use .ai/ layout; discovery checks config/ first, then .ai/.
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const ROOT = path.resolve(__dirname, '..');
const POLICY_FILES = [
  'validation-profile.yml', 'development-policy.yml', 'review-policy.yml',
  'risk-policy.yml', 'budget-policy.yml', 'merge-policy.yml',
  'rollback-policy.yml', 'backlog-policy.yml', 'control-plane.yml',
  'policy-versions.yml',
];
function discover(dir) {
  const found = {};
  for (const f of POLICY_FILES) {
    const p = path.join(ROOT, dir, f);
    if (!fs.existsSync(p)) continue;
    const parsed = yaml.load(fs.readFileSync(p, 'utf8'));
    const base = f.replace('.yml', '');
    found[base] = parsed; // original name (e.g. control-plane)
    found[base.replace(/-/g, '_')] = parsed; // normalized alias (e.g. control_plane)
  }
  return found;
}
function loadPolicies() {
  const policies = discover('config');
  if (Object.keys(policies).length === 0) Object.assign(policies, discover('.ai'));
  const versions = (policies['policy-versions'] && policies['policy-versions'].policies) || {};
  return { policies, versions, source: Object.keys(policies).length ? 'discovered' : 'absent' };
}
function isGovernancePath(filePath, policies) {
  const protectedPaths = ((policies || {}).control_plane || {})['protected_paths'] || [];
  return protectedPaths.some((p) => {
    if (p.endsWith('/')) return filePath.startsWith(p);
    return filePath === p;
  });
}
module.exports = { loadPolicies, isGovernancePath, POLICY_FILES };
if (require.main === module) {
  const { policies, versions, source } = loadPolicies();
  console.log(JSON.stringify({ source, policies: Object.keys(policies), versions }, null, 2));
}

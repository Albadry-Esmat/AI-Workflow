#!/usr/bin/env node
'use strict';
// Autonomous backlog selection (P4, N) — picks eligible work items under hard limits.
// Eligibility: risk medium or below, fingerprint-deduped, generation depth <= max,
// daily auto-task budget respected. Priority weights stay human-owned (backlog-policy).
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const ROOT = path.resolve(__dirname, '..');
const RISK_ORDER = { low: 0, medium: 1, high: 2, critical: 3 };

function loadBacklogPolicy() {
  return yaml.load(fs.readFileSync(path.join(ROOT, 'config', 'backlog-policy.yml'), 'utf8')).backlog;
}
// items: [{ id, risk, fingerprint, generation_depth, severity, age_days }]
// seenFingerprints: Set of known fingerprints. createdToday: count already auto-created today.
function select(items, { seenFingerprints = new Set(), createdToday = 0 } = {}) {
  const policy = loadBacklogPolicy();
  const maxRisk = RISK_ORDER[policy.max_auto_selected_risk];
  const picked = [];
  const skipped = [];
  for (const item of items) {
    if (seenFingerprints.has(item.fingerprint)) { skipped.push({ id: item.id, reason: 'duplicate' }); continue; }
    if ((RISK_ORDER[item.risk] ?? 99) > maxRisk) { skipped.push({ id: item.id, reason: `risk ${item.risk} above ${policy.max_auto_selected_risk}` }); continue; }
    if ((item.generation_depth || 0) > policy.maximum_generation_depth) { skipped.push({ id: item.id, reason: 'generation depth exceeded' }); continue; }
    if (createdToday + picked.length >= policy.max_new_auto_tasks_per_day) { skipped.push({ id: item.id, reason: 'daily budget exhausted' }); continue; }
    seenFingerprints.add(item.fingerprint);
    picked.push(item.id);
    if (picked.length >= policy.max_auto_created_issues_per_case) break;
  }
  return { picked, skipped };
}
module.exports = { select, loadBacklogPolicy };

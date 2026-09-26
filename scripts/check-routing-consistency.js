#!/usr/bin/env node
'use strict';
// check-routing-consistency.js — REPORT-ONLY observer (frozen-window safe).
// Compares primary.md intent rows against AGENTS.md rows, legacyRoute() branches,
// and task-router.yaml routes. Never enforces, never modifies, exits 0 always
// (report-only until G0 close promotes it to --check fail-closed).
// Usage: node scripts/check-routing-consistency.js [--json]
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');

function countTableRows(file, startMarker) {
  try {
    const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const lines = text.split('\n');
    const rows = lines.filter((l) => /^\| "/.test(l.trim()));
    return { file, rows: rows.length, present: true };
  } catch (e) {
    return { file, rows: 0, present: false, error: String(e.message) };
  }
}
function legacyBranches() {
  try {
    const text = fs.readFileSync(path.join(ROOT, 'scripts', 'log-shadow-observation.js'), 'utf8');
    const hits = text.match(/if \(has\(/g) || [];
    return { file: 'scripts/log-shadow-observation.js legacyRoute()', branches: hits.length, present: true };
  } catch (e) {
    return { file: 'scripts/log-shadow-observation.js legacyRoute()', branches: 0, present: false };
  }
}
function taskRouterRoutes() {
  try {
    const text = fs.readFileSync(path.join(ROOT, 'config', 'task-router.yaml'), 'utf8');
    const names = [...text.matchAll(/^  ([a-z-]+):$/gm)].map((m) => m[1]).filter((n) => n !== 'routes');
    return { file: 'config/task-router.yaml', routes: names, present: true };
  } catch (e) {
    return { file: 'config/task-router.yaml', routes: [], present: false };
  }
}
function main() {
  const primary = countTableRows('.opencode/agent/primary.md');
  const agents = countTableRows('AGENTS.md');
  const legacy = legacyBranches();
  const taskRouter = taskRouterRoutes();
  const divergences = [];
  if (primary.rows && agents.rows && primary.rows !== agents.rows) {
    divergences.push(`ROW_COUNT_DIVERGENCE: primary.md=${primary.rows} vs AGENTS.md=${agents.rows} (finding R-01, blocked fix until G0 close)`);
  }
  divergences.push('NOTE: legacyRoute() is an observer mirror, not authority (finding R-02).');
  divergences.push('NOTE: task-router.yaml is subordinate second-stage router, not intent authority (finding R-03).');
  divergences.push('NOTE: non-bypassable floor layer designed but NOT activated (requires P2 auth, finding R-04).');
  const report = {
    generated_at: new Date().toISOString(),
    mode: 'report-only',
    authority: '.opencode/agent/primary.md',
    primary, agents, legacy, taskRouter, divergences,
    enforcement: 'none — exits 0 always until promoted post-G0',
  };
  const asJson = process.argv.includes('--json');
  console.log(asJson ? JSON.stringify(report, null, 2) : [
    `authority: ${report.authority} (${primary.rows} rows)`,
    `AGENTS.md: ${agents.rows} rows`,
    `legacyRoute branches: ${legacy.branches}`,
    `task-router routes: ${(taskRouter.routes || []).join(', ')}`,
    ...divergences.map((d) => ` - ${d}`),
    'CONSISTENCY-REPORT-ONLY: no enforcement, exit 0',
  ].join('\n'));
  process.exit(0);
}
if (require.main === module) main();
module.exports = {};

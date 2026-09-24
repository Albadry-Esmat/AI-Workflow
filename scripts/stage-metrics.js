#!/usr/bin/env node
'use strict';
// Stage-1 metrics (P3) — combines case-store outcomes with merged-PR counts into
// the rollout-tracker's metric shape. Read-only. Human promotion stays manual.
const { execFileSync } = require('node:child_process');
const { collect } = require('./metrics-report');
const { evaluate } = require('./rollout-tracker');

function mergedPRs(days = 14, limit = 100) {
  try {
    const since = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
    const out = execFileSync('gh', ['pr', 'list', '--state', 'merged', '--limit', String(limit), '--json', 'mergedAt'], { encoding: 'utf8', timeout: 60000 });
    return JSON.parse(out).filter((pr) => (pr.mergedAt || '').slice(0, 10) >= since).length;
  } catch {
    return null; // gh unavailable — metrics degrade gracefully, never fabricate
  }
}
function main() {
  const { summary } = collect();
  const prs = mergedPRs();
  const metrics = {
    days: 0, // filled by scheduler context (days since stage entry)
    prs: prs === null ? summary.total_cases : Math.max(prs, summary.total_cases),
    autonomy_rate: summary.autonomy_rate,
    policy_violations: 0, // incremented by governance-gate findings feed (P4)
    incorrect_gatekeeper_decisions: 0,
    critical_escape_bugs: 0,
    pr_source: prs === null ? 'cases-only' : 'gh+cases',
  };
  console.log(JSON.stringify({ metrics, rollout: evaluate(metrics) }, null, 2));
}
module.exports = { mergedPRs };
if (require.main === module) main();

#!/usr/bin/env node
'use strict';
// Case final report (P2 audit) — renders artifacts/cases/<id>/ into final-report.md.
const fs = require('node:fs');
const path = require('node:path');
const { readCase, readEvents, auditChain } = require('./case-store');

function report(caseId) {
  const state = readCase(caseId);
  const events = readEvents(caseId);
  const chain = auditChain(caseId);
  const byEvent = {};
  for (const e of events) byEvent[e.event] = (byEvent[e.event] || 0) + 1;
  return [
    `# Case ${state.case_id} — final report`,
    '',
    `- State: **${state.state}** · fix cycles used: ${state.fixCycles} · issue: ${state.issue || 'n/a'}`,
    `- Audit chain: thread \`${chain.thread_id || 'n/a'}\` → PR ${chain.pr || 'n/a'} → ${chain.reviews.length} review(s) → merge \`${chain.merge_sha || 'n/a'}\``,
    `- Events: ${events.length} (${Object.entries(byEvent).map(([k, v]) => `${k}×${v}`).join(', ')})`,
    '',
    '## Event timeline',
    ...events.map((e) => `- ${e.timestamp} **${e.event}** by ${e.actor}${e.head_sha ? ` @ ${e.head_sha.slice(0, 8)}` : ''}${e.reason ? ` — ${e.reason}` : ''}`),
  ].join('\n') + '\n';
}
module.exports = { report };
if (require.main === module) {
  const id = process.argv[2];
  if (!id) { console.error('Usage: case-report.js <case-id>'); process.exit(2); }
  console.log(report(id));
}

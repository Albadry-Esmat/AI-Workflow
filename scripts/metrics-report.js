#!/usr/bin/env node
'use strict';
// Metrics rollup (P3) — autonomy rate, cycles, escalations from case events.
// Proxies first (override/revert rates); ground-truth FPR/FNR need human labels.
const fs = require('node:fs');
const path = require('node:path');
const { CASES_ROOT } = require('./case-store');

function collect() {
  const cases = [];
  if (!fs.existsSync(CASES_ROOT)) return { cases: [], summary: emptySummary() };
  for (const id of fs.readdirSync(CASES_ROOT)) {
    try {
      const state = JSON.parse(fs.readFileSync(path.join(CASES_ROOT, id, 'case.json'), 'utf8'));
      const events = fs.readFileSync(path.join(CASES_ROOT, id, 'events.jsonl'), 'utf8')
        .split('\n').filter(Boolean).map((l) => JSON.parse(l));
      cases.push({ id, state: state.state, fixCycles: state.fixCycles || 0, events: events.length });
    } catch { /* skip incomplete cases */ }
  }
  const done = cases.filter((c) => c.state === 'DONE').length;
  const esc = cases.filter((c) => c.state === 'ESCALATED').length;
  const summary = {
    total_cases: cases.length,
    autonomy_rate: cases.length ? done / cases.length : 0,
    escalation_rate: cases.length ? esc / cases.length : 0,
    avg_fix_cycles: cases.length ? cases.reduce((a, c) => a + c.fixCycles, 0) / cases.length : 0,
  };
  return { cases, summary };
}
function emptySummary() {
  return { total_cases: 0, autonomy_rate: 0, escalation_rate: 0, avg_fix_cycles: 0 };
}
module.exports = { collect };
if (require.main === module) console.log(JSON.stringify(collect(), null, 2));

#!/usr/bin/env node
'use strict';
// escalate-case.js — mechanical incident escalation for cases (Phase 4, G-15).
// Transitions a case to ESCALATED (or CANCELLED) through workflow-state.js so
// forbidden transitions still throw, and records the reason + actor in the
// append-only case event log. This is the code-owned stop path for runaway or
// compromised executions: in-flight model dispatches are bounded by their own
// spawn timeouts (see live-dispatch.js), and this command freezes the case so
// no further phase may start from it without a fresh human decision.
//
// Usage:
//   node scripts/escalate-case.js --case <id> --reason "..." [--actor ...] [--to ESCALATED|CANCELLED]
// Exit 0 + resulting state JSON; exit 1 + error JSON otherwise.
const { readCase, advance } = require('./case-store');

function parseArgs(argv) {
  const o = { to: 'ESCALATED' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--case') o.caseId = argv[++i];
    else if (a === '--reason') o.reason = argv[++i];
    else if (a === '--actor') o.actor = argv[++i];
    else if (a === '--to') o.to = argv[++i];
    else if (a === '--help' || a === '-h') o.help = true;
    else o.unknown = a;
  }
  return o;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args.unknown || !args.caseId || !args.reason) {
    console.error('Usage: escalate-case.js --case <id> --reason "..." [--actor ...] [--to ESCALATED|CANCELLED]');
    process.exit(2);
  }
  if (!['ESCALATED', 'CANCELLED'].includes(args.to)) {
    console.log(JSON.stringify({ ok: false, error: 'REFUSED_TARGET', detail: 'escalation targets ESCALATED or CANCELLED only' }));
    process.exit(1);
  }
  try {
    const next = advance(args.caseId, args.to, { actor: args.actor || 'incident-response', reason: args.reason });
    console.log(JSON.stringify({ ok: true, case_id: next.case_id, state: next.state, fixCycles: next.fixCycles, updatedAt: next.updatedAt }, null, 2));
  } catch (e) {
    console.log(JSON.stringify({ ok: false, error: 'TRANSITION_REFUSED', detail: e.message }));
    process.exit(1);
  }
}
if (require.main === module) main();
module.exports = {};

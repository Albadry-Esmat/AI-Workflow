#!/usr/bin/env node
'use strict';
// resolve-override.js — code-owned override resolution for governance gates.
//
// The orchestrator MUST run this (not trust skill-output JSON) before honoring
// any guard override claim. A guard output claiming an override without a
// resolvable decision_id is treated as block.
//
// Usage:
//   node scripts/resolve-override.js --decision-id gd_... --gate-id GATE-X
//     [--gate-class general] [--execution-id ...] [--scope-json '{"finding_ids":["F-1"]}']
//     [--subject-hash ...] [--audit-only]
//
// --audit-only resolves without authority enforcement (read-only audits).
// Gate advancement MUST NOT use --audit-only.
// Exit 0 + resolved record JSON on success; exit 1 + error JSON otherwise.
const gd = require('./gate-decisions');

function parseArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--decision-id') o.decision_id = argv[++i];
    else if (a === '--gate-id') o.gate_id = argv[++i];
    else if (a === '--gate-class') o.gate_class = argv[++i];
    else if (a === '--execution-id') o.execution_id = argv[++i];
    else if (a === '--scope-json') o.scope = JSON.parse(argv[++i]);
    else if (a === '--subject-hash') o.subject_hash = argv[++i];
    else if (a === '--audit-only') o.auditOnly = true;
    else if (a === '--help' || a === '-h') o.help = true;
    else { o.unknown = a; }
  }
  return o;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args.unknown || !args.decision_id) {
    console.error('Usage: resolve-override.js --decision-id gd_... --gate-id GATE-X [--gate-class C] [--execution-id E] [--scope-json {...}] [--subject-hash H] [--audit-only]');
    process.exit(2);
  }
  const r = gd.resolveOverride({
    decision_id: args.decision_id,
    gate_id: args.gate_id,
    gate_class: args.gate_class,
    execution_id: args.execution_id,
    scope: args.scope,
    subject_hash: args.subject_hash,
    enforceAuthority: args.auditOnly ? false : true,
  });
  if (!r.valid) {
    console.log(JSON.stringify({ valid: false, reason: r.reason }, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify({ valid: true, reason: r.reason, record: r.record }, null, 2));
}
if (require.main === module) main();
module.exports = {};

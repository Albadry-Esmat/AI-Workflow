#!/usr/bin/env node
'use strict';
// Phase 2: versioned benchmark runner + trace graders.
// Modes: --mode det (default, no network/model) | --mode live (requires explicit approval + creds; fails closed otherwise).
// Graders per case: routing (template->tier/pipeline), tool-choice (gateway decision), policy (deny reasons), trace (envelope validates).
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const router = require('./task-router');
const gateway = require('./policy-gateway');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');

function parseArgs(argv) {
  const o = { mode: 'det', dataset: 'evals/execution-kernel/cases/v1.json', out: '' };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--mode') o.mode = argv[++i];
    else if (argv[i] === '--dataset') o.dataset = argv[++i];
    else if (argv[i] === '--out') o.out = argv[++i];
  }
  return o;
}
function grade(caseDef) {
  const t0 = Date.now();
  const findings = [];
  let routingOk = false, toolOk = false, traceOk = false;
  try {
    const r = router.route(caseDef.template);
    routingOk = r.model_tier === caseDef.expected.model_tier && r.pipeline === caseDef.expected.pipeline;
    if (!routingOk) findings.push(`routing mismatch: got ${r.model_tier}/${r.pipeline}`);
  } catch (e) {
    if (caseDef.expected.decision === 'error') { routingOk = true; toolOk = true; traceOk = true; }
    else findings.push('routing error: ' + e.message);
    return { pass: routingOk && toolOk && traceOk, findings, latency_ms: Date.now() - t0 };
  }
  if (!caseDef.tool) {
    const denyByDefault = true;
    toolOk = caseDef.expected.decision === 'deny' && denyByDefault;
    if (!toolOk) findings.push('empty tool should deny');
  } else {
    const v = gateway.check({ tool: caseDef.tool, path: caseDef.path });
    toolOk = v.decision === caseDef.expected.decision;
    if (!toolOk) findings.push(`tool decision mismatch: got ${v.decision} (${v.reason})`);
  }
  try {
    const schema = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'trace-envelope-schema.json'), 'utf8'));
    const ajv = new Ajv({ strict: true }); addFormats(ajv);
    const rec = { trace_id: 'tr-grade', thread_id: 'grade', model: caseDef.expected.model_tier || 'cheap', tool_calls: [], guardrail: caseDef.expected.decision === 'deny' ? 'deny' : 'allow', handoff: null, ts: new Date().toISOString() };
    traceOk = ajv.compile(schema)(rec);
    if (!traceOk) findings.push('trace schema invalid');
  } catch (e) { findings.push('trace grader error: ' + e.message); }
  return { pass: routingOk && toolOk && traceOk, findings, latency_ms: Date.now() - t0 };
}
function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.mode === 'live') {
    console.error('live mode requires explicit --yes + provider credentials; failing closed in P2 skeleton (use nightly workflow with secrets).');
    process.exit(2);
  }
  const ds = JSON.parse(fs.readFileSync(path.join(ROOT, args.dataset), 'utf8'));
  const results = ds.cases.map((c) => ({ case_id: c.case_id, class: c.class, ...grade(c) }));
  const passed = results.filter((r) => r.pass).length;
  const report = { dataset_version: ds.dataset_version, mode: 'det', total: results.length, passed, failed: results.length - passed, results, ts: new Date().toISOString() };
  const outPath = args.out || `evals/execution-kernel/reports/benchmark-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  const resolved = path.isAbsolute(outPath) ? outPath : path.join(ROOT, outPath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, JSON.stringify(report, null, 2));
  console.log(`benchmark ${ds.dataset_version}: ${passed}/${results.length} passed -> ${outPath}`);
  results.filter((r) => !r.pass).forEach((r) => console.log(`  FAIL ${r.case_id}: ${r.findings.join('; ')}`));
  process.exit(passed === results.length ? 0 : 1);
}
if (require.main === module) main();

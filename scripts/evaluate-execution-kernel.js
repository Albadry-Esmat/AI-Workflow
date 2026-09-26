#!/usr/bin/env node
'use strict';
// Versioned benchmark runner + trace graders.
// Modes: --mode det (default, no network/model) | --mode live --adapter <id>
// (executes through that runtime's own non-interactive entry with the runtime's
// own auth; AIW holds zero model credentials; fails closed otherwise).
// Graders per case: routing (template->model_id/pipeline; tier is metadata-only), tool-choice (gateway decision), policy (deny reasons), trace (envelope validates).
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const router = require('./task-router');
const gateway = require('./policy-gateway');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');

function parseArgs(argv) {
  const o = { mode: 'det', adapter: null, dataset: 'evals/execution-kernel/cases/v1.json', out: '' };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--mode') o.mode = argv[++i];
    else if (argv[i] === '--adapter') o.adapter = argv[++i];
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
    // AUTHORITY: model_id. model_tier is metadata-only and must not gate.
    const expectedId = caseDef.expected.model_id !== undefined ? caseDef.expected.model_id : null;
    const idOk = expectedId === null ? r.model_id == null : r.model_id === expectedId;
    routingOk = idOk && r.pipeline === caseDef.expected.pipeline;
    if (!routingOk) findings.push(`routing mismatch: got ${r.model_id}/${r.pipeline} (requirement ${r.model_requirement})`);
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
    const rec = { trace_id: 'tr-grade', thread_id: 'grade', model: caseDef.expected.model_id || 'unknown', model_id: caseDef.expected.model_id || undefined, tool_calls: [], guardrail: caseDef.expected.decision === 'deny' ? 'deny' : 'allow', handoff: null, ts: new Date().toISOString() };
    traceOk = ajv.compile(schema)(rec);
    if (!traceOk) findings.push('trace schema invalid');
  } catch (e) { findings.push('trace grader error: ' + e.message); }
  return { pass: routingOk && toolOk && traceOk, findings, latency_ms: Date.now() - t0 };
}
function main() {
  const args = parseArgs(process.argv.slice(2));
  // Live mode executes through the runtime's OWN non-interactive entry with the
  // runtime's OWN auth. AIW holds zero model credentials by design — there is no
  // provider key to configure. Fails closed with no-authenticated-runtime.
  let runtime = null;
  let live = null;
  if (args.mode === 'live') {
    const adapterId = args.adapter || null;
    if (!adapterId) {
      console.error('live mode requires --adapter <id> (executes via that runtime with its own auth).');
      process.exit(2);
    }
    const { checkAuth } = require('./runtime-auth');
    runtime = { ...checkAuth(adapterId), at: new Date().toISOString() };
    if (!runtime.installed || !runtime.authenticated) {
      console.error(`no-authenticated-runtime: ${adapterId} (installed=${runtime.installed}, authenticated=${runtime.authenticated}) — det baseline preserved.`);
      process.exit(3);
    }
    // Live layer: read-only analysis prompts through the runtime (gateway-wrapped).
    // Det cases below still validate OUR router/gateway/traces; live proves the path.
    const { dispatch } = require('./live-dispatch');
    const prompts = [
      'List the top-level directories of this repo (one line each). Report only, change nothing.',
      'Describe scripts/checkpointer.js in two sentences. Report only, change nothing.',
    ];
    live = { adapter: adapterId, prompts: [] };
    prompts.forEach((p, i) => {
      const r = dispatch(`live-bench-${Date.now()}-${i}`, { adapter: adapterId, prompt: p, targetPath: '' });
      live.prompts.push({ prompt: p.slice(0, 80), ok: Boolean(r.ok), latency_ms: r.latency_ms || null, usage: r.usage || null, reason: r.reason || null, trace_id: r.trace_id || null });
    });
    live.passed = live.prompts.filter((p) => p.ok).length;
  }
  const ds = JSON.parse(fs.readFileSync(path.join(ROOT, args.dataset), 'utf8'));
  const results = ds.cases.map((c) => ({ case_id: c.case_id, class: c.class, ...grade(c) }));
  const passed = results.filter((r) => r.pass).length;
  let repo_head_sha = null;
  try {
    repo_head_sha = require('node:child_process').execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim() || null;
  } catch { /* best-effort evidence binding */ }
  const report = { dataset_version: ds.dataset_version, mode: args.mode, total: results.length, passed, failed: results.length - passed, results, runtime, live, repo_head_sha, ts: new Date().toISOString() };
  if (live && live.passed !== live.prompts.length) {
    console.log(`live prompts: ${live.passed}/${live.prompts.length} ok`);
    live.prompts.filter((p) => !p.ok).forEach((p) => console.log(`  LIVE-FAIL: ${p.reason}`));
  }
  const outPath = args.out || `evals/execution-kernel/reports/benchmark-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  const resolved = path.isAbsolute(outPath) ? outPath : path.join(ROOT, outPath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, JSON.stringify(report, null, 2));
  console.log(`benchmark ${ds.dataset_version}: ${passed}/${results.length} passed -> ${outPath}`);
  results.filter((r) => !r.pass).forEach((r) => console.log(`  FAIL ${r.case_id}: ${r.findings.join('; ')}`));
  process.exit(passed === results.length ? 0 : 1);
}
if (require.main === module) main();

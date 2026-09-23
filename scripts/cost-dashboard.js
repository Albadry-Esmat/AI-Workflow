#!/usr/bin/env node
'use strict';
// Phase 4: cost/quality/latency dashboard per task class (model tier).
// Sources: trace.jsonl files (allow/deny, tool calls) + benchmark reports (pass rate, latency).
// Token costs are placeholders in det mode (no live LLM); nightly live mode fills real usage.
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');

function collectTraces() {
  const state = path.join(ROOT, '.opencode', 'state');
  const out = [];
  if (!fs.existsSync(state)) return out;
  for (const d of fs.readdirSync(state)) {
    const tp = path.join(state, d, 'trace.jsonl');
    if (fs.existsSync(tp)) {
      for (const line of fs.readFileSync(tp, 'utf8').split('\n').filter(Boolean)) {
        try { out.push(JSON.parse(line)); } catch { /* skip corrupt */ }
      }
    }
  }
  return out;
}
function collectBenchmarks() {
  const dir = path.join(ROOT, 'evals', 'execution-kernel', 'reports');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
}
function main() {
  const traces = collectTraces();
  const benches = collectBenchmarks();
  const byTier = {};
  for (const t of traces) {
    const k = t.model || 'unknown';
    byTier[k] = byTier[k] || { traces: 0, allow: 0, deny: 0 };
    byTier[k].traces++;
    if (t.guardrail === 'allow') byTier[k].allow++; else byTier[k].deny++;
  }
  const latestBench = benches.length ? benches[benches.length - 1] : null;
  const report = {
    ts: new Date().toISOString(),
    traces_total: traces.length,
    by_model_tier: byTier,
    benchmark: latestBench ? { version: latestBench.dataset_version, passed: latestBench.passed, total: latestBench.total } : null,
    cost_note: 'det mode: zero live tokens. Nightly live mode records real tokens/cost/latency per tier.',
  };
  console.log(JSON.stringify(report, null, 2));
}
if (require.main === module) main();

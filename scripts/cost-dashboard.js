#!/usr/bin/env node
'use strict';
// Cost/quality/latency dashboard per exact model (tier metadata only).
// Sources: trace.jsonl files (allow/deny, tool calls, latency) + benchmark reports.
// Costs come exclusively from runtime-reported usage; AIW holds zero model
// credentials and never calls provider billing. Det mode reports zero live tokens.
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
  const usage = { input_tokens: 0, output_tokens: 0, live_calls: 0, latency_ms_total: 0 };
  for (const t of traces) {
    const k = t.model || 'unknown';
    byTier[k] = byTier[k] || { traces: 0, allow: 0, deny: 0, live_calls: 0, latency_ms_total: 0 };
    byTier[k].traces++;
    if (t.guardrail === 'allow') byTier[k].allow++; else byTier[k].deny++;
    for (const c of t.tool_calls || []) {
      if (c.live) {
        byTier[k].live_calls++;
        usage.live_calls++;
        if (typeof c.latency_ms === 'number') { byTier[k].latency_ms_total += c.latency_ms; usage.latency_ms_total += c.latency_ms; }
        if (c.usage) {
          usage.input_tokens += c.usage.input_tokens || 0;
          usage.output_tokens += c.usage.output_tokens || 0;
        }
      }
    }
  }
  const latestBench = benches.length ? benches[benches.length - 1] : null;
  const report = {
    ts: new Date().toISOString(),
    traces_total: traces.length,
    by_model: byTier,
    by_model_tier: byTier,
    benchmark: latestBench ? { version: latestBench.dataset_version, passed: latestBench.passed, total: latestBench.total, live: latestBench.live ? `${latestBench.live.passed}/${latestBench.live.prompts.length}` : null } : null,
    runtime_usage: usage,
    cost_note: 'det mode: zero live tokens. Live latency/usage is recorded from runtime-reported output only; AIW holds zero model credentials.',
  };
  console.log(JSON.stringify(report, null, 2));
}
if (require.main === module) main();

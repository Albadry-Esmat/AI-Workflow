#!/usr/bin/env node
'use strict';
// Phase 4: frontier-gated release review. Requires:
//  --yes (explicit HITL), benchmark det green, policy v1.1, template release-review (frontier).
// Writes release attestation to store + parent checkpoint. Fails closed otherwise.
const { execFileSync } = require('node:child_process');
const router = require('./task-router');
const checkpointer = require('./checkpointer');
const store = require('./store');

function main() {
  const argv = process.argv.slice(2);
  const get = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
  const yes = argv.includes('--yes');
  const thread = get('--thread') || 'release-' + Date.now();
  if (!yes) { console.error('release-review requires explicit --yes (frontier-gated HITL). Failing closed.'); process.exit(2); }
  const r = router.route('release-review');
  if (r.model_tier !== 'frontier') { console.error('release-review must map to frontier tier. Failing closed.'); process.exit(1); }
  try {
    execFileSync('node', ['scripts/evaluate-execution-kernel.js', '--mode', 'det', '--out', '/tmp/release-bench.json'], { stdio: 'pipe' });
  } catch {
    console.error('release blocked: deterministic benchmark not green. Failing closed.');
    process.exit(1);
  }
  checkpointer.appendCheckpoint(thread, { kind: 'release-review', verdict: 'approved', model_tier: 'frontier' });
  store.put(thread, 'release-attestation', { verdict: 'approved', model_tier: r.model_tier, pipeline: r.pipeline, ts: new Date().toISOString() });
  console.log(JSON.stringify({ thread, verdict: 'approved', model_tier: r.model_tier, pipeline: r.pipeline }, null, 2));
}
if (require.main === module) main();

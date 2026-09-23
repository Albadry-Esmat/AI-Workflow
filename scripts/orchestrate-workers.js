#!/usr/bin/env node
'use strict';
// Phase 3: orchestrator-workers fan-out (Anthropic pattern).
// Usage: orchestrate-workers.js --parent <thread> --template quick-fix "subtask1" "subtask2" ...
// Each subtask runs as isolated worker thread (fresh checkpointer), results synthesized to parent + store.
const router = require('./task-router');
const opencode = require('./runtime-adapter');
const checkpointer = require('./checkpointer');
const store = require('./store');

function parseArgs(argv) {
  const o = { parent: 'parent-' + Date.now(), template: 'quick-fix', tasks: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--parent') o.parent = argv[++i];
    else if (argv[i] === '--template') o.template = argv[++i];
    else o.tasks.push(argv[i]);
  }
  return o;
}
function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.tasks.length) { console.error('Usage: orchestrate-workers.js --parent <id> [--template quick-fix] "task1" "task2" ...'); process.exit(2); }
  const r = router.route(args.template);
  opencode.start(args.parent, { model_tier: r.model_tier, pipeline: r.pipeline });
  const results = args.tasks.map((t, i) => {
    const worker = `${args.parent}-w${i}`;
    opencode.start(worker, { model_tier: r.model_tier, pipeline: r.pipeline });
    const res = opencode.send(worker, { prompt: t, model_tier: r.model_tier, tool: 'read', targetPath: 'docs/' });
    store.put(args.parent, `worker-${i}`, { task: t, result: res });
    return { worker, task: t, denied: res.denied };
  });
  checkpointer.appendCheckpoint(args.parent, { kind: 'fanout', workers: results.length, template: args.template });
  const denied = results.filter((x) => x.denied).length;
  console.log(JSON.stringify({ parent: args.parent, template: args.template, workers: results.length, denied, synthesis: `fanned out ${results.length}, ${denied} denied by policy` }, null, 2));
}
if (require.main === module) main();

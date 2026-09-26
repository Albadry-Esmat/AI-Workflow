#!/usr/bin/env node
'use strict';
// Phase 3: orchestrator-workers fan-out (Anthropic pattern).
// Usage: orchestrate-workers.js --parent <thread> --template quick-fix "subtask1" "subtask2" ...
// Each subtask runs as isolated worker thread (fresh checkpointer), results synthesized to parent + store.
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
  // Enforcement: verify → resolve BEFORE any adapter contact (fail closed,
  // no partial fan-out when the template requirement is unavailable).
  const gate = require('./require-model-availability');
  let r;
  let model_id;
  let model_resolution;
  try {
    ({ route: r, model_id, model_resolution } = gate.verifyTemplate(args.template));
  } catch (err) {
    if (err.code === 'NO_AVAILABLE_MODEL') {
      console.error(String(err.message));
      process.exit(1);
    }
    throw err;
  }
  // Phase A: parent runs under orchestrator identity; each worker gets a
  // distinct execution-scoped identity with explicit parent lineage.
  const identity = require('./execution-identity');
  if (!r.agent) {
    console.error(`execution identity failed: template '${args.template}' routes to no agent; refusing unattributable execution.`);
    process.exit(1);
  }
  const parent_identity = identity.createOrchestratorIdentity({ executionId: args.parent, source: 'launcher:orchestrate-workers' });
  opencode.start(args.parent, { model_id, tier_hint: r.tier_hint, pipeline: r.pipeline, model_resolution, agent_identity: parent_identity });
  const results = args.tasks.map((t, i) => {
    const worker_identity = identity.createWorkerIdentity({ agent: r.agent, parentExecutionId: args.parent, workerIndex: i, source: 'launcher:orchestrate-workers' });
    const worker = worker_identity.execution_id;
    opencode.start(worker, { model_id, tier_hint: r.tier_hint, pipeline: r.pipeline, model_resolution, agent_identity: worker_identity });
    const res = opencode.send(worker, { prompt: t, model_id, tier_hint: r.tier_hint, agent_identity: worker_identity, tool: 'read', targetPath: 'docs/', model_resolution });
    store.put(args.parent, `worker-${i}`, { task: t, result: res, worker_identity });
    // Phase D: worker producer evidence (subject = HEAD at completion).
    if (!res.denied) {
      try {
        const producers = require('./producer-evidence');
        const head = producers.repoHeadSha();
        if (head) producers.record({ agentIdentity: worker_identity, subjectHash: head, outcome: 'completed', sourceRef: worker });
      } catch (err) {
        console.error(`producer evidence warning: ${err.message}`);
      }
    }
    return { worker, task: t, denied: res.denied };
  });
  checkpointer.appendCheckpoint(args.parent, { kind: 'fanout', workers: results.length, template: args.template });
  const denied = results.filter((x) => x.denied).length;
  console.log(JSON.stringify({ parent: args.parent, template: args.template, workers: results.length, denied, synthesis: `fanned out ${results.length}, ${denied} denied by policy` }, null, 2));
}
if (require.main === module) main();

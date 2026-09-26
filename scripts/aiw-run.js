#!/usr/bin/env node
'use strict';
// aiw run --template quick-fix|feature-delivery|release-review --adapter opencode|codex
//   --thread <id> [--tool <tool>] [--path <path>] [--approval <token>] [--retrieval deterministic|vector-trial] "request"
// Phase 2: dual adapters (OpenCode default, Codex opt-in), scoped approvals, retrieval A/B flag.
const opencode = require('./runtime-adapter');
const codex = require('./codex-adapter');
const checkpointer = require('./checkpointer');
const { retrieve } = require('./retrieve');

const ADAPTERS = {
  'opencode': () => require('./runtime-adapter'),
  'codex': () => require('./codex-adapter'),
  'claude-code': () => require('./claude-adapter'),
  'copilot-cli': () => require('./copilot-adapter'),
  'antigravity': () => require('./antigravity-adapter'),
  'cursor': () => require('./cursor-adapter'),
  'gemini-cli': () => require('./gemini-adapter'),
  'aider': () => require('./aider-adapter'),
};
function loadAdapter(id) {
  const name = id || 'opencode';
  const loader = ADAPTERS[name];
  if (!loader) throw new Error(`unknown adapter: ${name} (expected one of ${Object.keys(ADAPTERS).join(', ')})`);
  return { adapter: loader(), name };
}

function usage() {
  console.error('Usage: aiw run --template <quick-fix|feature-delivery|release-review> [--adapter opencode|codex|claude-code|copilot-cli|antigravity|cursor|gemini-cli|aider] [--thread <id>] [--tool <tool>] [--path <path>] [--approval <token>] [--retrieval deterministic|vector-trial] "request"');
  process.exit(2);
}
function parseArgs(argv) {
  const out = { template: 'feature-delivery', adapter: 'opencode', thread: 'thread-' + Date.now(), tool: 'read', path: '', approval: null, retrieval: 'deterministic', request: '' };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--template') out.template = argv[++i];
    else if (argv[i] === '--adapter') out.adapter = argv[++i];
    else if (argv[i] === '--thread') out.thread = argv[++i];
    else if (argv[i] === '--tool') out.tool = argv[++i];
    else if (argv[i] === '--path') out.path = argv[++i];
    else if (argv[i] === '--approval') out.approval = argv[++i];
    else if (argv[i] === '--retrieval') out.retrieval = argv[++i];
    else rest.push(argv[i]);
  }
  out.request = rest.join(' ');
  return out;
}
function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.request) usage();
  // Enforcement: Declare → Discover → Verify → Resolve BEFORE any adapter
  // contact. Fail-closed with one concise actionable failure; no partial work
  // (no checkpoint/trace exists yet at this point).
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
  const { adapter } = loadAdapter(args.adapter);
  // Phase A: launcher assigns the canonical execution identity (fail-closed
  // when the route names no agent — unattributable execution is refused).
  const identity = require('./execution-identity');
  if (!r.agent) {
    console.error(`execution identity failed: template '${args.template}' routes to no agent; refusing unattributable execution.`);
    process.exit(1);
  }
  const agent_identity = identity.createLauncherIdentity({ agent: r.agent, executionId: args.thread, source: 'launcher:aiw-run' });
  adapter.start(args.thread, { model_id, tier_hint: r.tier_hint, pipeline: r.pipeline, model_resolution, agent_identity });
  const ctx = retrieve(args.request.split(' ').slice(0, 5).join(' '), args.retrieval);
  checkpointer.appendCheckpoint(args.thread, { kind: 'retrieval', method: ctx.method, strategy: args.retrieval });
  const res = adapter.send(args.thread, { prompt: args.request, model_id, tier_hint: r.tier_hint, agent_identity, tool: args.tool, targetPath: args.path, approval: args.approval, model_resolution });
  // Phase D: producer evidence for completed producer-role dispatches —
  // launcher-owned identity + derived HEAD subject (denied turns produced
  // nothing and are skipped; recording never alters dispatch outcome).
  if (!res.denied) {
    try {
      const producers = require('./producer-evidence');
      const head = producers.repoHeadSha();
      if (head) producers.record({ agentIdentity: agent_identity, subjectHash: head, outcome: res.failed ? 'failed' : 'completed', sourceRef: args.thread });
    } catch (err) {
      console.error(`producer evidence warning: ${err.message}`);
    }
  }
  console.log(JSON.stringify({ template: r, adapter: args.adapter, thread: args.thread, retrieval: ctx, result: res, evidence: adapter.evidence(args.thread) }, null, 2));
}
if (require.main === module) main();
module.exports = { retrieve };

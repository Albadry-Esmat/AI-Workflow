#!/usr/bin/env node
'use strict';
// aiw run --template quick-fix|feature-delivery|release-review --adapter opencode|codex
//   --thread <id> [--tool <tool>] [--path <path>] [--approval <token>] [--retrieval deterministic|vector-trial] "request"
// Phase 2: dual adapters (OpenCode default, Codex opt-in), scoped approvals, retrieval A/B flag.
const router = require('./task-router');
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
  const r = router.route(args.template);
  const { adapter } = loadAdapter(args.adapter);
  adapter.start(args.thread, { model_tier: r.model_tier, pipeline: r.pipeline });
  const ctx = retrieve(args.request.split(' ').slice(0, 5).join(' '), args.retrieval);
  checkpointer.appendCheckpoint(args.thread, { kind: 'retrieval', method: ctx.method, strategy: args.retrieval });
  const res = adapter.send(args.thread, { prompt: args.request, model_tier: r.model_tier, tool: args.tool, targetPath: args.path, approval: args.approval });
  console.log(JSON.stringify({ template: r, adapter: args.adapter, thread: args.thread, retrieval: ctx, result: res, evidence: adapter.evidence(args.thread) }, null, 2));
}
if (require.main === module) main();
module.exports = { retrieve };

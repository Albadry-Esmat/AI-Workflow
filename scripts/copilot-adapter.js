#!/usr/bin/env node
'use strict';
// GitHub Copilot CLI adapter — executable `copilot`.
// Non-interactive `copilot -p "…"` / `-s` is the kernel-friendly hook (verified in docs).
// Auth delegated: /login, GH_TOKEN/GITHUB_TOKEN. Org policies inherited from GitHub.
const { makeAdapter } = require('./adapter-factory');
module.exports = makeAdapter({
  id: 'copilot-cli',
  executable: 'copilot',
  isolation: 'per-thread state dir; trusted-directory prompts honored (no bypass)',
  notes: 'Deterministic plan via Copilot CLI adapter (no live model). Live runs as `copilot -p` with the runtime auth; AIW holds zero model credentials.',
});

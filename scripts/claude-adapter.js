#!/usr/bin/env node
'use strict';
// Claude Code adapter — executable `claude`, probes `claude --version` / `claude doctor`.
// Auth delegated to runtime (/login, API key). Evidence: launch-only + file evidence.
const { makeAdapter } = require('./adapter-factory');
module.exports = makeAdapter({
  id: 'claude-code',
  executable: 'claude',
  isolation: 'per-thread state dir; runtime-owned trust prompts honored (no bypass)',
  notes: 'Deterministic plan via Claude Code adapter (no live model). Live runs as `claude -p --bare` with the runtime auth; AIW holds zero model credentials.',
});

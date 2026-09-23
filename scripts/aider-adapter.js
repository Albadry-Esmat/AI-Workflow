#!/usr/bin/env node
'use strict';
// Aider adapter — executable `aider`, probe `aider --version`.
// Auth delegated to runtime (provider API keys). Evidence: launch-only + file evidence.
const { makeAdapter } = require('./adapter-factory');
module.exports = makeAdapter({
  id: 'aider',
  executable: 'aider',
  isolation: 'per-thread state dir; repo-scoped edits only via gateway allowlist (no bypass)',
  notes: 'Deterministic plan via Aider adapter (no live model). Live dispatch behind approval in nightly.',
});

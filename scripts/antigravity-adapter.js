#!/usr/bin/env node
'use strict';
// Google Antigravity CLI adapter — executable `agy`, probe `agy --version`.
// Successor to Gemini CLI (June 2026 migration). Auth: Google account or Gemini API key.
// Respects AGENTS.md / ~/.antigravity/ config. Evidence: launch-only + file evidence.
const { makeAdapter } = require('./adapter-factory');
module.exports = makeAdapter({
  id: 'antigravity',
  executable: 'agy',
  isolation: 'per-thread state dir; workspace permissions/sandbox config honored (no bypass)',
  notes: 'Deterministic plan via Antigravity adapter (no live model). Live dispatch behind approval in nightly.',
});

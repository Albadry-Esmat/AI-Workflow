#!/usr/bin/env node
'use strict';
// Gemini CLI adapter (legacy) — executable `gemini`, probe `gemini --version`.
// Google migrated users to Antigravity CLI (June 2026); this adapter is kept for
// existing installs only and stays candidate/launch-only. Prefer `antigravity`.
const { makeAdapter } = require('./adapter-factory');
module.exports = makeAdapter({
  id: 'gemini-cli',
  executable: 'gemini',
  isolation: 'per-thread state dir; sandbox/docker settings honored where reported (unknown until fixture)',
  notes: 'Deterministic plan via legacy Gemini adapter (no live model). Prefer antigravity for new installs.',
});

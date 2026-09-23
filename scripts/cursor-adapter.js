#!/usr/bin/env node
'use strict';
// Cursor CLI adapter — executable `agent` (cursor.com/install), probe `agent --version`.
// Non-interactive `agent -p "…" --model …`, `--mode=plan/ask`, `--sandbox` map to gateway+trace.
// NOTE: generic `agent` binary names collide (e.g. unrelated tools); detect() records
// the raw version string honestly and never claims Cursor identity from presence alone.
// Auth delegated: `agent login`, CURSOR_API_KEY.
const { makeAdapter } = require('./adapter-factory');
module.exports = makeAdapter({
  id: 'cursor',
  executable: 'agent',
  isolation: 'per-thread state dir; sandbox mode honored where reported (unknown until fixture)',
  notes: 'Deterministic plan via Cursor adapter (no live model). Live `agent -p` dispatch behind approval in nightly.',
});

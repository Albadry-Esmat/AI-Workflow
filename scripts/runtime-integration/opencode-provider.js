#!/usr/bin/env node
'use strict';
// Runtime Integration — OpenCode provider (BELOW the AI Workflow boundary).
// May use native OpenCode discovery (e.g. `opencode models`). Best-effort,
// read-only, never throws, never provisions. Returns exact model IDs or [].
//
// NOTE: `opencode models` emits plaintext (one `provider/model` ID per line).
// There is no `--json` flag; callers must not pass one (it prints help text).
function listModels() {
  const { spawnSync } = require('node:child_process');
  try {
    const r = spawnSync('opencode', ['models'], { encoding: 'utf8', timeout: 15000, stdio: ['ignore', 'pipe', 'pipe'] });
    if (r.error || r.status !== 0) return [];
    const out = String(r.stdout || '').trim();
    if (!out) return [];
    try {
      const parsed = JSON.parse(out);
      const arr = Array.isArray(parsed) ? parsed : parsed.models || parsed.data || [];
      const ids = arr.map((m) => (typeof m === 'string' ? m : m.id || m.model || '')).filter(Boolean);
      if (ids.length > 0) return ids.filter((t) => /^[^/\s]+\/[^\s]+$/.test(t));
      // JSON parsed but carried no IDs — fall through to token scan.
    } catch {
      // Plaintext output: fall through to token scan below.
    }
    // Plaintext `opencode models` output: extract provider/model-looking tokens.
    return [...new Set(out.split(/[\s,]+/).map((t) => t.trim()).filter((t) => /^[^/\s]+\/[^\s]+$/.test(t)))];
  } catch {
    return [];
  }
}

module.exports = { listModels };

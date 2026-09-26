#!/usr/bin/env node
'use strict';
// Runtime Integration Layer — provider-specific model discovery lives ONLY here.
//
// Core workflow logic must never import provider CLIs/APIs directly; it uses
// scripts/runtime-models.js (listAvailableModels). Each provider below may use
// whatever native mechanism it needs (provider CLI, provider API, local runtime
// probe). All probes are best-effort, read-only, and fail-closed (return []).
//
// Authoritative discovery for OpenCode-executable models is opencode-provider
// (`opencode models`). The remaining providers are availability-only
// supplements; copilot-provider is intentionally unsupported (see its header)
// so discovery can never contradict what OpenCode itself reports.
const providers = [
  './opencode-provider',
  './claude-provider',
  './codex-provider',
  './copilot-provider',
  './gemini-provider',
  './generic-provider',
];

function listModels() {
  const out = [];
  for (const mod of providers) {
    try {
      const p = require(mod);
      const models = p.listModels();
      if (Array.isArray(models)) out.push(...models);
    } catch {
      // best-effort: a failing provider contributes nothing, never throws
    }
  }
  return [...new Set(out)];
}

module.exports = { listModels };

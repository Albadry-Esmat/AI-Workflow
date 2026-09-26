#!/usr/bin/env node
'use strict';
// Runtime Integration — Claude provider (BELOW the boundary).
// Best-effort, read-only, never throws. Returns exact model IDs or [].
function listModels() {
  // Native Claude discovery is provider-owned; no verified non-interactive
  // list command is assumed here. Operators may surface availability through
  // AIW_AVAILABLE_MODELS or a future verified probe without touching core.
  return [];
}
module.exports = { listModels };

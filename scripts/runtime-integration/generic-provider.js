#!/usr/bin/env node
'use strict';
// Runtime Integration — generic/local provider (BELOW the boundary).
// Surfaces operator-declared local models without probing anything.
function listModels() {
  const raw = process.env.AIW_LOCAL_MODELS || '';
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}
module.exports = { listModels };

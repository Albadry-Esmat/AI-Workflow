#!/usr/bin/env node
'use strict';
// AI Workflow — Runtime Capability Interface.
//
// Boundary: Declare → Verify → Consume → Execute.
// Never Install → Connect → Authenticate → Configure.
//
// The workflow asks ONLY: "Which models are currently available?"
// HOW availability is discovered (provider CLI, provider API, local runtime,
// or another mechanism) belongs to the Runtime Integration Layer
// (scripts/runtime-integration/*) — never to core workflow logic.
//
// Core workflow files MUST NOT directly invoke provider-specific discovery.
// Provider-specific code may exist ONLY behind this interface.
const path = require('node:path');

function parseEnvList() {
  const raw = process.env.AIW_AVAILABLE_MODELS || '';
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

function dedupe(list) {
  return [...new Set(list)];
}

// listAvailableModels(): exact model IDs currently available from the runtime.
// source: 'env-override' | 'integration-layer' | 'empty'
// - env-override: deterministic AIW_AVAILABLE_MODELS (tests, CI, operator pinning).
// - integration-layer: union of runtime-integration providers (best-effort).
// - empty: nothing reported → callers must fail closed.
function listAvailableModels() {
  const fromEnv = parseEnvList();
  if (fromEnv.length > 0) {
    return { models: dedupe(fromEnv), source: 'env-override' };
  }
  try {
    const integration = require('./runtime-integration');
    const models = dedupe(integration.listModels());
    return { models, source: models.length > 0 ? 'integration-layer' : 'empty' };
  } catch {
    return { models: [], source: 'empty' };
  }
}

function availabilitySet(availableModels) {
  if (Array.isArray(availableModels)) return new Set(availableModels);
  if (availableModels && Array.isArray(availableModels.models)) return new Set(availableModels.models);
  return new Set();
}

module.exports = { listAvailableModels, availabilitySet, MANIFEST_PATH: path.join(__dirname, '..', 'config', 'model-requirements.yml') };

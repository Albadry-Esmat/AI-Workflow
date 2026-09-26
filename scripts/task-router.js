#!/usr/bin/env node
'use strict';
// M5: Static task-class router — no LLM classifier in P1 (simplest first).
// OWNERSHIP: this router chooses WHAT executes (pipeline, agent, stage).
// It MUST NOT declare execution model IDs. The model manifest
// (config/model-requirements.yml) is the SINGLE authority for model policy:
// an optional per-task explicit override, else the global agent model, else
// the current runtime/session model (resolved through scripts/resolve-model.js
// — dependency, not duplication). A null task model means INHERIT, not
// missing. `tier_hint` is reporting metadata only and never resolves.
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const ROOT = path.resolve(__dirname, '..');
const ROUTER_PATH = path.join(ROOT, 'config', 'task-router.yaml');

function loadRouter() {
  return yaml.load(fs.readFileSync(ROUTER_PATH, 'utf8'));
}
function loadManifest() {
  return yaml.load(fs.readFileSync(path.join(ROOT, 'config', 'model-requirements.yml'), 'utf8'));
}
function route(template) {
  const router = loadRouter();
  const name = template || router.default_route;
  const r = router.routes[name];
  if (!r) throw new Error(`unknown template: ${name} (expected one of ${Object.keys(router.routes).join(', ')})`);
  // Drift prevention: the router must not independently author model IDs.
  for (const key of ['model', 'model_id']) {
    if (r[key] !== undefined) {
      throw new Error(`task-router: route '${name}' must not declare '${key}'; reference the manifest via model_requirement instead (single source of truth)`);
    }
  }
  const ref = r.model_requirement || `tasks.${name}`;
  const match = /^tasks\.(.+)$/.exec(ref);
  if (!match) throw new Error(`task-router: route '${name}' has invalid model_requirement '${ref}' (expected tasks.<name>)`);
  const manifest = loadManifest();
  const req = (manifest.tasks || {})[match[1]];
  if (!req) throw new Error(`task-router: model_requirement '${ref}' not found in model manifest`);
  // Inherit (null/absent model) is valid: resolution continues to the global
  // agent model, then the runtime/session model. Only malformed entries fail.
  const { validateEntry } = require('./resolve-model');
  validateEntry(req, ref);
  const model_id = req.model || null;
  return { template: name, pipeline: r.pipeline, agent: r.agent || null, model_requirement: ref, model_id, model: model_id, tier_hint: r.tier_hint || null, description: r.description };
}
module.exports = { route, loadRouter, loadManifest, ROUTER_PATH };

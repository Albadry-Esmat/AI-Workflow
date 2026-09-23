#!/usr/bin/env node
'use strict';
// M5: Static task-class router — no LLM classifier in P1 (simplest first).
// Maps --template quick-fix|feature-delivery|release-review to pipeline + model tier.
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const ROOT = path.resolve(__dirname, '..');
const ROUTER_PATH = path.join(ROOT, 'config', 'task-router.yaml');

function loadRouter() {
  return yaml.load(fs.readFileSync(ROUTER_PATH, 'utf8'));
}
function route(template) {
  const router = loadRouter();
  const name = template || router.default_route;
  const r = router.routes[name];
  if (!r) throw new Error(`unknown template: ${name} (expected one of ${Object.keys(router.routes).join(', ')})`);
  return { template: name, pipeline: r.pipeline, model_tier: r.model_tier, description: r.description };
}
module.exports = { route, loadRouter, ROUTER_PATH };

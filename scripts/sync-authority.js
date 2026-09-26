#!/usr/bin/env node
'use strict';
// sync-authority.js — T-P0-03: generate/validate authority projections.
// Single source: skills/registry.authority.yaml
// Projections: skills/registry.json (authority extension - future), skills/index.yaml tags (future)
// P0/P1: --check verifies source parses + required agents present + SoD invariants.
// --write currently no-ops (projections land in P3) but validates + writes drift report.
// Fail-closed on missing source or SoD violation.
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'skills', 'registry.authority.yaml');

const REQUIRED_AGENTS = ['primary','analyzer','architect','planner','reviewer','gatekeeper','builder','tester','deployer','impact-analyzer','test-generator','recovery','documenter','doc-maintainer','data-engineer','api-designer','distributed-systems','cloud-platform','security-specialist','sre','github-reviewer','merge-gatekeeper','investigation','issue-manager'];

function load() {
  if (!fs.existsSync(SRC)) {
    console.error(`FAIL: authority source missing: ${SRC}`);
    process.exit(1);
  }
  const doc = yaml.load(fs.readFileSync(SRC, 'utf8'));
  return doc;
}

function validate(doc) {
  const errors = [];
  if (!doc || doc.authority !== 'authoritative-capability-source') errors.push('authority field must be authoritative-capability-source');
  const agents = (doc && doc.agents) || {};
  for (const a of REQUIRED_AGENTS) {
    if (!agents[a]) { errors.push(`missing agent: ${a}`); continue; }
    const e = agents[a];
    if (!Array.isArray(e.capabilities) || e.capabilities.length === 0) errors.push(`${a}: capabilities required`);
    if (!Array.isArray(e.authority) || e.authority.length === 0) errors.push(`${a}: authority required`);
    if (!Array.isArray(e.separation_of_duty)) errors.push(`${a}: separation_of_duty required`);
  }
  // SoD invariants (P0 subset) + default-deny for unlisted agents
  const sod = (n) => ((agents[n]||{}).separation_of_duty||[]).join(' ');
  if (!sod('primary').includes('never-specialist')) errors.push('primary must declare never-specialist');
  if (!sod('builder').includes('never-gatekeeper')) errors.push('builder must declare never-gatekeeper');
  if (!sod('reviewer').includes('never-gatekeeper')) errors.push('reviewer must declare never-gatekeeper');
  if (!sod('gatekeeper').includes('never-builder')) errors.push('gatekeeper must declare never-builder');
  if (!sod('security-specialist').includes('never-builder')) errors.push('security-specialist must declare never-builder (cannot gate own implementation)');
  if (!sod('github-reviewer').includes('never-merger')) errors.push('github-reviewer must declare never-merger');
  if (doc.defaults?.routing_eligible !== false) errors.push('defaults.routing_eligible must be false (default deny for missing metadata)');
  return errors;
}

function main() {
  const args = process.argv.slice(2);
  const doc = load();
  const errors = validate(doc);
  if (errors.length) {
    for (const e of errors) console.error(`FAIL: ${e}`);
    process.exit(1);
  }
  if (args.includes('--check')) {
    console.log(`PASS: authority source valid (${REQUIRED_AGENTS.length} agents, SoD invariants hold, version ${doc.version})`);
    return;
  }
  if (args.includes('--write')) {
    // P0: projections deferred to P3; write drift report only (no registry mutation).
    const out = path.join(ROOT, 'artifacts', 'authority-drift-report.json');
    fs.mkdirSync(path.dirname(out), {recursive: true});
    fs.writeFileSync(out, JSON.stringify({version: doc.version, agents: Object.keys(doc.agents), projections: 'deferred-to-P3', checked_at: new Date().toISOString()}, null, 2));
    console.log(`PASS: authority validated; drift report written (projections deferred to P3): ${out}`);
    return;
  }
  console.log(`authority source OK (${Object.keys(doc.agents||{}).length} agents). Use --check or --write.`);
}
if (require.main === module) main();
module.exports = {};

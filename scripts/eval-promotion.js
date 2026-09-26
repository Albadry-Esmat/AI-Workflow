#!/usr/bin/env node
'use strict';
// eval-promotion.js — T-P1-03 promotion harness (metrics only, no authority change).
// Consumes artifacts/shadow-predictions.json, computes G0/G1 evidence.
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');

function main() {
  const p = path.join(ROOT, 'artifacts', 'shadow-predictions.json');
  if (!fs.existsSync(p)) { console.error('FAIL: run eval-router.js first'); process.exit(1); }
  const data = JSON.parse(fs.readFileSync(p, 'utf8'));
  const preds = data.predictions;
  const safety = preds.filter((x) => x.suite === 'safety');
  const general = preds.filter((x) => x.suite === 'general');
  // Safety invariants: zero FAST where floor GOVERNED
  const underRoutes = safety.filter((x) => x.predicted_profile === 'FAST');
  const prodFast = safety.filter((x) => /production|deploy/i.test(x.task) && x.predicted_profile === 'FAST');
  const secFast = safety.filter((x) => x.detector_triggers.includes('auth_authz') && x.predicted_profile === 'FAST');
  const migFast = safety.filter((x) => x.detector_triggers.includes('migration_schema') && x.predicted_profile === 'FAST');
  const floorBypass = safety.filter((x) => x.floor === 'GOVERNED' && x.predicted_profile === 'FAST');
  const disagreements = preds.filter((x) => x.predicted_profile !== x.floor && !(x.floor === 'GOVERNED' && x.predicted_profile === 'GOVERNED')).length;
  const falseFast = preds.filter((x) => x.predicted_profile === 'FAST' && x.floor === 'GOVERNED').length;
  const result = {
    generated_at: new Date().toISOString(),
    corpus: {general: general.length, safety: safety.length},
    safety_invariants: {
      governed_to_fast: underRoutes.length,
      production_to_fast: prodFast.length,
      security_to_fast: secFast.length,
      migration_to_fast: migFast.length,
      floor_bypass: floorBypass.length,
      pass: underRoutes.length === 0 && floorBypass.length === 0,
    },
    general_metrics: {
      disagreement_rate: Math.round((disagreements / preds.length) * 1000) / 1000,
      false_fast_rate: Math.round((falseFast / preds.length) * 1000) / 1000,
      coverage: preds.length,
      provenance_complete: preds.every((x) => x.provenance && x.provenance.classifier_version && x.provenance.prompt_hash),
    },
    promotion_ready: underRoutes.length === 0 && floorBypass.length === 0,
    note: 'PROMOTE requires safety pass + bound eval_hash/classifier_ver/floor_ver. No authority change in P0/P1.',
  };
  const dest = path.join(ROOT, 'artifacts', 'promotion-eval.json');
  fs.writeFileSync(dest, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  if (!result.promotion_ready) process.exitCode = 0; // P0/P1: report only, do not fail CI on shadow tuning
}
if (require.main === module) main();
module.exports = {};

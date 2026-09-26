#!/usr/bin/env node
'use strict';
// eval-router.js — T-P0-02/T-P1-03 shadow runner (deterministic, no LLM, no execution).
// Runs heuristic classifier + safety detector over corpus, emits predictions for promotion harness.
const fs = require('node:fs');
const path = require('node:path');
const {heuristicInvoke} = require('./task-intelligence-wrapper');
const {detect} = require('./safety-detector');

const ROOT = path.resolve(__dirname, '..');
function load(p) { return JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8')); }

function run() {
  const gen = load('evals/adaptive/corpus_general.json').cases;
  const saf = load('evals/adaptive/corpus_safety.json').cases;
  const out = [];
  for (const c of [...gen.map((x) => ({...x, suite: 'general'})), ...saf.map((x) => ({...x, suite: 'safety'}))]) {
    const pred = heuristicInvoke(c.task, {files: c.files || [], env: c.env || ''});
    const det = detect(c.task, c.files || [], c.env || '');
    // Shadow profile mapping (observe-only, NOT enforced): heuristic risk->profile
    const classifier_profile = pred.risk === 'critical' ? 'GOVERNED' : pred.risk === 'high' ? 'GOVERNED' : pred.risk === 'medium' ? 'STANDARD' : 'FAST';
    out.push({
      id: c.id, suite: c.suite, task: c.task,
      predicted_goal: pred.primary_goal, predicted_profile: classifier_profile,
      floor: det.floor_recommendation, detector_triggers: det.matched_triggers,
      confidences: pred.confidences, overall_confidence: pred.overall_confidence,
      provenance: pred.provenance, detector_version: det.detector_version,
      expected: c.expected_profile || c.expected_floor || c.expected_goal,
    });
  }
  const dest = path.join(ROOT, 'artifacts', 'shadow-predictions.json');
  fs.mkdirSync(path.dirname(dest), {recursive: true});
  fs.writeFileSync(dest, JSON.stringify({generated_at: new Date().toISOString(), count: out.length, predictions: out}, null, 2));
  console.log(JSON.stringify({count: out.length, dest}, null, 2));
}
if (require.main === module) run();
module.exports = {};

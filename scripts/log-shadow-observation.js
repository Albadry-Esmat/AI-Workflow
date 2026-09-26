#!/usr/bin/env node
'use strict';
// log-shadow-observation.js — G0 pre-req #2: version-bound live observation logger.
// Every record binds classifier/wrapper/detector/policy/schema/prompt/threshold/corpus versions.
// Mixing versions in one promotion window is rejected by eval-promotion (requires re-eval).
// Shadow-only: never routes, never enforces. Router authority always current-first-match.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {heuristicInvoke, WRAPPER_VERSION, CLASSIFIER_VERSION, SCHEMA_VERSION} = require('./task-intelligence-wrapper');
const {detect, DETECTOR_VERSION, POLICY_VERSION} = require('./safety-detector');

const ROOT = path.resolve(__dirname, '..');
const THRESH = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'g0-thresholds.json'), 'utf8'));
const CORPUS_VER = JSON.parse(fs.readFileSync(path.join(ROOT, 'evals', 'adaptive', 'corpus_version.json'), 'utf8'));

function legacyRoute(task) {
  // First-match table from .opencode/agent/primary.md (execution authority during observation).
  const t = String(task || '').toLowerCase();
  const has = (...ks) => ks.some((k) => t.includes(k));
  if (has('analyze requirements', 'extract requirements', 'what are the requirements')) return 'requirements-only.json';
  if (has('design the architecture', 'system design', 'define modules', 'tech stack')) return 'architecture-only.json';
  if (has('full pipeline', 'build this feature', 'new feature', 'idea to production', 'start the pipeline', 'run the pipeline', 'execute the full workflow', 'orchestrate')) return 'full-pipeline.json';
  if (has('security review', 'find vulnerabilities', 'threat modeling', 'is this secure', 'security audit')) return 'quick-review.json';
  if (has('review code', 'code review', 'code quality', 'solid', 'refactor', 'anti-patterns', 'is this clean code')) return 'quick-review.json';
  if (has('deploy', 'release', 'pre-deploy check', 'how do we deploy', 'ci/cd', 'rollback')) return 'pre-deploy.json';
  if (has('plan this feature', 'break this down', 'task breakdown', 'roadmap', 'sprint planning')) return 'full-pipeline.json:resume-feature-planning';
  if (has('report a bug', 'defect found', 'this is broken', 'bug report', 'create defect', 'log a defect')) return 'defect-lifecycle.json';
  if (has('change request', 'scope change', 'change the spec', 'update the requirements') || /\bcr\b/.test(t)) return 'change-request.json';
  if (has('export tasks', 'export work items', 'sync to jira', 'export to github')) return 'work-item-exporter';
  return 'fallback-ask-user';
}

function profileOf(risk) {
  return risk === 'critical' || risk === 'high' ? 'GOVERNED' : risk === 'medium' ? 'STANDARD' : 'FAST';
}

function logObservation({task, files = [], env = '', task_ref = {}, primary_category = 'unclassified', secondary_labels = [], population = 'live', actual_outcome = null}) {
  const started = Date.now();
  const classification = heuristicInvoke(task, {files, env});
  const detector = detect(task, files, env);
  const legacy_router_decision = legacyRoute(task);
  const classifier_profile = profileOf(classification.risk);
  const floor = detector.floor_recommendation;
  const strength = {FAST: 0, STANDARD: 1, GOVERNED: 2};
  const hypothetical_effective_profile = Object.keys(strength).reduce((a, b) => (strength[b] >= strength[a] ? b : a), classifier_profile && strength[floor] > strength[classifier_profile] ? floor : classifier_profile);
  const record = {
    observation_id: 'obs_' + crypto.randomBytes(8).toString('hex'),
    observed_at: new Date().toISOString(),
    population,
    primary_category,
    secondary_labels,
    task_ref,
    routing_facts: {
      legacy_router_decision,
      classifier_prediction: {primary_goal: classification.primary_goal, profile: classifier_profile, risk: classification.risk},
      detector_floor: {floor, triggers: detector.matched_triggers},
      hypothetical_effective_profile,
      note: 'Hypothetical effective is observe-only; never influences execution during P1.',
    },
    actual_outcome,
    classification,
    detector,
    versions: {
      classifier_version: CLASSIFIER_VERSION,
      wrapper_version: WRAPPER_VERSION,
      detector_version: `safety-detector-${DETECTOR_VERSION}`,
      policy_version: POLICY_VERSION,
      schema_version: SCHEMA_VERSION,
      prompt_hash: classification.provenance.prompt_hash,
      threshold_set_version: THRESH.threshold_set_version,
      corpus_version: CORPUS_VER.corpus_version,
    },
    router_authority: 'current-first-match',
    enforcement: 'none-shadow-observe-only',
    shadow_overhead_ms: Date.now() - started,
  };
  const dir = path.join(ROOT, 'artifacts', 'shadow-observations');
  fs.mkdirSync(dir, {recursive: true});
  fs.writeFileSync(path.join(dir, `${record.observation_id}.json`), JSON.stringify(record, null, 2));
  return record;
}

if (require.main === module) {
  const task = process.argv[2] || 'Change close icon spacing';
  const files = (process.argv[3] || '').split(',').filter(Boolean);
  console.log(JSON.stringify(logObservation({task, files}), null, 2));
}
module.exports = {logObservation};

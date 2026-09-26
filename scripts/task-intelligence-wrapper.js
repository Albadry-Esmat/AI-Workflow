#!/usr/bin/env node
'use strict';
// task-intelligence-wrapper.js — T-P1-01 deterministic wrapper (pure function) + heuristic shadow invocation.
// Wrapper: normalize input, extract deterministic signals, validate, aggregate confidences, attach provenance.
// Invocation (P1): heuristic stub v0.1.0-shadow (keyword + pattern based, NO LLM, NO execution authority).
// Every prediction records classifier_version/prompt_hash/schema_version/provider/model/resolution_source/policy/detector/wrapper versions.
const crypto = require('node:crypto');

const WRAPPER_VERSION = '0.1.1';
const CLASSIFIER_VERSION = 'heuristic-shadow-0.1.1';
const SCHEMA_VERSION = '1.0.0';

function sha12(s) { return crypto.createHash('sha256').update(s, 'utf8').digest('hex').slice(0, 12); }

function normalize(raw) {
  return String(raw || '').toLowerCase();
}

// Deterministic signal extraction (no LLM)
function extractSignals(raw, files = [], env = '') {
  const t = normalize(raw);
  const has = (...ks) => ks.some((k) => t.includes(k));
  return {
    isBug: has('bug', 'null', 'exception', 'stacktrace', 'failing test', 'broken'),
    isSecurity: has('auth', 'login', 'permission', 'secret', 'token', 'owasp', 'vuln', 'security', 'rbac', 'role'),
    isDeploy: has('deploy', 'production', 'release', 'rollback'),
    isDB: has('migration', 'schema', 'database', 'sql', 'dataverse'),
    isUI: has('button', 'padding', 'css', 'icon', 'spacing', 'component', 'screen'),
    isReview: has('review', 'refactor', 'solid', 'anti-pattern'),
    isArch: has('architecture', 'redesign', 'runtime', 'provider'),
    isDestructive: has('delete', 'drop', 'destroy', 'rm -rf', 'destructive', 'cleanup'),
    isBreaking: has('breaking', 'incompatible', 'contract'),
    isGovernance: has('governance', 'gate timeout', 'policy', 'opencode.json', 'permission'),
    files, env,
  };
}

// Heuristic shadow invocation (P1 only, predicts, never routes)
function heuristicInvoke(raw, opts = {}) {
  const files = opts.files || [];
  const env = opts.env || '';
  const s = extractSignals(raw, files, env);
  const intents = [];
  if (s.isBug) intents.push('bug_fix');
  if (s.isSecurity) intents.push('security');
  if (s.isDeploy) intents.push('deploy');
  if (s.isReview) intents.push('review');
  if (s.isArch) intents.push('architecture');
  if (s.isUI) intents.push('ui_change');
  if (intents.length === 0) intents.push('feature');
  let primary_goal = intents[0];
  if (s.isBug && /stacktrace|failing test|null/.test(normalize(raw))) primary_goal = 'bug_fix';
  if (s.isDeploy && /approve deploy|production/.test(normalize(raw))) primary_goal = 'deploy';
  const complexity = s.isArch || s.isDB ? 'large' : s.isBug && s.isSecurity ? 'medium' : s.isDestructive || s.isBreaking || s.isGovernance ? 'medium' : s.isUI && intents.length === 1 ? 'tiny' : 'small';
  const risk = s.isDeploy || /production/.test(normalize(raw)) ? 'critical' : s.isSecurity || s.isDB || s.isDestructive || s.isBreaking || s.isGovernance ? 'high' : s.isBug ? 'medium' : 'low';
  const scope = files.length <= 1 && s.isUI ? 'component' : s.isArch ? 'cross_module' : 'module';
  const blast_radius = /production/.test(normalize(raw)) ? 'production' : s.isDB ? 'platform' : s.isArch ? 'cross_module' : s.isUI ? 'local' : 'module';
  const required_capabilities = [
    ...(s.isUI ? ['ui_design'] : []),
    ...(s.isDB ? ['relational_schema'] : []),
    ...(['bug_fix', 'feature'].includes(primary_goal) ? ['typescript'] : []),
    ...(['bug_fix'].includes(primary_goal) ? ['testing'] : []),
  ];
  const confidences = {
    intent: 0.82, primary_goal: primary_goal === 'bug_fix' || primary_goal === 'deploy' ? 0.94 : 0.78,
    risk: s.isSecurity || s.isDeploy ? 0.77 : 0.85,
    blast_radius: 0.83, scope: 0.86, capabilities: 0.90, architecture_impact: s.isArch ? 0.79 : 0.88,
  };
  const overall = Math.min(confidences.primary_goal, confidences.intent);
  const prompt = `shadow-classify:${CLASSIFIER_VERSION}:${normalize(raw).slice(0, 200)}`;
  return {
    intent: intents, primary_goal, complexity, risk, scope, blast_radius,
    required_capabilities, requires_code_change: !s.isReview || s.isBug, requires_deployment: s.isDeploy,
    uncertainty: {requirements: 'medium', architecture: s.isArch ? 'high' : 'low'},
    confidences, overall_confidence: Math.round(overall * 100) / 100,
    provenance: {
      classifier_version: CLASSIFIER_VERSION, prompt_hash: 'sha12:' + sha12(prompt),
      schema_version: SCHEMA_VERSION, provider: 'none-heuristic', model: 'heuristic-shadow-0.1.0',
      resolution_source: 'deterministic-stub', policy_version: 'governance-2.6.0',
      detector_version: 'safety-detector-0.1.0', wrapper_version: WRAPPER_VERSION,
    },
  };
}

if (require.main === module) {
  const raw = process.argv[2] || '';
  const files = (process.argv[3] || '').split(',').filter(Boolean);
  console.log(JSON.stringify(heuristicInvoke(raw, {files}), null, 2));
}
module.exports = {heuristicInvoke, extractSignals, WRAPPER_VERSION, CLASSIFIER_VERSION, SCHEMA_VERSION};

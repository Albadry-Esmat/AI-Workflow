#!/usr/bin/env node
'use strict';
// safety-detector.js — T-P1-02 independent deterministic detector (observe-only).
// Inputs: raw task text + repo diff file list + env. Outputs floor signals + floor_recommendation.
// Never enforces; enforcement lives behind FLAG_FLOOR_ENFORCE (OFF in P0/P1).
const DETECTOR_VERSION = '0.1.0';
const POLICY_VERSION = 'governance-2.6.0';

const RULES = [
  {signal: 'auth_authz', patterns: [/auth/i, /login/i, /permission/i, /sso/i, /saml/i, /rbac/i]},
  {signal: 'secrets', patterns: [/secret/i, /token/i, /credential/i, /api[_-]?key/i, /\.env/i]},
  {signal: 'migration_schema', patterns: [/migration/i, /schema/i, /db\//i, /\.sql/i, /dataverse/i]},
  {signal: 'production', patterns: [/production/i, /\bprod\b/i]},
  {signal: 'deployment', patterns: [/deploy/i, /release/i, /rollback/i, /canary/i, /blue-green/i]},
  {signal: 'destructive', patterns: [/delete/i, /drop/i, /destroy/i, /rm -rf/i, /reset --hard/i]},
  {signal: 'governance_policy', patterns: [/governance\.md/i, /policy/i, /gate-decisions/i, /opencode\.json/i]},
  {signal: 'dependency_change', patterns: [/package\.json/i, /package-lock/i, /requirements.*\.txt/i, /Dockerfile/i]},
  {signal: 'network_boundary', patterns: [/websocket/i, /webhook/i, /external.*api/i, /network/i]},
  {signal: 'breaking_api', patterns: [/breaking/i, /v2.*migrat/i, /incompatible/i, /contract.*change/i]},
  {signal: 'permissions_change', patterns: [/chmod/i, /permission.*change/i, /role.*change/i]},
];

function detect(raw = '', files = [], env = '') {
  const hay = `${raw}\n${files.join('\n')}\n${env}`;
  const signals = RULES.map((r) => {
    const hit = r.patterns.find((p) => p.test(hay));
    return {signal: r.signal, matched: Boolean(hit), evidence: hit ? String(hit) : 'no-match'};
  });
  const gov = signals.filter((s) => s.matched).map((s) => s.signal);
  const needsGoverned = gov.some((g) => ['auth_authz','secrets','migration_schema','production','deployment','destructive','governance_policy','breaking_api'].includes(g));
  const needsStandard = gov.length > 0;
  return {
    signals,
    floor_recommendation: needsGoverned ? 'GOVERNED' : needsStandard ? 'STANDARD' : 'FAST',
    matched_triggers: gov,
    detector_version: `safety-detector-${DETECTOR_VERSION}`,
    policy_version: POLICY_VERSION,
  };
}

if (require.main === module) {
  const raw = process.argv[2] || '';
  const files = (process.argv[3] || '').split(',').filter(Boolean);
  console.log(JSON.stringify(detect(raw, files, process.argv[4] || ''), null, 2));
}
module.exports = {detect, DETECTOR_VERSION, POLICY_VERSION};

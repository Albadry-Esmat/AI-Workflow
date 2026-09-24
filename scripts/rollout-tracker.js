#!/usr/bin/env node
'use strict';
// Stage tracker (S) — evaluates promotion/demotion from measured metrics.
// Promotion requires a human decision; demotion triggers automatically on signals.
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const ROOT = path.resolve(__dirname, '..');
const STATE_PATH = path.join(ROOT, 'artifacts', 'rollout.json');

function loadPolicy() {
  return yaml.load(fs.readFileSync(path.join(ROOT, 'config', 'rollout-policy.yml'), 'utf8'));
}
function readState() {
  if (!fs.existsSync(STATE_PATH)) {
    return { stage: 'shadow', since: new Date().toISOString().slice(0, 10), history: [] };
  }
  return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
}
function writeState(state) {
  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}
// metrics: { days, prs, autonomy_rate, policy_violations, incorrect_gatekeeper_decisions,
//   critical_escape_bugs, incorrect_auto_merge, rollback_rate, critical_incident, budget_runaway }
function evaluate(metrics) {
  const policy = loadPolicy();
  const state = readState();
  const demote = state.stage === 'autonomous_merge'
    ? checkDemote(policy.demote_merge_to_shadow, metrics)
    : state.stage === 'continuous_engineering'
      ? checkDemote(policy.demote_continuous_to_merge, metrics)
      : null;
  if (demote) return { action: 'demote', reason: demote, from: state.stage };
  const promote = state.stage === 'shadow'
    ? checkPromote(policy.promote_shadow_to_merge, metrics)
    : state.stage === 'autonomous_merge'
      ? checkPromote(policy.promote_merge_to_continuous, metrics)
      : null;
  if (promote === true) return { action: 'promote-eligible', reason: 'all thresholds met; human decision required', from: state.stage };
  return { action: 'hold', reason: promote || 'thresholds not met', from: state.stage };
}
function checkDemote(rule, m) {
  if (rule.critical_escape_bug && m.critical_escape_bugs > 0) return 'critical escape bug';
  if (rule.policy_violation && m.policy_violations > 0) return 'policy violation';
  if (rule.incorrect_auto_merge && m.incorrect_auto_merge > 0) return 'incorrect auto-merge';
  if (rule.rollback_rate_above !== undefined && (m.rollback_rate || 0) > rule.rollback_rate_above) return 'rollback rate above threshold';
  if (rule.critical_incident && m.critical_incident) return 'critical incident';
  if (rule.budget_runaway && m.budget_runaway) return 'budget runaway';
  return null;
}
function checkPromote(rule, m) {
  const unmet = [];
  if ((m.days || 0) < rule.minimum_days) unmet.push(`days ${m.days || 0}/${rule.minimum_days}`);
  if ((m.prs || 0) < rule.minimum_prs) unmet.push(`prs ${m.prs || 0}/${rule.minimum_prs}`);
  if ((m.autonomy_rate || 0) < rule.autonomy_rate) unmet.push(`autonomy ${m.autonomy_rate || 0}/${rule.autonomy_rate}`);
  if ((m.policy_violations || 0) > rule.policy_violations) unmet.push('policy violations > 0');
  if ((m.incorrect_gatekeeper_decisions || 0) > (rule.incorrect_gatekeeper_decisions || 0)) unmet.push('incorrect gatekeeper decisions > 0');
  if ((m.critical_escape_bugs || 0) > (rule.critical_escape_bugs || 0)) unmet.push('critical escape bugs > 0');
  return unmet.length ? `unmet: ${unmet.join(', ')}` : true;
}
module.exports = { evaluate, readState, writeState, loadPolicy };
if (require.main === module) {
  const metrics = process.argv[2] ? JSON.parse(process.argv[2]) : {};
  console.log(JSON.stringify(evaluate(metrics), null, 2));
}

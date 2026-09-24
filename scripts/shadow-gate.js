#!/usr/bin/env node
'use strict';
// Shadow gatekeeper (P3) — post-hoc evaluation: recompute MERGE_ALLOWED/BLOCKED
// from recorded case state WITHOUT merging. Measures gatekeeper agreement while
// humans still press merge. Feeds autonomy_rate + incorrect_gatekeeper_decisions.
const { readCase, readEvents } = require('./case-store');

function shadowEvaluate(caseId) {
  const state = readCase(caseId);
  const events = readEvents(caseId);
  const reasons = [];
  const checks = {
    hasApproveVerdict: events.some((e) => e.event === 'PR_REVIEW_PUBLISHED' && e.verdict === 'approve'),
    noBlockingFindings: !events.some((e) => e.event === 'FINDING_RECORDED' && e.blocking_level === 'BLOCKING' && !e.resolved),
    cyclesWithinLimit: (state.fixCycles || 0) <= 3,
    noPolicyViolation: !events.some((e) => e.event === 'POLICY_VIOLATION'),
  };
  if (!checks.hasApproveVerdict) reasons.push('no approve verdict recorded');
  if (!checks.noBlockingFindings) reasons.push('unresolved blocking findings');
  if (!checks.cyclesWithinLimit) reasons.push('fix cycles exceeded');
  if (!checks.noPolicyViolation) reasons.push('policy violation recorded');
  return {
    case_id: state.case_id,
    decision: reasons.length ? 'MERGE_BLOCKED' : 'MERGE_ALLOWED',
    reasons: reasons.length ? reasons : ['all shadow conditions satisfied'],
    evaluated_at: new Date().toISOString(),
  };
}
module.exports = { shadowEvaluate };
if (require.main === module) {
  const id = process.argv[2];
  if (!id) { console.error('Usage: shadow-gate.js <case-id>'); process.exit(2); }
  console.log(JSON.stringify(shadowEvaluate(id), null, 2));
}

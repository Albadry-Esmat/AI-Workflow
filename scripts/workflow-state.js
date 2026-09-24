#!/usr/bin/env node
'use strict';
// Executable case state machine (P2) — single source of truth for work-item states.
// Forbidden transitions throw; fix cycles cap at 3 (budget-policy); exhaustion escalates.
const TRANSITIONS = {
  READY: ['ANALYZING', 'CANCELLED'],
  ANALYZING: ['PLANNING', 'ESCALATED', 'CANCELLED'],
  PLANNING: ['PLAN_VALIDATION', 'ESCALATED', 'CANCELLED'],
  PLAN_VALIDATION: ['PLANNED', 'PLANNING', 'ESCALATED', 'CANCELLED'],
  PLANNED: ['IMPLEMENTING', 'ESCALATED', 'CANCELLED'],
  IMPLEMENTING: ['SELF_REVIEW', 'ESCALATED', 'CANCELLED'],
  SELF_REVIEW: ['VALIDATING', 'IMPLEMENTING', 'ESCALATED'],
  VALIDATING: ['VERIFIED', 'IMPLEMENTING', 'ESCALATED'],
  VERIFIED: ['PR_CREATED', 'ESCALATED'],
  PR_CREATED: ['REVIEW', 'ESCALATED'],
  REVIEW: ['GATED', 'FIXING', 'INVESTIGATING', 'ESCALATED'],
  FIXING: ['VALIDATING', 'ESCALATED'],
  INVESTIGATING: ['REVIEW', 'ESCALATED'],
  GATED: ['MERGING', 'REVIEW', 'ESCALATED'],
  MERGING: ['POST_MERGE_VERIFY', 'ESCALATED'],
  POST_MERGE_VERIFY: ['DONE', 'ESCALATED'],
  DONE: [],
  ESCALATED: ['READY', 'FIXING', 'CANCELLED'],
  CANCELLED: [],
};
const MAX_FIX_CYCLES = 3;

function canTransition(from, to) {
  return (TRANSITIONS[from] || []).includes(to);
}
// Entering REVIEW from FIXING consumes one fix cycle; cap enforced here.
function transition(caseState, to, { actor = 'orchestrator' } = {}) {
  const from = caseState.state;
  if (!canTransition(from, to)) {
    throw new Error(`FORBIDDEN_TRANSITION: ${from} -> ${to}`);
  }
  let fixCycles = caseState.fixCycles || 0;
  if (from === 'FIXING' && to === 'VALIDATING') {
    fixCycles += 1;
    if (fixCycles > MAX_FIX_CYCLES) {
      throw new Error(`FIX_CYCLE_EXHAUSTED: ${fixCycles} > ${MAX_FIX_CYCLES} — must ESCALATE`);
    }
  }
  return { ...caseState, state: to, fixCycles, updatedAt: new Date().toISOString(), updatedBy: actor };
}
module.exports = { TRANSITIONS, MAX_FIX_CYCLES, canTransition, transition };

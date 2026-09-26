#!/usr/bin/env node
'use strict';
// Phase B — Single authoritative path for high-stakes decision consumption.
//
// Flow: action request → subject (derived, never trusted from caller) →
// execution (launcher context) → decision_id presented → resolve → binding
// (gate/subject/execution) → decision-kind + class check → principal
// authority → single-use consumption → evidence → action.
//
// Delegates ALL registry semantics to gate-decisions.js (no duplication).
// The registry itself is read-reusable; THIS module adds the single-use
// consumption marker high-stakes advancement requires, stored as an
// append-only log beside the registry (hash chain untouched).
//
// Fail-closed: any missing/mismatched/expired/unauthorized/consumed decision
// throws with code GATE_DECISION_BLOCKED. Callers must catch, report one
// actionable error, and exit non-zero with no partial advancement.
const fs = require('node:fs');
const path = require('node:path');
const gd = require('./gate-decisions');
const { withLock } = require('./file-lock');

// §0: consumption state is scoped to the exact registry file (not its
// directory): <registry>.consumptions.jsonl. Two registries sharing a
// directory can never observe or collide on each other's consumption marks;
// decision ids are registry-local by construction. Atomicity via withLock on
// the consumption file itself; check-then-append inside the lock.
function consumptionsPath() {
  const reg = gd.registryPath();
  const base = reg.endsWith('.jsonl') ? reg.slice(0, -'.jsonl'.length) : reg;
  return `${base}.consumptions.jsonl`;
}

function readConsumptions() {
  const p = consumptionsPath();
  if (!fs.existsSync(p)) return [];
  try {
    return fs.readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  } catch (err) {
    // Corrupt consumption state fails closed downstream (treated as
    // unverifiable replay state, never as unconsumed).
    const e = new Error(`consumption log unreadable: ${err.message}`);
    e.code = 'GATE_DECISION_BLOCKED';
    e.reason = 'replay-unverifiable';
    throw e;
  }
}

// markConsumed(): atomic single-use claim. Returns the marker, or throws
// ALREADY_CONSUMED when this decision authorized an action before. Replay
// beyond the original scope is therefore impossible by construction.
function markConsumed(decisionId, { executionId, action, gateId }) {
  return withLock(consumptionsPath(), () => {
    const existing = readConsumptions().find((c) => c.decision_id === decisionId);
    if (existing) {
      const err = new Error(
        `gate decision ${decisionId} already consumed by execution '${existing.consumed_by_execution}' for action '${existing.action}' at ${existing.consumed_at}; replay refused`
      );
      err.code = 'GATE_DECISION_BLOCKED';
      err.reason = 'already-consumed';
      throw err;
    }
    const marker = {
      decision_id: decisionId,
      consumed_by_execution: executionId,
      action,
      gate_id: gateId,
      consumed_at: new Date().toISOString(),
    };
    fs.mkdirSync(path.dirname(consumptionsPath()), { recursive: true });
    fs.appendFileSync(consumptionsPath(), JSON.stringify(marker) + '\n', 'utf8');
    return marker;
  });
}

function block(reason, detail) {
  const err = new Error(`gate authorization failed (${reason}): ${detail}`);
  err.code = 'GATE_DECISION_BLOCKED';
  err.reason = reason;
  return err;
}

// requireGateDecision(): the ONLY entry point for high-stakes advancement.
// Params:
//   decisionId   presented registry id (never a bearer object)
//   gateId       expected gate, e.g. 'release'
//   gateClass    expected class, e.g. 'release' (must match record)
//   action       governed action name for evidence/consumption, e.g. 'release-attest'
//   subjectHash  DERIVED subject hash (caller derives from the governed subject)
//   subjectKind  expected subject kind, e.g. 'repo_head'
//   executionId  canonical execution id from launcher context (not CLI trust)
//   requester    Phase A agent_identity of the requesting execution (evidence)
//   sod          optional { producers, reviewer, gateRole }: Phase C separation-
//                of-duties evidence. Validated BEFORE consumption so a failed
//                SoD check never burns the single-use decision. Omitted →
//                Phase B behavior (no SoD check; caller documents why).
// Returns { record, consumption, sod } for evidence binding.
function requireGateDecision({ decisionId, gateId, gateClass, action, subjectHash, subjectKind, executionId, requester = null, sod = null }) {
  if (!decisionId || typeof decisionId !== 'string') {
    throw block('decision-missing', `action '${action}' requires a gate decision id (boolean flags and approval tokens do not authorize high-stakes actions)`);
  }
  if (!subjectHash || typeof subjectHash !== 'string') {
    throw block('subject-missing', `action '${action}' requires a derived subject hash; caller-supplied hashes are never trusted`);
  }
  if (!executionId || typeof executionId !== 'string') {
    throw block('execution-missing', `action '${action}' requires the canonical execution id from launcher context`);
  }
  const r = gd.resolve(decisionId, { gate_id: gateId, execution_id: executionId, subject_hash: subjectHash });
  if (!r.valid) throw block('decision-invalid', r.reason);
  const rec = r.record;
  if (rec.decision !== 'approve') {
    throw block('decision-kind', `decision '${decisionId}' is '${rec.decision}'; high-stakes advancement requires 'approve'`);
  }
  if (gateClass && rec.gate_class !== gateClass) {
    throw block('decision-class', `decision class '${rec.gate_class || '(none)'}' cannot authorize '${gateClass}' action '${action}'`);
  }
  if (subjectKind && rec.subject_kind !== subjectKind) {
    throw block('subject-kind', `decision subject_kind '${rec.subject_kind}' does not govern '${subjectKind}'`);
  }
  // Authority: whatever the registry requires (authenticated humans for
  // high-stakes classes). role:null gains nothing — authority is principal-
  // based, and unknown roles are never privileged. No SoD rules here (Phase C).
  const auth = gd.authorizeForGate(rec, gateClass || rec.gate_class);
  if (!auth.allowed) throw block('principal-unauthorized', auth.reason);
  // Phase C: SoD BEFORE consumption — a failed independence check must not
  // burn an otherwise valid single-use decision.
  let sodResult = null;
  if (sod !== null && sod !== undefined) {
    const duties = require('./separation-of-duties');
    sodResult = duties.evaluate({
      subjectHash,
      producers: sod.producers,
      reviewer: sod.reviewer,
      gatePrincipal: rec.principal,
      gateRole: sod.gateRole,
    });
    if (!sodResult.allowed) {
      const err = block('sod-violation', `separation of duties failed: ${sodResult.codes.join(', ')}`);
      err.sod = sodResult;
      throw err;
    }
  }
  const consumption = markConsumed(decisionId, { executionId, action, gateId });
  return { record: rec, consumption, sod: sodResult };
}

module.exports = { requireGateDecision, markConsumed, consumptionsPath };

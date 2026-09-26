#!/usr/bin/env node
'use strict';
// Phase A — Canonical execution identity (attribution foundation, NOT authorization).
//
// Answers: who performed this action, in what role, during which execution,
// and under which parent execution/context? Later phases (SoD, gate wiring)
// consume this; nothing here decides whether the principal was AUTHORIZED.
//
// Principal shape reuses the gate-decisions canonical form:
//   { type: 'human'|'agent'|'system', id, authenticated, source }
// No competing representation is introduced. `agent_identity` (the trace
// evidence field) carries the full envelope; its legacy `{agent}`-only form
// is still accepted by readers but classified as legacy (never authenticated).
//
// Envelope (identity_version 1):
//   { identity_version, agent, principal, role, execution_id,
//     parent_execution_id, worker, source }
//   principal ≠ role ≠ execution: who vs function vs instance. Workers share
//   the parent's agent/role but are distinguished by execution_id + worker
//   index while retaining parent_execution_id lineage.
//
// Launcher assigns → downstream consumes. No downstream component may invent
// or rewrite identity; validation is strict (unknown keys rejected) so callers
// cannot smuggle nested fields over launcher-owned ones.
//
// Human boundary: this module performs NO authentication. Human principals
// are recorded exactly as claimed with authenticated:false. Only the
// gate-decisions registry may record authenticated humans (later phase).

const IDENTITY_VERSION = 1;

const PRINCIPAL_TYPES = new Set(['human', 'agent', 'system']);

// Minimum explicit role taxonomy, mirroring documented agent functions.
// Agents absent from this map get role:null (explicitly unknown — never
// fabricated). Only roles required for deterministic SoD authorization are
// mapped (reviewer/gatekeeper/orchestrator/developer + route agents);
// taxonomy expansion belongs to a later governance phase.
const ROLE_BY_AGENT = {
  analyzer: 'analyzer',
  planner: 'planner',
  reviewer: 'reviewer',
  'github-reviewer': 'reviewer',
  gatekeeper: 'gatekeeper',
  'merge-gatekeeper': 'gatekeeper',
  primary: 'orchestrator',
  orchestrator: 'orchestrator',
  builder: 'developer',
  'test-generator': 'developer',
};

// SoD policy roles: the only roles accepted as authoritative reviewer /
// gatekeeper. Orchestrator is deliberately absent (coordinates only).
const REVIEWER_ROLES = new Set(['reviewer']);
const GATEKEEPER_ROLES = new Set(['gatekeeper']);

const ENVELOPE_KEYS = new Set([
  'identity_version', 'agent', 'principal', 'role',
  'execution_id', 'parent_execution_id', 'worker', 'source',
]);

function roleForAgent(agent) {
  return Object.prototype.hasOwnProperty.call(ROLE_BY_AGENT, agent) ? ROLE_BY_AGENT[agent] : null;
}

// Canonical principal constructor. Human principals are ALWAYS recorded
// authenticated:false here (claimed, not authenticated — see header).
function createPrincipal(type, id, source) {
  if (!PRINCIPAL_TYPES.has(type)) {
    throw new Error(`execution-identity: principal type must be one of ${[...PRINCIPAL_TYPES].join('|')} (got ${JSON.stringify(type)})`);
  }
  if (typeof id !== 'string' || id.length === 0) {
    throw new Error('execution-identity: principal id must be a non-empty string');
  }
  if (typeof source !== 'string' || source.length === 0) {
    throw new Error('execution-identity: principal source must be a non-empty string');
  }
  return { type, id, authenticated: false, source };
}

function validatePrincipal(p, where) {
  if (!p || typeof p !== 'object' || Array.isArray(p)) {
    throw new Error(`execution-identity: principal must be an object at ${where}`);
  }
  for (const k of Object.keys(p)) {
    if (!['type', 'id', 'authenticated', 'source'].includes(k)) {
      throw new Error(`execution-identity: unknown principal field '${k}' at ${where}`);
    }
  }
  const canonical = createPrincipal(p.type, p.id, p.source);
  if (p.type === 'human' && p.authenticated === true) {
    throw new Error(`execution-identity: human principal must not claim authenticated:true at ${where} (claimed, not authenticated)`);
  }
  canonical.authenticated = p.authenticated === true && p.type !== 'human';
  return canonical;
}

// Launcher execution identity: the agent a route dispatches, in this thread.
function createLauncherIdentity({ agent, executionId, source }) {
  if (typeof agent !== 'string' || agent.length === 0) {
    throw new Error('execution-identity: agent must be a non-empty string');
  }
  if (typeof executionId !== 'string' || executionId.length === 0) {
    throw new Error('execution-identity: executionId must be a non-empty string');
  }
  return {
    identity_version: IDENTITY_VERSION,
    agent,
    principal: createPrincipal('agent', agent, source),
    role: roleForAgent(agent),
    execution_id: executionId,
    parent_execution_id: null,
    worker: null,
    source,
  };
}

// Worker identity: same agent/role as the parent route, distinguished by a
// stable execution-scoped worker thread id, with explicit parent lineage.
function createWorkerIdentity({ agent, parentExecutionId, workerIndex, source }) {
  if (!Number.isInteger(workerIndex) || workerIndex < 0) {
    throw new Error('execution-identity: workerIndex must be a non-negative integer');
  }
  if (typeof parentExecutionId !== 'string' || parentExecutionId.length === 0) {
    throw new Error('execution-identity: parentExecutionId must be a non-empty string');
  }
  const workerId = `${parentExecutionId}-w${workerIndex}`;
  return {
    identity_version: IDENTITY_VERSION,
    agent,
    principal: createPrincipal('agent', agent, source),
    role: roleForAgent(agent),
    execution_id: workerId,
    parent_execution_id: parentExecutionId,
    worker: { index: workerIndex, id: workerId },
    source,
  };
}

// Orchestrator identity: the fan-out coordinator itself (distinct role from
// the workers it spawns, same parent execution scope).
function createOrchestratorIdentity({ executionId, source }) {
  return {
    identity_version: IDENTITY_VERSION,
    agent: 'orchestrator',
    principal: createPrincipal('agent', 'orchestrator', source),
    role: 'orchestrator',
    execution_id: executionId,
    parent_execution_id: null,
    worker: null,
    source,
  };
}

// Strict validation: rejects malformed envelopes AND unknown keys, so nested
// smuggling over launcher-owned fields fails closed instead of merging.
function validateAgentIdentity(value, where = 'agent_identity') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`execution-identity: ${where} must be an object`);
  }
  for (const k of Object.keys(value)) {
    if (!ENVELOPE_KEYS.has(k)) {
      throw new Error(`execution-identity: unknown identity field '${k}' at ${where} (smuggled fields rejected)`);
    }
  }
  if (value.identity_version !== IDENTITY_VERSION) {
    throw new Error(`execution-identity: ${where}.identity_version must be ${IDENTITY_VERSION}`);
  }
  if (typeof value.agent !== 'string' || value.agent.length === 0) {
    throw new Error(`execution-identity: ${where}.agent must be a non-empty string`);
  }
  const principal = validatePrincipal(value.principal, `${where}.principal`);
  if (principal.id !== value.agent) {
    throw new Error(`execution-identity: ${where}.principal.id must match agent (no identity substitution)`);
  }
  if (value.role !== null && typeof value.role !== 'string') {
    throw new Error(`execution-identity: ${where}.role must be a string or null`);
  }
  if (typeof value.execution_id !== 'string' || value.execution_id.length === 0) {
    throw new Error(`execution-identity: ${where}.execution_id must be a non-empty string`);
  }
  if (value.parent_execution_id !== null && typeof value.parent_execution_id !== 'string') {
    throw new Error(`execution-identity: ${where}.parent_execution_id must be a string or null`);
  }
  if (value.worker !== null) {
    if (typeof value.worker !== 'object' || !Number.isInteger(value.worker.index) || value.worker.index < 0 || typeof value.worker.id !== 'string') {
      throw new Error(`execution-identity: ${where}.worker must be {index >= 0, id} or null`);
    }
    if (value.worker.id !== value.execution_id) {
      throw new Error(`execution-identity: ${where}.worker.id must equal execution_id`);
    }
  }
  if (typeof value.source !== 'string' || value.source.length === 0) {
    throw new Error(`execution-identity: ${where}.source must be a non-empty string`);
  }
  return { ...value, principal };
}

// Evidence classifier for backward compatibility: 'canonical' (v1, valid),
// 'legacy' ({agent}-only, pre-Phase-A), or 'unknown' (anything else).
// Legacy/unknown must NEVER be interpreted as authenticated/authorized.
function describeIdentity(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 'unknown';
  if (value.identity_version === IDENTITY_VERSION) {
    try {
      validateAgentIdentity(value);
      return 'canonical';
    } catch {
      return 'unknown';
    }
  }
  // A version claim that is not v1 is untrusted ('unknown'), not legacy:
  // legacy means the pre-Phase-A shape with no version key at all.
  if (value.identity_version !== undefined) return 'unknown';
  if (typeof value.agent === 'string' && value.agent.length > 0) return 'legacy';
  return 'unknown';
}

module.exports = {
  IDENTITY_VERSION,
  PRINCIPAL_TYPES,
  ROLE_BY_AGENT,
  REVIEWER_ROLES,
  GATEKEEPER_ROLES,
  roleForAgent,
  createPrincipal,
  validatePrincipal,
  createLauncherIdentity,
  createWorkerIdentity,
  createOrchestratorIdentity,
  validateAgentIdentity,
  describeIdentity,
};

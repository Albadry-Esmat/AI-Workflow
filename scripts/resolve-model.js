#!/usr/bin/env node
'use strict';
// AI Workflow — Deterministic model resolver (v2: precedence with inheritance).
//
// Authority: config/model-requirements.yml.
// Precedence (highest wins, deterministic):
//   Agent/task-specific explicit model → Global agent model → Current
//   runtime/session model.
//
// Semantics:
// - INHERIT (model absent/null) means "continue to the lower-priority
//   source". It is NOT fallback — using the runtime model is normal.
// - EXPLICIT (exact provider/model id) means "require exactly this model".
//   Declared `fallbacks` (when present) are the ONLY approved substitutes,
//   honored in manifest order. Anything else is forbidden.
// - After selection, the exact selected model MUST be verified against the
//   live runtime catalog. Available → execute; missing → BLOCK.
// - An unavailable EXPLICIT override NEVER falls back to global/runtime/
//   another provider. It fails closed.
// - A missing runtime/session model with no overrides fails closed:
//   "No model override is configured and no current runtime model could be
//   resolved." The catalog's first entry is never guessed.
//
// Resolution record (no credentials, ever):
//   model_requirement, requested_agent_override, global_override,
//   runtime_model, runtime_model_source, requested_model_id (legacy alias),
//   selected_model_id, selection_source (agent_override|global_override|
//   runtime), explicit_override (bool), provider, fallback_used,
//   fallback_reason, fallback_index, declared_candidates,
//   availability_source, availability_verified, resolution_result
//   (resolved|fallback|fail_closed).
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(ROOT, 'config', 'model-requirements.yml');

const VAGUE_TOKENS = new Set(['cheap', 'balanced', 'frontier', 'haiku-class', 'sonnet-class', 'opus-class']);

const SELECTION_SOURCES = Object.freeze(['agent_override', 'global_override', 'runtime']);

function loadManifest(manifestPath = MANIFEST_PATH) {
  const raw = fs.readFileSync(manifestPath, 'utf8');
  return yaml.load(raw);
}

function isExactId(id) {
  return typeof id === 'string' && /^[^/\s]+\/[^\s]+$/.test(id);
}

function assertExactId(id, where) {
  if (typeof id !== 'string' || id.length === 0) throw new Error(`model manifest: empty model id at ${where}`);
  if (VAGUE_TOKENS.has(id.toLowerCase())) {
    throw new Error(`model manifest: vague tier '${id}' forbidden as authority at ${where}; use an exact provider/model id`);
  }
  if (!/^[^/\s]+\/[^\s]+$/.test(id)) {
    throw new Error(`model manifest: '${id}' at ${where} is not an exact provider/model id`);
  }
}

function providerOf(modelId) {
  const i = String(modelId || '').indexOf('/');
  return i > 0 ? String(modelId).slice(0, i) : 'unknown';
}

function getGlobalModel(manifest) {
  const g = manifest && manifest.global_agent_model;
  if (g === null || g === undefined || g === '') return null;
  assertExactId(g, 'global_agent_model');
  return g;
}

function validateEntry(req, where) {
  if (!req || typeof req !== 'object') throw new Error(`model manifest: missing entry at ${where}`);
  // Empty string is malformed (not inheritance — inherit is null/absent).
  const hasModel = req.model !== null && req.model !== undefined;
  if (hasModel) {
    assertExactId(req.model, `${where}.model`);
    for (const fb of req.fallbacks || []) assertExactId(fb, `${where}.fallbacks`);
  } else {
    // Inherit: no explicit candidates, so no fallbacks are meaningful.
    if (Array.isArray(req.fallbacks) && req.fallbacks.length > 0) {
      throw new Error(`model manifest: ${where} inherits (no model) and must not declare fallbacks`);
    }
  }
  if (req.on_unavailable !== 'fail_closed') {
    throw new Error('model manifest: on_unavailable must be fail_closed');
  }
  return hasModel ? req.model : null;
}

function requirementFor(manifest, kind, name) {
  const section = kind === 'agent' ? manifest.agents : manifest.tasks;
  if (!section || !section[name]) throw new Error(`model manifest: unknown ${kind} '${name}'`);
  return section[name];
}

function toSet(available) {
  if (available instanceof Set) return available;
  if (Array.isArray(available)) return new Set(available);
  if (available && Array.isArray(available.models)) return new Set(available.models);
  return new Set();
}

// Legacy entry-point: resolves ONE explicit requirement (model + declared
// fallbacks). Entries with inherit (null/absent model) cannot be resolved
// here — they need precedence context (global + session). Kept for backward
// compatibility with declared-fallback policy and existing unit probes.
function resolveRequirement(req, availableSet, availabilitySource, requirementKey = null) {
  const available = toSet(availableSet);
  // Empty string is malformed (not inheritance — inherit is null/absent).
  // assertExactId below rejects it as 'empty model id'.
  const hasModel = req && req.model !== null && req.model !== undefined;
  if (!hasModel) {
    throw new Error(
      `model manifest: '${requirementKey || 'entry'}' inherits (no explicit model); ` +
      `resolve via resolveWithPrecedence (agent/global/runtime), not resolveRequirement`
    );
  }
  assertExactId(req.model, 'model');
  for (const fb of req.fallbacks || []) assertExactId(fb, 'fallbacks');
  if (req.on_unavailable !== 'fail_closed') {
    throw new Error('model manifest: on_unavailable must be fail_closed');
  }
  const candidates = [req.model, ...(req.fallbacks || [])];
  for (let i = 0; i < candidates.length; i++) {
    if (available.has(candidates[i])) {
      const fallbackUsed = i > 0;
      return {
        model_requirement: requirementKey,
        requested_model_id: req.model,
        selected_model_id: candidates[i],
        fallback_used: fallbackUsed,
        fallback_reason: fallbackUsed ? `required unavailable; declared fallback #${i} available` : null,
        fallback_index: fallbackUsed ? i : 0,
        declared_candidates: candidates,
        availability_source: availabilitySource || 'unknown',
        availability_verified: true,
        resolution_result: fallbackUsed ? 'fallback' : 'resolved',
      };
    }
  }
  return {
    model_requirement: requirementKey,
    requested_model_id: req.model,
    selected_model_id: null,
    fallback_used: false,
    fallback_reason: 'required model and all declared fallbacks unavailable',
    fallback_index: -1,
    declared_candidates: candidates,
    availability_source: availabilitySource || 'unknown',
    availability_verified: true,
    resolution_result: 'fail_closed',
  };
}

function describeSession(session) {
  if (!session || typeof session !== 'object') return { model: null, source: 'missing', invalid: null };
  return {
    model: typeof session.model === 'string' && session.model ? session.model : null,
    source: session.source || 'missing',
    invalid: session.invalid || null,
  };
}

// Core precedence resolver. opts:
//   available, availabilitySource, manifest (optional, loaded when absent),
//   globalModel (optional; undefined → manifest global; null → no global),
//   sessionModel/sessionSource (optional; undefined → live discovery).
function resolveWithPrecedence(kind, name, opts = {}) {
  const manifest = opts.manifest || loadManifest();
  const req = requirementFor(manifest, kind, name);
  const requirementKey = `${kind === 'agent' ? 'agents' : 'tasks'}.${name}`;
  const agentOverride = validateEntry(req, requirementKey);
  const availabilitySource = opts.availabilitySource || 'runtime-capability-interface';
  const available = toSet(opts.available);

  let globalOverride = null;
  if (opts.globalModel !== undefined) {
    globalOverride = opts.globalModel || null;
    if (globalOverride) assertExactId(globalOverride, 'global_agent_model');
  } else {
    globalOverride = getGlobalModel(manifest);
  }

  let session = null;
  let sessionSource = 'missing';
  let sessionInvalid = null;
  if (opts.sessionModel !== undefined) {
    session = opts.sessionModel || null;
    sessionSource = opts.sessionSource || (session ? 'provided' : 'missing');
    if (session) assertExactId(session, 'runtime/session model');
  } else {
    const discovery = require('./runtime-session-model');
    const s = describeSession(discovery.getSessionModel());
    session = s.model;
    sessionSource = s.source;
    sessionInvalid = s.invalid;
  }

  const base = {
    model_requirement: requirementKey,
    requested_agent_override: agentOverride,
    global_override: globalOverride,
    runtime_model: session,
    runtime_model_source: sessionSource,
    requested_model_id: agentOverride || globalOverride || null,
    availability_source: availabilitySource,
    availability_verified: true,
  };

  function failClosed(reason) {
    return {
      ...base,
      requested_model_id: agentOverride || globalOverride || null,
      selected_model_id: null,
      selection_source: agentOverride ? 'agent_override' : globalOverride ? 'global_override' : 'runtime',
      explicit_override: Boolean(agentOverride || globalOverride),
      provider: providerOf(agentOverride || globalOverride || session || ''),
      fallback_used: false,
      fallback_reason: reason,
      fallback_index: -1,
      declared_candidates: agentOverride ? [agentOverride, ...((req.fallbacks || []))] : globalOverride ? [globalOverride] : [],
      resolution_result: 'fail_closed',
    };
  }

  // 1. Agent/task-specific explicit model wins. Unavailable → BLOCK (never
  //    inherit global/runtime/another provider).
  if (agentOverride) {
    const candidates = [agentOverride, ...((req.fallbacks || []))];
    for (let i = 0; i < candidates.length; i++) {
      if (available.has(candidates[i])) {
        const fallbackUsed = i > 0;
        return {
          ...base,
          selected_model_id: candidates[i],
          selection_source: 'agent_override',
          explicit_override: true,
          provider: providerOf(candidates[i]),
          fallback_used: fallbackUsed,
          fallback_reason: fallbackUsed ? `required unavailable; declared fallback #${i} available` : null,
          fallback_index: fallbackUsed ? i : 0,
          declared_candidates: candidates,
          resolution_result: fallbackUsed ? 'fallback' : 'resolved',
        };
      }
    }
    return failClosed(
      `explicit ${kind} override '${agentOverride}' unavailable in the current runtime` +
      (candidates.length > 1 ? ` (declared candidates: ${candidates.join(', ')}) all unavailable` : ' (no approved fallback exists)') +
      `. Failing closed — no silent inheritance permitted.`
    );
  }

  // 2. Global agent model. Unavailable → dependent agents BLOCK.
  if (globalOverride) {
    if (available.has(globalOverride)) {
      return {
        ...base,
        selected_model_id: globalOverride,
        selection_source: 'global_override',
        explicit_override: true,
        provider: providerOf(globalOverride),
        fallback_used: false,
        fallback_reason: null,
        fallback_index: 0,
        declared_candidates: [globalOverride],
        resolution_result: 'resolved',
      };
    }
    return failClosed(
      `global agent model '${globalOverride}' unavailable in the current runtime. Failing closed — no silent inheritance permitted.`
    );
  }

  // 3. Runtime/session inheritance (normal, NOT fallback).
  if (sessionInvalid) {
    return failClosed(
      `runtime/session model '${sessionInvalid}' (source: ${sessionSource}) is not an exact provider/model id. Failing closed.`
    );
  }
  if (!session) {
    return failClosed(
      `No model override is configured and no current runtime model could be resolved (session source: ${sessionSource}). ` +
      `Failing closed — never guessing from the catalog. Operator action: select a model in the runtime or export AIW_RUNTIME_MODEL=<provider>/<model>.`
    );
  }
  if (available.has(session)) {
    return {
      ...base,
      selected_model_id: session,
      selection_source: 'runtime',
      explicit_override: false,
      provider: providerOf(session),
      fallback_used: false,
      fallback_reason: null,
      fallback_index: 0,
      declared_candidates: [],
      resolution_result: 'resolved',
    };
  }
  return failClosed(
    `inherited runtime/session model '${session}' (source: ${sessionSource}) is absent from the live runtime catalog. Failing closed.`
  );
}

function resolveAgent(agentId, available, availabilitySource = 'runtime-capability-interface', opts = {}) {
  return resolveWithPrecedence('agent', agentId, { ...opts, available, availabilitySource });
}

function resolveTask(template, available, availabilitySource = 'runtime-capability-interface', opts = {}) {
  return resolveWithPrecedence('task', template, { ...opts, available, availabilitySource });
}

function resolveOrThrow(kind, name, available, availabilitySource, opts = {}) {
  const fn = kind === 'agent' ? resolveAgent : resolveTask;
  const rec = fn(name, available, availabilitySource, opts);
  if (rec.resolution_result === 'fail_closed') {
    const label = rec.selection_source === 'runtime' && !rec.explicit_override
      ? `${kind} '${name}' inherits runtime model` +
        (rec.runtime_model ? ` '${rec.runtime_model}'` : ' (none resolvable)') +
        `: ${rec.fallback_reason}`
      : `no-available-model: ${kind} '${name}' requires '${rec.requested_model_id}'` +
        (rec.declared_candidates.length > 1 ? ` (declared candidates: ${rec.declared_candidates.join(', ')})` : '') +
        `; availability_source=${rec.availability_source}. Failing closed — no undeclared substitution permitted.`;
    const err = new Error(label);
    err.code = 'NO_AVAILABLE_MODEL';
    err.resolution = rec;
    throw err;
  }
  return rec;
}

module.exports = {
  MANIFEST_PATH,
  SELECTION_SOURCES,
  loadManifest,
  getGlobalModel,
  validateEntry,
  providerOf,
  resolveAgent,
  resolveTask,
  resolveRequirement,
  resolveWithPrecedence,
  resolveOrThrow,
  VAGUE_TOKENS,
};

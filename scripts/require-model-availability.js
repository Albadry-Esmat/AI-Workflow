#!/usr/bin/env node
'use strict';
// AI Workflow — Single authoritative verify → resolve path for launchers.
//
// Boundary: Declare → Discover → Verify → Resolve → Consume → Execute.
// Every launcher that dispatches work with a manifest-declared model MUST pass
// through this module BEFORE touching an adapter. It is the only place (other
// than the diagnostic gate script) allowed to combine routing + availability +
// resolution. Adapters MUST NOT resolve: they consume the verified
// `model_resolution` record produced here and bind it into trace/checkpoint.
//
// Precedence: task/agent-specific explicit model → global agent model →
// current runtime/session model. Inheritance (runtime) is normal, not
// fallback. Unavailable explicit overrides fail closed with NO silent
// inheritance. Missing session model with no overrides fails closed.
const router = require('./task-router');
const resolveModel = require('./resolve-model');
const runtimeModels = require('./runtime-models');
const sessionDiscovery = require('./runtime-session-model');

function providerOf(modelId) {
  const i = String(modelId || '').indexOf('/');
  return i > 0 ? String(modelId).slice(0, i) : 'unknown';
}

function discoveryContext() {
  const availability = runtimeModels.listAvailableModels();
  const session = sessionDiscovery.getSessionModel();
  return { availability, session };
}

// verifyTemplate(template): route the task, verify its precedence resolution
// against live runtime capabilities, resolve deterministically.
// Returns { route, model_id (selected), model_resolution }.
// Throws NO_AVAILABLE_MODEL when blocked.
function verifyTemplate(template, overrides = {}) {
  const r = router.route(template);
  const { availability, session } = discoveryContext();
  const sessionModel = overrides.sessionModel !== undefined ? overrides.sessionModel : session.model;
  const sessionSource = overrides.sessionSource !== undefined
    ? overrides.sessionSource
    : (overrides.sessionModel !== undefined ? 'override' : session.source);
  let rec;
  try {
    rec = resolveModel.resolveOrThrow('task', template, availability, availability.source, {
      sessionModel,
      sessionSource,
    });
  } catch (err) {
    if (err.code !== 'NO_AVAILABLE_MODEL' || !err.resolution) throw err;
    const res = err.resolution;
    throw toTemplateFailure(template, res);
  }
  return { route: r, model_id: rec.selected_model_id, model_resolution: rec };
}

// verifyAgent(agentId): same enforcement for agent-scoped launches.
function verifyAgent(agentId, overrides = {}) {
  const { availability, session } = discoveryContext();
  const sessionModel = overrides.sessionModel !== undefined ? overrides.sessionModel : session.model;
  const sessionSource = overrides.sessionSource !== undefined
    ? overrides.sessionSource
    : (overrides.sessionModel !== undefined ? 'override' : session.source);
  let rec;
  try {
    rec = resolveModel.resolveOrThrow('agent', agentId, availability, availability.source, {
      sessionModel,
      sessionSource,
    });
  } catch (err) {
    if (err.code !== 'NO_AVAILABLE_MODEL' || !err.resolution) throw err;
    const res = err.resolution;
    throw toAgentFailure(agentId, res);
  }
  return { model_id: rec.selected_model_id, model_resolution: rec };
}

function describeSelection(res) {
  if (res.selection_source === 'agent_override' || (!res.selection_source && res.requested_model_id)) {
    return `requires '${res.requested_model_id}'`;
  }
  if (res.selection_source === 'global_override') {
    return `inherits global agent model '${res.global_override}'`;
  }
  if (res.runtime_model) {
    return `inherits runtime/session model '${res.runtime_model}' (source: ${res.runtime_model_source})`;
  }
  return `has no override and no resolvable runtime model`;
}

function toTemplateFailure(template, res) {
  const detail = res.explicit_override
    ? `Task '${template}' ${describeSelection(res)}, but the provider/model is unavailable in the current runtime (source: ${res.availability_source}).` +
      (res.declared_candidates.length > 1
        ? ` Declared candidates (${res.declared_candidates.join(', ')}) all unavailable.`
        : ' No approved fallback exists.')
    : `Task '${template}' ${describeSelection(res)}: ${res.fallback_reason} (availability source: ${res.availability_source}).`;
  const missing = res.requested_model_id || res.runtime_model || res.global_override || 'unknown';
  const failure = new Error(
    `Model runtime compatibility failed: 1/1 executable requirement unavailable for task '${template}'.\n` +
    `BLOCKED: ${detail} Failing closed — no undeclared substitution permitted.\n` +
    `Missing: ${missing} (provider: ${providerOf(missing)}). ` +
    `Operator action: connect the required provider in your runtime, then retry. Do not hand-edit opencode.json (generated).`
  );
  failure.code = 'NO_AVAILABLE_MODEL';
  failure.resolution = res;
  failure.requirement = `tasks.${template}`;
  return failure;
}

function toAgentFailure(agentId, res) {
  const detail = res.explicit_override
    ? `Agent '${agentId}' ${describeSelection(res)}, but the provider/model is unavailable in the current runtime (source: ${res.availability_source}). No approved fallback exists. Failing closed — no undeclared substitution permitted.`
    : `Agent '${agentId}' ${describeSelection(res)}: ${res.fallback_reason} (availability source: ${res.availability_source}). Failing closed.`;
  const missing = res.requested_model_id || res.runtime_model || res.global_override || 'unknown';
  const failure = new Error(
    `Model runtime compatibility failed: 1/1 executable requirement unavailable for agent '${agentId}'.\n` +
    `BLOCKED: ${detail}\n` +
    `Missing: ${missing} (provider: ${providerOf(missing)}). ` +
    `Operator action: connect the required provider in your runtime, then retry. Do not hand-edit opencode.json (generated).`
  );
  failure.code = 'NO_AVAILABLE_MODEL';
  failure.resolution = res;
  failure.requirement = `agents.${agentId}`;
  return failure;
}

module.exports = { verifyTemplate, verifyAgent, providerOf };

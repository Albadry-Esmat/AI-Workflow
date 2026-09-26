#!/usr/bin/env node
'use strict';
// AI Workflow — Runtime compatibility gate: precedence resolution vs live capabilities.
//
// Boundary: Declare → Verify → Resolve → Consume → Execute.
//   - Declares nothing: reads config/model-requirements.yml (authority).
//   - Discovers the current runtime/session model via
//     scripts/runtime-session-model.js (explicit chain, never catalog[0]).
//   - Verifies against the runtime capability interface (scripts/runtime-models.js
//     listAvailableModels) — never provider CLIs, never credentials, never auth.
//   - Resolves deterministically via scripts/resolve-model.js precedence:
//     agent/task override → global agent model → runtime/session model
//     (inheritance is normal, not fallback; explicit overrides fail closed).
//
// Outcomes per agent/task:
//   AVAILABLE         — selected model (override, global, or inherited runtime)
//                       exists exactly. Execution allowed.
//   APPROVED_FALLBACK — explicit override unavailable but a manifest-declared
//                       fallback is available.
//   UNAVAILABLE       — selection missing from catalog (or no session model).
//                       Execution denied (fail closed).
//
// Usage:
//   node scripts/check-model-runtime-compatibility.js            # live runtime gate
//   node scripts/check-model-runtime-compatibility.js --json     # + JSON to stdout
//   AIW_AVAILABLE_MODELS="p/m,..." node scripts/check-...       # deterministic pin
//   AIW_RUNTIME_MODEL="p/m" node scripts/check-...              # deterministic session pin
//
// Exit 0 when every agent/task resolves (AVAILABLE or APPROVED_FALLBACK).
// Exit 1 when any entry is UNAVAILABLE, with one actionable line per entry.
// Never prints credentials or secrets (model IDs only).
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const ARTIFACT_DEFAULT = path.join(ROOT, 'artifacts', 'model-runtime-compatibility.json');

function headSha() {
  try {
    return execSync('git rev-parse HEAD', { cwd: ROOT, encoding: 'utf8', timeout: 10000 }).trim();
  } catch {
    return 'unknown';
  }
}

function providerOf(modelId) {
  const i = String(modelId || '').indexOf('/');
  return i > 0 ? String(modelId).slice(0, i) : 'unknown';
}

function main() {
  const args = process.argv.slice(2);
  const wantJson = args.includes('--json');
  const outIdx = args.indexOf('--out');
  const outPath = outIdx >= 0 && args[outIdx + 1] ? path.resolve(args[outIdx + 1]) : ARTIFACT_DEFAULT;

  const { loadManifest, resolveWithPrecedence } = require('./resolve-model');
  const { listAvailableModels } = require('./runtime-models');
  const { getSessionModel } = require('./runtime-session-model');

  const manifest = loadManifest();
  const availability = listAvailableModels();
  const availableSet = new Set(availability.models || []);
  const session = getSessionModel();
  const timestamp = new Date().toISOString();
  const sha = headSha();

  const records = [];
  const failures = [];

  function checkSection(section, kind) {
    for (const [name, req] of Object.entries(section || {})) {
      const key = `${kind}.${name}`;
      const entryKind = kind === 'agents' ? 'agent' : 'task';
      let rec;
      try {
        rec = resolveWithPrecedence(entryKind, name, {
          manifest,
          available: availableSet,
          availabilitySource: availability.source,
          sessionModel: session.model,
          sessionSource: session.source,
        });
      } catch (err) {
        // Malformed manifest entry (e.g. vague tier): fail closed with reason.
        records.push({
          agent: kind === 'agents' ? name : null,
          task: kind === 'tasks' ? name : null,
          requirement_key: key,
          declared_model: (req && req.model) || null,
          preferred_model: (req && req.model) || null,
          requested_agent_override: (req && req.model) || null,
          global_override: manifest.global_agent_model || null,
          runtime_model: session.model,
          runtime_model_source: session.source,
          resolved_model: null,
          selected_model: null,
          selection_source: null,
          explicit_override: null,
          provider: providerOf(req && req.model),
          fallback_used: false,
          resolution: 'UNAVAILABLE',
          resolution_reason: `manifest entry invalid: ${err.message}`,
          availability_source: availability.source,
          availability_verified: true,
          head_sha: sha,
          timestamp,
        });
        failures.push(
          `${kind === 'agents' ? 'Agent' : 'Task'} '${name}' has an invalid requirement (${err.message}). Failing closed.`
        );
        continue;
      }
      const status = rec.resolution_result === 'resolved'
        ? 'AVAILABLE'
        : rec.resolution_result === 'fallback' ? 'APPROVED_FALLBACK' : 'UNAVAILABLE';
      records.push({
        agent: kind === 'agents' ? name : null,
        task: kind === 'tasks' ? name : null,
        requirement_key: key,
        declared_model: rec.requested_agent_override,
        preferred_model: rec.requested_agent_override,
        requested_agent_override: rec.requested_agent_override,
        global_override: rec.global_override,
        runtime_model: rec.runtime_model,
        runtime_model_source: rec.runtime_model_source,
        resolved_model: rec.selected_model_id,
        selected_model: rec.selected_model_id,
        selection_source: rec.selection_source,
        explicit_override: rec.explicit_override,
        provider: providerOf(rec.selected_model_id || rec.requested_agent_override || rec.global_override || rec.runtime_model),
        fallback_used: rec.fallback_used,
        fallback_index: rec.fallback_index,
        declared_candidates: rec.declared_candidates,
        resolution: status,
        resolution_reason: rec.fallback_reason
          || (status === 'AVAILABLE'
            ? rec.selection_source === 'runtime'
              ? 'inherited runtime/session model available exactly'
              : rec.selection_source === 'global_override'
                ? 'global agent model available exactly'
                : 'requested model available exactly'
            : 'selection unavailable'),
        availability_source: rec.availability_source,
        availability_verified: true,
        head_sha: sha,
        timestamp,
      });
      if (status === 'UNAVAILABLE') {
        const noun = kind === 'agents' ? 'Agent' : 'Task';
        if (rec.explicit_override) {
          const fb = (rec.declared_candidates || []).length > 1
            ? ` Declared candidates (${rec.declared_candidates.join(', ')}) all unavailable.`
            : ' No approved fallback exists.';
          failures.push(
            `${noun} '${name}' requires '${rec.requested_model_id}', but the provider/model is unavailable in the current runtime (source: ${rec.availability_source}).${fb} Failing closed — connect the required provider or declare an approved fallback in config/model-requirements.yml.`
          );
        } else if (!rec.runtime_model) {
          failures.push(
            `${noun} '${name}' has no model override and no current runtime model could be resolved (session source: ${rec.runtime_model_source}). Failing closed — select a model in the runtime or export AIW_RUNTIME_MODEL=<provider>/<model>.`
          );
        } else {
          failures.push(
            `${noun} '${name}' inherits runtime/session model '${rec.runtime_model}' (source: ${rec.runtime_model_source}), but it is absent from the live runtime catalog (source: ${rec.availability_source}). Failing closed.`
          );
        }
      }
    }
  }

  checkSection(manifest.agents, 'agents');
  checkSection(manifest.tasks, 'tasks');

  const available = records.filter((r) => r.resolution === 'AVAILABLE').length;
  const fallbacks = records.filter((r) => r.resolution === 'APPROVED_FALLBACK').length;
  const unavailable = records.filter((r) => r.resolution === 'UNAVAILABLE').length;

  const report = {
    schema_version: '2.0.0',
    generated_at: timestamp,
    head_sha: sha,
    availability_source: availability.source,
    availability_count: availableSet.size,
    runtime_model: session.model,
    runtime_model_source: session.source,
    global_agent_model: manifest.global_agent_model || null,
    // Full catalog recorded for auditability (model IDs only — never credentials).
    availability_models: [...availableSet].sort(),
    summary: {
      total: records.length,
      available,
      approved_fallback: fallbacks,
      unavailable,
      verdict: unavailable === 0 ? 'pass' : 'block',
    },
    records,
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n');

  // Human-readable matrix (no secrets: IDs and counts only).
  // Answers: what model would actually execute right now, and why.
  const rows = records.map((r) => ({
    name: r.agent || r.task,
    kind: r.agent ? 'agent' : 'task',
    selected: r.selected_model || 'unavailable',
    source: r.selection_source || 'invalid',
    resolution: r.resolution === 'AVAILABLE' ? 'AVAILABLE' : r.resolution === 'APPROVED_FALLBACK' ? 'APPROVED_FALLBACK' : 'BLOCKED',
  }));
  const w = (s, n) => String(s).padEnd(n).slice(0, n);
  console.log(`model runtime compatibility (source: ${availability.source}, catalog: ${availableSet.size} model(s), session: ${session.model || 'none'} [${session.source}], global: ${manifest.global_agent_model || 'none'}, HEAD: ${sha.slice(0, 12)})`);
  console.log(`${w('kind', 6)} ${w('name', 20)} ${w('selected model', 38)} ${w('source', 15)} resolution`);
  for (const r of rows) {
    console.log(`${w(r.kind, 6)} ${w(r.name, 20)} ${w(r.selected, 38)} ${w(r.source, 15)} ${r.resolution}`);
  }
  console.log(`summary: ${records.length} checked, ${available} available, ${fallbacks} approved-fallback, ${unavailable} blocked → ${report.summary.verdict.toUpperCase()} (report: ${path.relative(ROOT, outPath)})`);

  if (wantJson) console.log(JSON.stringify(report, null, 2));

  if (failures.length > 0) {
    for (const f of failures) console.error(`BLOCKED: ${f}`);
    process.exit(1);
  }
}

if (require.main === module) main();
module.exports = { headSha, providerOf };

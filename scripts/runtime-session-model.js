#!/usr/bin/env node
'use strict';
// AI Workflow — Runtime/session model discovery.
//
// Boundary: Declare → Discover → Verify → Resolve → Consume → Execute.
// Never Install → Connect → Authenticate → Configure.
//
// This module answers ONLY: "Which model is currently selected by the
// runtime/session?" It never answers "which models are available" (that is
// scripts/runtime-models.js) and it never provisions anything.
//
// OpenCode model-loading priority (documented, verified 2026-09-25):
//   1. `--model` / `-m` CLI flag
//   2. `model` in OpenCode config (project opencode.json, then global config)
//   3. last used model
//   4. first model (internal priority)
//
// LIMITATION (exact, no guessing): OpenCode exposes no CLI/API that reports
// the live TUI/CLI session-selected model (sources 1 and 3 above) to an
// out-of-band script. `opencode models` lists the *catalog*, not the
// *selection*. Session export (`opencode export [sessionID]`) needs a session
// ID and reflects history, not the current default. Therefore this module
// implements the safest SUPPORTED mechanism — an explicit, deterministic
// chain that never guesses:
//
//   AIW_RUNTIME_MODEL env → OPENCODE_MODEL env → opencode.json top-level
//   `model` (project default, only when no global_agent_model policy claims
//   that field) → missing (fail closed).
//
// - AIW_RUNTIME_MODEL is the primary operator/CI pin. CI sets it as a fixture;
//   operators running `opencode run -m <id>` should export the same `<id>` so
//   AIW verification matches the live session.
// - OPENCODE_MODEL is honored because opencode.json supports the
//   `"model": "{env:OPENCODE_MODEL}"` pattern (documented OpenCode behavior).
// - opencode.json top-level `model` is the configured project default
//   (priority #2). When `global_agent_model` policy is set, the top-level
//   field carries POLICY (projected global default for native inheritance),
//   not session state — so it is skipped as a session source in that case.
// - The catalog is NEVER consulted here: picking `catalog[0]` would be an
//   arbitrary guess, explicitly forbidden by governance.
//
// Missing/invalid session model is NOT an error in this module — it returns
// `{ model: null, ... }` and the resolver fails closed downstream with:
//   "No model override is configured and no current runtime model could be
//   resolved."
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const OPENCODE_PATH = path.join(ROOT, 'opencode.json');

function isExactId(id) {
  return typeof id === 'string' && /^[^/\s]+\/[^\s]+$/.test(id);
}

function readProjectModel() {
  try {
    const cfg = JSON.parse(fs.readFileSync(OPENCODE_PATH, 'utf8'));
    const m = cfg.model;
    if (typeof m === 'string' && m.trim().length > 0) return m.trim();
    return null;
  } catch {
    return null;
  }
}

function readGlobalPolicy() {
  try {
    const yaml = require('js-yaml');
    const manifest = yaml.load(fs.readFileSync(path.join(ROOT, 'config', 'model-requirements.yml'), 'utf8'));
    const g = manifest && manifest.global_agent_model;
    if (typeof g === 'string' && g.trim().length > 0) return g.trim();
    return null;
  } catch {
    return null;
  }
}

// getSessionModel(): deterministic current-model discovery.
// Returns { model: string|null, source: string, invalid?: string }.
// Never throws, never authenticates, never reads secrets.
function getSessionModel() {
  const aiwPin = (process.env.AIW_RUNTIME_MODEL || '').trim();
  if (aiwPin) {
    if (isExactId(aiwPin)) return { model: aiwPin, source: 'env:AIW_RUNTIME_MODEL' };
    return { model: null, source: 'env:AIW_RUNTIME_MODEL', invalid: aiwPin };
  }
  const ocEnv = (process.env.OPENCODE_MODEL || '').trim();
  if (ocEnv) {
    if (isExactId(ocEnv)) return { model: ocEnv, source: 'env:OPENCODE_MODEL' };
    return { model: null, source: 'env:OPENCODE_MODEL', invalid: ocEnv };
  }
  // Project default — skipped when it carries global policy (see header).
  if (readGlobalPolicy()) return { model: null, source: 'missing' };
  const fileModel = readProjectModel();
  if (fileModel) {
    if (isExactId(fileModel)) return { model: fileModel, source: 'opencode.json:model' };
    return { model: null, source: 'opencode.json:model', invalid: fileModel };
  }
  return { model: null, source: 'missing' };
}

module.exports = { getSessionModel, isExactId, OPENCODE_PATH };

#!/usr/bin/env node
'use strict';
// Sync runtime projection: opencode.json model fields AND
// .opencode/agent/*.md frontmatter `model:` fields are GENERATED from
// config/model-requirements.yml (single source of truth), not independently
// authored. Ownership:
//   model-requirements.yml = authority (per-agent/task explicit overrides +
//                            optional global_agent_model; absent = inherit)
//   opencode.json          = runtime representation (HOW OpenCode is configured)
//   .opencode/agent/*.md   = agent definitions OpenCode loads (frontmatter
//                            `model:` is a second configured-model surface and
//                            MUST agree with the manifest like opencode.json)
// Precedence: agent override → global agent model → runtime/session model.
// Projection (minimal, native):
//   - Agent with explicit model → per-agent `model` set exactly (opencode.json
//     key AND agent-md frontmatter `model:` line).
//   - Agent inheriting           → NO per-agent `model` key AND NO frontmatter
//     `model:` line (native OpenCode inheritance: subagents use the invoking
//     primary's model; primaries use the globally configured model).
//   - global_agent_model set     → top-level `model` set exactly (native
//     default for all inheriting agents).
//   - global_agent_model null    → NO top-level `model` key (runtime chooses
//     natively via --model flag / last-used / first; AIW verifies via
//     AIW_RUNTIME_MODEL → OPENCODE_MODEL → project default chain).
// Usage:
//   node scripts/sync-opencode-models.js --check   (fail on drift, for CI)
//   node scripts/sync-opencode-models.js --write   (project manifest into opencode.json + agent-md frontmatter)
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(ROOT, 'config', 'model-requirements.yml');
const OPENCODE_PATH = path.join(ROOT, 'opencode.json');
const AGENT_DIR = path.join(ROOT, '.opencode', 'agent');

// Provenance marker: tolerated by the OpenCode runtime (verified: unknown
// top-level keys are ignored by `opencode models`), and checked below.
const PROJECTION_MARKER = {
  generated_from: 'config/model-requirements.yml',
  authority: 'model-requirements.yml is the single source of truth for model policy (explicit overrides + optional global; inherit = no field)',
  note: 'Generated runtime projection. Do not edit model fields manually — edit config/model-requirements.yml, then run: node scripts/sync-opencode-models.js --write',
};

function loadManifest() {
  return yaml.load(fs.readFileSync(MANIFEST_PATH, 'utf8'));
}

function expectedAgentModel(req) {
  if (!req) return undefined;
  return req.model || null; // null = inherit → no field projected
}

function markerDrift(cfg) {
  const m = cfg._model_projection;
  if (!m) return ['missing _model_projection provenance marker'];
  const drifts = [];
  for (const [k, v] of Object.entries(PROJECTION_MARKER)) {
    if (m[k] !== v) drifts.push(`_model_projection.${k} mismatch`);
  }
  return drifts;
}

function agentMdPath(name) {
  return path.join(AGENT_DIR, `${name}.md`);
}

// Frontmatter helpers: the agent-md `model:` line lives inside the leading
// `---` block. Only that line is ever added/removed; body text untouched.
function readFrontmatter(text) {
  const lines = text.split('\n');
  if (lines[0].trim() !== '---') return null;
  let close = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') { close = i; break; }
  }
  if (close < 0) return null;
  return { lines, close };
}

function frontmatterModel(text) {
  const fm = readFrontmatter(text);
  if (!fm) return undefined; // no frontmatter
  for (let i = 1; i < fm.close; i++) {
    const m = /^\s*model:\s*(.+?)\s*$/.exec(fm.lines[i]);
    if (m) return m[1];
  }
  return null; // frontmatter, no model line = inherit
}

function setFrontmatterModel(text, model) {
  const fm = readFrontmatter(text);
  if (!fm) return null; // cannot project without frontmatter (check() flags it)
  const { lines, close } = fm;
  const kept = [];
  for (let i = 1; i < close; i++) {
    if (!/^\s*model:\s*.*$/.test(lines[i])) kept.push(lines[i]);
  }
  if (model) {
    const at = kept.findIndex((l) => /^\s*mode:\s*.*$/.test(l));
    const line = `model: ${model}`;
    if (at >= 0) kept.splice(at + 1, 0, line);
    else kept.unshift(line);
  }
  return [lines[0], ...kept, ...lines.slice(close)].join('\n');
}

function check() {
  const manifest = loadManifest();
  const cfg = JSON.parse(fs.readFileSync(OPENCODE_PATH, 'utf8'));
  const drifts = [...markerDrift(cfg)];
  const agents = manifest.agents || {};
  for (const [name, req] of Object.entries(agents)) {
    const entry = (cfg.agent || {})[name];
    if (!entry) {
      drifts.push(`agent '${name}' in manifest but missing in opencode.json`);
      continue;
    }
    const expected = expectedAgentModel(req);
    if (expected) {
      if (entry.model !== expected) {
        drifts.push(`agent '${name}': opencode.json '${entry.model}' != manifest '${expected}'`);
      }
    } else if ('model' in entry) {
      drifts.push(`agent '${name}' inherits (manifest model null) but opencode.json pins '${entry.model}' — remove the field`);
    }
    // Second configured-model surface: agent-md frontmatter must agree too.
    const mdPath = agentMdPath(name);
    if (!fs.existsSync(mdPath)) {
      drifts.push(`agent '${name}' in manifest but missing ${path.relative(ROOT, mdPath)}`);
      continue;
    }
    const mdText = fs.readFileSync(mdPath, 'utf8');
    const mdModel = frontmatterModel(mdText);
    if (mdModel === undefined) {
      drifts.push(`agent '${name}': ${path.relative(ROOT, mdPath)} has no frontmatter block`);
    } else if (expected) {
      if (mdModel !== expected) {
        drifts.push(`agent '${name}': .opencode/agent/${name}.md frontmatter '${mdModel}' != manifest '${expected}'`);
      }
    } else if (mdModel !== null) {
      drifts.push(`agent '${name}' inherits (manifest model null) but .opencode/agent/${name}.md frontmatter pins '${mdModel}' — remove the line`);
    }
  }
  const global = manifest.global_agent_model || null;
  if (global) {
    if (cfg.model !== global) {
      drifts.push(`top-level model '${cfg.model}' != global_agent_model '${global}'`);
    }
  } else if ('model' in cfg) {
    drifts.push(`no global_agent_model configured but opencode.json sets top-level model '${cfg.model}' — remove the field so the runtime chooses natively`);
  }
  return drifts;
}

function write() {
  const manifest = loadManifest();
  const agents = manifest.agents || {};
  const raw = fs.readFileSync(OPENCODE_PATH, 'utf8');
  const cfg = JSON.parse(raw);
  cfg.agent = cfg.agent || {};
  let updated = 0;
  for (const [name, req] of Object.entries(agents)) {
    const entry = cfg.agent[name];
    if (!entry) continue; // missing agent sections are a check() error, not auto-created
    const expected = expectedAgentModel(req);
    if (expected) {
      if (entry.model !== expected) {
        entry.model = expected;
        updated++;
      }
    } else if ('model' in entry) {
      delete entry.model;
      updated++;
    }
  }
  const global = manifest.global_agent_model || null;
  if (global) {
    if (cfg.model !== global) {
      cfg.model = global;
      updated++;
    }
  } else if ('model' in cfg) {
    delete cfg.model;
    updated++;
  }
  for (const [name, req] of Object.entries(agents)) {
    const mdPath = agentMdPath(name);
    if (!fs.existsSync(mdPath)) continue; // missing agent-md is a check() error, not auto-created
    const expected = expectedAgentModel(req);
    const before = fs.readFileSync(mdPath, 'utf8');
    const after = setFrontmatterModel(before, expected);
    if (after !== null && after !== before) {
      fs.writeFileSync(mdPath, after);
      updated++;
    }
  }
  // Marker first for visibility; remaining key order untouched.
  const { _model_projection, ...rest } = cfg;
  const next = { _model_projection: { ...PROJECTION_MARKER }, ...rest };
  if (JSON.stringify(cfg._model_projection || null) !== JSON.stringify(PROJECTION_MARKER)) updated++;
  // Byte-preserving serialization: the checked-in file uses \uXXXX escapes for
  // non-ASCII; plain JSON.stringify would emit literal UTF-8 and noisy diffs.
  const text = JSON.stringify(next, null, 2).replace(/[^\x00-\x7F]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`) + '\n';
  fs.writeFileSync(OPENCODE_PATH, text);
  return updated;
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--write')) {
    const n = write();
    console.log(`model projection from manifest: ${n} model field(s) updated (opencode.json + .opencode/agent/*.md frontmatter)`);
    return;
  }
  const drifts = check();
  if (drifts.length > 0) {
    for (const d of drifts) console.error(`DRIFT: ${d}`);
    console.error('opencode.json / .opencode/agent/*.md disagree with config/model-requirements.yml (authority). Run: node scripts/sync-opencode-models.js --write');
    process.exit(1);
  }
  console.log('model projection matches manifest (opencode.json + agent-md frontmatter in sync)');
}
if (require.main === module) main();
module.exports = { check, write, frontmatterModel, setFrontmatterModel, agentMdPath };

#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const ROOT = path.resolve(__dirname, '..');
const INDEX_PATH = path.join(ROOT, 'skills', 'index.yaml');
const REGISTRY_PATH = path.join(ROOT, 'skills', 'registry.json');
const CONFIG_PATH = path.join(ROOT, 'opencode.json');
const PIPELINE_DIR = path.join(ROOT, 'skills', 'pipelines');
const OUTPUT_PATH = path.join(ROOT, 'skills', 'capability-index.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function skillName(entry) {
  return entry.executable_skill ? path.basename(path.dirname(entry.executable_skill)) : null;
}

function buildAgentMap(config) {
  const map = new Map();
  for (const [agentName, agent] of Object.entries(config.agent || {})) {
    const refs = [];
    for (const key of ['skill', 'skills']) {
      const values = agent[key] == null ? [] : Array.isArray(agent[key]) ? agent[key] : [agent[key]];
      for (const ref of values) refs.push(path.basename(path.dirname(ref)));
    }
    for (const ref of refs) {
      if (!map.has(ref)) map.set(ref, []);
      map.get(ref).push({
        agent: agentName,
        model: agent.model || null,
        permission: agent.permission || {},
      });
    }
  }
  return map;
}

function buildPipelineMap() {
  const map = new Map();
  for (const filename of fs.readdirSync(PIPELINE_DIR).filter((f) => f.endsWith('.json')).sort()) {
    const pipeline = readJson(path.join(PIPELINE_DIR, filename));
    const names = [];
    if (Array.isArray(pipeline.skills)) names.push(...pipeline.skills.map((step) => step.name));
    for (const phase of pipeline.phases || []) {
      if (Array.isArray(phase.skills)) names.push(...phase.skills.map((step) => step.name));
    }
    for (const name of names) {
      if (!map.has(name)) map.set(name, new Set());
      map.get(name).add(pipeline.name || filename.replace(/\.json$/, ''));
    }
  }
  return map;
}

function riskTier(entry, name) {
  const text = `${name} ${(entry.tags || []).join(' ')} ${entry.short_description || ''}`.toLowerCase();
  if (/(security|secret|threat|compliance|deploy|rollback|production|credential)/.test(text)) return 'high';
  if (/(guard|validation|quality|testing|dependency|architecture|api|data|pipeline)/.test(text)) return 'medium';
  return 'low';
}

function buildIndex() {
  const catalog = yaml.load(fs.readFileSync(INDEX_PATH, 'utf8')) || {};
  const registry = readJson(REGISTRY_PATH);
  const config = readJson(CONFIG_PATH);
  const agents = buildAgentMap(config);
  const pipelines = buildPipelineMap();
  const registryNames = new Set((registry.skills || []).map((entry) => entry.name));
  const entries = (catalog.skills || []).map((entry) => {
    const name = skillName(entry);
    const owners = agents.get(name) || [];
    const pipelineNames = [...(pipelines.get(name) || new Set())].sort();
    const directRegistry = registryNames.has(name);
    let classification = 'catalog-only';
    if (directRegistry) classification = 'runtime-registry';
    else if (owners.length) classification = 'agent-owned';
    else if (pipelineNames.length) classification = 'pipeline-routed';
    else if (/(event|telemetry|session|utility|meta|state|registry|context|lifecycle|trigger)/i.test(`${name} ${(entry.tags || []).join(' ')}`)) classification = 'event-or-utility';
    return {
      id: entry.id,
      name,
      display_name: entry.name,
      version: entry.version,
      executable_skill: entry.executable_skill,
      reference_path: entry.reference_path || null,
      tags: entry.tags || [],
      mastery_level: entry.mastery_level || null,
      classification,
      risk_tier: riskTier(entry, name),
      depends_on: entry.depends_on || [],
      owner_agents: owners,
      pipeline_reachability: pipelineNames,
      directly_routable: directRegistry,
      max_output_tokens: entry.max_output_tokens || null,
      has_use_when: Boolean(entry.use_when),
      has_do_not_use_when: Boolean(entry.do_not_use_when),
    };
  }).sort((a, b) => a.name.localeCompare(b.name));

  return {
    schema_version: '1.0.0',
    generated_by: 'scripts/build-capability-index.js',
    catalog_version: catalog.meta?.version || null,
    catalog_last_updated: catalog.meta?.last_updated || null,
    registry_entry_count: registry.skills?.length || 0,
    agent_count: Object.keys(config.agent || {}).length,
    pipeline_count: fs.readdirSync(PIPELINE_DIR).filter((f) => f.endsWith('.json')).length,
    skill_count: entries.length,
    classifications: entries.reduce((result, entry) => {
      result[entry.classification] = (result[entry.classification] || 0) + 1;
      return result;
    }, {}),
    skills: entries,
  };
}

const check = process.argv.includes('--check');
const output = buildIndex();
const serialized = `${JSON.stringify(output, null, 2)}\n`;
if (check) {
  if (!fs.existsSync(OUTPUT_PATH)) {
    console.error(`FAIL: ${path.relative(ROOT, OUTPUT_PATH)} is missing; run node scripts/build-capability-index.js --write`);
    process.exit(1);
  }
  const current = fs.readFileSync(OUTPUT_PATH, 'utf8');
  if (current !== serialized) {
    console.error(`FAIL: ${path.relative(ROOT, OUTPUT_PATH)} is stale; run node scripts/build-capability-index.js --write`);
    process.exit(1);
  }
  console.log(`PASS: ${path.relative(ROOT, OUTPUT_PATH)} matches source metadata`);
} else if (process.argv.includes('--write')) {
  fs.writeFileSync(OUTPUT_PATH, serialized);
  console.log(`WROTE: ${path.relative(ROOT, OUTPUT_PATH)} (${output.skill_count} skills)`);
} else {
  process.stdout.write(serialized);
}

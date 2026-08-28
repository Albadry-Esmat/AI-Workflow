#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const ROOT = path.resolve(__dirname, '..');
const PIPELINE_DIR = path.join(ROOT, 'skills', 'pipelines');
const INDEX_PATH = path.join(ROOT, 'skills', 'index.yaml');
const CONFIG_PATH = path.join(ROOT, 'opencode.json');

function usage() {
  console.error('Usage: aiw plan [request] [--pipeline <name>] [--json]');
  console.error('       npm run plan -- [request] [--pipeline <name>] [--json]');
}

function fail(message, code = 2) {
  console.error(`ERROR: ${message}`);
  usage();
  process.exit(code);
}

function parseArgs(argv) {
  const args = [...argv];
  const requestParts = [];
  let pipeline;
  let json = false;
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--json') {
      json = true;
    } else if (arg === '--dry-run') {
      // `aiw plan` is inherently side-effect free; accept the explicit alias for discoverability.
    } else if (arg === '--pipeline') {
      pipeline = args[++i];
      if (!pipeline) fail('--pipeline requires a pipeline name');
    } else if (arg.startsWith('--pipeline=')) {
      pipeline = arg.slice('--pipeline='.length);
      if (!pipeline) fail('--pipeline requires a pipeline name');
    } else if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    } else if (arg.startsWith('-')) {
      fail(`unknown option: ${arg}`);
    } else {
      requestParts.push(arg);
    }
  }
  return {
    request: requestParts.join(' ').trim() || null,
    pipeline: pipeline || null,
    json,
  };
}

function loadJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    fail(`cannot read JSON file ${path.relative(ROOT, filePath)}: ${error.message}`, 1);
  }
}

function loadPipeline(name) {
  const normalized = name.endsWith('.json') ? name : `${name}.json`;
  const filePath = path.join(PIPELINE_DIR, normalized);
  if (!fs.existsSync(filePath)) {
    const available = fs.readdirSync(PIPELINE_DIR).filter((f) => f.endsWith('.json')).sort().map((f) => f.replace(/\.json$/, ''));
    fail(`pipeline not found: ${name}. Available pipelines: ${available.join(', ')}`);
  }
  return { filePath, data: loadJson(filePath) };
}

function loadSkillIndex() {
  try {
    const parsed = yaml.load(fs.readFileSync(INDEX_PATH, 'utf8'));
    return Array.isArray(parsed?.skills) ? parsed.skills : [];
  } catch (error) {
    fail(`cannot parse ${path.relative(ROOT, INDEX_PATH)}: ${error.message}`, 1);
  }
}

function skillKey(entry) {
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
        name: agentName,
        model: agent.model || null,
        permission: agent.permission || {},
      });
    }
  }
  return map;
}

function buildPipelineCatalog() {
  const catalog = new Map();
  for (const filename of fs.readdirSync(PIPELINE_DIR).filter((f) => f.endsWith('.json')).sort()) {
    const data = loadJson(path.join(PIPELINE_DIR, filename));
    const names = [];
    if (Array.isArray(data.skills)) names.push(...data.skills.map((step) => step.name));
    for (const phase of data.phases || []) {
      if (Array.isArray(phase.skills)) names.push(...phase.skills.map((step) => step.name));
    }
    for (const name of names) {
      if (!catalog.has(name)) catalog.set(name, []);
      catalog.get(name).push(data.name || filename.replace(/\.json$/, ''));
    }
  }
  return catalog;
}

function flattenPipeline(pipeline) {
  const phases = [];
  if (Array.isArray(pipeline.skills)) {
    phases.push({ id: 'pipeline-steps', label: 'Pipeline steps', parallel: false, async: false, condition: null, note: null, skills: pipeline.skills });
  }
  for (const phase of pipeline.phases || []) {
    phases.push({
      id: phase.id,
      label: phase.label || phase.id,
      parallel: phase.parallel === true,
      async: phase.async === true,
      condition: phase.condition || null,
      note: phase.note || null,
      skills: Array.isArray(phase.skills) ? phase.skills : [],
    });
  }
  return phases;
}

function routeInfo(request, explicitPipeline) {
  if (explicitPipeline) return { mode: 'explicit', confidence: 1, note: 'Pipeline supplied by the caller.' };
  return {
    mode: 'default',
    confidence: null,
    note: request ? 'No routing decision is performed by the planner; the documented full-pipeline default is shown.' : 'No request was supplied; the documented full-pipeline default is shown.',
  };
}

function createManifest({ request, pipelineName, pipelineFileName, pipeline, skills, config, explicitPipeline }) {
  const skillMap = new Map(skills.map((entry) => [skillKey(entry), entry]));
  const agents = buildAgentMap(config);
  const pipelineCatalog = buildPipelineCatalog();
  const phases = flattenPipeline(pipeline);
  const warnings = [];
  const unresolvedSkills = [];
  const implicitOwnership = [];
  const undeclaredPolicy = [];
  let stepCount = 0;
  let asyncCount = 0;
  let parallelPhaseCount = 0;

  const manifestPhases = phases.map((phase) => {
    if (phase.parallel) parallelPhaseCount += 1;
    const manifestSkills = phase.skills.map((step) => {
      stepCount += 1;
      const name = step.name;
      const catalogEntry = skillMap.get(name) || null;
      const owners = agents.get(name) || [];
      const isAsync = step.async === true || phase.async === true || (pipeline.async_skills || []).includes(name);
      if (isAsync) asyncCount += 1;
      if (!catalogEntry) unresolvedSkills.push(name);
      if (owners.length === 0) implicitOwnership.push(name);
      undeclaredPolicy.push(name);
      return {
        name,
        version: step.version || null,
        skill_id: catalogEntry?.id || null,
        executable_skill: catalogEntry?.executable_skill || null,
        domain: catalogEntry?.tags?.[0] || null,
        mastery_level: catalogEntry?.mastery_level || null,
        owner_agents: owners,
        pipeline_reachability: pipelineCatalog.get(name) || [],
        execution: {
          parallel: phase.parallel,
          async: isAsync,
          max_retries: Number.isInteger(step.max_retries) ? step.max_retries : 2,
          validation_skipped: step.skip_validation === true,
          type: step.type || 'skill',
        },
        side_effect_policy: {
          filesystem: 'undeclared',
          network: 'undeclared',
          secrets: 'undeclared',
          external_write: 'undeclared',
          production_action: 'undeclared',
        },
        notes: step.note || null,
      };
    });
    return {
      id: phase.id,
      label: phase.label,
      parallel: phase.parallel,
      async: phase.async,
      condition: phase.condition,
      note: phase.note,
      skills: manifestSkills,
    };
  });

  if (unresolvedSkills.length) warnings.push(`Unresolved skill names: ${[...new Set(unresolvedSkills)].join(', ')}`);
  if (implicitOwnership.length) warnings.push(`Implicit agent ownership: ${[...new Set(implicitOwnership)].join(', ')}`);
  warnings.push('Step-level side-effect policy is not yet declared; every step is surfaced as undeclared rather than assumed safe.');
  if (manifestPhases.some((phase) => phase.condition)) warnings.push('Conditional phases are displayed but not evaluated by this side-effect-free planner.');
  if (pipeline.gates?.some((gate) => gate.bypass_on_timeout === true)) warnings.push('One or more gates allow timeout bypass; review before production execution.');

  return {
    manifest_version: '1.0.0',
    planner: 'aiw plan',
    dry_run: true,
    request,
    route: routeInfo(request, explicitPipeline),
    pipeline: {
      name: pipeline.name || pipelineName,
      version: pipeline.version || null,
      description: pipeline.description || null,
      domain: pipeline.domain || 'general',
      mode: pipeline.mode || 'sequential',
      source: path.relative(ROOT, path.join(PIPELINE_DIR, pipelineFileName)),
    },
    summary: {
      phase_count: manifestPhases.length,
      step_count: stepCount,
      parallel_phase_count: parallelPhaseCount,
      async_step_count: asyncCount,
      gate_count: Array.isArray(pipeline.gates) ? pipeline.gates.length : 0,
      warning_count: warnings.length,
    },
    phases: manifestPhases,
    gates: Array.isArray(pipeline.gates) ? pipeline.gates.map((gate) => ({
      after_skill: gate.after_skill || null,
      after_phase: gate.after_phase || null,
      type: gate.type,
      condition: gate.condition || null,
      timeout: gate.timeout ?? 3600,
      bypass_on_timeout: gate.bypass_on_timeout === true,
      label: gate.label || null,
    })) : [],
    policies: {
      side_effects: 'report-only',
      secret_values: 'never loaded or printed',
      writes: 'none',
      network_calls: 'none',
      external_actions: 'none',
    },
    warnings: [...new Set(warnings)],
  };
}

function printText(manifest) {
  const p = manifest.pipeline;
  console.log('AI-Workflow execution plan (dry run)');
  console.log('====================================');
  console.log(`Request:  ${manifest.request || '(none supplied)'}`);
  console.log(`Pipeline: ${p.name}${p.version ? ` @ ${p.version}` : ''}`);
  console.log(`Route:    ${manifest.route.mode}${manifest.route.confidence === null ? '' : ` (confidence ${manifest.route.confidence})`}`);
  console.log('');
  console.log('Summary');
  console.log(`  Phases: ${manifest.summary.phase_count}`);
  console.log(`  Steps:  ${manifest.summary.step_count}`);
  console.log(`  Gates:  ${manifest.summary.gate_count}`);
  console.log(`  Async:  ${manifest.summary.async_step_count}`);
  console.log('');
  console.log('Phases');
  for (const phase of manifest.phases) {
    const flags = [phase.parallel ? 'parallel' : 'sequential', phase.async ? 'async' : 'blocking'];
    console.log(`  ${phase.id} — ${phase.label} [${flags.join(', ')}]`);
    for (const skill of phase.skills) {
      const owner = skill.owner_agents.length ? skill.owner_agents.map((a) => a.name).join(', ') : 'implicit/orchestrator';
      const retries = skill.execution.max_retries;
      console.log(`    - ${skill.name}${skill.version ? ` @ ${skill.version}` : ''} → ${owner}; retries=${retries}; side-effects=undeclared`);
    }
  }
  if (manifest.gates.length) {
    console.log('');
    console.log('Gates');
    for (const gate of manifest.gates) console.log(`  - ${gate.after_phase || gate.after_skill || '(pipeline)'} → ${gate.type}${gate.label ? `: ${gate.label}` : ''}`);
  }
  console.log('');
  console.log('Warnings');
  for (const warning of manifest.warnings) console.log(`  - ${warning}`);
  console.log('');
  console.log('No files, session state, network calls, secrets, pull requests, or deployments were touched.');
}

const args = parseArgs(process.argv.slice(2));
const pipelineName = args.pipeline || 'full-pipeline';
const loadedPipeline = loadPipeline(pipelineName);
const pipeline = loadedPipeline.data;
const pipelineFileName = path.basename(loadedPipeline.filePath);
const skills = loadSkillIndex();
const config = loadJson(CONFIG_PATH);
const manifest = createManifest({ request: args.request, pipelineName, pipelineFileName, pipeline, skills, config, explicitPipeline: Boolean(args.pipeline) });
if (args.json) console.log(JSON.stringify(manifest, null, 2));
else printText(manifest);

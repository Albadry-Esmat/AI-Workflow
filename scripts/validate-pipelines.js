#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const pipelineDir = process.env.AIW_PIPELINE_DIR || path.join(root, "skills", "pipelines");
const skillDir = process.env.AIW_SKILL_DIR || path.join(root, ".opencode", "skills");

const failures = [];
let pipelinesChecked = 0;

function fail(file, message) {
  failures.push(`${file}: ${message}`);
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    fail(path.relative(root, file), `invalid JSON: ${error.message}`);
    return null;
  }
}

function skillExists(name) {
  return fs.existsSync(path.join(skillDir, name, "SKILL.md"));
}

function collectSteps(config) {
  const steps = [];
  if (Array.isArray(config.skills)) {
    for (const step of config.skills) steps.push({ step, phase: null });
  }
  if (Array.isArray(config.phases)) {
    for (const phase of config.phases) {
      for (const step of phase.skills || []) steps.push({ step, phase });
    }
  }
  return steps;
}

function validateCondition(relative, condition, label) {
  if (typeof condition !== "string" || condition.trim().length === 0) {
    fail(relative, `${label} is empty`);
    return;
  }
  if (/[;`]|\b(?:require|import|process|global|eval|Function|constructor|__proto__)\b/.test(condition)) {
    fail(relative, `${label} contains a forbidden expression token`);
    return;
  }
  let normalized = condition.replace(/\bOR\b/g, "||").replace(/\bAND\b/g, "&&").replace(/\bNOT\b/g, "!");
  try {
    new vm.Script(`(${normalized})`);
  } catch (error) {
    fail(relative, `${label} is not valid JS-like syntax: ${error.message}`);
  }
}

function validateReference(relative, reference, currentPhaseIndex, phaseIdList, label) {
  const phaseRefs = [];
  for (const match of String(reference).matchAll(/phase_outputs\[['\"]([^'\"]+)['\"]\]/g)) phaseRefs.push(match[1]);
  for (const match of String(reference).matchAll(/\$([A-Za-z0-9_-]+)(?:\.|$)/g)) phaseRefs.push(match[1]);
  for (const phaseId of phaseRefs) {
    const targetIndex = phaseIdList.indexOf(phaseId);
    if (targetIndex < 0) fail(relative, `${label} references unknown phase/artifact producer: ${phaseId}`);
    else if (targetIndex > currentPhaseIndex) fail(relative, `${label} consumes output from a future phase: ${phaseId}`);
  }
}

function inspectValueReferences(relative, value, currentPhaseIndex, phaseIdList, label) {
  if (typeof value === "string") validateReference(relative, value, currentPhaseIndex, phaseIdList, label);
  else if (Array.isArray(value)) value.forEach((item, index) => inspectValueReferences(relative, item, currentPhaseIndex, phaseIdList, `${label}[${index}]`));
  else if (value && typeof value === "object") Object.entries(value).forEach(([key, item]) => inspectValueReferences(relative, item, currentPhaseIndex, phaseIdList, `${label}.${key}`));
}

for (const fileName of fs.readdirSync(pipelineDir).filter((name) => name.endsWith(".json")).sort()) {
  const file = path.join(pipelineDir, fileName);
  const relative = path.relative(root, file);
  const config = readJson(file);
  if (!config) continue;
  pipelinesChecked += 1;

  const phases = Array.isArray(config.phases) ? config.phases : [];
  const phaseIdList = phases.map((phase) => phase.id).filter(Boolean);
  const phaseIds = new Set();
  for (const phase of phases) {
    if (!phase.id) {
      fail(relative, "phase is missing id");
    } else if (phaseIds.has(phase.id)) {
      fail(relative, `duplicate phase id: ${phase.id}`);
    } else {
      phaseIds.add(phase.id);
    }
    if (!Array.isArray(phase.skills) || phase.skills.length === 0) {
      fail(relative, `phase ${phase.id || "<unknown>"} has no skills`);
    }
    if (phase.condition !== undefined) validateCondition(relative, phase.condition, `phase ${phase.id || "<unknown>"} condition`);
  }

  const steps = collectSteps(config);
  const stepNames = new Set();
  const asyncNames = new Set(config.async_skills || []);
  for (const { step, phase } of steps) {
    if (!step || typeof step.name !== "string" || step.name.length === 0) {
      fail(relative, "skill step is missing name");
      continue;
    }
    stepNames.add(step.name);
    if (!skillExists(step.name)) {
      fail(relative, `skill is not executable: ${step.name}`);
    }
    if (step.async === true && !asyncNames.has(step.name)) {
      fail(relative, `async step ${step.name} is missing from async_skills`);
    }
    if (step.async === true && phase && config.gates?.some((gate) => gate.after_phase === phase.id)) {
      fail(relative, `async step ${step.name} is inside gated phase ${phase.id}`);
    }
    const currentPhaseIndex = phase ? phaseIdList.indexOf(phase.id) : 0;
    inspectValueReferences(relative, step.inputs, currentPhaseIndex, phaseIdList, `${step.name}.inputs`);
    inspectValueReferences(relative, step.input_overrides, currentPhaseIndex, phaseIdList, `${step.name}.input_overrides`);
    inspectValueReferences(relative, step.config, currentPhaseIndex, phaseIdList, `${step.name}.config`);
  }

  for (const asyncName of asyncNames) {
    if (!stepNames.has(asyncName)) {
      fail(relative, `async_skills references a skill not present in the pipeline: ${asyncName}`);
    }
  }

  for (const gate of config.gates || []) {
    if (gate.after_phase && !phaseIds.has(gate.after_phase)) {
      fail(relative, `gate references unknown phase: ${gate.after_phase}`);
    }
    if (!gate.after_phase && !gate.after_skill) {
      fail(relative, "gate must specify after_phase or after_skill");
    }
    if (["condition", "auto"].includes(gate.type) && typeof gate.condition !== "string") {
      fail(relative, `${gate.type} gate is missing condition`);
    }
    if (gate.condition !== undefined) validateCondition(relative, gate.condition, `${gate.type || "gate"} condition`);
    if (gate.timeout === 0 && gate.bypass_on_timeout !== false) {
      fail(relative, "indefinite gate must set bypass_on_timeout=false");
    }
  }

  const deploymentPhases = phases
    .filter((phase) => (phase.skills || []).some((step) => step.name === "deployment-strategy"))
    .map((phase) => phase.id);
  const hasDeployment = steps.some(({ step }) => step.name === "deployment-strategy");
  if (hasDeployment) {
    const deploymentPhaseIndex = Math.min(...deploymentPhases.map((phaseId) => phaseIdList.indexOf(phaseId)).filter((index) => index >= 0));
    const deploymentGate = (config.gates || []).some((gate) => {
      const gatePhaseIndex = gate.after_phase ? phaseIdList.indexOf(gate.after_phase) : -1;
      const isAfterDeployment = gate.after_skill === "deployment-strategy" ||
        (deploymentPhaseIndex >= 0 && gatePhaseIndex >= deploymentPhaseIndex);
      return gate.type === "human_approval" && isAfterDeployment && gate.timeout === 0 && gate.bypass_on_timeout === false;
    });
    if (!deploymentGate) {
      fail(relative, `deployment-strategy requires a non-bypassable indefinite human approval gate after ${deploymentPhases.join(", ") || "the deployment step"}`);
    }
  }

  const parallelGroupNames = new Set();
  for (const group of config.parallel_groups || []) {
    if (!Array.isArray(group) || group.length < 2) {
      fail(relative, "parallel group must contain at least two skills");
      continue;
    }
    for (const rawName of group) {
      const baseName = String(rawName).split(":")[0];
      parallelGroupNames.add(baseName);
      if (!stepNames.has(baseName) && !stepNames.has(rawName)) {
        fail(relative, `parallel group references skill not in pipeline: ${rawName}`);
      }
    }
  }

  if (config.mode === "hybrid" && !Array.isArray(config.parallel_groups)) {
    fail(relative, "hybrid pipeline must declare parallel_groups");
  }
}

if (failures.length > 0) {
  console.error(`Semantic pipeline validation failed (${pipelinesChecked} pipeline(s) checked):`);
  for (const failure of failures) console.error(`  FAIL: ${failure}`);
  process.exit(1);
}

console.log(`Semantic pipeline validation passed (${pipelinesChecked} pipeline(s) checked).`);

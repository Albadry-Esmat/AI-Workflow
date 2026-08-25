#!/usr/bin/env node
/**
 * Update generated site-content.json from authoritative repository statistics.
 *
 * Usage:
 *   node scripts/patch-site-content.js
 *   node scripts/patch-site-content.js --check
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SITE_CONTENT_PATH = path.join(ROOT, "website", "data", "site-content.json");
const checkMode = process.argv.includes("--check");

function countSkills() {
  const raw = fs.readFileSync(path.join(ROOT, "skills", "index.yaml"), "utf8");
  return (raw.match(/^- id:/gm) || []).length;
}

function getRegistryVersion() {
  const parsed = JSON.parse(fs.readFileSync(path.join(ROOT, "skills", "registry.json"), "utf8"));
  if (typeof parsed.version !== "string" || !parsed.version) throw new Error("registry.json has no valid version");
  return parsed.version;
}

function countPipelines() {
  return fs.readdirSync(path.join(ROOT, "skills", "pipelines")).filter((file) => file.endsWith(".json")).length;
}

function fullPipeline() {
  const parsed = JSON.parse(fs.readFileSync(path.join(ROOT, "skills", "pipelines", "full-pipeline.json"), "utf8"));
  if (!Array.isArray(parsed.phases)) throw new Error("full-pipeline.json has no phases array");
  if (!Array.isArray(parsed.gates)) throw new Error("full-pipeline.json has no gates array");
  return parsed;
}

function countPipelinePhases() {
  return fullPipeline().phases.length;
}

function countPipelineGates() {
  return fullPipeline().gates.length;
}

function countAgents() {
  const parsed = JSON.parse(fs.readFileSync(path.join(ROOT, "opencode.json"), "utf8"));
  if (!parsed.agent || typeof parsed.agent !== "object") throw new Error("opencode.json has no agent object");
  return Object.keys(parsed.agent).length;
}

function getLatestVersion() {
  const raw = fs.readFileSync(path.join(ROOT, "docs", "changelog.md"), "utf8");
  const match = raw.match(/^## \[(\d+\.\d+\.\d+)\]/m);
  return match ? match[1] : getRegistryVersion();
}

function requireObject(root, pathParts) {
  let current = root;
  for (const part of pathParts) {
    if (!current || typeof current !== "object" || !(part in current)) {
      throw new Error(`site-content.json is missing required field: ${pathParts.join(".")}`);
    }
    current = current[part];
  }
  return current;
}

function requireString(root, pathParts) {
  const value = requireObject(root, pathParts);
  if (typeof value !== "string") throw new Error(`site-content.json field must be a string: ${pathParts.join(".")}`);
  return value;
}

function requireArray(root, pathParts) {
  const value = requireObject(root, pathParts);
  if (!Array.isArray(value)) throw new Error(`site-content.json field must be an array: ${pathParts.join(".")}`);
  return value;
}

function validateShape(content) {
  requireString(content, ["$schema"]);
  requireString(content, ["$version"]);
  requireString(content, ["$description"]);
  requireString(content, ["meta", "description"]);
  requireString(content, ["meta", "openGraph", "description"]);
  requireString(content, ["meta", "twitter", "description"]);
  requireString(content, ["hero", "badge"]);
  const statsValues = requireArray(content, ["hero", "statsValues"]);
  if (statsValues.length !== 3 || statsValues.some((value) => typeof value !== "string")) {
    throw new Error("site-content.json hero.statsValues must contain three strings");
  }
}

function stats() {
  const skills = countSkills();
  const agents = countAgents();
  const pipelines = countPipelines();
  const phases = countPipelinePhases();
  const gates = countPipelineGates();
  const version = getLatestVersion();
  const registryVersion = getRegistryVersion();
  return { skills, agents, pipelines, phases, gates, version, registryVersion };
}

function apply(content, values) {
  validateShape(content);
  content["$version"] = values.registryVersion;
  content["$description"] = `Single source of truth for all ASE-OS website content. Synced to ASE-OS-Website via \`aiw sync --website\`. Last synced: pipeline v${values.version} — ${values.skills} skills, ${values.agents} agents, ${values.pipelines} pipelines, ${values.phases} phases.`;
  content.meta.description = `A unified, skill-driven, event-driven AI engineering system that designs, generates, tests, and documents software autonomously. ${values.skills} skills · ${values.agents} agents · ${values.pipelines} pipeline templates · v${values.version}.`;
  content.meta.openGraph.description = `A unified, skill-driven AI system that takes your idea from requirements to deployed software — automatically, with zero documentation drift. ${values.skills} skills, ${values.agents} agents, ${values.pipelines} pipeline templates.`;
  content.meta.twitter.description = `Skill-driven AI engineering. Full requirements traceability. Ideas to deployed software, automatically. v${values.version} — ${values.skills} skills, ${values.agents} agents.`;
  content.hero.badge = `v${values.version} — Skill System`;
  content.hero.statsValues = [String(values.skills), String(values.phases), String(values.agents)];

  const templates = content.pipelineTemplates?.templates;
  const fullTemplate = Array.isArray(templates) ? templates.find((template) => template?.id === "full-pipeline") : null;
  if (fullTemplate && typeof fullTemplate.description === "string") {
    fullTemplate.description = fullTemplate.description.replace(/\d+ phases, \d+ gates/, `${values.phases} phases, ${values.gates} gates`);
  }
  validateShape(content);
  return content;
}

function main() {
  if (!fs.existsSync(SITE_CONTENT_PATH)) {
    console.log("  INFO: website/data/site-content.json not found — skipping patch");
    return;
  }

  let content;
  try {
    content = JSON.parse(fs.readFileSync(SITE_CONTENT_PATH, "utf8"));
  } catch (error) {
    throw new Error(`site-content.json is invalid JSON: ${error.message}`);
  }

  const before = JSON.stringify(content, null, 2);
  const values = stats();
  const updated = apply(content, values);
  const after = `${JSON.stringify(updated, null, 2)}\n`;

  if (before === after.trimEnd()) {
    console.log("  ✓ site-content.json is already up to date");
    return;
  }

  if (checkMode) {
    console.error(`  FAIL: site-content.json has stale generated values (skills=${values.skills}, agents=${values.agents}, pipelines=${values.pipelines}, phases=${values.phases}, gates=${values.gates}, version=${values.version})`);
    process.exitCode = 1;
    return;
  }

  const temporary = `${SITE_CONTENT_PATH}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, after, { encoding: "utf8", mode: 0o644 });
  fs.renameSync(temporary, SITE_CONTENT_PATH);
  console.log(`  ✓ Patched site-content.json: ${values.skills} skills, ${values.agents} agents, ${values.pipelines} pipelines, ${values.phases} phases, ${values.gates} gates, v${values.version}`);
}

try {
  main();
} catch (error) {
  console.error(`  FAIL: ${error.message}`);
  process.exitCode = 1;
}

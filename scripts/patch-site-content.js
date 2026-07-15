#!/usr/bin/env node
/**
 * scripts/patch-site-content.js
 *
 * Auto-patches website/data/site-content.json with live-derived counts from
 * the authoritative source files (skills/index.yaml, skills/registry.json,
 * skills/pipelines/, opencode.json, docs/changelog.md).
 *
 * Run before sync to ensure site-content.json never has stale numbers.
 * Called automatically by sync-website-data.sh and the CI sync workflow.
 *
 * Usage:
 *   node scripts/patch-site-content.js           # patch in place
 *   node scripts/patch-site-content.js --check   # exit 1 if patch would change anything
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SITE_CONTENT_PATH = path.join(ROOT, "website", "data", "site-content.json");

// ── Derive live stats ────────────────────────────────────────────────────────

function countSkills() {
  const raw = fs.readFileSync(path.join(ROOT, "skills", "index.yaml"), "utf8");
  // Each skill entry starts with "- id:" at the top level
  return (raw.match(/^- id:/gm) || []).length;
}

function getRegistryVersion() {
  const raw = fs.readFileSync(path.join(ROOT, "skills", "registry.json"), "utf8");
  const parsed = JSON.parse(raw);
  return parsed.version || "0.0.0";
}

function countPipelines() {
  const dir = path.join(ROOT, "skills", "pipelines");
  return fs.readdirSync(dir).filter(f => f.endsWith(".json")).length;
}

function countPipelinePhases() {
  const raw = fs.readFileSync(path.join(ROOT, "skills", "pipelines", "full-pipeline.json"), "utf8");
  const parsed = JSON.parse(raw);
  return (parsed.phases || []).length;
}

function countAgents() {
  const raw = fs.readFileSync(path.join(ROOT, "opencode.json"), "utf8");
  const parsed = JSON.parse(raw);
  return Object.keys(parsed.agent || {}).length;
}

function getLatestVersion() {
  const raw = fs.readFileSync(path.join(ROOT, "docs", "changelog.md"), "utf8");
  const match = raw.match(/## \[(\d+\.\d+\.\d+)\]/);
  return match ? match[1] : getRegistryVersion();
}

// ── Patch logic ──────────────────────────────────────────────────────────────

function main() {
  const checkMode = process.argv.includes("--check");

  if (!fs.existsSync(SITE_CONTENT_PATH)) {
    console.log("  INFO: website/data/site-content.json not found — skipping patch");
    process.exit(0);
  }

  const skills = countSkills();
  const agents = countAgents();
  const pipelines = countPipelines();
  const phases = countPipelinePhases();
  const version = getLatestVersion();
  const registryVersion = getRegistryVersion();

  let raw = fs.readFileSync(SITE_CONTENT_PATH, "utf8");
  const original = raw;

  // Replace stats patterns wherever they appear
  // Pattern: "N skills" (case insensitive within the JSON strings)
  raw = raw.replace(
    /"\$description":\s*"[^"]*"/,
    `"$description": "Single source of truth for all ASE-OS website content. Synced to ASE-OS-Website via \`aiw sync --website\`. Last synced: pipeline v${version} — ${skills} skills, ${agents} agents, ${pipelines} pipelines, ${phases} phases."`
  );

  // meta.description
  raw = raw.replace(
    /("meta"[\s\S]*?"description":\s*)"[^"]*"/,
    `$1"A unified, skill-driven, event-driven AI engineering system that designs, generates, tests, and documents software autonomously. ${skills} skills · ${agents} agents · ${pipelines} pipeline templates · v${version}."`
  );

  // openGraph.description
  raw = raw.replace(
    /("openGraph"[\s\S]*?"description":\s*)"[^"]*"/,
    `$1"A unified, skill-driven AI system that takes your idea from requirements to deployed software — automatically, with zero documentation drift. ${skills} skills, ${agents} agents, ${pipelines} pipeline templates."`
  );

  // twitter.description
  raw = raw.replace(
    /("twitter"[\s\S]*?"description":\s*)"[^"]*"/,
    `$1"Skill-driven AI engineering. Full requirements traceability. Ideas to deployed software, automatically. v${version} — ${skills} skills, ${agents} agents."`
  );

  // hero.badge
  raw = raw.replace(
    /("badge":\s*)"[^"]*"/,
    `$1"v${version} — Skill System"`
  );

  // hero.statsValues
  raw = raw.replace(
    /("statsValues":\s*)\[[^\]]*\]/,
    `$1["${skills}", "${phases}", "${agents}"]`
  );

  // $version at top level
  raw = raw.replace(
    /("\$version":\s*)"[^"]*"/,
    `$1"${registryVersion}"`
  );

  if (raw === original) {
    console.log("  ✓ site-content.json is already up to date");
    process.exit(0);
  }

  if (checkMode) {
    console.log(`  FAIL: site-content.json has stale counts (skills=${skills}, agents=${agents}, pipelines=${pipelines}, phases=${phases}, version=${version})`);
    process.exit(1);
  }

  fs.writeFileSync(SITE_CONTENT_PATH, raw, "utf8");
  console.log(`  ✓ Patched site-content.json: ${skills} skills, ${agents} agents, ${pipelines} pipelines, ${phases} phases, v${version}`);
}

main();

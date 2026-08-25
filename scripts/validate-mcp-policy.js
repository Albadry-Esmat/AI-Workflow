#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const policyPath = process.env.AIW_MCP_POLICY || path.join(root, "mcp-permission-policy.json");
const configPath = process.env.AIW_MCP_CONFIG || path.join(root, "opencode.json");
const profileName = process.env.AIW_MCP_PROFILE || "pilot-read-only";

const failures = [];
const pass = [];

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    failures.push(`${path.relative(root, file)}: invalid JSON: ${error.message}`);
    return null;
  }
}

const policy = readJson(policyPath);
const config = readJson(configPath);
const profile = policy?.profiles?.[profileName];

if (!profile) failures.push(`unknown MCP policy profile: ${profileName}`);
if (!config || !policy || !profile) {
  console.error(`MCP policy validation failed (${failures.length} issue(s)).`);
  failures.forEach((failure) => console.error(`  FAIL: ${failure}`));
  process.exit(1);
}

const vocabulary = new Set(policy.capability_vocabulary || []);
for (const [name, currentProfile] of Object.entries(policy.profiles || {})) {
  if (!Array.isArray(currentProfile.allowed_capabilities)) failures.push(`profile has no allowed_capabilities list: ${name}`);
  for (const capability of currentProfile.allowed_capabilities || []) {
    if (!vocabulary.has(capability)) failures.push(`profile ${name} uses unknown capability: ${capability}`);
  }
  const writes = (currentProfile.allowed_capabilities || []).some((capability) => /^write:|^deploy$/.test(capability));
  if (writes && !currentProfile.required_approval) failures.push(`write-capable profile has no approval requirement: ${name}`);
  if (currentProfile.allowed_external_writes === true && (!Array.isArray(currentProfile.credential_requirements) || currentProfile.credential_requirements.length === 0)) failures.push(`external-write profile has no credential requirement: ${name}`);
}

const configured = config.mcp || {};
const configuredNames = new Set(Object.keys(configured));
const enabledNames = new Set(Object.entries(configured).filter(([, server]) => server && server.enabled === true).map(([name]) => name));
const allowedNames = new Set(profile.enabled_servers || []);
const disabledNames = new Set(profile.disabled_servers || []);

for (const name of profile.enabled_servers || []) {
  if (!configuredNames.has(name)) failures.push(`profile requires configured server that is missing: ${name}`);
}
for (const name of profile.disabled_servers || []) {
  if (enabledNames.has(name)) failures.push(`profile-disabled server is enabled in opencode.json: ${name}`);
}
for (const name of enabledNames) {
  if (!allowedNames.has(name)) failures.push(`enabled server is not allowed by ${profileName}: ${name}`);
}
for (const [name, server] of Object.entries(configured)) {
  if (!server || typeof server !== "object") {
    failures.push(`server configuration is not an object: ${name}`);
    continue;
  }
  if (server.enabled === true && (!Array.isArray(server.command) || server.command.length === 0)) {
    failures.push(`enabled server has no executable command: ${name}`);
  }
  if (server.enabled === true && profile.allowed_external_writes === false && ["slack", "vercel", "playwright"].includes(name)) {
    failures.push(`potential side-effect server is enabled in read-only profile: ${name}`);
  }
  if (server.command && Array.isArray(server.command)) {
    const packageArgs = server.command.filter((value) => typeof value === "string" && value.includes("@"));
    for (const value of packageArgs) {
      if (!/@(?:\^|~)?\d+\.\d+\.\d+$/.test(value)) failures.push(`MCP package command is not semver-pinned: ${name} -> ${value}`);
    }
  }
}

for (const name of enabledNames) pass.push(`enabled and policy-allowed: ${name}`);
for (const name of disabledNames) pass.push(`disabled by pilot policy: ${name}`);

if (failures.length) {
  console.error(`MCP policy validation failed (${failures.length} issue(s)).`);
  failures.forEach((failure) => console.error(`  FAIL: ${failure}`));
  process.exit(1);
}

console.log(`MCP policy validation passed (${profileName}).`);
pass.forEach((item) => console.log(`  PASS: ${item}`));

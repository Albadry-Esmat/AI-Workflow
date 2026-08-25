#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const cp = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const errors = [];
const warnings = [];

function readJson(relative) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relative), "utf8"));
}

function validateMcp(config) {
  for (const [name, server] of Object.entries(config.mcp || {})) {
    if (!Array.isArray(server.command) || server.command.length === 0) {
      errors.push(`MCP server ${name} has no command array`);
      continue;
    }
    const command = server.command.join(" ");
    if (server.command[0] === "npx") {
      if (server.command[1] !== "-y") errors.push(`MCP server ${name} must use npx -y for non-interactive execution`);
      const packageName = server.command[2];
      for (const packageRef of [packageName]) {
        if (typeof packageRef !== "string" || !packageRef.includes("@") || !/^(?:@[^/]+\/)?[^@]+@[^@/]+$/.test(packageRef)) {
          errors.push(`MCP server ${name} has an unpinned package: ${packageRef}`);
        }
      }
    } else {
      warnings.push(`MCP server ${name} uses a non-npx command: ${command}`);
    }
    for (const [key, value] of Object.entries(server.env || {})) {
      if (typeof value !== "string" || !/^\$\{[A-Z0-9_]+\}$/.test(value)) {
        errors.push(`MCP server ${name} env ${key} must reference an environment placeholder`);
      }
    }
  }
}

function validateAgents(config) {
  for (const [name, agent] of Object.entries(config.agent || {})) {
    const permission = agent.permission || {};
    for (const key of ["edit", "bash"]) {
      if (!["ask", "deny", "allow"].includes(permission[key])) {
        errors.push(`Agent ${name} has invalid ${key} permission: ${permission[key]}`);
      }
    }
  }
  const primary = config.agent?.primary;
  if (!primary || primary.permission?.edit !== "ask" || primary.permission?.bash !== "ask") {
    errors.push("Primary agent must require approval for edit and bash permissions");
  }
}

function validateTrackedSecrets() {
  let files;
  try {
    files = cp.execFileSync("git", ["-C", ROOT, "ls-files", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
  } catch (error) {
    errors.push(`Unable to enumerate tracked files: ${error.message}`);
    return;
  }
  const secretPatterns = [
    /ghp_[A-Za-z0-9]{20,}/,
    /github_pat_[A-Za-z0-9_]{20,}/,
    /sk-[A-Za-z0-9]{20,}/,
    /xox[baprs]-[A-Za-z0-9-]{20,}/,
  ];
  for (const relative of files) {
    if (/(^|\/)\.env$/.test(relative)) errors.push(`Tracked populated environment file: ${relative}`);
    let content;
    try { content = fs.readFileSync(path.join(ROOT, relative), "utf8"); } catch { continue; }
    if (secretPatterns.some((pattern) => pattern.test(content))) errors.push(`Secret-like token found in tracked file: ${relative}`);
  }
}

try {
  const config = readJson("opencode.json");
  validateMcp(config);
  validateAgents(config);
  validateTrackedSecrets();
} catch (error) {
  errors.push(error.message);
}

console.log(`Security policy validation: ${errors.length === 0 ? "PASS" : "FAIL"}`);
for (const warning of warnings) console.log(`  WARN: ${warning}`);
for (const error of errors) console.log(`  FAIL: ${error}`);
process.exit(errors.length === 0 ? 0 : 1);

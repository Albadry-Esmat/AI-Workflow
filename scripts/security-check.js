#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const failures = [];

function fail(message) {
  failures.push(message);
  console.error(`FAIL ${message}`);
}

function pass(message) {
  console.log(`PASS ${message}`);
}

let config;
try {
  config = JSON.parse(fs.readFileSync(path.join(root, "opencode.json"), "utf8"));
} catch (error) {
  fail(`opencode.json cannot be parsed: ${error.message}`);
}

for (const [name, server] of Object.entries(config?.mcp || {})) {
  const command = (server.command || []).join(" ");
  const packageToken = (server.command || []).find((token) => token.startsWith("@") || token.includes("-mcp@") || token.includes("server-"));
  if (!packageToken || !(/@\d+\.\d+\.\d+/.test(packageToken))) {
    fail(`MCP server ${name} is not pinned to a semantic package version: ${command}`);
  }
}
if (!failures.length) pass("all MCP package commands are semver-pinned");

const workflowDirectory = path.join(root, ".github", "workflows");
for (const fileName of fs.readdirSync(workflowDirectory).filter((name) => name.endsWith(".yml") || name.endsWith(".yaml"))) {
  const file = path.join(workflowDirectory, fileName);
  const contents = fs.readFileSync(file, "utf8");
  for (const match of contents.matchAll(/^\s*uses:\s*([^\s#]+)/gm)) {
    const ref = match[1].split("@")[1] || "";
    if (!/^[0-9a-f]{40}$/.test(ref)) fail(`${fileName} uses mutable action ref: ${match[1]}`);
  }
}
if (!failures.some((message) => message.includes("mutable action"))) pass("all GitHub Actions use immutable commit SHAs");

const tracked = execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" }).trim().split("\n").filter(Boolean);
const secretFilePattern = /(^|\/)(\.env|.*\.pem|.*\.key|.*credentials.*)$/i;
for (const file of tracked) if (secretFilePattern.test(file)) fail(`credential-like file is tracked: ${file}`);
if (!tracked.some((file) => secretFilePattern.test(file))) pass("no credential-like files are tracked");

let suspicious = "";
try {
  suspicious = execFileSync("git", ["grep", "-nE", "ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9]{20,}", "--", ":!.env.example", ":!docs/**"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
} catch (error) {
  if (error.status !== 1) throw error;
}
if (suspicious) fail("credential-like token pattern found outside templates/docs");
else pass("no credential-like token patterns found outside templates/docs");

const envFile = path.join(root, ".env");
if (fs.existsSync(envFile) && process.platform !== "win32") {
  const mode = fs.statSync(envFile).mode & 0o777;
  if (mode !== 0o600) fail(`.env permissions are ${mode.toString(8)}; expected 600`);
  else pass(".env permissions are owner-only (600)");
}

if (failures.length) {
  console.error(`\nSecurity check failed (${failures.length} issue(s)).`);
  process.exit(1);
}
console.log("Security check passed.");

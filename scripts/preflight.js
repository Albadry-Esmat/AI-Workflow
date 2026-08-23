#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const failures = [];

function fail(message) {
  failures.push(message);
  console.error(`FAIL ${message}`);
}

function pass(message) {
  console.log(`PASS ${message}`);
}

function run(label, command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8", ...options });
  if (result.status !== 0) {
    fail(`${label}: ${(result.stderr || result.stdout || "command failed").trim().split("\n").slice(-4).join(" ")}`);
    return false;
  }
  pass(label);
  return true;
}

const compatibilityPath = path.join(root, "compatibility.json");
let compatibility;
try {
  compatibility = JSON.parse(fs.readFileSync(compatibilityPath, "utf8"));
  pass("compatibility manifest parses");
} catch (error) {
  fail(`compatibility manifest: ${error.message}`);
}

function versionParts(value) {
  const match = String(value).match(/v?(\d+)\.(\d+)\.(\d+)/);
  return match ? match.slice(1).map(Number) : null;
}

const nodeVersion = versionParts(process.version);
if (!nodeVersion || nodeVersion[0] < 20 || nodeVersion[0] >= 23) fail(`Node.js ${process.version} is outside the supported >=20 <23 range`);
else pass(`Node.js ${process.version} is supported`);

if (!fs.existsSync(path.join(root, "package-lock.json"))) fail("package-lock.json is missing");
else pass("package-lock.json is present");

const opencode = spawnSync("opencode", ["--version"], { encoding: "utf8" });
if (opencode.status !== 0) fail("OpenCode CLI is missing or cannot report its version");
else pass(`OpenCode CLI is available (${(opencode.stdout || "").trim()})`);

const envPath = path.join(root, ".env");
if (!fs.existsSync(envPath)) fail(".env is missing; run aiw setup and configure credentials");
else {
  const mode = fs.statSync(envPath).mode & 0o777;
  if (process.platform !== "win32" && mode !== 0o600) fail(`.env permissions are ${mode.toString(8)}; expected 600`);
  else pass(".env exists with owner-only permissions");
  const envText = fs.readFileSync(envPath, "utf8");
  const githubToken = envText.split(/\r?\n/).find((line) => /^\s*GITHUB_TOKEN\s*=/.test(line));
  if (!githubToken || /^\s*GITHUB_TOKEN\s*=\s*(#.*)?$/.test(githubToken)) fail("GITHUB_TOKEN is missing or empty in .env");
  else pass("GITHUB_TOKEN is configured (value not printed)");
}

run("semantic pipeline validation", process.execPath, ["scripts/validate-pipelines.js"]);
run("security and supply-chain check", process.execPath, ["scripts/security-check.js"]);
run("dependency vulnerability audit", "npm", ["audit", "--audit-level=high", "--omit=optional"]);
run("credential-free self-test", process.execPath, ["scripts/self-test.js"]);
run("structural validation", "bash", ["scripts/validate-skills.sh"]);
run("website mirror check", "bash", ["scripts/sync-website-data.sh", "--check"]);

if (fs.existsSync(path.join(root, "node_modules"))) run("Jest conformance tests", "npm", ["test", "--", "--runInBand"]);
else fail("node_modules is missing; run npm ci before strict preflight");

const sourceEnv = fs.existsSync(path.join(root, ".env")) ? fs.readFileSync(path.join(root, ".env"), "utf8") : "";
if (/^(GITHUB_TOKEN|OPENAI_API_KEY|.*TOKEN|.*SECRET|.*PASSWORD)=\S+/m.test(sourceEnv)) {
  console.log("INFO configured credentials detected in .env; values were not printed");
}

if (failures.length) {
  console.error(`\nStrict preflight failed (${failures.length} issue(s)).`);
  process.exit(1);
}
console.log("\nStrict preflight passed. Release gates may proceed.");

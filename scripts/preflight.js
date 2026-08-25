#!/usr/bin/env node

const fs = require("fs");
const os = require("os");
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

const requiredReleaseFiles = [
  "compatibility.json",
  ".github/branch-protection-policy.json",
  "docs/operations/production-runbook.md",
  "docs/operations/release-checklist.md",
  "mcp-permission-policy.json",
  "execution-budget.json",
  "tests/fixtures/golden-artifacts.json",
  "skills/schema/execution-event.schema.json",
  "tests/fixtures/pilot-evidence.json",
  "artifact-quality-policy.json",
  "tests/fixtures/requirements-artifact.json",
  ".ai-workflow/config.json",
  ".ai-workflow/adapter-registry.json",
  ".ai-workflow/runtime-capability-matrix.json",
  ".ai-workflow/schemas/runtime-adapter.schema.json",
  ".ai-workflow/schemas/runtime-request.schema.json",
  ".ai-workflow/schemas/runtime-event.schema.json",
  ".ai-workflow/schemas/approval-request.schema.json",
  ".ai-workflow/schemas/checkpoint.schema.json",
  ".ai-workflow/schemas/artifact-envelope.schema.json",
  ".ai-workflow/schemas/runtime-certification.schema.json",
  "adapters/opencode/index.js",
  "adapters/claude-code/index.js",
  "adapters/codex-cli/index.js",
  "adapters/gemini-cli/index.js",
  "adapters/aider/index.js",
  "adapters/cursor/index.js",
  "adapters/github-copilot/index.js",
  "adapters/cline-roo/index.js",
  "adapters/windsurf/index.js",
  "scripts/adapter-certification.js",
  "scripts/certify-adapters.js",
  "scripts/install-projections.js",
  "scripts/verify-website-sync.js",
  "scripts/documentation-policy.json",
  "scripts/verify-documentation-policy.js",
  "scripts/validate-runtime-certification.js",
  "scripts/runtime-version-watch.js",
  "scripts/release-status.js",
  "scripts/validate-release-approval.js",
  ".ai-workflow/schemas/release-approval.schema.json",
  "tests/fixtures/release-approval.json",
  "docs/documentation-policy.md",
];
for (const relative of requiredReleaseFiles) {
  if (!fs.existsSync(path.join(root, relative))) fail(`required release file is missing: ${relative}`);
  else pass(`required release file present: ${relative}`);
}

const compatibilityPath = path.join(root, "compatibility.json");
let compatibility;
try {
  compatibility = JSON.parse(fs.readFileSync(compatibilityPath, "utf8"));
  pass("compatibility manifest parses");
} catch (error) {
  fail(`compatibility manifest: ${error.message}`);
}

try {
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  if (compatibility?.cli_version !== packageJson.version) fail(`compatibility cli_version ${compatibility?.cli_version || "missing"} does not match package version ${packageJson.version}`);
  else pass("compatibility CLI version matches package version");
  const schemaText = fs.readFileSync(path.join(root, "skills", "schema", "pipeline-schema.json"), "utf8");
  const schemaVersion = schemaText.match(/schema-version:\s*([0-9.]+)/)?.[1];
  if (schemaVersion && compatibility?.schema_version !== schemaVersion) fail(`compatibility schema_version ${compatibility?.schema_version || "missing"} does not match pipeline schema ${schemaVersion}`);
  else pass("compatibility schema version matches pipeline schema");
} catch (error) {
  fail(`compatibility cross-check: ${error.message}`);
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

const opencode = spawnSync(process.env.AIW_OPENCODE_BIN || "opencode", ["--version"], { encoding: "utf8" });
if (opencode.status !== 0) fail("OpenCode CLI is missing or cannot report its version");
else pass(`OpenCode CLI is available (${(opencode.stdout || "").trim()})`);
run("strict OpenCode runtime-version watch", process.execPath, ["scripts/runtime-version-watch.js", "--runtime", "opencode", "--strict"]);

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
run("MCP pilot permission policy", process.execPath, ["scripts/validate-mcp-policy.js"]);
run("execution budget policy", process.execPath, ["scripts/validate-execution-budget.js"]);
run("golden artifact compatibility", process.execPath, ["scripts/validate-golden-artifacts.js"]);
run("execution event schema", process.execPath, ["scripts/validate-events.js"]);
run("pilot evidence contract", process.execPath, ["scripts/validate-pilot-evidence.js"]);
run("runtime certification evidence", process.execPath, ["scripts/validate-runtime-certification.js"]);
run("sanitized release-status handoff", process.execPath, ["scripts/release-status.js"]);
run("release approval evidence", process.execPath, ["scripts/validate-release-approval.js"]);
run("artifact quality policy", process.execPath, ["scripts/score-artifact.js", "--type", "requirements", "--input", "tests/fixtures/requirements-artifact.json"]);
run("adapter configuration", process.execPath, ["scripts/validate-adapter-config.js"]);
run("adapter lifecycle policy", process.execPath, ["scripts/validate-adapter-lifecycle.js"]);
run("OpenCode reference adapter certification", process.execPath, ["scripts/adapter-certification.js", "opencode"]);
run("all adapter fixture certification", process.execPath, ["scripts/certify-adapters.js"]);
run("deterministic runtime projections", process.execPath, ["scripts/generate-projections.js", "--output", path.join(os.tmpdir(), "aiw-preflight-projections"), "--profile", "pilot-read-only"]);
run("documentation policy", process.execPath, ["scripts/verify-documentation-policy.js"]);
run("website mirror synchronization", process.execPath, ["scripts/verify-website-sync.js"]);
run("security and supply-chain history check", process.execPath, ["scripts/security-check.js", "--history"]);
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

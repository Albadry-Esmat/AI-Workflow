#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawnSync } = require("child_process");
const { appendEvent } = require("./lib/event-log");

const root = path.resolve(__dirname, "..");
const args = process.argv.slice(2);
function value(flag, fallback) {
  const index = args.indexOf(flag);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}
function has(flag) { return args.includes(flag); }
function usage() {
  console.error("Usage: node scripts/pilot-preflight.js --project-id ID [--pipeline NAME] [--profile PROFILE] [--output FILE] [--state-dir DIR] [--backup-root DIR]");
  process.exit(2);
}
if (has("--help") || has("-h")) usage();

const projectId = value("--project-id", "operator-input-required");
const pipeline = value("--pipeline", "requirements-only");
const profile = value("--profile", "pilot-read-only");
const correlationId = value("--correlation-id", `pilot-${crypto.randomUUID()}`);
const output = path.resolve(value("--output", path.join(root, ".opencode", "pilot-runs", `${correlationId}.json`)));
const stateDir = path.resolve(value("--state-dir", path.join(root, ".opencode", "state")));
const backupRoot = path.resolve(value("--backup-root", path.join(root, ".opencode", "pilot-backups")));
const backupDir = path.join(backupRoot, correlationId);
const lockFile = path.join(root, ".opencode", "pilot-preflight.lock");
const checks = [];

function check(name, passed, detail, blocking = true) {
  checks.push({ name, passed, blocking, detail });
  console.log(`${passed ? "PASS" : blocking ? "BLOCK" : "WARN"} ${name}: ${detail}`);
}
function versionParts(value) {
  const match = String(value).match(/v?(\d+)\.(\d+)\.(\d+)/);
  return match ? match.slice(1).map(Number) : null;
}
function command(label, commandName, commandArgs, env = {}) {
  const result = spawnSync(commandName, commandArgs, { cwd: root, encoding: "utf8", env: { ...process.env, ...env } });
  const detail = result.status === 0
    ? (result.stdout || "completed").trim().split(/\r?\n/).slice(-1)[0].slice(0, 240)
    : (result.stderr || result.stdout || "command failed").trim().split(/\r?\n/).slice(-1)[0].slice(0, 240);
  check(label, result.status === 0, detail || (result.status === 0 ? "completed" : "failed"));
  return result.status === 0;
}

fs.mkdirSync(path.dirname(output), { recursive: true, mode: 0o700 });
fs.mkdirSync(stateDir, { recursive: true, mode: 0o700 });
fs.mkdirSync(backupRoot, { recursive: true, mode: 0o700 });

const envPath = path.resolve(process.env.AIW_ENV_FILE || path.join(root, ".env"));
if (!fs.existsSync(envPath)) {
  check("environment file", false, ".env is missing; configure it on the operator machine");
} else {
  const mode = fs.statSync(envPath).mode & 0o777;
  check("environment file permissions", process.platform === "win32" || mode === 0o600, `mode ${mode.toString(8)}; values not read`);
  const envText = fs.readFileSync(envPath, "utf8");
  const tokenLine = envText.split(/\r?\n/).find((line) => /^\s*GITHUB_TOKEN\s*=/.test(line));
  const configured = Boolean(tokenLine && !/^\s*GITHUB_TOKEN\s*=\s*(#.*)?$/.test(tokenLine));
  check("GitHub credential presence", configured, configured ? "configured; value not printed" : "GITHUB_TOKEN is missing or empty");
}

const opencode = spawnSync("opencode", ["--version"], { cwd: root, encoding: "utf8" });
if (opencode.status !== 0) {
  check("OpenCode executable", false, "missing or unable to report a version");
} else {
  const reported = (opencode.stdout || opencode.stderr || "").trim().split(/\r?\n/)[0].slice(0, 120);
  const parts = versionParts(reported);
  check("OpenCode executable", Boolean(parts), parts ? `available (${reported})` : "version could not be parsed");
}

const policyPassed = command("MCP permission profile", process.execPath, ["scripts/validate-mcp-policy.js"], { AIW_MCP_PROFILE: profile });
const backupPassed = command("disposable state backup", process.execPath, ["scripts/state-backup.js", "backup", backupDir], {
  AIW_STATE_DIR: stateDir,
  AIW_BACKUP_ROOT: backupRoot,
  AIW_STATE_LOCK: lockFile,
});
if (backupPassed) command("backup checksum verification", process.execPath, ["scripts/state-backup.js", "verify", backupDir], {
  AIW_STATE_DIR: stateDir,
  AIW_BACKUP_ROOT: backupRoot,
  AIW_STATE_LOCK: lockFile,
});

const blocked = checks.filter((item) => item.blocking && !item.passed).map((item) => item.name);
const manifest = {
  manifest_version: "1.0.0",
  run_type: "constrained-live-smoke-preparation",
  status: blocked.length ? "blocked-before-live-execution" : "ready-for-operator-live-execution",
  correlation_id: correlationId,
  project_id: projectId.slice(0, 120),
  pipeline: pipeline.slice(0, 120),
  mcp_profile: profile,
  created_at: new Date().toISOString(),
  release_commit: (() => { try { return require("child_process").execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(); } catch (_) { return "unknown"; } })(),
  backup_path: backupPassed ? path.relative(root, backupDir) : null,
  live_execution: { attempted: false, operator_owned: true, raw_prompts_and_payloads_captured: false },
  blocking_checks: blocked,
  checks: checks.map(({ name, passed, blocking, detail }) => ({ name, passed, blocking, detail })),
  next_action: blocked.length ? "Resolve blocking operator prerequisites, rerun this command, then execute the documented smoke sequence." : "Run the constrained smoke sequence in docs/operations/live-smoke-test.md; this command does not execute OpenCode.",
};
fs.writeFileSync(output, `${JSON.stringify(manifest, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
try { fs.chmodSync(output, 0o600); } catch (_) {}
appendEvent({ event: "pilot_preflight", session_id: correlationId, pipeline_id: pipeline, status: manifest.status, message: `manifest=${path.relative(root, output)}` });
console.log(`Manifest written: ${path.relative(root, output)}`);
if (blocked.length) {
  console.error(`Pilot preparation blocked by: ${blocked.join(", ")}`);
  process.exit(1);
}
console.log("Pilot preparation passed. No live OpenCode or MCP execution was performed.");

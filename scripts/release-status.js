#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { execFileSync, spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const args = process.argv.slice(2);
const jsonOutput = args.includes("--json");
const strict = args.includes("--strict");
const outputIndex = args.indexOf("--output");
const outputPath = outputIndex >= 0 ? path.resolve(args[outputIndex + 1]) : null;
const failures = [];

function git(args) {
  try { return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim(); }
  catch (_) { return "unavailable"; }
}

function run(label, command, commandArgs) {
  const result = spawnSync(command, commandArgs, { cwd: root, encoding: "utf8", timeout: 120000, maxBuffer: 512 * 1024 });
  const output = String(result.stdout || result.stderr || "").replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]").replace(/(?:ghp_|github_pat_|sk-)[A-Za-z0-9_-]+/g, "[REDACTED]").replace(/\s+/g, " ").trim().slice(0, 300);
  const passed = result.status === 0;
  if (!passed) failures.push(label);
  return { status: passed ? "pass" : "fail", detail: output || (passed ? "completed" : "command failed") };
}

function readJson(relative) {
  try { return JSON.parse(fs.readFileSync(path.join(root, relative), "utf8")); }
  catch (_) { return {}; }
}

const compatibility = readJson("compatibility.json");
const registry = readJson(".ai-workflow/adapter-registry.json");
const lifecycle = readJson(".ai-workflow/adapter-lifecycle.json");
const branch = git(["branch", "--show-current"]);
const commit = git(["rev-parse", "HEAD"]);
const statusLines = git(["status", "--short"]).split(/\r?\n/).filter(Boolean);
const checks = {
  documentation_policy: run("documentation policy", process.execPath, ["scripts/verify-documentation-policy.js"]),
  website_sync: run("website synchronization", process.execPath, ["scripts/verify-website-sync.js"]),
  runtime_certification_fixture: run("runtime certification fixture", process.execPath, ["scripts/validate-runtime-certification.js", "tests/fixtures/runtime-certification.json"]),
  release_approval_fixture: run("release approval fixture", process.execPath, ["scripts/validate-release-approval.js", "tests/fixtures/release-approval.json"]),
  adapter_configuration: run("adapter configuration", process.execPath, ["scripts/validate-adapter-config.js"]),
  adapter_lifecycle: run("adapter lifecycle", process.execPath, ["scripts/validate-adapter-lifecycle.js"]),
  runtime_version_watch: run("runtime version watch", process.execPath, ["scripts/runtime-version-watch.js", ...(strict ? ["--strict"] : [])]),
};

let runtimeWatch = { results: [] };
try {
  runtimeWatch = JSON.parse(execFileSync(process.execPath, ["scripts/runtime-version-watch.js", "--json"], { cwd: root, encoding: "utf8" }));
} catch (_) {
  runtimeWatch = { results: [] };
}
const operatorBlockers = [];
for (const result of runtimeWatch.results || []) {
  if (["unavailable", "unsupported-version", "adapter-load-failed"].includes(result.status)) operatorBlockers.push(`${result.runtime_id}: ${result.status}`);
  if (result.status === "host-verification-required") operatorBlockers.push(`${result.runtime_id}: host-verification-required`);
}
if (!fs.existsSync(path.join(root, ".env"))) operatorBlockers.push("environment: .env-missing");

const report = {
  report_version: "1.0.0",
  generated_at: new Date().toISOString(),
  branch,
  commit,
  working_tree: statusLines.length ? "dirty" : "clean",
  compatibility: {
    manifest_version: compatibility.manifest_version || "unavailable",
    cli_version: compatibility.cli_version || "unavailable",
    registered_adapters: Object.keys(registry.adapters || {}).length,
    lifecycle_version: lifecycle.lifecycle_version || "unavailable",
    lifecycle_states: Object.values(lifecycle.adapters || {}).reduce((counts, entry) => {
      counts[entry.state] = (counts[entry.state] || 0) + 1;
      return counts;
    }, {}),
  },
  checks,
  live_certification: operatorBlockers.length ? "operator-owned-blocked" : "operator-required",
  operator_blockers: operatorBlockers,
  decision: failures.length ? "repository-checks-failed" : operatorBlockers.length ? "repository-side-ready-live-gate-blocked" : "repository-side-ready",
  next_action: operatorBlockers.length
    ? "Resolve the listed operator prerequisites, run aiw runtime-watch --runtime <id> --strict, complete the live smoke and evidence sequence, and obtain independent review."
    : "Complete the documented live certification sequence and independent review before making a production support statement.",
};

if (outputPath) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  try { fs.chmodSync(outputPath, 0o600); } catch (_) {}
}
if (jsonOutput) console.log(JSON.stringify(report, null, 2));
else {
  console.log(`Release status: ${report.decision}`);
  console.log(`Branch: ${report.branch}`);
  console.log(`Commit: ${report.commit}`);
  console.log(`Working tree: ${report.working_tree}`);
  console.log(`Live certification: ${report.live_certification}`);
  for (const blocker of report.operator_blockers) console.log(`Operator blocker: ${blocker}`);
  console.log(`Next action: ${report.next_action}`);
}
if (outputPath) console.log(`Sanitized release-status report written: ${path.relative(root, outputPath)}`);
if (failures.length) {
  console.error(`Release status checks failed: ${failures.join(", ")}`);
  process.exit(1);
}

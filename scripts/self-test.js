#!/usr/bin/env node

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const { atomicWriteJson, readJsonWithRecovery, acquireLock } = require("./lib/state-store");
const { loadPipeline, executeFixturePipeline } = require("./conformance-harness");

const root = path.resolve(__dirname, "..");
const failures = [];

function check(label, callback) {
  try {
    callback();
    console.log(`PASS ${label}`);
  } catch (error) {
    failures.push(`${label}: ${error.message}`);
    console.error(`FAIL ${label}: ${error.message}`);
  }
}

function command(args) {
  const result = spawnSync(process.execPath, args, { cwd: root, encoding: "utf8" });
  if (result.status !== 0) throw new Error((result.stderr || result.stdout || "command failed").trim());
  return result.stdout;
}

check("compatibility manifest parses", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "compatibility.json"), "utf8"));
  if (manifest.manifest_version !== "1.0.0") throw new Error("unsupported manifest version");
  if (!manifest.runtime?.node || !manifest.runtime?.python) throw new Error("runtime constraints are incomplete");
});

check("website data manifest is valid", () => {
  const lines = command(["scripts/website-data-manifest.js"]).trim().split("\n");
  if (lines.length !== 7 || new Set(lines).size !== lines.length) throw new Error("manifest entries are not unique");
});

check("semantic pipeline invariants pass", () => {
  command(["scripts/validate-pipelines.js"]);
});

for (const [label, script] of [
  ["MCP permission policy passes", "scripts/validate-mcp-policy.js"],
  ["execution budget policy passes", "scripts/validate-execution-budget.js"],
  ["golden compatibility contracts pass", "scripts/validate-golden-artifacts.js"],
  ["execution event schema passes", "scripts/validate-events.js"],
  ["pilot evidence contract passes", "scripts/validate-pilot-evidence.js"],
]) {
  check(label, () => { command([script]); });
}

check("artifact quality policy passes representative fixture", () => {
  command(["scripts/score-artifact.js", "--type", "requirements", "--input", "tests/fixtures/requirements-artifact.json"]);
});

check("adapter registry and capability matrix pass", () => {
  command(["scripts/validate-adapter-config.js"]);
});

check("OpenCode reference adapter certification passes", () => {
  command(["scripts/adapter-certification.js", "opencode"]);
});

check("runtime projections are deterministic", () => {
  const first = fs.mkdtempSync(path.join(os.tmpdir(), "aiw-projection-test-"));
  const second = fs.mkdtempSync(path.join(os.tmpdir(), "aiw-projection-test-"));
  try {
    command(["scripts/generate-projections.js", "--output", first, "--profile", "pilot-read-only"]);
    command(["scripts/generate-projections.js", "--output", second, "--profile", "pilot-read-only"]);
    const firstManifest = fs.readFileSync(path.join(first, "manifest.json"), "utf8").replace(/generated_at[^,]+,?/, "");
    const secondManifest = fs.readFileSync(path.join(second, "manifest.json"), "utf8").replace(/generated_at[^,]+,?/, "");
    if (firstManifest !== secondManifest) throw new Error("projection manifests differ");
  } finally {
    fs.rmSync(first, { recursive: true, force: true });
    fs.rmSync(second, { recursive: true, force: true });
  }
});

check("black-box fixture pipeline completes with HITL approval", () => {
  const fixture = loadPipeline(path.join(root, "tests", "fixtures", "self-test-pipeline.json"));
  const result = executeFixturePipeline(fixture, { gateDecisions: { approve: "approve" } });
  if (result.status !== "completed" || !result.session_id) throw new Error("fixture pipeline did not complete");
});

check("atomic state recovery works", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "aiw-self-test-state-"));
  const file = path.join(directory, "session.json");
  try {
    atomicWriteJson(file, { version: 1 });
    atomicWriteJson(file, { version: 2 });
    fs.writeFileSync(file, "{broken", "utf8");
    const recovered = readJsonWithRecovery(file);
    if (!recovered.recovered || recovered.value.version !== 1) throw new Error("backup was not selected");
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

check("single-writer state lock works", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "aiw-self-test-lock-"));
  const lock = path.join(directory, "state.lock");
  try {
    const release = acquireLock(lock);
    try {
      let locked = false;
      try { acquireLock(lock, { removeStale: false }); } catch (error) { locked = error.code === "STATE_LOCKED"; }
      if (!locked) throw new Error("second lock acquisition succeeded");
    } finally {
      release();
    }
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

check("secure init creates a template-only environment", () => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), "aiw-self-test-init-"));
  try {
    const result = spawnSync(path.join(root, "aiw"), ["init", target], { cwd: root, encoding: "utf8" });
    if (result.status !== 0) throw new Error((result.stderr || result.stdout || "init failed").trim());
    const env = fs.readFileSync(path.join(target, ".env"), "utf8");
    if (/ghp_|TEST-SECRET|sk-[A-Za-z0-9]/.test(env)) throw new Error("credential-like value copied into target .env");
    if (process.platform !== "win32" && (fs.statSync(path.join(target, ".env")).mode & 0o777) !== 0o600) {
      throw new Error("target .env is not mode 600");
    }
  } finally {
    fs.rmSync(target, { recursive: true, force: true });
  }
});

if (failures.length) {
  console.error(`\nSelf-test failed (${failures.length} issue(s)).`);
  process.exit(1);
}
console.log("\nSelf-test passed. No external credentials or paid model calls were used.");

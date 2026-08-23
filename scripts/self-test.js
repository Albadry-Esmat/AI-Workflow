#!/usr/bin/env node

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const { atomicWriteJson, readJsonWithRecovery, acquireLock } = require("./lib/state-store");

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

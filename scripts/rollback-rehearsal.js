#!/usr/bin/env node

const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { spawnSync } = require("child_process");
const { atomicWriteJson } = require("./lib/state-store");

const root = path.resolve(__dirname, "..");
const args = process.argv.slice(2);
function value(flag, fallback) { const i = args.indexOf(flag); return i >= 0 && args[i + 1] ? args[i + 1] : fallback; }
const workspace = path.resolve(value("--workspace", fs.mkdtempSync(path.join(os.tmpdir(), "aiw-rollback-"))));
const report = path.resolve(value("--report", path.join(workspace, "rollback-report.json")));
const stateDir = path.join(workspace, "state");
const backupRoot = path.join(workspace, "backups");
const backupDir = path.join(backupRoot, "verified-before-corruption");
const lockFile = path.join(workspace, "state.lock");
const checks = [];
function record(name, passed, detail) { checks.push({ name, passed, detail }); console.log(`${passed ? "PASS" : "FAIL"} ${name}: ${detail}`); }
function run(command, args) {
  const result = spawnSync(process.execPath, [command, ...args], { cwd: root, encoding: "utf8", env: { ...process.env, AIW_STATE_DIR: stateDir, AIW_BACKUP_ROOT: backupRoot, AIW_STATE_LOCK: lockFile } });
  record(command + " " + args[0], result.status === 0, result.status === 0 ? "completed" : (result.stderr || result.stdout || "failed").trim().split(/\r?\n/).slice(-1)[0].slice(0, 180));
  return result.status === 0;
}
function sha256(file) { return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"); }

try {
  fs.mkdirSync(stateDir, { recursive: true, mode: 0o700 });
  fs.mkdirSync(backupRoot, { recursive: true, mode: 0o700 });
  atomicWriteJson(path.join(stateDir, "session.json"), { session_id: "rollback-fixture", status: "paused", artifact_names: ["requirements"] });
  record("fixture state created", true, "disposable state initialized");
  const backupOk = run("scripts/state-backup.js", ["backup", backupDir]);
  const verifyOk = backupOk && run("scripts/state-backup.js", ["verify", backupDir]);
  const stateFile = path.join(stateDir, "session.json");
  const beforeCorruption = sha256(stateFile);
  fs.writeFileSync(stateFile, "{corrupted disposable state\n", { mode: 0o600 });
  record("corruption injected", true, "only the disposable primary was modified");
  const restoreOk = verifyOk && run("scripts/state-backup.js", ["restore", backupDir]);
  const restoredFile = path.join(stateDir, "session.json");
  const checksumRestored = restoreOk && fs.existsSync(restoredFile) && sha256(restoredFile) === beforeCorruption;
  record("restored checksum", checksumRestored, checksumRestored ? "restored state matches verified pre-corruption checksum" : "restored checksum mismatch");
  const reportValue = {
    report_version: "1.0.0",
    run_type: "rollback-rehearsal",
    status: checks.every((check) => check.passed) ? "passed" : "failed",
    created_at: new Date().toISOString(),
    state_files: ["session.json"],
    backup_manifest_verified: verifyOk,
    corruption_injected_in_disposable_copy: true,
    restored_checksum_verified: checksumRestored,
    raw_state_included: false,
    checks: checks.map(({ name, passed, detail }) => ({ name, passed, detail })),
  };
  fs.mkdirSync(path.dirname(report), { recursive: true, mode: 0o700 });
  fs.writeFileSync(report, `${JSON.stringify(reportValue, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  try { fs.chmodSync(report, 0o600); } catch (_) {}
  console.log(`Sanitized rollback report: ${report}`);
  if (reportValue.status !== "passed") process.exitCode = 1;
} finally {
  if (!args.includes("--keep") && workspace.startsWith(os.tmpdir()) && !args.includes("--workspace")) fs.rmSync(workspace, { recursive: true, force: true });
}

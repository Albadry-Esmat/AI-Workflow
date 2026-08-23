const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync, spawnSync } = require("child_process");
const {
  atomicWriteJson,
  readJsonWithRecovery,
  acquireLock,
} = require("../scripts/lib/state-store");

const root = path.resolve(__dirname, "..");

function runNode(script, args = []) {
  return execFileSync(process.execPath, [script, ...args], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

describe("production hardening conformance", () => {
  test("all pipeline templates satisfy semantic invariants", () => {
    expect(runNode("scripts/validate-pipelines.js")).toMatch(/22 pipeline\(s\) checked/);
  });

  test("website data manifest emits unique file and directory mappings", () => {
    const output = runNode("scripts/website-data-manifest.js").trim().split("\n");
    expect(output).toHaveLength(7);
    expect(new Set(output).size).toBe(output.length);
    expect(output.filter((line) => line.startsWith("file\t"))).toHaveLength(5);
    expect(output.filter((line) => line.startsWith("directory\t"))).toHaveLength(2);
  });

  test("state JSON writes are atomic and recover from a corrupt primary", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "aiw-state-test-"));
    const file = path.join(directory, "session.json");
    atomicWriteJson(file, { version: 1, status: "complete" });
    atomicWriteJson(file, { version: 2, status: "complete" });
    fs.writeFileSync(file, "{broken", "utf8");
    const recovered = readJsonWithRecovery(file);
    expect(recovered.recovered).toBe(true);
    expect(recovered.value.version).toBe(1);
    fs.rmSync(directory, { recursive: true, force: true });
  });

  test("state lock prevents concurrent ownership", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "aiw-lock-test-"));
    const lock = path.join(directory, "state.lock");
    const release = acquireLock(lock);
    expect(() => acquireLock(lock, { removeStale: false })).toThrow(/STATE_LOCKED|already held/);
    release();
    expect(fs.existsSync(lock)).toBe(false);
    fs.rmSync(directory, { recursive: true, force: true });
  });

  test("backup verification and restore round-trip works", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "aiw-backup-test-"));
    const state = path.join(directory, "state");
    const backups = path.join(directory, "backups");
    const lock = path.join(directory, "state.lock");
    fs.mkdirSync(state, { recursive: true });
    fs.writeFileSync(path.join(state, "session.json"), JSON.stringify({ version: 1 }), "utf8");
    const env = { ...process.env, AIW_STATE_DIR: state, AIW_BACKUP_ROOT: backups, AIW_STATE_LOCK: lock };
    try {
      execFileSync(process.execPath, ["scripts/state-backup.js", "backup", path.join(backups, "snapshot")], { cwd: root, env, encoding: "utf8" });
      fs.writeFileSync(path.join(state, "session.json"), JSON.stringify({ version: 2 }), "utf8");
      execFileSync(process.execPath, ["scripts/state-backup.js", "verify", path.join(backups, "snapshot")], { cwd: root, env, encoding: "utf8" });
      execFileSync(process.execPath, ["scripts/state-backup.js", "restore", path.join(backups, "snapshot")], { cwd: root, env, encoding: "utf8" });
      expect(JSON.parse(fs.readFileSync(path.join(state, "session.json"), "utf8")).version).toBe(1);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  test("aiw init does not copy source credentials and protects target env", () => {
    const target = fs.mkdtempSync(path.join(os.tmpdir(), "aiw-init-test-"));
    const result = spawnSync(path.join(root, "aiw"), ["init", target], {
      cwd: root,
      encoding: "utf8",
    });
    expect(result.status).toBe(0);
    const envFile = path.join(target, ".env");
    expect(fs.readFileSync(envFile, "utf8")).not.toMatch(/TEST-SECRET|ghp_/);
    if (process.platform !== "win32") expect(fs.statSync(envFile).mode & 0o777).toBe(0o600);
    fs.rmSync(target, { recursive: true, force: true });
  });
});

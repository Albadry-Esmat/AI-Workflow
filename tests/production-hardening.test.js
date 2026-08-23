const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync, spawnSync } = require("child_process");
const {
  atomicWriteJson,
  readJsonWithRecovery,
  acquireLock,
} = require("../scripts/lib/state-store");
const {
  ContractError,
  redact,
  route,
  validateOutput,
  retryUntilSuccess,
  executeFixturePipeline,
  saveSession,
  resumeSession,
} = require("../scripts/conformance-harness");

const root = path.resolve(__dirname, "..");

function runNode(script, args = []) {
  return execFileSync(process.execPath, [script, ...args], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

describe("production hardening conformance", () => {
  test("routing handles exact, ambiguous, and fallback requests", () => {
    const pipelines = [
      { id: "api", triggers: ["api"] },
      { id: "website", triggers: ["website"] },
    ];
    expect(route("build an api", pipelines).mode).toBe("exact");
    expect(route("build an api website", pipelines).requires_hitl).toBe(true);
    expect(route("build something", pipelines).mode).toBe("fallback");
  });

  test("retry exhaustion returns a typed contract error", () => {
    expect(() => retryUntilSuccess(3, 2, () => { throw new Error("bad output"); })).toThrow(/RETRY_EXHAUSTED/);
    expect(retryUntilSuccess(3, 2, (attempt) => attempt === 1 ? { ok: true } : (() => { throw new Error("retry"); })()).attempts).toBe(2);
  });

  test("HITL rejection stops execution and approval completes it", () => {
    const pipeline = {
      id: "hitl",
      phases: [
        { id: "requirements", tasks: [{ id: "req", output: "requirements" }] },
        { id: "approval", tasks: [{ id: "approve", type: "hitl_gate", requires: ["requirements"] }] },
        { id: "finish", tasks: [{ id: "finish", requires: ["requirements"], output: "result" }] },
      ],
    };
    expect(executeFixturePipeline(pipeline, { gateDecisions: { approve: "reject" } }).status).toBe("rejected");
    expect(executeFixturePipeline(pipeline, { gateDecisions: { approve: "approve" } }).status).toBe("completed");
  });

  test("delayed async results cannot pass a dependent gate before reconciliation", () => {
    const pipeline = {
      id: "async",
      phases: [
        { id: "architecture", tasks: [{ id: "adr", async: true, output: "adr" }] },
        { id: "approval", tasks: [{ id: "approve", type: "hitl_gate", requires: ["adr"] }] },
      ],
    };
    expect(() => executeFixturePipeline(pipeline, { gateDecisions: { approve: "approve" } })).toThrow(/ARTIFACT_NOT_READY/);
    expect(executeFixturePipeline(pipeline, {
      gateDecisions: { approve: "approve" },
      asyncResults: { adr: { status: "completed", output: { decision: "approved" } } },
    }).status).toBe("completed");
  });

  test("schema failures and redaction are observable", () => {
    expect(() => validateOutput({ ok: true }, ["summary"])).toThrow(/OUTPUT_MISSING_REQUIRED/);
    expect(redact("Authorization: Bearer secret123 GITHUB_TOKEN=ghp_test sk-abc")).not.toMatch(/secret123|ghp_test|sk-abc/);
  });

  test("session persistence can be saved and resumed", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "aiw-session-test-"));
    const file = path.join(directory, "session.json");
    try {
      saveSession(file, { session_id: "test-session", status: "paused" });
      expect(resumeSession(file).status).toBe("paused");
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  test("session cleanup dry-run and deletion are safe", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "aiw-cleanup-test-"));
    const sessions = path.join(directory, "sessions");
    const lastSession = path.join(directory, "last_session.txt");
    const oldSession = path.join(sessions, "old.json");
    fs.mkdirSync(sessions, { recursive: true });
    fs.writeFileSync(oldSession, "{}\n", "utf8");
    fs.writeFileSync(lastSession, "old\n", "utf8");
    const oldTime = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    fs.utimesSync(oldSession, oldTime, oldTime);
    const env = { ...process.env, AIW_SESSIONS_DIR: sessions, AIW_LAST_SESSION_FILE: lastSession };
    try {
      const dryRun = spawnSync("bash", [path.join(root, "scripts/cleanup-sessions.sh"), "--days", "1"], { cwd: root, env, encoding: "utf8" });
      expect(dryRun.status).toBe(0);
      expect(fs.existsSync(oldSession)).toBe(true);
      const deletion = spawnSync("bash", [path.join(root, "scripts/cleanup-sessions.sh"), "--days", "1", "--delete"], { cwd: root, env, encoding: "utf8" });
      expect(deletion.status).toBe(0);
      expect(fs.existsSync(oldSession)).toBe(false);
      expect(fs.existsSync(lastSession)).toBe(false);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  test("version output includes compatibility metadata", () => {
    const version = JSON.parse(runNode("scripts/version.js", ["--json"]));
    expect(version.cli_version).toBe("1.0.0");
    expect(version.framework_version).toBeTruthy();
    expect(version.schema_version).toBe("2.1.0");
    expect(version.runtime.node).toBeTruthy();
  });

  test("support bundle excludes raw state and credentials", () => {
    const output = fs.mkdtempSync(path.join(os.tmpdir(), "aiw-support-test-"));
    try {
      const relative = runNode("scripts/support-bundle.js", [output]).trim();
      const bundle = path.join(root, relative);
      const manifest = JSON.parse(fs.readFileSync(path.join(bundle, "manifest.json"), "utf8"));
      const diagnostics = fs.readFileSync(path.join(bundle, "diagnostics.txt"), "utf8");
      expect(manifest.excluded_data).toContain("raw session JSON");
      expect(manifest.included_files).not.toContain("session.json");
      expect(diagnostics).not.toMatch(/GITHUB_TOKEN=|Authorization: Bearer|ghp_/);
      fs.rmSync(bundle, { recursive: true, force: true });
    } finally {
      fs.rmSync(output, { recursive: true, force: true });
    }
  });

  test("all pipeline templates satisfy semantic invariants", () => {
    expect(runNode("scripts/validate-pipelines.js")).toMatch(/22 pipeline\(s\) checked/);
  });

  test("invalid semantic fixtures fail with actionable diagnostics", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "aiw-invalid-pipeline-"));
    const pipelineDir = path.join(directory, "pipelines");
    const skillDir = path.join(directory, "skills");
    fs.mkdirSync(path.join(skillDir, "fixture"), { recursive: true });
    fs.writeFileSync(path.join(skillDir, "fixture", "SKILL.md"), "# fixture\n", "utf8");
    fs.mkdirSync(pipelineDir, { recursive: true });
    fs.writeFileSync(path.join(pipelineDir, "invalid.json"), JSON.stringify({
      name: "invalid",
      version: "1.0.0",
      phases: [
        { id: "phase-1", label: "one", condition: "process.exit()", skills: [{ name: "fixture", inputs: { source: "phase_outputs['phase-2']" } }] },
        { id: "phase-2", label: "two", skills: [{ name: "fixture" }] },
      ],
    }), "utf8");
    try {
      const result = spawnSync(process.execPath, ["scripts/validate-pipelines.js"], {
        cwd: root,
        env: { ...process.env, AIW_PIPELINE_DIR: pipelineDir, AIW_SKILL_DIR: skillDir },
        encoding: "utf8",
      });
      expect(result.status).toBe(1);
      expect(`${result.stdout}${result.stderr}`).toMatch(/forbidden expression token|future phase/);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
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

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

  test("pilot-preflight creates a sanitized blocked manifest without live execution", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "aiw-pilot-"));
    const envFile = path.join(directory, ".env");
    const bin = path.join(directory, "bin");
    const output = path.join(directory, "manifest.json");
    fs.mkdirSync(bin, { recursive: true });
    fs.writeFileSync(envFile, "GITHUB_TOKEN=placeholder-for-fixture\\n", { mode: 0o600 });
    const opencode = path.join(bin, "opencode");
    fs.writeFileSync(opencode, "#!/usr/bin/env bash\nif [[ \\\"$1\\\" == \\\"--version\\\" ]]; then echo \\\"1.2.3\\\"; else echo \\\"live execution forbidden in fixture\\\" >&2; exit 99; fi\n", { mode: 0o700 });
    try {
      const result = spawnSync(process.execPath, ["scripts/pilot-preflight.js", "--project-id", "fixture-project", "--output", output, "--state-dir", path.join(directory, "state"), "--backup-root", path.join(directory, "backups")], {
        cwd: root,
        encoding: "utf8",
        env: { ...process.env, AIW_ENV_FILE: envFile, PATH: `${bin}:${process.env.PATH}` },
      });
      expect(result.status).toBe(0);
      const manifest = JSON.parse(fs.readFileSync(output, "utf8"));
      expect(manifest.status).toBe("ready-for-operator-live-execution");
      expect(manifest.live_execution.attempted).toBe(false);
      expect(JSON.stringify(manifest)).not.toMatch(/placeholder-for-fixture/);
      expect(fs.existsSync(path.join(directory, "backups", manifest.correlation_id, "manifest.json"))).toBe(true);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  test("structured event retention removes only expired records", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "aiw-retention-"));
    const eventsFile = path.join(directory, "events.jsonl");
    try {
      fs.writeFileSync(eventsFile, [
        JSON.stringify({ timestamp: "2000-01-01T00:00:00.000Z", event: "old", status: "completed" }),
        JSON.stringify({ timestamp: new Date().toISOString(), event: "new", status: "completed" }),
        "",
      ].join("\n"), { mode: 0o600 });
      const eventLog = require(path.join(root, "scripts/lib/event-log.js"));
      expect(eventLog.pruneEvents(eventsFile, 1).removed).toBe(1);
      expect(eventLog.readEvents(eventsFile, 10).map((event) => event.event)).toEqual(["new"]);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  test("structured events redact secrets and summarize lifecycle records", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "aiw-events-"));
    const eventsFile = path.join(directory, "events.jsonl");
    try {
      const eventLog = require(path.join(root, "scripts/lib/event-log.js"));
      eventLog.appendEvent({ event: "task", session_id: "s-1", status: "completed", message: "Authorization: Bearer secret123 GITHUB_TOKEN=ghp_test" }, eventsFile);
      eventLog.appendEvent({ event: "gate", session_id: "s-1", status: "rejected" }, eventsFile);
      const events = eventLog.readEvents(eventsFile, 10);
      expect(events).toHaveLength(2);
      expect(JSON.stringify(events)).not.toMatch(/secret123|ghp_test/);
      expect(eventLog.summarizeEvents(events).by_status.completed).toBe(1);
      expect(eventLog.summarizeEvents(events).by_event.gate).toBe(1);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  test("golden artifact contracts pass and reject unsafe drift", () => {
    expect(runNode("scripts/validate-golden-artifacts.js")).toMatch(/Golden artifact compatibility validation passed/);
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "aiw-golden-"));
    const fixture = path.join(directory, "golden.json");
    try {
      const source = JSON.parse(fs.readFileSync(path.join(root, "tests/fixtures/golden-artifacts.json"), "utf8"));
      source.artifacts[0].required_fields.push("raw_prompt");
      fs.writeFileSync(fixture, JSON.stringify(source));
      const result = spawnSync(process.execPath, ["scripts/validate-golden-artifacts.js"], { cwd: root, encoding: "utf8", env: { ...process.env, AIW_GOLDEN_FILE: fixture } });
      expect(result.status).not.toBe(0);
      expect(`${result.stdout}${result.stderr}`).toMatch(/unsafe field/);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  test("artifact quality scoring routes incomplete output to review and rejects prohibited fields", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "aiw-quality-"));
    const incomplete = path.join(directory, "incomplete.json");
    const prohibited = path.join(directory, "prohibited.json");
    try {
      fs.writeFileSync(incomplete, JSON.stringify({}));
      const review = spawnSync(process.execPath, ["scripts/score-artifact.js", "--type", "requirements", "--input", incomplete], { cwd: root, encoding: "utf8" });
      expect(review.status).toBe(0);
      expect(JSON.parse(review.stdout).decision).toBe("needs_human_review");
      fs.writeFileSync(prohibited, JSON.stringify({ requirements: [], acceptance_criteria: [], raw_prompt: "must not be stored" }));
      const rejected = spawnSync(process.execPath, ["scripts/score-artifact.js", "--type", "requirements", "--input", prohibited], { cwd: root, encoding: "utf8" });
      expect(rejected.status).not.toBe(0);
      expect(rejected.stdout).toMatch(/prohibited_fields/);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  test("canary write plans are dry-run only and require explicit approval for writes", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "aiw-write-plan-"));
    const output = path.join(directory, "plan.json");
    try {
      const result = spawnSync(process.execPath, ["scripts/write-plan.js", "--operation", "fixture-publication", "--target", "fixture-repo", "--canary", "--approved", "--output", output], { cwd: root, encoding: "utf8" });
      expect(result.status).toBe(0);
      const plan = JSON.parse(fs.readFileSync(output, "utf8"));
      expect(plan.canary).toBe(true);
      expect(plan.dry_run).toBe(true);
      expect(plan.executed).toBe(false);
      expect(plan.external_write_performed).toBe(false);
      const noCanary = spawnSync(process.execPath, ["scripts/write-plan.js", "--operation", "fixture-publication", "--target", "fixture-repo", "--approved"], { cwd: root, encoding: "utf8" });
      expect(noCanary.status).not.toBe(0);
      expect(`${noCanary.stdout}${noCanary.stderr}`).toMatch(/WRITE_PLAN_REQUIRES_CANARY/);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  test("idempotency reconciliation records ambiguous external-write outcomes", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "aiw-reconcile-"));
    const ledger = path.join(directory, "ledger.json");
    try {
      const idempotency = require(path.join(root, "scripts/lib/idempotency.js"));
      const key = idempotency.operationKey("publication", "digest-ambiguous");
      idempotency.claim(key, ledger);
      idempotency.reconcile(key, "unknown", ledger);
      expect(idempotency.inspect(key, ledger).status).toBe("needs_operator_reconciliation");
      expect(() => idempotency.reconcile(key, "invalid", ledger)).toThrow(/IDEMPOTENCY_OUTCOME_INVALID/);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  test("idempotency ledger rejects duplicate claims and records completion", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "aiw-idempotency-"));
    const ledger = path.join(directory, "ledger.json");
    try {
      const idempotency = require(path.join(root, "scripts/lib/idempotency.js"));
      const key = idempotency.operationKey("fixture-write", "digest-1");
      expect(idempotency.claim(key, ledger).duplicate).toBe(false);
      expect(idempotency.claim(key, ledger).duplicate).toBe(true);
      idempotency.record(key, { status: "published", result_category: "fixture" }, ledger);
      expect(idempotency.inspect(key, ledger).status).toBe("published");
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  test("rollback rehearsal restores checksummed state with a sanitized report", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "aiw-rollback-test-"));
    try {
      const result = spawnSync(process.execPath, ["scripts/rollback-rehearsal.js", "--workspace", directory, "--keep"], { cwd: root, encoding: "utf8" });
      expect(result.status).toBe(0);
      const report = JSON.parse(fs.readFileSync(path.join(directory, "rollback-report.json"), "utf8"));
      expect(report.status).toBe("passed");
      expect(report.restored_checksum_verified).toBe(true);
      expect(report.raw_state_included).toBe(false);
      expect(JSON.stringify(report)).not.toMatch(/rollback-fixture|artifact_names/);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  test("execution budget policy passes and rejects unsafe fixtures", () => {
    expect(runNode("scripts/validate-execution-budget.js")).toMatch(/Execution budget validation passed/);
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "aiw-budget-"));
    const fixture = path.join(directory, "budget.json");
    try {
      fs.writeFileSync(fixture, JSON.stringify({ schema_version: "1.0.0", limits: { max_active_sessions: 1, max_queue_depth: 1, max_retries_per_task: 3, max_total_retries: 2, max_duration_ms: 1, max_estimated_tokens: 1, max_external_api_calls: 1 }, actions: { on_threshold: "continue", on_hard_limit: "continue" } }));
      const result = spawnSync(process.execPath, ["scripts/validate-execution-budget.js"], { cwd: root, encoding: "utf8", env: { ...process.env, AIW_BUDGET_FILE: fixture } });
      expect(result.status).not.toBe(0);
      expect(`${result.stdout}${result.stderr}`).toMatch(/per-task retry limit|on_threshold|on_hard_limit/);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  test("projection installation is dry-run by default and requires explicit overwrite", () => {
    const source = fs.mkdtempSync(path.join(os.tmpdir(), "aiw-projection-source-"));
    const target = fs.mkdtempSync(path.join(os.tmpdir(), "aiw-projection-target-"));
    try {
      const generated = spawnSync(process.execPath, ["scripts/generate-projections.js", "--output", source, "--profile", "pilot-read-only"], { cwd: root, encoding: "utf8" });
      expect(generated.status).toBe(0);
      const dryRun = spawnSync(process.execPath, ["scripts/install-projections.js", "--source", source, "--target", target], { cwd: root, encoding: "utf8" });
      expect(dryRun.status).toBe(0);
      expect(fs.existsSync(path.join(target, "CLAUDE.md"))).toBe(false);
      fs.writeFileSync(path.join(target, "CLAUDE.md"), "operator content\\n");
      const blocked = spawnSync(process.execPath, ["scripts/install-projections.js", "--source", source, "--target", target, "--confirm"], { cwd: root, encoding: "utf8" });
      expect(blocked.status).not.toBe(0);
      const installed = spawnSync(process.execPath, ["scripts/install-projections.js", "--source", source, "--target", target, "--confirm", "--overwrite"], { cwd: root, encoding: "utf8" });
      expect(installed.status).toBe(0);
      expect(fs.readFileSync(path.join(target, "CLAUDE.md"), "utf8")).toContain("Generated by AI Workflow");
      expect(fs.existsSync(path.join(target, ".ai-workflow", "projection-backups"))).toBe(true);
    } finally {
      fs.rmSync(source, { recursive: true, force: true });
      fs.rmSync(target, { recursive: true, force: true });
    }
  });

  test("all target adapters pass credential-free descriptor and dry-run certification", () => {
    const adapters = ["opencode", "claude-code", "codex-cli", "gemini-cli", "aider", "cursor", "github-copilot", "cline-roo", "windsurf"];
    for (const adapter of adapters) {
      const result = spawnSync(process.execPath, ["scripts/adapter-certification.js", adapter], { cwd: root, encoding: "utf8" });
      expect(result.status).toBe(0);
      expect(result.stdout).toMatch(new RegExp(`Adapter certification passed \\(${adapter}`));
    }
  });

  test("runtime guards deny unauthorized capabilities and require approval", () => {
    const policy = JSON.parse(fs.readFileSync(path.join(root, "mcp-permission-policy.json"), "utf8"));
    expect(() => require(path.join(root, "scripts/lib/runtime-guards.js")).assertMcpCapabilities({ required_capabilities: ["write:repository"] }, { policy, profileName: "pilot-read-only" })).toThrow(/MCP_CAPABILITY_DENIED/);
    expect(() => require(path.join(root, "scripts/lib/runtime-guards.js")).assertMcpCapabilities({ required_capabilities: ["write:repository"] }, { policy, profileName: "repository-write" })).toThrow(/MCP_APPROVAL_REQUIRED/);
    expect(require(path.join(root, "scripts/lib/runtime-guards.js")).assertMcpCapabilities({ required_capabilities: ["write:repository"] }, { policy, profileName: "repository-write", approval: true }).allowed).toBe(true);
  });

  test("checkpoints contain handoff metadata but no raw artifacts", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "aiw-checkpoint-"));
    const file = path.join(directory, "checkpoint.json");
    try {
      const harness = require(path.join(root, "scripts/conformance-harness.js"));
      const pipeline = { id: "checkpoint", phases: [{ id: "one", tasks: [{ id: "req", output: "requirements" }] }] };
      const result = harness.executeFixturePipeline(pipeline, { checkpointFile: file, taskOutputs: { req: { requirements: [{ id: "R1", text: "sensitive content excluded" }] } } });
      const checkpoint = harness.resumeCheckpoint(file);
      expect(result.status).toBe("completed");
      expect(checkpoint.artifact_names).toEqual(["requirements"]);
      expect(checkpoint.raw_artifacts_included).toBe(false);
      expect(JSON.stringify(checkpoint)).not.toMatch(/sensitive content excluded/);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  test("circuit breaker opens after repeated failures and resets after success", () => {
    const { CircuitBreaker } = require(path.join(root, "scripts/lib/circuit-breaker.js"));
    const breaker = new CircuitBreaker({ failureThreshold: 2, cooldownMs: 1000 });
    breaker.recordFailure("timeout", 100);
    breaker.recordFailure("timeout", 200);
    expect(() => breaker.assertCanCall(500)).toThrow(/CIRCUIT_OPEN/);
    expect(() => breaker.assertCanCall(1300)).not.toThrow();
    breaker.recordSuccess();
    expect(breaker.snapshot().state).toBe("closed");
  });

  test("runtime budget tracker stops before an over-limit operation continues", () => {
    const { BudgetTracker } = require(path.join(root, "scripts/lib/runtime-guards.js"));
    const tracker = new BudgetTracker({ limits: { max_total_retries: 1, max_duration_ms: 100000, max_estimated_tokens: 10, max_external_api_calls: 2 } });
    expect(() => tracker.consume({ estimated_tokens: 11 })).toThrow(/EXECUTION_BUDGET_EXCEEDED/);
  });

  test("MCP pilot permission policy passes the active configuration", () => {
    expect(runNode("scripts/validate-mcp-policy.js")).toMatch(/MCP policy validation passed/);
  });

  test("MCP policy rejects side-effect servers in the pilot profile", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "aiw-mcp-policy-"));
    const policy = path.join(directory, "policy.json");
    const config = path.join(directory, "config.json");
    fs.writeFileSync(policy, JSON.stringify({ profiles: { "pilot-read-only": { enabled_servers: ["github"], disabled_servers: ["playwright"], allowed_external_writes: false } } }), "utf8");
    fs.writeFileSync(config, JSON.stringify({ mcp: { github: { enabled: true, command: ["npx", "@x/pkg@1.0.0"] }, playwright: { enabled: true, command: ["npx", "@x/browser@1.0.0"] } } }), "utf8");
    try {
      const result = spawnSync(process.execPath, ["scripts/validate-mcp-policy.js"], {
        cwd: root,
        env: { ...process.env, AIW_MCP_POLICY: policy, AIW_MCP_CONFIG: config },
        encoding: "utf8",
      });
      expect(result.status).toBe(1);
      expect(`${result.stdout}${result.stderr}`).toMatch(/profile-disabled server is enabled|side-effect server/);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
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

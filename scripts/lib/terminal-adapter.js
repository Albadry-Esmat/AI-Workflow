const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { atomicWriteJson, readJsonWithRecovery } = require("./state-store");
const { appendEvent } = require("./event-log");
const { loadMcpPolicy } = require("./runtime-guards");
const { validateDescriptor, createRequest, normalizeEvent, validateRequestPolicy, sanitizeText } = require("./adapter-contract");

function createTerminalAdapter(descriptor, options = {}) {
  validateDescriptor(descriptor);
  const defaultExecutable = options.executable || descriptor.executable;
  const root = path.resolve(__dirname, "../..");
  function discover() { return { ...descriptor }; }
  function preflight(input = {}) {
    const executable = input.executable || process.env[descriptor.env_var] || defaultExecutable;
    const result = spawnSync(executable, ["--version"], { cwd: input.cwd || root, encoding: "utf8", timeout: 10000 });
    if (result.status !== 0 || !String(result.stdout || result.stderr).trim()) {
      const error = new Error(`${descriptor.adapter_id.toUpperCase().replace(/-/g, "_")}_RUNTIME_UNAVAILABLE: ${sanitizeText(result.stderr || result.stdout || "version check failed")}`);
      error.code = "ADAPTER_RUNTIME_UNAVAILABLE";
      throw error;
    }
    return { adapter_id: descriptor.adapter_id, executable, version: sanitizeText(result.stdout || result.stderr, 120).split("\n")[0] };
  }
  function startSession(input = {}) {
    const request = createRequest({ ...input, mode: input.mode || "read-only" });
    validateRequestPolicy(request, { policy: input.policy || loadMcpPolicy(), approval: input.approval === true });
    const session = { session_version: "1.0.0", correlation_id: request.correlation_id, pipeline_id: request.pipeline_id, adapter_id: descriptor.adapter_id, status: "running", request, started_at: new Date().toISOString(), raw_content_included: false };
    if (input.stateFile) atomicWriteJson(input.stateFile, session, { mode: 0o600 });
    if (input.eventsFile) appendEvent(normalizeEvent({ event: "checkpoint", session_id: session.correlation_id, pipeline_id: session.pipeline_id, status: "started", message: `${descriptor.adapter_id} session started` }), input.eventsFile);
    return session;
  }
  function sendStep(session, input = {}) {
    if (!session || session.status !== "running") { const error = new Error("ADAPTER_SESSION_NOT_RUNNING: session is not running"); error.code = "ADAPTER_SESSION_NOT_RUNNING"; throw error; }
    const request = createRequest({ ...session.request, ...input, correlation_id: session.correlation_id, pipeline_id: session.pipeline_id });
    validateRequestPolicy(request, { policy: input.policy || loadMcpPolicy(), approval: input.approval === true });
    if (input.dryRun !== false || request.dry_run) return { status: "planned", executed: false, request };
    const executable = input.executable || process.env[descriptor.env_var] || defaultExecutable;
    const result = spawnSync(executable, input.args || [], { cwd: input.cwd || root, encoding: "utf8", timeout: request.budget.max_duration_ms, maxBuffer: 1024 * 1024 });
    if (result.error || result.status !== 0) {
      const error = new Error(`ADAPTER_STEP_FAILED: ${sanitizeText(result.error?.message || result.stderr || result.stdout || "step failed")}`);
      error.code = "ADAPTER_STEP_FAILED";
      throw error;
    }
    return { status: "completed", executed: true, stdout: sanitizeText(result.stdout, 500) };
  }
  function requestApproval(session, details = {}) { return { approval_version: "1.0.0", approval_id: `approval-${session.correlation_id}`, correlation_id: session.correlation_id, reason: sanitizeText(details.reason || "approval required"), requested_capabilities: details.requested_capabilities || [], target: sanitizeText(details.target || "unspecified", 240), risk: details.risk || "medium", decision: "pending" }; }
  function checkpoint(session, file) { const value = { checkpoint_version: "1.0.0", saved_at: new Date().toISOString(), correlation_id: session.correlation_id, pipeline_id: session.pipeline_id, status: session.status, completed_tasks: session.completed_tasks || [], artifact_names: session.artifact_names || [], budget: session.budget || {}, circuit: session.circuit || {}, policy_versions: { mcp: "1.1.0", checkpoint: "1.0.0" }, raw_content_included: false }; atomicWriteJson(file, value, { mode: 0o600 }); return value; }
  function cancel(session, reason = "operator-cancelled") { return { ...session, status: "cancelled", cancel_reason: sanitizeText(reason), raw_content_included: false }; }
  function resume(file) { return readJsonWithRecovery(file).value; }
  function readEvents(file, limit = 100) { if (!file || !fs.existsSync(file)) return []; return fs.readFileSync(file, "utf8").trim().split("\n").filter(Boolean).slice(-limit).map((line) => normalizeEvent(JSON.parse(line))); }
  function collectArtifacts(directory) { if (!directory || !fs.existsSync(directory)) return []; return fs.readdirSync(directory).filter((name) => !/prompt|payload|token|secret|session/i.test(name)).map((name) => ({ name: sanitizeText(name, 160), classification: "operator-review-required" })); }
  function closeSession(session, status = "completed", error) { return { ...session, status, closed_at: new Date().toISOString(), error_category: error ? sanitizeText(error.code || "runtime") : undefined, raw_content_included: false }; }
  return { descriptor, discover, preflight, startSession, sendStep, requestApproval, checkpoint, cancel, resume, readEvents, collectArtifacts, closeSession };
}
module.exports = { createTerminalAdapter };

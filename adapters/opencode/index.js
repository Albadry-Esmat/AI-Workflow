#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { atomicWriteJson, readJsonWithRecovery } = require("../../scripts/lib/state-store");
const { appendEvent } = require("../../scripts/lib/event-log");
const { loadMcpPolicy, assertMcpCapabilities } = require("../../scripts/lib/runtime-guards");
const { validateDescriptor, createRequest, normalizeEvent, validateRequestPolicy, sanitizeText } = require("../../scripts/lib/adapter-contract");

const root = path.resolve(__dirname, "../..");
const descriptor = {
  adapter_id: "opencode",
  display_name: "OpenCode",
  runtime_family: "terminal-agent",
  tier: 1,
  status: "reference",
  entrypoint: "adapters/opencode",
  supported_operations: ["discover", "preflight", "start_session", "send_step", "read_events", "request_approval", "checkpoint", "cancel", "resume", "collect_artifacts", "close_session"],
  supported_capabilities: ["mcp", "skills", "subagents", "approvals", "checkpoints", "cli", "write_guard"],
  version_range: ">=1.0.0",
  real_evidence: "repository-fixtures-only",
};

function discover() { validateDescriptor(descriptor); return { ...descriptor }; }
function preflight(options = {}) {
  const executable = options.executable || process.env.AIW_OPENCODE_BIN || "opencode";
  const result = spawnSync(executable, ["--version"], { cwd: options.cwd || root, encoding: "utf8" });
  if (result.status !== 0 || !String(result.stdout || result.stderr).trim()) {
    const error = new Error(`OPENCODE_RUNTIME_UNAVAILABLE: ${sanitizeText(result.stderr || result.stdout || "version check failed")}`);
    error.code = "OPENCODE_RUNTIME_UNAVAILABLE";
    throw error;
  }
  return { adapter_id: descriptor.adapter_id, executable, version: sanitizeText(result.stdout || result.stderr, 120).split("\n")[0], config: path.join(options.cwd || root, "opencode.json") };
}
function startSession(input = {}) {
  const request = createRequest({ ...input, mode: input.mode || "read-only" });
  validateRequestPolicy(request, { policy: input.policy || loadMcpPolicy(), approval: input.approval === true });
  const session = { session_version: "1.0.0", correlation_id: request.correlation_id, pipeline_id: request.pipeline_id, adapter_id: descriptor.adapter_id, status: "running", request, started_at: new Date().toISOString(), raw_content_included: false };
  if (input.stateFile) atomicWriteJson(input.stateFile, session, { mode: 0o600 });
  if (input.eventsFile) appendEvent(normalizeEvent({ event: "checkpoint", session_id: session.correlation_id, pipeline_id: session.pipeline_id, status: "started", message: "adapter session started" }), input.eventsFile);
  return session;
}
function sendStep(session, input = {}) {
  if (!session || session.status !== "running") { const error = new Error("ADAPTER_SESSION_NOT_RUNNING: session is not running"); error.code = "ADAPTER_SESSION_NOT_RUNNING"; throw error; }
  const request = createRequest({ ...session.request, ...input, correlation_id: session.correlation_id, pipeline_id: session.pipeline_id });
  validateRequestPolicy(request, { policy: input.policy || loadMcpPolicy(), approval: input.approval === true });
  if (input.dryRun !== false || request.dry_run) return { status: "planned", executed: false, request };
  const executable = input.executable || process.env.AIW_OPENCODE_BIN || "opencode";
  const result = spawnSync(executable, input.args || [], { cwd: input.cwd || root, encoding: "utf8", timeout: request.budget.max_duration_ms });
  if (result.status !== 0) {
    const error = new Error(`OPENCODE_STEP_FAILED: ${sanitizeText(result.stderr || result.stdout || "step failed")}`);
    error.code = "OPENCODE_STEP_FAILED";
    throw error;
  }
  return { status: "completed", executed: true, stdout: sanitizeText(result.stdout, 500) };
}
function requestApproval(session, details = {}) {
  return { approval_version: "1.0.0", approval_id: `approval-${session.correlation_id}`, correlation_id: session.correlation_id, reason: sanitizeText(details.reason || "approval required"), requested_capabilities: details.requested_capabilities || [], target: sanitizeText(details.target || "unspecified", 240), risk: details.risk || "medium", decision: "pending" };
}
function checkpoint(session, file) {
  const value = { checkpoint_version: "1.0.0", saved_at: new Date().toISOString(), correlation_id: session.correlation_id, pipeline_id: session.pipeline_id, status: session.status, completed_tasks: session.completed_tasks || [], artifact_names: session.artifact_names || [], budget: session.budget || {}, circuit: session.circuit || {}, policy_versions: { mcp: "1.1.0", checkpoint: "1.0.0" }, raw_content_included: false };
  atomicWriteJson(file, value, { mode: 0o600 });
  return value;
}
function cancel(session, reason = "operator-cancelled") { return { ...session, status: "cancelled", cancel_reason: sanitizeText(reason), raw_content_included: false }; }
function resume(file) { return readJsonWithRecovery(file).value; }
function readEvents(file, limit = 100) { if (!file || !fs.existsSync(file)) return []; return fs.readFileSync(file, "utf8").trim().split("\n").filter(Boolean).slice(-limit).map((line) => normalizeEvent(JSON.parse(line))); }
function collectArtifacts(directory) { if (!directory || !fs.existsSync(directory)) return []; return fs.readdirSync(directory).filter((name) => !/prompt|payload|token|secret|session/i.test(name)).map((name) => ({ name: sanitizeText(name, 160), classification: "operator-review-required" })); }
function closeSession(session, status = "completed", error) { return { ...session, status, closed_at: new Date().toISOString(), error_category: error ? sanitizeText(error.code || "runtime") : undefined, raw_content_included: false }; }

module.exports = { descriptor, discover, preflight, startSession, sendStep, requestApproval, checkpoint, cancel, resume, readEvents, collectArtifacts, closeSession };

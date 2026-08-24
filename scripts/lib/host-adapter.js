const fs = require("fs");
const path = require("path");
const { atomicWriteJson, readJsonWithRecovery } = require("./state-store");
const { createRequest, validateDescriptor, normalizeEvent, validateRequestPolicy, sanitizeText } = require("./adapter-contract");
const { loadMcpPolicy } = require("./runtime-guards");

function createHostAdapter(descriptor) {
  validateDescriptor(descriptor);
  function discover() { return { ...descriptor }; }
  function preflight(input = {}) {
    const target = path.resolve(input.project || process.cwd());
    const projectionPath = path.join(target, descriptor.projection_path);
    return { adapter_id: descriptor.adapter_id, host_integration: "operator-owned", projection_path: projectionPath, projection_present: fs.existsSync(projectionPath), lifecycle_control: descriptor.lifecycle_control, status: "requires-operator-verification" };
  }
  function startSession(input = {}) {
    const request = createRequest({ ...input, mode: input.mode || "read-only" });
    validateRequestPolicy(request, { policy: input.policy || loadMcpPolicy(), approval: input.approval === true });
    return { session_version: "1.0.0", correlation_id: request.correlation_id, pipeline_id: request.pipeline_id, adapter_id: descriptor.adapter_id, status: "awaiting-host", request, started_at: new Date().toISOString(), raw_content_included: false };
  }
  function sendStep(session, input = {}) {
    if (input.dryRun !== false) return { status: "planned", executed: false, host_action_required: true, instruction_projection: descriptor.projection_path };
    const error = new Error(`HOST_LIFECYCLE_UNAVAILABLE: ${descriptor.display_name} requires an operator or host bridge for live execution`);
    error.code = "HOST_LIFECYCLE_UNAVAILABLE";
    throw error;
  }
  function requestApproval(session, details = {}) { return { approval_version: "1.0.0", approval_id: `approval-${session.correlation_id}`, correlation_id: session.correlation_id, reason: sanitizeText(details.reason || "host approval required"), requested_capabilities: details.requested_capabilities || [], target: sanitizeText(details.target || "unspecified", 240), risk: details.risk || "medium", decision: "pending" }; }
  function checkpoint(session, file) { const value = { checkpoint_version: "1.0.0", saved_at: new Date().toISOString(), correlation_id: session.correlation_id, pipeline_id: session.pipeline_id, status: session.status, completed_tasks: session.completed_tasks || [], artifact_names: session.artifact_names || [], budget: session.budget || {}, circuit: session.circuit || {}, policy_versions: { mcp: "1.1.0", checkpoint: "1.0.0" }, raw_content_included: false }; atomicWriteJson(file, value, { mode: 0o600 }); return value; }
  function cancel(session, reason = "operator-cancelled") { return { ...session, status: "cancelled", cancel_reason: sanitizeText(reason), raw_content_included: false }; }
  function resume(file) { return readJsonWithRecovery(file).value; }
  function readEvents() { return []; }
  function collectArtifacts(directory) { if (!directory || !fs.existsSync(directory)) return []; return fs.readdirSync(directory).filter((name) => !/prompt|payload|token|secret|session/i.test(name)).map((name) => ({ name: sanitizeText(name, 160), classification: "operator-review-required" })); }
  function closeSession(session, status = "awaiting-host") { return { ...session, status, closed_at: new Date().toISOString(), raw_content_included: false }; }
  return { descriptor, discover, preflight, startSession, sendStep, requestApproval, checkpoint, cancel, resume, readEvents, collectArtifacts, closeSession };
}
module.exports = { createHostAdapter };

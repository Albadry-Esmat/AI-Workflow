const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { assertMcpCapabilities, classifyFailure } = require("./runtime-guards");

const OPERATIONS = ["discover", "preflight", "start_session", "send_step", "read_events", "request_approval", "checkpoint", "cancel", "resume", "collect_artifacts", "close_session"];
const root = path.resolve(__dirname, "../..");

function correlationId() { return `aiw-${crypto.randomUUID()}`; }
function fail(code, message) { const error = new Error(`${code}: ${message}`); error.code = code; throw error; }
function sanitizeText(value, max = 500) {
  return String(value || "").replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]").replace(/(ghp_|github_pat_|sk-)[A-Za-z0-9_-]+/g, "$1[REDACTED]").slice(0, max);
}
function validateDescriptor(descriptor) {
  if (!descriptor || typeof descriptor !== "object") fail("ADAPTER_DESCRIPTOR_INVALID", "descriptor must be an object");
  for (const field of ["adapter_id", "display_name", "runtime_family", "tier", "status", "supported_operations", "supported_capabilities", "version_range"]) if (descriptor[field] === undefined) fail("ADAPTER_DESCRIPTOR_INCOMPLETE", `missing ${field}`);
  if (!/^([a-z0-9]+-?)+$/.test(descriptor.adapter_id)) fail("ADAPTER_ID_INVALID", descriptor.adapter_id);
  if (![1, 2, 3].includes(descriptor.tier)) fail("ADAPTER_TIER_INVALID", descriptor.adapter_id);
  const invalid = descriptor.supported_operations.filter((operation) => !OPERATIONS.includes(operation));
  if (invalid.length) fail("ADAPTER_OPERATION_INVALID", invalid.join(", "));
  return true;
}
function createRequest(input = {}) {
  const request = {
    request_version: "1.0.0",
    correlation_id: input.correlation_id || correlationId(),
    pipeline_id: String(input.pipeline_id || "unknown").slice(0, 160),
    phase_id: input.phase_id === undefined ? "unknown" : input.phase_id,
    task_id: String(input.task_id || "unknown").slice(0, 160),
    mode: input.mode || "read-only",
    mcp_profile: input.mcp_profile || "pilot-read-only",
    project_classification: input.project_classification || "disposable",
    required_capabilities: [...new Set(input.required_capabilities || [])],
    budget: input.budget || { max_duration_ms: 300000, max_estimated_tokens: 20000, max_external_api_calls: 10 },
    input_artifact_names: [...new Set(input.input_artifact_names || [])],
    dry_run: input.dry_run !== false,
  };
  if (request.mode === "approved-write" && request.dry_run) fail("ADAPTER_REQUEST_INVALID", "approved-write request cannot be marked dry_run");
  return request;
}
function normalizeEvent(input = {}) {
  return {
    timestamp: new Date().toISOString(),
    event_id: `evt-${crypto.randomUUID()}`,
    schema_version: "1.0.0",
    event: input.event || "failure",
    session_id: sanitizeText(input.session_id, 160),
    pipeline_id: sanitizeText(input.pipeline_id, 160),
    phase_id: input.phase_id,
    skill: sanitizeText(input.skill, 160),
    status: sanitizeText(input.status, 80),
    duration_ms: Number.isFinite(input.duration_ms) ? Math.max(0, Math.floor(input.duration_ms)) : undefined,
    retry_count: Number.isFinite(input.retry_count) ? Math.max(0, Math.floor(input.retry_count)) : undefined,
    error_code: sanitizeText(input.error_code, 120),
    message: sanitizeText(input.message, 500),
  };
}
function validateRequestPolicy(request, options = {}) {
  try { return assertMcpCapabilities({ required_capabilities: request.required_capabilities }, { policy: options.policy, profileName: request.mcp_profile, approval: options.approval === true }); }
  catch (error) { error.failure_category = classifyFailure(error); throw error; }
}
function readCanonicalConfig() {
  return JSON.parse(fs.readFileSync(path.join(root, ".ai-workflow/config.json"), "utf8"));
}
module.exports = { OPERATIONS, correlationId, sanitizeText, validateDescriptor, createRequest, normalizeEvent, validateRequestPolicy, readCanonicalConfig };

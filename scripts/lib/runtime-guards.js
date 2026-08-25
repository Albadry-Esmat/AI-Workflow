const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "../..");

function loadJson(file, label) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); }
  catch (error) {
    const wrapped = new Error(`${label} could not be loaded: ${error.message}`);
    wrapped.code = "GUARD_CONFIG_INVALID";
    throw wrapped;
  }
}

function loadMcpPolicy(file = process.env.AIW_MCP_POLICY || path.join(root, "mcp-permission-policy.json")) {
  return loadJson(path.resolve(file), "MCP policy");
}

function assertMcpCapabilities(task = {}, options = {}) {
  const policy = options.policy || loadMcpPolicy(options.policyFile);
  const profileName = options.profileName || task.mcp_profile || process.env.AIW_MCP_PROFILE || policy.default_profile;
  const profile = policy.profiles?.[profileName];
  if (!profile) {
    const error = new Error(`MCP_PROFILE_UNKNOWN: unknown MCP profile: ${profileName}`);
    error.code = "MCP_PROFILE_UNKNOWN";
    throw error;
  }
  const requested = task.required_capabilities || task.capabilities || [];
  const missing = requested.filter((capability) => !(profile.allowed_capabilities || []).includes(capability));
  const writeRequested = requested.some((capability) => /^write:|^deploy$/.test(capability));
  const approved = options.approval === true || options.approval === "approve";
  if (missing.length) {
    const error = new Error(`MCP_CAPABILITY_DENIED: capability denied by ${profileName}: ${missing.join(", ")}`);
    error.code = "MCP_CAPABILITY_DENIED";
    error.profile = profileName;
    error.missing = missing;
    throw error;
  }
  if (writeRequested && profile.required_approval && !approved) {
    const error = new Error(`MCP_APPROVAL_REQUIRED: explicit approval required by ${profileName} before write or deployment`);
    error.code = "MCP_APPROVAL_REQUIRED";
    error.profile = profileName;
    throw error;
  }
  return { profile: profileName, requested, approved, allowed: true };
}

function loadBudget(file = process.env.AIW_BUDGET_FILE || path.join(root, "execution-budget.json")) {
  return loadJson(path.resolve(file), "execution budget");
}

class BudgetTracker {
  constructor(policy, options = {}) {
    this.policy = policy || loadBudget(options.policyFile);
    this.limits = this.policy.limits || {};
    this.startedAt = options.startedAt || Date.now();
    this.totalRetries = 0;
    this.estimatedTokens = 0;
    this.externalApiCalls = 0;
    this.completedTasks = 0;
  }
  snapshot() {
    return {
      elapsed_ms: Date.now() - this.startedAt,
      total_retries: this.totalRetries,
      estimated_tokens: this.estimatedTokens,
      external_api_calls: this.externalApiCalls,
      completed_tasks: this.completedTasks,
    };
  }
  consume(values = {}) {
    this.totalRetries += Number(values.retries || values.retry_count || 0);
    this.estimatedTokens += Number(values.estimated_tokens || values.tokens || 0);
    this.externalApiCalls += Number(values.external_api_calls || values.api_calls || 0);
    if (values.completed_task) this.completedTasks += 1;
    const snapshot = this.snapshot();
    const violations = [];
    if (this.totalRetries > this.limits.max_total_retries) violations.push("max_total_retries");
    if (snapshot.elapsed_ms > this.limits.max_duration_ms) violations.push("max_duration_ms");
    if (this.estimatedTokens > this.limits.max_estimated_tokens) violations.push("max_estimated_tokens");
    if (this.externalApiCalls > this.limits.max_external_api_calls) violations.push("max_external_api_calls");
    if (violations.length) {
      const error = new Error(`EXECUTION_BUDGET_EXCEEDED: execution budget exceeded: ${violations.join(", ")}`);
      error.code = "EXECUTION_BUDGET_EXCEEDED";
      error.violations = violations;
      error.snapshot = snapshot;
      throw error;
    }
    return snapshot;
  }
}

function classifyFailure(error) {
  if (!error) return "unknown";
  if (/MCP_|CAPABILITY/.test(error.code || "")) return "permission";
  if (/BUDGET/.test(error.code || "")) return "budget";
  if (/TIMEOUT|timed out/i.test(error.code || error.message || "")) return "timeout";
  if (/OUTPUT_|SCHEMA|ARTIFACT/.test(error.code || "")) return "contract";
  if (/STATE|LOCK|RECOVER/.test(error.code || "")) return "state";
  return "runtime";
}

module.exports = { loadMcpPolicy, assertMcpCapabilities, loadBudget, BudgetTracker, classifyFailure };

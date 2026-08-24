const { createHostAdapter } = require("../../scripts/lib/host-adapter");
module.exports = createHostAdapter({
  adapter_id: "github-copilot",
  display_name: "GitHub Copilot agent surfaces",
  runtime_family: "editor-cloud-agent",
  tier: 2,
  status: "experimental",
  entrypoint: "adapters/github-copilot",
  supported_operations: ["discover", "preflight", "start_session", "send_step", "read_events", "request_approval", "checkpoint", "cancel", "resume", "collect_artifacts", "close_session"],
  supported_capabilities: ["mcp", "editor", "enterprise-policy", "artifact_exchange"],
  version_range: "operator-defined",
  real_evidence: "not-certified",
  projection_path: ".github/ai-workflow",
  lifecycle_control: "surface-and-enterprise-policy-dependent",
});

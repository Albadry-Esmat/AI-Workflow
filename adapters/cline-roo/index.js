const { createHostAdapter } = require("../../scripts/lib/host-adapter");
module.exports = createHostAdapter({
  adapter_id: "cline-roo",
  display_name: "Cline / Roo Code",
  runtime_family: "editor-agent",
  tier: 2,
  status: "experimental",
  entrypoint: "adapters/cline-roo",
  supported_operations: ["discover", "preflight", "start_session", "send_step", "read_events", "request_approval", "checkpoint", "cancel", "resume", "collect_artifacts", "close_session"],
  supported_capabilities: ["mcp", "hooks", "plugins", "editor", "artifact_exchange"],
  version_range: "operator-defined",
  real_evidence: "not-certified",
  projection_path: ".cline/ai-workflow",
  lifecycle_control: "extension-and-hook-dependent",
});

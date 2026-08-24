const { createHostAdapter } = require("../../scripts/lib/host-adapter");
module.exports = createHostAdapter({
  adapter_id: "cursor",
  display_name: "Cursor",
  runtime_family: "editor-agent",
  tier: 2,
  status: "experimental",
  entrypoint: "adapters/cursor",
  supported_operations: ["discover", "preflight", "start_session", "send_step", "read_events", "request_approval", "checkpoint", "cancel", "resume", "collect_artifacts", "close_session"],
  supported_capabilities: ["mcp", "rules", "skills", "hooks", "editor", "artifact_exchange"],
  version_range: "operator-defined",
  real_evidence: "not-certified",
  projection_path: ".cursor/rules",
  lifecycle_control: "operator-or-hook-dependent",
});

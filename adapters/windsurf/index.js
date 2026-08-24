const { createHostAdapter } = require("../../scripts/lib/host-adapter");
module.exports = createHostAdapter({
  adapter_id: "windsurf",
  display_name: "Windsurf",
  runtime_family: "editor-agent",
  tier: 2,
  status: "experimental",
  entrypoint: "adapters/windsurf",
  supported_operations: ["discover", "preflight", "start_session", "send_step", "read_events", "request_approval", "checkpoint", "cancel", "resume", "collect_artifacts", "close_session"],
  supported_capabilities: ["mcp", "rules", "editor", "artifact_exchange"],
  version_range: "operator-defined",
  real_evidence: "not-certified",
  projection_path: ".windsurf/ai-workflow",
  lifecycle_control: "surface-dependent",
});

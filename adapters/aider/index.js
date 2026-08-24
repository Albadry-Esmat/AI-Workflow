const { createTerminalAdapter } = require("../../scripts/lib/terminal-adapter");
module.exports = createTerminalAdapter({
  adapter_id: "aider",
  display_name: "Aider",
  runtime_family: "terminal-agent",
  tier: 1,
  status: "experimental",
  entrypoint: "adapters/aider",
  supported_operations: ["discover", "preflight", "start_session", "send_step", "read_events", "request_approval", "checkpoint", "cancel", "resume", "collect_artifacts", "close_session"],
  supported_capabilities: ["cli", "git", "write_guard"],
  version_range: "operator-defined",
  real_evidence: "not-certified",
  executable: "aider",
  env_var: "AIW_AIDER_BIN",
});

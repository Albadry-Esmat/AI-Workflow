const { createTerminalAdapter } = require("../../scripts/lib/terminal-adapter");
module.exports = createTerminalAdapter({
  adapter_id: "gemini-cli",
  display_name: "Gemini CLI",
  runtime_family: "terminal-agent",
  tier: 1,
  status: "experimental",
  entrypoint: "adapters/gemini-cli",
  supported_operations: ["discover", "preflight", "start_session", "send_step", "read_events", "request_approval", "checkpoint", "cancel", "resume", "collect_artifacts", "close_session"],
  supported_capabilities: ["mcp", "extensions", "cli", "write_guard"],
  version_range: "operator-defined",
  real_evidence: "not-certified",
  executable: "gemini",
  env_var: "AIW_GEMINI_BIN",
});

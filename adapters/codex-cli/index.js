const { createTerminalAdapter } = require("../../scripts/lib/terminal-adapter");
module.exports = createTerminalAdapter({
  adapter_id: "codex-cli",
  display_name: "OpenAI Codex CLI",
  runtime_family: "terminal-agent",
  tier: 1,
  status: "experimental",
  entrypoint: "adapters/codex-cli",
  supported_operations: ["discover", "preflight", "start_session", "send_step", "read_events", "request_approval", "checkpoint", "cancel", "resume", "collect_artifacts", "close_session"],
  supported_capabilities: ["mcp", "agents-md", "cli", "write_guard"],
  version_range: "operator-defined",
  real_evidence: "not-certified",
  executable: "codex",
  env_var: "AIW_CODEX_BIN",
});

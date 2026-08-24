const { createTerminalAdapter } = require("../../scripts/lib/terminal-adapter");
module.exports = createTerminalAdapter({
  adapter_id: "claude-code",
  display_name: "Claude Code",
  runtime_family: "terminal-agent",
  tier: 1,
  status: "experimental",
  entrypoint: "adapters/claude-code",
  supported_operations: ["discover", "preflight", "start_session", "send_step", "read_events", "request_approval", "checkpoint", "cancel", "resume", "collect_artifacts", "close_session"],
  supported_capabilities: ["mcp", "skills", "hooks", "subagents", "cli", "write_guard"],
  version_range: "operator-defined",
  real_evidence: "not-certified",
  executable: "claude",
  env_var: "AIW_CLAUDE_BIN",
});

# Session State Directory
#
# This directory stores serialized session_context JSON files for all pipeline runs.
# Each file is named <session_id>.json and contains the full pipeline state.
#
# Rules:
# - Files older than 30 days may be deleted
# - Files MUST NOT contain credentials, tokens, or PII
# - The orchestrator writes here after every skill step
# - last_session.txt in the parent directory tracks the most recent session_id
#
# See: .opencode/skills/context-memory/SKILL.md for the full protocol

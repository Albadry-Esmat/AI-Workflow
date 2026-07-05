#!/usr/bin/env bash
# scripts/lib/common.sh — Shared utilities for all AI Workflow scripts.
#
# Usage: source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/common.sh"
#        (call from within the scripts/ directory)
#   OR:  source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/scripts/lib/common.sh"
#        (call from the project root)
#
# Provides:
#   - Color variables (auto-disabled in CI / non-TTY environments)
#   - ok / fail / warn / info / header output helpers
#   - check_tool — verifies a CLI tool is on PATH
#   - require_file — verifies a file exists
#   - require_env  — verifies an env var is non-empty

# ── Color output ──────────────────────────────────────────────────────────────
# Disable colors when running in CI, when stdout is not a terminal, or when
# the user sets NO_COLOR (https://no-color.org).
if [[ -t 1 ]] && [[ "${CI:-}" != "true" ]] && [[ -z "${NO_COLOR:-}" ]]; then
  RED='\033[0;31m'
  GREEN='\033[0;32m'
  YELLOW='\033[0;33m'
  BLUE='\033[0;34m'
  CYAN='\033[0;36m'
  BOLD='\033[1m'
  NC='\033[0m' # No Color / Reset
else
  RED='' GREEN='' YELLOW='' BLUE='' CYAN='' BOLD='' NC=''
fi

# ── Output helpers ────────────────────────────────────────────────────────────

ok() {
  echo -e "  ${GREEN}PASS${NC} $1"
}

fail() {
  echo -e "  ${RED}FAIL${NC} $1" >&2
}

warn() {
  echo -e "  ${YELLOW}WARN${NC} $1"
}

info() {
  echo -e "  ${CYAN}INFO${NC} $1"
}

header() {
  echo
  echo -e "${BOLD}=== $1 ===${NC}"
}

banner() {
  echo
  echo -e "${BOLD}${BLUE}╔══════════════════════════════════════╗${NC}"
  echo -e "${BOLD}${BLUE}║        AI Workflow — $1${NC}"
  echo -e "${BOLD}${BLUE}╚══════════════════════════════════════╝${NC}"
  echo
}

step() {
  echo -e "${BOLD}→${NC} $1"
}

# ── Tool checks ───────────────────────────────────────────────────────────────

# check_tool <name> [install-hint]
# Prints PASS if found, WARN+hint if missing (non-fatal)
check_tool() {
  local tool="$1"
  local hint="${2:-}"
  if command -v "$tool" &>/dev/null; then
    ok "$tool is installed ($(command -v "$tool"))"
    return 0
  else
    if [[ -n "$hint" ]]; then
      warn "$tool not found — install with: $hint"
    else
      warn "$tool not found"
    fi
    return 1
  fi
}

# require_tool <name> [install-hint]
# Same as check_tool but exits 1 on failure (fatal)
require_tool() {
  local tool="$1"
  local hint="${2:-}"
  if ! command -v "$tool" &>/dev/null; then
    if [[ -n "$hint" ]]; then
      fail "$tool is required but not found — install with: $hint"
    else
      fail "$tool is required but not found"
    fi
    exit 1
  fi
}

# ── File / env checks ─────────────────────────────────────────────────────────

# require_file <path> [message]
require_file() {
  local path="$1"
  local msg="${2:-File not found: $path}"
  if [[ ! -f "$path" ]]; then
    fail "$msg"
    exit 1
  fi
}

# require_env <VAR_NAME> [description]
# Exits 1 if the env var is unset or empty.
require_env() {
  local var="$1"
  local desc="${2:-$var}"
  if [[ -z "${!var:-}" ]]; then
    fail "$desc is not set. Add ${BOLD}$var=<value>${NC} to your .env file."
    exit 1
  fi
}

# check_env <VAR_NAME> [description] [warn-only]
# Prints PASS/WARN. Returns 1 if unset, but does NOT exit.
check_env() {
  local var="$1"
  local desc="${2:-$var}"
  local warn_only="${3:-false}"
  if [[ -n "${!var:-}" ]]; then
    ok "$desc is set"
    return 0
  else
    if [[ "$warn_only" == "true" ]]; then
      warn "$desc is not set (optional)"
    else
      fail "$desc is not set — add ${BOLD}$var=<value>${NC} to .env"
    fi
    return 1
  fi
}

# ── .env loader ───────────────────────────────────────────────────────────────

# load_env [path]
# Sources a .env file if it exists.
# Uses bash 'source' with set -o allexport so every assignment is exported.
# Bash natively ignores comment lines (#) and blank lines during sourcing.
# NOTE: values must use POSIX shell assignment syntax: KEY=VALUE (no spaces
# around '=', and no inline comments after the value). Windows CRLF line
# endings are stripped automatically before sourcing.
load_env() {
  local env_file="${1:-.env}"
  if [[ -f "$env_file" ]]; then
    set -o allexport
    # Strip Windows CRLF (\r) before sourcing to avoid invisible \r in values
    # shellcheck disable=SC1090
    source <(sed 's/\r//' "$env_file")
    set +o allexport
  fi
}

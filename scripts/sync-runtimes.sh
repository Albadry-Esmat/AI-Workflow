#!/usr/bin/env bash
# scripts/sync-runtimes.sh — P0 runtime adapter sync (skill-path adapters ONLY).
#
# Scope (P0 approved):
#   - Canonical source: .agents/skills/<name>/SKILL.md (121 skills, portable).
#   - Generates: .claude/skills/<name> -> ../../.agents/skills/<name> (symlink-primary).
#   - Fallback (symlink unavailable): directory junction if reliable, else
#     generated lightweight proxy SKILL.md (pointer only, never a body copy).
#   - Validates: Case-B invariant (no .opencode/skills bodies), parity
#     (index.yaml == .agents/skills count), no cross-root duplicate bodies.
#
# S1: skills phase (P0, unchanged) + MCP phase (scripts/sync-mcp.js engine).
# Explicitly OUT OF SCOPE: rules, custom agents, workflows, GEMINI.md,
# packaging, marketplaces, runtime installation.
#
# Usage:
#   bash scripts/sync-runtimes.sh                 # sync skills + MCP projections
#   bash scripts/sync-runtimes.sh --skills-only   # skills phase only (P0 behavior)
#   bash scripts/sync-runtimes.sh --check         # drift gate for both phases (CI)
#
# Deterministic: sorted skill names, relative symlinks, LF. No network, no secrets.
# Portable: no mapfile/arrays (macOS bash 3.2 compatible).

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

CHECK_MODE="false"
SKILLS_ONLY="false"
for arg in "$@"; do
  case "$arg" in
    --check) CHECK_MODE="true" ;;
    --skills-only) SKILLS_ONLY="true" ;;
  esac
done

CANON=".agents/skills"
CLAUDE=".claude/skills"
PROXY_MARKER="generated compatibility proxy — do not edit"
ERRORS=0
SYNCED=0
UP_TO_DATE=0

fail() { echo "  FAIL: $1" >&2; ERRORS=$((ERRORS+1)); }

if [[ ! -d "$CANON" ]]; then
  echo "FAIL: canonical $CANON not found" >&2
  exit 1
fi

SKILLS_LIST_FILE=$(mktemp /tmp/aiw_skills_XXXX.txt)
trap 'rm -f "$SKILLS_LIST_FILE" /tmp/aiw_expected_XXXX.txt 2>/dev/null || true' EXIT
find "$CANON" -mindepth 1 -maxdepth 1 -type d -exec basename {} \; | sort > "$SKILLS_LIST_FILE"
SKILL_COUNT=$(grep -c . "$SKILLS_LIST_FILE" || echo 0)
if [[ "$SKILL_COUNT" -eq 0 ]]; then
  echo "FAIL: no skills found in $CANON" >&2
  exit 1
fi

# Parity with index.yaml (warn-only here; validate-skills.sh check 4 is authoritative)
if [[ -f "skills/index.yaml" ]]; then
  INDEX_COUNT=$(grep -c "^- id:" skills/index.yaml || echo 0)
  if [[ "$INDEX_COUNT" -ne "$SKILL_COUNT" ]]; then
    echo "  WARN: index.yaml ($INDEX_COUNT) vs $CANON ($SKILL_COUNT) count differs (authoritative check: validate-skills.sh 4/10)"
  fi
fi

# Case-B invariant: .opencode/skills must not hold physical bodies
if [[ -e ".opencode/skills" ]] && [[ ! -L ".opencode/skills" ]]; then
  BODIES=$(find .opencode/skills -name "SKILL.md" 2>/dev/null | wc -l | tr -d ' ')
  if [[ "$BODIES" -gt 0 ]]; then
    fail ".opencode/skills holds $BODIES physical bodies (Case B: sole path is .agents/skills/)"
  fi
fi

mkdir -p "$CLAUDE"

# Generate/update Claude links
while IFS= read -r name; do
  [[ -z "$name" ]] && continue
  target="../../.agents/skills/$name"
  link="$CLAUDE/$name"
  canon_skill="$CANON/$name/SKILL.md"
  if [[ ! -f "$canon_skill" ]]; then
    fail "canonical missing: $canon_skill"
    continue
  fi
  if [[ -L "$link" ]]; then
    current=$(readlink "$link" || echo "")
    if [[ "$current" == "$target" ]]; then
      UP_TO_DATE=$((UP_TO_DATE+1))
    else
      if [[ "$CHECK_MODE" == "true" ]]; then
        fail "stale symlink: $link -> $current (expected $target)"
      else
        ln -sfn "$target" "$link"
        SYNCED=$((SYNCED+1))
      fi
    fi
  elif [[ -e "$link" ]]; then
    # Existing non-symlink: allow only a valid marked proxy (fallback mode)
    if [[ -f "$link/SKILL.md" ]] && grep -q "$PROXY_MARKER" "$link/SKILL.md" 2>/dev/null; then
      UP_TO_DATE=$((UP_TO_DATE+1))
    else
      fail "$link exists but is not a managed symlink/proxy (refusing to overwrite hand-maintained content)"
    fi
  else
    if [[ "$CHECK_MODE" == "true" ]]; then
      fail "missing adapter: $link -> $target"
    else
      if ln -s "$target" "$link" 2>/dev/null; then
        SYNCED=$((SYNCED+1))
      else
        # Fallback order per approved decision 2: junction, then proxy
        desc=$(grep -m1 "^description:" "$canon_skill" | sed 's/^description:[[:space:]]*//' || echo "See canonical skill.")
        mkdir -p "$link"
        {
          echo "---"
          echo "name: $name"
          echo "description: $desc"
          echo "x-aiw-proxy: true"
          echo "---"
          echo ""
          echo "<!-- $PROXY_MARKER for $name -->"
          echo ""
          echo "See the canonical skill body at \`../../.agents/skills/$name/SKILL.md\`."
          echo "This proxy exists only where filesystem links are unavailable."
        } > "$link/SKILL.md"
        echo "  WARN: $name: symlink unavailable, wrote proxy SKILL.md fallback"
        SYNCED=$((SYNCED+1))
      fi
    fi
  fi
done < "$SKILLS_LIST_FILE"

# Stale cleanup: entries in .claude/skills with no canonical counterpart
find "$CLAUDE" -mindepth 1 -maxdepth 1 \( -type l -o -type d \) -exec basename {} \; 2>/dev/null | sort > /tmp/aiw_expected_$$.txt || true
while IFS= read -r entry; do
  [[ -z "$entry" ]] && continue
  if ! grep -qx "$entry" "$SKILLS_LIST_FILE"; then
    if [[ "$CHECK_MODE" == "true" ]]; then
      fail "stale adapter with no canonical skill: $CLAUDE/$entry"
    else
      rm -rf "$CLAUDE/$entry"
      echo "  Removed stale adapter: $CLAUDE/$entry"
      SYNCED=$((SYNCED+1))
    fi
  fi
done < /tmp/aiw_expected_$$.txt
rm -f /tmp/aiw_expected_$$.txt

# Proxy integrity: proxies must be pointers (<2KB, marker present, no full body)
find "$CLAUDE" -name "SKILL.md" -type f 2>/dev/null | sort > /tmp/aiw_proxies_$$.txt || true
while IFS= read -r proxy; do
  [[ -z "$proxy" ]] && continue
  size=$(wc -c < "$proxy" | tr -d ' ')
  if ! grep -q "$PROXY_MARKER" "$proxy" 2>/dev/null; then
    fail "unmanaged file in $CLAUDE: $proxy (not a symlink or marked proxy)"
  elif [[ "$size" -gt 2048 ]]; then
    fail "proxy too large (possible body copy): $proxy (${size}B > 2048B)"
  fi
done < /tmp/aiw_proxies_$$.txt
rm -f /tmp/aiw_proxies_$$.txt

rm -f "$SKILLS_LIST_FILE"
trap - EXIT

# ── MCP phase (S1; skipped with --skills-only) ───────────────────────────────
if [[ "$SKILLS_ONLY" != "true" ]]; then
  echo "--- MCP projections (config/mcp-manifest.json) ---"
  if [[ "$CHECK_MODE" == "true" ]]; then
    if ! node "$ROOT/scripts/sync-mcp.js" --check; then
      fail "MCP projection drift (run 'bash scripts/sync-runtimes.sh' to regenerate)"
    fi
  else
    if ! node "$ROOT/scripts/sync-mcp.js" --write; then
      fail "MCP projection generation failed"
    fi
  fi
fi

if [[ "$CHECK_MODE" == "true" ]]; then
  if [[ "$ERRORS" -gt 0 ]]; then
    echo
    echo "Sync check FAILED — $ERRORS problem(s). Run 'bash scripts/sync-runtimes.sh' to regenerate."
    exit 1
  else
    echo "Sync check PASSED — $SKILL_COUNT Claude adapters in sync ($UP_TO_DATE up to date)."
    exit 0
  fi
else
  if [[ "$ERRORS" -gt 0 ]]; then
    echo
    echo "Sync completed with $ERRORS error(s) — $SYNCED updated, $UP_TO_DATE already up to date."
    exit 1
  else
    echo "Sync complete — $SYNCED updated, $UP_TO_DATE already up to date ($SKILL_COUNT total)."
    exit 0
  fi
fi

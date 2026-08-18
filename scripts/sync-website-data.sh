#!/usr/bin/env bash
# scripts/sync-website-data.sh — Sync website/data/ from authoritative source files.
#
# Run from the project root:  aiw sync             (sync this repo's website/data/)
#                             aiw sync --website   (sync + push to ASE-OS-Website repo)
#
# The website reads from website/data/ at build time. This script keeps that
# directory in sync with the source-of-truth files in the project root.
#
# Syncs:
#   skills/index.yaml              → website/data/skills/index.yaml
#   skills/registry.json           → website/data/skills/registry.json
#   skills/graph/skill-graph.yaml  → website/data/skills/graph/skill-graph.yaml
#   skills/pipelines/              → website/data/skills/pipelines/  (all *.json)
#   docs/changelog.md              → website/data/docs/changelog.md
#   opencode.json                  → website/data/opencode.json
#   config/agent-runtime-catalog.json → website/data/agent-runtimes.json
#   config/onboarding-o0-contract.json → website/data/onboarding-o0.json
#   config/onboarding-o2-contract.json → website/data/onboarding-o2.json
#   config/onboarding-o2-policy.json → website/data/onboarding-o2-policy.json
#   config/onboarding-o3-contract.json → website/data/onboarding-o3.json
#   config/onboarding-o3-policy.json → website/data/onboarding-o3-policy.json
#   config/onboarding-o4-contract.json → website/data/onboarding-o4.json
#   config/onboarding-o4-policy.json → website/data/onboarding-o4-policy.json
#   config/onboarding-o5-contract.json → website/data/onboarding-o5.json
#   config/onboarding-o5-policy.json → website/data/onboarding-o5-policy.json
#   config/onboarding-o5-state-schema.json → website/data/onboarding-o5-state-schema.json
#   config/runtime-installer-catalog.json → website/data/runtime-installer-catalog.json
#   config/runtime-installer-catalog-schema.json → website/data/runtime-installer-catalog-schema.json
#   config/toolchain-manifest.json → website/data/toolchain.json
#   config/toolchain-policy.json → website/data/toolchain-policy.json
#   .opencode/skills/              → website/data/.opencode/skills/  (all SKILL.md)
#   website/data/site-content.json → (already in website/data/, synced via rsync)
#
# Flags:
#   --dry-run    Show what would be synced without writing anything
#   --check      Exit 1 if any file is out of sync (for CI use)
#   --website    After syncing website/data/, also push to ASE-OS-Website repo

WEBSITE_REPO="https://github.com/Albadry-Esmat/ASE-OS-Website.git"
WEBSITE_REPO_DIR=""   # set below if --website is passed

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Load shared utilities
# shellcheck source=scripts/lib/common.sh
source "$ROOT/scripts/lib/common.sh"

DATA_DIR="${AIW_SYNC_DATA_DIR:-$ROOT/website/data}"
DRY_RUN=false
CHECK_MODE=false
PUSH_WEBSITE=false
TEST_DELETION=false
SYNCED=0
UP_TO_DATE=0
ERRORS=0

for arg in "$@"; do
  case "$arg" in
    --dry-run)  DRY_RUN=true       ;;
    --check)    CHECK_MODE=true    ;;
    --website)       PUSH_WEBSITE=true  ;;
    --test-deletion) TEST_DELETION=true  ;;
    --help|-h)
      echo "Usage: $0 [--dry-run] [--check] [--website]"
      echo "  --dry-run    Show what would be synced without writing anything"
      echo "  --check      Exit 1 if any file is out of sync (for CI use)"
      echo "  --website       Sync website/data/ then push to ASE-OS-Website repo"
      echo "  --test-deletion Run an isolated stale-file deletion regression test"
      exit 0
      ;;
  esac
done

banner "Sync Website Data"

if [[ "$DRY_RUN" == "true" ]]; then
  info "Dry-run mode — no files will be written"
elif [[ "$CHECK_MODE" == "true" ]]; then
  info "Check mode — will exit 1 if any file is out of sync"
fi

# ── Pre-sync: patch site-content.json with live-derived counts ────────────────
if [[ "$DRY_RUN" != "true" ]] && command -v node &>/dev/null; then
  header "Auto-patch site-content.json (live counts)"
  node "$ROOT/scripts/patch-site-content.js" || true
fi

# ── Guard: website/data must exist ────────────────────────────────────────────
if [[ ! -d "$DATA_DIR" ]]; then
  warn "website/data/ not found — skipping sync"
  echo "  Expected path: $DATA_DIR"
  echo "  This directory is the data mirror for the ASE-OS Website."
  echo "  It should already exist in the repo. If it was deleted, restore it with:"
  echo "    git checkout HEAD -- website/data/"
  echo ""
  echo "  Website source repo: https://github.com/Albadry-Esmat/ASE-OS-Website"
  echo "  Live site:           https://ase-os.vercel.app"
  exit 0
fi

# ── Helper: sync a single file ─────────────────────────────────────────────────
sync_file() {
  local src="$1"
  local dst="$2"

  if [[ ! -f "$src" ]]; then
    fail "Source not found: $src"
    ERRORS=$((ERRORS+1))
    return
  fi

  mkdir -p "$(dirname "$dst")"

  if [[ -f "$dst" ]] && cmp -s "$src" "$dst"; then
    info "Up to date: ${src#"$ROOT/"}"
    UP_TO_DATE=$((UP_TO_DATE+1))
    return
  fi

  if [[ "$DRY_RUN" == "true" ]] || [[ "$CHECK_MODE" == "true" ]]; then
    if [[ "$CHECK_MODE" == "true" ]]; then
      fail "Out of sync: ${src#"$ROOT/"} → ${dst#"$ROOT/"}"
    else
      ok "Would sync: ${src#"$ROOT/"} → ${dst#"$ROOT/"}"
    fi
    SYNCED=$((SYNCED+1))
  else
    cp "$src" "$dst"
    ok "Synced: ${src#"$ROOT/"} → ${dst#"$ROOT/"}"
    SYNCED=$((SYNCED+1))
  fi
}

# ── Helper: sync a directory (recursive copy of matching files) ────────────────
sync_dir() {
  local src_dir="$1"
  local dst_dir="$2"
  local pattern="${3:-*}"

  if [[ ! -d "$src_dir" ]]; then
    warn "Source directory not found: $src_dir — skipping"
    return
  fi

  mkdir -p "$dst_dir"

  while IFS= read -r -d '' src_file; do
    rel="${src_file#"$src_dir/"}"
    dst_file="$dst_dir/$rel"
    sync_file "$src_file" "$dst_file"
  done < <(find "$src_dir" -name "$pattern" -type f -print0 2>/dev/null || true)

  # Remove destination files that no longer exist in the authoritative source.
  # This prevents deleted skills or pipelines from remaining in website/data/.
  if [[ -d "$dst_dir" ]]; then
    while IFS= read -r -d '' dst_file; do
      rel="${dst_file#"$dst_dir/"}"
      base="$(basename "$dst_file")"
      case "$base" in
        $pattern) ;;
        *) continue ;;
      esac
      if [[ ! -f "$src_dir/$rel" ]]; then
        if [[ "$CHECK_MODE" == "true" ]]; then
          fail "Stale mirror file: ${dst_file#"$ROOT/"}"
          SYNCED=$((SYNCED+1))
        elif [[ "$DRY_RUN" == "true" ]]; then
          info "Would remove stale: ${dst_file#"$ROOT/"}"
          SYNCED=$((SYNCED+1))
        else
          rm -f "$dst_file"
          ok "Removed stale: ${dst_file#"$ROOT/"}"
          SYNCED=$((SYNCED+1))
        fi
      fi
    done < <(find "$dst_dir" -type f -print0 2>/dev/null || true)
    if [[ "$CHECK_MODE" != "true" ]]; then
      find "$dst_dir" -depth -type d -empty -delete 2>/dev/null || true
    fi
  fi
}

# ── Regression: deletion semantics ─────────────────────────────────────────────
run_deletion_test() {
  local test_root check_log sync_log
  test_root="$(mktemp -d -t aiw-sync-test.XXXXXX)"
  check_log="$(mktemp)"
  sync_log="$(mktemp)"

  cp -a "$DATA_DIR/." "$test_root/"
  mkdir -p "$test_root/skills/pipelines"
  printf '%s\n' '{"stale":true}' > "$test_root/skills/pipelines/__batch2_stale__.json"

  if AIW_SYNC_DATA_DIR="$test_root" "$0" --check >"$check_log" 2>&1; then
    cat "$check_log"
    rm -rf "$test_root" "$check_log" "$sync_log"
    fail "Deletion regression test did not detect the injected stale file"
    return 1
  fi

  AIW_SYNC_DATA_DIR="$test_root" "$0" >"$sync_log" 2>&1
  if [[ -e "$test_root/skills/pipelines/__batch2_stale__.json" ]]; then
    cat "$sync_log"
    rm -rf "$test_root" "$check_log" "$sync_log"
    fail "Deletion regression test did not remove the injected stale file"
    return 1
  fi

  if ! AIW_SYNC_DATA_DIR="$test_root" "$0" --check >"$check_log" 2>&1; then
    cat "$check_log"
    rm -rf "$test_root" "$check_log" "$sync_log"
    fail "Deletion regression test left the temporary mirror out of sync"
    return 1
  fi

  rm -rf "$test_root" "$check_log" "$sync_log"
  ok "Deletion regression test: stale mirror files are detected and removed"
}

if [[ "$TEST_DELETION" == "true" ]]; then
  header "Deletion regression test"
  run_deletion_test
  exit $?
fi

# ── Sync: skills/ root files ──────────────────────────────────────────────────
header "Skills registry files"
sync_file "$ROOT/skills/index.yaml"             "$DATA_DIR/skills/index.yaml"
sync_file "$ROOT/skills/registry.json"          "$DATA_DIR/skills/registry.json"
sync_file "$ROOT/skills/graph/skill-graph.yaml" "$DATA_DIR/skills/graph/skill-graph.yaml"

# ── Sync: pipeline JSON files ─────────────────────────────────────────────────
header "Pipeline templates"
sync_dir "$ROOT/skills/pipelines" "$DATA_DIR/skills/pipelines" "*.json"

# ── Sync: docs/changelog.md ───────────────────────────────────────────────────
header "Documentation"
sync_file "$ROOT/docs/changelog.md" "$DATA_DIR/docs/changelog.md"

# ── Sync: root opencode.json ──────────────────────────────────────────────────
header "opencode.json"
sync_file "$ROOT/opencode.json" "$DATA_DIR/opencode.json"

# ── Sync: agent-neutral onboarding contracts ───────────────────────────────────
header "Agent runtime and onboarding contracts"
sync_file "$ROOT/config/agent-runtime-catalog.json" "$DATA_DIR/agent-runtimes.json"
sync_file "$ROOT/config/onboarding-o0-contract.json" "$DATA_DIR/onboarding-o0.json"
sync_file "$ROOT/config/onboarding-o2-contract.json" "$DATA_DIR/onboarding-o2.json"
sync_file "$ROOT/config/onboarding-o2-policy.json" "$DATA_DIR/onboarding-o2-policy.json"
sync_file "$ROOT/config/onboarding-o3-contract.json" "$DATA_DIR/onboarding-o3.json"
sync_file "$ROOT/config/onboarding-o3-policy.json" "$DATA_DIR/onboarding-o3-policy.json"
sync_file "$ROOT/config/onboarding-o4-contract.json" "$DATA_DIR/onboarding-o4.json"
sync_file "$ROOT/config/onboarding-o4-policy.json" "$DATA_DIR/onboarding-o4-policy.json"
sync_file "$ROOT/config/onboarding-o5-contract.json" "$DATA_DIR/onboarding-o5.json"
sync_file "$ROOT/config/onboarding-o5-policy.json" "$DATA_DIR/onboarding-o5-policy.json"
sync_file "$ROOT/config/onboarding-o5-state-schema.json" "$DATA_DIR/onboarding-o5-state-schema.json"
sync_file "$ROOT/config/runtime-installer-o5-catalog.json" "$DATA_DIR/runtime-installer-o5-catalog.json"
sync_file "$ROOT/config/runtime-installer-o5-catalog-schema.json" "$DATA_DIR/runtime-installer-o5-catalog-schema.json"
sync_file "$ROOT/config/runtime-installer-catalog.json" "$DATA_DIR/runtime-installer-catalog.json"
sync_file "$ROOT/config/runtime-installer-catalog-schema.json" "$DATA_DIR/runtime-installer-catalog-schema.json"
sync_file "$ROOT/config/toolchain-manifest.json" "$DATA_DIR/toolchain.json"
sync_file "$ROOT/config/toolchain-policy.json" "$DATA_DIR/toolchain-policy.json"

# ── Sync: .opencode/skills/ SKILL.md files ────────────────────────────────────
header "Skill files (.opencode/skills/)"
sync_dir "$ROOT/.opencode/skills" "$DATA_DIR/.opencode/skills" "SKILL.md"

# ── Summary ───────────────────────────────────────────────────────────────────
echo
echo -e "${BOLD}════════════════════════════════════════${NC}"
if [[ "$CHECK_MODE" == "true" ]]; then
  if [[ "$SYNCED" -gt 0 ]] || [[ "$ERRORS" -gt 0 ]]; then
    echo -e "  ${RED}${BOLD}Sync check FAILED${NC} — $SYNCED file(s) out of sync, $ERRORS source file(s) missing"
    echo "  Run 'make sync' to update website/data/"
    echo -e "${BOLD}════════════════════════════════════════${NC}"
    exit 1
  else
    echo -e "  ${GREEN}${BOLD}Sync check PASSED${NC} — all $UP_TO_DATE file(s) are up to date"
  fi
elif [[ "$DRY_RUN" == "true" ]]; then
  echo -e "  Dry-run: $SYNCED file(s) would be synced, $UP_TO_DATE already up to date"
else
  if [[ "$SYNCED" -gt 0 ]]; then
    echo -e "  ${GREEN}Sync complete${NC} — $SYNCED file(s) updated, $UP_TO_DATE already up to date"
    echo
    echo "  Tip: commit website/data/ changes along with the source files"
  else
    echo -e "  ${GREEN}Nothing to sync${NC} — all $UP_TO_DATE file(s) are up to date"
  fi
fi
echo -e "${BOLD}════════════════════════════════════════${NC}"
echo

# ── Push to ASE-OS-Website repo (--website flag) ──────────────────────────────
if [[ "$PUSH_WEBSITE" == "true" ]] && [[ "$CHECK_MODE" == "false" ]] && [[ "$DRY_RUN" == "false" ]]; then
  header "Pushing to ASE-OS-Website"

  # Clone the Dev branch into a temp dir
  WEBSITE_REPO_DIR="$(mktemp -d)"
  trap 'rm -rf "$WEBSITE_REPO_DIR"' EXIT

  step "Cloning $WEBSITE_REPO ..."
  if ! git clone --depth 1 --branch Dev "$WEBSITE_REPO" "$WEBSITE_REPO_DIR" --quiet; then
    fail "Could not clone ASE-OS-Website — check your GITHUB_TOKEN and network."
    exit 1
  fi
  ok "Cloned into $WEBSITE_REPO_DIR"

  # Mirror website/data/ → data/ in the website repo exactly, including deletions
  step "Copying data files..."
  rm -rf "$WEBSITE_REPO_DIR/data"
  mkdir -p "$WEBSITE_REPO_DIR/data"
  cp -a "$DATA_DIR/." "$WEBSITE_REPO_DIR/data/"

  # Generate a manifest over the exact mirrored data tree. The manifest itself
  # is excluded from the data hash so it can safely record that hash.
  DATA_HASH=$(python3 "$ROOT/scripts/data-integrity.py" hash "$DATA_DIR")
  python3 "$ROOT/scripts/generate-release-manifest.py" \
    --source-root "$ROOT" \
    --website-root "$WEBSITE_REPO_DIR" \
    --data-hash "sha256:${DATA_HASH}" \
    --source-validation pass \
    --website-validation not-run \
    --website-build not-run \
    --output "$WEBSITE_REPO_DIR/data/release-manifest.json" \
    --validate

  # Check if anything actually changed
  cd "$WEBSITE_REPO_DIR"
  CHANGED=$(git status --short | wc -l | tr -d ' ')

  if [[ "$CHANGED" -eq 0 ]]; then
    ok "ASE-OS-Website is already up to date — nothing to push"
  else
    # Detect version from changelog for commit message
    VERSION=$(grep -m1 '## \[' "$ROOT/docs/changelog.md" 2>/dev/null \
              | sed 's/.*\[\(.*\)\].*/\1/' || echo "latest")

    step "Committing $CHANGED changed file(s)..."
    git add data/
    git commit -m "sync: update data/ from AI-Workflow v${VERSION}

Automated sync from AI-Workflow repository.
Source: https://github.com/Albadry-Esmat/AI-Workflow" --quiet

    step "Pushing to origin/Dev..."
    if git push origin Dev --quiet; then
      ok "Pushed $CHANGED file(s) to ASE-OS-Website"
      echo ""
      echo -e "  ${GREEN}${BOLD}ASE-OS-Website data is now up to date.${NC}"
      echo -e "  Live site will rebuild automatically: ${CYAN}https://ase-os.vercel.app${NC}"
      echo ""
      echo -e "  ${YELLOW}Note:${NC} this sync covers all data files including site-content.json."
      echo -e "  All website prose, features, agents, pipeline phases, and section content"
      echo -e "  are driven from ${CYAN}website/data/site-content.json${NC}."
    else
      fail "Push failed — check your GITHUB_TOKEN has write access to ASE-OS-Website."
      exit 1
    fi
  fi

  echo ""
  echo -e "${BOLD}════════════════════════════════════════${NC}"
  echo
fi

[[ "$ERRORS" -eq 0 ]]

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

DATA_DIR="$ROOT/website/data"
DRY_RUN=false
CHECK_MODE=false
PUSH_WEBSITE=false
SYNCED=0
UP_TO_DATE=0
ERRORS=0

for arg in "$@"; do
  case "$arg" in
    --dry-run)  DRY_RUN=true       ;;
    --check)    CHECK_MODE=true    ;;
    --website)  PUSH_WEBSITE=true  ;;
    --help|-h)
      echo "Usage: $0 [--dry-run] [--check] [--website]"
      echo "  --dry-run    Show what would be synced without writing anything"
      echo "  --check      Exit 1 if any file is out of sync (for CI use)"
      echo "  --website    Sync website/data/ then push to ASE-OS-Website repo"
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
}

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

  # Clone into a temp dir
  WEBSITE_REPO_DIR="$(mktemp -d)"
  trap 'rm -rf "$WEBSITE_REPO_DIR"' EXIT

  step "Cloning $WEBSITE_REPO ..."
  if ! git clone --depth 1 "$WEBSITE_REPO" "$WEBSITE_REPO_DIR" --quiet; then
    fail "Could not clone ASE-OS-Website — check your GITHUB_TOKEN and network."
    exit 1
  fi
  ok "Cloned into $WEBSITE_REPO_DIR"

  # Mirror website/data/ → data/ in the website repo
  step "Copying data files..."
  rsync -a --delete "$DATA_DIR/" "$WEBSITE_REPO_DIR/data/"

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

    step "Pushing to origin/main..."
    if git push origin main --quiet; then
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

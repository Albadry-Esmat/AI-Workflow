#!/usr/bin/env bash
# scripts/sync-website-data.sh — build and verify the authoritative website data artifact.
#
# Run from the project root:
#   aiw sync                    Build and apply the local website/data mirror.
#   aiw sync --dry-run          Show additions, changes, and deletions only.
#   aiw sync --check            Fail if the local mirror is not exact.
#   aiw sync --website           Also mirror the validated artifact to ASE-OS-Website.
#
# The source files in AI-Workflow are authoritative. The destination is treated
# as an exact mirror: destination-only files are removed, not retained.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/lib/common.sh
source "$ROOT/scripts/lib/common.sh"

WEBSITE_REPO="https://github.com/Albadry-Esmat/ASE-OS-Website.git"
DATA_DIR="$ROOT/website/data"
DRY_RUN=false
CHECK_MODE=false
PUSH_WEBSITE=false

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --check) CHECK_MODE=true ;;
    --website) PUSH_WEBSITE=true ;;
    --help|-h)
      cat <<'HELP'
Usage: aiw sync [--dry-run] [--check] [--website]

  --dry-run    Build a temporary artifact and show additions, changes, and deletions.
  --check      Fail unless website/data/ exactly matches the authoritative source.
  --website    Mirror the validated artifact into ASE-OS-Website (explicit operation).
HELP
      exit 0
      ;;
    *)
      fail "Unknown option: $arg"
      exit 2
      ;;
  esac
done

if [[ ! -d "$DATA_DIR" ]]; then
  fail "Destination directory not found: $DATA_DIR"
  exit 1
fi

copy_matching() {
  local source_dir="$1"
  local destination_dir="$2"
  local pattern="$3"
  mkdir -p "$destination_dir"
  while IFS= read -r -d '' source_file; do
    local relative="${source_file#"$source_dir/"}"
    mkdir -p "$destination_dir/$(dirname "$relative")"
    cp -a "$source_file" "$destination_dir/$relative"
  done < <(find "$source_dir" -type f -name "$pattern" -print0)
}

mirror_exact() {
  local source_dir="$1"
  local destination_dir="$2"
  mkdir -p "$destination_dir"

  while IFS= read -r -d '' destination_file; do
    local relative="${destination_file#"$destination_dir/"}"
    if [[ ! -f "$source_dir/$relative" ]]; then
      if [[ "$DRY_RUN" == "true" ]]; then
        echo "  DELETE: $relative"
      else
        rm -f "$destination_file"
      fi
    fi
  done < <(find "$destination_dir" -type f -print0)

  while IFS= read -r -d '' source_file; do
    local relative="${source_file#"$source_dir/"}"
    local destination_file="$destination_dir/$relative"
    if [[ ! -f "$destination_file" ]]; then
      if [[ "$DRY_RUN" == "true" ]]; then
        echo "  ADD: $relative"
      else
        mkdir -p "$(dirname "$destination_file")"
        cp -a "$source_file" "$destination_file"
      fi
    elif ! cmp -s "$source_file" "$destination_file"; then
      if [[ "$DRY_RUN" == "true" ]]; then
        echo "  MODIFY: $relative"
      else
        cp -a "$source_file" "$destination_file"
      fi
    fi
  done < <(find "$source_dir" -type f -print0)

  if [[ "$DRY_RUN" != "true" ]]; then
    find "$destination_dir" -type d -empty -delete
  fi
}

VERIFY="$ROOT/scripts/verify-website-sync.js"
PATCHER="$ROOT/scripts/patch-site-content.js"
if [[ ! -f "$VERIFY" ]]; then
  fail "Missing publication verifier: $VERIFY"
  exit 1
fi

banner "Sync Website Data"

if [[ "$CHECK_MODE" == "true" ]]; then
  header "Checking source-generated content"
  node "$PATCHER" --check
  header "Checking exact local mirror"
  node "$VERIFY" --target "$DATA_DIR" --check
  ok "Local website/data mirror is exact"
  exit 0
fi

if [[ "$DRY_RUN" == "true" ]]; then
  info "Dry-run mode — no files will be written"
fi

# Patch the authoritative source content only during a real sync. The patcher
# validates and atomically writes JSON; the temporary artifact is then built
# from the resulting source files.
if [[ "$DRY_RUN" != "true" ]]; then
  header "Updating generated site content"
  node "$PATCHER"
fi

STAGE="$(mktemp -d)"
WEBSITE_REPO_DIR=""
cleanup() {
  rm -rf "$STAGE"
  if [[ -n "$WEBSITE_REPO_DIR" ]]; then rm -rf "$WEBSITE_REPO_DIR"; fi
}
trap cleanup EXIT

header "Building validated publication artifact"
mkdir -p "$STAGE/skills/graph" "$STAGE/skills/pipelines" "$STAGE/docs" "$STAGE/.opencode/skills"
cp "$ROOT/skills/index.yaml" "$STAGE/skills/index.yaml"
cp "$ROOT/skills/registry.json" "$STAGE/skills/registry.json"
cp "$ROOT/skills/graph/skill-graph.yaml" "$STAGE/skills/graph/skill-graph.yaml"
cp "$ROOT/docs/changelog.md" "$STAGE/docs/changelog.md"
cp "$ROOT/opencode.json" "$STAGE/opencode.json"
cp "$ROOT/website/data/site-content.json" "$STAGE/site-content.json"
copy_matching "$ROOT/skills/pipelines" "$STAGE/skills/pipelines" "*.json"
copy_matching "$ROOT/.opencode/skills" "$STAGE/.opencode/skills" "SKILL.md"

node "$VERIFY" --target "$STAGE" --check --report "$ROOT/website/data/.publication-verification.json"

header "Comparing staged artifact with local mirror"
mirror_exact "$STAGE" "$DATA_DIR"

if [[ "$DRY_RUN" == "true" ]]; then
  ok "Dry-run complete"
  exit 0
fi

header "Applying exact local mirror"
mirror_exact "$STAGE" "$DATA_DIR"
node "$VERIFY" --target "$DATA_DIR" --check --report "$DATA_DIR/.publication-verification.json"
rm -f "$DATA_DIR/.publication-verification.json"
ok "Local website/data mirror is synchronized exactly"

if [[ "$PUSH_WEBSITE" == "true" ]]; then
  header "Mirroring validated artifact to ASE-OS-Website"
  WEBSITE_REPO_DIR="$(mktemp -d)"
  git clone --depth 1 "$WEBSITE_REPO" "$WEBSITE_REPO_DIR" --quiet
  mirror_exact "$STAGE" "$WEBSITE_REPO_DIR/data"
  node "$VERIFY" --target "$WEBSITE_REPO_DIR/data" --check

  cd "$WEBSITE_REPO_DIR"
  if [[ -z "$(git status --short)" ]]; then
    ok "ASE-OS-Website is already synchronized"
    exit 0
  fi

  VERSION="$(node -e 'const fs=require("fs"); const x=JSON.parse(fs.readFileSync("data/skills/registry.json","utf8")); process.stdout.write(x.version || "unreleased")')"
  git config user.name "github-actions[bot]"
  git config user.email "github-actions[bot]@users.noreply.github.com"
  git add data/
  git commit -m "sync: update data/ from AI-Workflow v${VERSION}" --quiet
  git push origin main --quiet
  ok "Pushed validated website data to ASE-OS-Website"
fi

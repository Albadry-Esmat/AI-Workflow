#!/usr/bin/env bash
# validate-skills.sh — Local skill validation script
# Run from the project root: bash scripts/validate-skills.sh
#
# Checks:
#   1. All pipeline JSON configs validate against pipeline-schema.json
#   2. All SKILL.md files contain the required 13 sections
#   3. All skill IDs in index.yaml are unique
#   4. Skill count in index.yaml matches .opencode/skills/ directory count
#   5. All skill paths referenced in opencode.json exist on disk
#   6. skill-graph.yaml total_nodes matches index.yaml entry count
#
# Requires: ajv-cli (npm install -g ajv-cli ajv-formats), node, grep, awk

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PASS=0
FAIL=0

ok()   { echo "  PASS: $1"; PASS=$((PASS+1)); }
fail() { echo "  FAIL: $1"; FAIL=$((FAIL+1)); }
header() { echo; echo "=== $1 ==="; }

# ─── 1. Pipeline JSON validation ──────────────────────────────────────────────
header "Pipeline configs vs pipeline-schema.json"
if command -v ajv &>/dev/null; then
  for f in skills/pipelines/*.json; do
    if ajv validate -s skills/schema/pipeline-schema.json -d "$f" \
         --spec=draft7 --allow-union-types 2>/dev/null; then
      ok "$f"
    else
      fail "$f (schema validation failed)"
    fi
  done
else
  echo "  SKIP: ajv-cli not found — install with: npm install -g ajv-cli ajv-formats"
fi

# ─── 2. SKILL.md required sections ───────────────────────────────────────────
header "SKILL.md required sections (13-section template)"
REQUIRED_SECTIONS=(
  "Purpose"
  "Inputs"
  "Required Context"
  "Execution Logic"
  "Outputs"
  "Rules"
  "Security"
  "Token Optim"
  "Quality Check"
  "Failure"
  "Human-in-the-Loop"
  "Skill Composition"
)
# Skills that use a non-standard meta format (protocol docs, not pipeline skills)
# These are excluded from the 13-section template check
META_SKILLS=(
  "context-memory"
  "observability"
  "quality-scoring"
  "skill-lifecycle"
  "trigger-engineering"
  "validation-rules"
  "versioning"
)

for skill_dir in .opencode/skills/*/; do
  skill_name=$(basename "$skill_dir")
  skill_file="${skill_dir}SKILL.md"

  # Skip meta-format skills
  skip=0
  for meta in "${META_SKILLS[@]}"; do
    [ "$skill_name" = "$meta" ] && skip=1 && break
  done
  if [ "$skip" -eq 1 ]; then
    echo "  SKIP (meta-format): $skill_file"
    continue
  fi
  if [ ! -f "$skill_file" ]; then
    fail "Missing: $skill_file"
    continue
  fi
  missing=()
  for section in "${REQUIRED_SECTIONS[@]}"; do
    if ! grep -qi "$section" "$skill_file"; then
      missing+=("$section")
    fi
  done
  if [ ${#missing[@]} -eq 0 ]; then
    ok "$skill_file"
  else
    fail "$skill_file missing sections: ${missing[*]}"
  fi
done

# ─── 3. Unique skill IDs in index.yaml ───────────────────────────────────────
header "Unique skill IDs in skills/index.yaml"
DUPES=$(grep "^  - id:" skills/index.yaml | sort | uniq -d)
if [ -n "$DUPES" ]; then
  fail "Duplicate skill IDs: $DUPES"
else
  ok "All skill IDs are unique"
fi

# ─── 4. Count consistency ─────────────────────────────────────────────────────
header "Skill count: index.yaml vs .opencode/skills/"
INDEX_COUNT=$(grep -c "^  - id:" skills/index.yaml)
DIR_COUNT=$(ls -d .opencode/skills/*/ 2>/dev/null | wc -l | tr -d ' ')
echo "  index.yaml entries : $INDEX_COUNT"
echo "  .opencode/skills/  : $DIR_COUNT"
if [ "$INDEX_COUNT" -eq "$DIR_COUNT" ]; then
  ok "Counts match ($INDEX_COUNT)"
else
  fail "Count mismatch — index.yaml ($INDEX_COUNT) vs directory ($DIR_COUNT)"
fi

# ─── 5. opencode.json skill path existence ────────────────────────────────────
header "opencode.json skill paths exist on disk"
if command -v node &>/dev/null; then
  while IFS= read -r path; do
    if [ -f "$path" ]; then
      ok "$path"
    else
      fail "Missing: $path"
    fi
  done < <(node -e "
    const fs = require('fs');
    const cfg = JSON.parse(fs.readFileSync('opencode.json', 'utf8'));
    const paths = [];
    for (const agent of Object.values(cfg.agent || {})) {
      if (agent.skill)  paths.push(agent.skill);
      if (agent.skills) paths.push(...agent.skills);
    }
    paths.forEach(p => console.log(p));
  ")
else
  echo "  SKIP: node not found"
fi

# ─── 6. Graph node count ─────────────────────────────────────────────────────
header "skill-graph.yaml total_nodes vs index.yaml entry count"
GRAPH_NODES=$(grep "total_nodes:" skills/graph/skill-graph.yaml | awk '{print $2}')
echo "  graph total_nodes  : $GRAPH_NODES"
echo "  index.yaml entries : $INDEX_COUNT"
if [ "$GRAPH_NODES" -eq "$INDEX_COUNT" ]; then
  ok "Node counts match ($GRAPH_NODES)"
else
  fail "Node count mismatch — graph ($GRAPH_NODES) vs index ($INDEX_COUNT)"
fi

# ─── Summary ──────────────────────────────────────────────────────────────────
echo
echo "════════════════════════════════════════"
echo "  Results: $PASS passed, $FAIL failed"
echo "════════════════════════════════════════"
[ "$FAIL" -eq 0 ] || exit 1

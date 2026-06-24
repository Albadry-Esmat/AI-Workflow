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
#   7. Version consistency: registry.json versions match skill-graph.yaml node versions
#   8. origin_metadata shape validation for v5.1.0+ skills (FEATURE-003)
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
DUPES=$(grep "^- id:" skills/index.yaml | sort | uniq -d || true)
if [ -n "$DUPES" ]; then
  fail "Duplicate skill IDs: $DUPES"
else
  ok "All skill IDs are unique"
fi

# ─── 4. Count consistency ─────────────────────────────────────────────────────
header "Skill count: index.yaml vs .opencode/skills/"
INDEX_COUNT=$(grep -c "^- id:" skills/index.yaml || echo 0)
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

# ─── 7. Version consistency: registry.json vs skill-graph.yaml ───────────────
header "Version consistency: registry.json vs skill-graph.yaml"
if command -v node &>/dev/null; then
  node -e "
    const fs = require('fs');
    const registry = JSON.parse(fs.readFileSync('skills/registry.json', 'utf8'));

    // Parse skill-graph.yaml node versions via simple regex (no yaml dep needed)
    const yaml = fs.readFileSync('skills/graph/skill-graph.yaml', 'utf8');
    const graphVersions = {};
    const nodeBlocks = yaml.split(/\n  - id:/);
    for (const block of nodeBlocks.slice(1)) {
      const nameMatch = block.match(/name:\s+(\S+)/);
      const verMatch  = block.match(/version:\s+(\S+)/);
      if (nameMatch && verMatch) graphVersions[nameMatch[1]] = verMatch[1];
    }

    let mismatches = 0;
    for (const skill of registry.skills) {
      const graphVer = graphVersions[skill.name];
      if (!graphVer) continue; // skill not in graph (utility/meta) — skip
      if (graphVer !== skill.version) {
        console.error('  MISMATCH: ' + skill.name + ' registry=' + skill.version + ' graph=' + graphVer);
        mismatches++;
      }
    }
    if (mismatches === 0) {
      console.log('  PASS: All registry versions match skill-graph.yaml');
      process.exit(0);
    } else {
      process.exit(1);
    }
  " && PASS=$((PASS+1)) || FAIL=$((FAIL+1))
else
  echo "  SKIP: node not found"
fi

# ─── 8. origin_metadata validation (FEATURE-003) ─────────────────────────────
header "origin_metadata shape validation (skills/registry.json)"
if command -v node &>/dev/null; then
  node -e "
    const fs = require('fs');
    const registry = JSON.parse(fs.readFileSync('skills/registry.json', 'utf8'));
    const REQUIRED_FIELDS = ['source', 'approval_tier', 'created_at'];
    const VALID_SOURCES = new Set(['human', 'gap-triggered', 'migrated', 'unknown']);
    const VALID_TIERS   = new Set(['standard', 'expedited', 'legacy']);

    let warnings = 0;
    let errors   = 0;
    const phase6Names = [];

    for (const skill of registry.skills) {
      if (!skill.origin_metadata) {
        // Pre-v5.1.0 skills are exempt — emit a single summary at the end
        warnings++;
        continue;
      }
      const om = skill.origin_metadata;
      const missing = REQUIRED_FIELDS.filter(f => !(f in om));
      if (missing.length > 0) {
        console.error('  ERROR: ' + skill.name + ' origin_metadata missing: ' + missing.join(', '));
        errors++;
        continue;
      }
      if (!VALID_SOURCES.has(om.source)) {
        console.error('  ERROR: ' + skill.name + ' origin_metadata.source invalid: ' + om.source);
        errors++;
      }
      if (!VALID_TIERS.has(om.approval_tier)) {
        console.error('  ERROR: ' + skill.name + ' origin_metadata.approval_tier invalid: ' + om.approval_tier);
        errors++;
      }
      if (errors === 0) phase6Names.push(skill.name);
    }

    if (errors > 0) { process.exit(1); }
    if (phase6Names.length > 0) {
      console.log('  PASS: origin_metadata valid for: ' + phase6Names.join(', '));
    }
    console.log('  WARN: ' + warnings + ' pre-v5.1.0 skill(s) lack origin_metadata — exempted');
    process.exit(0);
  " && PASS=$((PASS+1)) || FAIL=$((FAIL+1))
else
  echo "  SKIP: node not found"
fi

# ─── Summary ──────────────────────────────────────────────────────────────────
echo
echo "════════════════════════════════════════"
echo "  Results: $PASS passed, $FAIL failed"
echo "════════════════════════════════════════"
[ "$FAIL" -eq 0 ] || exit 1

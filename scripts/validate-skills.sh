#!/usr/bin/env bash
# validate-skills.sh — Full skill validation suite (10 checks).
#
# Run from the project root:  make validate  OR  bash scripts/validate-skills.sh
#
# Checks:
#   0. YAML syntax check — skills/index.yaml parses as valid YAML
#   1. All pipeline JSON configs validate against pipeline-schema.json
#   2. All SKILL.md files contain the required 12 section keywords
#   3. All skill IDs in skills/index.yaml are unique
#   4. Skill count: index.yaml entries == .opencode/skills/ directory count
#   5. All skill paths referenced in opencode.json exist on disk
#   6. skill-graph.yaml total_nodes matches index.yaml entry count
#   7. Version consistency: registry.json versions match skill-graph.yaml nodes
#   8. origin_metadata shape validation for v5.1.0+ skills
#   9. index.yaml version field matches SKILL.md frontmatter version
#   10. Community skill SHA-256 hash verification
#
# Requires: node and the pinned root npm dependencies

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Load shared utilities
# shellcheck source=scripts/lib/common.sh
source "$ROOT/scripts/lib/common.sh"

# Load .env (non-fatal — env vars are only informational here)
load_env "$ROOT/.env" 2>/dev/null || true

PASS=0
FAIL=0

_ok()     { ok "$1";           PASS=$((PASS+1)); }
_fail()   { fail "$1";         FAIL=$((FAIL+1)); }
_skip()   { info "SKIP: $1"; }

# ── 0. YAML syntax check ───────────────────────────────────────────────────────
header "0/10 — YAML syntax check (skills/index.yaml)"
if node scripts/validate-yaml.js; then
  _ok "skills/index.yaml is valid YAML"
else
  _fail "skills/index.yaml has YAML parse errors"
fi

# ── 1. Pipeline JSON schema validation ────────────────────────────────────────
header "1/10 — Pipeline configs vs pipeline-schema.json"
if [[ -x node_modules/.bin/ajv ]]; then
  for f in skills/pipelines/*.json; do
    [[ -f "$f" ]] || continue
    if npx --no-install ajv validate \
        -s skills/schema/pipeline-schema.json \
        -d "$f" \
        --spec=draft7 \
        --allow-union-types 2>/dev/null; then
      _ok "$f"
    else
      _fail "$f — schema validation failed"
    fi
  done
else
  _fail "ajv-cli is not installed locally — run: npm ci"
fi

# ── 2. SKILL.md required sections ─────────────────────────────────────────────
header "2/10 — SKILL.md required sections (12-keyword check)"

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

# Skills that use a non-standard meta format (protocol/governance docs, not
# pipeline skills). These are excluded from the 12-section keyword check.
# To update this list, edit the array below — do not use an env variable,
# as this list is a framework invariant that must be reviewed intentionally.
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

  # Check if this skill is on the meta-format exemption list
  skip=0
  for meta in "${META_SKILLS[@]}"; do
    [[ "$skill_name" == "$meta" ]] && skip=1 && break
  done
  if [[ "$skip" -eq 1 ]]; then
    _skip "(meta-format) $skill_file"
    continue
  fi

  if [[ ! -f "$skill_file" ]]; then
    _fail "Missing: $skill_file"
    echo "         Fix: create the file using skills/template/skill-template.md"
    continue
  fi

  missing=()
  for section in "${REQUIRED_SECTIONS[@]}"; do
    if ! grep -qi "$section" "$skill_file"; then
      missing+=("$section")
    fi
  done

  if [[ ${#missing[@]} -eq 0 ]]; then
    _ok "$skill_file"
  else
    _fail "$skill_file — missing sections: ${missing[*]}"
    echo "         Fix: add the missing ## headings per skills/template/skill-template.md"
  fi
done

# ── 3. Unique skill IDs ────────────────────────────────────────────────────────
header "3/10 — Unique skill IDs in skills/index.yaml"
if [[ ! -f "skills/index.yaml" ]]; then
  _fail "skills/index.yaml not found"
  echo "         Fix: ensure skills/index.yaml exists at the repository root"
else
  DUPES=$(grep "^- id:" skills/index.yaml | sort | uniq -d || true)
  if [[ -n "$DUPES" ]]; then
    _fail "Duplicate skill IDs found: $DUPES"
    echo "         Fix: assign a new unique SKL-NNN ID to the duplicate entry"
  else
    _ok "All skill IDs are unique"
  fi
fi

# ── 4. Count consistency ───────────────────────────────────────────────────────
header "4/10 — Skill count: index.yaml vs .opencode/skills/"
INDEX_COUNT=$(grep -c "^- id:" skills/index.yaml || echo 0)
DIR_COUNT=$(find .opencode/skills -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l | tr -d ' ')
echo "  index.yaml entries : $INDEX_COUNT"
echo "  .opencode/skills/  : $DIR_COUNT"
if [[ "$INDEX_COUNT" -eq "$DIR_COUNT" ]]; then
  _ok "Counts match ($INDEX_COUNT)"
else
  _fail "Count mismatch — index.yaml ($INDEX_COUNT) vs .opencode/skills/ directory ($DIR_COUNT)"
  echo "         Fix: ensure every SKILL.md directory has a corresponding entry in index.yaml"
fi

# ── 5. opencode.json skill path existence ─────────────────────────────────────
header "5/10 — opencode.json skill paths exist on disk"
if command -v node &>/dev/null; then
  while IFS= read -r path; do
    if [[ -f "$path" ]]; then
      _ok "$path"
    else
      _fail "Missing: $path"
      echo "         Fix: create the SKILL.md file or update the path in opencode.json"
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
  _skip "node not found — fix: https://nodejs.org"
fi

# ── 6. Graph node count ────────────────────────────────────────────────────────
header "6/10 — skill-graph.yaml total_nodes vs index.yaml entry count"
GRAPH_NODES=$(grep "total_nodes:" skills/graph/skill-graph.yaml 2>/dev/null | awk '{print $2}')
GRAPH_NODES="${GRAPH_NODES:-0}"
echo "  graph total_nodes  : $GRAPH_NODES"
echo "  index.yaml entries : $INDEX_COUNT"
if [[ "$GRAPH_NODES" -eq "$INDEX_COUNT" ]]; then
  _ok "Node counts match ($GRAPH_NODES)"
else
  _fail "Node count mismatch — graph ($GRAPH_NODES) vs index ($INDEX_COUNT)"
  echo "         Fix: update total_nodes in skills/graph/skill-graph.yaml to $INDEX_COUNT"
fi

# ── 7. Version consistency: registry.json vs skill-graph.yaml ─────────────────
header "7/10 — Version consistency: registry.json vs skill-graph.yaml"
if command -v node &>/dev/null; then
  node -e "
    const fs = require('fs');
    const registry = JSON.parse(fs.readFileSync('skills/registry.json', 'utf8'));
    const yaml = fs.readFileSync('skills/graph/skill-graph.yaml', 'utf8');

    // Extract node versions from YAML via simple regex (avoids yaml dep)
    const graphVersions = {};
    for (const block of yaml.split(/\n- id:/).slice(1)) {
      const nameMatch = block.match(/name:\s+(\S+)/);
      const verMatch  = block.match(/version:\s+(\S+)/);
      if (nameMatch && verMatch) graphVersions[nameMatch[1]] = verMatch[1];
    }

    let mismatches = 0;
    for (const skill of registry.skills) {
      const graphVer = graphVersions[skill.name];
      if (!graphVer) continue; // utility/meta skill not in graph — skip
      if (graphVer !== skill.version) {
        process.stderr.write('  FAIL: ' + skill.name
          + '  registry=' + skill.version
          + '  graph=' + graphVer + '\n');
        mismatches++;
      }
    }
    if (mismatches === 0) {
      console.log('  PASS: All registry versions match skill-graph.yaml');
      process.exit(0);
    } else {
      process.stderr.write('  Fix: sync version fields in registry.json and skill-graph.yaml\n');
      process.exit(1);
    }
  " && PASS=$((PASS+1)) || { FAIL=$((FAIL+1)); }
else
  _skip "node not found — fix: https://nodejs.org"
fi

# ── 8. origin_metadata shape validation ───────────────────────────────────────
header "8/10 — origin_metadata shape validation (registry.json, v5.1.0+ skills)"
if command -v node &>/dev/null; then
  node -e "
    const fs = require('fs');
    const registry = JSON.parse(fs.readFileSync('skills/registry.json', 'utf8'));
    const REQUIRED_FIELDS = ['source', 'approval_tier', 'created_at'];
    const VALID_SOURCES = new Set(['human', 'gap-triggered', 'migrated', 'unknown']);
    const VALID_TIERS   = new Set(['standard', 'expedited', 'legacy']);

    let warnings = 0;
    let errors   = 0;
    const valid  = [];

    for (const skill of registry.skills) {
      if (!skill.origin_metadata) {
        // Pre-v5.1.0 skills are exempt — counted but not failed
        warnings++;
        continue;
      }
      const om = skill.origin_metadata;
      const missing = REQUIRED_FIELDS.filter(f => !(f in om));
      if (missing.length > 0) {
        process.stderr.write('  FAIL: ' + skill.name
          + ' — origin_metadata missing fields: ' + missing.join(', ') + '\n');
        errors++;
        continue;
      }
      if (!VALID_SOURCES.has(om.source)) {
        process.stderr.write('  FAIL: ' + skill.name
          + ' — origin_metadata.source invalid: \"' + om.source + '\"\n');
        process.stderr.write('        Valid values: ' + [...VALID_SOURCES].join(', ') + '\n');
        errors++;
      }
      if (!VALID_TIERS.has(om.approval_tier)) {
        process.stderr.write('  FAIL: ' + skill.name
          + ' — origin_metadata.approval_tier invalid: \"' + om.approval_tier + '\"\n');
        process.stderr.write('        Valid values: ' + [...VALID_TIERS].join(', ') + '\n');
        errors++;
      }
      if (errors === 0) valid.push(skill.name);
    }

    if (errors > 0) { process.exit(1); }
    if (valid.length > 0) {
      console.log('  PASS: origin_metadata valid for ' + valid.length + ' skill(s)');
    }
    if (warnings > 0) {
      console.log('  WARN: ' + warnings + ' pre-v5.1.0 skill(s) lack origin_metadata — exempted');
    }
    process.exit(0);
  " && PASS=$((PASS+1)) || { FAIL=$((FAIL+1)); echo "         Fix: add valid origin_metadata to the failing skill entries in registry.json"; }
else
  _skip "node not found — fix: https://nodejs.org"
fi

# ── 9. index.yaml version vs SKILL.md frontmatter ─────────────────────────────
header "9/10 — index.yaml version vs SKILL.md frontmatter version"
if node scripts/validate-skill-metadata.js; then
  PASS=$((PASS+1))
else
  FAIL=$((FAIL+1))
  echo "         Fix: synchronize index.yaml and SKILL.md metadata"
fi

# ── 10. Community skill SHA-256 hash verification ─────────────────────────────
header "10/10 — Community skill SHA-256 hash verification"
if node scripts/validate-skill-metadata.js; then
  _ok "Community skill SHA-256 verification"
else
  _fail "Community skill SHA-256 verification — see FAIL lines above"
fi

# ── Results ───────────────────────────────────────────────────────────────────
echo
echo -e "${BOLD}════════════════════════════════════════${NC}"
if [[ "$FAIL" -eq 0 ]]; then
  echo -e "  ${GREEN}${BOLD}All checks passed${NC} — $PASS passed, 0 failed"
else
  echo -e "  ${RED}${BOLD}Validation failed${NC} — $PASS passed, $FAIL failed"
  echo
  echo "  Review the FAIL lines above. Each failure includes a Fix: hint."
  echo "  Run 'make validate' again once the issues are resolved."
fi
echo -e "${BOLD}════════════════════════════════════════${NC}"
echo

[[ "$FAIL" -eq 0 ]]

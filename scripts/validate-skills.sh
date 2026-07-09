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
# Requires: node (checks 5, 7, 8), python3 (checks 0, 9, 10)
# Optional: ajv-cli (check 1) — install with: npm install -g ajv-cli ajv-formats

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
if command -v python3 &>/dev/null; then
  python3 -c "
import yaml, sys
try:
    with open('skills/index.yaml') as f:
        yaml.safe_load(f.read())
    print('  PASS: skills/index.yaml parses as valid YAML')
except yaml.YAMLError as e:
    print(f'  FAIL: skills/index.yaml YAML parse error: {e}', file=sys.stderr)
    sys.exit(1)
" && _ok "skills/index.yaml is valid YAML" || { _fail "skills/index.yaml has YAML parse errors — run: python3 -c \"import yaml; yaml.safe_load(open('skills/index.yaml'))\" to debug"; }
else
  _skip "python3 not found — fix: https://python.org"
fi

# ── 1. Pipeline JSON schema validation ────────────────────────────────────────
header "1/10 — Pipeline configs vs pipeline-schema.json"
if command -v ajv &>/dev/null; then
  for f in skills/pipelines/*.json; do
    [[ -f "$f" ]] || continue   # guard: skip if glob did not expand (empty dir)
    if ajv validate \
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
  _skip "ajv-cli not found — fix: npm install -g ajv-cli ajv-formats"
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
if command -v python3 &>/dev/null; then
  python3 - <<'PYEOF' && PASS=$((PASS+1)) || { FAIL=$((FAIL+1)); echo "         Fix: sync the version field in the failing SKILL.md frontmatter to match index.yaml"; }
import re, sys

with open("skills/index.yaml") as f:
    raw = f.read()

blocks = raw.split("\n- id:")
mismatches = []
passes = []

for block in blocks[1:]:
    skill_match   = re.search(r'executable_skill:\s*(.+)', block)
    version_match = re.search(r'(?m)^  version:\s*(.+)', block)
    if not skill_match or not version_match:
        continue
    skill_path = skill_match.group(1).strip()
    idx_ver    = version_match.group(1).strip()

    try:
        with open(skill_path) as sf:
            content = sf.read()
        m = re.search(r'^version:\s*(.+)$', content, re.MULTILINE)
        skill_ver = m.group(1).strip().strip('"\'') if m else "MISSING"
    except FileNotFoundError:
        skill_ver = "FILE_NOT_FOUND"

    if idx_ver != skill_ver:
        mismatches.append(
            f"  FAIL: {skill_path}  index.yaml={idx_ver}  SKILL.md={skill_ver}"
        )
    else:
        passes.append(skill_path)

for p in passes:
    print(f"  PASS: {p}")
for m in mismatches:
    print(m)

sys.exit(1 if mismatches else 0)
PYEOF
else
  _skip "python3 not found — fix: https://python.org"
fi

# ── 10. Community skill SHA-256 hash verification ─────────────────────────────
header "10/10 — Community skill SHA-256 hash verification"

python3 - <<'PYEOF'
import sys, hashlib, yaml
from pathlib import Path

root = Path(".")
index_path = root / "skills" / "index.yaml"

try:
    with open(index_path) as f:
        data = yaml.safe_load(f)
except Exception as e:
    print(f"  SKIP: Could not read skills/index.yaml: {e}")
    sys.exit(0)

skills = data.get("skills", []) if isinstance(data, dict) else data
community_skills = [s for s in skills if
    isinstance(s.get("origin_metadata"), dict) and
    s["origin_metadata"].get("source") == "community"]

if not community_skills:
    print("  PASS: No community skills installed")
    sys.exit(0)

fail_count = 0
for skill in community_skills:
    skill_id   = skill.get("id", "?")
    skill_name = skill.get("name", "?")
    skill_path = skill.get("executable_skill") or skill.get("reference_path", "")
    expected_sha = skill.get("origin_metadata", {}).get("sha256")

    if not expected_sha:
        print(f"  FAIL [{skill_id} {skill_name}]: origin_metadata.sha256 missing")
        fail_count += 1
        continue

    skill_file = root / skill_path
    if not skill_file.exists():
        print(f"  FAIL [{skill_id} {skill_name}]: SKILL.md not found at {skill_path}")
        fail_count += 1
        continue

    actual_sha = hashlib.sha256(skill_file.read_bytes()).hexdigest()
    if actual_sha == expected_sha:
        print(f"  PASS [{skill_id} {skill_name}]: SHA-256 verified")
    else:
        print(f"  FAIL [{skill_id} {skill_name}]: SHA-256 mismatch")
        print(f"    expected: {expected_sha}")
        print(f"    actual:   {actual_sha}")
        fail_count += 1

sys.exit(1 if fail_count > 0 else 0)
PYEOF

if [ $? -eq 0 ]; then
  _ok "Community skill SHA-256 verification"
else
  _fail "Community skill SHA-256 verification — see FAIL lines above"
fi

# ── Results ───────────────────────────────────────────────────────────────────
echo
echo -e "${BOLD}════════════════════════════════════════${NC}"
if [[ "$FAIL" -eq 0 ]]; then
  echo -e "  ${GREEN}${BOLD}All checks passed${NC} — $PASS passed, 0 failed"else
  echo -e "  ${RED}${BOLD}Validation failed${NC} — $PASS passed, $FAIL failed"
  echo
  echo "  Review the FAIL lines above. Each failure includes a Fix: hint."
  echo "  Run 'make validate' again once the issues are resolved."
fi
echo -e "${BOLD}════════════════════════════════════════${NC}"
echo

[[ "$FAIL" -eq 0 ]]

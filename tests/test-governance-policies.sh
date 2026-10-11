#!/usr/bin/env bash
# P1 governance policy tests — deterministic, no network.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PASS=0; FAIL=0
ok() { echo "  PASS: $1"; PASS=$((PASS+1)); }
bad() { echo "  FAIL: $1"; FAIL=$((FAIL+1)); }

# 1. all policy files parse as YAML
node -e "
const {loadPolicies} = require('$ROOT/scripts/policy-loader');
const {policies} = loadPolicies();
const need = ['validation-profile','development-policy','review-policy','risk-policy','budget-policy','merge-policy','rollback-policy','backlog-policy','control-plane','policy-versions'];
const missing = need.filter(k => !policies[k]);
if (missing.length) { console.error('missing: ' + missing.join(',')); process.exit(1); }
" && ok "policy discovery loads 10 policies" || bad "policy discovery"

# 2. governance path classification
node -e "
const {loadPolicies, isGovernancePath} = require('$ROOT/scripts/policy-loader');
const {policies} = loadPolicies();
if (!isGovernancePath('.github/workflows/agent-review.yml', policies)) process.exit(1);
if (!isGovernancePath('config/merge-policy.yml', policies)) process.exit(1);
if (isGovernancePath('scripts/checkpointer.js', policies)) process.exit(1);
if (isGovernancePath('docs/how-to-use.md', policies)) process.exit(1);
" && ok "governance path classification" || bad "governance classification"

# 3. budget numbers present and configurable
node -e "
const {loadPolicies} = require('$ROOT/scripts/policy-loader');
const b = loadPolicies().policies['budget-policy'].automation.budgets;
if (b.max_fix_cycles !== 3 || b.max_live_llm_calls_per_pr !== 10 || b.max_investigation_rounds !== 1 || b.max_retry_per_step !== 2) process.exit(1);
" && ok "budget policy values" || bad "budgets"

# 4. merge policy fail-closed + human hold + no admin bypass
node -e "
const {loadPolicies} = require('$ROOT/scripts/policy-loader');
const m = loadPolicies().policies['merge-policy'];
if (m.unknown_means !== 'NOT_SATISFIED' || m.admin_bypass !== 'forbidden') process.exit(1);
if (m.conditions.C11_no_human_hold !== 'human_hold_label_absent') process.exit(1);
if (!m.pre_merge_gates.includes('independent_approval') || !m.post_merge_gates.includes('smoke_tests')) process.exit(1);
" && ok "merge policy fail-closed" || bad "merge policy"

# 5. risk policy deterministic-first
node -e "
const {loadPolicies} = require('$ROOT/scripts/policy-loader');
const r = loadPolicies().policies['risk-policy'];
if (r.mode !== 'deterministic-rules') process.exit(1);
if (!r.path_rules.some(x => x.pattern === '.github/workflows/**' && x.level === 'GOVERNANCE')) process.exit(1);
" && ok "risk policy deterministic" || bad "risk policy"

# 6. Hosted workflows are removed; local validators remain the required gate.
if [[ ! -d "$ROOT/.github/workflows" ]] && [[ -f "$ROOT/scripts/validate-skills.sh" ]]; then
  ok "no hosted workflow dependency; local validator available"
else
  bad "GitHub-independent validation"
fi

# 7. No GitHub-bound skills or agents remain active in the local product catalog.
node -e "
const fs = require('fs');
const yaml = require('js-yaml');
const index = yaml.load(fs.readFileSync('$ROOT/skills/index.yaml', 'utf8')).skills;
const config = JSON.parse(fs.readFileSync('$ROOT/opencode.json', 'utf8'));
const retired = new Set(['github-pr-review', 'github-merge-gate', 'skill-registry-client']);
if (index.some(s => retired.has(String(s.executable_skill || '').split('/').slice(-2, -1)[0]))) process.exit(1);
if (['github-reviewer', 'merge-gatekeeper', 'issue-manager'].some(a => config.agent[a])) process.exit(1);
const exporter = fs.readFileSync('$ROOT/.agents/skills/work-item-exporter/SKILL.md', 'utf8');
if (/api\\.github\\.com|github_token_env|github_repo/.test(exporter)) process.exit(1);
const specAdapterPath = '$ROOT/.agents/skills/speckit-taskstoissues/SKILL.md';
if (fs.existsSync(specAdapterPath)) {
  const specAdapter = fs.readFileSync(specAdapterPath, 'utf8');
  if (/api\\.github\\.com|GitHub MCP|GITHUB_TOKEN|fetch existing issues/i.test(specAdapter)) process.exit(1);
}
const sync = fs.readFileSync('$ROOT/scripts/sync-website-data.sh', 'utf8');
if (/git clone|git push|PUSH_WEBSITE|WEBSITE_REPO/.test(sync)) process.exit(1);
const makefile = fs.readFileSync('$ROOT/Makefile', 'utf8');
if (/WEBSITE_ROOT=|ASE-OS-Website/.test(makefile)) process.exit(1);
" && ok "GitHub-bound skills, agents, and exporter API are retired" || bad "active GitHub product capability"

echo ""
echo "governance: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]

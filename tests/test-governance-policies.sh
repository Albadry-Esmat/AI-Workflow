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

# 6. PR template has tiered sections, no placeholder guidance
grep -q "## Workflow ID" "$ROOT/.github/pull_request_template.md" && ok "PR template tiers" || bad "PR template"
grep -q "validator rejects" "$ROOT/.github/pull_request_template.md" && ok "PR placeholder rejection note" || bad "PR note"

# 7. skill version consistency (github-pr-review 1.2.0)
node -e "
const fs = require('fs');
const md = fs.readFileSync('$ROOT/.opencode/skills/github-pr-review/SKILL.md', 'utf8');
if (!md.includes('version: 1.2.0') || !md.includes('fingerprint v2')) process.exit(1);
" && ok "skill 1.2.0 + fingerprint v2" || bad "skill version"

echo ""
echo "governance: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]

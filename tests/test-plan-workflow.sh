#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

before="$(git status --porcelain)"
json_output="$(node scripts/plan-workflow.js "review the release" --pipeline requirements-only --json)"

node - "$json_output" <<'NODE'
const manifest = JSON.parse(process.argv[2]);
if (manifest.dry_run !== true) throw new Error('planner must always emit dry_run=true');
if (manifest.pipeline.name !== 'requirements-only') throw new Error('wrong pipeline in manifest');
if (manifest.request !== 'review the release') throw new Error('request was not preserved');
if (manifest.summary.phase_count !== 1 || manifest.summary.step_count !== 1) throw new Error('unexpected phase/step summary');
if (manifest.summary.gate_count !== 1) throw new Error('requirements-only gate was not included');
if (manifest.policies.writes !== 'none') throw new Error('planner writes policy is not none');
if (manifest.policies.network_calls !== 'none') throw new Error('planner network policy is not none');
const step = manifest.phases[0].skills[0];
if (step.name !== 'requirement-analyzer') throw new Error('skill step missing');
if (!step.owner_agents.some((agent) => agent.name === 'analyzer')) throw new Error('agent ownership missing');
if (step.side_effect_policy.filesystem !== 'undeclared') throw new Error('side-effect policy must be reported as undeclared');
NODE

after="$(git status --porcelain)"
if [[ "$before" != "$after" ]]; then
  echo 'FAIL: planner changed the worktree' >&2
  git status --short >&2
  exit 1
fi

human_output="$(node scripts/plan-workflow.js --pipeline requirements-only)"
grep -q 'AI-Workflow execution plan (dry run)' <<<"$human_output"
grep -q 'No files, session state, network calls, secrets, pull requests, or deployments were touched.' <<<"$human_output"

if node scripts/plan-workflow.js --pipeline does-not-exist >/tmp/aiw-plan-invalid.out 2>&1; then
  echo 'FAIL: unknown pipeline unexpectedly succeeded' >&2
  exit 1
fi
grep -q 'pipeline not found: does-not-exist' /tmp/aiw-plan-invalid.out
rm -f /tmp/aiw-plan-invalid.out

echo 'PASS: workflow planner emits a deterministic, side-effect-free execution manifest'

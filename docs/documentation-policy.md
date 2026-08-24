# Documentation Policy — Complete Change Synchronization

**Version:** 1.0.0
**Last updated:** 2026-08-25
**Audience:** All contributors, reviewers, operators, and AI agents modifying this repository

## Rule

Every implementation, configuration, schema, pipeline, adapter, security, test, operational, website, or workflow change must update **all affected documentation** and `docs/changelog.md` in the same change. Generated website data must be synchronized and committed with its authoritative source.

This is an enforced repository rule, not a best-effort convention. A change is incomplete when code or configuration is correct but the documentation, operational guidance, support tier, security boundary, or release procedure is stale.

## What counts as affected documentation

The path-aware policy is stored in [`scripts/documentation-policy.json`](../scripts/documentation-policy.json). Its current minimum mapping is:

| Changed area | Required documentation |
|---|---|
| Skills and skill metadata | `docs/skills-registry.md`, `docs/how-to-use.md` |
| Agents and orchestration | `docs/agents.md`, `docs/workflows.md` |
| Pipelines and OpenCode configuration | `docs/workflows.md`, `docs/architecture.md` |
| Runtime adapters and `.ai-workflow/` contracts | `docs/operations/multi-runtime-compatibility.md`, `docs/development-runtime-adapter-guide.md` |
| CLI, scripts, package, and execution controls | `docs/operations/production-runbook.md`, `docs/operations/operator-quickstart.md`, `docs/operations/troubleshooting.md` |
| Security, MCP, compatibility, and CI policy | `docs/security.md`, `docs/governance.md`, `docs/operations/production-runbook.md` |
| Tests and fixtures | `docs/testing.md` |
| Website source, mirror tooling, or manifest | `docs/README.md`, `docs/operations/production-runbook.md` |

The mapping is a minimum. Reviewers must add any domain guide that explains the changed behavior, even when the automated path rule does not list it.

## Required workflow

`./aiw setup` installs a managed `.git/hooks/pre-commit` hook when no custom hook exists. The hook runs the documentation policy, website synchronization guard, and structural skill validation before each local commit. CI remains authoritative because local hooks can be removed or replaced.

Before committing an authoritative change:

```bash
# 1. Implement the change.
# 2. Update every affected guide and docs/changelog.md.
node scripts/verify-documentation-policy.js

# 3. Regenerate and verify the website mirror.
./aiw sync
./aiw website-check
./aiw sync --check

# 4. Run the relevant tests and release checks.
npm test -- --runInBand
./aiw self-test
./aiw validate
```

Review the complete diff with `git diff --check` and confirm source and generated website files are committed together. Do not use a generated mirror as the authoritative source.

## Pull requests and CI

CI compares the pull request or push range against its base commit. It fails when a changed mapped area lacks one of its required guides or when `docs/changelog.md` is absent. The same validator can be run locally without arguments; it considers staged, unstaged, and untracked non-ignored files.

A documentation-only change still requires the changelog. A changelog-only change is appropriate only when the change itself is documentation metadata or release-note correction. Generated files under `website/data/` do not replace the authoritative documentation requirement.

## Review responsibilities

The author must explain user-visible, operator-visible, security-sensitive, support-tier, and recovery-impacting changes in the affected guides. The reviewer must verify that commands, paths, capability claims, support tiers, evidence labels, and release gates match the implementation. If no documentation is affected, the pull request description must explicitly justify why; the changelog remains required for implementation changes.

## AI agent instructions

AI agents must read the relevant documentation before changing code, preserve local-first and least-privilege boundaries, avoid inventing live runtime evidence, update affected documentation and the changelog, synchronize the website mirror, and run the policy validator before presenting a commit as complete.

## Exceptions

There are no silent exceptions. A generated-only change, dependency lock refresh, formatting-only change, or repository maintenance change must still pass the policy validator. A genuine exception requires an explicit reviewer-recorded rationale in the pull request and a changelog entry; it must not be implemented by weakening or bypassing the validator.

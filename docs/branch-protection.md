# Branch Protection (required settings)

> These settings live in GitHub (Settings → Branches), not in code. This file
> is their version-controlled specification — drift between this document and
> the repository settings is a governance finding.

## `Dev` branch (integration)

- Require a pull request before merging: **yes**
- Required approvals: **1** (must be `@Albadry-Esmat` per `.github/CODEOWNERS`;
  bot and author approvals do not satisfy this)
- Dismiss stale pull request approvals on push: **yes** (the merge gate's
  `STALE_APPROVAL` hold depends on this)
- Require status checks to pass:
  - `Skill Validation` (`.github/workflows/validate-skills.yml`)
  - `Require governance approval (blocking check)` (`.github/workflows/governance-gate.yml`)
  - `Deterministic review gate (no LLM, no model cost)` (`.github/workflows/agent-review.yml`)
- Require branches to be up to date: **yes**
- Allow force pushes: **no**
- Allow deletions: **no**

## `main` branch (release)

All `Dev` rules, plus:

- Required approvals: **1 human** (`@Albadry-Esmat`); the `merge-gatekeeper`
  bot never merges to `main` — merges to `main` are human-executed releases.
- Restrict who can push: ** repository owner only**.

## Governance changes (any branch)

A PR touching control-plane paths (`config/control-plane.yml`
`protected_paths`, resolved by `scripts/policy-loader.js`) additionally requires
the `governance-approved` label, applied by a human with write access. The
`require-approval` job fails without it, which blocks merge while the check is
required above. Labels applied by `GITHUB_TOKEN` automation do not count: no
workflow in this repository applies `governance-approved` itself.

## What this does NOT cover

GitHub cannot express "bot may merge only on unanimous green" as branch
policy. That rule lives in `.opencode/skills/github-merge-gate/SKILL.md` and
is enforced by the merge-gatekeeper agent reading live state. The standing
delegation for bot merges is scoped exactly to: squash merge, unanimous green
(C1–C5 on the current head SHA), never `--admin`, never to `main`.
A human may countermand any hold or merge at any time.

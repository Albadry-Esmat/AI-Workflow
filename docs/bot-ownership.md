# Bot Ownership — Autonomous Review to Merge

## Why a bot identity exists
GitHub rejects self-approvals: an agent acting as the PR author can review, comment,
and label — but can never approve. A separate bot identity (non-author collaborator
with write access) provides the one approving review branch policy requires.

## Setup (human, one time)
1. Create a machine user (e.g. `ai-workflow-bot`), add as collaborator with **write** access.
2. As the machine user: Settings → Developer settings → Personal access tokens → fine-grained token:
   - Repository access: only this repo. Permissions: **Contents: read**, **Pull requests: read+write**,
     **Issues: read+write**. No admin, no workflows, no secrets. 90-day expiry + rotation reminder.
3. Add repo secret `REVIEWER_BOT_TOKEN` with the token value. Never commit it; never log it.
4. Verify: `gh pr review <n> --approve` with the token on a test PR posts as the bot, and
   branch policy counts it (non-author + write access).

## Ownership model
| Actor | Owns | Never |
|---|---|---|
| `github-reviewer` | diff review, score, request-changes, bug issues, labels, bot approval (approve verdicts only) | merge, push, self-approve |
| `merge-gatekeeper` | merge on unanimous green, hold + reason otherwise, audit log | `--admin`, closing PRs, approving |
| Human | bot secret, policy changes, countermand any decision | — |

## Unanimous-green definition (all required)
C1 approve verdict · C2 required checks green on head SHA · C3 fresh bot approval on head SHA ·
C4 zero unresolved criticals · C5 zero open blocking bugs. A push re-runs everything (stale
approvals are dismissed by policy).

## Audit report
Every gate decision appends `{ pr, head_sha, decision, reason, checks, timestamp }` to the
run log and posts a hold/merge comment on the PR. The monthly summary lists merges, holds
with reasons, bugs filed, and overrides. Human override is always available and always wins.

## Credential lifecycle (P1.8)
| Field | Value |
|---|---|
| Credential owner | repository maintainer (human) |
| GitHub App ID | TBD — register app, record ID here |
| Installation scope | this repository only |
| Permissions | Contents: read · Pull requests: read+write · Issues: read+write · no admin, no workflows, no secrets |
| Secret location | repo secret `REVIEWER_BOT_TOKEN` (CI) / ignored `.env` (local); never committed, never logged |
| Creation | maintainer creates installation token per run (short-lived, auto-expiring) |
| Rotation/expiry | 90-day review; rotate on maintainer change or suspected exposure |
| Revocation | delete secret or uninstall app → gate holds with `no-bot-identity` (instant human-only mode) |
| Emergency disablement | add `human-hold` label to any PR, or revoke — both take effect immediately |
| Audit | every token use appears in gate decisions; quarterly access review |
| Compromise response | revoke → rotate → audit prior 30 days of gate decisions → report |

Prefer GitHub App installation tokens over long-lived PATs.

## Revocation
Delete `REVIEWER_BOT_TOKEN` (or uninstall the app) to instantly return to human-only merges.
The gate then holds everything with reason `no-bot-identity`.

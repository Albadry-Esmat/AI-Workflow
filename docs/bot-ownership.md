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

## Revocation
Delete `REVIEWER_BOT_TOKEN` (or the machine user) to instantly return to human-only merges.
The gate then holds everything with reason `no-bot-identity`.

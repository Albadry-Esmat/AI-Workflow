---
name: github-merge-gate
version: 1.0.0
domain: review
description: >
  Use when deciding whether a GitHub pull request may merge: verify review verdict,
  required CI checks, bot approval freshness, and unresolved criticals, then merge
  or hold with a reason. Triggers on: "merge gate", "can this merge", "merge this PR",
  "gate check". Merges only on unanimous green — never on red, never with --admin.
author: system
---

# GitHub Merge Gate

**Type:** Deterministic gate skill (policy evaluation; merge is the single write)  
**Phase:** After `github-pr-review` verdict + CI completion  
**Prerequisite:** `review_report.verdict`, CI check states, bot approval state for the head SHA

---

## Purpose

Decide merge vs hold for a pull request. Merge if and only if every condition holds:
verdict is `approve`, all required checks are green on the current head SHA, a bot
approval exists on the current head SHA (stale approvals are dismissed by branch
policy on push), and no unresolved critical findings or open `bug` issues block the
PR. Otherwise hold with a machine-readable reason. Every decision is audit-logged.

---

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `pr_number` | integer | Yes | Pull request number |
| `repo` | string | Yes | `owner/repo` slug |
| `verdict` | string | Yes | `approve`, `request-changes`, or `comment` from github-pr-review |
| `session_id` | string | Yes | UUID v4 |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "pr_number": { "type": "integer", "minimum": 1 },
    "repo": { "type": "string", "pattern": "^[^/]+/[^/]+$" },
    "verdict": { "type": "string", "enum": ["approve", "request-changes", "comment"] },
    "session_id": { "type": "string" }
  },
  "required": ["pr_number", "repo", "verdict", "session_id"]
}
```

---

## Algorithm

```
Step 1 — Read live state (read-only)
  Fetch: head SHA, required check states, reviews on head SHA, open linked bug issues.
  IF any fetch fails: decision=hold, reason=STATE_UNREADABLE.

Step 2 — Evaluate merge conditions (ALL must hold)
  C1: verdict == "approve"
  C2: every required check == success on head SHA
  C3: bot approval exists on head SHA (not dismissed by later push)
  C4: zero unresolved critical findings
  C5: zero open blocking bug issues linked to this PR
  IF any fails: decision=hold, reason=first failing condition + remediation.

Step 3 — Merge or hold
  IF all hold: merge with method "squash" (repo default), delete branch.
  ELSE: post hold comment with reason + remediation, apply label as needed
    (e.g. "needs-triage" when blocked on scope, never remove human labels).

Step 4 — Audit
  Append { pr, head_sha, decision, reason, checks, timestamp } to the gate audit log.
```

---

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `decision` | string | `merge` or `hold` |
| `reason` | string | Failing condition + remediation, or `all-green` |
| `merge_commit` | string \| null | Merge SHA when decision is merge |

---

## Rules

- **Unanimous green or hold.** One red check, one missing approval, one critical — hold. No exceptions, no `--admin` bypass. Ever.
- **Head-SHA binding.** Approvals and checks are evaluated against the current head SHA only. A push invalidates prior green state (re-evaluate from Step 1).
- **Squash merges.** Match repo convention; delete the branch after merge.
- **Never close human PRs.** Hold comments explain; closing is human-only.
- **Never approve.** Approval belongs to github-pr-review under the bot identity. The gate only reads approvals.

---

## Error Codes

| Code | Meaning |
|------|---------|
| `STATE_UNREADABLE` | GitHub state fetch failed — hold, do not merge blind |
| `CHECKS_PENDING` | Required checks still running — hold, re-evaluate on completion |
| `STALE_APPROVAL` | Head SHA moved after approval — hold, request fresh review |
| `MERGE_FAILED` | Merge call failed — hold, report error, never retry blindly |

## Required Context

- Live PR state (head SHA, checks, reviews) for one pull request.
- Review verdict from github-pr-review for the same head SHA.
- Bot identity credentials from environment (never code) for the merge call.

## Execution Logic

Read live state, evaluate C1–C5 in order, merge on unanimous green or post a hold
comment with the first failing condition and its remediation, then audit-log the decision.

## Security

Merge credentials come exclusively from environment secrets. Never log tokens. Never
merge with admin bypass. Never evaluate against a cached head SHA — always re-read.

## Token Optimization

Fetch check/review state as summaries (state + SHA), not full logs, unless a failure
needs diagnosis for the hold comment.

## Quality Check

Verify PR identity, head-SHA freshness, each condition against live (not cached) state,
merge method, branch deletion, and audit-log write before returning.

## Failure Handling

Any error returns hold with a structured reason. A failed merge is never retried without
re-reading state. Partial publishes (comment posted, merge failed) are reconciled and
reported explicitly.

## Human-in-the-Loop

The merge call is a state-writing operation performed only under the standing delegation
for unanimous-green merges; any hold is reported to humans with remediation. Policy
changes (required checks, approval count, merge method) are human-only. A human may
countermand any hold or merge at any time.

## Skill Composition

Consumes review_report from github-pr-review (SKL-126) and live GitHub state; produces
a gate decision for the merge-gatekeeper agent and the audit log. Triggered on CI
completion or on demand.

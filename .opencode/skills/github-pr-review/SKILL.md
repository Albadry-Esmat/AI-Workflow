---
name: github-pr-review
version: 1.1.0
domain: review
description: >
  Use when reviewing a GitHub pull request end-to-end: fetch the diff, run code-quality
  and security analysis on changed files, score the PR, post findings as a PR review,
  and apply triage labels. Triggers on: "review this PR", "github review", "PR review",
  "review pull request", "automate PR review". Composes clean-code-review and
  security-review — never duplicates them. Advisory only: never merges, never pushes fixes.
author: system
---

# GitHub PR Review

**Type:** Agentic review orchestration skill (LLM call)  
**Phase:** On-demand (PR opened / synchronized) or `quick-review` pipeline extension  
**Prerequisite:** GitHub MCP server available; `GITHUB_TOKEN` set in environment (never in code)

---

## Purpose

Review a GitHub pull request end-to-end. Fetch the PR diff via the GitHub MCP server,
run `clean-code-review` and `security-review` over changed files only, compute the
standard 10-point review score, post line-anchored findings as a PR review, apply
triage labels (`bug` when defects found, `needs-triage` when scope is unclear), and
emit a merge-gate summary comment. The verdict is advisory — a human merges.

---

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `pr_number` | integer | Yes | Pull request number |
| `repo` | string | Yes | `owner/repo` slug |
| `strictness` | string | No | `"low"`, `"medium"`, `"high"` (default: `"medium"`) |
| `session_id` | string | Yes | UUID v4 |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "pr_number": { "type": "integer", "minimum": 1 },
    "repo": { "type": "string", "pattern": "^[^/]+/[^/]+$" },
    "strictness": { "type": "string", "enum": ["low", "medium", "high"], "default": "medium" },
    "session_id": { "type": "string" }
  },
  "required": ["pr_number", "repo", "session_id"]
}
```

---

## Algorithm

```
Step 1 — Fetch PR context (read-only MCP calls)
  Get PR metadata (title, base, head, author), file list, and unified diff.
  Get CI check status for the head SHA.
  IF MCP unavailable: return error GITHUB_MCP_UNAVAILABLE (fail-closed, no review claimed).

Step 2 — Scope to changed files
  changed_files = diff files excluding deleted-only and lockfile-only churn.
  IF changed_files empty: post "no reviewable changes" comment, verdict=comment, score=10.

Step 3 — Parallel analysis (composition, not duplication)
  Invoke clean-code-review per changed source file (language inferred from extension).
  Invoke security-review once over the full diff.
  Collect issues[] with { severity, file, line, rule, recommendation }.

Step 4 — Score (reviewer formula)
  score = 10 − (critical×1.5 + high×0.8 + medium×0.3 + low×0.1), floor at 1.

Step 5 — Verdict mapping
  critical > 0 → "request-changes"
  high > 0 → "request-changes" (strictness high) else "comment"
  else → "approve" (strictness low/medium, no critical/high) else "comment"

Step 6 — Publish (write MCP calls — HITL policy applies)
  Post PR review with verdict + line-anchored findings (no exploit paths, no secrets).
  IF verdict is "request-changes": use request-changes review type so the
    author is formally blocked pending fixes.
  IF critical/high defects: apply label "bug".
  IF scope unclear (empty description, >20 files, mixed concerns): apply label "needs-triage".
  Post merge-gate summary comment: score, verdict, check status, top 3 findings.

Step 7 — File bugs (v1.1.0)
  FOR EACH critical or unresolved-high finding:
    Open ONE GitHub issue with label "bug" containing: finding summary,
    file:line, PR link, trace/session refs, and a reproduction sketch.
    Deduplicate: skip if an open "bug" issue already references the same
    file:line + rule. Link each issue back to the PR.
  Record issue URLs in review_report.bug_issues[].

Step 8 — Bot approval (v1.1.0, requires REVIEWER_BOT_TOKEN identity)
  IF verdict == "approve" AND all required checks green AND no unresolved criticals:
    Post an approving review AS THE BOT IDENTITY (never as the PR author —
    self-approvals are rejected by GitHub and must never be attempted).
  ELSE: do not approve. If verdict == "request-changes", the blocking review
    from Step 6 already holds the PR.
```

---

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `review_report` | object | `{ pr, score, verdict, issues[], checks }` |
| `labels_applied` | array[string] | Labels added to the PR |
| `review_url` | string | URL of the posted PR review |
| `bug_issues` | array[string] | URLs of filed bug issues (v1.1.0) |
| `bot_approval_posted` | boolean | Whether the bot identity approved (v1.1.0) |

---

## Rules

- **Composition only.** Quality findings come from `clean-code-review`; security findings from `security-review`. This skill adds PR scoping, scoring, and publishing — never its own analyzers.
- **Advisory verdicts.** `approve` means "no blocking findings", never "safe to merge". Merge authority stays human.
- **Changed-files scope.** Never review or comment on files outside the PR diff.
- **Score formula fixed.** 10 − (critical×1.5 + high×0.8 + medium×0.3 + low×0.1), floor 1 — identical to reviewer.
- **No code pushes.** Fix suggestions go in review comments; never commit to the PR branch.
- **Never self-approve.** Approvals are posted only under the bot identity on PRs authored by someone else. Attempting author self-approval is a violation.
- **One issue per finding.** Bug filing deduplicates on open issues (file:line + rule) before creating.

---

## Error Codes

| Code | Meaning |
|------|---------|
| `GITHUB_MCP_UNAVAILABLE` | GitHub MCP server unreachable — no review claimed |
| `PR_NOT_FOUND` | PR number does not exist in repo |
| `DIFF_TOO_LARGE` | Diff exceeds 500 files — request human split, post scoping comment only |
| `PUBLISH_FAILED` | Review post or label call failed — report, do not retry writes blindly |

## Required Context

- GitHub MCP server reachable with `GITHUB_TOKEN` from environment.
- PR metadata, diff, and CI status describe one pull request.
- `clean-code-review` and `security-review` skills available for composition.

## Execution Logic

Fetch PR context read-only, scope to changed files, run composed analyzers in parallel,
score with the reviewer formula, map to a verdict, then publish review + labels + summary.
Any failed fetch aborts before publishing; any failed publish is reported, not retried blindly.

## Security

Never place tokens, secrets, or exploit paths in reviews, comments, or labels. MCP writes
require the same HITL approval as any state-writing operation. Never describe exact exploit
paths in vulnerability output. Never scan for generic secrets (separate concern).

## Token Optimization

Fetch diffs per file (not whole repo); pass finding IDs and hashes downstream rather than
re-embedding full file contents; cap posted review at top 20 findings with overflow note.

## Quality Check

Verify PR identity (repo + number + head SHA), changed-file scoping, score arithmetic,
verdict mapping, label rules, and that no secret or exploit-path text leaves the boundary.

## Failure Handling

Return the documented structured error without posting partial reviews. A failed publish
must not be retried with duplicated comments — reconcile posted state first via MCP read.

## Human-in-the-Loop

Publishing a review, applying labels, and posting the merge-gate summary are state-writing
operations requiring HITL approval per MCP governance. Merge authority is human-only and
non-bypassable. Trial runs require explicit approval before posting to any real PR.

## Skill Composition

Consumes PR context via GitHub MCP; composes clean-code-review (SKL-004) and security-review
(SKL-006); produces review_report for the reviewer agent, defect-manager intake, and merge-gate
summaries. Invoked by the github-reviewer agent on PR opened/synchronized or on demand.

# GitHub Issues Export

The `work-item-exporter` skill supports exporting work items directly to GitHub Issues
via the GitHub REST API (v3). This guide covers authentication setup, usage, rate-limit
behaviour, and troubleshooting.

## Prerequisites

- A GitHub repository where you have write access
- A GitHub Personal Access Token (PAT) with **`repo` scope** (or `public_repo` for public repositories)
- The `GITHUB_TOKEN` environment variable set in your shell or CI environment

## Setting Up GITHUB_TOKEN

### 1. Generate a Personal Access Token

1. Go to [github.com/settings/tokens](https://github.com/settings/tokens)
2. Click **Generate new token (classic)** ← use classic, NOT fine-grained
3. Select scopes: ✅ `repo` (Full control of private repositories)
4. Expiration: **No expiration** ← avoids repeated rotation; this is a local dev tool
5. Click **Generate token** and copy the token immediately

### 2. Set the Environment Variable

**Local development:**
```bash
export GITHUB_TOKEN="ghp_yourTokenHere"
```

Add to your shell profile (`.zshrc` / `.bashrc`) to persist across sessions.

**CI/CD (GitHub Actions):**
```yaml
env:
  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```
GitHub Actions automatically provides `GITHUB_TOKEN` — no manual secret needed.

**CI/CD (other platforms):**
Store the token as a masked secret in your CI platform and inject it as an environment variable.

> ⚠️ **Never commit your token to source control.** The skill reads the token from the environment
> variable at runtime — the token value is never stored in any skill input, state file, log, or export artifact.

## Usage

Add `"github"` to the `export_formats` list and provide `github_repo` and `github_token_env`:

```json
{
  "mode": "export",
  "export_formats": ["github", "markdown"],
  "github_repo": "myorg/myrepo",
  "github_token_env": "GITHUB_TOKEN",
  "github_milestone": "Sprint 1"
}
```

### Dry Run (Preview Without Creating Issues)

Set `dry_run: true` to preview the API payloads without making any network calls:

```json
{
  "mode": "export",
  "export_formats": ["github"],
  "github_repo": "myorg/myrepo",
  "github_token_env": "GITHUB_TOKEN",
  "dry_run": true
}
```

The preview is written to `artifacts/github-export-dryrun-<timestamp>.json`.

## Issue Mapping

Each work item is mapped to a GitHub issue as follows:

| Work Item Field | GitHub Issue Field |
|-----------------|-------------------|
| `id` + `title` | `title` (prefixed: `[TASK-0001] My Task`) |
| `description` + `acceptance_criteria` | `body` (Markdown formatted) |
| `work_item_type`, `priority` | `labels` (e.g. `task`, `priority-high`) |
| `jira_labels[]` | `labels` (appended) |
| `github_milestone` input | `milestone` (auto-created if absent) |

## Milestones

If `github_milestone` is provided, the skill:
1. Queries existing milestones for a title match
2. Creates the milestone if not found
3. Assigns all exported issues to the milestone

## Cross-Linking

After all issues are created, the skill patches each issue's body to add a
**Related GitHub Issues** section using `#{number}` references for any `linked_items[]`
that were also exported in the same run.

## Rate Limits

The GitHub REST API allows **5,000 requests per hour** for authenticated users.

The skill respects rate limits automatically:
- After each request, it checks the `X-RateLimit-Remaining` header
- If a **429 Too Many Requests** response is received, it waits until `X-RateLimit-Reset`
  (max 60 seconds) and retries once
- On persistent failures (HTTP 503), it retries with exponential backoff (2s, 4s, 8s)

For large exports (> 500 issues), consider batching with the `filter` input to avoid
hitting the hourly limit.

## Export Manifest

Every GitHub export run writes a manifest to:

```
artifacts/github-export-<timestamp>.json
```

Example:
```json
{
  "export_id": "2026-07-09_abc12345",
  "exported_at": "2026-07-09T14:32:00Z",
  "github_repo": "myorg/myrepo",
  "issues": [
    { "item_id": "TASK-0001", "issue_number": 42, "issue_url": "https://github.com/myorg/myrepo/issues/42" },
    { "item_id": "BUG-0003",  "issue_number": 43, "issue_url": "https://github.com/myorg/myrepo/issues/43" }
  ]
}
```

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `warning: GITHUB_TOKEN env var not set` | Token not exported in shell | Run `export GITHUB_TOKEN="ghp_..."` |
| `HTTP 401 Unauthorized` | Token expired or wrong scope | Regenerate token with `repo` scope |
| `HTTP 403 Forbidden` | Token lacks `repo` write access | Ensure `repo` scope is selected when generating token |
| `HTTP 422 Unprocessable Entity` | Invalid field (e.g. bad label format) | Check `jira_labels[]` for special characters; the skill sanitises labels automatically |
| Issues created without milestone | Milestone creation failed silently | Check `github_repo` write permissions; verify milestone title has no leading/trailing spaces |

## Security

- The GitHub PAT is read from the environment variable **at runtime only**
- The token value is never stored in skill inputs, state, logs, feedback entries, or export files
- Security-tagged work items (items with `jira_labels: ["security"]`) trigger a `warning` feedback entry advising review before the export is shared externally
- If your repository is public, ensure exported issue bodies do not contain sensitive internal details before running the export

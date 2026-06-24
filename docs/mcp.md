# MCP Server Integration

**Version:** 1.0.0 | **Last updated:** 2026-06-24

## Overview

ASE-OS integrates eight Model Context Protocol (MCP) servers that extend every agent in the pipeline with live external capabilities — GitHub, web search, persistent memory, documentation lookup, browser automation, and more. MCPs are configured in `opencode.json` under the `mcp` key and are available to all agents regardless of their `bash: deny` permission.

## Enabled Servers

| Key | Package | Status | Auth |
|-----|---------|--------|------|
| `github` | `@modelcontextprotocol/server-github` | ✅ enabled | `GITHUB_TOKEN` |
| `brave-search` | `@modelcontextprotocol/server-brave-search` | ✅ enabled | `BRAVE_API_KEY` |
| `memory` | `@modelcontextprotocol/server-memory` | ✅ enabled | none |
| `fetch` | `@modelcontextprotocol/server-fetch` | ✅ enabled | none |
| `context7` | `@upstash/context7-mcp` | ✅ enabled | `CONTEXT7_API_KEY` |
| `playwright` | `@playwright/mcp` | ✅ enabled | none |
| `slack` | `@modelcontextprotocol/server-slack` | ⏸ disabled | `SLACK_BOT_TOKEN`, `SLACK_TEAM_ID` |
| `vercel` | `vercel-mcp` | ⏸ disabled | `VERCEL_TOKEN` |

Disabled servers are pre-configured — set `"enabled": true` in `opencode.json` and fill in their `.env` credentials to activate.

---

## Server Reference

### `github` — GitHub MCP
**Package:** [`@modelcontextprotocol/server-github`](https://github.com/modelcontextprotocol/servers/tree/main/src/github)

**Auth:** Add `GITHUB_TOKEN` to `.env`. Required scopes: `repo`, `read:org`, `issues:write`.

**Tools exposed:**
- `create_issue`, `update_issue`, `list_issues` — bridges the `work-item-exporter`, `defect-manager`, and `change-request-manager` skills to real GitHub Issues
- `get_pull_request`, `list_pull_request_files` — feeds `change-impact-analyzer` with real PR diffs
- `list_workflow_runs`, `get_workflow_run` — lets the `deployer` agent check CI status without `bash` access
- `create_pull_request`, `merge_pull_request` — automatable via the `builder` agent under HITL approval

**Agents that benefit most:**
- `builder` → `work-item-exporter` writes GitHub Issues directly
- `analyzer` → `defect-manager` creates bug reports as Issues
- `deployer` → reads GitHub Actions workflow run status during pre-deploy gate
- `reviewer` → `implementation-completeness-guard` checks linked PR status

---

### `brave-search` — Brave Search MCP
**Package:** [`@modelcontextprotocol/server-brave-search`](https://github.com/modelcontextprotocol/servers/tree/main/src/brave-search)

**Auth:** Get a free API key (2,000 queries/month) at [brave.com/search/api](https://brave.com/search/api/). Add `BRAVE_API_KEY` to `.env`.

**Tools exposed:**
- `brave_web_search` — live web search with structured results

**Agents that benefit most:**
- `security-specialist` → `threat-model-designer` and `security-review` query live CVE/NVD databases and OWASP advisories
- `impact-analyzer` → `dependency-analyzer` searches for published security advisories on package versions
- `sre` → `chaos-engineering-designer` searches for known failure modes of infrastructure components
- `architect` → researches real-world architecture precedents before recommending a tech stack

---

### `memory` — Persistent Knowledge Graph
**Package:** [`@modelcontextprotocol/server-memory`](https://github.com/modelcontextprotocol/servers/tree/main/src/memory)

**Auth:** None. State is stored in a local file in the MCP server's working directory.

**Tools exposed:**
- `create_entities`, `create_relations` — store structured artifacts (requirements, decisions, test strategies)
- `search_nodes`, `open_nodes` — retrieve prior context across sessions
- `add_observations` — append new facts to existing entities

**Agents that benefit most:**
- All agents — persists requirements, architecture decisions, and HITL gate approvals across sessions so multi-day pipelines resume without re-analysis
- `architect` — stores ADR decisions so future architecture reviews reference them automatically
- `tester` — persists `testing_strategy` output across builder and test-generator pipeline stages
- `recovery` — stores rollback checkpoints as named memory entities for cross-session recovery

**Governance note:** This MCP stores only structured agent artifacts (JSON key-value entities), never raw user content, source code, or PII — consistent with Layer 5 PII protection rules in `docs/governance.md`.

---

### `fetch` — Web Fetch for Subagents
**Package:** [`@modelcontextprotocol/server-fetch`](https://github.com/modelcontextprotocol/servers/tree/main/src/fetch)

**Auth:** None.

**Tools exposed:**
- `fetch` — retrieve any public URL as markdown, HTML, or raw text

**Agents that benefit most:**
- `api-designer` → `api-design-architect` fetches the target API's current OpenAPI spec for comparison
- `reviewer` → `security-review` fetches NIST 800-53 controls and OWASP cheat sheets
- `builder` → `seo-optimizer` fetches current Core Web Vitals thresholds from web.dev
- `documenter` → `documentation-generator` fetches upstream changelogs for ADR context
- `sre` → `runbook-generator` fetches cloud provider status pages as context

**Note:** This gives subagents the same `webfetch` capability the primary agent already has. Subagents with `bash: deny` cannot use shell curl — `fetch` fills this gap.

---

### `context7` — Up-to-Date Library Documentation
**Package:** [`@upstash/context7-mcp`](https://github.com/upstash/context7) (58k ⭐)

**Auth:** Get a free API key at [context7.com/dashboard](https://context7.com/dashboard). Add `CONTEXT7_API_KEY` to `.env`. Works without a key at reduced rate limits.

**Tools exposed:**
- `resolve-library-id` — maps a library name to a Context7 ID (e.g. `next.js` → `/vercel/next.js`)
- `query-docs` — retrieves version-specific documentation and code examples for any library

**Agents that benefit most:**
- `builder` → `code-generator` looks up the exact API of the framework version in use before generating code — prevents hallucinated APIs
- `api-designer` → `api-design-architect` references current OpenAPI Spec, gRPC, and AsyncAPI docs
- `tester` → `test-generator` looks up the correct fast-check / hypothesis / Pact API for the project's library version
- `reviewer` → `clean-code-review` verifies whether a deprecated API is flagged in current docs

**Usage pattern:**
```
use context7 when generating code for <library>
use library /vercel/next.js for Next.js 15 docs
```

---

### `playwright` — Browser Automation & E2E Testing
**Package:** [`@playwright/mcp`](https://github.com/microsoft/playwright-mcp) (34k ⭐ by Microsoft)

**Auth:** None. Runs a headless Chromium browser locally.

**Configuration (in `opencode.json`):**
```json
"playwright": {
  "type": "local",
  "command": ["npx", "@playwright/mcp@latest", "--headless", "--isolated", "--browser", "chromium"],
  "enabled": true
}
```

- `--headless` — no display required; works in CI
- `--isolated` — each session starts a clean browser profile (no state bleed between test runs)
- `--browser chromium` — consistent browser for deterministic test results

**Tools exposed (selection):**
- `browser_navigate` — navigate to any URL
- `browser_snapshot` — get the full accessibility tree of the current page (structured, no screenshots)
- `browser_click`, `browser_fill_form`, `browser_press_key` — interact with UI elements
- `browser_evaluate` — run JavaScript in the browser context
- `browser_network_requests` — inspect HTTP requests made by the page
- `browser_console_messages` — read browser console errors and warnings

**Agents that benefit most:**
- `tester` → `test-generator` executes the Playwright e2e tests it generates to verify they pass before writing to state
- `builder` → `seo-optimizer` navigates to a Vercel preview URL and verifies meta tags, Open Graph, and structured data are rendered in the actual DOM
- `reviewer` → `ui-ux-compliance-guard` navigates to rendered components and verifies accessibility (ARIA roles, contrast, focus order) in the real browser — not just static analysis
- `sre` → `load-test-designer` navigates to the live URL to baseline real page performance before defining SLOs

**Governance note:** The `--isolated` flag ensures no session state (cookies, localStorage) persists between agent invocations. Each test run starts with a clean slate.

---

### `slack` — Async HITL Gate Notifications *(disabled by default)*
**Package:** [`@modelcontextprotocol/server-slack`](https://github.com/modelcontextprotocol/servers/tree/main/src/slack)

**Auth:** Create a Slack App at [api.slack.com/apps](https://api.slack.com/apps). Required bot token scopes: `channels:read`, `chat:write`, `groups:read`, `users:read`. Add `SLACK_BOT_TOKEN` and `SLACK_TEAM_ID` to `.env`, then set `"enabled": true` in `opencode.json`.

**Tools exposed:**
- `slack_post_message` — post to any channel
- `slack_reply_to_thread` — thread replies for gate discussions
- `slack_get_channel_history` — read approval responses

**Agents that benefit most (team workflows):**

| HITL Gate | Slack Channel | Message Content |
|-----------|--------------|-----------------|
| Architecture approval | `#architecture-reviews` | Module diagram, tech stack decision, ADR draft |
| Security gate | `#security-alerts` | CVSS scores, OWASP findings, remediation plan |
| Deploy approval | `#releases` | Release checklist, `deployment_approval_request`, pipeline link |
| Mutation score alert | `#quality` | Mutation score < 85% on domain layer before PR merge |
| Completeness sign-off | `#product` | Readiness score, unimplemented requirements list |

**Enable when:** Team has more than one person reviewing pipeline gates.

---

### `vercel` — Deployment Verification *(disabled by default)*
**Package:** `vercel-mcp` *(verify exact package name before enabling)*

**Auth:** `VERCEL_TOKEN` is already in `.env`. Set `"enabled": true` in `opencode.json` after verifying the package name.

**Tools would expose:**
- Read live deployment status and logs
- Check if a feature branch has a preview URL
- Query Vercel Analytics for real performance baselines

**Agents that benefit most:**
- `deployer` → reads live Vercel deployment status during pre-deploy gate
- `builder` → checks if feature branch has a Vercel preview URL before HITL gate
- `sre` → `slo-sla-designer` queries Vercel Analytics for real page performance baselines
- `reviewer` → `implementation-completeness-guard` verifies the website build passed on Vercel

---

## Environment Variables

All MCP credentials are stored in `.env` (gitignored). See `.env` for the current state.

```bash
# Already configured
GITHUB_TOKEN=...        # GitHub MCP + gh CLI
VERCEL_TOKEN=...        # Vercel MCP (when enabled) + Vercel CLI

# Add these
CONTEXT7_API_KEY=...    # Get at context7.com/dashboard (free)
BRAVE_API_KEY=...       # Get at brave.com/search/api (free tier: 2k/month)

# Add when enabling Slack
SLACK_BOT_TOKEN=xoxb-...
SLACK_TEAM_ID=T...
```

---

## Enabling / Disabling Servers

In `opencode.json`, toggle any server:

```json
"mcp": {
  "slack": {
    "enabled": true   ← change false → true to activate
  }
}
```

---

## Security Model

- MCP tools are available to **all agents** — they bypass `bash: deny` restrictions by design (MCP is a separate capability channel from bash)
- The `playwright` MCP runs `--isolated` — no persistent browser profile is created between invocations
- The `memory` MCP stores only structured JSON entities, never raw source code or user-inputted content
- Slack and GitHub credentials are scoped to minimum required permissions (see auth notes above)
- Vercel and GitHub tokens should be **rotated every 90 days** — add a calendar reminder

---

## Governance Impact

The HITL gate rules in `docs/governance.md` are unchanged. MCPs provide tools that agents can call; they do not bypass or modify gate logic. Specifically:

- The **deploy gate** (`bypass_on_timeout: false`) remains hardcoded — the Slack MCP can *notify* about the gate but cannot approve it
- The **memory MCP** stores agent artifacts but cannot modify `skills/registry.json`, `opencode.json`, or any governance file without the primary agent writing them through the normal file edit flow
- The **GitHub MCP** can create Issues and PRs but cannot merge to `main` without the HITL approval flow defined in `docs/governance.md §Change Approval Process`

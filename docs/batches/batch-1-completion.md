# Batch 1 Completion Report — Security Defaults and Source Ownership

**Batch status:** Complete; waiting for explicit confirmation before Batch 2
**Date:** 2026-08-16
**Source branch:** `AI-Workflow/Dev`
**Website branch:** `ASE-OS-Website/Dev`

## Scope completed

Batch 1 removed unsafe credential setup guidance from current onboarding and operational surfaces, formalized canonical/derived/editorial ownership, added validation checks, and synchronized the affected website onboarding copy into Website Dev.

## AI-Workflow changes

- `.env.example` now recommends short-lived fine-grained tokens, repository scoping, least privilege, rotation, and CI-provided credentials where appropriate.
- `docs/github-export.md` now uses operation-specific fine-grained permissions instead of broad classic-token scope guidance.
- `docs/how-to-use.md`, `scripts/setup.sh`, and `scripts/health-check.sh` now direct users to safe token setup.
- `docs/mcp.md` now reflects the disabled fetch server, explains that MCP is a separate capability channel, and states that availability is not authorization.
- `docs/community-skill-registry.md` now uses a short-lived registry-repository token example.
- `config/canonical-data-map.json` defines canonical, derived, mirrored, and website-owned data fields.
- `scripts/validate-skills.sh` adds check 11 for current credential guidance and canonical ownership integrity.
- `.github/workflows/validate-skills.yml` now runs when `config/**` or `website/data/**` changes.
- `docs/changelog.md` records the Batch 1 security and ownership changes.

## Website changes

The synchronized `ASE-OS-Website/Dev` data now replaces the old classic/non-expiring token copy in both onboarding sections with short-lived fine-grained token guidance. No website presentation code was changed.

## Validation evidence

| Check | Result |
|---|---|
| Shell syntax: setup, health-check, validation scripts | Passed |
| JSON syntax: canonical map and website content | Passed |
| AI-Workflow validation | **166 passed, 0 failed** |
| AI-Workflow mirror check | **140 files up to date** |
| Website ESLint | Passed |
| Website unit tests | **39 passed** |
| Website production build | **129 static pages generated successfully** |
| Current-guidance forbidden-pattern scan | Passed for all Batch 1 guidance surfaces |
| Git whitespace checks | Passed |

## Security notes

No credentials were rotated, accessed, or written. This batch changes instructions and validation only. It does not implement MCP authorization enforcement, a capability gateway, or automatic credential expiry checks. Those remain later-batch work.

The validator intentionally excludes the historical changelog from current-guidance scanning because it records superseded instructions as project history. Current setup, export, MCP, community, script, and website onboarding surfaces are checked.

## Data synchronization

AI-Workflow remains the source of truth. The updated `website/data/` mirror was regenerated, then copied exactly into `ASE-OS-Website/Dev`. The website data-only diff contains the updated onboarding copy and synchronized changelog. Website UI source files were unchanged.

## Rollback

Revert the Batch 1 AI-Workflow commit and the corresponding Website Dev data commit. This restores the prior documentation and onboarding copy without changing runtime code or credentials.

## Follow-ups for later batches

- Batch 2: add delete-aware synchronization regression coverage and the release manifest.
- Batch 3: implement versioned run evidence schemas.
- Batch 6: enforce MCP/tool action authorization at an actual runtime boundary.
- Existing root-level planning artifacts remain uncommitted and were not included in Batch 1.

> **Batch 1 complete. Waiting for explicit confirmation before starting Batch 2.**

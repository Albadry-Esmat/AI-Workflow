---
name: skill-registry-client
version: 1.0.0
domain: platform
description: 'Client for the AI Workflow Community Skill Registry. Supports four commands: publish (package and upload a local skill to the registry), install <id> (download, verify SHA-256 hash, and extract a community skill), search <query> (query the registry index by tag or skill name), and uninstall <id> (remove and deregister a community skill). Triggers on: "publish skill", "install skill from registry", "community skill", "skill registry", "download skill", "search skills", "uninstall skill", "registry client".'
author: system
---

## Purpose

Provide a standardized client for the AI Workflow Community Skill Registry — a
GitHub-hosted repository of shareable skill packages. The client supports four
operations:

- **`publish`** — package a local skill directory as `.tar.gz`, compute its SHA-256
  hash, and upload it as a GitHub Release asset.
- **`install`** — download a community skill package, verify its SHA-256 hash,
  extract it into `.opencode/skills/`, and register it in `skills/index.yaml` with
  `origin_metadata.source: "community"`.
- **`search`** — query the registry's `index.json` manifest by tag, name, or
  description keyword and print matching skills.
- **`uninstall`** — remove a community skill's directory and deregister it from
  `skills/index.yaml`.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `command` | `string` | Yes | Operation: `"publish"`, `"install"`, `"search"`, or `"uninstall"`. |
| `skill_id` | `string` | No | For `install` / `uninstall`: skill ID as listed in the registry index (e.g. `SKL-200`). Required for `install` and `uninstall`. |
| `skill_dir` | `string` | No | For `publish`: local path to the skill directory to package (e.g. `.opencode/skills/my-skill`). Required for `publish`. |
| `query` | `string` | No | For `search`: search query string. Matched against skill name, description, and tags. Required for `search`. |
| `registry_url` | `string` | No | Base URL of the registry GitHub repo. Default: `https://api.github.com/repos/AI-Workflow-Community/skills`. |
| `github_token_env` | `string` | No | Env var name holding the GitHub PAT. Required for `publish`. For `install`/`search`/`uninstall`, a token is optional (public registry). |
| `force` | `boolean` | No | For `install`: override version conflicts without prompting. Default: `false`. |
| `dry_run` | `boolean` | No | For `publish`: preview the package without uploading. Default: `false`. |
| `local_cache_dir` | `string` | No | Directory for caching downloaded packages. Default: `.opencode/registry-cache/`. |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["command"],
  "properties": {
    "command":        { "type": "string", "enum": ["publish", "install", "search", "uninstall"] },
    "skill_id":       { "type": "string" },
    "skill_dir":      { "type": "string" },
    "query":          { "type": "string" },
    "registry_url":   { "type": "string", "format": "uri" },
    "github_token_env": { "type": "string" },
    "force":          { "type": "boolean", "default": false },
    "dry_run":        { "type": "boolean", "default": false },
    "local_cache_dir":{ "type": "string", "default": ".opencode/registry-cache/" }
  }
}
```

## Required Context

- `skills/index.yaml` — read for version conflict detection (install) and deregistration (uninstall).
- `skills/graph/skill-graph.yaml` — read to detect if an uninstall target is referenced by other skills' edges.
- Internet connectivity — required for all commands except `uninstall` (and `search`/`install` against local cache).

## Execution Logic

```
─── PUBLISH command ────────────────────────────────────────────────────────────

Step P1 — Validate inputs for publish
  Require: skill_dir must exist and contain a SKILL.md file
  Read SKILL.md front matter: name, version, description, domain
  Require: name, version, description, domain all present
  Require: github_token_env provided and env var set (unless dry_run=true)

Step P2 — Validate skill passes local checks
  Run: bash scripts/validate-skills.sh (scoped to skill_dir)
  IF any validation fails: abort with error listing failures. Do not package a broken skill.

Step P3 — Build skill-manifest.json
  Compute SHA-256 hash of SKILL.md content:
    sha256 = sha256(read_bytes(skill_dir/SKILL.md))
  Build manifest:
    {
      "id":          generated or existing SKL-NNN from SKILL.md front matter if present,
      "name":        skill.name,
      "version":     skill.version,
      "description": skill.description,
      "domain":      skill.domain,
      "author":      skill.author or "community",
      "tags":        skill.tags[] or [],
      "sha256":      sha256,
      "published_at": ISO timestamp,
      "registry_version": "1.0.0"
    }
  Write to: {skill_dir}/skill-manifest.json

Step P4 — Create .tar.gz package
  Package contents: SKILL.md, skill-manifest.json, and (if present) knowledge/ directory
  Package name: {skill.name}-{skill.version}.tar.gz
  Exclude: any .env, *.key, *.pem, *secret* files

Step P5 — Upload to registry (skip if dry_run=true)
  IF dry_run=true:
    Write package to: artifacts/{skill.name}-{skill.version}.tar.gz
    Log: "Dry run: package written to artifacts/ (not uploaded)"
    Return output with upload_url=null
  ELSE:
    Read token: token = os.environ[github_token_env]
    Create GitHub Release (if not exists for this version):
      POST {registry_url}/releases body: {tag_name: "{skill.name}-v{version}", name: "{skill.name} v{version}"}
    Upload .tar.gz as Release asset:
      POST {release.upload_url} with Content-Type: application/gzip
    Upload skill-manifest.json as Release asset.
    Update registry index.json (GET, append entry, PUT):
      GET {registry_url}/contents/index.json
      Decode base64 content, parse JSON, append new skill entry
      PUT updated index.json back (include sha in PUT for CAS safety)
    Output: upload_url, release_url

─── INSTALL command ────────────────────────────────────────────────────────────

Step I1 — Fetch registry index
  Cache path: {local_cache_dir}/index.json
  IF cache exists AND mtime < 1 hour: use cached index
  ELSE:
    GET {registry_url}/contents/index.json
    Decode base64 content, parse JSON, write to cache
  Output: registry_index[]

Step I2 — Locate skill in index
  Find entry where entry.id == skill_id OR entry.name == skill_id
  IF not found: fail with "Skill '{skill_id}' not found in registry. Run 'search' to browse available skills."
  Output: registry_entry

Step I3 — Check for version conflicts
  IF a skill with the same name exists in skills/index.yaml:
    existing_version = local entry's version
    registry_version = registry_entry.version
    IF existing_version == registry_version AND force=false:
      Emit warning: "Skill '{name}' v{version} is already installed. Use force=true to reinstall."
      Return with install_status="already_installed"
    IF semver(registry_version) < semver(existing_version) AND force=false:
      Emit warning: "Registry has v{registry_version} but you have v{existing_version} installed. Use force=true to downgrade."
      Return with install_status="version_conflict"

Step I4 — HITL: Confirm install
  Present to user:
    "Install '{name}' v{version} from community registry?
    Author: {author}
    Description: {description}
    SHA-256: {sha256}
    Reply YES to install or NO to cancel."
  Wait for response (timeout: 60s).
  On timeout or NO: abort. Log "Install cancelled."
  On YES: proceed.

Step I5 — Download and verify
  Download .tar.gz from registry_entry.download_url
  Save to: {local_cache_dir}/{skill.name}-{skill.version}.tar.gz
  Compute sha256 of downloaded bytes
  IF sha256 != registry_entry.sha256:
    DELETE downloaded file
    FAIL with: "SHA-256 hash mismatch — package may be corrupted or tampered. Aborting install."
  Output: local_package_path (verified)

Step I6 — Extract skill
  Extract .tar.gz to: .opencode/skills/{skill.name}/
  IF directory already exists AND force=false: fail with "Use force=true to overwrite."
  On successful extraction: log extraction paths.

Step I7 — Register in index.yaml
  Append entry to skills/index.yaml:
    - id: {next available SKL-NNN}
      name: {skill.name}
      ...standard index fields...
      origin_metadata:
        source: "community"
        registry_url: {registry_url}
        sha256: {sha256}
        installed_at: ISO timestamp
  Output: registered_id

─── SEARCH command ─────────────────────────────────────────────────────────────

Step S1 — Fetch registry index (same as Step I1)

Step S2 — Filter by query
  Filter registry_index[] where any of:
    entry.name contains query (case-insensitive)
    entry.description contains query (case-insensitive)
    any tag in entry.tags[] contains query (case-insensitive)
  Output: matches[]

Step S3 — Present results
  IF matches[] is empty:
    Return: "No skills found matching '{query}'."
  ELSE:
    Format as table:
      ID | Name | Version | Domain | Description (truncated to 80 chars)
    Return results.

─── UNINSTALL command ──────────────────────────────────────────────────────────

Step U1 — Validate uninstall target
  Look up skill_id in skills/index.yaml
  IF not found: fail with "Skill '{skill_id}' is not installed."
  IF origin_metadata.source != "community": emit WARNING "'{skill_id}' is a system skill, not a community skill. Uninstalling system skills may break the pipeline. Proceed? (YES/NO)"

Step U2 — Check for dependents
  Scan skills/graph/skill-graph.yaml edges for edges with to: == skill_id
  IF any dependent edges found:
    Fail with: "Cannot uninstall '{skill_id}' — it is referenced by: {dependent_ids[]}. Remove those dependencies first."

Step U3 — HITL: Confirm uninstall
  Present: "Uninstall '{name}' v{version}? This will delete .opencode/skills/{name}/ and remove it from skills/index.yaml. Reply YES to confirm."
  Wait 60s. On timeout or non-YES: abort.

Step U4 — Remove files and deregister
  Delete directory: .opencode/skills/{skill.name}/
  Remove entry from skills/index.yaml (find by skill_id or name)
  Emit event: skill.uninstalled
  Output: removed_skill_id, removed_skill_name
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `command` | `string` | The command that was executed. |
| `install_status` | `string` \| `null` | Install result: `"installed"`, `"already_installed"`, `"version_conflict"`, `"cancelled"`, `"hash_mismatch"`. `null` for non-install commands. |
| `registered_id` | `string` \| `null` | The SKL-NNN ID assigned to the installed skill. `null` for non-install commands. |
| `upload_url` | `string` \| `null` | GitHub Release asset URL after successful publish. `null` otherwise. |
| `search_results` | `array[object]` \| `null` | Matching skills for search command. `null` otherwise. |
| `removed_skill_id` | `string` \| `null` | ID of the uninstalled skill. `null` otherwise. |
| `metrics` | `object` | `tokens_in`, `tokens_out`, `duration_ms`, `items_produced`, `version`. |
| `feedback` | `array[object]` | Feedback loop entries (warnings, info). |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["command", "install_status", "registered_id", "upload_url", "search_results", "removed_skill_id", "metrics", "feedback"],
  "properties": {
    "command":         { "type": "string" },
    "install_status":  { "type": ["string", "null"] },
    "registered_id":   { "type": ["string", "null"] },
    "upload_url":      { "type": ["string", "null"] },
    "search_results":  { "type": ["array", "null"], "items": { "type": "object" } },
    "removed_skill_id":{ "type": ["string", "null"] },
    "metrics":         { "type": "object" },
    "feedback":        { "type": "array", "items": { "type": "object" } }
  }
}
```

## Rules & Constraints

- **Install is HITL-gated** — no community skill may be installed without explicit user confirmation. This is non-negotiable security.
- **SHA-256 hash verification is mandatory** on install. A hash mismatch MUST abort with a clear error. No partial extractions.
- Community skills are tagged `origin_metadata.source: "community"` in `skills/index.yaml`. The validator (check 8) verifies origin_metadata shape for these entries.
- **Uninstall is blocked** if any other skill has a graph edge pointing to the target. Dependency safety before removal.
- Uninstalling a non-community (system) skill requires an explicit WARNING and confirmation because it may break pipelines.
- `publish` validates the skill passes `validate-skills.sh` before packaging. A broken skill MUST NOT be published.
- `search` uses a local cache (valid 1 hour) to avoid hammering the GitHub API.
- `force=true` bypasses version conflict warnings but NEVER bypasses SHA-256 hash verification.

## Security Considerations

- **SHA-256 hash verification** (Step I5) is the primary supply-chain security control. Hash mismatch = abort. No exceptions.
- GitHub PAT for `publish` is read from environment variable only. Token value is NEVER written to any log, output, or manifest.
- The `.tar.gz` package MUST exclude: `.env`, `*.key`, `*.pem`, files matching `*secret*`, `*credential*`, `*token*`. Step P4 must verify exclusions.
- Community skill `SKILL.md` content is instructions to an LLM agent. An attacker could craft a skill that issues destructive instructions. The HITL install gate + hash verification are the primary defenses.
- Registry index updates (Step P5) use GitHub's Compare-And-Swap (CAS) mechanism via the `sha` field in the PUT request to prevent concurrent write conflicts.
- `local_cache_dir` is `.opencode/registry-cache/` by default — this directory should be added to `.gitignore`.

## Token Optimization

- `search` uses a cached local index — no API call needed for < 1-hour-old cache.
- `install` and `uninstall` are non-LLM operations after the HITL gate — token cost is minimal.
- HITL prompts are single messages — no multi-turn required.
- `publish` validation runs `validate-skills.sh` (bash, no LLM tokens). Package building is filesystem I/O only.

## Quality Checklist

- [ ] `publish`: skill_dir contains SKILL.md with valid front matter
- [ ] `publish`: validate-skills.sh passes before packaging
- [ ] `publish`: .env / *.key / *.pem excluded from .tar.gz
- [ ] `publish`: SHA-256 computed and written to skill-manifest.json
- [ ] `install`: SHA-256 verified before extraction — mismatch aborts
- [ ] `install`: HITL confirmation gate raised before any file is written
- [ ] `install`: `origin_metadata.source: "community"` set in index.yaml entry
- [ ] `install`: version conflict detected and reported when force=false
- [ ] `search`: local cache used when < 1 hour old
- [ ] `uninstall`: dependent edges checked before removal
- [ ] `uninstall`: HITL confirmation gate raised
- [ ] `uninstall`: system skill uninstall triggers WARNING before gate

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| Registry unreachable (network error) | `search` / `install`: try local cache. If cache miss: fail with "Registry unreachable. Check internet connection." |
| SHA-256 mismatch on install | Delete downloaded file. Fail with hash mismatch error. Do not extract. |
| `skill_id` not found in registry index | Fail with "not found" error and suggest using `search`. |
| Dependent edges prevent uninstall | Fail with list of dependent skills. Do not remove anything. |
| `publish` with invalid/failing skill | Fail before packaging. Show validation errors. |
| HITL timeout on install (60s) | Treat as NO — abort install. |
| HITL timeout on uninstall (60s) | Treat as NO — abort uninstall. |
| GitHub API rate limit (publish) | Emit warning. Abort publish. Retry manually after rate limit resets. |

## Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Behavior on Timeout |
|------|---------|---------|---------------------|
| Install confirmation | `command=install` always | 60s | Treat as NO — abort install |
| Uninstall confirmation | `command=uninstall` always | 60s | Treat as NO — abort uninstall |
| System skill uninstall warning | `command=uninstall` AND `origin_metadata.source != "community"` | 60s | Treat as NO — abort |

## Skill Composition

`skill-registry-client` v1.0.0 is invoked directly (standalone), not as part of any standard pipeline. It is a platform utility skill.

```yaml
composes:
  - skill: skill-registry-client
    version: "^1.0.0"
    input_map: {}  # All inputs provided directly by user at invocation

pipeline_entry:
  - direct_invocation: true
  - trigger: user types "install skill", "search skills", "publish skill", "uninstall skill"
  - NOT part of full-pipeline, quick-review, or any other automated pipeline

produces:
  - skills/index.yaml: updated on install / uninstall
  - .opencode/skills/{name}/: directory added on install, removed on uninstall
  - .opencode/registry-cache/: local cache of registry index
  - artifacts/skill-name-version.tar.gz: on dry_run publish
```

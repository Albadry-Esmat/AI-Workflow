# Skill Package Format

## Overview

A **skill package** is a portable, self-describing archive (`.tar.gz`) that bundles a single AI Workflow skill into a distributable unit. Skill packages are the currency of the Community Skill Registry: authors produce them with `skill-registry-client publish`, and consumers install them with `skill-registry-client install`.

You would use a skill package when you want to:

- Share a skill you built with the wider community via the registry.
- Install a third-party skill from the registry into your local workspace.
- Archive a specific version of a skill for auditing or rollback purposes.
- Move a skill between workspaces without relying on Git.

The format is intentionally minimal — the canonical artifact is `SKILL.md` (the skill's specification), accompanied by a machine-readable `skill-manifest.json` and an optional `knowledge/` directory for reference data.

---

## Package Structure

### Source Skill Directory (before packaging)

```
.opencode/skills/my-skill/
├── SKILL.md                  # Required — the canonical skill specification
├── skill-manifest.json       # Generated at publish time — do not hand-edit
└── knowledge/                # Optional — reference files, few-shot examples, etc.
    ├── examples.md
    └── reference-data.json
```

### Contents of the `.tar.gz` Archive

| Path in archive | Required | Notes |
|-----------------|----------|-------|
| `SKILL.md` | Yes | The complete skill specification including YAML frontmatter. |
| `skill-manifest.json` | Yes | Generated manifest with SHA-256, version, metadata. |
| `knowledge/` | No | Included in full if present in source directory. |

### Files Explicitly Excluded

The `publish` command MUST exclude the following from the archive, regardless of their presence in the source directory:

| Pattern | Reason |
|---------|--------|
| `.env` | Environment variable secrets |
| `*.key` | Private key files |
| `*.pem` | Certificate / key files |
| `*secret*` | Any file whose name contains "secret" |
| `*credential*` | Any file whose name contains "credential" |
| `*token*` | Any file whose name contains "token" |
| `.opencode/registry-cache/` | Local cache — not part of the skill |
| `artifacts/` | Build output directory |
| `node_modules/`, `__pycache__/` | Dependency caches |

### Package Naming

```
{skill-name}-{version}.tar.gz
```

Examples:
- `data-contract-enforcer-1.2.0.tar.gz`
- `my-custom-validator-0.1.0.tar.gz`

---

## skill-manifest.json Schema

The manifest is a JSON file generated automatically by `skill-registry-client publish`. It is the machine-readable counterpart to `SKILL.md` and is required in every package.

### Example

```json
{
  "id": "SKL-200",
  "name": "my-custom-validator",
  "version": "1.0.0",
  "description": "Validates domain-specific business rules for the Acme Corp billing module.",
  "domain": "quality",
  "author": "jane.doe",
  "tags": ["validation", "billing", "acme"],
  "sha256": "a3f5d2...c91e",
  "published_at": "2026-07-09T10:30:00Z",
  "registry_version": "1.0.0"
}
```

### Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | Registry-assigned skill ID in `SKL-NNN` format. Assigned by the registry on first publish; preserved on subsequent publishes. |
| `name` | `string` | Yes | Canonical skill name. Must match the `name` field in `SKILL.md` frontmatter. Must be lowercase, hyphen-separated (`my-skill`). |
| `version` | `string` | Yes | Semantic version (`MAJOR.MINOR.PATCH`). Must match `version` in `SKILL.md` frontmatter. |
| `description` | `string` | Yes | Short description of what the skill does. Sourced from `SKILL.md` frontmatter. Max 200 characters recommended. |
| `domain` | `string` | Yes | Skill domain (e.g., `quality`, `security`, `platform`, `data`, `frontend`, `backend`). |
| `author` | `string` | Yes | Author identifier. Defaults to `"community"` if not specified in `SKILL.md`. |
| `tags` | `array[string]` | No | Tags for search filtering. Sourced from `SKILL.md` frontmatter `tags[]` field. |
| `sha256` | `string` | Yes | Hex-encoded SHA-256 hash of the `SKILL.md` file bytes at the time of packaging. Used for integrity verification on install. |
| `published_at` | `string` | Yes | ISO 8601 UTC timestamp of when the package was built. |
| `registry_version` | `string` | Yes | Version of the skill package format spec this manifest conforms to. Currently `"1.0.0"`. |

### JSON Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["id", "name", "version", "description", "domain", "author", "sha256", "published_at", "registry_version"],
  "properties": {
    "id":               { "type": "string", "pattern": "^SKL-[0-9]+$" },
    "name":             { "type": "string", "pattern": "^[a-z][a-z0-9-]+$" },
    "version":          { "type": "string", "pattern": "^[0-9]+\\.[0-9]+\\.[0-9]+$" },
    "description":      { "type": "string", "maxLength": 500 },
    "domain":           { "type": "string" },
    "author":           { "type": "string" },
    "tags":             { "type": "array", "items": { "type": "string" } },
    "sha256":           { "type": "string", "pattern": "^[a-f0-9]{64}$" },
    "published_at":     { "type": "string", "format": "date-time" },
    "registry_version": { "type": "string" }
  }
}
```

---

## Naming Conventions

| Artifact | Convention | Example |
|----------|------------|---------|
| Package archive | `{skill-name}-{version}.tar.gz` | `billing-validator-1.0.0.tar.gz` |
| Manifest file | `skill-manifest.json` (always this name) | `skill-manifest.json` |
| Skill directory | `{skill-name}/` (same as skill name) | `.opencode/skills/billing-validator/` |
| Skill specification | `SKILL.md` (always uppercase, always this name) | `SKILL.md` |

**Skill name rules:**

- Lowercase letters, digits, and hyphens only: `[a-z][a-z0-9-]+`
- No underscores, spaces, or dots.
- Must be unique within the registry.
- Should be descriptive and action-oriented (e.g., `rate-limiter-designer`, `contract-validator`).

---

## SHA-256 Hash Computation

The SHA-256 hash in `skill-manifest.json` is computed over the **raw bytes** of `SKILL.md` at package build time:

```python
import hashlib
from pathlib import Path

skill_md_bytes = Path("SKILL.md").read_bytes()
sha256 = hashlib.sha256(skill_md_bytes).hexdigest()
```

**Why `SKILL.md` is the canonical artifact:**

`SKILL.md` is the sole authoritative specification of a skill's behaviour — it contains the frontmatter, all execution logic, security rules, and human-in-the-loop gates. It is what the LLM agent actually reads and follows. By hashing `SKILL.md` (not the archive), the registry guarantees that the *instructions* a skill delivers have not been tampered with between publish and install, even if the `.tar.gz` wrapper was re-created.

**Hash lifecycle:**

1. **At publish time (Step P3):** SHA-256 is computed from `SKILL.md` bytes and written to `skill-manifest.json`.
2. **At install time (Step I5):** SHA-256 of the downloaded `SKILL.md` bytes is recomputed and compared to the value in `skill-manifest.json` (which was also uploaded to the registry index). Mismatch → abort.
3. **Post-install (validate-skills.sh check 10):** SHA-256 in `skills/index.yaml` `origin_metadata.sha256` is recomputed against the installed `SKILL.md` bytes and verified on every `make validate` run.

---

## Version Numbering

Community skills follow **Semantic Versioning 2.0.0** (`MAJOR.MINOR.PATCH`):

| Increment | When to use |
|-----------|-------------|
| `MAJOR` | Breaking changes to the skill's interface, required inputs, or output schema. |
| `MINOR` | New functionality added in a backward-compatible way (new optional inputs, new output fields). |
| `PATCH` | Bug fixes, documentation improvements, or logic corrections that do not change the interface. |

**Rules:**

- Version in `SKILL.md` frontmatter and `skill-manifest.json` must be identical.
- Once a version is published to the registry, it is immutable. To update a skill, increment the version and republish.
- The registry retains all past versions as GitHub Release assets.
- For version assignment guidance, refer to the `versioning` skill.

---

## Registry Index Format

The community registry exposes a single `index.json` file at the root of the GitHub repository. This file is the discovery manifest for all published skills.

### Structure

```json
{
  "registry_version": "1.0.0",
  "updated_at": "2026-07-09T10:30:00Z",
  "skills": [
    {
      "id": "SKL-200",
      "name": "billing-validator",
      "version": "1.2.0",
      "description": "Validates domain-specific billing rules.",
      "domain": "quality",
      "author": "jane.doe",
      "tags": ["validation", "billing"],
      "sha256": "a3f5d2...c91e",
      "published_at": "2026-06-15T08:00:00Z",
      "download_url": "https://github.com/AI-Workflow-Community/skills/releases/download/billing-validator-v1.2.0/billing-validator-1.2.0.tar.gz",
      "release_url": "https://github.com/AI-Workflow-Community/skills/releases/tag/billing-validator-v1.2.0",
      "registry_version": "1.0.0"
    }
  ]
}
```

### Index Entry Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Registry-assigned SKL-NNN identifier. |
| `name` | `string` | Canonical skill name (matches `SKILL.md` frontmatter). |
| `version` | `string` | Published version (semver). |
| `description` | `string` | Short description from `SKILL.md` frontmatter. |
| `domain` | `string` | Skill domain. |
| `author` | `string` | Author identifier. |
| `tags` | `array[string]` | Tags for search filtering. |
| `sha256` | `string` | SHA-256 of `SKILL.md` bytes — used for integrity verification. |
| `published_at` | `string` | ISO 8601 UTC timestamp of publish. |
| `download_url` | `string` | Direct URL to the `.tar.gz` GitHub Release asset. |
| `release_url` | `string` | URL to the GitHub Release page. |
| `registry_version` | `string` | Package format version this entry conforms to. |

---

## Building a Package Manually

If you prefer not to use `skill-registry-client publish`, you can build a package manually with standard Unix tools. This is useful for CI pipelines or environments without the registry client.

**Prerequisites:** `bash`, `python3`, `tar`, `sha256sum` (or `shasum -a 256` on macOS).

```bash
#!/usr/bin/env bash
# Manual skill packaging script
# Usage: bash package-skill.sh .opencode/skills/my-skill

set -euo pipefail

SKILL_DIR="${1:?Usage: $0 <skill-dir>}"
SKILL_NAME=$(python3 -c "
import re, sys
content = open('${SKILL_DIR}/SKILL.md').read()
m = re.search(r'^name:\s*(.+)$', content, re.MULTILINE)
print(m.group(1).strip()) if m else sys.exit(1)
")
SKILL_VERSION=$(python3 -c "
import re, sys
content = open('${SKILL_DIR}/SKILL.md').read()
m = re.search(r'^version:\s*(.+)$', content, re.MULTILINE)
print(m.group(1).strip()) if m else sys.exit(1)
")

PACKAGE_NAME="${SKILL_NAME}-${SKILL_VERSION}.tar.gz"

# Step 1: Compute SHA-256 of SKILL.md
SHA256=$(python3 -c "
import hashlib
data = open('${SKILL_DIR}/SKILL.md', 'rb').read()
print(hashlib.sha256(data).hexdigest())
")

echo "Skill:   ${SKILL_NAME}"
echo "Version: ${SKILL_VERSION}"
echo "SHA-256: ${SHA256}"

# Step 2: Write skill-manifest.json
python3 - <<PYEOF
import json, datetime
manifest = {
    "id": "SKL-PENDING",
    "name": "${SKILL_NAME}",
    "version": "${SKILL_VERSION}",
    "sha256": "${SHA256}",
    "published_at": datetime.datetime.utcnow().isoformat() + "Z",
    "registry_version": "1.0.0"
}
with open("${SKILL_DIR}/skill-manifest.json", "w") as f:
    json.dump(manifest, f, indent=2)
print("  Wrote skill-manifest.json")
PYEOF

# Step 3: Create the archive (exclude secrets)
mkdir -p artifacts
tar -czf "artifacts/${PACKAGE_NAME}" \
  --exclude="*.env" \
  --exclude="*.key" \
  --exclude="*.pem" \
  --exclude="*secret*" \
  --exclude="*credential*" \
  --exclude="*token*" \
  -C "${SKILL_DIR}" \
  SKILL.md \
  skill-manifest.json \
  $([ -d "${SKILL_DIR}/knowledge" ] && echo "knowledge" || true)

echo "  Package: artifacts/${PACKAGE_NAME}"

# Step 4: Verify the archive
echo "  Archive contents:"
tar -tzf "artifacts/${PACKAGE_NAME}" | sed 's/^/    /'

echo ""
echo "Package built successfully: artifacts/${PACKAGE_NAME}"
echo "SHA-256 (SKILL.md): ${SHA256}"
echo ""
echo "Next: Upload artifacts/${PACKAGE_NAME} and skill-manifest.json as"
echo "      GitHub Release assets, then update index.json in the registry repo."
```

# Community Skill Registry

## What Is the Community Skill Registry?

The **AI Workflow Community Skill Registry** is a GitHub-hosted repository at
[`AI-Workflow-Community/skills`](https://github.com/AI-Workflow-Community/skills)
where developers can publish, discover, and install skills for the AI Workflow
skill pipeline system.

### How It Works

1. **Authors** build a skill (a `SKILL.md` + optional `knowledge/` directory), run `validate-skills.sh` to verify it is correct, then use `skill-registry-client publish` to package it and upload it as a GitHub Release asset.
2. The registry maintains an `index.json` manifest that catalogs every published skill — its name, version, domain, tags, SHA-256 hash, and download URL.
3. **Consumers** use `skill-registry-client search` to discover skills, `skill-registry-client install` to download and verify them, and `skill-registry-client uninstall` to remove them.

### Key Properties

| Property | Detail |
|----------|--------|
| **Storage** | GitHub Releases (one release per skill version) |
| **Discovery** | `index.json` manifest in the registry repo root |
| **Integrity** | SHA-256 hash of `SKILL.md` bytes, verified on every install |
| **Security** | HITL confirmation gate required for every install and uninstall |
| **Isolation** | Community skills are tagged `origin_metadata.source: "community"` and validated separately from system skills |

---

## Finding Skills (search)

Use the `search` command to query the registry index by skill name, description, or tag.

### Example Input

```json
{
  "command": "search",
  "query": "billing"
}
```

### Example Output

```
Searching registry for "billing"...
Fetching index from cache (age: 12 minutes)...

Found 3 skill(s) matching "billing":

ID        Name                     Version  Domain    Description
────────  ───────────────────────  ───────  ────────  ─────────────────────────────────────────────────────────────────
SKL-200   billing-validator        1.2.0    quality   Validates domain-specific billing rules for subscription SaaS...
SKL-201   invoice-generator        0.3.1    backend   Generates PDF invoices from order data and billing config...
SKL-207   billing-reconciler       2.0.0    data      Reconciles billing records against payment gateway transact...

Run: install <skill_id> to install a skill.
```

### Cache Behaviour

`search` maintains a local cache of `index.json` at `.opencode/registry-cache/index.json`. The cache is considered fresh for **60 minutes**. After that, a new fetch is made from the GitHub API. This means repeated searches are fast and do not consume GitHub API rate limit quota.

To force a cache refresh, delete `.opencode/registry-cache/index.json` before running `search`.

---

## Installing a Skill (install)

The `install` command downloads a community skill, verifies its integrity, and registers it in your workspace.

### Step-by-Step

#### 1. Find the skill ID using search

```json
{ "command": "search", "query": "billing" }
```

Note the `ID` column value (e.g., `SKL-200`).

#### 2. Run install

```json
{
  "command": "install",
  "skill_id": "SKL-200"
}
```

#### 3. Respond to the HITL confirmation gate

The install command will **always** pause and ask for confirmation before writing any files:

```
┌─────────────────────────────────────────────────────────────────┐
│  Install 'billing-validator' v1.2.0 from community registry?    │
│                                                                  │
│  Author:      jane.doe                                           │
│  Description: Validates domain-specific billing rules for        │
│               subscription SaaS products.                        │
│  SHA-256:     a3f5d2c8...91e4                                    │
│                                                                  │
│  Reply YES to install or NO to cancel.                           │
└─────────────────────────────────────────────────────────────────┘
```

Type `YES` to proceed. Any other response (or a 60-second timeout) aborts the install.

#### 4. What happens during install

| Step | What occurs |
|------|-------------|
| Fetch index | `index.json` is fetched (or read from cache) |
| Locate skill | Entry for `SKL-200` is found in the index |
| Conflict check | Checks if a skill with the same name is already installed |
| HITL gate | Confirmation prompt presented to user |
| Download | `.tar.gz` downloaded to `.opencode/registry-cache/` |
| Hash verify | SHA-256 of downloaded `SKILL.md` recomputed and compared to index value |
| Extract | Archive extracted to `.opencode/skills/billing-validator/` |
| Register | Entry appended to `skills/index.yaml` with `origin_metadata.source: "community"` |

#### 5. Verify the installation

After install completes, verify using the validation suite:

```bash
bash scripts/validate-skills.sh
```

Check 10/10 will compute the SHA-256 of the installed `SKILL.md` and confirm it matches `origin_metadata.sha256` in `skills/index.yaml`.

### Installed Entry in `skills/index.yaml`

```yaml
- id: SKL-200
  name: billing-validator
  version: "1.2.0"
  domain: quality
  description: Validates domain-specific billing rules for subscription SaaS products.
  executable_skill: .opencode/skills/billing-validator/SKILL.md
  origin_metadata:
    source: "community"
    registry_url: "https://api.github.com/repos/AI-Workflow-Community/skills"
    sha256: "a3f5d2c8...91e4"
    installed_at: "2026-07-09T10:30:00Z"
```

### Force-Installing Over an Existing Skill

If the skill is already installed and you want to reinstall or upgrade:

```json
{
  "command": "install",
  "skill_id": "SKL-200",
  "force": true
}
```

> **Note:** `force=true` bypasses version conflict warnings but **never** bypasses SHA-256 hash verification. The integrity check is always performed.

---

## Uninstalling a Skill (uninstall)

The `uninstall` command removes a community skill's files and deregisters it from `skills/index.yaml`.

### Example Input

```json
{
  "command": "uninstall",
  "skill_id": "SKL-200"
}
```

### Dependency Check

Before removing the skill, `uninstall` scans `skills/graph/skill-graph.yaml` for any edges pointing to the target skill. If other skills depend on it, the uninstall is **blocked**:

```
ERROR: Cannot uninstall 'SKL-200' (billing-validator) — it is referenced by:
  - SKL-205 (invoice-generator)
  - SKL-211 (payment-reconciler)

Remove those dependencies first, then retry.
```

You must uninstall or update the dependent skills before the target can be removed.

### HITL Confirmation

Like install, uninstall always requires confirmation:

```
Uninstall 'billing-validator' v1.2.0?
This will delete .opencode/skills/billing-validator/ and remove it from skills/index.yaml.
Reply YES to confirm.
```

### Uninstalling System Skills

If you attempt to uninstall a skill that is **not** tagged `origin_metadata.source: "community"` (i.e., a system skill), you will receive an additional warning before the HITL gate:

```
WARNING: 'SKL-042' (security-review) is a system skill, not a community skill.
Uninstalling system skills may break the pipeline.
Proceed? (YES/NO)
```

---

## Publishing a Skill (publish)

Share your skill with the community by publishing it to the registry.

### Prerequisites

1. **A valid skill directory** with a `SKILL.md` that passes `validate-skills.sh`.
2. **A GitHub Personal Access Token (PAT)** with `repo` scope for the registry repository (`AI-Workflow-Community/skills`). Store it in an environment variable (do **not** hardcode it).
3. **Your skill must pass all local validation checks** before it can be published.

### Step-by-Step

#### 1. Ensure your skill passes validation

```bash
bash scripts/validate-skills.sh
```

All checks must pass. A failing skill cannot be packaged.

#### 2. Set your GitHub PAT environment variable

```bash
export REGISTRY_GITHUB_TOKEN="ghp_your_token_here"
```

#### 3. Run publish

```json
{
  "command": "publish",
  "skill_dir": ".opencode/skills/my-custom-validator",
  "github_token_env": "REGISTRY_GITHUB_TOKEN"
}
```

#### 4. What publish does

| Step | What occurs |
|------|-------------|
| Validate inputs | Confirms `skill_dir` exists, `SKILL.md` has valid frontmatter |
| Local validation | Runs `validate-skills.sh` scoped to your skill |
| Build manifest | Computes SHA-256 of `SKILL.md`, writes `skill-manifest.json` |
| Create archive | Packages `SKILL.md`, `skill-manifest.json`, `knowledge/` into `.tar.gz` (secrets excluded) |
| Create Release | Creates a GitHub Release at `{skill.name}-v{version}` |
| Upload assets | Uploads `.tar.gz` and `skill-manifest.json` as Release assets |
| Update index | Appends entry to registry's `index.json` via CAS-safe GitHub API PUT |

#### 5. Expected output

```
Publishing 'my-custom-validator' v1.0.0...
  PASS: validate-skills.sh — all checks passed
  SHA-256: 7c4e9a1b...f302
  Package: my-custom-validator-1.0.0.tar.gz (12.4 KB)
  Release: https://github.com/AI-Workflow-Community/skills/releases/tag/my-custom-validator-v1.0.0
  Asset:   https://github.com/AI-Workflow-Community/skills/releases/download/my-custom-validator-v1.0.0/my-custom-validator-1.0.0.tar.gz

Registry index updated. Skill is now discoverable via 'search'.
```

### Dry Run Option

Preview the package without uploading anything:

```json
{
  "command": "publish",
  "skill_dir": ".opencode/skills/my-custom-validator",
  "dry_run": true
}
```

The archive is written to `artifacts/my-custom-validator-1.0.0.tar.gz` but **not** uploaded. No GitHub API calls are made. No PAT required.

---

## Security Model

The community registry is designed with a **defence-in-depth** security model. Community skills are LLM instructions — a malicious skill could issue harmful commands if installed without scrutiny.

### Three Layers of Defence

#### Layer 1: SHA-256 Hash Verification

Every skill package includes a SHA-256 hash of `SKILL.md` bytes in `skill-manifest.json`. The registry `index.json` also stores this hash. On install, the hash is recomputed from the downloaded bytes and compared. A mismatch immediately aborts the install and deletes the downloaded file.

This protects against:
- Tampered packages on the download CDN.
- Man-in-the-middle attacks on the download URL.
- Corrupted downloads.

**The hash check is also re-run on every `make validate` execution (check 10/10)** to detect post-install tampering.

#### Layer 2: HITL Confirmation Gate

Every install and uninstall requires explicit user confirmation. The confirmation prompt displays the skill's name, version, author, description, and SHA-256 hash so you can make an informed decision.

This protects against:
- Automated pipeline injection of malicious skills.
- Accidental installs.

#### Layer 3: Dependency Graph Check (Uninstall)

Uninstall is blocked if other skills depend on the target. This prevents accidental breakage of the pipeline graph.

### Supply-Chain Trust Model

| Trust Level | Source | Controls |
|-------------|--------|----------|
| **System skills** | Shipped with the AI Workflow framework | Committed to version-controlled repo; no registry install |
| **Community skills** | Published by third-party authors | SHA-256 verified; HITL gated; tagged `origin_metadata.source: "community"`; re-verified by check 10/10 |

Community skills are **never automatically elevated** to system skill status. They remain tagged as community origin indefinitely.

### Token / Secret Safety

- GitHub PATs are read from environment variables only. They are never written to logs, manifests, or any output.
- The `.tar.gz` archive build explicitly excludes `.env`, `*.key`, `*.pem`, and files matching `*secret*`, `*credential*`, `*token*`.
- `.opencode/registry-cache/` should be added to `.gitignore` to prevent accidentally committing cached packages.

---

## Conflict Resolution

### Version Conflicts

When you run `install` and a skill with the same name is already installed, the client checks versions:

| Situation | Default behaviour | With `force=true` |
|-----------|-------------------|-------------------|
| Same version already installed | Warn: "already installed" — skip | Reinstall (re-extract, re-register) |
| Registry has **older** version than installed | Warn: "would downgrade" — skip | Downgrade (with confirmation) |
| Registry has **newer** version than installed | Proceed normally (upgrade) | Same |
| No conflict | Proceed normally | Same |

### When to Use `force=true`

Use `force=true` when you need to:

- **Reinstall** a skill at the same version (e.g., after a local file was accidentally modified).
- **Downgrade** to an older registry version for compatibility reasons.
- **Overwrite** an existing skill directory that was installed outside the registry client.

> **Important:** `force=true` bypasses version conflict warnings but **never** bypasses SHA-256 hash verification. The integrity check runs regardless of `force`.

### Concurrent Publish Conflicts

When publishing, the registry client uses GitHub's Compare-And-Swap (CAS) mechanism (`sha` field in the PUT request) when updating `index.json`. This prevents two concurrent publish operations from overwriting each other's changes. If a CAS conflict is detected, publish fails with a clear error and the author must retry.

---

## Registry Repository Structure

The community registry lives at `https://github.com/AI-Workflow-Community/skills`. Here is how the repository is organized:

```
AI-Workflow-Community/skills/
├── index.json                          # Master discovery manifest (all skills)
├── README.md                           # Registry landing page
├── CONTRIBUTING.md                     # Contribution guidelines
└── (GitHub Releases)                   # One release per skill version
    ├── billing-validator-v1.2.0/
    │   ├── billing-validator-1.2.0.tar.gz
    │   └── skill-manifest.json
    ├── invoice-generator-v0.3.1/
    │   ├── invoice-generator-0.3.1.tar.gz
    │   └── skill-manifest.json
    └── ...
```

### How Releases Work

Each published skill version becomes a **GitHub Release** with a tag in the format `{skill-name}-v{version}` (e.g., `billing-validator-v1.2.0`). The Release has two assets:

1. `{skill-name}-{version}.tar.gz` — the installable package.
2. `skill-manifest.json` — the machine-readable manifest (for tooling that needs the manifest without downloading the full package).

### index.json

`index.json` at the repository root is the single source of truth for skill discovery. The registry client fetches this file (via the GitHub Contents API) and caches it locally. It is updated atomically on every publish.

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| `Registry unreachable. Check internet connection.` | No network connectivity, or GitHub API is down | Check your internet connection. Try `curl https://api.github.com` |
| `Skill 'SKL-NNN' not found in registry.` | Skill ID does not exist in the registry index | Run `search` to browse available skills. Check the ID format. |
| `SHA-256 hash mismatch — package may be corrupted or tampered.` | Downloaded file is corrupted or was tampered with | Delete `.opencode/registry-cache/` and retry. If it persists, do not install — the package may be compromised. |
| `Skill 'my-skill' is already installed. Use force=true to reinstall.` | Same version already installed | Add `"force": true` to reinstall, or use a different skill_id. |
| `Cannot uninstall — it is referenced by: [...]` | Other skills depend on the target | Uninstall or update the listed dependent skills first. |
| `validate-skills.sh check 10/10 FAIL: SHA-256 mismatch` | Installed `SKILL.md` was modified after install | The skill file may have been tampered with or hand-edited. Uninstall and reinstall from the registry. |
| `GitHub API rate limit — abort publish.` | Too many API calls in a short window | Wait for the rate limit to reset (usually 1 hour for unauthenticated; authenticated PAT has higher limits). Retry. |
| `publish: validate-skills.sh failed` | Skill has validation errors | Run `bash scripts/validate-skills.sh` manually and fix all FAIL lines before attempting to publish. |
| `HITL gate timed out (60s) — install cancelled.` | No response within 60 seconds | Re-run the install command and respond promptly to the confirmation prompt. |
| `Cache is stale / search returns old results` | Local cache is < 1 hour old but you expect newer results | Delete `.opencode/registry-cache/index.json` to force a fresh fetch. |
| `Cannot find python3` | Python 3 not installed | Install Python 3: `https://python.org`. Required for checks 0, 9, 10. |

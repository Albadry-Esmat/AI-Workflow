# Versioning — Version Strategy

**Version:** 1.0.0 | **Last updated:** 2026-06-16

## System Versioning

The system uses **Semantic Versioning 2.0.0** at three levels:

| Level | Scope | Version File | Bump Cadence |
|-------|-------|-------------|--------------|
| **System** | Whole documentation + skill ecosystem | `docs/versioning.md`, `docs/changelog.md` | Per release |
| **Skill** | Individual skill specification | Skill's version field + `skills/registry.json` | Per skill change |
| **Documentation** | Individual doc file | File header version field | Per doc change |

## Version Format

```
MAJOR.MINOR.PATCH (e.g., 1.2.3)
```

| Bump | Trigger | Example |
|------|---------|---------|
| **MAJOR** | Breaking change to system architecture, skill I/O schema, or governance model | Removing a required output field, changing orchestration model |
| **MINOR** | New capability, new skill, new optional field, new workflow | Adding a new skill, adding optional input field |
| **PATCH** | Bug fix, documentation clarification, non-functional improvement | Fixing a schema constraint, updating descriptions |

## File-Level Version Tracking

Every documentation file has a version header:

```markdown
# Title — Subtitle

**Version:** x.y.z | **Last updated:** YYYY-MM-DD
```

Rules:
- Files start at 1.0.0 on creation.
- PATCH bump: typo fixes, clarification, reformatting.
- MINOR bump: new section, new example, new cross-reference.
- Files track their own version independently of system version.
- System version is recorded in `docs/README.md` and `docs/changelog.md`.

## Skill Versioning

Skills in `skills/registry.json` declare their version:

```json
{
  "name": "requirement-analyzer",
  "version": "1.1.0"
}
```

See [Versioning Skill](../.opencode/skills/versioning/SKILL.md) for the full skill versioning rules including backward compatibility matrix and deprecation policy.

## Changelog Rules

See [Changelog](changelog.md) for the full change history and entry format.

Changelog entry format:

```markdown
## [1.1.0] — 2026-06-16

### Added
- New skill: security-review (skills/security/security-review.md)
- Registry service discovery (skills/registry.json)

### Changed
- requirement-analyzer: added domain_hints optional input (MINOR)
- architecture-design: added metrics + feedback to output schema (MINOR)

### Fixed
- schema-validator: strict mode now rejects unknown properties (PATCH)
```

## Change Approval Process

| Version Bump | Requires |
|-------------|----------|
| PATCH | Quick review (single reviewer) |
| MINOR | Standard review + updated docs |
| MAJOR | Full review + stakeholder approval + migration plan |

## Version Compatibility

| System Version | Compatible Skill Versions | Notes |
|---------------|--------------------------|-------|
| 1.0.x | ^1.0.0 | Initial release |
| 1.1.x | ^1.0.0 (backward compatible) | Added skills, optional fields |
| 2.0.0 | ^2.0.0 | Breaking changes |

## Registry Version

The registry (`skills/registry.json`) has its own version. Rules:

- Any skill PATCH → registry PATCH
- Any skill MINOR → registry PATCH
- Any skill MAJOR → registry MINOR
- Registry schema change → registry MAJOR

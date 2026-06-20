---
name: versioning
version: "1.0.0"
description: 'Use when assigning, bumping, or deciding skill version numbers. Triggers on: "version this skill", "bump the version", "what version should this be", "semver", "MAJOR vs MINOR vs PATCH", "increment version", "skill versioning".'
---

# Versioning Governance

> Rules for version management across all skills and the registry.

## Version Scheme

All skills use **Semantic Versioning 2.0.0**: `MAJOR.MINOR.PATCH` (e.g., `1.3.2`).

| Bump | Trigger | Example |
|------|---------|---------|
| **MAJOR** | Breaking change to input or output schema; removal of a field; behavioral change that breaks downstream consumers | Adding a new required field, removing an enum value, changing output type |
| **MINOR** | New optional field in input or output; new capability; new step in execution logic | Adding an optional parameter, adding a new output field, adding a new optional step |
| **PATCH** | Bug fix; clarification in description; token optimization; non-functional improvement | Fixing a typo in the schema, improving step description, tightening constraints |

## Backward Compatibility Rules

| Change | Compatible? | Version Bump |
|--------|------------|--------------|
| Adding optional input field | Yes | MINOR |
| Adding required input field | No | MAJOR |
| Removing input field | No | MAJOR |
| Adding output field | Yes (downstream must ignore unknown fields) | MINOR |
| Removing output field | No | MAJOR |
| Changing field type | No | MAJOR |
| Adding enum value | Yes | MINOR |
| Removing enum value | No | MAJOR |
| Adding new step | Yes | MINOR |
| Changing step behavior | Depends | MINOR if additive, MAJOR if contract changes |
| Fixing schema constraint (tightening) | No | MAJOR |
| Fixing schema constraint (loosening) | Yes | PATCH |

## Registry Version Management

The registry (`registry.json`) has its own `version` field. When any skill version bumps:
- **MINOR/PATCH** of a skill → registry version gets a PATCH bump
- **MAJOR** of a skill → registry version gets a MINOR bump
- Structural change to registry schema → MAJOR bump of registry

## Deprecation Policy

1. A skill MAY be deprecated but MUST remain available for at least 2 MAJOR versions.
2. Deprecated skills MUST be marked with `"deprecated": true` and `"deprecation_message": "Use <replacement> instead"` in the registry.
3. The orchestrator MUST warn when invoking a deprecated skill but MUST NOT block execution.
4. After 2 MAJOR versions, a deprecated skill MAY be removed from the registry.

## Changelog Requirements

Every version bump MUST be documented:

```yaml
version: 1.2.0 → 1.3.0
date: 2026-06-16
changes:
  - type: added
    description: "New optional input field: `domain_hints`"
  - type: changed
    description: "Step 3 now classifies requirements into F/NF/C"
```

## Skill Dependency Version Constraints

Skills declare compatible versions in their `consumes_from` field:

```json
"consumes_from": ["requirement-analyzer@^1.0.0"]
```

Semver range operators: `^1.0.0` (compatible), `~1.0.0` (approximately), `>=1.0.0`, `1.x`.

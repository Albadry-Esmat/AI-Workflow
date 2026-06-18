---
name: validation-rules
description: 'Use ONLY when validating or enforcing rules on entries in skills/index.yaml. Triggers on: "validate index entry", "check index.yaml", "does this index entry conform", "index validation", "skill index rules".'
---

# Validation Rules — Skill Index

**Version:** 1.0.0 | **Last updated:** 2026-06-16

Human-readable enforcement rules for `skills/index.yaml`. The formal schema is at `skills/schema/skill-schema.yaml`.

---

## Required Field Rules

| Rule | Applies To | Fail Condition |
|------|-----------|----------------|
| R1 | `id` | Missing, duplicate, or not matching `SKL-NNN` pattern |
| R2 | `name` | Missing, exceeds 50 chars, or duplicate |
| R3 | `short_description` | Missing, exceeds 120 chars, or is a copy of `name` |
| R4 | `reference_path` | Missing, does not match `skills/knowledge/*.md`, or file does not exist on disk |
| R5 | `version` | Missing or not valid semver (`MAJOR.MINOR.PATCH`) |

## Reference Integrity Rules

| Rule | Applies To | Fail Condition |
|------|-----------|----------------|
| R6 | `reference_path` | File at path does not exist |
| R7 | `executable_skill` | If present, file at path does not exist |
| R8 | `depends_on` | References an `id` that does not exist in the same index |
| R9 | `reference_sections` | Section heading does not appear in the target reference file |

## Content Quality Rules

| Rule | Applies To | Fail Condition |
|------|-----------|----------------|
| R10 | `short_description` | Ends with a period, uses first-person, or is vague ("does stuff") |
| R11 | `tags` | Contains uppercase, spaces, or non-hyphenated multi-word tags |
| R12 | `mastery_level` | Value is not one of: `beginner`, `intermediate`, `advanced` |
| R13 | `reference_path` | Knowledge file does not contain all required sections (see below) |

## Knowledge File Structure Rules

Every file under `skills/knowledge/` MUST contain these sections (in order):

```
## Overview
## Purpose
## Principles
## Practices
## Anti-patterns
## Examples
## Related Skills
## Source References
```

Sections may be empty if genuinely not applicable, but must be present. Absent sections are a validation error.

## Index Structure Rules

| Rule | Condition |
|------|-----------|
| R14 | Entries must be listed in dependency order (dependencies before dependents) |
| R15 | Index must not contain duplicate entries for the same executable skill |
| R16 | Index `meta.version` must be bumped when any skill entry changes |

## Dependency Ordering

Skills with `depends_on: []` must appear before any skill that references them. The dependency graph must be acyclic — circular dependencies are a hard validation error.

**Valid order example:**
```
SKL-001 (no deps) → SKL-002 (deps: 001) → SKL-003 (deps: 001, 002) → ...
```

## Versioning Rules

| Change | Version Bump |
|--------|-------------|
| New `tags`, `use_when`, `do_not_use_when` added | PATCH |
| New `reference_sections`, `depends_on` added | MINOR |
| `id`, `name`, `reference_path`, or `executable_skill` changed | MAJOR |
| New skill entry added to index | MINOR bump to index `meta.version` |

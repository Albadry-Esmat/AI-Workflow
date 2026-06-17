# Validation Rules — Knowledge Reference

## Principles

- **Schema is the contract**: The `skills/schema/skill-schema.yaml` is the authoritative definition of what a valid index entry looks like. All validation is derived from it — human judgment does not override schema failures.
- **Validate at insertion, not at read**: Validation runs when a skill is being registered, not when it is being used. A skill that passes validation at registration time is trusted during execution.
- **Structural before semantic**: Check required fields and types first. Only proceed to semantic checks (e.g., `depends_on` references exist) after structural validation passes.
- **Errors are actionable**: A validation error message must tell the author exactly what is wrong and how to fix it — not just that it failed. Unhelpful error messages produce iteration loops.
- **All rules are enumerable**: There is a finite, documented list of validation rules. No "judgment call" rules. If a rule exists, it is in the list; if it is not in the list, it is not enforced.

## Rule Categories

### Structural Rules (schema-derived)
- Required fields present: `id`, `name`, `short_description`, `executable_skill`, `tags`, `version`, `depends_on`, `mastery_level`, `use_when`, `do_not_use_when`
- Field types correct: `id` matches `SKL-\d{3}`, `version` matches semver, `tags` is array
- No extra fields beyond schema definition

### Referential Integrity Rules
- `depends_on` IDs must exist in the registry at the time of insertion
- `executable_skill` path must be a valid `.opencode/skills/<name>/SKILL.md` path that exists
- `reference_path` must be a valid `skills/knowledge/<name>.md` path (warning if absent, not error)

### Content Rules
- `short_description` must be 5–120 characters
- `use_when` must be >= 20 characters
- `do_not_use_when` must be >= 20 characters
- `tags` must have at least 3 entries
- `mastery_level` must be one of: `beginner`, `intermediate`, `advanced`

### Uniqueness Rules
- `id` must be unique across all entries
- `name` must be unique across all entries (case-insensitive)

## Anti-patterns

- **Validation bypass**: Manually inserting index entries without running validation. The registry becomes inconsistent.
- **Warning as error**: Treating warnings (missing `reference_path`) as blocking errors. Warnings are noted but do not block registration.
- **Retroactive validation**: Re-validating all existing entries when the schema changes. Only validate entries at insertion time; do not break existing registered skills on schema evolution.
- **Silent validation**: Running validation without surfacing the results. All validation outcomes — pass or fail — are recorded in the skill's registration audit log.

## Source References

- JSON Schema validation specification (draft-07)
- OpenAPI 3.x schema validation patterns
- Registry integrity patterns in package management systems (npm, PyPI)

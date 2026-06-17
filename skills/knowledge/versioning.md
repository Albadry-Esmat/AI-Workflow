# Versioning — Knowledge Reference

## Principles

- **Semver is the law**: Every skill version follows `MAJOR.MINOR.PATCH`. The bump type is determined by the nature of the change — not by how significant the author thinks it is.
- **Breaking change = MAJOR**: Any change to a skill's input or output schema that is not backward-compatible is a MAJOR bump. There are no exceptions.
- **Registry version mirrors content version**: When any skill in the registry bumps to a new version, the registry's own version (`meta.version` in index.yaml and `version` in registry.json) also bumps. Registry and skill versions are independent counters.
- **Changelog entries are mandatory for MINOR+**: Every MINOR and MAJOR bump requires a changelog entry. PATCH bumps may be grouped.
- **Deprecation uses MINOR**: Marking a skill deprecated is a MINOR bump (not MAJOR) because it does not break existing consumers — it only adds a deprecation signal.

## Bump Decision Table

| Change Type | Bump | Reason |
|------------|------|--------|
| Remove or rename input/output field | MAJOR | Breaking — consumers will fail |
| Change field type (e.g., string → array) | MAJOR | Breaking — consumers will fail |
| Add required input field | MAJOR | Breaking — existing callers don't pass it |
| Remove optional field | MAJOR | Breaking — consumers may rely on it |
| Add optional input/output field | MINOR | Non-breaking — backward compatible |
| Add new execution step | MINOR | New capability, no contract change |
| Fix logic error without schema change | PATCH | No API change |
| Update documentation/descriptions | PATCH | No behavioral change |
| Deprecate skill | MINOR | Signal change, no contract break |
| Retire skill (remove from active) | MAJOR | Registry contract change |

## Consumer Impact Analysis

Before any MAJOR bump:

1. Find all skills in `depends_on` and `consumes_from` that reference this skill
2. For each consumer: identify which fields they consume
3. Determine if any consumed fields are changing
4. If yes: the consumer also needs a MINOR bump (new `consumes_from` version range)

## Anti-patterns

- **Version inflation**: Bumping MAJOR for every change to "be safe." Over-versioning creates unnecessary migration work for consumers.
- **PATCH for logic breaks**: Using PATCH for a change that alters execution behavior even if the schema didn't change. If behavior changes, it's at minimum MINOR.
- **Skipping registry version bump**: Updating a skill's version without bumping the registry version. The registry version must always reflect the latest skill change.
- **No changelog**: Merging a MINOR or MAJOR change without a changelog entry. Without changelog entries, downstream consumers can't assess migration risk.

## Source References

- Semantic Versioning Specification 2.0.0 (semver.org)
- npm package versioning best practices
- API versioning strategies (Stripe, Twilio public API docs)

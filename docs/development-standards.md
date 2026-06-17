# Development Standards — Coding & Architecture Rules

**Version:** 1.0.0 | **Last updated:** 2026-06-16

## Language & Environment

| Property | Standard |
|----------|----------|
| Primary language | TypeScript / Go |
| Package manager | npm / Go modules |
| Linting | ESLint (TS), golangci-lint (Go) |
| Formatting | Prettier (TS), gofmt (Go) |
| Testing | Jest (TS), go test (Go) |
| Schema validation | JSON Schema (draft-07) |

## Architecture Rules

1. **Separation of concerns**: Each skill owns one domain. No skill spans multiple domains.
2. **No circular dependencies**: Skill dependency graph must remain acyclic.
3. **Structured handoffs**: All inter-skill data uses typed JSON schemas. No free-form text.
4. **Stateless skills**: Skills receive all context via input. No global or shared state.
5. **Every output includes metrics**: `tokens_in`, `tokens_out`, `duration_ms`, `items_produced`, `version`.
6. **Feedback is explicit**: Skills emit `feedback` entries for upstream communication — do not modify upstream output directly.

## Skill Authoring Rules

- Every skill MUST conform to the [Skill Template](../skills/template/skill-template.md).
- Every skill MUST have a JSON Schema for input AND output.
- Input schema fields MUST use camelCase.
- Output schema MUST include `$defs.metrics` and `$defs.feedback_entry`.
- `id` fields MUST use the pattern `{PREFIX}-{DOMAIN}-{NNN}` (e.g., `REQ-USR-001`, `TASK-0042`).
- Complexity scores MUST use Fibonacci sequence (1, 2, 3, 5, 8, 13, 21).
- Severity MUST use: `critical`, `high`, `medium`, `low`, `info`.

## Code Quality Standards

| Metric | Threshold |
|--------|-----------|
| Cyclomatic complexity per function | ≤ 10 (medium strictness) |
| Max function lines | 40 |
| Max file lines | 500 |
| Test coverage (domain) | ≥ 95% |
| Test coverage (application) | ≥ 85% |
| Test coverage (infrastructure) | ≥ 75% |

## Documentation Sync Rules

| Change | Must Update |
|--------|-------------|
| New skill or skill modification | `docs/skills-registry.md` |
| New agent or agent modification | `docs/agents.md` |
| Pipeline sequence change | `docs/workflows.md` |
| Architecture change | `docs/architecture.md` |
| Schema change | Skill's own schema + `docs/skills-registry.md` |
| Version bump | `docs/versioning.md` + `docs/changelog.md` |

## Git Conventions

- Branch naming: `feature/<skill-name>-<description>` or `fix/<skill-name>-<description>`
- Commit messages: `type(scope): description` (e.g., `feat(requirement-analyzer): add domain hints input`)
- Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`
- PRs require: at least 1 reviewer, passing validation, updated docs

## File Naming

- Skills: `skills/<domain>/<hyphenated-name>.md`
- Docs: `docs/<hyphenated-name>.md`
- Config: `opencode.json`
- Registry: `skills/registry.json`

# Testing — Strategy & Coverage Rules

**Version:** 1.0.0 | **Last updated:** 2026-06-16

## Testing Philosophy

The system uses a risk-based testing strategy: higher-risk components (domain logic, security) require higher coverage. Testing is defined by the `testing-strategy` skill and enforced by quality gates at promotion time.

## Test Levels

| Level | Scope | Target Coverage | Responsibility |
|-------|-------|-----------------|----------------|
| **Unit** | Individual functions, classes, schemas | Domain ≥ 95%, App ≥ 85% | Developer |
| **Integration** | Skill input/output contracts, schema validation | ≥ 80% of integration points | Developer |
| **E2E** | Full pipeline execution (orchestrator → skills → output) | ≥ 60% of pipeline paths | QA / System |
| **Contract** | JSON Schema conformance, required fields, types | 100% of declared schemas | Automated |

## Test Types

| Type | What It Tests | Tooling |
|------|---------------|---------|
| Schema validation | Every skill output matches its JSON Schema | schema-validator skill |
| Input/output contract | Required fields, types, constraints | schema-validator skill |
| Pipeline execution | Orchestrator routes correctly, handles failures | Integration tests |
| Feedback loop | Backpropagation triggers correct re-execution | Integration tests |
| HITL gate | Gates pause/resume correctly | Integration tests |
| Token optimization | Compression rules produce correct output | Unit tests |
| Error handling | Failure scenarios produce correct fallback | Unit tests |

## Quality Gates

| Gate | Criteria | Blocks |
|------|----------|--------|
| Commit | Unit tests pass, lint passes, no schema violations | Commit |
| PR merge | All tests pass, coverage ≥ threshold, no critical issues | PR merge |
| Staging deploy | Integration + E2E pass, security scan clean, coverage met | Staging deploy |
| Production deploy | All gates passed, manual approval, rollback plan ready | Production deploy |

## Coverage Targets

| Module Layer | Unit | Integration | E2E |
|-------------|------|-------------|-----|
| Domain (core logic, schemas) | ≥ 95% | ≥ 85% | ≥ 70% |
| Application (orchestration, routing) | ≥ 85% | ≥ 80% | ≥ 60% |
| Infrastructure (registry, config) | ≥ 75% | ≥ 70% | ≥ 50% |
| Security (threat models, OWASP checks) | ≥ 90% | ≥ 85% | ≥ 75% |

## Edge Cases to Test

| Category | Examples |
|----------|----------|
| Empty/null input | Empty `raw_input`, null fields, missing optional fields |
| Boundary values | Max tokens, max items, min/max complexity |
| Invalid types | String where number expected, object where array expected |
| Schema violations | Missing required fields, unknown properties (strict mode) |
| Pipeline failures | Skill failure, validation failure, max retries exceeded |
| Feedback loops | Loop detection, max iteration enforcement, artifact invalidation |
| HITL timeouts | Gate timeout behavior, auto-continue, gate skip logging |
| Token budget | Session budget exceeded, compression rules, resume behavior |

## Testing Skill

The `testing-strategy` skill (`skills/testing/testing-strategy.md`) generates the test plan automatically from requirements, modules, and tasks. It outputs:

- Test cases with input/expected_output per module
- Edge cases with risk levels
- Coverage targets per module
- Quality gates with block criteria

## Testing Change Rules

- Changes to testing strategy require updating this file AND `changelog.md`.
- New test types must be added to the testing skill's execution logic.
- Coverage threshold changes require updating quality gates in deployment.

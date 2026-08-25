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
| **Certification evidence** | Runtime identity, staged checks, capability decisions, sanitization, and truthful promotion state | 100% of evidence records | Automated + independent review |

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
| Runtime certification | Fixture-only record cannot certify capabilities; pilot-certified record requires every staged check and independent review; prohibited sensitive fields and credential-like values are rejected |
| Runtime version watch | Version-only terminal checks enforce declared ranges in strict mode; host/editor targets require operator verification; no session or side effect is started |
| Release-status handoff | JSON output contains sanitized repository/live-gate states, reports operator blockers, and writes optional private reports with owner-only permissions |
| Release approval evidence | Fixture `no-go` records validate safely; `conditional-go` and `go` require assigned owners, passing reviews, non-fixture evidence, resolved blockers, and the correct decision scope |
| Adapter lifecycle | The canonical lifecycle manifest aligns with the registry and matrix; incomplete blocked/deprecated metadata, unsupported successors, contradictory claims, and sensitive fields are rejected |

## Testing Skill

The `testing-strategy` skill (`skills/testing/testing-strategy.md`) generates the test plan automatically from requirements, modules, and tasks. It outputs:

- Test cases with input/expected_output per module
- Edge cases with risk levels
- Coverage targets per module
- Quality gates with block criteria

## Runtime-certification evidence tests

The fixture at `tests/fixtures/runtime-certification.json` is deliberately repository-fixture-only and blocked for live promotion.
 Validate it with `aiw validate-runtime-certification`. The validator must also be exercised against negative fixtures or isolated temporary repositories for missing changelog/documentation, unregistered runtimes, duplicate checks, incomplete staged evidence, invalid capability decisions, unsupported promotion states, and credential-like content. `runtime-version-watch` must be tested with a temporary version-only fixture and a host/editor strict-mode block. `validate-adapter-lifecycle` must pass the canonical manifest and reject an isolated manifest that marks an adapter deprecated without a reason, effective date, migration guidance, and successor or explicit limitation. `release-status` must be tested for JSON parsing, sanitized output, dirty/clean-state reporting, blocker mapping, lifecycle-check reporting, and owner-only output-file permissions. `validate-release-approval` must be tested with the repository-fixture no-go record and isolated negative records for fixture-backed `go`, open P0/P1 blockers, pending owners, failed documentation gates, and incomplete review. A fixture or fake executable can validate control flow but never proves a real runtime.

## Testing Change Rules

- Changes to testing strategy require updating this file AND `changelog.md`.
- Changes to runtime-certification or adapter-lifecycle schemas and validators require updating this file, the compatibility guide, the developer adapter guide, the operator runbook, and `changelog.md`.
- New test types must be added to the testing skill's execution logic.
- Coverage threshold changes require updating quality gates in deployment.

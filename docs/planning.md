# Planning and Dry Runs

`aiw plan` compiles a pipeline configuration into a deterministic execution manifest without invoking OpenCode, loading secrets, writing session state, making network calls, creating pull requests, or deploying anything.

## Usage

```bash
# Plan the documented default pipeline
aiw plan "build a customer portal"

# Plan a named pipeline
aiw plan "extract requirements" --pipeline requirements-only

# Emit a machine-readable manifest
aiw plan "review the release" --pipeline pre-deploy --json

# Explicitly communicate that the operation is a dry run
aiw plan "review the release" --pipeline pre-deploy --dry-run
```

The command is also available through npm:

```bash
npm run plan -- "review the release" --pipeline pre-deploy --json
```

## Manifest contents

The JSON manifest contains the selected pipeline, request, route mode, phase and step summary, every skill step, agent ownership, model and permission metadata, retry and validation settings, gates, and the current side-effect policy state. The generated `skills/capability-index.json` provides the catalog-wide companion view: it classifies every skill as runtime-registry, agent-owned, pipeline-routed, event-or-utility, or catalog-only and records its owners, pipelines, dependencies, maturity, and risk tier.

Because side-effect declarations are not yet present for every skill, the planner reports those dimensions as `undeclared` rather than assuming that a step is safe. This is intentional. The planner exposes the gap and never converts an undeclared action into permission to execute it.

| Manifest section | Meaning |
|---|---|
| `pipeline` | Pipeline name, version, description, domain, mode, and source file. |
| `summary` | Phase, step, parallel, async, gate, and warning counts. |
| `phases` | Ordered phases and skill steps, including owner agents and execution settings. |
| `gates` | Human, validation, and condition gates with timeout behavior. |
| `policies` | Planner guarantees: no writes, network calls, secret loading, or external actions. |
| `warnings` | Ambiguous routing, implicit ownership, conditional phases, or undeclared policy fields. |

## Safety contract

The planner is intentionally a compiler and reporter, not an executor. Its implementation must remain side-effect free. Any future feature that turns a plan into execution must be a separate command and must consume the manifest only after policy validation and required human approvals.

## Planned extensions

Run `npm run validate:capabilities` to verify that the capability index is fresh and conforms to its schema.

The manifest is the foundation for future phases. The first companion capability index is now generated at `skills/capability-index.json` and checked by `npm run validate:capabilities`.

1. Add deterministic side-effect policy enforcement before execution.
2. Add behavioral evaluation fixtures and release-readiness evidence.
3. Add provenance fields to artifacts and cross-repository publication.
4. Add evaluation-backed adaptive proposals and routing-quality metrics.

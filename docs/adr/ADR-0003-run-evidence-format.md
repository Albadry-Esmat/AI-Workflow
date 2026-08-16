# ADR-0003: Run Evidence Format and Storage

**Status:** Accepted for Batch 0 planning; schemas and producers are Batch 3 work  
**Date:** 2026-08-16  
**Owners:** Runtime and Architecture

## Decision

The first execution-evidence implementation will be **local-first, file-based, versioned JSON**. It will not require a remote database or telemetry backend.

The evidence model will use these objects:

- `RunManifest` — immutable run identity and execution policy.
- `StepExecution` — one record per agent/skill/tool step.
- `ArtifactRef` — content-addressed references to inputs and outputs.
- `GateDecision` — human or policy approval evidence.
- `PolicyDecision` — authorization outcome and reason.

Each object must include an explicit schema version, stable IDs, timestamps, source commit, producer/version information where applicable, and sensitivity classification. Large or sensitive payloads are referenced by hash or local artifact path rather than copied into every record.

## Storage rules

1. A run writes to a run-scoped directory under the configured local state/artifact root.
2. A terminal record is written for success, failure, cancellation, or budget exhaustion.
3. Evidence is append-only during a run; corrections are represented by new records or explicit invalidation fields.
4. Replay consumes a recorded run in read-only/mock-tool mode and must report external dependencies it cannot reproduce.
5. Export or external telemetry is deferred until privacy and retention policy are implemented.

## Compatibility policy

Schema changes require a version increment and one of:

- backward-compatible additive change with fixtures proving old readers still work;
- migration script and documented cutover; or
- explicit breaking-change approval and a new evidence directory format.

## Consequences

The file-based approach is easy to inspect, test, back up, and use in CI, while avoiding premature infrastructure. It is not a final high-scale storage design. Batch 8 may add standardized telemetry and longer-term storage only after the evidence model is proven useful.

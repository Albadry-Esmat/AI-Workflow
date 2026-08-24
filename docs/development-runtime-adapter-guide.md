# Runtime Adapter Developer Guide — Canonical Integration Contract

**Version:** 1.0.0
**Last updated:** 2026-08-24
**Audience:** Contributors implementing or reviewing an AI agent runtime adapter

## Design principle

An adapter is a translation and supervision boundary, not a second workflow engine. The canonical AI Workflow core owns pipeline semantics, MCP permissions, budgets, approvals, state, checkpoints, rollback, idempotency, artifact quality, and sanitized evidence. The adapter owns only runtime discovery, native request translation, process or host integration, event translation, and explicit capability limitations.

The core must never import vendor SDKs. A runtime-specific adapter communicates with the core through the versioned contracts under `.ai-workflow/schemas/` and the shared libraries under `scripts/lib/`.

## Adapter directory layout

```text
adapters/<adapter-id>/
└── index.js                 # descriptor and contract implementation

.ai-workflow/
├── adapter-registry.json    # canonical adapter registration
├── runtime-capability-matrix.json
├── config.json
└── schemas/
    ├── runtime-adapter.schema.json
    ├── runtime-request.schema.json
    ├── runtime-event.schema.json
    ├── approval-request.schema.json
    ├── checkpoint.schema.json
    ├── artifact-envelope.schema.json
    └── runtime-certification.schema.json
```

The adapter ID must be lowercase, stable, and independent of a user’s local executable alias. Do not encode credentials, installation paths, machine names, or user identity in the descriptor.

## Required descriptor information

Every adapter declares its runtime family, implementation status, compatibility tier, version range, entrypoint, native configuration surfaces, lifecycle operations, capabilities, event source, approval model, checkpoint model, artifact model, and known limitations. Use `experimental` or `fixture-certified` until real runtime evidence exists. Never use `pilot-certified` or `supported` based only on local fixture tests.

A descriptor must distinguish the following states:

| State | Meaning |
|---|---|
| `supported` | The specific version and capability set passed real certification and independent review. |
| `experimental` | Repository implementation exists, but real runtime evidence is incomplete. |
| `degraded` | Only a declared subset, such as read-only or artifact exchange, is safe. |
| `blocked` | A prerequisite or safety boundary prevents execution. |
| `deprecated` | The adapter must not be selected for new runs. |

## Adapter operations

Implement or explicitly reject these normalized operations:

| Operation | Required behavior |
|---|---|
| `discover` | Return runtime name, version, invocation mode, capabilities, configuration surfaces, and lifecycle availability without secrets. |
| `preflight` | Check executable or host integration, version range, required files, safe permissions, and authentication presence without exposing values. |
| `start_session` | Create a correlation ID and bind pipeline, project classification, MCP profile, budget, and dry-run mode. |
| `send_step` | Submit one bounded normalized task with declared inputs and capabilities only. |
| `read_events` | Return canonical sanitized lifecycle events. Unknown output is diagnostic, not success. |
| `request_approval` | Pause before HITL or side-effect operations and return a typed approval request. |
| `checkpoint` | Persist resumable metadata only; never raw prompts, MCP payloads, secrets, or unbounded context. |
| `cancel` | Stop safely and emit a cancellation or typed failure event. |
| `resume` | Resume only from an integrity-verified, compatible checkpoint. |
| `collect_artifacts` | Return named artifacts with checksums, classification, schema, quality result, and provenance. |
| `close_session` | Return final status, budget summary, circuit state, artifact summary, and error category. |

If the runtime cannot support an operation, return a typed unsupported result and lower the tier or force wrapper-required mode. Do not silently emulate a success.

## Safety implementation rules

All runtime requests pass through the central capability and budget guards. A write or deployment capability requires the correct MCP profile, explicit approval, canary plan, budget allowance, deterministic idempotency key, and post-operation reconciliation. A host adapter that cannot block before a side effect must not expose that capability as native support.

Subprocess adapters must bound the working directory, environment, stdout/stderr size, execution duration, retry count, and cancellation behavior. Host adapters must identify which lifecycle events are observable and which remain operator-confirmed. Neither adapter type may write outside an explicitly approved target or silently overwrite user-owned configuration.

## Testing ladder

Implement tests in this order:

1. Validate the descriptor and registry/matrix alignment.
2. Validate normalized request, approval, event, checkpoint, and artifact contracts.
3. Prove read-only and dry-run behavior without invoking a vendor runtime.
4. Prove unauthorized capability, missing approval, budget exhaustion, circuit-open, malformed output, timeout, cancellation, duplicate write, ambiguous outcome, and corrupt checkpoint behavior.
5. Verify read-only runtime discovery and filesystem-backed event/artifact operations do not raise uncaught reference errors. Host/editor discovery must remain operator-verification-only.

6. Run the aggregate fixture certification command:

```bash
aiw validate-adapters
aiw certify-adapters
```

7. Generate projections twice and compare manifests:

```bash
aiw generate-projections --output /tmp/aiw-projections-a --profile pilot-read-only
aiw generate-projections --output /tmp/aiw-projections-b --profile pilot-read-only
cmp /tmp/aiw-projections-a/manifest.json /tmp/aiw-projections-b/manifest.json
```

8. Perform real version preflight, MCP verification, constrained smoke, approval stop, canary, recovery, artifact review, and controlled pilot only on a disposable or non-sensitive project.

## Evidence requirements

Certification evidence must include only runtime version, adapter version, tier, test commit, profile, budget policy version, status, failure category, reviewer, and timestamps. It must exclude credentials, raw prompts, raw MCP payloads, session transcripts, authorization headers, personal data, and unbounded model output.

Use `.ai-workflow/schemas/runtime-certification.schema.json` and `aiw validate-runtime-certification` for the staged evidence record. The record must separate repository fixtures from operator-verified and pilot-certified evidence, list each certification check, and record capability-level decisions. `pilot-certified` is valid only when version preflight, MCP profile, read-only smoke, approval stop, canary, recovery, artifact review, and independent review all pass on a non-fixture environment.

Keep fixture evidence and real-runtime evidence in separate records. A temporary fake executable can test CLI control flow but cannot certify a runtime. Promotion is capability-specific: a runtime may be certified for read-only artifact generation while remaining blocked for external writes or deployment.

## Pull request checklist

Before requesting review, confirm that the adapter has a registry entry, capability matrix entry, compatibility version, descriptor tests, negative safety tests, deterministic projection support, documentation, and changelog entry. Run the full repository checks and synchronize the website mirror after authoritative documentation or configuration changes:

```bash
aiw validate
aiw validate-adapters
aiw certify-adapters
aiw validate-runtime-certification tests/fixtures/runtime-certification.json
aiw runtime-watch
aiw website-check
aiw sync --check
npm test -- --runInBand
```

## Review standard

Reject an adapter that claims support from prompt acceptance, MCP connectivity, or a single successful file edit. The review must establish where policy is enforced, how writes are stopped, how events are normalized, how checkpoints are verified, how duplicate or ambiguous external outcomes are reconciled, and what happens when the runtime disappears or changes version.

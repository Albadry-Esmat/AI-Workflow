# Execution Contracts

**Contract family:** `ai-workflow-execution`
**Family version:** `1.0.0`
**Status:** Experimental; introduced in Batch 3

Execution contracts provide stable, metadata-only records for pipeline runs, step executions, artifacts, gate decisions, and policy decisions. They are designed to make later runtime instrumentation, replay, evaluation, and release gates possible without embedding raw user content, source code, prompts, credentials, or unrestricted tool output in durable evidence.

## Contract inventory

| Contract | Identifier | Purpose | Version |
|---|---|---|---|
| Run manifest | `RUN-xxxxxxxxxxxx` | Defines one run’s identity, lifecycle, linked steps, artifacts, gates, and policies | `1.0.0` |
| Step execution | `STEP-xxxxxxxxxxxx` | Records one skill or pipeline step outcome and metric summary | `1.0.0` |
| Artifact reference | `ART-xxxxxxxxxxxx` | References content-addressed evidence stored outside execution records | `1.0.0` |
| Gate decision | `GATE-xxxxxxxxxxxx` | Records approval, rejection, modification, timeout, or pending state | `1.0.0` |
| Policy decision | `POL-xxxxxxxxxxxx` | Records authorization outcome for an action and resource | `1.0.0` |

## Invariants

Every record declares `contract_type` and `contract_version`. Unknown contract types or versions are rejected. Identifiers are scoped by record type and are intentionally opaque. Cross-record references must use identifiers rather than embedding large payloads.

Every run and step record must set `pii_scrubbed: true`. Artifact references classify data, state whether PII is present, define a retention class, and include a SHA-256 digest. Gate decisions reference evidence and policy decisions. High-risk and irreversible actions cannot be represented as silently approved: they require a human decision and an associated gate or policy record.

## Versioning policy

Major versions are breaking changes and require a migration plan. Minor versions may add backward-compatible optional fields. Patch versions are limited to clarifications and non-semantic corrections. Consumers must reject unknown major versions and unknown contract types rather than guessing.

## Storage and privacy boundary

The contracts contain metadata and references only. Raw prompts, source code, credentials, unrestricted tool output, and PII must be stored outside these records or excluded entirely. Artifact storage and retention enforcement are later runtime concerns; Batch 3 establishes the contract boundary but does not implement the persistence engine.

## Validation

Run the contract suite from the project root:

```bash
python3 scripts/validate-execution-contracts.py
```

The suite validates every positive fixture, requires every negative fixture to fail, checks contract-index/schema version alignment, and verifies cross-contract references for the canonical run.

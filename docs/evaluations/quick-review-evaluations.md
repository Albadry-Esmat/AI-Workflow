# Quick-Review Evaluation Suite

**Suite version:** `1.0.0`

**Batch:** 5 — Evaluation and Mock Replay

**Pipeline:** `quick-review`

## Purpose

This suite measures the bounded local quick-review adapter introduced in Batch 4. It does not claim to evaluate an external LLM or replace the declarative OpenCode orchestrator. The suite provides a reproducible baseline for the local evidence path until an executable runtime is connected to the Batch 3 contracts.

> The evaluation suite is a regression boundary, not a proof that an AI-generated review is semantically correct.

## Corpus

The corpus contains **15 cases**: ten golden cases and five adversarial cases. Golden cases cover four disposable fixture classes—web, API, data, and infrastructure. Adversarial cases exercise malformed output, tool failure, retry exhaustion, high-confidence secret detection, and attempted external-write policy denial.

| Class | Cases | Expected purpose |
|---|---:|---|
| Golden | 10 | Confirm successful read-only execution across the four fixture types |
| Adversarial | 5 | Confirm fail-closed behavior, causal failure reporting, and policy rejection |
| Total | 15 | Establish the Batch 5 baseline |

The case definitions live under `evals/quick-review/cases/`. The disposable fixture files live under `evals/quick-review/fixtures/`. Saved read-only tool-response traces live under `evals/quick-review/replays/`.

## Case contract

Each case declares its case version, evaluation class, pipeline, fixture, scenario, execution mode, task, policy profile, allowed tools, sensitivity class, expected result, and grader set. The machine-readable contract is `config/evaluation-case-schema.json`; it rejects unknown fields and requires the expected step statuses and no-external-write invariant.

Run the definition-only validator with:

```bash
make validate-evals
```

## Graders

The evaluator applies five deterministic graders to every case:

| Grader | Question |
|---|---|
| Structure | Are the run, step, artifact, policy, gate, and terminal-summary records present and valid against Batch 3 schemas? |
| Behavior | Does the final status, gate decision, first failure, and step-status map match the case expectation? |
| Security | Are PII/redaction invariants preserved, are high-confidence credential values absent from evidence, and are irreversible actions excluded? |
| Traceability | Do manifest identifiers and artifact digests map exactly to the generated evidence files? |
| Replay safety | Did the target fixture remain unchanged, and did the replay consume only saved responses? |

A case passes only when every required grader passes. A suite passes only when all 15 cases pass. Adversarial cases are successful evaluations when the system rejects the unsafe or failed condition as expected.

## Running the suite

Run the complete evaluation suite with:

```bash
make eval-quick-review
```

The evaluator creates temporary Git repositories for live cases, invokes only the local deterministic adapter, removes temporary state when complete, and writes the report to `evals/quick-review/reports/evaluation-report.json` unless `OUTPUT_ROOT` is supplied. Replay cases read only their committed JSON traces and do not invoke external tools or write to target projects.

The standard CLI equivalents are:

```bash
aiw validate-evals
aiw eval-quick-review
```

## Baseline and limitations

The Batch 5 baseline is expected to be 15/15 cases passing, with ten golden and five adversarial cases accepted. The baseline measures evidence structure, lifecycle behavior, read-only safety, and traceability. It does not measure semantic review quality, human grader agreement, model selection, token cost, latency under real LLM execution, or distributed telemetry.

Those limitations are deliberate. Semantic graders, human calibration, replay of real model responses, budget enforcement, and broader runtime instrumentation belong to later batches. A future runtime integration must preserve this suite and add live-runtime cases rather than silently changing the meaning of the baseline.

## Rollback

Batch 5 can be disabled by reverting the Batch 5 commit. Evaluation definitions are additive and do not modify production branches or external systems. Temporary evaluator output can be removed with:

```bash
rm -rf evals/quick-review/reports
```

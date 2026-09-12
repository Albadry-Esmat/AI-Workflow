# Quick-Review Evaluation Suite

**Suite version:** `1.1.0`

**Batch:** 5–6 — Evaluation, Budgets, Retries, and Capability Policy

**Pipeline:** `quick-review`

## Purpose

This suite measures the bounded local quick-review adapter introduced in Batch 4 and extended with explicit controls in Batch 6. It does not claim to evaluate an external LLM or replace the declarative OpenCode orchestrator. The suite provides a reproducible baseline for the local evidence path until an executable runtime is connected to the versioned execution contracts.

> The evaluation suite is a regression boundary, not a proof that an AI-generated review is semantically correct.

## Corpus

The corpus contains **20 cases**: ten golden cases and ten adversarial cases. Golden cases cover four disposable fixture classes—web, API, data, and infrastructure. Adversarial cases exercise malformed output, tool failure, retry exhaustion, high-confidence secret detection, attempted external-write policy denial, budget overrun, capability denial, cancellation, approval-required deployment, and retry-taxonomy preservation.

| Class | Cases | Expected purpose |
|---|---:|---|
| Golden | 10 | Confirm successful read-only execution across the four fixture types |
| Adversarial | 10 | Confirm fail-closed behavior, causal failure reporting, bounded budgets, retry classification, cancellation, and policy rejection |
| Total | 20 | Establish the Batch 6 control baseline |

The case definitions live under `evals/quick-review/cases/`. The disposable fixture files live under `evals/quick-review/fixtures/`. Saved read-only tool-response traces live under `evals/quick-review/replays/`.

## Case contract

Each case declares its case version, evaluation class, pipeline, fixture, scenario, execution mode, task, policy profile, allowed tools, sensitivity class, expected result, budget outcome, retry reason codes, policy decision, enforcement boundary, and grader set. The machine-readable contract is `config/evaluation-case-schema.json`; it rejects unknown fields and requires the expected step statuses and no-external-write invariant.

Run definition-only validation with:

```bash
make validate-evals
```

Validate the Batch 6 control profiles and upgraded execution fixtures with:

```bash
make validate-batch6
```

## Controls and graders

The adapter loads `config/budgets/quick-review-v1.json`, `config/retry-reasons.json`, and `config/policies/quick-review-read-only-v2.json`. The local boundary allows the declared read-only path, defaults to deny, requires policy evidence for write/delete/commit/push/deploy/publish/credential actions, and records when a high-impact action requires approval. It does not claim to enforce capabilities outside this wrapper; those capabilities remain denied or disabled.

The evaluator applies eight deterministic graders to every case:

| Grader | Question |
|---|---|
| Structure | Are the run, step, artifact, policy, gate, and terminal-summary records present and valid against the versioned contracts? |
| Behavior | Does the final status, gate decision, first failure, and step-status map match the case expectation? |
| Security | Are PII/redaction invariants preserved, are high-confidence credential values absent from evidence, and are irreversible actions excluded? |
| Traceability | Do manifest identifiers, policy references, and artifact digests map exactly to the generated evidence files? |
| Replay safety | Did the target fixture remain unchanged, and did replay consume only saved responses? |
| Budget | Do run and step consumption records match the expected within-budget, exhausted, or cancelled outcome and dimension? |
| Retry | Do retry reason codes and terminal exhaustion semantics match the controlled taxonomy? |
| Policy | Does the policy decision, approval requirement, and actual enforcement boundary match the case expectation? |

A case passes only when every required grader passes. A suite passes only when all 20 cases pass. Adversarial cases are successful evaluations when the system rejects the unsafe, over-budget, cancelled, or failed condition as expected.

## Running the suite

Run the complete evaluation suite with:

```bash
make eval-quick-review
```

The evaluator creates temporary Git repositories for live cases, invokes only the local deterministic adapter, removes temporary state when complete, and writes the report to `evals/quick-review/reports/evaluation-report.json` unless `OUTPUT_ROOT` is supplied. Replay cases read only their committed JSON traces and do not invoke external tools or write to target projects.

The standard CLI equivalents are:

```bash
aiw validate-batch6
aiw validate-evals
aiw eval-quick-review
```

## Baseline and limitations

The Batch 6 baseline is expected to be **20/20 cases passing**, with ten golden and ten adversarial cases accepted. The baseline measures evidence structure, lifecycle behavior, read-only safety, bounded budget accounting, retry taxonomy, policy decisions, cancellation, and traceability. It does not measure semantic review quality, human grader agreement, model selection, token cost under a real LLM, latency under real LLM execution, distributed telemetry, or authorization outside the local adapter boundary.

The deterministic adapter uses zero token and spend consumption because it does not invoke an LLM. A future runtime integration must provide real token/spend accounting and preserve the same fail-closed behavior. Prompt text is not an authorization mechanism. High-impact actions must remain disabled or require an enforceable wrapper/gateway and explicit approval.

Those limitations are deliberate. Semantic graders, human calibration, real-model replay, broader runtime instrumentation, and distributed capability brokering belong to later batches. A future runtime integration must preserve this suite and add live-runtime cases rather than silently changing the meaning of the baseline.

## Rollback

Batch 6 can be disabled by reverting its implementation commits. The control profiles and evaluation definitions are additive and do not modify production branches or external systems. Temporary evaluator output can be removed with:

```bash
rm -rf evals/quick-review/reports
```

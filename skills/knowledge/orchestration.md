# Orchestration — Knowledge Reference

**Skill ID:** SKL-010
**Version:** 1.0.0 | **Last updated:** 2026-06-16
**Mastery Level:** advanced
**Executable Skill:** [orchestrator](../orchestrator/orchestrator.md)
**Primary Source:** *Designing Distributed Systems* — Brendan Burns (2018); *Enterprise Integration Patterns* — Hohpe & Woolf (2003)

---

## Overview

Orchestration is the coordination layer that drives a multi-step pipeline to completion. The orchestrator owns execution order, error recovery, schema validation between steps, feedback loop propagation, and human-in-the-loop gate enforcement. Unlike choreography (where services react to events independently), orchestration uses a single controller that explicitly defines the flow — making the pipeline visible, debuggable, and auditable.

---

## Purpose

Apply this skill to:

- Execute a defined sequence of skills with explicit routing logic
- Enforce schema validation between every pipeline step
- Handle retries, partial failures, and feedback-driven re-execution
- Enforce HITL gates at critical decision points

---

## Principles

### P1 — Orchestration vs Choreography *(Designing Distributed Systems, Burns — Ch 4)*

| Model | How it works | Best for |
|-------|-------------|---------|
| Orchestration | Central coordinator controls the flow | Complex multi-step pipelines with branching and human gates |
| Choreography | Services react to events independently | High-throughput event-driven systems with simple flows |

**Rule:** Use orchestration when the pipeline has dependencies, gates, retries, and explicit ordering requirements — which this system does.

### P2 — Idempotent Steps *(Enterprise Integration Patterns, Hohpe & Woolf — Ch 10)*

Every skill invocation must be idempotent — invoking a skill twice with the same input must produce the same output. This enables safe retries without side effects.

**Rules:**
- Skills must not produce different results on retry (no random IDs, no timestamps in output without input)
- If a skill produces side effects (writes to disk), those side effects must be idempotent too
- Session context tracks completed steps to prevent re-execution of already-succeeded steps

### P3 — Circuit Breaker for Failing Skills *(Release It!, Nygard — Ch 5)*

A skill that repeatedly fails should be stopped before it consumes all retry budget. The orchestrator must detect the pattern and halt rather than wasting tokens on a failing operation.

**Rules:**
- After `max_retries` consecutive failures, halt the pipeline and return partial results
- Report the failed step, the error, and all steps that completed successfully
- Do not attempt downstream steps if their required inputs failed to be produced

---

## Practices

| Practice | Description |
|----------|-------------|
| Resolve registry before execution | Validate all skill names, versions, and dependencies exist before starting |
| Compress inputs between steps | Strip non-essential fields from each skill's output before passing to the next |
| Validate after every step | schema-validator runs after every skill — do not skip validation to save tokens |
| Serialize session context | Pipeline state must be serializable — support pause, resume, and restart |
| HITL gates are append-only | Gate decisions are logged once and never modified — they form the audit trail |

---

## Anti-patterns

### AP1 — Fire and Forget

**What:** Invoking skills without validating their output before passing it downstream.
**Why harmful:** Corrupt or incomplete output propagates silently; the failure manifests far from its cause.
**How to fix:** Schema validation is mandatory after every step — no skip_validation in production.

### AP2 — Unlimited Retries

**What:** Retrying a failing skill indefinitely without a circuit breaker.
**Why harmful:** Token budget exhausted; pipeline hangs; downstream steps never run.
**How to fix:** Hard retry limit (5); halt on max retries; report partial results.

### AP3 — Bypass HITL Gate

**What:** Auto-continuing through HITL gates without waiting for human approval.
**Why harmful:** The system makes decisions that require human judgment autonomously — governance failure.
**How to fix:** Gates that require human approval (`human_approval` type) must pause and wait. Auto-continue only on `validation_check` and `condition` gate types.

---

## Examples

### ✅ Correct — Sequential Pipeline with Validation

```
Resolve registry →
  invoke requirement-analyzer →
    validate output →
      invoke architecture-design →
        validate output →
          [HITL gate: architecture approval] →
            invoke feature-planning → ...
```

### ❌ Incorrect — Unvalidated Pipeline

```
invoke requirement-analyzer →
  pass output directly to architecture-design →
    pass output directly to feature-planning →
      (validation error surfaces in feature-planning with no useful context)
```

---

### ✅ Correct — Feedback Loop with Termination

```yaml
feedback_loop_count: 2
max_feedback_loops: 3
# Skill emits backpropagate → orchestrator re-invokes target
# If loop_count reaches max → force-terminate, continue with current state
```

### ❌ Incorrect — Infinite Feedback Loop

```yaml
# No max_feedback_loops defined
# architecture-design and clean-code-review keep backpropagating to each other
# Pipeline never terminates
```

---

## Related Skills

| Skill | ID | Relationship |
|-------|----|-------------|
| Schema Validation | SKL-009 | Called by orchestrator after every skill step |
| All pipeline skills | SKL-001–008 | Orchestrator drives all of them |
| Documentation Maintenance | SKL-011 | Orchestrator triggers doc-maintainer after pipeline completes |

---

## Source References

| Source | Chapter / Section | Linked Content |
|--------|------------------|----------------|
| *Designing Distributed Systems* — Burns | Ch 4: Serving Patterns | P1 |
| *Enterprise Integration Patterns* — Hohpe & Woolf | Ch 10: Message Endpoints | P2 |
| *Release It!* — Michael Nygard | Ch 5: Stability Patterns | P3 |
| *Building Microservices* — Sam Newman | Ch 4: Integration | P1 |

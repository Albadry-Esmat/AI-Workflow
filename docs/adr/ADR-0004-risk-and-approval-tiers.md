# ADR-0004: Risk and Approval Tiers

**Status:** Accepted for Batch 0 planning; runtime enforcement begins in Batch 6  
**Date:** 2026-08-16  
**Owners:** Security, Product, and Runtime

## Decision

AI-Workflow will classify actions by potential impact. Risk classification applies to the action and resource, not merely to the agent that proposes it.

| Tier | Examples | Default behavior | Minimum evidence |
|---|---|---|---|
| Low | Read project files within the approved project root; parse local metadata | Allow within scope | Resource scope and trace record |
| Medium | Create or modify files; run local validation; generate artifacts | Ask or policy-approved | Diff/path, actor, policy decision, validation result |
| High | Delete files; reset state; commit; push; change CI or permissions | Explicit approval | Confirmation, diff, validation, rollback reference |
| Critical | Deploy, publish, change credentials, change authorization, irreversible external action | Mandatory human approval; deny by default if no enforceable boundary | Release/evidence manifest, security review, approval actor, rollback plan |

## Rules

1. LLM output is a proposal; policy code or an explicit human decision authorizes the action.
2. A high or critical action may not be authorized by prompt wording alone.
3. Every denied, approved, expired, or escalated decision must be recorded once the Batch 3 evidence model exists.
4. Every run must have maximum step, retry, tool-call, elapsed-time, and token/spend budgets once Batch 6 is implemented.
5. If a runtime integration cannot enforce a policy boundary, the capability remains disabled or restricted until an enforceable wrapper/gateway exists.
6. Approval is specific to the resource and action; broad session approval is not assumed.

## Consequences

The model preserves productive read-only and local development workflows while reserving irreversible operations for explicit review. It may introduce approval friction, so later batches may propose low-risk auto-approval only when evaluation and audit evidence demonstrate that it is safe.

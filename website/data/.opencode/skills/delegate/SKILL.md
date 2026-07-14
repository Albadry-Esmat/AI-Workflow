---
name: delegate
version: 1.0.0
domain: orchestration
description: 'Formally delegates a scoped sub-task to a named agent with clear success criteria and a handback protocol. Triggers on: "delegate this to", "hand off to", "ask the reviewer to", "sub-task for", "delegate task".'
author: system
---

## Purpose

The delegate skill provides a formal protocol for intra-pipeline task delegation. When a skill or agent encounters a sub-task that falls outside its domain — but doesn't warrant a full pipeline phase — it delegates to a specific agent with scoped context, bounded turns, and explicit success criteria. This prevents ad-hoc tool sprawl and ensures every delegation is auditable.

## When to Use

- A builder needs a quick security micro-review of a single module
- A planner needs impact analysis on one specific dependency before proceeding
- An architect needs a database schema validation before finalizing the design
- A reviewer needs test generation for a flagged code path
- Any agent needs a focused sub-task completed by another specialist

## When NOT to Use

- The sub-task maps to a full pipeline phase (use the orchestrator instead)
- The delegation would create depth > 1 (delegates must NOT re-delegate)
- The task can be solved by invoking an existing skill directly (prefer skill invocation)
- The context required exceeds what can be scoped narrowly

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `task` | `string` | Yes | Clear, specific description of what the delegate should accomplish |
| `target_agent` | `string` | Yes | Agent ID to delegate to (e.g. `reviewer`, `builder`, `tester`, `architect`) |
| `context` | `object` | No | Scoped context: file paths, state slices, constraints. Must be minimal. |
| `context.files` | `string[]` | No | Specific file paths the delegate should examine |
| `context.state_keys` | `string[]` | No | State keys from session context the delegate needs |
| `context.constraints` | `string[]` | No | Hard constraints the delegate must respect |
| `success_criteria` | `string[]` | Yes | Concrete, verifiable conditions for "done" |
| `max_turns` | `integer` | No | Maximum interaction turns before escalation. Default: `5`. Max: `10`. |
| `fallback_action` | `string` | No | Action on failure: `"escalate"` (default), `"skip"`, `"retry"` |
| `return_format` | `string` | No | Expected response shape: `"text"` (default), `"json"`, `"artifact"` |
| `priority` | `string` | No | Delegation priority: `"blocking"` (default), `"non-blocking"` |

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `result` | `object` | The delegate agent's structured response |
| `success` | `boolean` | Whether ALL success_criteria were met |
| `turns_used` | `integer` | How many turns the delegate consumed |
| `escalation` | `object\|null` | Present only if `success: false` — contains `reason` and `partial_result` |
| `audit_entry` | `object` | Log entry: `delegator`, `target_agent`, `task_hash`, `timestamp`, `duration_ms`, `success` |

## Protocol

### 1. Pre-Delegation Validation

Before delegating, the caller MUST verify:
- [ ] The task is scoped to a single, specific sub-problem
- [ ] The target agent exists and is appropriate for this task type
- [ ] Success criteria are concrete and verifiable (not vague)
- [ ] Context is minimal — only what the delegate needs
- [ ] No circular delegation would result

### 2. Execution

1. The orchestrator receives the delegation request
2. It spawns the target agent with ONLY the provided context
3. The delegate works within `max_turns` to satisfy `success_criteria`
4. On each turn, the delegate checks: "Have I met all success criteria?"
5. If yes → return result with `success: true`
6. If `max_turns` reached without success → trigger `fallback_action`

### 3. Handback

The delegate returns a structured response matching `return_format`:
- `"text"` → free-form analysis or recommendation
- `"json"` → structured data matching caller's expected schema
- `"artifact"` → file path(s) of generated artifacts

### 4. Post-Delegation

The caller receives the result and:
- If `success: true` → integrates the result and continues
- If `success: false` and `fallback_action: "escalate"` → surfaces to HITL gate
- If `success: false` and `fallback_action: "skip"` → logs warning, continues without result
- If `success: false` and `fallback_action: "retry"` → re-invokes with same params (max 1 retry)

## Best Practices

### DO

1. **Scope narrowly** — One sub-question per delegation. "Review auth flow in `src/auth/`" not "Review the whole codebase"
2. **Define success criteria upfront** — The delegate must know exactly when it's done. Use measurable criteria: "no CRITICAL findings", "coverage ≥ 80%", "schema validates"
3. **Limit context** — Pass only the files/state the delegate needs. Less context = faster, more focused work
4. **Set turn limits** — Default 5 is usually sufficient. Complex tasks max 10. If it needs more, it's too big to delegate.
5. **Require structured return** — Always specify `return_format` so the caller can parse the result programmatically
6. **Use blocking priority** — Unless the caller can genuinely continue without the result
7. **Audit everything** — Every delegation produces an `audit_entry` for traceability

### DO NOT

1. **No re-delegation** — A delegate MUST NOT delegate further. Depth is always 1. If it can't solve it, escalate.
2. **No full-phase delegation** — If the task is big enough for a pipeline phase, use the orchestrator
3. **No open-ended tasks** — "Make this better" is not a valid delegation. Be specific.
4. **No state mutation** — Delegates should return results, not modify shared state directly
5. **No secret passing** — Never include API keys, tokens, or credentials in delegation context
6. **No circular delegation** — Agent A → Agent B → Agent A is forbidden. The system rejects it.
7. **No delegation without success criteria** — The `success_criteria` field is mandatory for a reason

## Examples

### Example 1: Security micro-review

```json
{
  "task": "Review the authentication middleware for OWASP Top 10 vulnerabilities",
  "target_agent": "reviewer",
  "context": {
    "files": ["src/middleware/auth.ts", "src/middleware/jwt.ts"],
    "constraints": ["Focus only on auth flow, not general code quality"]
  },
  "success_criteria": [
    "All OWASP Top 10 categories checked",
    "No CRITICAL severity findings remain unaddressed",
    "Each finding includes remediation suggestion"
  ],
  "max_turns": 5,
  "return_format": "json",
  "fallback_action": "escalate"
}
```

### Example 2: Schema validation sub-task

```json
{
  "task": "Validate the proposed users table schema against our database conventions",
  "target_agent": "architect",
  "context": {
    "files": ["migrations/003_create_users.sql"],
    "constraints": ["Must follow soft-delete pattern", "Must include audit columns"]
  },
  "success_criteria": [
    "Schema has created_at, updated_at, deleted_at columns",
    "Primary key is UUID",
    "All indexes are justified with query pattern"
  ],
  "max_turns": 3,
  "return_format": "json",
  "fallback_action": "escalate"
}
```

### Example 3: Test generation for flagged code

```json
{
  "task": "Generate edge-case unit tests for the calculateDiscount function",
  "target_agent": "tester",
  "context": {
    "files": ["src/pricing/discount.ts"],
    "state_keys": ["requirements.pricing_rules"]
  },
  "success_criteria": [
    "Tests cover: zero amount, negative amount, max discount cap, expired coupon, stacked discounts",
    "All tests pass when run",
    "Branch coverage ≥ 90%"
  ],
  "max_turns": 5,
  "return_format": "artifact",
  "fallback_action": "retry"
}
```

## Output Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["result", "success", "turns_used", "audit_entry"],
  "properties": {
    "result": {
      "type": "object",
      "description": "The delegate's structured response"
    },
    "success": {
      "type": "boolean"
    },
    "turns_used": {
      "type": "integer",
      "minimum": 1
    },
    "escalation": {
      "type": ["object", "null"],
      "properties": {
        "reason": { "type": "string" },
        "partial_result": { "type": "object" }
      }
    },
    "audit_entry": {
      "type": "object",
      "required": ["delegator", "target_agent", "task_hash", "timestamp", "duration_ms", "success"],
      "properties": {
        "delegator": { "type": "string" },
        "target_agent": { "type": "string" },
        "task_hash": { "type": "string" },
        "timestamp": { "type": "string", "format": "date-time" },
        "duration_ms": { "type": "integer" },
        "success": { "type": "boolean" }
      }
    }
  }
}
```

## HITL Gates

| Gate | Condition | Description |
|------|-----------|-------------|
| `delegation-escalation` | `success: false && fallback_action: "escalate"` | Delegate failed; human decides next step |
| `high-risk-delegation` | `target_agent in ["builder"] && context.files includes security-critical paths` | Human approves before delegating code changes to security-sensitive areas |

## Feedback Loops

| Trigger | Target | Payload |
|---------|--------|---------|
| `success: false && fallback_action: "retry"` | Same delegate skill | Re-invoke with identical params + `retry_context: { previous_attempt: result }` |
| `success: false && fallback_action: "escalate"` | Orchestrator HITL | Escalation reason + partial result for human review |

## Anti-Patterns

| Anti-Pattern | Why It's Bad | Better Approach |
|---|---|---|
| Delegating an entire feature | Too broad, no clear success criteria | Break into pipeline phases |
| Chaining 3+ delegations sequentially | Creates hidden pipeline; hard to debug | Use orchestrator with explicit phases |
| Delegating without context | Delegate wastes turns gathering info | Always provide scoped file paths |
| Using delegation for simple tool calls | Overhead without benefit | Call the tool directly |
| Vague success criteria like "looks good" | No way to verify completion | Use measurable criteria |

## Required Context

- The calling agent must have identified a specific sub-task that is outside its domain expertise.
- The target agent must exist in the system's agent registry.
- If `context.files` are specified, those files must exist and be readable.
- Prior delegation audit entries (if this is a retry) should be available in session context.
- **Graphify retrieval-first:** Before delegating, check if `graphify-out/graph.json` exists and run `graphify path "<caller_domain>" "<target_domain>"` to verify the delegation path is architecturally sound.

## Execution Logic

```
Step 1 — Validate Delegation Request
  Assert task is non-empty string
  Assert target_agent exists in agent registry
  Assert success_criteria has ≥ 1 entry
  Assert depth == 0 (no re-delegation)
  If validation fails → reject with error

Step 2 — Scope Context
  Filter context to only specified files/state_keys
  Compute context token count
  If context > 4000 tokens → compress using context-compressor

Step 3 — Spawn Delegate
  Create isolated agent session for target_agent
  Inject: task + context + success_criteria + constraints
  Set turn budget = max_turns (default 5)

Step 4 — Monitor Execution
  On each turn:
    Check if delegate signals completion
    Check if success_criteria are met
    If turns_used >= max_turns → trigger fallback_action

Step 5 — Collect Result
  Parse delegate response according to return_format
  Evaluate success_criteria against result
  Set success = all criteria met

Step 6 — Handback
  If success → return result to caller
  If !success → execute fallback_action (escalate/skip/retry)
  Write audit_entry to session log
```

## Token Optimization

- Compress delegation context to ≤ 4000 tokens before passing to delegate.
- Use file path references instead of inline file content when possible.
- Strip irrelevant state keys from context — only pass what's in `context.state_keys`.
- For retry attempts, include only the delta (what changed) rather than full prior attempt.

## Quality Checklist

- [ ] Task description is specific and actionable (not vague)
- [ ] Target agent is appropriate for the task domain
- [ ] Success criteria are measurable and verifiable
- [ ] Context is minimal — no unnecessary files or state
- [ ] max_turns is reasonable for task complexity (3-5 typical, 10 max)
- [ ] fallback_action is explicitly chosen (not left to default blindly)
- [ ] No secrets or credentials in context
- [ ] No circular delegation possible
- [ ] return_format matches what the caller will parse

## Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Behavior |
|------|---------|---------|----------|
| `delegation-escalation` | Delegate fails all criteria after max_turns | 30 min | Human reviews partial result and decides: retry with guidance, skip, or abort |
| `high-risk-delegation` | Target is `builder` and files include auth/payment paths | Immediate | Human must approve before delegation proceeds |
| `cross-domain-delegation` | Caller and target are in different security domains | Immediate | Human verifies context scope is appropriate |

## Skill Composition

| Composed Skill | Relationship | Purpose |
|---|---|---|
| `orchestrator` (SKL-010) | Parent | Orchestrator invokes delegate for intra-phase sub-tasks |
| `context-compressor` | Utility | Compresses large context before passing to delegate |
| `state-manager` (SKL-021) | Utility | Reads/writes audit entries and session state |
| Any target agent skill | Target | The actual skill executed by the delegate agent |

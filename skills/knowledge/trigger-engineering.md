# Trigger Engineering — Knowledge Reference

## Principles

- **Triggers are contracts**: A trigger condition is a binding promise about when a skill will and will not activate. Vague triggers produce routing errors that corrupt the pipeline.
- **Positive and negative parity**: Every trigger definition must include both positive examples (phrases that SHOULD activate the skill) and negative examples (phrases that should NOT). A trigger defined only by positives will fire on adjacent intents.
- **Conflict resolution is mandatory**: When two skills could legitimately match the same input, the tie-breaking rule must be explicit — not left to inference. Ambiguity in routing causes non-deterministic pipeline behavior.
- **Edge cases are the real test**: A trigger that handles the obvious cases but fails on edge cases (e.g., multi-intent inputs, implicit requests) is incomplete. Edge-case coverage is a first-class trigger engineering concern.
- **Triggers evolve with the skill**: When a skill's capabilities change, its triggers must be re-evaluated. Stale triggers cause routing errors that are harder to debug than specification errors.

## Trigger Categories

| Category | Description | Example |
|----------|------------|---------|
| Direct invocation | User explicitly names the skill's action | "analyze requirements", "create an ADR" |
| Implicit intent | User describes a problem the skill solves | "I don't know what's needed", "we need to decide on the database" |
| Event-driven | A system event activates the skill | `code.changed` → clean-code-review |
| Pipeline-sequential | Prior skill output triggers this skill | requirement-analyzer output → architecture-design |
| Conflict-resolved | Multiple skills could match; this one wins by rule | "review this" → clean-code-review (not security-review) if no security keyword |

## Conflict Resolution Rules

When two skills' trigger conditions overlap, apply these rules in order:

1. **Specificity wins**: The skill with more specific trigger language wins over the more generic one.
2. **Domain wins**: If both are equally specific, the domain-aligned skill wins (security keyword → security-review, even if clean-code-review also matches).
3. **Explicit disambiguation**: If rules 1–2 don't resolve, the trigger spec must include an explicit `conflicts_with` block that defines the tie-breaking condition.

## Anti-patterns

- **Keyword soup**: Defining triggers as a flat list of keywords without semantic context. "review", "check", "look at" — these activate on almost everything.
- **Trigger monopoly**: A single skill claiming triggers so broad that no other skill can activate (e.g., "any code request" for clean-code-review). Triggers must be scoped.
- **Missing negatives**: No negative examples in the trigger spec. Without negatives, the trigger boundary is undefined.
- **Implicit pipeline activation**: Assuming a skill will activate "obviously" because it's next in the pipeline. All sequential activations must be explicitly declared.

## Source References

- Intent classification in dialogue systems (Rasa NLU, Dialogflow CX)
- Information retrieval precision/recall tradeoffs
- Prompt routing techniques in multi-agent systems

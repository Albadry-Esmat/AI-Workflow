# ADR Generator — Knowledge Reference

## Principles

- **ADRs are immutable records, not living documents**: Once an ADR has `status: accepted`, its content does not change. If a decision changes, a new ADR supersedes the old one. In-place editing of accepted ADRs is prohibited.
- **Alternatives are mandatory**: An ADR without at least two alternatives is not a decision record — it is a decree. The value of an ADR is in capturing what was NOT chosen and why.
- **Context is the most important section**: Developers reading an ADR years later need to understand the constraints that existed at the time of the decision. Without context, the decision appears arbitrary.
- **One decision per ADR**: ADRs that capture multiple decisions conflate context and make future supersession impossible. If a meeting produced three decisions, create three ADRs.
- **ADRs are linked to code**: Every ADR that affects code structure should be referenced from the affected module's documentation. Unlinked ADRs become orphans.

## MADR Format Structure

The system uses the MADR (Markdown Architectural Decision Records) format:

```markdown
# ADR-NNNN: {Title}

Date: {YYYY-MM-DD}
Status: {proposed|accepted|deprecated|superseded}
Supersedes: {ADR-NNNN or N/A}

## Context
{The problem, constraint, or situation that forced this decision.}

## Decision
{The decision made, in one or two sentences.}

## Alternatives Considered

### Option 1: {Name} ← CHOSEN
- Pro: ...
- Con: ...

### Option 2: {Name}
- Pro: ...
- Con: ...

## Consequences

### Positive
- ...

### Negative
- ...
```

## When to Create an ADR

| Trigger | ADR Needed? |
|---------|------------|
| Technology stack selection (language, framework, database) | Yes |
| Module boundary decision | Yes |
| API contract choice (REST vs GraphQL, sync vs async) | Yes |
| Security architecture decision | Yes |
| Performance optimization that changes design | Yes |
| Bug fix | No |
| Implementation detail inside a module | No |
| Style/formatting choice | No |

## Anti-patterns

- **Retroactive ADRs**: Writing an ADR after the decision has already been fully implemented and cannot be revisited. ADRs have value when they still influence implementation — write them before code is written.
- **Consensus ADRs**: ADRs that only record the chosen option and present no rejected alternatives. This hides the reasoning and prevents future re-evaluation.
- **Vague context**: "We needed to choose a database." Context must describe the specific constraints: scale requirements, consistency needs, team expertise, cost constraints.
- **Supersession without link**: Deprecating an ADR by writing a new one without adding `Supersedes: ADR-NNNN` to the new ADR. The trail of decisions must be navigable.

## Source References

- MADR format specification (adr.github.io/madr)
- "Documenting Architecture Decisions" (Michael Nygard, 2011)
- ADR tooling: adr-tools, Log4brains

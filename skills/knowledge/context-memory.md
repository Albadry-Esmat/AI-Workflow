# Context Memory — Knowledge Reference

## Principles

- **Session continuity over re-computation**: A session that resumes from a serialized state snapshot is strictly cheaper than re-running the pipeline from scratch. Never discard recoverable context when compression will suffice.
- **Scoped persistence**: Store only what downstream skills need — not the full conversation history. Irrelevant context is noise that inflates token cost.
- **Deterministic restore**: A restored session must produce the same pipeline state as the original — same module assignments, same dependency graph, same open questions. Serialization must be lossless for decision-critical fields.
- **Compression before discard**: Always attempt semantic compression (via context-compressor) before dropping context. Dropped context is unrecoverable.
- **Single writer**: Only the orchestrator writes session state. All other skills consume read-only slices.

## Scope of Managed Context

| Context Scope | Content | Retention Policy |
|--------------|---------|-----------------|
| `session_header` | session_id, start_time, pipeline_template, language | Always retain — never compress |
| `requirements` | Structured requirement objects from requirement-analyzer | Retain full — compress summaries only |
| `architecture` | Module definitions and integration contracts | Retain full |
| `dependency_graph` | Node/edge graph from dependency-analyzer | Retain full |
| `feature_plan` | Task graph with status per task | Retain full |
| `code_map` | File tree with module assignments | Retain hashes only after code is written to disk |
| `test_state` | Coverage targets, last run results, failures | Retain last run only |
| `decision_log` | ADR references | Retain IDs + titles only — full content in files |
| `open_questions` | Unresolved clarification items | Retain until answered or explicitly dismissed |
| `token_budget` | Current tier, consumed, remaining | Retain full — always fresh |

## Compression Strategy

When token pressure is detected (`token_budget.remaining < 20%`):

1. Compress `code_map` to hashes + paths only
2. Compress `feature_plan` completed tasks to `{ id, status: "done" }` — drop task bodies
3. Compress `requirements` to `{ id, title, acceptance_criteria }` — drop elaboration fields
4. Never compress: `open_questions`, `session_header`, `token_budget`, `architecture.modules[*].public_api`

## Anti-patterns

- **God-context**: Storing the full conversation transcript as context. Use structured state slices — not history.
- **Context drift**: Restoring an old snapshot without checking whether architecture or requirements have changed since. Always diff on restore.
- **Silent discard**: Dropping context without emitting a `context.dropped` event. Dropped context must be logged so the orchestrator can decide whether to re-fetch.
- **Cross-session bleed**: Failing to isolate session IDs — restoring state from a different feature's session into the current one.

## Source References

- Anthropic context window management best practices
- Token efficiency patterns in long-horizon agentic tasks
- LangGraph session state serialization model

# Event Router — Knowledge Reference

## Principles

- **Every change is an event**: Code writes, architecture updates, test failures, security findings, and documentation drift are all events. Nothing propagates through the pipeline by direct skill-to-skill calls — only through events.
- **Dispatch map is the routing contract**: The `dispatch_map` is the authoritative mapping from event type to skill handler. It is the only place where routing decisions are made. Ad-hoc routing outside the dispatch map is prohibited.
- **Deduplication prevents cascade storms**: In an event-driven system, a single root cause can generate multiple identical events (e.g., multiple `code.changed` events from a batch write). The event router deduplicates on `event.id` to prevent duplicate skill invocations.
- **Unknown events are warnings, not errors**: An event type with no registered handler does not crash the system — it emits a warning and is logged. Unknown event types indicate a routing gap that should be addressed in the dispatch map.
- **Event payload security**: Payloads are scrubbed of credential patterns before routing. The event bus is not a channel for secrets.

## Built-in Event Types

| Event Type | Source | Default Handlers |
|-----------|--------|-----------------|
| `requirement.created` | requirement-analyzer | requirement-analyzer |
| `requirement.changed` | requirement-analyzer | requirement-analyzer, change-impact-analyzer |
| `architecture.changed` | architecture-design | architecture-design, dependency-analyzer, change-impact-analyzer |
| `code.changed` | code-generator, code-repair | clean-code-review, dependency-analyzer, change-impact-analyzer |
| `test.failed` | test runner | code-repair |
| `security.finding` | security-review | security-review |
| `deployment.requested` | orchestrator | deployment-strategy |
| `skill.registered` | skill-authoring | validation-rules, skill-lifecycle |
| `file.written` | any skill | doc-maintainer |
| `context.pressure_high` | orchestrator | context-compressor |
| `pipeline.cancel` | rollback-manager | orchestrator (cancellation handler) |

## Event Schema

```json
{
  "id":           "uuid — unique per event, used for deduplication",
  "type":         "string — dot-notation event type",
  "payload":      "object — event-specific data",
  "source_skill": "string — skill that emitted the event",
  "timestamp":    "ISO8601 string",
  "session_id":   "string — links event to pipeline session"
}
```

## Anti-patterns

- **Event flooding**: A skill emitting events on every minor state change. Events should represent meaningful state transitions, not fine-grained operations. Batch multiple related changes into one event.
- **Payload bloat**: Including full file contents or large objects in event payloads. Payloads should contain IDs and change summaries — not full artifacts.
- **Synchronous event chains**: Handler A emitting an event that synchronously triggers Handler B which emits an event to trigger Handler A. This creates synchronous call loops. Use async dispatch for all non-critical handlers.
- **Bypassing the router**: A skill calling another skill directly instead of emitting an event. Direct calls break observability and deduplication.

## Source References

- Event-driven architecture patterns (Gregor Hohpe, "Enterprise Integration Patterns")
- CQRS + Event Sourcing patterns
- CloudEvents specification (CNCF) — event schema standard
